# Actual demo journey verification

Run `node scripts/verify_demo_journey.mjs` with Playwright installed. Configuration: `DEMO_BASE_URL`, `DEMO_EVIDENCE_DIR`, optional `DEMO_VIDEO_FIXTURE`, and optional `PLAYWRIGHT_MODULE` (module path when Playwright is installed outside this checkout). Exit2 means incomplete; output report and screenshots are written even after a failure, and the browser always closes.

Uses a fresh browser and the defaultURL with only actor=agent_review. Missing default entry is recorded, then explicit music navigation is diagnostic only. Checks physical L, visible manual transitions, optional40-second local-video practice, and saved world exactURL restoration. It saves clearly labeled synthetic QA artifacts. It blocks /api/project rather than invoking inference. Missing memory controls are reported as incomplete, never inferred from saved JSON alone. A future differently named memory/tour interface needs its actual selectors reviewed before changing this script.

On f57235d at localhost5210, September10: default entry and inspectable prior-practice memory are incomplete. PhysicalL, manual piano→boxing→world transitions, saved exactworld URL all succeeded with no page exceptions/modelcalls. Fixture was not supplied, so40-second video was not run. Evidence from initial run: /tmp/demo-journey-check/report.json. No sound/real-learner outcome claimed.
