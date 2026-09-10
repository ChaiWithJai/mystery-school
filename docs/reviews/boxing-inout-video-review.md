# Approach, touch, exit: source review

Reviewed actual local copies of three videos, extracted contact sheets at two-second intervals, and independently inspected exact frames listed below. Full media is review-only under `/tmp/boxing-source-review`, not committed. JSON manifest includes sources, hashes, local paths and embedding URLs.

- **ghDNbod8B3s, 00:08**: visible instruction emphasizes movement before and after every attack. Earlier frames demonstrate approach, single bag punch and exit. Curated cue: “Move before the punch. Move again after it.”
- **9gqxqT57qkA, 00:10**: visible instruction prioritizes approach and exit over punches; earlier frames demonstrate any two-punch combination and exit.
- **6XbTboFL0nY, 00:01**: visible instruction asks the viewer to move while maintaining distance to the swinging bag. Later frames add jabs to keep it moving, directions and angles.

These are Andrii Khotin's bag drills linked by the day-one curriculum. A camera-only practice is a **shadowboxing adaptation**; it does not measure bag contact, force, physical distance or technical correctness. The 40-second window records elapsed practice and normalized image positions from visible MediaPipe hips/ankles. Camera-relative image movement is not depth measurement, calibrated footwork or proof of entering/exiting striking range. Source observations remain separate from explicit learner reports. No score or mastery state is generated when the timer ends.

## Browser evidence

Actual Chromium with the reviewed ghDN video as an explicitly non-learner QA fixture rendered visible arm/torso bones, a gold hip trail and visible ankle markers (`/tmp/boxing-round-live.png`). A real 40-second wall-clock round ended at 40000.8ms, retained 265 valid normalized position samples, stopped the mirror, and left `reportedTried:false`. No page errors. This verifies the video/model/overlay/timer path; the source instructor in this QA video is not represented as a learner. Seven unit tests pass, including confidence gating, position provenance, immutable observations and timer-state restoration.
