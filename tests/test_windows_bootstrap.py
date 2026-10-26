import contextlib
import io
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import windows_bootstrap as bootstrap


class WindowsBootstrapTest(unittest.TestCase):
    def test_dependency_missing_is_expected_not_traceback(self):
        with patch.object(bootstrap.metadata, 'version', side_effect=bootstrap.metadata.PackageNotFoundError):
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                self.assertEqual(bootstrap.main(['--dependencies']), 1)
            self.assertEqual(err.getvalue(), '')

    def test_wrong_version_and_broken_install_are_rejected(self):
        with patch.object(bootstrap.metadata, 'version', return_value='0.0.0'):
            self.assertFalse(bootstrap.dependencies_ready())
        with patch.object(bootstrap.metadata, 'version', return_value='6.12.0'):
            with patch.object(bootstrap.importlib, 'import_module', side_effect=ImportError('broken package')):
                self.assertFalse(bootstrap.dependencies_ready())

    def test_file_probes_work_in_paths_with_spaces_and_non_ascii(self):
        with tempfile.TemporaryDirectory(prefix='Poker OS 測試 & ') as folder:
            script = Path(folder) / 'windows_bootstrap.py'
            shutil.copyfile(Path(bootstrap.__file__), script)
            found = subprocess.run([sys.executable, str(script), '--python-path'], capture_output=True, text=True)
            self.assertEqual(found.returncode, 0)
            self.assertEqual(Path(found.stdout.strip()).resolve(), Path(sys.executable).resolve())
            self.assertEqual(found.stderr, '')
            installed = subprocess.run([sys.executable, str(script), '--dependencies'], capture_output=True, text=True)
            self.assertEqual(installed.returncode, 0)
            missing = subprocess.run([sys.executable, '-S', str(script), '--dependencies'], capture_output=True, text=True)
            self.assertEqual(missing.returncode, 1)
            self.assertEqual(missing.stderr, '')

    def test_launcher_uses_file_probes_not_inline_code(self):
        text = (Path(bootstrap.__file__).parent / 'start-windows.ps1').read_text()
        self.assertNotIn(' -c ', text)
        self.assertIn('$Bootstrap --python-path', text)
        self.assertIn('$Bootstrap --dependencies', text)


if __name__ == '__main__':
    unittest.main()
