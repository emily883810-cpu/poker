import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from server import app, auth

TEST_PASSWORD = 'test-only-password-not-for-deployment'


class PrivateWebTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.old_db = app.DB
        app.DB = Path(cls.temp.name) / 'private.sqlite3'
        cls.env = patch.dict(os.environ, {'POKER_PUBLIC': '1', 'POKER_PASSWORD': TEST_PASSWORD})
        cls.env.start()
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.env.stop()
        app.DB = cls.old_db
        cls.temp.cleanup()

    def setUp(self):
        with auth._lock:
            auth._failures.clear()

    def request(self, path, body=None, cookie=None, method=None, headers=None):
        hdrs = {'Content-Type': 'application/json', **(headers or {})}
        if cookie:
            hdrs['Cookie'] = cookie
        req = Request(self.url + path, json.dumps(body).encode() if body is not None else None, headers=hdrs, method=method)
        with urlopen(req) as res:
            return json.load(res), res.headers

    def sign_in(self):
        data, headers = self.request('/api/login', {'password': TEST_PASSWORD})
        self.assertTrue(data['authenticated'])
        return headers['Set-Cookie']

    def test_all_private_routes_require_authentication(self):
        for path in ('/api/hands', '/api/documents', '/api/search?q=secret'):
            with self.assertRaises(HTTPError) as err:
                self.request(path)
            self.assertEqual(err.exception.code, 401)
        with self.assertRaises(HTTPError) as err:
            self.request('/api/hands', {'completed': True})
        self.assertEqual(err.exception.code, 401)
        with self.assertRaises(HTTPError) as err:
            self.request('/api/documents/anything', method='DELETE')
        self.assertEqual(err.exception.code, 401)
        data, _ = self.request('/api/session')
        self.assertEqual(data, {'required': True, 'authenticated': False})
        self.assertEqual(self.request('/api/health')[0]['status'], 'ok')

    def test_cookie_flags_session_reload_and_revocable_logout(self):
        cookie = self.sign_in()
        for flag in ('HttpOnly', 'SameSite=Strict', 'Secure', 'Max-Age=604800'):
            self.assertIn(flag, cookie)
        self.assertTrue(self.request('/api/session', cookie=cookie)[0]['authenticated'])
        self.assertEqual(self.request('/api/hands', cookie=cookie)[0], [])
        token = cookie.split(';')[0].split('=', 1)[1]
        with app.connect() as con:
            row = con.execute('SELECT token FROM sessions').fetchone()
            self.assertNotEqual(row['token'], token)
        self.request('/api/logout', {}, cookie=cookie)
        self.assertFalse(self.request('/api/session', cookie=cookie)[0]['authenticated'])

    def test_rotation_expiry_and_forged_token_are_rejected(self):
        cookie = self.sign_in()
        with patch.dict(os.environ, {'POKER_PASSWORD': 'another-test-only-password'}):
            self.assertFalse(self.request('/api/session', cookie=cookie)[0]['authenticated'])
        with app.connect() as con:
            con.execute('UPDATE sessions SET expires=0')
        self.assertFalse(self.request('/api/session', cookie=cookie)[0]['authenticated'])
        self.assertFalse(self.request('/api/session', cookie='poker_session=forged')[0]['authenticated'])

    def test_wrong_password_and_login_rate_limit(self):
        for _ in range(10):
            with self.assertRaises(HTTPError) as err:
                self.request('/api/login', {'password': 'wrong'})
            self.assertEqual(err.exception.code, 401)
        with self.assertRaises(HTTPError) as err:
            self.request('/api/login', {'password': TEST_PASSWORD})
        self.assertEqual(err.exception.code, 429)

    def test_cross_site_and_unknown_host_are_rejected(self):
        cookie = self.sign_in()
        with self.assertRaises(HTTPError) as err:
            self.request('/api/logout', {}, cookie=cookie, headers={'Origin': 'https://other.example'})
        self.assertEqual(err.exception.code, 403)
        with self.assertRaises(HTTPError) as err:
            self.request('/api/hands', headers={'Host': 'other.example'})
        self.assertEqual(err.exception.code, 403)
        with patch.dict(os.environ, {'POKER_ALLOWED_HOSTS': 'private.example'}):
            self.assertEqual(self.request('/api/health', headers={'Host': 'private.example'})[0]['status'], 'ok')

    def test_no_public_server_without_a_strong_password(self):
        auth.validate_startup('0.0.0.0')
        with patch.dict(os.environ, {'POKER_PASSWORD': ''}):
            with self.assertRaises(RuntimeError):
                auth.validate_startup('0.0.0.0')
        with patch.dict(os.environ, {'POKER_PUBLIC': '0', 'POKER_PASSWORD': ''}):
            with self.assertRaises(RuntimeError):
                auth.validate_startup('0.0.0.0')
            auth.validate_startup('127.0.0.1')


if __name__ == '__main__':
    unittest.main()
