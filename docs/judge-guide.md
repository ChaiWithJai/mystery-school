# Judge guide: Mystery School

**A good teacher can change the course of someone’s life.** This prototype explores a teacher-created sandbox: use a student’s interests to open a subject, let them make and compare things, and preserve evidence the teacher can interpret. Read the [instructional brief](teacher-sandbox.md) for the human-in-the-loop model and implementation boundaries.

## Watch the demonstration

Run the [local setup](../README.md#run-locally). Use `/demo-60.html` for the timed cut or the [manual cue sheet](demo-cue-sheet.md) for hands-on demonstration. The timed cut is a presentation, not an exported submission video.

| Moment | Show | Explain |
| --- | --- | --- |
| Opening | Play a piano key and keep a take. | Start with something the student wants to make. |
| Deep dive | Enter movement, open the mirror, and try one short practice round. | A teacher uses an interest to invite observation; the intended bridge is physics. |
| Reflection | Save the student’s observation and reopen it in the world. | Keep their words and evidence so the teacher can choose what comes next. |
| Technical close | Inspect one artifact and its source/trace, or a labeled recorded proposal. | AI supports the activity; the teacher interprets learning. |

Allow camera permission and check speakers before presenting. The full manual practice sequence can exceed one minute. For a three-minute finalist demo, show one verified proposal with preview/apply/undo and one provenance link after the learning sequence. Use labeled replay if live inference is unavailable; do not narrate replay as a live request.

## Map the four judging criteria

The participant guide assigns 25% to each criterion.

| Criterion | Evidence to inspect | Limit |
| --- | --- | --- |
| Astra in development | Git history, structured-output implementation, dated implementation/review records | Do not attribute every line or visual asset to Astra without a record. |
| Astra in the project | `server.py`, `schema.json`, [proposal workflow](live-proposals.md), recorded fixtures | Executable discovery and fixtures do not establish current live access. |
| Live demo | Playable scenes, presenter cut, [browser evidence](reviews/final-demo-sequence.md) | Recorded QA is not physical camera or speaker verification. |
| Technicality | Versioned artifacts, stale-response protection, local inference boundaries, traces, tests | Trace completeness and learning efficacy are different claims. |

## Identify event contributions

The repository was created on September 10, 2026. Initial contract `1282699` and implementation `494e728` precede the three-path integration `7ec7324`. Later work adds bounded proposals, visual scenes, deployment infrastructure, foundation integration, and presenter polish. This documentation review uses base `cc443a7` (PR 17 merge). Inspect [commit history](https://github.com/ChaiWithJai/mystery-school/commits/main/) and individual PR diffs for exact changes.

Event-day timestamps do not prove that every component originated at the event. Prior instructional methodology, the imported boxing detector, libraries, pretrained models, music samples, and external teaching sources are reused inputs. The [reuse ledger](sources-and-reuse.md) distinguishes them from integration work.

## Finish submission readiness

The supplied participant guide specifies a September 10, 2026 **5:30 PM EDT** deadline, a public repository, an accessible demo, a public one-minute video, and all team members listed. Finalist presentations allow three minutes plus two minutes of questions. Confirm any organizer changes directly.

| Item | Documentation audit status |
| --- | --- |
| Public repository | Available at this repository |
| Hosted demo | Static deployment exists; checked API returned 503 and deployment SHA was older than review base |
| Live local inference | Requires presenter activation and current end-to-end evidence |
| One-minute public video | No submission URL established in this audit |
| Team roster | Confirm in the submission form |
| Media/reuse rights | See source ledger; repository-wide license not specified |
| Eligibility clarification | Unconfirmed; see the specific overlap below |

The participant guide bans sports analyzers/coaches and an “AI for Education” chatbot. The intended product is a teacher-operated learning sandbox, with movement motivating physics. Current features nevertheless include boxing practice cues and camera estimates. The author’s instructional explanation is recorded; organizer clearance is not. Describe both intent and behavior accurately and obtain an organizer determination rather than assuming the product description resolves this overlap.

[Event page](https://cerebralvalley.ai/e/openai-gpt-6-astra-nyc) · [Submission form](https://cerebralvalley.ai/e/openai-gpt-6-astra-nyc/hackathon/submit)
