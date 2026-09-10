# Live foreground music QA

September 10, 2026. Agent-operated QA, not learner evidence. One authorized Astra request was made. No model retry, product edit, restart, or commit was performed by this reviewer.

## Result

The actual response proposed the verified opening exercise at 60 BPM. Browser preview, apply, Hear, and undo operated on the same piano instance. The target changed visibly from 80 to 60 and back to 80 BPM. Existing note events, including an agent-operated C4 press during inference, survived apply and undo.

The result is bounded by an observed E6 click obstruction and recording-duration growth when Hear finishes an open take. It is not proof of a complete song lesson, audio fidelity, or learning.

## Build and provenance

- Repository checkpoint reported by main: `2df25b4`.
- GET `/api/diagnostics` reported backend build `6485c6ccd23d33bb`, not excluded build `977a38fc144df9f1`.
- Initial synthetic artifact: `ec12ab48-93d0-4cb3-9722-096ab08e6cc4`, trace `tr-7f2e48641b999d6df65f0280821ccb48`.
- The initial artifact explicitly says synthetic authored agent-QA take, not human performance. Its two E6 strikes use on/off times 0.4/1.2 and 2.1/3.6 seconds. These authored test timings are not attributed to the recording or the arrangement.
- The browser's normal request flow saved a fresh frozen child: `01b70468-fe0b-4902-9fe2-19e199251b66`, trace `tr-694afe9e36d93c1f79e4429f7e716436`. Its parent is the initial synthetic artifact and its explanation retains the synthetic label.
- Both artifact and request declare `actor_kind: agent_review`. This declaration is not authentication.
- The frozen source reference identifies [Musicnotes MN0103069](https://www.musicnotes.com/sheetmusic/kanye-west/runaway/MN0103069), its original-key first-page locator, and `source_kind: notation_exercise`. Captured `experiment_sources[0]` binds to frozen source reference index 1 and exercise `runaway-mn0103069-opening-two-strikes`.
- No source was represented as a fetched video transcript or verified original-recording timing. See [the source review](runaway-source-20260910.md) for the arrangement and recording limits.

## Actual request and stored result

Owned Neo tab 133 opened the synthetic artifact with `actor=agent_review`. The reviewer opened Follow a question, then Explore this question with Astra, explicitly checked consent, and clicked Ask Astra for a change once.

Exact submitted question:

> Slow this opening practice to60 BPM; keep my recordedtake andvariation unchanged.

Job `cd267992-426c-4c01-8787-ecd7e2f2cbe7` ran from `2026-09-10T19:08:38.810220+00:00` and finished successfully at `2026-09-10T19:09:09.805282+00:00`. Model was `gpt-6-astra`. Job trace is `tr-494ca4fe2bb64814d960dcb82163b954`.

Stored `result.experiment.music.practice_target`:

```json
{
  "exercise_id": "runaway-mn0103069-opening-two-strikes",
  "quarter_bpm": 60
}
```

Read-only assertions passed for the exact target, strict music branch fields, frozen artifact equality with `learning_artifact_context`, matching source URL/index, and unchanged variation attack 0.35, tempo 100, and four two-beat notes at MIDI 60, 64, 67, 72. Movement and ideas branches were null. The response explicitly treated the supplied take as synthetic QA.

Reported usage was 17,016 input tokens and 832 output tokens. Job `cost_usd` was null, meaning unknown, not free. Job usage `total_tokens` was null. A direct MLflow read found TraceStatus.OK, five spans, and aggregate input/output/total of 17,016/832/17,848. That aggregate total does not establish billing.

`node scripts/verify_learning_projection.mjs cd267992-426c-4c01-8787-ecd7e2f2cbe7` passed. It checked saved artifact, job, exact prompt, result and trace linkage. It does not prove browser behavior or audible output.

## Browser observations

1. The initial piano showed 80 BPM / published notation and the synthetic take's visible note marks. The request stayed beside the instrument.
2. During inference, Neo rejected a pointer click on E6 because `section.learning-next` covered its click point. A screenshot confirmed that the right-side question panel obscured upper keyboard keys. The reviewer did not bypass that obstruction with a synthetic DOM click.
3. An accessible C4 pointer press succeeded while the job was still running. Its actual agent-operated on/off timestamps were 3.600600000023842 and 3.608700000047684 seconds within the continued take. These are browser QA actions, not human learner actions.
4. The actual returned proposal displayed a preview with an opening-exercise difference. Before apply, `practice_target` remained null. Apply preserved all six events and the current practice object, changed only the target, and showed 60 BPM / slower practice adaptation.
5. The visible Hear button emitted a separate `notation_exercise` playback with E6 on/off events at 1/3 and 3/5 seconds, duration 5 seconds. No playback error was displayed. Demonstration events did not enter the learner-event array.
6. Undo restored null/default target and the visible 80 BPM / published notation label. All six recorded events and the variation remained intact.
7. A page-local reference to the actual `.piano-practice` DOM node remained identical through apply, Hear and undo. Screenshots of the running request and applied state were visually inspected in the tool session. No image file was added to the repository.

## Observable event records

| Action | Event ID | Trace ID |
| --- | --- | --- |
| Explicit request confirmation | `f78619e7-d4ff-421a-95f2-32a711a3ccd3` | `tr-b05c2ddba46f4e142af5265ca8e20292` |
| C4 note on during inference | `76280ab4-e9d9-4bcd-85e9-f74da250cfd3` | `tr-9413b9159330a7150dacea6dd593b975` |
| C4 note off during inference | `52ecbb79-cad9-4471-ab34-e5cd9590851c` | `tr-2ee4fbdc29d516194498fc997653d50a` |
| Proposal preview | `272f29e0-cae1-4ca5-b0db-ade8c5f1f042` | `tr-43ac48364b66f6320e57826cafa83966` |
| Apply | `0a783dc9-a3af-42c7-bc1d-411eec0b34c1` | `tr-d2cdb3a3158522e80fe9da084e131c36` |
| Authored exercise demonstration | `84d0a1ca-aded-40f6-b72f-fd52e07e48b1` | `tr-55c6513b4c3b468bcbf22e0e30cbc907` |
| Separate demonstration playback | `63da6c9d-1ea3-4ddb-825d-045a242d7ee9` | `tr-9e382392959f1481384d0ab9354ce752` |
| Undo | `87216cd9-c406-4b05-8423-ee8e2d7c8d05` | `tr-7a7fcc7b8b6a6f35e2217c8514236024` |

Browser session ID `2334695f-a13b-4ffa-977f-597e9640a944` was shared with other app tabs. Session ID alone is not an isolation boundary. The event IDs above were selected by music pathway, this job, timestamps and inspected payloads; unrelated pathway events are excluded.

## Limits and handoff

- The E6 pointer obstruction is an actual UI gap. The current layout does not support unobstructed practice of the target key while the question panel is open, even though other keys remain available.
- Hear invokes stop before demonstration. Because auto-capture remained active after the C4 press, it finalized duration at 44.075900000095366 seconds rather than 3.608700000047684. The six event timestamps did not change. Undo correctly retained that later duration. Do not claim the complete practice object stayed byte-identical through Hear; only target-only apply did so in this check.
- Playback event emission and absence of a visible audio error were observed. Audio was not captured or listened to by this reviewer, so audible quality, perceived tempo, or device output are not independently verified.
- Target changes were exercised in the current draft. The frozen source artifact and stored job were read back, but an applied-target revision was not saved and reopened in this run.
- Only this one request was authorized and made. Further model calls require a new authorization. Product fixes, if desired, belong to main or an explicitly assigned owner.

Stored replay entry: `http://127.0.0.1:5188/?path=music&artifact=01b70468-fe0b-4902-9fe2-19e199251b66&experiment=cd267992-426c-4c01-8787-ecd7e2f2cbe7&actor=agent_review`.

## Main-builder retest after the report

Agent QA on the working tree over `2df25b4`, using the stored job above. No new inference.

The question panel now stays above the keyboard. DOM bounds showed its bottom at 428.59px and E6's top at 511.81px; no intersection. An actual E6 pointer click succeeded with the proposal open. Apply showed 60 BPM, and undo restored 80 BPM without a visible error.

Automatic capture now ends at the last recorded event rather than including idle time before Hear. After Hear and undo, the take contained six events; duration and last event time both equaled 3.619600000023842 seconds. Explicit manual recording retains its existing timing behavior. The targeted piano tests pass. Audible quality remains unverified.
