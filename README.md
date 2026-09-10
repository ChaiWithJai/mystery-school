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

## Three learning pathways

[Issue 2](https://github.com/ChaiWithJai/mystery-school/issues/2) defines delivery.
All three pathways are required. The forest and gear experiment do not replace
them. Open "Meet the learners" from the header to move between pathways.

| Person | Working interaction | Route |
| --- | --- | --- |
| Maya | Change a synthesized phrase's attack, compare its envelope, and revise the sound for her grandmother. | `/?path=music` |
| Andre | Compare a non-contact movement at different durations and inspect position, velocity and acceleration. | `/?path=movement` |
| Leena | Interpret an inspected Epictetus passage, attach a lecture timestamp, compare an authored alternative, and revise a sourced account. | `/?path=ideas` |

Each pathway saves versions, presents a labeled staged response, and keeps a
next question. Saved versions reopen through `?path=PATH&artifact=ID` and link
to Trajectory Studio. Browser drafts persist locally; saved versions use the
local API and have immutable parent links and MLflow trace IDs.

The forest now has labeled pathway entrances and saved artifact markers. Select
a saved marker to reopen that version, rather than starting a model request.

"Explore this question with Astra" first saves the experiment and opens a
confirmation form. The request uses `learning_artifact_id`, and the backend
copies the saved record into `learning_artifact_context`. Changes to the question,
prediction, premise, correction, or notebook selection require confirmation again.
Artifact requests exclude unrelated image uploads; notebook notes are optional.
The returned projection offers a return to the same saved experiment. Generated
scenarios do not overwrite its settings, words, or sources.

The characters are fictional composites. Their dialogue and peer responses are
authored, not live conversations. The experiments use deterministic code, not
an ambient AI tutor. Music is synthesized sound, not a physical piano model.
Movement is a mathematical comparison, not measured athlete data or impact
advice. Participant learning has not been evaluated.

See [pathway verification](docs/pathway-verification.md) for the recorded tests,
remaining gaps, and the contribution from the other machine.

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
  Its failure trace is retained locally. The app-bundled CLI then completed
  a reference-based projection and a corrected child with the original preserved.
- A third successful projection starts with a synthetic learner's bike question.
  Its exact prompt, command arguments, reference bytes, and explicitly selected
  notebook note are captured. Historical jobs do not have exact invocation files.
- The opening preserves a learner's short request. Suggested questions require
  explicit confirmation before a model request. Prediction is optional.
- Browser checks verified that question, prediction, and premise drafts survive
  closing Imagine, visiting References, and reopening. Drafts are separate for
  each world and last only until the page reloads.
- Learning outcomes and transfer are not yet evaluated with participants.
- The verified host reports Apple M5 Pro. M4 compatibility remains untested.
- The latest verified suite checkpoint is 43 JavaScript tests and 14 backend
  tests passing. Separate saved artifact-to-Astra checks pass for all three paths.
  Their jobs, traces, sources, and reported usage are listed in the verification doc.
- The [learner pilot](docs/learner-pilot.md) is prepared, not conducted.

```sh
npm run check
npm test
.venv/bin/python -m unittest discover -s tests -v
node scripts/verify_demo.mjs
node scripts/verify_capture.mjs
node scripts/verify_pathways.mjs
node scripts/verify_learning_projection.mjs 14e0de07-b8ea-4083-a395-e89dd2741841
```

The Node verification scripts inspect existing local jobs; they do not call a
model. They require the corresponding completed walkthroughs in the local data
directory and intentionally fail on a fresh clone. See
[verification evidence](docs/verification.md) for their scope and remaining checks.
The learning projection verifier uses GET requests only and exits with code 2
when no linked live result exists. A passing integrity check is not evidence of
learner understanding or model accuracy.

## Imported review records

`POST /api/sidecar-records` imports a declared `agent_review` envelope with
`capture_method: "imported"`. Matching `source_system` and `source_event_id`
return the same record for an identical envelope; changed content returns 409.
`GET /api/sidecar-records` and `GET /api/sidecar-records/ID` expose the records.
They also appear in Trajectory Studio with imported provenance.

`node scripts/import_sidecar_probes.mjs` imports the pinned, published Git probe
documents and checks identical retries. Unlike the verification scripts above,
it writes local records, but does not call a model. The imported documents are
proposed agent checks, not executed learner tests or raw Buzz telemetry. Source
publication times are distinct from import times; unavailable model, usage,
cost, and original invocation data remain null or explicitly unavailable.

Tracing covers app events, submitted model inputs, observable CLI events,
outputs, errors, reported usage, and review feedback. It does not expose hidden
reasoning or automatically capture this entire build conversation. Unknown
usage and dollar cost remain unknown, not zero. Data and runtime downloads are
excluded from Git. Keep the server on localhost; this is not a hardened shared
deployment.

See [Blender instructions](blender/README.md) for editable assets and rebuilds.
Coordinate this milestone in Buzz's `mystery-school` channel, not Slack or
Google Workspace.
