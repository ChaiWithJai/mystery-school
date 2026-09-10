"""Download checksum-pinned Bonsai 4B and build its pinned Metal/CPU runtime."""
import hashlib
import json
from pathlib import Path
import shlex
import shutil
import subprocess
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
def run(*args):subprocess.run(args,check=True)
def digest(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def prepare_runtime(runtime, lock):
    if runtime.exists():
        if subprocess.check_output(['git','-C',str(runtime),'status','--porcelain']).strip():
            raise SystemExit('Runtime checkout has local changes; refusing to overwrite')
    else:
        # --no-checkout intentionally has no worktree yet. Its deleted-file status
        # is not a user edit; initialize it before applying existing-tree checks.
        run('git','clone','--no-checkout',lock['runtime_repository'],str(runtime))
    run('git','-C',str(runtime),'checkout','--detach',lock['runtime_commit'])

def main():
    lock=json.loads((ROOT/'deployment/bonsai-model.json').read_text())
    for program in ('git','cmake'):
        if not shutil.which(program):raise SystemExit(f'Install {program} before running this setup.')
    target=ROOT/'data/bonsai-runtime';target.mkdir(parents=True,exist_ok=True)
    weights=target/lock['filename']
    if not weights.exists():
        url=f"https://huggingface.co/{lock['model_id']}/resolve/{lock['revision']}/{lock['filename']}"
        partial=weights.with_suffix('.download')
        print('Downloading pinned Bonsai 4B weights (572 MB)…',flush=True)
        with urllib.request.urlopen(url,timeout=60) as source, partial.open('wb') as out:shutil.copyfileobj(source,out)
        if partial.stat().st_size!=lock['size_bytes'] or digest(partial)!=lock['sha256']:
            partial.unlink();raise SystemExit('Weight integrity check failed')
        partial.replace(weights)
    if weights.stat().st_size!=lock['size_bytes'] or digest(weights)!=lock['sha256']:raise SystemExit('Existing weight checksum mismatch; refusing to run')
    runtime=target/'llama.cpp'
    prepare_runtime(runtime, lock)
    run('cmake','-S',str(runtime),'-B',str(runtime/'build'),'-DCMAKE_BUILD_TYPE=Release','-DLLAMA_CURL=OFF')
    run('cmake','--build',str(runtime/'build'),'--target','llama-server','-j','2')
    command=[str(runtime/'build/bin/llama-server'),'-m',str(weights),'--alias',lock['model_id'],'--host','127.0.0.1','--port','8080','-c','4096','-ngl','99']
    print('Checksummed model and pinned runtime ready. Start explicitly:\n'+shlex.join(command))
if __name__=='__main__':main()
