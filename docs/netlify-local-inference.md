# Netlify website + private Bonsai 4B / Codex companion

This guide describes deployment infrastructure and the bounded local cue adapter. The foundation UI now integrates an explicit local-AI action; see [foundation integration](boxing-coach-integration.md). Earlier delivery notes at the end remain historical and do not establish live inference or learner improvement.

## Runtime

```text
Player's browser: game, webcam perception, deterministic feedback, replay
    │ same-origin HTTPS; authenticated demo cookie
Netlify: static assets + narrow API relay
    │ HTTPS to a presenter-managed tunnel; private service token
companion.py: 127.0.0.1:5199
    ├── /api/coach → Bonsai 4B runtime at 127.0.0.1:8080
    └── existing allowed /api routes → server.py at 127.0.0.1:5188
                                      └── existing Codex/Astra jobs + MLflow
```

The webcam/animation loop must never await coaching. `public/local-coach-client.js` supports explicit, between-attempt requests. The foundation UI integrates that action. It returns stale when the attempt/version changes; callers must handle unavailable/busy errors without discarding the learner’s work.

Bonsai selects approved authored cues and cites submitted observation IDs. Foundation requests use the canonical curriculum’s approved practice/reflection cues; the original pathway fallback has two cues per pathway. Returned text comes from the approved cue catalog, not unconstrained generated boxing instructions. It does not decide force, stance quality or mastery. Low-confidence camera estimates get a deterministic reposition cue without inference. This threshold is an engineering default, not a validated tracking-quality threshold. Observations and confidence are declared by the caller, not independently measured by the companion.

Astra remains the existing explicit `/api/project` flow with frozen artifact context, validation, preview/apply/undo, and existing Codex sign-in. No new Codex agent, login, API key, shell endpoint or subscription proxy protocol is added. A local companion is still a server and Astra still requires network access and available usage.

## Local-machine demo (no Netlify or tunnel required)

Start the existing loopback school and Bonsai runtime, then the private companion.
Set the same `MYSTERY_COMPANION_TOKEN` in the **school server and companion launch environments**.
The school now implements same-origin `POST /api/coach` and forwards server-to-server
to `http://127.0.0.1:5199/api/coach`; override that loopback origin with
`MYSTERY_COMPANION_LOCAL_URL` if needed. The browser never receives the gateway token,
and the gateway still rejects direct browser Origins. The school's existing
same-origin write protection remains active. Missing setup, busy or offline responses
return explicit errors without blocking the animation loop.

Use the normal localhost school and local Trajectory Studio for this mode. Hosting,
cloud secrets and a public tunnel are optional distribution infrastructure, not local-demo
prerequisites. The foundation UI submits declared learner reports through this route. A current live request and delivered-feedback trace are still required to establish model readiness.

## Reproduce on M5

1. Check out the intended integrated revision in an isolated workspace. Install the README dependencies.
2. Use the official PrismML **Bonsai-4B-gguf** language model, not the unrelated deepgrove model, Bonsai Image, Ternary 27B or an inferred 4B alias. See `deployment/bonsai-model.json` and `scripts/setup-bonsai-local.sh`. The script builds its own pinned runtime under ignored `data/bonsai-runtime`, downloads/checks pinned weights, and prints the loopback launch command. It does not alter LM Studio or Ollama installations or start a permanent service.
3. Start Bonsai with the exact model alias `prism-ml/Bonsai-4B-gguf`. The adapter rejects another reported model ID. The alias check alone cannot attest the loaded weights; retain the setup checksum and actual launch command as deployment evidence.
4. Generate a companion token with `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'` and set `MYSTERY_COMPANION_TOKEN` privately in both launch environments. Start the existing school with an isolated demo data directory and the compatible Codex executable:

   ```sh
   ASTRAL_CODEX_BIN=/path/to/compatible/codex .venv/bin/python server.py --port 5188 --data-dir data/presenter-demo
   ```

