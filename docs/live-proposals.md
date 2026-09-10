# Live experiment proposals

These are agent QA runs, not participant results. Stored outputs must be checked
separately from browser interaction, listening outcomes, and learning claims.

## Music, September 10, 2026

- Backend build: `54c4a455dad00547`.
- Starting artifact: `cbf24a46-393f-4d36-b55f-41e48c855a7e`.
- Job: `06864f01-6af0-4db6-bda2-242f3a305d44`.
- Trace: `tr-2755a5ea4a711c1b2a0cbbdb7e0beaa8`.
- Status: succeeded.
- Reported input tokens: 16,205. Reported output tokens: 814.
- Reported cost: unknown. No price or total build cost is inferred.

The request kept the first three notes, replaced the last high C with a
descending two-note ending, and lengthened the last note. Tempo and attack
were to remain unchanged.

Astra returned MIDI pitches 60, 64, 67, 64, 60 with beat lengths 2, 2, 2, 2, 4.
Tempo remained 100 BPM and attack remained 0.4 seconds. Main passed this actual
output through the client proposal validator and playback scheduler. Assertions
confirmed the unchanged opening, descending ending, longer final note, retained
tempo/attack, and unmodified starting artifact. The resulting schedule lasts
seven seconds.

This proves a supported request produced an executable musical proposal. It does
not yet prove browser preview, audio output, apply/undo, or saved-result reopening.
The run was submitted through the app API, not through the browser consent flow.
Movement, ideas, source breadth, public replay, and desktop acceptance remain open.

## Recorded music proposal in the desktop UI

Main inspected BrowserOS Neo page 96. This was agent QA using the stored output,
with no additional inference. The route uses `path=music`, the starting artifact
ID above, and `experiment=06864f01-6af0-4db6-bda2-242f3a305d44`.

The page initially retained four notes and showed an unapplied proposal. Selecting
Try this change produced five playable keys. Hear my version reported five notes
at 100 BPM and 0.4-second attack. The recorded playback schedule lasted seven
seconds. Undo restored the original four-note state.

- Apply event: `7c0c6a84-6fa1-49bf-9d42-b4a3b6f63aa0`.
- Playback event: `e6377a09-a2da-42c0-814d-e5d821cc4709`.
- Undo event: `1548e0fe-1eae-43cf-a1a9-4c62f738b886`.

Apply and undo identify the original model job. Playback contains the scheduled
notes and their durations. Browser status and scheduling do not prove speaker
output quality, perceived latency, or learning. Saving and reopening the applied
artifact still needs verification. The numeric proposal preview also needs visual
improvement at that checkpoint. Commit `18992c1` replaced the numeric preview
with note and rhythm wording. None of this establishes the newer goal of teaching Runaway.

## Recorded performance

Commit `05f50bc` integrates a chromatic piano with held keys, recording and replay.
Main recorded two pointer-played notes in Neo and invoked replay. The saved
artifact `389cecd4-6648-4653-86a0-daf87a59f6fd` contains four note events and a
16.633-second take. API readback confirmed pitches 64 and 67 and retained release
times. Its trace is `tr-2b4e352902d62e589e38ca9132fa27f3`.

The artifact declares agent QA and incomplete earlier draft history. No speaker
capture, song comparison, timing accuracy or learner result is claimed.

## Public replay check

`public/fixtures/recorded-music-proposal.json` contains the exact experiment field
from the completed music job, its starting phrase and provenance. It omits the
rest of the job and private runtime paths. `npm test` validates the recorded
proposal and retained performance state without network access or inference.
The preservation test uses a labeled synthetic take. `/replay.html` loads the
bundled output through the real lab and proposal controller with a read-only
local adapter. It cannot submit inference or save a backend artifact. Its event
log stays on the page and is explicitly separate from MLflow model traces.
Main Neo page 103 applied the bundled proposal, invoked playback, and undid it.
The page event log recorded the five-note candidate and four-note restoration
without a model call or displayed error. Speaker output was not captured.
Fresh-checkout replay passed on detached commit `a58485e`, served with
`python3 -m http.server 5194 --bind 127.0.0.1 --directory public`.
Neo page 104 loaded `/replay.html`, applied the proposal, invoked playback and
undid it. The local event log recorded preview, resume, apply, play, stop and
undo, each with `model_called: false`. Four keys were restored and no error
was displayed. The isolated checkout remained clean. No app backend, saved
database, credentials or model process was used by the replay page.

## Ideas, September 10, 2026

- Starting artifact: `c93965f0-1f46-4fd7-8d6f-3e33f77e403c`.
- Job: `370e6041-30ef-4946-8e87-17ae65bffa9d`.
- Trace: `tr-f3c49523ae4c69c5d2be23d7327a4053`.
- Reported input tokens: 16,428. Reported output tokens: 918. Cost unknown.

The agent-QA request asked for a story about a friend excluded by a club rule.
Astra returned a comparison between accepting the outcome and challenging the
rule together. It quoted only the captured Epictetus sentence and did not claim
video understanding. The artifact, invocation, output and review record passed
the GET-only integrity verifier.

Neo page 102 exposed a replay defect: a legacy artifact without `modelComparison`
was rejected because mounting adds a null default. The controller now normalizes
ideas state before comparing it. A regression retains checks for changed words
and changed comparisons. After the fix, the same recorded output previewed and
applied in the browser. The scenario appeared in the existing lab. Undo removed
the model comparison. No additional model call was made for replay.

The current comparison is still text. It does not establish the requested
playable story, a completed classics curriculum, or a learning result. The visual
renderer must make the choice actionable rather than merely restyle the prose.

### Applied version and MLflow readback

Main reapplied the recorded ideas proposal, saved it through the Keep panel,
then reloaded its exact URL in Neo page 102. Artifact
`d4c7d7c5-6e51-4308-b97e-3cf8e1f95c5f` restored the proposed comparison.
API assertions confirmed the comparison exactly matches the model result,
both earlier learner interpretations remain unchanged, source links survive,
and the original artifact is the parent. Eleven event links were retained;
the record reports no failed, omitted or unrecoverable event links for this save.

Apply event `77451ab3-a4a1-4888-8a49-605edb74bb2a` identifies the original
model job. Direct MLflow client reads confirmed the saved-artifact trace
`tr-73e1e4a691fee6f245642871328cc04a`, apply trace
`tr-cd652f2e725c97770f87359cd215cbd3`, and model trace
`tr-f3c49523ae4c69c5d2be23d7327a4053` exist with one, one and five spans
respectively. The check establishes retrievable trace records, not continuous
screen recording or hidden model reasoning.
