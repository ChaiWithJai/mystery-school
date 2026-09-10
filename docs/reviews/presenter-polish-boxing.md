# Presenter polish and boxing verification

The presenter cut now identifies the current chapter and provides Back, Pause/Resume, and Next in a compact control bar. Choosing a chapter holds the clock there, so the boxing demonstration can take its full forty seconds or longer. Resume returns to the timed presentation. Opening-piano pause/resume remains M5's implementation. Subtle fades respect reduced-motion preferences.

Actual Chromium verification at 1080×592 selected boxing at 25 seconds, held the clock, moved to the book world, returned to boxing, and resumed/paused successfully. Controls remained on screen and no page errors occurred. The script is `scripts/verify_presenter_controls.mjs`; supply `PLAYWRIGHT_MODULE` if Playwright is installed outside this checkout.

The complete hands-on sequence on product c7e4f02 also passed all thirteen browser gates, including a forty-second source-video practice and exact saved world-memory reopening. That video is agent QA, not a camera observation of a learner. A separate five-foundation boxing review accompanies this polish; physical camera framing and learner technique are not inferred from these checks.

## Boxing findings fixed and retested

Attention previously displayed a cue without entering the mirror. It now enters an explicitly Jai-authored exercise with no invented external video. Its next-lesson gate also no longer demands a nonexistent video timestamp. An explicit tried report and observation remain required; unknown missing sources do not receive this exception.

The actual browser review passed all five foundation entries and source cues, body-map return cleanup, a forty-second local-video round, worker termination and file-URL cleanup, and long exact reflection transfer to the world. The timer did not mark the learner as having tried. Attention's separate test verified hidden video controls, disabled progression before the tried report, enabled progression afterward, and advancement to the parry lesson. No page errors or model calls. The local video contains source instructors and is not learner evidence.

Final integrated product `218b3ea` preserves M5's `427abaa` soundtrack cleanup. All 296 JS tests and the deployment asset build pass.
