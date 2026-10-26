import base64
import json
import tempfile
import unittest
from pathlib import Path
import threading
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from server import app


class APITest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        app.DB = Path(cls.temp.name) / 'test.sqlite3'
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def request(self, path, body=None, method=None):
        req = Request(self.url + '/api' + path, data=json.dumps(body).encode() if body else None, method=method)
        with urlopen(req) as r:
            return json.load(r)

    def test_health(self):
        self.assertEqual(self.request('/health')['mode'], 'offline-review')

    def test_bundled_frontend_and_path_boundary(self):
        original = app.STATIC_DIR
        try:
            root = Path(self.temp.name) / 'web'
            root.mkdir(exist_ok=True)
            (root / 'index.html').write_text('<h1>Poker OS</h1>')
            (root / 'app.js').write_text('const privateReview = true;')
            (Path(self.temp.name) / 'private.txt').write_text('private')
            app.STATIC_DIR = root
            with urlopen(self.url + '/') as res:
                self.assertIn('text/html', res.headers['Content-Type'])
                self.assertIn(b'Poker OS', res.read())
            with urlopen(self.url + '/app.js') as res:
                self.assertIn(b'privateReview', res.read())
            for path in ('/%2e%2e/private.txt', '/api/missing', '/missing.js'):
                with self.assertRaises(HTTPError) as err:
                    urlopen(self.url + path)
                self.assertEqual(err.exception.code, 404)
        finally:
            app.STATIC_DIR = original

    def test_reject_incomplete(self):
        with self.assertRaises(HTTPError) as err:
            self.request('/hands', {'id': 'unfinished', 'completed': False})
        self.assertEqual(err.exception.code, 400)

    def test_material_rights_source_search_dedup_delete(self):
        body = {'name': 'private.md', 'content': base64.b64encode('教材作者觀點：轉牌可以 check。\n\n3BP OOP 策略需要上下文。'.encode()).decode(), 'authorized': False}
        with self.assertRaises(HTTPError):
            self.request('/documents', body)
        body['authorized'] = True
        result = self.request('/documents', body)
        self.request('/documents', body)
        hits = self.request('/search?q=3BP%20OOP')
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]['name'], 'private.md')
        self.assertEqual(hits[0]['number'], 2)
        self.assertIsNone(hits[0]['page'])
        self.assertIn('上下文', hits[0]['text'])
        with app.connect() as con:
            self.assertEqual(con.execute('SELECT COUNT(*) FROM passages').fetchone()[0], 2)
        self.request('/documents/' + result['id'], method='DELETE')
        self.assertEqual(self.request('/search?q=3BP'), [])

    def test_hand_persistence_and_validation(self):
        fixture = json.loads((Path(__file__).resolve().parents[1] / 'examples/completed-hand.json').read_text())
        self.request('/hands', fixture)
        fixture['tags'] = ['B-B-X']
        self.request('/hands', fixture)
        rows = self.request('/hands?q=B-B-X')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['id'], fixture['id'])
        with app.connect() as con:
            self.assertEqual(json.loads(con.execute('SELECT payload FROM hands').fetchone()[0])['tags'], ['B-B-X'])
        fixture['actions'][-1]['amount'] = 99999
        with self.assertRaises(HTTPError):
            self.request('/hands', fixture)
        self.request('/hands/' + fixture['id'], method='DELETE')

    def test_pdf_text_page_provenance(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject
        import io
        writer = PdfWriter()
        page = writer.add_blank_page(width=300, height=300)
        font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
        page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(b'BT /F1 12 Tf 20 200 Td (Private turn study) Tj ET')
        page[NameObject('/Contents')] = writer._add_object(stream)
        buf = io.BytesIO()
        writer.write(buf)
        result = app.import_document('text.pdf', base64.b64encode(buf.getvalue()).decode())
        hit = self.request('/search?q=Private')[0]
        self.assertEqual(hit['page'], 1)
        self.assertEqual(hit['name'], 'text.pdf')
        self.assertIn('turn study', hit['text'])
        self.request('/documents/' + result['id'], method='DELETE')

    def test_pdf_extraction(self):
        from pypdf import PdfWriter
        import io
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        buf = io.BytesIO()
        writer.write(buf)
        with self.assertRaisesRegex(ValueError, 'OCR'):
            app.import_document('scan.pdf', base64.b64encode(buf.getvalue()).decode())


if __name__ == '__main__':
    unittest.main()
