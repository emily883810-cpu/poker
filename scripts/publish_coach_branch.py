"""Prepare a static-only Pages branch without switching or deleting the checkout.

Run npm run build:coach first. This creates a local commit/ref only; push and
GitHub Pages activation are separate, explicit steps. No hand database is copied.
"""
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def git(*args, data=None, env=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, input=data, env=env).decode().strip()


def main():
    output = ROOT / 'coach-dist'
    files = [p for p in output.rglob('*') if p.is_file()]
    if not (output / 'index.html').is_file():
        raise SystemExit('Run npm run build:coach first.')
    for p in files:
        relative = p.relative_to(output).as_posix()
        if relative not in ('index.html', 'favicon.svg') and not relative.startswith('assets/'):
            raise SystemExit('Unexpected static output: ' + relative)
    # Only generated web files enter the branch; private data and source fixtures do not.
    workspace = tempfile.TemporaryDirectory(prefix='poker-pages-index-')
    index = str(Path(workspace.name) / 'index')
    env = {**os.environ, 'GIT_INDEX_FILE': index}
    try:
        git('read-tree', '--empty', env=env)
        for p in files:
            name = p.relative_to(output).as_posix()
            blob = git('hash-object', '-w', str(p))
            git('update-index', '--add', '--cacheinfo', f'100644,{blob},{name}', env=env)
        empty = git('hash-object', '-w', '--stdin', data=b'')
        git('update-index', '--add', '--cacheinfo', f'100644,{empty},.nojekyll', env=env)
        tree = git('write-tree', env=env)
        prior = subprocess.run(['git', 'rev-parse', '--verify', 'refs/heads/coach-pages'], cwd=ROOT, capture_output=True, text=True)
        parents = ['-p', prior.stdout.strip()] if prior.returncode == 0 else []
        sha = git('-c', 'user.name=Codex', '-c', 'user.email=codex@users.noreply.github.com', 'commit-tree', tree, *parents, data=b'Publish static coach notes converter and hand viewer\n')
        git('update-ref', 'refs/heads/coach-pages', sha, prior.stdout.strip() if prior.returncode == 0 else '0' * 40)
        print('Prepared static-only coach-pages commit:', sha)
        print('Next: git push origin coach-pages; then enable GitHub Pages from coach-pages / (root).')
    finally:
        Path(index).unlink(missing_ok=True)
        Path(index + '.lock').unlink(missing_ok=True)
        workspace.cleanup()


if __name__ == '__main__':
    main()
