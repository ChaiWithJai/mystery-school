# Live boxing proposal verification

## Initial call outcome

The single authorized call was accepted by the local API, then failed at the provider with HTTP 400 `invalid_json_schema`. No proposal was returned. Applying a typed result to the boxing game could not be verified. No retry was dispatched.

This was declared `agent_review` QA, not learner evidence. It does not measure boxing ability or physical movement.

## Recorded identifiers

| Record | Value |
| --- | --- |
| Date | 2026-09-10 |
| Checked checkout | `b3f4c6f` |
| Runtime build reported by job | `c2c66c2bdb503d9c` |
| Artifact | `32147560-0250-4cc6-bd84-94648dd8904d` |
| Artifact trace | `tr-4ade11f7f929ef4003f8efbda31f7f26` |
| Session | `agent-live-boxing-20260910-f3cc96f8-4f1d-4e6f-8d03-e7870c942bb9` |
| Job | `cc182973-76e2-4b41-90ac-315ec8e8b5c6` |
| Model trace | `tr-22e839e39e554a1b24eaa6e8f3364c91` |
| Execution thread | `01a08c9f-828e-7993-a716-1dc9899c7b50` |
| Started UTC | `2026-09-10T18:40:58.915295+00:00` |
| Finished UTC | `2026-09-10T18:41:03.011546+00:00` |
| Elapsed | 4.096251 seconds |
| Status | `failed` |
| Result | `null` |
| Usage | `null`, unknown |
| Cost USD | `null`, unknown, not zero |

The execution used `/Applications/ChatGPT.app/Contents/Resources/codex`, version `codex-cli 0.153.4`. Studio displayed model `gpt-6-astra`.

## Source and request

A new attempt artifact was created through `/api/artifacts`. Its actor was `agent_review`, character was Andre, and scenario kind was `fictional_composite`. Its goal began `[AGENT QA; not learner evidence]`.

The saved `state.lab` was:

```json
{
  "duration": 2,
  "distance": 0.4,
  "shape": "cubic",
  "compare_shape": "quintic",
  "view": "velocity",
  "time": 0,
  "playing": false,
  "assistanceOpen": false,
  "position": 0,
  "velocity": 0,
  "acceleration": 0.6000000000000001,
  "boxing_round": {
    "prediction": 39,
    "attempts": [],
    "question": "Can I get more time to step back?",
    "params": { "cue": 1.15, "gap": 14 }
  }
}
```

The one accepted `/api/project` request referenced that artifact and session. It used `actor_kind: agent_review`, `world: questions`, and empty `reference_ids` and `reflection_ids`.

The question was:

> Can I get more time to step back? Set movement.boxing_params to cue 1.5 seconds and gap 18 simulation units. Preserve all existing physics: duration 2, distance 0.4, shape cubic, compare_shape quintic, view velocity. Do not change my prediction, attempts, or question.

The premise limited the change to the virtual jab cue and starting gap. It explicitly excluded physical exercise instruction, boxing ability claims, and physical measurement.

