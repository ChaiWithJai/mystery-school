# Verification checkpoint

September 10, 2026. Tests ran on Apple M5 Pro. M4 remains untested.

## Completed checks

| Check | Evidence | Limit |
| --- | --- | --- |
| Draft preservation | Neo: edit all three Imagine fields, close, visit References, reopen; compare another world | Memory lasts until reload. |
| Explicit selection | Neo: projection disabled before confirmation and enabled after it | Selection is not evidence of understanding. |
| Learner request | Neo: the opening request appears unchanged in Imagine | Speech and sketch interpretation require a facilitator. |
| Backend | Eight unittest tests pass | Mock subprocesses test failure and persistence paths. |
| Actual model correction | `verify_demo.mjs` passes for the saved parent and child | QA annotation, not participant feedback. |
| Exact request capture | `verify_capture.mjs` passes for the bike walkthrough | Capture begins with new jobs; older prompts cannot be reconstructed as fact. |

## Local trajectories

| Job | Purpose | Result |
| --- | --- | --- |
| `5beb35ac-6f59-4a00-b237-6c230251076d` | First actual model attempt | Failed because the shell CLI was outdated. |
| `d4820fbb-7157-4bbe-b112-a50b1a3587b2` | Reference image to school scenario | Succeeded; 190-word story. |
| `bb121eb3-adea-4b3d-94d4-809879af9814` | Apply an anchored QA correction | Succeeded; 79-word story, original preserved, distinct trace. |
| `bcd3fadb-47cd-4226-8afd-6ec6e2789a5d` | Synthetic bike learner with explicit notebook context | Succeeded; exact prompt, arguments and reference hash verified. |

The three successful calls report 54,521 input tokens and 2,440 output tokens.
Those sums exclude failed-call usage, build-agent usage, and any separately
reported reasoning counts. They are not an all-in build cost. Dollar cost is
unknown until a price basis is established. A missing number is never zero.

## Remaining evidence

- A learner must manipulate a meaningful object, not only read suggested actions.
- Run the kite and basketball probes from Buzz as synthetic cases and record failures.
- Test a fresh problem without model guidance. Do not count clicks as learning.
- Verify the full experience on the user's M4.
- Verify another person's ability to inspect and continue a saved version.
  The current localhost app is not an authenticated multi-user deployment.
- Evaluate with actual learners. No participant outcome has been established.

The demo preserves a person's explicitly supplied questions and notes. It does
not reconstruct their identity, claim consciousness, or speak with spiritual
authority. The forest is an authored 3D scene. Model output changes its existing
atmosphere and creates saved scenario branches, not arbitrary new geometry.
