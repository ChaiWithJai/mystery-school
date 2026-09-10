# Mystery School

Mystery School is a desktop-first demo contract for Jai Bhagat's school on a computer: a sandbox for intuition.

The goal is to build a local app where a person can:

- Enter an atmospheric forest world.
- Explore possible futures through questions, choices, and reflections.
- Upload personal reference images.
- Run explicit, visible Astra projections.
- Review traces and annotations without pretending generated output is verified truth.

The product stance is simple: authored demo scenes and live model projections must be visibly distinct, all model work must be observable, and local state must remain local unless the user explicitly sends it somewhere.

See [CONTRACT.md](./CONTRACT.md) for the implementation contract.

## Desktop Prototype

The first implementation includes a Blender-authored forest, six explorable
worlds, image references, a persistent notebook, explicit Astra jobs, and a
trajectory review interface with anchored notes and correction links.

The browser renders the exported GLB with Three.js. Astra returns a structured
scenario and atmosphere parameters, not newly generated geometry. Authored
scenes, generated possibilities, and user observations remain distinct.

## Run

Use Python 3.11 or newer, Node.js, and a Codex CLI compatible with GPT-6 Astra.
Authentication uses your existing Codex sign-in. Model requests leave the device;
the scene, notebook, references, and trace database are stored locally.

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
ASTRAL_CODEX_BIN=/path/to/current/codex .venv/bin/python server.py --port 5188
```

Open `http://127.0.0.1:5188/` for the school and `/review.html` for trajectories.
The API records MLflow traces in `data/mlflow.db`. In a second terminal:

```sh
.venv/bin/python -m mlflow server --host 127.0.0.1 --port 5189 --workers 1 \
  --backend-store-uri "sqlite:///$PWD/data/mlflow.db" \
  --default-artifact-root "file://$PWD/data/mlartifacts"
```

The current Mac also has a compatible candidate CLI at
`/Applications/ChatGPT.app/Contents/Resources/codex`. Inspect `/api/diagnostics`
for the selected executable and build identity. Executable availability does
not prove authentication or model access.

## Checkpoint: September 10, 2026

- Browser verified: Blender asset loading, island selection, question panels,
  reference upload and preview.
- Syntax and backend integration checks cover persistence, cancellation,
  timeouts, invalid outputs, source preservation, uploads, and review APIs.
- The first real Astra attempt failed because the shell CLI was outdated.
  Its failure trace is retained locally. A successful model projection and
  end-to-end corrected child are not yet verified at this checkpoint.
- Learning outcomes and transfer are not yet evaluated with participants.
- The verified host reports Apple M5 Pro. M4 compatibility remains untested.

```sh
npm run check
.venv/bin/python -m unittest discover -s tests -v
```

Tracing covers app events, submitted model inputs, observable CLI events,
outputs, errors, reported usage, and review feedback. It does not expose hidden
reasoning or automatically capture this entire build conversation. Unknown
usage and dollar cost remain unknown, not zero. Data and runtime downloads are
excluded from Git. Keep the server on localhost; this is not a hardened shared
deployment.

See [Blender instructions](blender/README.md) for editable assets and rebuilds.
Coordinate this milestone in Buzz's `mystery-school` channel, not Slack or
Google Workspace.
