"""Private offline-review application: local mode or password-protected web mode."""
import base64
import hashlib
import io
import json
import os
import mimetypes
from pathlib import Path
import re
import sqlite3
from .validation import validate_hand
from . import auth
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

STATIC_DIR = Path(__file__).resolve().parents[1] / 'dist'

DB = Path(os.environ.get('POKER_DB', str(Path(__file__).resolve().parents[1] / 'data' / 'poker.sqlite3')))


def connect():
    DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.executescript('''CREATE TABLE IF NOT EXISTS hands(id TEXT PRIMARY KEY, title TEXT NOT NULL, payload TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, credential TEXT NOT NULL, expires REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS passages(doc TEXT, number INTEGER, page INTEGER, text TEXT NOT NULL, FOREIGN KEY(doc) REFERENCES documents(id));''')
    return con


def import_document(name, content):
    name = Path(name).name[:200]
    raw = base64.b64decode(content, validate=True)
    if len(raw) > 8_000_000:
        raise ValueError('教材上限 8 MB')
    suffix = Path(name).suffix.lower()
    if suffix == '.pdf':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        pages = [(i + 1, p.extract_text() or '') for i, p in enumerate(reader.pages)]
    elif suffix in ('.txt', '.md'):
        pages = [(None, raw.decode('utf-8-sig'))]
    else:
        raise ValueError('只支援 UTF-8 TXT、Markdown 與文字型 PDF')
    passages = [(page, p.strip()) for page, text in pages for p in re.split(r'\n\s*\n', text) if p.strip()]
    if not passages:
        raise ValueError('沒有可搜尋文字；掃描 PDF 請先 OCR')
    key = hashlib.sha256(raw + name.encode()).hexdigest()[:24]
    with connect() as con:
        con.execute('INSERT OR REPLACE INTO documents VALUES (?,?)', (key, name))
        con.execute('DELETE FROM passages WHERE doc=?', (key,))
        con.executemany('INSERT INTO passages VALUES (?,?,?,?)', [(key, i + 1, page, p) for i, (page, p) in enumerate(passages)])
    return {'id': key, 'paragraphs': len(passages)}


