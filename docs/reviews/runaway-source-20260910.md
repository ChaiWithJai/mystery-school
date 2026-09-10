# Runaway source review

Reviewed on September 10, 2026 using owned BrowserOS Neo tabs. Only this document was changed. No model calls, purchases, audio downloads, lyrics, or full score copies were made.

## Finding

We can teach a short opening exercise from an inspectable, publisher-credited arrangement of Runaway. We cannot yet describe that exercise as an independently verified transcription of the recording. The written opening pitch is outside the current piano's range.

## Sources and limits

| Source | Observed evidence | Limit |
| --- | --- | --- |
| [Apple Music official video](https://music.apple.com/us/music-video/runaway-feat-pusha-t/1445837852) | The catalog identifies Runaway featuring Pusha T, Kanye West and Pusha T, and 2010. | Clicking Play produced a blank player frame in this session. No opening audio, absolute timecode, tuning, or performed timing was verified. Keep the link, but do not promise accessible playback for every visitor. |
| [Musicnotes MN0103069](https://www.musicnotes.com/sheetmusic/kanye-west/runaway/MN0103069) | The commercial piano/vocal/chords product identifies E major and publishing administered by Sony/ATV. Its first-page preview credits songwriters and publishers, including Alfred, Universal, Sony/ATV and EMI. The preview visibly gives 4/4 and quarter note = 80. | This is evidence for this published arrangement, not a recording measurement or a license for Astral School to redistribute the arrangement. No purchase was made. |
| [BU-hosted PDF](https://blogs.bu.edu/rpt/files/2016/07/Kanye-West-Runaway.pdf) | The visible opening has repeated high notes separated by rests. | The viewed opening did not establish an arranger, authorization, or publisher provenance. University hosting does not establish authorization. Do not use it as the lesson's authority. Its articulation differs from the Musicnotes ties. |

Musicnotes' footer [Official Licensing link](https://www.musicnotes.com/content/) led to a historical letter about its role as a reseller and licensing restrictions. That general letter is not evidence of a current project-specific reuse grant. The product's own credits are the relevant provenance evidence here. No underlying license agreement was inspected.

## Exact short-excerpt reading

I visually inspected the original-key first-page preview at enlarged zoom, rather than using the garbled text extraction of its notation. The right-hand staff starts with a quarter rest, then an E6 half note, then another E6 quarter note tied into the next bar's first quarter. E6 is the third ledger line above the treble staff, with no octave-shift marking visible. The key signature does not alter E.

This establishes a two-strike opening exercise from the arrangement. It does not establish physical key-release times, pedal use, timbre, or timing in the official video. Ties continue a note; the barline is not another strike.

Derived implementation values use scientific pitch naming with C4 = MIDI 60:

| Value | Arrangement exercise |
| --- | --- |
| Written pitch | E6, MIDI 88 |
| Quarter-note duration | 60 / 80 = 0.75 seconds |
| First onset relative to the start of bar 1 | 0.75 seconds |
| Second onset | 2.25 seconds |
| End of the short exercise | 3.75 seconds, after the tied continuation |
| First-to-second onset spacing | 1.5 seconds |

The endpoint deliberately stops this small exercise. It is not a claim that the song or its opening ends there. These are notation-derived values, not captured performance timestamps.

## Implementable lesson contract

1. Open the playable piano with the reference link. Keep the initial prompt to "Try the opening two strikes." Put source details behind an optional disclosure.
2. Offer the Musicnotes preview as the inspectable note reference and Apple Music as the recording reference. Identify the lesson as "Opening exercise from the published arrangement." Do not call it an official transcription of the recording.
3. Prefer a keyboard/register control that can actually reach E6. The current C3 to C6 instrument and MIDI 48 to 84 validator cannot. If using the existing instrument immediately, play E5, MIDI 76, and visibly label "One octave lower than the written opening." Do not silently clamp 88 to 84 or describe E5 as the source register.
4. A user-requested demonstration can use the two onsets above, followed by the learner's own attempt. Demonstration events must stay separate from recorded learner events. Do not preload the demonstration into an apparently learner-authored take.
5. Record the learner's note-on and note-off times without quantizing them. Replay that take. The learner can try again, keep it, or change it. No microphone or original-song audio is needed for those actions.
6. If showing a timing comparison, state the measured difference from this exercise's target, and define alignment explicitly. Use the first learner onset as the origin when comparing the 1.5-second interval. Absolute delay after pressing Record is not an error. Do not infer accuracy against the recording, mastery, or learning from event capture.
7. For continuation beyond this excerpt, inspect the next passage of the authorized arrangement or an accessible official recording first. Do not fill the rest from memory or from the BU upload.

Suggested reference payload for the current adapter:

```json
{
  "title": "Runaway (feat. Pusha T) - Kanye West",
  "url": "https://music.apple.com/us/music-video/runaway-feat-pusha-t/1445837852"
}
```

The wrapper needs a separate source disclosure for Musicnotes and the chosen register. The current practice reference object carries only one title and URL. No schema or product code was changed for this review.

## Checks before calling the lesson ready

- A listener with access to the official recording checks the opening pitch/register and marks the actual recording time window. Until then, recording-specific claims remain unverified.
- A reviewer can open MN0103069 in its original E-major key and inspect the initial rest, E6 noteheads, tempo and tie. Transposed versions must not silently replace the source version.
- The lesson either plays MIDI 88 with an instrument that supports it, or explicitly displays the octave-lower adaptation and plays MIDI 76. Saved state and replay agree with the choice.
- The demonstration starts only on request, and the learner's recording contains only learner inputs. Reopening a saved take preserves its actual times.
- The UI makes no full-song promise, embeds no full score or original audio, and treats the learner's own judgment as distinct from any numeric comparison.

Browser evidence remains inspectable in owned Neo tab 105 for Apple Music, tab 109 for Musicnotes, and tab 110 for the BU provenance lead. Screenshots were visually inspected in this review session; no score image was added to the repository. This source review does not establish browser integration quality or learner outcomes.
