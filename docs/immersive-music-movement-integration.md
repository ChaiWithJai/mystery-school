# Music and movement merged integration QA

September 10, 2026. Real Playwright browser on the merged visual branch after main 5ce0cee integration (merge 8fc1b5d), plus root's final playable-key change. Agent-review routes; no model calls or learner claims.

Both pathways changed a parameter, used optional help, opened the Keep dock and saved. Exact saved-version links opened in newly created browser contexts without existing draft storage:

- Music `8b4de085-727a-41cb-8c72-f0c9bab7ae57`, trace `tr-abc258a38af800b679910c13c89d4c54`: attack 0.03 restored.
- Movement `e1136794-fbcb-4b95-9903-70ba069cfc3b`, trace `tr-8cd108832ae941943b60e82dd14d7b5d`: duration 4 restored; assistanceOpen true saved. Four linked events resolve to the actual path open, parameter change, help action and dock toggle.

Music's final individual C4 key was clicked successfully through the real WebAudio path. Saved artifact `261fd1fb-fa46-4dcd-bc94-1d6b8b644eea`, trace `tr-92b06522dafac4df725dfd367550d209`, links five events: path open, play, ended stop, help open, dock toggle. The play event records exactly one C4 at 261.625565 Hz, duration 1.1 s, attack 0.03. The evaluator did not listen to or record device audio; this verifies playback scheduling/state and observable trace, not audible fidelity.

All linked event IDs were resolved through API and MLflow, with correct agent_review/pathway labels. Saved artifact traces contain the same IDs, and Studio sample metadata matches. Telemetry reports zero failed/omitted events. The first fast music save did not include its late help-toggle event; the explicit later key/help save above includes it. Records are retained unchanged.

Rendered Studio Related records showed all four movement action links. Clicking the parameter event opened `?sample=9b575487-1132-4683-8e47-97a839dd7a0c`; URL assertion passed. A preliminary attempt became stale after automatic refresh closed the details; reopening and clicking immediately succeeded.

Raw evidence: `output/playwright/merged-integration/evidence.json`, `key-events.json`, fresh-context result files and `event-link.txt`. The root separately ran the merged JavaScript/backend suites; this document reports browser and readback checks only. No additional product edits were made during this verification.
