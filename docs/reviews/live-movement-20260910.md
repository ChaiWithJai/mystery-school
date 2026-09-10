# Live movement proposal verification

Agent QA on September 10, 2026. One accepted live Astra request, no product edits, no learner observations. Local checkout at dispatch preparation: `4594b03`. Backend job build ID: `54c4a455dad00547`. The runtime was not restarted for this check.

## Records

- Session: `agent-live-movement-20260910-755a98a6-8cca-4b08-8529-f68d57713fd7`
- New baseline artifact: `2beebc96-a1e7-4fc0-8a9d-945c6f78fea2`
- Artifact trace: `tr-b82528e1891f18e8416b00e460eba307`
- Live job: `66288738-4eaa-4cde-820d-089a6351efef`
- Model trace: `tr-29ce00f6b0a75730c6e468987ca952b9`
- Declared actor: `agent_review`; model: `gpt-6-astra`; final status: `succeeded`; error: `null`.

The first dispatch attempt received HTTP 409 while main's ideas job was active. It created no movement job. The same new artifact was reused after the slot became free. The accepted dispatch returned HTTP 202. There was exactly one accepted movement model call. No existing artifact was edited or removed.

## Request and result

Baseline: duration 2 seconds, distance 0.4 meters, cubic candidate, cubic reference, position view, time zero. The artifact explicitly identifies an agent test of an authored non-contact simulation, not measured movement or force.

Question sent:

> Keep distance exactly 0.4 m. Double duration from 2 to 4 seconds, capped at 4. Use cubic candidate and differing quintic reference, and show velocity.

The premise requested one bounded typed movement proposal bound to that saved artifact, with the duration-scaling explanation and no impact-force inference. The POST used `/api/project`, `world: questions`, the baseline's `learning_artifact_id`, empty reference/reflection ID arrays, and the declared agent session.

Returned experiment:

```json
{
  "version": 1,
  "pathway": "movement",
  "base_artifact_id": "2beebc96-a1e7-4fc0-8a9d-945c6f78fea2",
  "status": "supported",
  "movement": {
    "duration": 4,
    "distance": 0.4,
    "shape": "cubic",
    "compare_shape": "quintic",
    "view": "velocity"
  },
  "music": null,
  "ideas": null
}
```

The returned reason correctly distinguishes halving velocity at matching normalized progress within an unchanged shape from comparing two different shapes. It makes no measured-force or learning-outcome claim. The complete response, including its reason and imagined story, remains in the job record; the block above omits the reason for brevity.

## Actual adapter check

Used an owned Neo tab with the real `mountMovementLab` and `mountLearningExperiment` modules and real DOM controls. The adapter matched main's callback arrangement: `onChange` stores a cloned `draft.lab`, `getState` reads that draft, and `setState` calls the real movement handle.

To avoid a second model call, the controller's transport adapter reused the already-created artifact and already-dispatched job. Its job-response promise received the actual completed server result without changing the proposal. Controller confirm/preview/apply/undo events were collected locally, not persisted as backend telemetry. This verifies the real controller and lab against the actual response, not a second end-to-end model request through the main drawer.

1. Local playback remained mounted while the response was pending. Observed `playing: true` at time `0.24678800000000048` seconds; the baseline replay subsequently reached 2 seconds. No frame-rate or sub-100-ms latency claim is made.
2. Preview was visible and full lab state was unchanged before apply.
3. Apply set duration 4, distance 0.4, cubic candidate, quintic reference, and velocity view. It kept time 2 seconds and paused. Derived candidate position was 0.2 m and velocity `0.15000000000000002` m/s. The displayed reference midpoint velocity rounded to 0.188 m/s (analytic value 0.1875).
4. Candidate and reference SVG path data differed. The controller's typed validator and actual mount accepted the result.
5. Play resumed. Before undo, the real callback state showed time `2.7092000000000116`, position `0.3019212184664015`, velocity `0.1311388259999994`, and `playing: true`.
6. Undo restored duration 2, distance 0.4, cubic candidate, cubic reference, and position view. It clamped time to 2 and paused. Endpoint position was 0.4 m, velocity zero, and the cubic one-sided endpoint acceleration was approximately -0.6 m/s^2, consistent with the labeled model idealization.

This is definition undo with current replay time clamped, not a promise to rewind playback to the old instant. The original baseline artifact remained unchanged; no applied or undo artifact was saved during this check.

## Timing and usage

- Created: `2026-09-10T18:20:07.805921+00:00`
- Started: `2026-09-10T18:20:07.817284+00:00`
- Finished: `2026-09-10T18:20:34.475379+00:00`
- Started-to-finished elapsed: approximately 26.658 seconds.

Exact reported usage:

```json
{
  "input_tokens": 16328,
  "output_tokens": 756,
  "cached_input_tokens": 0,
  "cache_write_input_tokens": 0,
  "reasoning_output_tokens": 0,
  "total_tokens": null
}
```

`cost_usd` is `null`: cost is unknown, not zero. No pricing estimate or inferred total replaces the reported fields.

## Scope of clearance

The actual model returned the requested bounded movement definition, and that exact response produced a playable change with explicit preview/apply/undo through the real adapter. This does not establish learner efficacy, visual polish, latency targets, unexpected-request generalization, or all-three-pathway completion. Music and ideas remain mandatory and require their separate verification. No additional model calls were made for this report.
