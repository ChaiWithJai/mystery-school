# Full local demo sequence

Reviewed commit: `a151f91` (product state from `0b1f42a`; final commit changes only the verifier's asynchronous wait). Local backend build: `abbfbaf6cd7dc9d2`. Browser run started 2026-09-10 at 20:07 UTC against `http://127.0.0.1:5210`.

All thirteen browser gates passed: default Runaway entry; unfocused physical L producing E6; three-mode tour; Escape preserving piano; repeated save reopening the tour; manual advance to boxing; body map opening the mirror; 40-second practice retention; transition to the rendered world; visible exact observation and source-artifact link; exact saved-world reopening; visible exact memory text after reopening; and retained memory provenance.

The round lasted 40,123.7 milliseconds and retained 88 normalized image-position samples. Input was a 68-second excerpt of the reviewed defense source, used only for plumbing QA. It was not looped and is not a learner's performance or evidence of the selected stick-and-move technique. No model requests or page errors occurred.

| Record | Artifact ID | Trace ID |
| --- | --- | --- |
| Boxing source | `ab46fd2c-e1c0-4899-a9cf-828ebbf6c54d` | `tr-21b79d3788b16a3d3ee08652e40b3aea` |
| Saved world | `9f4fcd94-ba93-4f5c-b304-5f8b08b06ee8` | `tr-d20b46d531287e8d251987730baa3f62` |

These IDs belong to the M4 local data store. The world displays the exact synthetic QA reflection and labels it agent review, not human learning evidence.

The tour initially exposed a real retry regression: its events omitted `payload.pathway`, so a second music save failed the backend's same-pathway event check. Commit `01dd5c0` binds all three tour events to music. The final browser run exercised cancellation, saving again, and continuing successfully. The verifier also now waits for the asynchronous saved-take transition before deciding whether a tour exists.

Separate checks passed at 1440×900 and 1080×592: centered body map, prominent cue, visible mirror/reflection controls, and no blocking overlap. The world uses the homepage's same `school.glb`, central library, great tree and islands. Shared-asset loading preserves saved story and memory state.

Scope limits: physical webcam framing, audible speaker output, live local-model coaching, learning efficacy and A/B head-slot definitions are not established by these checks. The first two require presenter setup; the local coach requires its configured runtime. The authored cue remains explicitly distinguished from a model response.

Run the checked-in `scripts/verify_demo_journey.mjs` with the environment variables documented in `demo-journey-verifier.md`. The optional source-video fixture must exceed 41 seconds. Presenter timings are in `docs/demo-cue-sheet.md`.
