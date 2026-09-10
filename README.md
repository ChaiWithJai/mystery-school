# Mystery School

Mystery School is a prototype of a sandbox that teachers build for their students.
A good teacher can change the course of someone's life. A chatbot is not that
teacher. The teacher knows the student, advocates for them, and decides what
support to offer. AI helps build the experiences the teacher imagines.

A student who struggles with a physics explanation may love boxing. The teacher
can start there: try a movement, notice how distance changes over time, then
name the relationship. The sandbox gives them something to explore together.
It does not decide what a student is capable of.

Jai's school on a computer demonstrates that direction through piano, boxing,
and a writable book world. The teacher's work is to cultivate courage, passion,
and imagination, especially when a student needs more time or another approach.
Saved work and model suggestions remain separate.

## The teacher's role

The human teacher chooses the experience, listens to the student's account,
reviews their attempts with them, and changes the approach. Care means staying
with the student rather than treating a score as a verdict. The student keeps
their own voice and can disagree, pause, or try another way.

The current app is an authored local prototype. A teacher authoring workspace,
student roster, access-controlled teacher review, and classroom deployment are
not implemented. Traces are technical records, not diagnoses or automatic
judgments about students. AI does not replace the teacher's relationship,
responsibility, or judgment.

All three pathways are required by
[issue 2](https://github.com/ChaiWithJai/mystery-school/issues/2).
See [CONTRACT.md](CONTRACT.md) for the implementation contract.

## Learner journey

The root page opens Runaway. Select "Listen" to hear the first seven seconds
of a supplied local recording. Playback requires a browser gesture. "Keep
playing" lets the recording continue into boxing, while "Try keys" opens
separate piano practice. Saving from the piano continues directly into the
ring without an intervening tour.

| Pathway | What the learner can do | Direct route |
| --- | --- | --- |
| Music | Listen to a local Runaway recording, play the mapped piano keys, and keep a recorded attempt. | `/?path=music` |
| Movement | Choose a boxing body-map lesson, inspect its source, and try mirror practice. | `/?path=movement` |
| Ideas | Explore a rendered world, read a source, and keep a discovery inside the writer. | `/?path=ideas` |

The contextual world menu provides access to the other pathways. The forest
and gear diagram remain secondary views, not replacements for the pathways.
The timed presenter page at `/demo-60.html` is separate from the learner journey.

Browser drafts persist locally. Saved versions use the local API and retain
parent links and MLflow trace IDs. Reopen a version with
`/?path=PATH&artifact=ID`, or inspect it in Trajectory Studio.

## Recording and piano sound

The supplied song recording is local to the installation. The optional file
`public/audio/local/runaway.mp3` is ignored by Git and excluded from the
published build. A fresh clone does not include it. Choose audio you have
permission to use through "Music settings"; the selected file stays in the
browser and is not uploaded. The repository does not distribute the
copyrighted song recording.

Keyboard practice uses a bundled Salamander piano sample by Alexander Holm,
transposed to the opening pitches, with synthesized sound as a fallback.
The sampled instrument is separate from the song recording. Attribution and
license details are in
[the piano audio directory](public/audio/piano/SOURCE-LICENSE.txt).

The external arrangement and local practice exercises have different sources
and timing. The bounded two-strike exercise is derived from the inspected
Musicnotes MN0103069 arrangement. It is not a full-song transcription or
verified timing from the original recording. See
[the source review](docs/reviews/runaway-source-20260910.md) for evidence and
limits. Opening an external reference contacts that site.

## Astra requests and consent

Local play does not require a model request. "Ask Astra for a change" requires
explicit confirmation and saves the starting experiment. The request includes
`learning_artifact_id`, and the backend copies the saved record into
`learning_artifact_context`. The local controls remain available during the
request. Supported proposals offer preview, apply and undo, with a return
link to the saved source.

Changes to the question or source context invalidate confirmation. Changes to
the experiment prevent an older proposal from overwriting those edits.
Music practice targets preserve recorded attempts and phrase settings.
Ideas consequences are model-imagined possibilities, not correct answers or
predictions. No proposal is applied automatically.

Artifact requests exclude unrelated image uploads. General forest projections
also exclude saved images unless the learner selects "Include my saved
reference images" and confirms the request. Uploading an image alone does
not authorize sending it to a model.

## Run locally

Use Python 3.11 and Node.js. Live Astra requests additionally require a
compatible Codex CLI and model access. Model requests leave the device;
saved work, references and traces use local storage.

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

Set `ASTRAL_CODEX_BIN` to select another installed CLI. Inspect
`/api/diagnostics` for the executable and build identity. Availability does
not prove authentication or model access. Failed requests remain visible.
Keep the server on localhost; it is not a hardened shared deployment.

## Tests and recorded evidence

```sh
npm run check
npm test
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/check-clean-setup.py --port 5196 --require-clean
```

The clean-setup check starts a server with empty temporary data and disables
model executable discovery. Installation and automated checks do not prove
the quality of sound, camera tracking, or the learner experience. See
[reproducible delivery](docs/reproducible-delivery.md) for setup evidence.

The separate `/replay.html` page uses captured agent QA proposals for Piano,
Boxing and Story. The Phrase option preserves an earlier music-editor replay.
Replay makes no model request and saves no new backend records. Its local
events disappear on reload. Bundled inputs and outputs remain in
`public/fixtures/recorded-*.json`.

The scripts `verify_demo.mjs`, `verify_capture.mjs`, `verify_pathways.mjs`
and `verify_learning_projection.mjs` in `scripts/` inspect existing local
records without making model calls. They require the corresponding completed
runs and are not fresh-clone checks. The learning projection verifier takes
a job ID and uses GET requests only.

Historical results, job IDs and limitations remain in
[verification evidence](docs/verification.md),
[pathway verification](docs/pathway-verification.md), and
[live proposals](docs/live-proposals.md). The
[learner pilot](docs/learner-pilot.md) is prepared, not conducted.
Learning, transfer and camera quality have not been established by the
automated checks.

## Review and provenance

Trajectory Studio keeps source messages, anchored notes, correction links
and related records. Imported agent reviews remain distinct from live model
calls and human annotations.

`POST /api/sidecar-records` imports a declared `agent_review` envelope with
`capture_method: "imported"`. Identical retries with the same
`source_system` and `source_event_id` return the same record; changed content
returns 409. Accepting or dismissing a suggestion records a declared actor,
producer and timestamp without replacing the original author. Declared
identity is not authentication, and missing historical attribution stays unknown.

`node scripts/import_sidecar_probes.mjs` writes imported local records and
checks identical retries. It does not call a model. Imported published probes
are not raw Buzz telemetry or proof that a learner test was executed.

Tracing records observable app events, submitted inputs, CLI events, results,
errors and reported usage. It does not expose hidden reasoning. Unavailable
usage, cost and historical invocation files remain unknown or explicitly
unavailable.

The characters and staged peer responses are authored, not live conversations.
Movement diagrams and boxing game distances are not measurements of a person's
body, impact force or athletic ability. Camera practice does not establish
movement accuracy or provide injury-prevention advice.

## Other documentation

- [Blender instructions](blender/README.md) describe editable forest assets.
- [Netlify and local inference](docs/netlify-local-inference.md) describes hosted capabilities and the private local backend.
- [Boxing coach integration](docs/boxing-coach-integration.md) describes the separate coaching integration and its limits.

`npm run build:netlify` prepares the hosted assets. The build excludes local
song recordings and private runtime data; it does not provide the local
Studio or MLflow database.
