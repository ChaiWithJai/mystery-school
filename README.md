# Mystery School

Mystery School is a sandbox for intuition: immersive learning experiences that teachers can shape around the students they know and care about.

> A good teacher can change the course of someone's life.

The teacher is the human in the loop: an advocate who notices what a student
cares about, chooses a worthwhile challenge, and helps them make sense of what
happened. AI helps create and adapt the experience. The teacher remains
responsible for its purpose, interpretation, and next step.

Some students need another way into a subject. Others need more depth than the
usual lesson offers. Start with something that matters to them: a piano phrase,
a boxing movement, or a question from a book. Let them try, notice, explain,
and make something of their own.

## Teacher-led learning, demonstrated through three experiences

The demo moves from a playable piano simulation, to a movement mirror, to a
shared world of ideas and reflections. The intended teacher workflow is to
choose an objective, shape an experience around a student's interests, review
their attempts and explanations, and choose the next challenge together.
The current prototype demonstrates the learner experiences and saved
trajectories; it does not yet provide a complete teacher authoring or classroom
management workflow.

For example, a teacher could use boxing to help a student investigate physics:
predict how changing a movement changes its path, compare observations, and
explain the result. The current boxing demo includes source-based movement
cues and camera-estimated punch shapes. Those features alone do not establish
that a student understands physics. A physics lesson also needs an explicit
conceptual task and evidence in the student's own explanation.

Our promise is to help a teacher find a way in, and help a student discover
what they can do. Saved activity is evidence for a conversation with the
teacher, not an automatic judgment of mastery.

## Prototype scope

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
them. The opening screen offers all three worlds. Direct pathway links skip
that screen. Use the world chooser inside a pathway to switch worlds.

| Person | Working interaction | Route |
| --- | --- | --- |
| Maya | Play and record piano notes, compare the opening two strikes of a notation exercise, and try a proposed practice tempo. Phrase variations remain separate from recorded attempts. | `/?path=music` |
| Andre | Play a boxing timing game, try proposed cue timing and gap settings, and inspect a mathematical movement comparison. | `/?path=movement` |
| Leena | Try a shared-shelter decision scene, interpret the Epictetus passage, and revise her own account. A lecture URL, timestamp and note remain unverified user references. | `/?path=ideas` |

Each pathway saves versions, presents a labeled staged response, and keeps a
next question. Saved versions reopen through `?path=PATH&artifact=ID` and link
to Trajectory Studio. Browser drafts persist locally; saved versions use the
local API and have immutable parent links and MLflow trace IDs.

The forest now has labeled pathway entrances and saved artifact markers. Select
a saved marker to reopen that version, rather than starting a model request.

"Ask Astra for a change" requires explicit consent and saves the starting
experiment. The request uses `learning_artifact_id`, and the backend copies the
saved record into `learning_artifact_context`. The proposal panel stays beside
the local controls while the request runs. A supported result offers a preview,
apply and undo. Changes to the question or source context invalidate consent.
Changes to the experiment prevent an older proposal from overwriting those edits.
Artifact requests exclude unrelated image uploads.
General projections also leave saved images out unless the person checks
"Include my saved reference images". Changing that choice requires confirmation
again. Uploading an image alone does not authorize sending it to the model.
General forest projections still use the separate confirmation form. No proposal
is applied automatically. Music practice targets preserve recorded attempts and
phrase settings. Ideas consequences are model-imagined possibilities, not
predictions or correct answers.

The characters are fictional composites. Their dialogue and peer responses are
authored, not live conversations. The experiments use deterministic code, not
an ambient AI tutor. Music is synthesized sound, not a physical piano model.
The piano exercise uses the inspected Musicnotes MN0103069 arrangement, not
verified timing from the original recording. Boxing gaps use simulation units,
not physical distance or impact force. Movement is not measured athlete data or
impact advice. Participant learning has not been evaluated.

See [pathway verification](docs/pathway-verification.md) for the recorded tests,
remaining gaps, and the contribution from the other machine.

## Desktop Prototype

The first implementation includes a Blender-authored forest, six explorable
worlds, image references, a persistent notebook, explicit Astra jobs, and a
trajectory review interface with anchored notes and correction links.

The browser renders the exported GLB with Three.js. Astra returns a structured
scenario, atmosphere parameters and bounded experiment proposals, not newly generated geometry. Authored
scenes, generated possibilities, and user observations remain distinct.

## Run

Start from a clone with Python 3.11 and Node.js installed. Python 3.11 is the
verified setup below; newer Python versions have not been checked. Local play
does not require a Codex sign-in. Live Astra requests additionally require a
compatible Codex CLI and model access. Model requests leave the device; the
scene, notebook, references, and trace database are stored locally.

```sh
git clone https://github.com/ChaiWithJai/mystery-school.git
cd mystery-school
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
.venv/bin/python server.py --port 5188
```

Open `http://127.0.0.1:5188/` for the school and `/review.html` for trajectories.
The API records MLflow traces in `data/mlflow.db`. In a second terminal:

```sh
.venv/bin/python -m mlflow server --host 127.0.0.1 --port 5189 --workers 1 \
  --backend-store-uri "sqlite:///$PWD/data/mlflow.db" \
  --default-artifact-root "file://$PWD/data/mlartifacts"
```

To select a different installed CLI, set `ASTRAL_CODEX_BIN` to its executable
when starting the server. Inspect `/api/diagnostics` for the selected executable
and build identity. Executable availability does not prove authentication or
model access. The app records failed requests visibly.

For a check that starts its own server with empty temporary data and disables
model executable discovery:

```sh
npm run check
npm test
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/check-clean-setup.py --port 5196 --require-clean
```

This verifies installation, startup and served files. It does not establish a
fluid experience or replay a live model result. See
[reproducible delivery](docs/reproducible-delivery.md) for the measured checkpoint
and the separate recorded replay.

## Recorded replay

After starting the local server, open `http://127.0.0.1:5188/replay.html`.
Choose Piano, Boxing, or Story. Play, apply the captured proposal, try again,
and undo. Phrase retains the earlier music-editor replay. Open "Source and
replay events" for the original job/trace IDs and local page events.
Bundled inputs and outputs are in `public/fixtures/recorded-*.json`.

The page reuses recorded agent QA output without making a model request or
saving new backend records. Piano changes the opening practice tempo; Boxing
changes the simulated jab timing and distance; Story offers source-bound,
model-imagined choices. These are captured examples, not fresh inference or
proof of learning. Events disappear on reload. Opening external references is
optional and contacts those sites.

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
- An earlier verified suite checkpoint recorded 82 JavaScript tests and 22 backend
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

Accepting or dismissing a suggestion records a separately declared decision
actor, producer and timestamp. The original author stays unchanged. The UI
labels declarations as unauthenticated. Historical decisions without attribution
remain unknown. General model requests also retain declared actor provenance;
missing historical fields are not backfilled as human actions.

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

## Netlify and local inference

The [private demo deployment guide](docs/netlify-local-inference.md) packages the website for Netlify, keeps the existing Codex/Astra backend on the presenter machine, and adds an authenticated Bonsai 4B cue adapter. M5 owns live scene integration and activation. The guide distinguishes tested infrastructure from pending live inference and webcam verification.
