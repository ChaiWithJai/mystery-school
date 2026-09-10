# Reproduce the delivery checkpoint

Jai's priorities are a fluid, game-like desktop experience and clean GitHub
delivery. Passing setup checks establishes neither visual quality nor learning.
This procedure isolates setup from private walkthrough data and live inference.

Recorded on September 10, 2026 from commit
`9512b5c2427c7e024ec6fde12a9055762d6389e4` in a fresh clone on macOS arm64:
Python 3.11.14, Node.js 26.5.0, new virtual environment, successful dependency
installation and `npm ci`. Syntax checks, 112 JavaScript tests and 24 backend
tests passed. The empty-data HTTP check passed on port 5196 with no model call.
Port 5194 was occupied and was left untouched. These results apply to that
source checkpoint; the setup script and this guide were the only added tooling.

## Fresh setup

Clone the public repository and check out the exact commit under review. Use
Python 3.11 and Node.js; run the README installation commands with a new virtual
environment and `npm ci`. No copied `data/`, browser profile, private fixtures,
Codex credentials, or machine-specific executable path is required for local
play. Python dependencies currently include version ranges; installation is
verified, but a fully locked cross-platform Python environment is still open.

Run:

```sh
npm run check
npm test
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/check-clean-setup.py --port 5196
```

The setup check refuses an occupied port, creates temporary empty data, selects
a nonexistent model executable and local temporary MLflow database, starts its
own server, and checks empty API collections. It compares served tracked HTML,
JavaScript, CSS, PNG and GLB bytes with the checkout, opens all three pathway
documents, and verifies Three.js is served. It prints the Git commit and file
hashes, shuts down only its own server, and removes its temporary data. It makes
GET requests only. This is an HTTP startup check, not a browser interaction test.

Use another free `--port` when needed. The normal README server retains local
data; this check intentionally does not. The historical `verify_demo.mjs`,
`verify_capture.mjs`, and linked live-projection checks require previous local
walkthroughs and must not be counted as fresh-clone passes.

## Public replay is a separate delivery gate

**Blocked pending a published fixture and its verifier.** A missing replay is
not a pass. Maincar owns the public replay fixture. It must carry provenance,
an exact source revision, inspectable input/output and the distinction between
recorded output and a new model call. It must contain no private learner data or
credentials. This setup check neither fabricates nor substitutes that fixture.

When published, a new contributor must reproduce the intended saved scenario
from the fixture alone. Record the fixture revision, verifier command and actual
result separately from these startup checks. Until that happens, clean delivery
is partial even if installation and tests pass.

## Experience acceptance remains open

Browser evidence must show immediate play, measured local response, a bounded
Astra change with preview/apply/undo, uninterrupted play during inference, and
unexpected learner intent changing the playable experiment across the required
music, movement and ideas pathways. Fixed widgets and narration are insufficient.
Audio responsiveness and the clarity of the visual journey require direct
observation. Synthetic checks are not participant learning results.
