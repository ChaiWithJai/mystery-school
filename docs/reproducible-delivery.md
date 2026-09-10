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
source checkpoint. Later feature and tooling changes are not covered by that
fresh-clone result. No new clean installation or browser result is claimed here.

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
.venv/bin/python scripts/check-clean-setup.py --port 5196 --require-clean
```

The setup check refuses an occupied port, creates temporary empty data, selects
a nonexistent model executable and local temporary MLflow database, starts its
own server, and checks empty API collections, including saved artifacts and
imported sidecar records. It compares served tracked HTML, JavaScript, CSS,
JSON, PNG and GLB bytes with the checkout. JSON includes the bundled music
replay fixture. It requests all three pathway documents and verifies Three.js
is served. It prints the Git commit and file
hashes and Git worktree status, shuts down only its own server, and removes its temporary data. It makes
GET requests only. This is an HTTP startup check, not a browser interaction test.

`npm run check` checks the syntax of every tracked JavaScript file under
`public/`, including the opening route and piano practice helpers. It does not
execute those modules. New untracked files must be added to Git before they are
included. The HTTP check also covers the tracked `play-first.css` stylesheet.
Returning the same HTML for each pathway does not verify that its controls mount
or respond in a browser.

Use another free `--port` when needed. The normal README server retains local
data; this check intentionally does not. The historical `verify_demo.mjs`,
`verify_capture.mjs`, and linked live-projection checks require previous local
walkthroughs and must not be counted as fresh-clone passes.

`--require-clean` refuses tracked modifications and nonignored untracked files.
Without it, the report lists those changes explicitly; its commit identifies the
base revision, not the complete served worktree. Startup failures include a
bounded server-log tail before temporary files are removed.

## Recorded replay

The repository includes `public/replay.html` and
`public/fixtures/recorded-*.json`. After starting the server, open
`http://127.0.0.1:5188/replay.html`. Choose Piano, Boxing, Story, or the older
Phrase example. Apply the recorded proposal, play, and undo. The source panel shows the fixture's
provenance and local page events. No model call or new backend record is made.

Fixtures now include the piano practice target, boxing parameters, source-bound
story choices, and the older phrase variation. The startup check
verifies fixture bytes, not the replay's behavior. Record browser results and
the exact fixture revision separately before claiming reproducible interaction.
All three pathways remain required for experience acceptance.

## Experience acceptance remains open

Browser evidence must show immediate play, measured local response, a bounded
Astra change with preview/apply/undo, uninterrupted play during inference, and
unexpected learner intent changing the playable experiment across the required
music, movement and ideas pathways. Fixed widgets and narration are insufficient.
Audio responsiveness and the clarity of the visual journey require direct
observation. Synthetic checks are not participant learning results.

## Current clean-checkout startup

Main builder ran `scripts/check-clean-setup.py --require-clean --port 5203`
at `c29d5f9d0cd3894e22ef6fe292cc8431d2338e05`, using the installed Python 3.11
environment. The checkout was clean. Empty API, artifact and imported sidecar
collections passed. All tracked public assets, including the recorded JSON
fixture, matched served bytes. All three pathway documents and Three.js served.
The temporary server disabled inference and stopped after the check.

Port 5197 was occupied on the first attempt. Its process was left untouched.
The successful check used 5203. This proves empty-data startup from the current
clean checkout, not a new dependency installation or browser experience acceptance.