5. Run `.venv/bin/python companion.py --port 5199` with the same companion token. For hosted access, generate two additional distinct random values for the demo access code and cookie-signing secret. Keep all secrets out of Git, screenshots and client assets. Optional settings are in `deployment/companion.env.example`.
6. Point a presenter-managed HTTPS tunnel at **5199 only**. Never tunnel the unprotected school server, Codex App Server, model server or MLflow UI. Authentication is enforced on every gateway request.
7. In the linked Netlify site's Functions environment, set `MYSTERY_COMPANION_URL` to that HTTPS origin, `MYSTERY_COMPANION_TOKEN` to the matching local token, and the separate `MYSTERY_DEMO_CODE` and `MYSTERY_SESSION_SECRET`. Scope these to the intended trusted demo deploy context; do not grant unknown PR previews access to the live companion. Redeploy after configuring.
8. Open `/connect.html` on the presenter browser or approved phone and enter the generated demo code. This issues a four-hour HttpOnly/Secure/SameSite cookie. Open the school normally. The current demo shares records among connected devices; this is **not per-student authentication or multi-tenant storage**.

The hosted frontend can render without a companion, but existing server-backed saves/projections return explicit unavailable/connection errors. This PR does not add a full offline persistence/sync subsystem. Browser drafts and local interactions retain their existing behavior. References/uploads, diagnostics, review mutation, and raw job files are intentionally not exposed; use the local Trajectory Studio on M5. The hosted build applies explicit capabilities: reference-upload and trajectory links are hidden/disabled, including dynamically created links. Direct hosted review URLs show a local-only explanation instead of starting the review client. The local school retains its complete controls.

## GitHub → Netlify

`netlify.toml` uses `deployment/` as its dependency-discovery base so Netlify does not install the local Python/MLflow requirements. It installs the locked root JavaScript dependencies explicitly, builds with `npm run build:netlify`, publishes only `dist/`, and bundles `netlify/functions/companion.mjs`. The build copies public assets plus the pinned Three.js package; no Python environment, data directory, notebook, credentials, or model weights go into the deployment. `/deployment.json` identifies the built commit. `/api/*` goes to the authenticated relay with no caching. Missing secrets/companion yield a truthful 503 instead of simulated live coaching.

Use the existing Netlify GitHub App integration with `ChaiWithJai/mystery-school`, main as the production branch and deploy previews for PRs. The build configuration is included in main. The presenter owns tunnel and live-machine activation. No secrets belong in netlify.toml. Provisioning/preview evidence is recorded in the PR rather than inferred from this configuration.

## Attempt contract

```json
{
  "session_id": "presenter-session",
  "attempt_id": "attempt-1",
  "state_version": 1,
  "pathway": "movement",
  "actor_kind": "agent_review",
  "tracking_confidence": 0.9,
  "observations": [{
    "id": "movement-1",
    "fact": "Simulated movement began 0.2 seconds after the cue.",
    "source_kind": "simulation"
  }]
}
```

POST this to `/api/coach` through the authenticated connection. `pathway` is music/movement/ideas. Actors are human/agent_review/scripted_demo; this is a declaration, not identity verification. Source kinds are camera_estimate/simulation/learner_report/piano_event/source_passage. Submit only compact relevant observations; never send camera frames in this contract. The response preserves session/attempt/version, evidence IDs, model/provider, reported usage, measured request latency, request ID and trace ID. Identical requests on the same companion source revision reuse the durable result; a revised attempt needs a new state version. The private coach handles one inference at a time; a concurrent request gets 429 rather than an unbounded queue. A local request times out after 15 seconds; Netlify has a 20-second upstream deadline.

No automatic escalation to Astra occurs. Use the existing explicit artifact projection when deeper help is requested, preserving its confirmation and source selection.

## Trajectories

`data/companion/coach-trajectory.jsonl` records request → exact model request → returned content/usage → validation → result or failure, with actor, evidence, timestamps, source hash, prompt version and a stable request ID. The request hash links retries; secrets and raw video are excluded. Results are cached beside the journal. MLflow uses a separate local experiment, **Mystery School local coaching**, at `data/companion/mlflow.db` unless `MYSTERY_COACH_TRACKING_URI` is set. Open that store locally using the existing MLflow CLI. Unreported cost remains null; local inference is not labeled zero cost. M5 must record the returned request/trace ID with feedback actually shown and the next attempt in the existing application events. Returning a trace ID does not establish that advice was delivered or learning occurred.

## Verification gates

