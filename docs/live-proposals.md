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
