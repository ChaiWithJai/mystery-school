# Visual demo correction

Jai rejected the initial Leena drawer at 1080 × 592: the demo required reading a biography and several explanations before doing anything. This change makes the experiment the entry point.

- The forest-toned stage replaces the paper biography layout. Character context is optional.
- Leena's passage, first thought and revised thought form three selectable connected lights. Only the current editor opens; entering words visibly lights its node. Source attribution remains accessible beside the passage.
- The shared dock opens keeping a version, a staged response, or the next question on demand. Existing artifact payloads, original wording and source references remain intact.
- Music and movement place their playable/animated models first; extended background is available on request.

This is a presentation correction, not evidence of learning efficacy. Browser verification uses `agent_review` and explicit synthetic wording. There are no additional model calls.

## Browser evidence

Leena passed at 1080 × 592 and 1280 × 800 on local port 5188: source node, first thought, alternate reading, revised thought, optional video reference, save, staged friend response, next question, and reload retention. Artifact `b927f103-ae62-4211-b297-bdb98dd8cc61`; trace `tr-a9a5df5267a003c4652b292d011a40a4`. Exact record: `visual-demo-evidence/ideas-agent-review.json`.

Full browser screenshots are in the sidecar workspace under `output/playwright/ideas-immersive/`. They were visually inspected, including the short viewport; header spacing was reduced after the first check showed the action below the fold.

Integration note: maincar's concurrent saved-version sharing work also touches `learning-paths.js`. Preserve its save/share behavior when reconciling the template; this branch changes presentation and adds reveal controls, not artifact serialization.

Music browser check: attack adjustment, Hear my version, Stop, dock save passed. Agent-review artifact `683b24d7-836e-4a2d-a0b9-e5b694213e0e`, trace `tr-5d377e053fa881d8bcc8922c426cdb1e`.

Movement browser check: duration 2 → 4 seconds, Play, Stop, dock save passed. Agent-review artifact `62dec964-8526-49c0-8b49-0e9c94c47889`, trace `tr-8fe2e4ade0bcd24ef99e42d5007f78e6`. Play controls were placed above the duration control after visual review. No JavaScript runtime errors; only an unrelated favicon 404. These two checks cover changed controls and saving; the earlier maincar full-circle verification remains separate.

## Reconciliation with main 5ce0cee

The visual branch retains `createLearningEventBuffer`, `createLearningDraftScopes`, `persistLearningSnapshot`, `savedVersionUrl`, exact-version links and `event_ids` from main. Dock actions now enter the same buffered event stream. 83 JavaScript tests (including a new one-note playback check), syntax checks and 20 backend tests pass.

Leena's merged flow passed through all stages, and the exact final URL restored both interpretations and the video reference at 02:34 in an independent browser context. Final artifact `1d63e0eb-d35f-4c97-b862-f226121d4b51`, trace `tr-9a18a9c75d8ccb0377b8ddfe3cd31e38`. Linked events include source/open, thought focus, help and dock actions. Exact artifact and events are included in `visual-demo-evidence/ideas-merged-*.json`. The reused pre-buffer QA draft is honestly marked as having unlinked earlier history; new linked events were recovered, with zero failed or omitted events.

The four visible music keys are now actual buttons: tapping a key plays that single note using the current envelope and records its note and 1.1-second duration. Phrase playback retains four notes and its 4.7-second duration.

Music artifact `8b4de085-727a-41cb-8c72-f0c9bab7ae57` reopened with attack 0.03 seconds; movement artifact `e1136794-fbcb-4b95-9903-70ba069cfc3b` reopened with duration 4 seconds in separate browser contexts. Linked event IDs resolved both through the API and MLflow, with matching path and `agent_review` provenance. Both record zero failed/omitted events and no unlinked draft history. Exact event/trace mapping is in `visual-demo-evidence/music-movement-merged.json`.

Single-key browser check: Play C4 produced one C4 at 261.625565 Hz for 1.1 seconds; the saved artifact `261fd1fb-fa46-4dcd-bc94-1d6b8b644eea`, trace `tr-92b06522dafac4df725dfd367550d209`, links the play event, ended stop and opened help among its five events. No Web Audio error occurred. This checks execution and trace accuracy, not listening-device fidelity.