The artifact retained source references to the [authored game implementation](http://127.0.0.1:5188/boxing-game.js) and the [England Boxing coaching handbook](https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf), with printed pages 66 to 68 and 94 to 95 identified in the saved locator. The handbook was not newly inspected in this check. Studio showed no attached reference files. Saved source references are not evidence of downloaded or inspected model reference files.

## Provider failure

The decisive error in saved stdout and execution events was:

```text
Invalid schema for response_format 'codex_output_schema': In context=('properties', 'experiment', 'anyOf', '1', 'properties', 'movement', 'anyOf', '1'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'boxing_params'.
```

The provider reported `invalid_request_error`, code `invalid_json_schema`, HTTP 400. The failure occurred before a proposal existed. It is evidence of an invalid output schema, not evidence about model reasoning. Unrelated state database and plugin warnings in stderr were not the decisive error.

The error event was recorded at `18:41:02.682743+00:00`; `turn.failed` followed at `18:41:02.695144+00:00`.

## Actual browser checks

The main UI was opened in an owned Neo tab through the [exact artifact and recorded job route](http://127.0.0.1:5188/?actor=agent_review&path=movement&artifact=32147560-0250-4cc6-bd84-94648dd8904d&experiment=cc182973-76e2-4b41-90ac-315ec8e8b5c6).

- The actual game cue control remained `1.15` and gap control remained `14`.
- The actual question control showed `Can I get more time to step back?`.
- The proposal status read `This recorded proposal is not complete. Inspect its trace for status.`
- The proposal preview was hidden. No apply action or fabricated result was available.
- The fetched source artifact remained JSON-identical to its original saved value. Exactly one job matched this new artifact.
- No gameplay attempt or child artifact was created. Existing learner records were not changed.

The [actual Studio job page](http://127.0.0.1:5188/review.html?sample=cc182973-76e2-4b41-90ac-315ec8e8b5c6) displayed failed status and the schema error. It exposed prompt, arguments, references, stdout, stderr, and result file links under `/api/jobs/cc182973-76e2-4b41-90ac-315ec8e8b5c6/artifacts/`.

Studio rendered an [Inspect in MLflow link for the exact model trace](http://127.0.0.1:5189/#/experiments/1/traces?selectedEvaluationId=tr-22e839e39e554a1b24eaa6e8f3364c91). The destination itself was not opened. No correction or additional model request was triggered.

## Initial call gate

Main's schema owner must correct the strict inference schema. A fresh backend ID and explicit authorization are required before another call on the same artifact. Successful typed output, preview, apply, local game behavior, and undo remain unverified by this failed call. The current one-call allowance is exhausted.

Only this review document was written. No product files were edited and no commit was made.

## Authorized corrected retry

Main explicitly authorized one corrected call on the same frozen artifact after the schema fix. Before dispatch, `/api/diagnostics` reported backend `977a38fc144df9f1`, distinct from failed build `c2c66c2bdb503d9c`. Main identified the integrated revision as `01c241e`. The diagnostics schema SHA256 was `57132d59f371b31294a8fc64664681281002fe7a3c03916eea66858a2d580cee`.

The request reused the exact artifact, session, question, premise, and actor declared above. No replacement artifact was created. The local API returned HTTP 202 for job `e11b1851-fa65-4773-87fb-a714e290b07e`.

| Corrected execution | Value |
| --- | --- |
| Job | `e11b1851-fa65-4773-87fb-a714e290b07e` |
| Prior failed job | `cc182973-76e2-4b41-90ac-315ec8e8b5c6` |
| Model trace | `tr-92d5fde6d461e880906efde3526287a6` |
| Execution thread | `01a08ca3-fe7b-78a3-af0f-6a26ccc9ce0e` |
| Backend build | `977a38fc144df9f1` |
| Model | `gpt-6-astra` |
| Started UTC | `2026-09-10T18:45:52.760597+00:00` |
| Finished UTC | `2026-09-10T18:46:16.892490+00:00` |
| Elapsed | 24.131893 seconds |
| Status | `succeeded` |
| Input tokens | 16512 |
| Output tokens | 592 |
| Cached input tokens | 0 |
| Cache write input tokens | 0 |
| Reported reasoning output tokens | 0 |
| Reported total tokens | `null` |
| Cost USD | `null`, unknown, not zero |

The result contained a supported version 1 movement proposal bound to the exact source artifact. Its other pathway branches were null. The movement branch was:

```json
{
  "duration": 2,
  "distance": 0.4,
  "shape": "cubic",
  "compare_shape": "quintic",
  "view": "velocity",
  "boxing_params": { "cue": 1.5, "gap": 18 }
}
```

The response described the change as an unapplied agent QA proposal. It did not claim observed learning or physical performance. The frozen context retained the original source references and original build provenance. Attached reference files and captured experiment source excerpts remained empty.

## Corrected result through the actual UI

The [recorded resume route](http://127.0.0.1:5188/?actor=agent_review&path=movement&artifact=32147560-0250-4cc6-bd84-94648dd8904d&experiment=e11b1851-fa65-4773-87fb-a714e290b07e) was opened in an owned Neo tab. No additional inference was requested by resume.

1. The preview showed cue `1.15` to `1.5` and gap `14` to `18`. The current game and draft remained at the original values before apply.
2. Clicking the actual `Try this change` button updated the game controls to `1.5` and `18`. The opponent SVG transform became `translate(650 348)`. The draft preserved prediction `39`, the question, empty attempts, and all old physics fields.
3. Clicking `Try the exchange` completed one local QA round without directional input. The recorded attempt used cue `1.5`, gap `18`, jab `{t:1.5,x:47}`, and end position `47`. Its provenance timestamp was `2026-09-10T18:47:17.163Z`. The replay readout showed `1.50s` and zero average displacement velocity in simulation units.
4. Clicking `Undo this change` restored cue `1.15`, gap `14`, and opponent transform `translate(610 348)`. The complete attempt array was JSON-identical before and after undo. Prediction, question, and old physics remained unchanged. The current phase reset to the prediction stage rather than erasing the completed round.
5. A fresh GET of the frozen artifact was JSON-identical to the value read before the corrected request. The local round was kept in the browser draft and event records, not saved as a new child artifact.

The round had nine recorded points with a large frame interval from `0.17` to `2.302` seconds. The check proves the requested cue and gap reached the game and its recorded attempt. It does not establish animation smoothness, responsive directional play, or continuous local play during inference. No physical movement or boxing ability was measured.

## Corrected event and trace evidence

The browser interaction session was `2334695f-a13b-4ffa-977f-597e9640a944`, distinct from the artifact and model request session. Each event below declared `actor_kind: agent_review`. The proposal events carried the corrected job ID. The round event carried its simulation provenance and parameters.

| Event | Event ID | Trace ID |
| --- | --- | --- |
| Preview | `b2f270bc-9381-437b-96f4-8cc7c9f25eca` | `tr-79ec038fe9f267302d5f8cd7d7de088c` |
| Recorded resume | `c10d5c15-2efc-49e3-84a9-94ff93a4836e` | `tr-761b5e52e9e6ca278647925bef665d72` |
| Apply | `ec4f88d0-6543-4c2f-814f-0398e0568feb` | `tr-c83caced22649bc13efee348a82e872f` |
| Boxing attempt completed | `eb70de31-c9ef-490e-a7f1-16c4099ed77c` | `tr-6c1baa47c1e538d5e5c53fce0a56aced` |
| Undo | `b7afcbc1-f0a9-4436-b958-3c991fe5e1bd` | `tr-945bbab06c7bb0151bffdfc51fbaf6a1` |

The resume event explicitly recorded `model_called: false` and `replay_kind: stored_output`. The undo event's after state contains the completed round with its candidate parameters while the current parameters are restored to the baseline.

The [corrected Studio job page](http://127.0.0.1:5188/review.html?sample=e11b1851-fa65-4773-87fb-a714e290b07e) rendered prompt, stdout, and result links for this job. Its [MLflow link](http://127.0.0.1:5189/#/experiments/1/traces?selectedEvaluationId=tr-92d5fde6d461e880906efde3526287a6) selected the corrected model trace. The MLflow destination itself was not inspected.

The corrected allowance was used exactly once. No further retries, product edits, restart, or commit were performed. Both the failed call and successful correction remain separate evidence. This bounded success is not acceptance evidence for the other pathways or the complete learner experience.