class Handler(BaseHTTPRequestHandler):
    def respond(self, code, data, cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Referrer-Policy', 'same-origin')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def allowed_host(self):
        host = self.headers.get('Host', '').split(':')[0]
        allowed = {'127.0.0.1', 'localhost'}
        if auth.public_mode():
            allowed.update(x.strip().lower() for x in os.environ.get('POKER_ALLOWED_HOSTS', '').split(',') if x.strip())
            allowed.update(os.environ.get(k, '').lower() for k in ('RENDER_EXTERNAL_HOSTNAME', 'RENDER_INTERNAL_HOSTNAME'))
        if host.lower() not in allowed:
            self.respond(403, {'error': 'Host not allowed'})
            return False
        return True

    def authorized(self):
        with connect() as con:
            ok = auth.authenticated(self.headers, con)
        if not ok:
            self.respond(401, {'error': '請先登入私人工作台'})
        return ok

    def valid_origin(self):
        origin = self.headers.get('Origin')
        if self.headers.get('Sec-Fetch-Site') == 'cross-site' or (origin and urlparse(origin).netloc.lower() != self.headers.get('Host', '').lower()):
            self.respond(403, {'error': 'Cross-site request rejected'})
            return False
        return True

    def do_GET(self):
        if not self.allowed_host():
            return
        path = urlparse(self.path)
        q = parse_qs(path.query).get('q', [''])[0].strip().casefold()
        if path.path == '/api/health':
            return self.respond(200, {'status': 'ok', 'mode': 'offline-review', 'version': '0.2.0'})
        if path.path == '/api/session':
            with connect() as con:
                return self.respond(200, {'required': auth.required(), 'authenticated': auth.authenticated(self.headers, con)})
        if path.path.startswith('/api/') and not self.authorized():
            return
        with connect() as con:
            if path.path == '/api/hands':
                rows = [json.loads(r['payload']) for r in con.execute('SELECT payload FROM hands ORDER BY created DESC, rowid DESC')]
                return self.respond(200, [h for h in rows if q in json.dumps(h, ensure_ascii=False).casefold()])
            if path.path == '/api/documents':
                return self.respond(200, [dict(r) for r in con.execute('SELECT d.id,d.name,COUNT(p.number) AS paragraphs FROM documents d LEFT JOIN passages p ON p.doc=d.id GROUP BY d.id')])
            if path.path == '/api/search':
                rows = con.execute('SELECT d.id,d.name,p.number,p.page,p.text FROM passages p JOIN documents d ON p.doc=d.id ORDER BY d.name,p.number')
                terms = q.split()
                return self.respond(200, [dict(r) for r in rows if terms and all(t in r['text'].casefold() for t in terms)][:100])
        self.serve_frontend(path.path)

    def serve_frontend(self, path):
        if path.startswith('/api/'):
            return self.respond(404, {'error': 'Not found'})
        root = STATIC_DIR.resolve()
        target = (root / ('index.html' if path == '/' else unquote(path).lstrip('/'))).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            return self.respond(404, {'error': 'Not found'})
        body = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.allowed_host():
            return
        if not self.valid_origin():
            return
        if self.path == '/api/logout':
            with connect() as con:
                con.execute('DELETE FROM sessions WHERE token=?', (auth.token_hash(auth.read_token(self.headers)),))
            return self.respond(200, {'ok': True}, auth.cookie_header(clear=True))
        if self.path != '/api/login' and not self.authorized():
            return
        if self.headers.get_content_type() != 'application/json':
            return self.respond(415, {'error': 'JSON required'})
        try:
            length = int(self.headers.get('Content-Length', 0))
            limit = 4096 if self.path == '/api/login' else 12_000_000
            if not 0 < length <= limit:
                return self.respond(413, {'error': 'Request size limit'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('JSON object required')
            if self.path == '/api/login':
                with connect() as con:
                    code, token = auth.login(data.get('password'), con)
                if code != 200:
                    return self.respond(code, {'error': '嘗試次數過多，請稍後一分鐘再試' if code == 429 else '密碼不正確'})
                return self.respond(200, {'authenticated': True}, auth.cookie_header(token))
            if self.path == '/api/hands':
                validate_hand(data)
                key = str(data.get('id', ''))[:100]
                if not key:
                    raise ValueError('Missing hand id')
                with connect() as con:
                    con.execute('INSERT INTO hands(id,title,payload) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,payload=excluded.payload', (key, str(data.get('title', 'Hand')), json.dumps(data, ensure_ascii=False)))
                return self.respond(200, {'id': key})
            if self.path == '/api/documents':
                if data.get('authorized') is not True:
                    raise ValueError('請確認有權私人使用此教材')
                return self.respond(200, import_document(data['name'], data['content']))
        except Exception as e:
            return self.respond(400, {'error': str(e)[:300]})
        self.respond(404, {'error': 'Not found'})

    def do_DELETE(self):
        if not self.allowed_host():
            return
        if not self.valid_origin() or not self.authorized():
            return
        parts = urlparse(self.path).path.split('/')
        if len(parts) != 4 or parts[2] not in ('hands', 'documents'):
            return self.respond(404, {'error': 'Not found'})
        with connect() as con:
            if parts[2] == 'hands':
                con.execute('DELETE FROM hands WHERE id=?', (parts[3],))
            else:
                con.execute('DELETE FROM passages WHERE doc=?', (parts[3],))
                con.execute('DELETE FROM documents WHERE id=?', (parts[3],))
        self.respond(200, {'deleted': True})


if __name__ == '__main__':
    connect().close()
    port = int(os.environ.get('POKER_PORT', os.environ.get('PORT', '8000')))
    bind = '0.0.0.0' if auth.public_mode() else '127.0.0.1'
    auth.validate_startup(bind)
    print(f'Poker OS private review: {bind}:{port}', flush=True)
    ThreadingHTTPServer((bind, port), Handler).serve_forever()
