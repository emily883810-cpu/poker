"""Single-owner password login with revocable, server-side sessions."""
from collections import deque
import hashlib
import hmac
from http.cookies import SimpleCookie
import os
import secrets
import threading
import time

SESSION_SECONDS = 7 * 24 * 60 * 60
_failures = deque()
_lock = threading.Lock()


def public_mode():
    return os.environ.get('POKER_PUBLIC') == '1'


def password():
    return os.environ.get('POKER_PASSWORD', '')


def required():
    return public_mode() or bool(password())


def validate_startup(bind):
    if required() and len(password()) < 16:
        raise RuntimeError('Set POKER_PASSWORD to at least 16 characters before enabling private web access.')
    if bind not in ('127.0.0.1', 'localhost') and not public_mode():
        raise RuntimeError('External binding requires POKER_PUBLIC=1 and a private password.')


def credential_digest():
    return hashlib.sha256(password().encode()).hexdigest()


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def read_token(headers):
    try:
        cookie = SimpleCookie()
        cookie.load(headers.get('Cookie', ''))
        return cookie['poker_session'].value if 'poker_session' in cookie else ''
    except Exception:
        return ''


def authenticated(headers, con):
    if not required():
        return True
    token = read_token(headers)
    if not token or not password():
        return False
    row = con.execute('SELECT credential, expires FROM sessions WHERE token=?', (token_hash(token),)).fetchone()
    return bool(row and row['expires'] > time.time() and hmac.compare_digest(row['credential'], credential_digest()))


def login(candidate, con):
    now = time.time()
    with _lock:
        while _failures and _failures[0] < now - 60:
            _failures.popleft()
        if len(_failures) >= 10:
            return 429, None
        if not isinstance(candidate, str) or not password() or not hmac.compare_digest(hashlib.sha256(candidate.encode()).hexdigest(), credential_digest()):
            _failures.append(now)
            return 401, None
    token = secrets.token_urlsafe(32)
    con.execute('DELETE FROM sessions WHERE expires < ?', (now,))
    con.execute('INSERT INTO sessions VALUES (?,?,?)', (token_hash(token), credential_digest(), now + SESSION_SECONDS))
    con.commit()
    return 200, token


def cookie_header(token='', clear=False):
    secure = '; Secure' if public_mode() else ''
    age = 0 if clear else SESSION_SECONDS
    return f'poker_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}{secure}'
