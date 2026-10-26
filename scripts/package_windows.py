"""Build the Windows source + compiled-web bundle without private workspace files."""
import hashlib
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOP_LEVEL = [
    '.gitignore', 'README.md', 'Start-Poker-OS.cmd', 'start-windows.ps1',
    'windows_bootstrap.py', 'requirements.txt', 'package.json', 'package-lock.json',
    'index.html', 'vite.config.js', 'playwright.config.js', 'playwright.web.config.js',
    'DEPLOY.md', 'Dockerfile', '.dockerignore', 'render.yaml',
]
FOLDERS = ['dist', 'server', 'src', 'tests', 'examples', 'public', 'scripts']
GUIDE = '''Poker OS v0.1.1 - Windows 開啟方法

1. 右鍵按下載的 ZIP，選「全部解壓縮」。
2. 開啟解壓後的 Poker-OS 資料夾。
3. 雙擊 Start-Poker-OS.cmd（顯示為 Start-Poker-OS 也可以）。
4. 第一次會檢查及安裝 Python 和 PDF 套件，等候幾分鐘。
5. 瀏覽器會自動開啟。使用時保留黑色視窗。

v0.1.1 修正 Windows PowerShell 傳遞 Python 指令時的引號問題。
不用打指令，不用 Node.js，不用登入。
如未能開啟，保留黑色視窗的錯誤訊息再求助；不要停用防毒保護。
資料保存在 data 資料夾，請自行備份。
啟動器已測試 PowerShell Legacy/Standard 呼叫；尚未在真實 Windows 電腦驗證。
'''


def main():
    if not (ROOT / 'dist/index.html').is_file():
        raise SystemExit('Build the frontend with npm run build first.')
    files = [ROOT / name for name in TOP_LEVEL]
    for folder in FOLDERS:
        files.extend(p for p in (ROOT / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
    dest = ROOT / 'downloads'
    dest.mkdir(exist_ok=True)
    output = dest / 'Poker-OS-Windows.zip'
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            archive.write(path, 'Poker-OS/' + path.relative_to(ROOT).as_posix())
        archive.writestr('Poker-OS/先睇我.txt', GUIDE.encode('utf-8-sig'))
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Archive integrity check failed.')
        names = archive.namelist()
        required = ['dist/index.html', 'Start-Poker-OS.cmd', 'start-windows.ps1', 'windows_bootstrap.py']
        assert all('Poker-OS/' + name in names for name in required)
        assert not any(any(part in name.split('/') for part in ['data', '.git', '.venv', 'node_modules', '.env']) for name in names)
        assert not any(name.startswith('/') or '..' in name.split('/') for name in names)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    (dest / 'SHA256SUMS.txt').write_text(digest + '  Poker-OS-Windows.zip\n')
    print(f'Windows v0.1.1: {len(names)} files, {output.stat().st_size} bytes; integrity and private-file exclusion checks passed.')
    print('SHA-256:', digest)


if __name__ == '__main__':
    main()
