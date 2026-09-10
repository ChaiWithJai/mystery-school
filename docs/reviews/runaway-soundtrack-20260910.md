# Runaway soundtrack

## Current source decision

Jai selected the Virtual Piano arrangement again. It is now the visible
reference through `https://virtualpiano.net/?song-post-28667`, the Play this song
link on his exact sheet. Verified the source's Auto Play changes to Auto Pause.
The sheet specifies tempo 160 and transposition +4. Automatic YouTube loading
was removed. The local two-strike exercise is labeled Hear exercise; it is not
represented as the complete Virtual Piano arrangement.

The reference opens separately. Cross-site playback and a seven-second cutoff
on Virtual Piano are not controlled by this app. Local-file playback remains
available under Audio options. The records below describe earlier checks and
the replaced YouTube approach, not the current default source.

## Requested behavior

Play the first seven seconds on entering Runaway. Let the presenter keep the
recording playing across the demo. Keep Stop available. Do not replace the
recording with an unlabeled synthesized exercise.

## Implemented

- One persistent official YouTube player; seven-second source cutoff.
- Explicit Keep playing removes the cutoff and uses the current position.
- Continuous mode lowers volume to 25 percent and survives pathway transitions.
- Leaving piano without that choice destroys the player. Closing the drawer stops it.
- Autoplay denial offers Play opening. Embed failure offers the official link.
- Recording events are not learner attempts or model calls.

## Actual result: blocked by provider

BrowserOS Neo on localhost:5188 rejected the official video Bm5iA4Zupek with
YouTube error 150. The official UMG audio VhEoCOWUtcU also reached the error
state. No successful recording playback or seven-second acoustic result is
claimed. The keyboard remains available. The failed player collapses rather
than leaving a large error frame.

Official audio source: https://www.youtube.com/watch?v=VhEoCOWUtcU
API contract: https://developers.google.com/youtube/iframe_api_reference

## Local source support

Use local audio accepts a presenter-selected audio file without uploading it.
It uses a browser object URL, releases the source on Stop, and does not record
the filename or bytes in telemetry. Selection is session-only, not durable.
The recording must still be supplied. Do not download around embed controls.

Verified in BrowserOS Neo on localhost:5188:

- A twelve-second repeated licensed piano sample was selected as a test fixture.
- The player reached `playing`, then `opening-ended` at the media cutoff.
- Keep playing resumed the source and the same player survived music to boxing.
- Stop removed the player. No test fixture is represented as Runaway.

The fixture is `/tmp/astral-soundtrack-qa.mp3`, generated from the bundled
Alexander Holm sample. It is not a product soundtrack and is not committed.

## Desktop disclosure

An unavailable embed now collapses to a 166 by 47 pixel control instead of the
356-pixel-wide error card. Opening it reveals the failure, source link and local
audio setup. Actual playback retains visible transport controls.

Browser review at 1440 by 900 and 1280 by 720 confirmed separated title and
practice controls, an unobstructed keyboard, and an on-screen continuation
button. At 1280 by 720, the title ends at y=149, controls start at y=173, keys
end at y=572 and continuation ends at y=695. This is a layout check, not final
human acceptance of the demo.

## Checks

270 JavaScript tests pass. Local-media tests cover the seven-second boundary,
continuous position and volume, disposal, and denied autoplay. Browser checks
verify the local source and pathway transition. They do not prove that the
actual Runaway recording plays or establish subjective acoustic quality.
