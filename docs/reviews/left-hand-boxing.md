# Left uppercut and left hook

Jai redirected the movement screen to two left-hand punches and positive completion feedback. The primary entrance now shows two animated paths, a short cue, and “Try both in my mirror.” The five foundational lessons remain under “More from the school.” The illustration is an authored explanation, not captured motion.

The drill uses anatomical left-hand metadata from the existing detector; CSS camera mirroring does not swap that metadata. Only matching lesson/session/hand/type estimates advance the two targets. Missing hand identity is no longer assumed to mean left. The cue moves from uppercut to hook as estimates arrive, and both estimates trigger a positive visual response. An explicit completion report also receives congratulations, independently of detector output. Neither proves technique or mastery. Reports persist in `drillReports` and emit observable events.

Source: Andrii Khotin's tutorial linked by the existing curriculum. Captions and actual video frames were inspected for lead hook at 30:24–31:04 and lead uppercut at 40:19–40:43. The latter is a long-range variant. Left means lead here only under the stated orthodox stance. The right-hand guard cue is anchored at 09:08–09:16; the exhale cue at 14:21–14:28. Slow solo practice and the simplified arrows are our adaptation. No attribution to Derek James is claimed.

Actual Chromium at 1080×592 verified primary entry, both explanation tabs, mirror entry, target visibility and explicit completion feedback. A separate synthetic adapter check verified matching left estimates versus pending movements and preserved completion reports; it is not a test of a human throwing these punches. All 298 JavaScript tests pass. Existing camera/worker cleanup and forty-second practice remain unchanged.

## PR 18 integration review

The teacher remains responsible for purpose, interpretation, and the next
challenge. Positive completion feedback acknowledges effort or a student's
report. It does not certify technique, physics understanding, or teacher review.
The README and spoken cue sheet distinguish this prototype from a future
teacher authoring and classroom review product.

Review found four delivery defects: target completion depended on the rolling
event buffer; camera-free retries shared an empty session ID; the combined
drill dropped the hook source; and foundations had no return to the main drill.
The integration keeps target achievements by practice, gives explicit retries
their own identity, preserves both source timestamps, and adds a return path.
Earlier reports remain separate from new attempts. The prior Runaway playback,
Attention save, and in-world writing fixes are retained from main.

Integration checks: 314 JavaScript tests and 50 Python tests passed. BrowserOS
Neo at 1440 by 900 verified explanation tabs, mirror entry, source visibility,
foundations return navigation, and camera-free completion followed by a fresh
practice. The previous report remained; the new practice had no completion
message. These were agent QA actions, not a person's physical performance.
Source advancement, rolling-buffer eviction, saved-state restoration and
late-frame rejection were checked with deterministic adapter tests.
