# Verification checkpoint

September 10, 2026. Tests ran on Apple M5 Pro. M4 remains untested.

## Completed checks

| Check | Evidence | Limit |
| --- | --- | --- |
| Draft preservation | Neo: edit all three Imagine fields, close, visit References, reopen; compare another world | Memory lasts until reload. |
| Explicit selection | Neo: projection disabled before confirmation and enabled after it | Selection is not evidence of understanding. |
| Learner request | Neo: the opening request appears unchanged in Imagine | Speech and sketch interpretation require a facilitator. |
| Backend | Latest reported checkpoint: 14 unittest tests pass, superseding the earlier eight-test checkpoint | Mock subprocesses test failure and persistence paths, not live model quality. |
| JavaScript | Final integration checkpoint: 43 tests pass | Deterministic tests are not participant learning evidence. |
| Actual model correction | `verify_demo.mjs` passes for the saved parent and child | QA annotation, not participant feedback. |
| Exact request capture | `verify_capture.mjs` passes for the bike walkthrough | Capture begins with new jobs; older prompts cannot be reconstructed as fact. |
| Saved music to Astra | `verify_learning_projection.mjs 14e0de07-b8ea-4083-a395-e89dd2741841` independently passed using GET requests | Checks record integrity, not model understanding or learner outcomes. |

The main builder reran the suites, all three projection integrity checks, and
imported record readbacks during integration. The final JavaScript suite includes
regressions for background polling misattributing feedback to another projection.

## Local trajectories

| Job | Purpose | Result |
| --- | --- | --- |
| `5beb35ac-6f59-4a00-b237-6c230251076d` | First actual model attempt | Failed because the shell CLI was outdated. |
| `d4820fbb-7157-4bbe-b112-a50b1a3587b2` | Reference image to school scenario | Succeeded; 190-word story. |
| `bb121eb3-adea-4b3d-94d4-809879af9814` | Apply an anchored QA correction | Succeeded; 79-word story, original preserved, distinct trace. |
| `bcd3fadb-47cd-4226-8afd-6ec6e2789a5d` | Synthetic bike learner with explicit notebook context | Succeeded; exact prompt, arguments and reference hash verified. |
| `14e0de07-b8ea-4083-a395-e89dd2741841` | Saved music experiment and its next question sent to Astra | Succeeded; exact source, input, prompt, result, and review trace integrity verified. |

The earlier three successful calls report 54,521 input tokens and 2,440 output tokens.
Those sums exclude failed-call usage, build-agent usage, and any separately
reported reasoning counts. They are not an all-in build cost. Dollar cost is
unknown until a price basis is established. A missing number is never zero.

The additional music job reports 15,763 input tokens and 792 output tokens, with
`cost_usd: null`. Its trace is `tr-a20173c8d7e849d4ea86b87bfa9ecf7e`.
Its saved source is `24866615-9838-4fc7-a59e-a5bb37105db1`, with source trace
`tr-2fc621663cd7a43d205e89f88f4713a0`. Reopen the source at
`/?path=music&artifact=24866615-9838-4fc7-a59e-a5bb37105db1`.
The music check records agent QA, not a learner's demonstrated understanding.

Movement and ideas each passed a separate, explicitly confirmed browser request.
Both returned to the saved version with settings, words and `actor=agent_review`
preserved. Neither request included image uploads or notebook notes. The
GET-only projection verifier passed for each job.

| Path | Job | Saved source | Trace | Input tokens | Output tokens |
| --- | --- | --- | --- | --- | --- |
| Movement | `b1f2fbfe-7471-4fc5-ad9a-bab65af9e032` | `e0e80c21-5f83-489d-8a47-08d5f2164c0b` | `tr-5881cbb87c3b8aa3408fde5449fbcc82` | 15,910 | 916 |
| Ideas | `13915927-d0f1-4213-9c34-559e6ee3546a` | `1363792d-502f-4081-b7e1-a3f17c36dbb5` | `tr-25aca99e9d57a7f90f146d4fc92dce3e` | 15,906 | 778 |

The three artifact-linked calls total 47,579 reported input tokens and 2,486
output tokens. Dollar costs remain null. The calls are agent QA, not participant
results, and their token totals exclude the agents that built and reviewed the app.
Direct MLflow readback returned five spans and `TraceStatus.OK` for each call.

## Saved artifacts and confirmation

The forest presents pathway entrances and saved artifact markers. Markers reopen
the selected version without inference. Each pathway can save a next question
before opening the Astra confirmation form.

The backend resolves `learning_artifact_id` to the immutable saved record and
retains it as `job.input.learning_artifact_context`. The GET-only verifier compares
that context with the source record, execution input, and exact prompt. It also
compares the captured result with the job and review messages.

Code inspection confirmed that the form captures the whole request before
awaiting confirmation logging. Editing a submitted field or notebook selection
invalidates confirmation. Artifact requests omit unrelated image uploads, and
the returned projection derives its return target from the saved job context.
A missing source displays an unavailable state instead of another draft. These
are code checks, not a claim that every browser race has been exercised.

Browser QA also verified that editing the question or changing notebook inclusion
clears confirmation, and missing saved versions never open a different draft.
The displayed projection now has a separate identity from the background job.
Regression tests reproduce reopening A while B runs and confirm that choices,
reflections and evidence still refer to A. These use mocked reads, not model calls.

## Imported sidecar evidence

`scripts/import_sidecar_probes.mjs` imported the published Git documents below
through `POST /api/sidecar-records`. Both records were independently read back
through the local API during this update.

| Imported record | Published source commit | Import trace |
| --- | --- | --- |
| `89277f2d-9fe8-4b1c-baed-7f3a0c928537` | `77c59d0783da83b94e449d3b5499c9d3ee715368` | `tr-5599926ce8764f579010f973aa3a4ab1` |
| `6c3d7717-f392-4f6a-a4fd-5eec46154ac1` | `01201a49c79c46689ca83b7af321a04540badce7` | `tr-30fe4209b4d3405eb6f2ded6b445bb22` |

The source path is `docs/sidecar-three-path-probes.json`. The second record names
the first in `parent_finding_ids`. The API keys retries by `source_system` and
`source_event_id`; identical envelopes return the existing record with status
200, new records return 201, and conflicting envelopes return 409. The import
script checks identical retries and readback without creating a model job.

Both records declare `actor_kind: "agent_review"` and `capture_method: "imported"`.
They preserve published review documents and proposed probes, not raw Buzz
telemetry, hidden reasoning, or executed learner tests. `observed_at` records Git
publication time, not the original agent's activity time. The MLflow trace covers
the import; it does not reconstruct the original invocation. Model, usage, and
dollar cost are null. Imported JSON is collapsed in Trajectory Studio, with its
original text offsets retained for annotations.

## Remaining evidence

- Deterministic music, movement, and interpretation interactions now support
  manipulation and saved revisions. Whether they help learners remains untested.
- Run the kite and basketball probes from Buzz as synthetic cases and record failures.
- Test a fresh problem without model guidance. Do not count clicks as learning.
- Verify the full experience on the user's M4.
- Verify another person's ability to inspect and continue a saved version.
  The current localhost app is not an authenticated multi-user deployment.
- Evaluate with actual learners. No participant outcome has been established.
- The [learner pilot](learner-pilot.md) is prepared, not conducted. Its protocol
  and proposed probes are not study results.

The demo preserves a person's explicitly supplied questions and notes. It does
not reconstruct their identity, claim consciousness, or speak with spiritual
authority. The forest is an authored 3D scene. Model output changes its existing
atmosphere and creates saved scenario branches, not arbitrary new geometry.
