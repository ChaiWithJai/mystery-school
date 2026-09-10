# Runaway soundtrack

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

The next reliable option is a rights-cleared local recording supplied for this
demo, or an authorized embeddable source. Do not download around embed controls.

## Checks

266 JavaScript tests pass. These cover the request cutoff and continuity
parameters, plus scene cleanup. They do not prove provider playback, audible
quality, cross-world sound continuity, or browser autoplay permission.
