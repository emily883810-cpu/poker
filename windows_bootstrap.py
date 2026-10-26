"""File-based Windows launcher probes: avoid PowerShell native -c quoting."""
import importlib
from importlib import metadata
import sys


def dependencies_ready():
    try:
        if metadata.version('pypdf') != '6.12.0':
            return False
        importlib.import_module('pypdf')
        return True
    except Exception:
        return False


def main(args=None):
    args = sys.argv[1:] if args is None else args
    if args == ['--python-path']:
        if sys.version_info < (3, 12):
            return 2
        print(sys.executable)
        return 0
    if args == ['--dependencies']:
        # Missing packages are an expected first-run condition, not a traceback.
        return 0 if dependencies_ready() else 1
    print('Usage: windows_bootstrap.py --python-path | --dependencies', file=sys.stderr)
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
