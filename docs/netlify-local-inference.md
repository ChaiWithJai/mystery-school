# Netlify website + private Bonsai 4B / Codex companion

This PR adds deployment infrastructure and a bounded local coaching adapter. M5 owns connecting the adapter to the current webcam boxing attempt UI. It does not implement pose estimation, complete the boxing PR, or establish learner improvement.

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

The webcam/animation loop must never await coaching. `public/local-coach-client.js` is an explicit, between-attempt helper; it is not automatically attached to any scene. It returns stale when the attempt/version changes. M5 should catch unavailable/busy errors, retain the learner's creation, and offer another attempt.

For this version, Bonsai selects one of two authored cues per pathway and cites submitted observation IDs. Returned text comes from the approved cue catalog, not unconstrained generated boxing instructions. It does not decide force, stance quality or mastery. Low-confidence camera estimates get a deterministic reposition cue without inference. This threshold is an engineering default, not a validated tracking-quality threshold. Observations and confidence are declared by the caller, not independently measured by the companion.

Astra remains the existing explicit `/api/project` flow with frozen artifact context, validation, preview/apply/undo, and existing Codex sign-in. No new Codex agent, login, API key, shell endpoint or subscription proxy protocol is added. A local companion is still a server and Astra still requires network access and available usage.

## Reproduce on M5

1. Review/merge this PR into the current integrated main, preserving M5's foreground changes. Install the existing Python requirements and `npm ci --include=dev`.
2. Use the official PrismML **Bonsai-4B-gguf** language model, not the unrelated deepgrove model, Bonsai Image, Ternary 27B or an inferred 4B alias. See `deployment/bonsai-model.json` and `scripts/setup-bonsai-local.sh`. The script builds its own pinned runtime under ignored `data/bonsai-runtime`, downloads/checks pinned weights, and prints the loopback launch command. It does not alter LM Studio or Ollama installations or start a permanent service.
3. Start Bonsai with the exact model alias `prism-ml/Bonsai-4B-gguf`. The adapter rejects another reported model ID. The alias check alone cannot attest the loaded weights; retain the setup checksum and actual launch command as deployment evidence.
4. Start the existing school with an isolated demo data directory and the compatible Codex executable:

   ```sh
   ASTRAL_CODEX_BIN=/path/to/compatible/codex .venv/bin/python server.py --port 5188 --data-dir data/presenter-demo
   ```

5. Generate three distinct random values with `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`: a companion token, demo access code, and cookie-signing secret. Keep them out of Git, screenshots and client assets. Set `MYSTERY_COMPANION_TOKEN` in the local launch environment, then run `.venv/bin/python companion.py --port 5199`. Optional settings are in `deployment/companion.env.example`.
6. Point a presenter-managed HTTPS tunnel at **5199 only**. Never tunnel the unprotected school server, Codex App Server, model server or MLflow UI. Authentication is enforced on every gateway request.
7. In the linked Netlify site's Functions environment, set `MYSTERY_COMPANION_URL` to that HTTPS origin, `MYSTERY_COMPANION_TOKEN` to the matching local token, and the separate `MYSTERY_DEMO_CODE` and `MYSTERY_SESSION_SECRET`. Scope these to the intended trusted demo deploy context; do not grant unknown PR previews access to the live companion. Redeploy after configuring.
8. Open `/connect.html` on the presenter browser or approved phone and enter the generated demo code. This issues a four-hour HttpOnly/Secure/SameSite cookie. Open the school normally. The current demo shares records among connected devices; this is **not per-student authentication or multi-tenant storage**.

The hosted frontend can render without a companion, but existing server-backed saves/projections return explicit unavailable/connection errors. This PR does not add a full offline persistence/sync subsystem. Browser drafts and local interactions retain their existing behavior. References/uploads, diagnostics, review mutation, and raw job files are intentionally not exposed; use the local Trajectory Studio on M5. Remote links to those unsupported features must not be presented as working during the demo.

## GitHub → Netlify

`netlify.toml` builds with `npm run build:netlify`, publishes only `dist/`, and bundles `netlify/functions/companion.mjs`. The build copies public assets plus the pinned Three.js package; no Python environment, data directory, notebook, credentials, or model weights go into the deployment. `/deployment.json` identifies the built commit. `/api/*` goes to the authenticated relay with no caching. Missing secrets/companion yield a truthful 503 instead of simulated live coaching.

Use the existing Netlify GitHub App integration with `ChaiWithJai/mystery-school`, main as the production branch and deploy previews for PRs. Main needs this PR's build command before its first successful production build. M5 owns final merge, tunnel and live-machine activation. No secrets belong in netlify.toml. Provisioning/preview evidence is recorded in the PR rather than inferred from this configuration.

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

Commands: `npm run check`, `npm test`, `python3 -m unittest discover -s tests -p test_companion.py -v`, `npm run build:netlify`, `netlify build`.

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

Repository note: AGENTS.md mentions `npm run skills:verify`, but that script is absent at base a5632f2. The attempted check reported “Missing script”; this PR does not claim it passed or change the unrelated skill workflow.

## Recorded delivery checks (2026-09-10)

Base: `a5632f2793ad3b49b755ca14fdf14ae750e83174`; isolated `codex/netlify-local-inference` branch. The review was run with uncommitted changes in this PR; final PR SHA and deploy metadata identify the published version. Local Node suite: 182 passed; new Python gateway suite: 8 passed. Syntax and Netlify build/function bundling passed.

Chromium `151.0.7922.34`, 1080×592: the built static music route entered with no page exceptions while the API was unavailable; pressing/releasing a piano key produced one retained timeline mark. The unavailable-server notice remained honest. This checks browser interaction and packaged assets, not perceived audio quality, live camera tracking or inference latency. The separate connection form was visible and inspected. Screenshots are local ignored output under `output/deployment-review/`.

A real local MLflow store accepted and read back synthetic fixture trace `tr-12fe23006d7f101a7ce69c8e70f906e1` with span `bonsai.local_cue`, state OK. Its model response was a deterministic test fixture, **not live Bonsai inference**. The raw request/result trajectory was checked separately. No live Astra invocation was made for this PR.

Netlify site `mystery-school-demo-jai` (`fd11c3dc-11cf-45c6-ace8-c3b68342b21b`) was created and its GitHub repository/main branch association read back. No model credentials or companion secrets were added. Production activation and M5 verification remain pending.
