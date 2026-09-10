# Actual demo journey verification

## Current acceptance contract

The learner now saves from piano directly into boxing. The extra guided tour
is intentionally removed, not a missing feature. The verifier checks that
direct transition. Tour findings below describe historical builds only.
Current desktop review is recorded in [real-path-polish.md](real-path-polish.md).

Run `node scripts/verify_demo_journey.mjs` with Playwright installed. Configuration: `DEMO_BASE_URL`, `DEMO_EVIDENCE_DIR`, optional `DEMO_VIDEO_FIXTURE`, and optional `PLAYWRIGHT_MODULE` (module path when Playwright is installed outside this checkout). Exit2 means incomplete; output report and screenshots are written even after a failure, and the browser always closes.

Uses a fresh browser and the defaultURL with only actor=agent_review. Missing default entry is recorded, then explicit music navigation is diagnostic only. Checks physical L, visible manual transitions, optional40-second local-video practice, and saved world exactURL restoration. It saves clearly labeled synthetic QA artifacts. It blocks /api/project rather than invoking inference. Missing memory controls are reported as incomplete, never inferred from saved JSON alone. A future differently named memory/tour interface needs its actual selectors reviewed before changing this script.

On f57235d at localhost5210, September10: default entry and inspectable prior-practice memory are incomplete. PhysicalL, manual piano→boxing→world transitions, saved exactworld URL all succeeded with no page exceptions/modelcalls. Fixture was not supplied, so40-second video was not run. Evidence from initial run: /tmp/demo-journey-check/report.json. No sound/real-learner outcome claimed.

Current UI revision (132e8f1): follows the body-map Try control before accessing the mirror, opens reflection only when closed, deposits the exact reflection via Keep my observation, and checks the rendered reported-memory text and artifact link. Both /api/project and /api/coach are blocked. A fixture must exceed41seconds; a short video is rejected rather than looped. The fixture is explicitly source-video QA, not learner performance or proof of the selected drill. A separate guided-three-mode-tour gate does not count manual advance as explanation.

Actual 132e8f1 full run at backendbuild abbfbaf6cd7dc9d2: default entry now opens music; L records E6; manual ring and body-map Try succeed. Authorized68second defence-catch source excerpt ran40.0265seconds and retained139 normalized image-position samples (no looping). This fixture verifies plumbing, not a student performance or the selected feet technique. Reflection transferred into a visible world reported-memory panel and exact artifact link. World25f1e53f-560f-4733-8cab-d1a3851d9085 / trace tr-ab63e93592f0b40fbb82e151a8488dd0 reopened; source boxing9aea6879-54b8-4952-a20c-3d5e2a3a944b / trace tr-76d23227720ef0241de084dc66b6f96d. Evidence /tmp/journey-132-final; no exceptions or modelcalls. Guided three-mode tour is still missing in132e8f1 and has a separate gate in the updated script. First driver run collapsed an already-open reflection disclosure; corrected and reran, with the failed run retained separately at /tmp/journey-132.
