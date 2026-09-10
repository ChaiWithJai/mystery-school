# Sources and reuse

Public visibility is not a license grant. This repository has no repository-wide license file at documentation base `cc443a7`. Preserve upstream notices and verify permission before redistributing material. This ledger identifies known inputs; it is not a legal clearance certificate.

| Input | Provenance and status |
| --- | --- |
| Teaching methodology | Jai’s pre-existing instructional ideas inform the prototype; do not claim the methodology originated at the hackathon. |
| Boxing detector | Imported from `ChaiWithJai/hybrid-ai-blueprints` PR 5, commit `2ba80b5`; upstream repository license was not found. See [provenance](reviews/boxing-mirror-provenance.md). |
| MediaPipe | Vendored Tasks Vision 0.10.14, WASM, and Pose Landmarker model; see the [provenance record](reviews/boxing-mirror-provenance.md) and bundled `public/vendor/mediapipe/LICENSE`. |
| Three.js | Dependency pinned in `package-lock.json`; retain the installed package’s license when distributing it. |
| Piano sample | Alexander Holm’s Salamander Grand Piano, CC BY 3.0; see [attribution](../public/audio/piano/ATTRIBUTION.md) and bundled source notice. |
| Runaway | Commercial recording excluded from Git and hosted bundles; a local supplied recording is not permission for public redistribution. [Notation source review](reviews/runaway-source-20260910.md) is not a license grant. |
| Bonsai 4B | Pinned external weights/runtime in `deployment/bonsai-model.json`; model licensing does not license this repository. |
| Boxing teaching videos | External source references in `public/data/boxing-foundations.json`; links and reviews do not transfer video rights. |
| Classics and lecture references | Preserve source and translation attribution; user-supplied lecture references remain unverified unless reviewed. |
| School world | Construction and assets documented in [Blender notes](../blender/README.md). |

Do not publish private recordings, credentials, event Wi-Fi details, local student data, or private trace stores as documentation evidence. Use labeled synthetic records where appropriate and retain their fixture labels.
