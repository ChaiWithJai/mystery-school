# Boxing as a mirror

`mountBoxingMirror(container, {initialState, onChange, onEvent, lessons})` returns `getState`, `setState`, `dispose`. Include boxing-mirror.css. Lessons are `{id,title,videoUrl,cues:[string],source}`. `videoUrl` must be a direct playable local/video URL, not a YouTube page. No source means the source link stays hidden. Root app owns curriculum selection and artifact persistence.

The detector is copied without modification from ChaiWithJai/hybrid-ai-blueprints PR5, commit 2ba80b5, `blueprints/shadowbox-coach/app/punch.js`. No LICENSE file was found in that supplied repository; this is user-authorized reuse within Jai's repositories, not a claim of an upstream open-source license. Preserve this provenance when distributing. The worker is adapted from that PR's pose-worker.js to use local assets and CPU fallback.

MediaPipe Tasks Vision is pinned to 0.10.14. Bundle and SIMD/non-SIMD WASM fetched from jsDelivr npm package. Apache 2.0 LICENSE copied from google-ai-edge/mediapipe v0.10.14. Pose Landmarker Lite float16 v1 fetched from Google's official mediapipe-models bucket. All are served locally; the mirror has no frame upload endpoint or remote model request.

Camera starts only after Start camera. Local video files remain blob URLs, not uploads. Disposal stops camera tracks, terminates inference worker, cancels animation, pauses source/learner videos, revokes blob URL. Pending camera permission resolves safely after disposal by stopping acquired tracks. Artifacts contain learner reflection, selected lesson, mode, and at most 60 typed detector estimates; no raw frames, landmarks, file path, or power score. Source lesson and artifact provenance are the host's responsibility.

This is visual self-observation plus heuristic pose estimates. PR5's synthetic detector scores are not evidence of physical boxing accuracy, force, mastery, injury prevention, or resemblance to Crawford. Low-visibility poses suppress estimates. The local camera continues as a mirror if model loading fails. The learner can notice and reflect without accepting a detector label as coaching truth.
