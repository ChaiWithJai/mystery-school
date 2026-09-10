#!/usr/bin/env python3
"""Check an isolated, empty-data local startup without invoking a model."""
import argparse
import hashlib
import json
import os
import socket
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5196)
    args = parser.parse_args()
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", args.port))
    report = {"scope": "empty-data startup and served-file integrity; no inference",
              "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
              "checks": [], "public_replay": "BLOCKED: published replay fixtures and verifier are not supplied by this check",
              "experience_acceptance": "NOT VERIFIED: visual quality, audio response, preview/apply/undo and learner understanding"}
    with tempfile.TemporaryDirectory(prefix="mystery-clean-") as temporary:
        scratch = Path(temporary)
        # Disable executable discovery even when the host is signed in to Codex.
        environment = dict(os.environ, ASTRAL_CODEX_BIN=str(scratch / "no-model-executable"),
                           MLFLOW_TRACKING_URI="sqlite:///" + str(scratch / "data/mlflow.db"))
        with (scratch / "server.log").open("w+") as log:
            process = subprocess.Popen([sys.executable, "server.py", "--port", str(args.port),
                                        "--data-dir", str(scratch / "data")],
                                       cwd=ROOT, env=environment, stdout=log, stderr=log)
            base = f"http://127.0.0.1:{args.port}"
            try:
                def get(path):
                    with urllib.request.urlopen(base + path, timeout=5) as response:
                        return response.read()
                for attempt in range(90):
                    if process.poll() is not None:
                        raise RuntimeError("Isolated server exited before startup; check dependencies and port availability")
                    try:
                        state = json.loads(get("/api/state"))
                        break
                    except OSError:
                        time.sleep(1)
                else:
                    raise RuntimeError("Isolated server did not become ready within 90 seconds")
                if state.get("live_available") is not False:
                    raise RuntimeError("Expected disabled model executable; another server may own the port")
                for collection in ("sessions", "events", "jobs", "reflections", "references"):
                    if state.get(collection) != []:
                        raise RuntimeError(f"Fresh state is not empty: {collection}")
                report["checks"].append("fresh API collections empty; model executable disabled")
                files = subprocess.check_output(["git", "ls-files", "public"], cwd=ROOT, text=True).splitlines()
                hashes = {}
                for relative in files:
                    local = ROOT / relative
                    if local.suffix not in (".html", ".js", ".css", ".glb", ".png"):
                        continue
                    served = get("/" + relative.removeprefix("public/"))
                    if served != local.read_bytes():
                        raise RuntimeError(f"Served bytes differ: {relative}")
                    hashes[relative] = hashlib.sha256(served).hexdigest()
                for pathway in ("music", "movement", "ideas"):
                    if get("/?path=" + pathway) != (ROOT / "public/index.html").read_bytes():
                        raise RuntimeError(f"Pathway document failed: {pathway}")
                get("/vendor/three/three.module.js")
                report["checks"].append("three pathway documents and Three.js dependency served")
                report["served_sha256"] = hashes
                report["result"] = "STARTUP_CHECKS_PASSED; replay and product acceptance remain open"
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