- Unit: request/observation validation, route allowlist, session expiry, stale response identity.
- Integration: authenticated forwarding, missing/offline companion, output validation, duplicate retry, low-confidence branch, concurrency and durable trajectory.
- Acceptance: real HTTP gateway request using a labeled deterministic model fixture; hosted asset/browser entry and operator connection page.

Run `npm run check`, `npm test`, and
`.venv/bin/python -m unittest discover -s tests -p test_companion.py -v`
using the installed project environment. `npm run build:netlify` checks public
asset packaging. The optional `netlify build` also requires the Netlify CLI,
which is not installed by this repository's `npm ci`.

Before claiming live readiness, M5 must run one actual Bonsai request and inspect its local trace; one actual Codex/Astra artifact request; a complete webcam attempt with delivered cue and replay; and a disconnect test while play continues. Verify tracking/feedback latency on the actual device. Fixture tests cannot substitute for these checks.

## Subscription boundary and sources

Official Codex docs distinguish ChatGPT subscription access from API billing and support product integration through App Server. They do not establish a public multi-user inference entitlement for one personal subscription. This implementation retains the already-existing presenter-operated Codex flow; public-service inference requires separately established funding/access. Do not put ChatGPT credentials in Netlify or distribute them to visitors.

- https://learn.chatgpt.com/docs/auth
- https://learn.chatgpt.com/docs/app-server
- https://learn.chatgpt.com/docs/non-interactive-mode
- https://huggingface.co/prism-ml/Bonsai-4B-gguf
- https://github.com/PrismML-Eng/llama.cpp
- https://docs.netlify.com/build/configure-builds/file-based-configuration/
- https://docs.netlify.com/build/functions/configuration/

Historical workflow note: `skills:verify` was unavailable at the earlier reviewed base. It is not a current required command.

## Recorded delivery checks (2026-09-10)

Base: `a5632f2793ad3b49b755ca14fdf14ae750e83174`; isolated `codex/netlify-local-inference` branch. The review was run with uncommitted changes in this PR; final PR SHA and deploy metadata identify the published version. Local Node suite: 182 passed; new Python gateway suite: 8 passed. Syntax and Netlify build/function bundling passed.

Chromium `151.0.7922.34`, 1080×592: the built static music route entered with no page exceptions while the API was unavailable; pressing/releasing a piano key produced one retained timeline mark. The unavailable-server notice remained honest. This checks browser interaction and packaged assets, not perceived audio quality, live camera tracking or inference latency. The separate connection form was visible and inspected. Screenshots are local ignored output under `output/deployment-review/`.

A real local MLflow store accepted and read back synthetic fixture trace `tr-12fe23006d7f101a7ce69c8e70f906e1` with span `bonsai.local_cue`, state OK. Its model response was a deterministic test fixture, **not live Bonsai inference**. The raw request/result trajectory was checked separately. No live Astra invocation was made for this PR.

Netlify site `mystery-school-demo-jai` (`fd11c3dc-11cf-45c6-ace8-c3b68342b21b`) was created and its GitHub repository/main branch association read back. No model credentials or companion secrets were added. Production activation and M5 verification remain pending.


## PR review corrections

The first-run installer now distinguishes a fresh no-checkout clone from a dirty
existing checkout. Two actual local-Git regression tests verify initialization and
preservation of existing edits. Bonsai token counts are mapped from provider
prompt/completion fields to MLflow input/output fields; missing counts and cost stay
unknown. The raw provider usage remains in the journal. A same-origin school route
is covered by an HTTP integration test through the authenticated gateway, including
cross-origin rejection, busy and missing configuration. Hosted capabilities and the
local-only review landing page are separately checked in the built browser experience.

These corrections do not establish a successful live Bonsai/Astra call or physical
camera accuracy; those remain M5 activation gates.

Review-fix verification: 183 JS tests; 29 existing backend tests; 8 companion tests; 2 installer tests; and 2 local-route/usage tests passed. Real MLflow readback for synthetic fixture trace `tr-c8a7788cd54b3640416cafdae286ba74` reports 40 input and 12 output tokens (52 aggregate); returned unreported total and cost remain null. Run the local-route tests with the project Python environment: `.venv/bin/python -m unittest discover -s tests -p test_local_coach.py -v`. Installer tests use disposable local Git repositories and do not download weights.
