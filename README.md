# Mystery School

**A good teacher can change the course of someone’s life.**

Mystery School is a prototype sandbox for teachers to reach students through things they care about. A teacher might use boxing to open a question about physics, piano to explore patterns and change, or a book to help a student articulate an idea of their own.

The teacher is the human in the loop: they know the student, advocate for them, choose an experience, and interpret what happens. AI helps propose bounded changes; it does not replace that relationship. The goal is to help students who need another way in, more challenge, or more individual attention.

The current demo connects playable piano, movement, and a visual world. A complete teacher-facing lesson authoring workflow and student management system are not established by this prototype. The teaching premise: to develop taste, you need experiences to compare and things of your own to make.

Built for the Cerebral Valley GPT-6 Astra hackathon in New York on September 10, 2026. Earlier code and documents use the name **Astral School**.

[Hosted preview](https://mystery-school-demo-jai.netlify.app) · [Judge guide](docs/judge-guide.md) · [Documentation](docs/README.md)

> The hosted preview needs a presenter-operated companion for saves and inference. At the September 10 documentation check, production served `1da7bacc` and its API returned HTTP 503. Use the local setup for the complete demo. A deployed page does not establish live model readiness.

## Experience the school

Begin at the playable piano. Keep a take, enter movement, save what you noticed, and find that observation in the school world.

| Experience | What you do | Instructional direction |
| --- | --- | --- |
| Piano | Play, retain a take, and compare timing in a notation exercise. | Use rhythm and change to enter mathematical thinking. |
| Movement | Explore a simulation, select a foundation, and try a camera-mirror round. | Use embodied experience to motivate questions about motion and physics. |
| Ideas | Explore a world, examine a source, and revise an interpretation. | Turn reading and experience into understanding you can explain. |

These prototype activities are not a complete calculus curriculum or measured evidence of learning. Camera estimates do not measure force, depth, or technique mastery.

## Run locally

Use Git, Node.js with npm, and Python 3.11. Local play requires no model credentials. Earlier clean-install evidence used macOS arm64; other platforms were not established by that check.

Clone the repository and enter its directory.

```sh
git clone https://github.com/ChaiWithJai/mystery-school.git
cd mystery-school
```

Create a Python environment.

```sh
python3.11 -m venv .venv
```

Install backend dependencies.

```sh
.venv/bin/pip install -r requirements.txt
```

Install locked JavaScript dependencies.

```sh
npm ci
```

Start the school with separate demo data.

```sh
.venv/bin/python server.py --port 5188 --data-dir data/demo
```

Open [the school](http://127.0.0.1:5188/) and play a piano key. Permit camera access when you enter the mirror. Choose another `--port` if 5188 is occupied.

Open [the presenter cut](http://127.0.0.1:5188/demo-60.html) for a timed presentation, or [recorded replay](http://127.0.0.1:5188/replay.html) for labeled model examples without inference or new backend saves.

The commercial Runaway recording is not distributed. The bundled piano sample has separate attribution. See [sources and reuse](docs/sources-and-reuse.md) before preparing media.

## Understand the AI

**Astra proposes changes to saved learning artifacts.** Explicit requests freeze artifact context, run the existing local Codex flow, validate structured output, and offer preview, apply, and undo. Play remains available during inference. Live use requires a compatible Codex executable, authentication, model access, network access, and available usage. Diagnostics check executable discovery, not authenticated readiness.

**Bonsai 4B supplies bounded local cues when configured.** The companion selects approved instructional cues from submitted observations between attempts. The foundation action submits a declared learner report; this does not establish autonomous video analysis.

**MLflow and local records preserve trajectories.** Artifact versions, source context, actor labels, request outcomes, and traces make proposals reviewable. Traces establish what software recorded, not whether a learner improved.

Read the [architecture](docs/architecture.md), [Astra workflow](docs/live-proposals.md), and [inference and hosting guide](docs/netlify-local-inference.md).

## Verify the implementation

Check JavaScript syntax.

```sh
npm run check
```

Run JavaScript tests.

```sh
npm test
```

Run Python tests in the installed environment.

```sh
.venv/bin/python -m unittest discover -s tests -v
```

Use the [verification guide](docs/verification-guide.md) for clean startup and browser acceptance. Historical test counts apply only to their recorded revisions.

## Review and contribute

The [judge guide](docs/judge-guide.md) maps the demo to judging criteria and identifies submission gaps. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for changes.

This public repository has no repository-wide license grant. Third-party materials retain their terms. Organizer clearance for the movement/coaching overlap is unconfirmed; instructional intent alone does not establish eligibility.
