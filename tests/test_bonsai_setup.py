import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('bonsai_setup',Path(__file__).resolve().parents[1]/'scripts/setup-bonsai-local.py')
setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)

def git(folder,*args):return subprocess.check_output(['git','-C',str(folder),*args],stderr=subprocess.DEVNULL).decode().strip()

class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);source=self.root/'source';source.mkdir()
        git(source,'init');(source/'runtime.c').write_text('original\n');git(source,'add','runtime.c')
        git(source,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture')
        self.lock={'runtime_repository':str(source),'runtime_commit':git(source,'rev-parse','HEAD')};self.runtime=self.root/'runtime'
    def tearDown(self):self.temp.cleanup()
    def test_first_run_initializes_no_checkout_clone(self):
        setup.prepare_runtime(self.runtime,self.lock)
        self.assertEqual(git(self.runtime,'rev-parse','HEAD'),self.lock['runtime_commit'])
        self.assertEqual((self.runtime/'runtime.c').read_text(),'original\n');self.assertEqual(git(self.runtime,'status','--porcelain'),'')
    def test_existing_dirty_checkout_is_preserved(self):
        setup.prepare_runtime(self.runtime,self.lock);(self.runtime/'runtime.c').write_text('my local change\n')
        with self.assertRaises(SystemExit):setup.prepare_runtime(self.runtime,self.lock)
        self.assertEqual((self.runtime/'runtime.c').read_text(),'my local change\n')
