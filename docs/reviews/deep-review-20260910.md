# Independent deep review, 2026-09-10

Reviewer: Codex agent. This is agent review, not human feedback, participant testing, or learner results.

Duty deadline: 2026-09-10T18:50:08Z. Initial pass began at 17:36:07Z; evidence checkpoint 17:38:06Z. Subsequent checkpoints must append timestamped findings rather than silently replacing this record.

## Source and inspected state

Read first: `/Users/jaibhagat/.codex/attachments/4eb6d853-0e08-49ba-9da4-96d9ba507960/pasted-text.txt`. Original source is preserved unchanged. Its inspected revision was `8fc1b5d`; its claims are historical, not automatically current evidence.

Central source text: "Their agent changes the thing you are watching. Our agent mostly describes a possibility, while separately authored code supplies the interaction."

Acceptance source text: "The next leap is not more forest decoration or more coordination. It is making the learner's intention cause a visible, playable change through the model, while preserving the fast local interaction already available." Apostrophe normalized in this excerpt; consult the original for exact typography.

Actual checkout at initial inspection: clean `main`, HEAD `440f95c`, preceding product commit `c8cd7dc`. No source edits, commits, remote updates, Buzz, Slack, Google, or model inference requests were made by this reviewer. Browser interactions use `actor=agent_review`; ordinary app telemetry can therefore be written locally. Only this review document is owned for file edits.

BrowserOS Neo session: `astral-deep-review`; owned pages 87 (home/music), 88 (movement), 89 (ideas), localhost port 5188. Inspected accessibility trees and actual screenshots of all three desktop labs. This is a persistent browser profile with existing QA drafts and local saved artifacts, not a fresh profile. Music initially showed attack 0.40s; a keyboard change visibly updated the graph description to 0.41s. Movement rendered cubic/quintic choices, duration, replay, position graph and instantaneous numerical feedback. Ideas rendered the passage, prior agent QA text, revision editor and explicitly authored suggestion.

## Initial verdict

**Do not accept the central product promise yet.** The deterministic labs and version records are real, and direct entry now avoids a form before music/movement play. But learner intention still reaches Astra as context and returns as narrative plus atmosphere. There is no model-proposed playable state transition, preview/apply/undo, or demonstrated unexpected request changing the experiment. "Only M4 acceptance remains" omits these release-blocking product gates.

## Prioritized findings and disjoint ownership proposal

### P0. The model contract cannot express the required change

- Evidence: `schema.json:4` requires narrative, choices, atmosphere and evidence. `schema.json:13` permits only four visual numbers. `public/app.js:93` applies visual values and calls `renderLesson`; it does not mutate any lab state. `public/app.js:46` handles generated choices by displaying consequence text. `README.md` explicitly says generated scenarios do not overwrite experiment settings, words or sources.
- Consequence: a successful inference cannot satisfy the central promise. This is a harness limitation; these results do not demonstrate model incapability.
- Smallest aligned fix: introduce a versioned, bounded experiment proposal contract for all three pathways, validated at the server boundary and again by a deterministic client reducer. Include target artifact/version, typed operations, meaningful comparison configuration, source references where applicable, and explicit unsupported-request handling. Preserve learner text and original artifact. Add an in-place preview, explicit apply, and exact undo. An authored renderer is fine when the model chooses the substantive change; a keyword-selected widget is insufficient.
- Exact acceptance: replay one actual model-produced proposal per pathway. Before apply, original state is unchanged; preview exposes the proposed difference; apply changes audible/visible interactive behavior or the source-grounded interpretive activity; undo restores the prior full state. Reject invalid/out-of-bounds/wrong-path/stale-base proposals without a partial mutation. Link applied state to the original model output and saved parent artifact. Synthetic proposals verify plumbing only and must be labeled as such.
- Proposed owner A: contract/schema/server validation only. Proposed owner B: `app.js` and `learning-paths.js` orchestration, preview/apply/undo and lifecycle only. Agree the contract before separate lab owners implement adapters. Reviewer owns this file only.

### P1. Music creation remains a single attack parameter; movement proposals do not create comparisons

- Evidence: `public/music-lab.js:8` freezes C4/E4/G4/C5; `normalizeMusicState` at line 45 returns only attack. Actual result `data/jobs/14e0de07-b8ea-4083-a395-e89dd2741841/result.json` proposes 0.20s/0.60s comparison lanterns and reversed listening order. Actual movement result `data/jobs/b1f2fbfe-7471-4fc5-ad9a-bab65af9e032/result.json` proposes cubic/quintic speed and acceleration overlays at distance 0.4m and duration 4s. Neither proposal has executable fields. Current movement screenshot has a single position graph, model selector and numerical readout.
- Consequence: meaningful authored exercises exist, but the song-creation promise is substantially narrower than the character goal, and the model's specific comparison remains prose.
- Smallest aligned fix: retain all pathways; allow a short editable musical phrase/rhythm plus bounded model-proposed variation with an audible A/B comparison. Give movement a persistent reference/candidate comparison with consistent axes and velocity/acceleration views that can be selected by the proposal. Do not substitute another forest feature for either path.
- Exact acceptance: an unexpected request to change a phrase ending changes saved pitches/rhythm or another musically substantive supported dimension, with before/after playback and calculus relationship retained. Movement apply produces the requested two trajectories at fixed distance/duration and exposes the different speed/acceleration predictions; undo restores the prior comparison. Reopen both saved artifacts and reproduce them.
- Proposed owner C: `music-lab.js`, music styles and music adapter tests only. Proposed owner D: `movement-lab.js`, movement styles and movement adapter tests only.

### P1. Great Books is sourced, but YouTube is a link and learner note rather than inspected content

- Evidence: `public/ideas-lab.js:2` contains an Epictetus passage with translator, URL and section; line 20 defines a fixed authored alternate reading. `validateYouTubeReference` at line 29 explicitly validates only a reference and does not establish video existence. `public/learning-paths.js:117` labels it `user_reference_unverified`. `public/app.js:64` says no new source/video content will be fetched. Actual ideas result `13915927-d0f1-4213-9c34-559e6ee3546a` proposes a greenhouse-rule discussion, not a generated revision activity attached to an inspected video segment.
- Consequence: honest labeling is good, but cannot establish sourced YouTube interpretation through Astra. Merely preserving a timestamp is not source comprehension.
- Smallest aligned fix: accept an explicit transcript excerpt with URL, timestamp range and provenance, or provide a verified public excerpt fixture. Pass the excerpt itself to the model. Add a bounded source-grounded challenge or comparison node that can be previewed/applied without rewriting the learner's interpretation. Keep supplied/unverified excerpts distinguished from inspected originals.
- Exact acceptance: inspect the selected passage/video segment, preserve exact source text and locator in the artifact, and trace each proposed interpretive challenge to supplied content. A different excerpt must yield a substantively different supported challenge; the original interpretation remains intact after apply and undo. A bare or unavailable URL must not be represented as inspected content.
- Proposed owner E: `ideas-lab.js`, source-content adapter and ideas tests only; owner A owns any shared server contract changes.

### P1. Inference dismounts the lab, and latency is not measured

- Evidence: `public/app.js:51` calls activity cleanup and replaces drawer contents when opening another drawer. `public/learning-paths.js:79` cleanup disposes the lab. Astra uses the same drawer (`app.js:64`). The interface offers a return to the saved experiment, but does not keep it mounted beside inference. `public/music-lab.js:198` stops playback on attack edits. Web Audio's `latencyHint: 'interactive'` at line 237 is configuration, not measured latency.
- Consequence: the world can remain available while the learner's actual working experiment is interrupted. Reopening local play during a job may be possible, but does not establish continuous play. No under-100ms result can be claimed from these checks.
- Smallest aligned fix: keep the active lab mounted; place request/proposal/status beside it. Apply sound edits at a suitable musical boundary with immediate visual feedback rather than losing play. Instrument input-to-next-visible-frame and audio scheduling/output separately.
- Exact acceptance: with a clearly labeled deterministic delayed response (no paid call), start a 30s pending request while music plays, movement replays or ideas edits. Continue changing the lab and saving a draft. Job completion must not overwrite intervening edits or steal focus. Measure local controls in an active foreground desktop tab, report sample count, p50/p95/max and cold/warm audio behavior against the <100ms target. A browser screenshot or tool roundtrip duration is not a latency measurement.
- Proposed owner B: lifecycle/inference panel. Owners C/D/E: local adapters and timing hooks. Proposed owner F: independent measurement harness, without product-file overlap.

### P1. Reusable delivery and unexpected-request evidence remain incomplete

- Evidence: README says verification scripts require existing local walkthroughs and intentionally fail on a fresh clone. `git ls-files '*LICENSE*' '*fixture*' 'data/*'` returned no files. Public synthetic review records exist, but are not a replay corpus of model-proposed playable changes. Stored Spanish kite and basketball jobs change language/narrative, with the same narrative/visual schema. They do not instantiate a kite/bounce activity. `app.js:11-13` also presents ranking claims as fact; these were not independently verified in this pass.
- Consequence: local provenance cannot demonstrate a repeatable public end-to-end product; unexpected-input support is still narrative. Event rankings and prior agreement are not acceptance authority.
- Smallest aligned fix: publish sanitized, clearly labeled actual-output replay fixtures for all pathways, with separate no-model replay and explicit live instructions. Provide a clean-data setup check and asset attribution. License selection remains the owner's decision. Define supported bounds openly without shrinking the required three pathways.
- Exact acceptance: from a clean checkout/data directory, install documented dependencies and replay all three proposal/apply/undo flows without private files or inference. Then main may assign exact live tests for novel requests. Each must alter the supported experience according to returned operations, with a trace and artifact. Unsupported requests must visibly explain the boundary, not claim to have built the requested experience. Verify ranking/event assertions with primary sources before retaining factual winner copy; do not use rankings to waive product gates.
- Proposed owner F: public fixtures/replay checks/setup evidence. Main/owner: license decision, source-claim verification and exact live-test assignment.

## Seven-gate status at initial checkpoint

| Gate | Status | Basis |
| --- | --- | --- |
| Meaningful play within 10s, no form | Partial, timing unverified | Direct music and movement controls render; persistent QA browser prevents a fresh-user timing claim. Ideas still depends on interpreting/editing text. |
| Measured local feedback <100ms | Unverified | No measurements found in the inspected lab code; audio hint is not evidence. |
| AI-proposed playable preview/apply/undo | Fail | Schema and apply path cannot represent lab changes. |
| Continued local play during inference | Fail for uninterrupted mounted play | Opening inference disposes the active lab; reopening is a separate action. |
| Three honest pathways and real artifacts | Partial | Three real deterministic labs and saved records exist; music creation and inspected YouTube/model-driven activity remain missing. |
| Fresh clone/replay/live/public fixtures/license | Incomplete | Private walkthrough dependency documented; no tracked license or playable-output fixture corpus found. License requires owner choice. |
| Unexpected request visibly changes experience | Fail for playable agency | Actual kite/bounce outputs are narrative and atmosphere. |

## Evidence limits and next checkpoint

Read all eight stored successful `result.json` files, the state job/trace/usage records and current code. The three linked pathway job trace IDs are `tr-a20173c8d7e849d4ea86b87bfa9ecf7e` (music), `tr-5881cbb87c3b8aa3408fde5449fbcc82` (movement), and `tr-25aca99e9d57a7f90f146d4fc92dce3e` (ideas). These support observed outputs and provenance, not learning effectiveness. Historical CLI failure is an environment issue; no new live inference was authorized or performed. No fresh-clone test, human timing study, audio-output measurement, or primary-source ranking verification was performed in this initial pass.

Request for incoming checkpoints: send commit/build identity, changed interface/files, a no-model replay command or exact existing output ID, and the before/apply/undo acceptance case for all affected pathways. Review will append results during the duty window and stop after 18:50:08Z. Main owns Buzz and the scoped heartbeat; this agent will not repeatedly poll or idle for the remainder of the window.

## 17:40:05Z coordination and corroboration checkpoint

Main reports that all four existing workers were notified, the final-M4-only readiness framing is withdrawn, and a bounded heartbeat will resume this same review through the deadline. Read back `docs/delivery-audit.md`: it now states, "M4 acceptance alone cannot close those product gaps." The initial finding above remains a timestamped account, not a claim that main still holds the withdrawn position. At this checkpoint that audit file is modified by main; this reviewer did not edit it.

Four incoming worker reports independently identify the same missing schema/apply bridge and the same drawer cleanup interruption. Their source thread IDs are retained here: `01a08bd3-1200-7602-ab5e-efcba89f0e6f`, `01a08c0c-044b-7d10-ba8d-5f0fa86e6bc3`, `01a08bd6-a1e5-7dc2-8a3e-d5c2f295c0f2`, and `01a08bd3-11d3-7f70-9c33-c2d6fbe44298`. These are agent reports, not additional human acceptance or new executed experiments. Their code findings corroborate the independently inspected initial pass.

Useful additional reported boundary: the existing `mount(initialState, onChange, onEvent)` APIs and full serializable snapshots can support typed proposals. Reopening an artifact does not undo projection atmosphere, and music's authored 0.35s keep/reject suggestion is not model-driven preview/apply/undo. Worker-reported exact-link and event-link checks establish persistence only. None reports fresh timing measurements or new model calls.

Next bounded review checks, on a concrete implementation checkpoint:

1. Inspect the new schema and reducers for all three paths, target/base version binding, bounds and rejection behavior. Do not accept one-path completion as the product gate.
2. Replay proposals with distinct model-chosen values; verify preview isolation, exact apply/undo, artifact lineage, and stale-result behavior after intervening learner edits.
3. Use a deterministic delayed response to verify uninterrupted music/movement/ideas interaction while pending; measure local feedback separately from inference latency.
4. Inspect source excerpts and model input/output for the Great Books/YouTube path; verify content grounding rather than URL syntax alone.
5. Inspect a clean-data replay route and public fixtures; leave the license decision to the owner. Request no inference until main supplies an exact scoped live test.

Initial pass ends here with actionable findings delivered before the requested ten-minute limit. No idle wait or repeated polling is scheduled by this reviewer. Duty remains open for incoming checkpoints until 18:50:08Z; this is not the end-of-duty verdict.

Main's follow-up identifies Franklin's corroborating report and states that `MS-ALIGNMENT-REOPENED` was posted and verified in Buzz with an actual M4 mention; acknowledgment has not yet been observed. This is main-reported coordination evidence, not independently inspected Buzz evidence and not product acceptance. Franklin's drawer/schema/apply/source-label findings match this reviewer's independent code inspection.

## 17:49:00Z to 17:50:06Z in-place lifecycle checkpoint

Scope: read-only inspection of local uncommitted proposal bridge, plus an in-memory synthetic controller reproduction executed with Node. No inference, restart, product edits, commits, or remote activity. Main reports 106 JavaScript and 24 backend tests passing; this reviewer did not rerun that suite and does not treat it as acceptance. Checkout was moving during review: initial status was behind origin by six commits; a later `rev-parse HEAD` returned `a5e8e3d42181c8b35ba17decaa8b1af5e4034aff`. Findings below identify the exact inspected functions and behavior, not a claim that every subsequent worktree state has these defects.

Positive change: `learning-paths.js:137-146` now mounts `mountLearningExperiment` inside `.learning-next` and invokes the existing adapter rather than `onImagine`/`openDrawer`. This removes the previously identified structural lab teardown on this route. Typed bounded branches and artifact binding now exist in schema/server/reducer. This is material implementation progress, not live-model acceptance. A newly owned Neo page 93 rendered the new movement reference and graph-view controls alongside Follow a question. Earlier page ownership could not be resumed, so a fresh owned page was used; other agents' tabs were left untouched. No request button was submitted.

### P1: Playback alone invalidates movement apply and undo

- Evidence: `learning-experiment.js:122,132` compares the entire serialized lab snapshot. `movement-lab.js:105-108` includes time, playing, position, velocity, acceleration and progress; lines 259-268 publish replay updates. These are ordinary playback changes, not a changed experiment definition.
- Reproduced with the actual controller and a synthetic DOM/API, using a movement proposal that changes only view from position to acceleration. Updating only replay time and derived readings before apply yields: "You changed the experiment since this request. Keep those edits. Ask again from the new version." After a successful apply, updating only replay position yields: "You edited this version after applying it. Undo will not discard those edits." The proposed view remains applied. No model was called and this is not a browser timing result.
- Consequence: the promised invitation to keep playing while waiting prevents accepting the result; the invitation to play then undo fails for movement. The existing controller tests use music and a plain setter, so they do not expose this interaction.
- Smallest fix, main + Hilbert: compare a canonical experiment-definition revision, excluding transient playback/derived fields. Preserve playback separately on apply/undo, and define exact undo over the substantive changed state. Continue rejecting actual duration/distance/shape/view edits that conflict with the proposal.
- Acceptance before live calls: with a delayed synthetic response, replay through multiple positions, receive and apply the proposal, replay again, then undo. It must restore prior experiment settings without requiring another inference. Repeat with a real parameter edit and confirm stale rejection still works.

### P1: Changed learner intention is not part of stale binding

- Evidence: `learning-experiment.js:92` captures question once, while `learning-paths.js:142` supplies only `draft.lab` to the stale comparator. Editing the question or outer explanation while inference runs does not alter that lab state. The checkbox remains selected across requests as well; this differs from the previous confirmation-invalidating path.
- Consequence: a proposal for an abandoned question remains labeled ready and can apply under newly displayed learner intent. Lab-state protection alone does not implement request-context stale rejection.
- Smallest fix, main: bind a normalized snapshot/revision of the question, relevant explanation and source context alongside the substantive lab definition. On changes, label the old proposal stale or visibly retain its original question and require an explicit decision to apply that old intent. Invalidate confirmation for a changed request context.
- Acceptance: hold a synthetic response, change only the question, resolve, and verify the old proposal cannot silently apply as the answer to the new question. Preserve both the frozen request and current draft.

### P1 product gap: Source grounding currently covers only the fixed book excerpt

- Evidence: `server.py:35-42` captures only the hardcoded Epictetus URL/Section 1 and its single sentence. Prompt text explicitly disclaims video analysis. `ideas-lab.js` adapter additionally accepts a comparison quote only when `IDEAS_SOURCE.excerpt.includes(quote)`. The reducer verifies a literal substring of indexed captured source content. This is useful mechanical quote provenance, not semantic support for the scenario, and cannot ground a YouTube excerpt.
- Consequence: a book-based scenario can now become an in-place revision activity, preserving learner words, but the required Great Books/YouTube pathway remains incomplete. A successful Epictetus test must not be counted as verified video interpretation. The adapter is also tied to Epictetus and would reject a legitimate different-source quote if the backend later adds excerpts.
- Smallest fix, main + Franklin: provide explicit source excerpts with provenance and timestamp ranges as immutable artifact content, pass them through the same indexed source contract, and make the adapter use that validated source binding rather than a second hardcoded book check. Display source identity/locator with the quote. Keep user-supplied transcript and independently inspected material distinguished.
- Acceptance: replay an actual selected lecture excerpt and a book excerpt, verify input bytes/locator, literal quote binding and a substantively source-relevant challenge. Wrong index/quote must fail without mutation. Main may later scope live tests; this reviewer made none.

### P2: Undo provenance can point at a newer job

- Evidence: `learning-experiment.js:94` resets `currentJob` and candidate on a new request but retains `before`, `applied` and the undo button. `emit` at lines 28-29 uses the mutable current job ID. Applying proposal A, requesting B, then undoing A can therefore emit an undo attributed to B (or null while saving), although the state being undone came from A.
- Smallest fix, main: bind the undo record to its proposal/job/base artifact independently of the current request. Clear or explicitly preserve that record when starting B, with correct lineage.
- Acceptance: synthetic A apply, B request, A undo before and after B finishes; the undo event must identify A in both cases.

Additional acceptance limitation: apply currently changes the draft and emits an event; it does not itself create an immutable applied artifact. The UI truthfully says to keep a version afterward. Demonstrate apply -> keep -> reopen with correct proposal lineage before claiming real artifact delivery. The current preview is a raw JSON field difference, not an audible/graphical preview; review its comprehensibility in the integrated browser before treating the preview gate as complete.

Bounded verdict: the old no-bridge finding is being addressed, but fix the playback/stale-context defects before spending live inference on end-to-end acceptance. The three-pathway promise, source grounding and empirical timing gates remain open. Main retains integration and merge ownership.

## 17:51:42Z to 17:52:50Z pushed checkpoint 4f79967

Verified HEAD `4f79967` with `a5e8e3d` and merged PR 6 `d4bd0e2` in history. Worktree was clean except this review directory. Read current controller and integration; ran `node --test tests/learning-experiment.test.mjs`: three synthetic tests pass. Main's 108-JS/24-backend report remains separately attributed. No inference or restart performed by this reviewer.

**Still hold end-to-end live acceptance on the two P1 lifecycle findings.** The full-snapshot comparisons remain in apply/undo, so the prior movement replay reproduction still applies to this inspected controller. Question/explanation context still is not included in stale comparison. A new synthetic no-model reproduction on this checkout confirms the question-only defect: request "Make the ending descend", change only the question to "Keep my original melody; change only tempo", then apply. The last MIDI note changes to 55 and status reports "Change applied." The displayed new intention did not invalidate the old change.

The P2 undo job-attribution finding is addressed by inspection: the controller now records `candidateJobId` and `appliedJobId`, and apply/undo events explicitly use the latter. It also catches adapter apply/undo errors and retains status. This is narrower than full lifecycle acceptance; the checked-in three controller tests do not cover movement replay or changed question context.

Desktop: owned BrowserOS Neo page 94, `/?actor=agent_review&path=music`. Waited for `.music-lab`, inspected accessibility and screenshots. The merged build exposes per-key Play buttons, editable MIDI pitches/beats, tempo, attack graph and phrase controls. Opening Follow a question and Explore this question with Astra retains the same visible lab in the accessibility tree and adds the in-place consent/request panel. The final request remains disabled with consent unchecked. No question was submitted and no synthetic result was represented as live output.

P2 desktop friction: the expanded phrase editor and lower question/request panel require substantial vertical navigation; at the captured desktop viewport the request area and piano/playback controls are not visible together. Immediately after opening the panel, even its new request controls are below the screenshot's lower edge. This is better than teardown, but weak evidence for a fluid desktop loop. Smallest fix: place the question/status/proposal region alongside the active lab or retain compact playback controls while reviewing, and reveal the newly opened region without losing access to play. Acceptance: in the intended desktop viewport, open request/preview, adjust or replay the lab, apply and undo without repeatedly scrolling between distant controls. This observation is agent visual QA, not a human usability result or measured latency.

The book-only captured excerpt and hardcoded ideas adapter remain unchanged at this checkpoint. No fresh-clone/public-fixture/live-output evidence was added by this pass. Next useful checkpoint is the substantive-state/context stale fix plus a movement replay -> apply -> replay -> undo regression, followed by a desktop synthetic integrated run of all three paths.

## 17:53:39Z local lifecycle fix review

Inspected main's uncommitted changes to `learning-experiment.js`, `learning-paths.js` and controller tests after `4f79967`. Ran the six controller regressions together with movement model/adapter tests: **21 tests passed**. These are synthetic/local checks, not live inference, browser latency, or learner evidence.

The two previously reported P1 defects are addressed for the tested cases. `experimentDefinition` now compares only duration/distance/shape/compare_shape/view for movement. Apply/undo preserve current elapsed time clamped to the target duration and pause playback; the real movement adapter recomputes derived readings. This is exact restoration of the experiment definition, intentionally not restoration of the historical playback clock. The delayed replay -> apply -> replay -> undo regression and conflicting-parameter regression pass. Request context now binds question, explanation and source refs; changed-question responses cannot apply, changes while saving are rejected, and each submitted request consumes consent. Retain the explicit definition-versus-playback distinction in acceptance language.

Residual P2 confirmation gap: the new `contextChanged` hook is called from the outer question and explanation inputs, but the lab `onChange` callback still only updates `draft.lab` and local storage. Ideas video URL/timestamp/note inputs call the lab update path (`ideas-lab.js:186`), so changing source refs after checking consent does not uncheck it. The later context comparison protects an already pending proposal; it does not invalidate the pre-submit checkbox because requestContext is captured afresh at click. Smallest fix: compare relevant source/request context in the lab callback and call contextChanged only when that context changes, not on movement frames. Acceptance: check consent, edit source URL/timestamp/note, and verify submission is disabled until reconfirmed; playback alone must not invalidate consent.

Residual P2 ideas interaction issue by inspection: ideas still compares its full state, including helpOpen/helpSeen/sourceOpened. Merely opening a source or toggling authored help during inference can reject an otherwise unchanged interpretive proposal; browsing help after apply can prevent undo. Separate source/learner content from reading-navigation metadata as done for movement, while preserving actual text/source edits. Add a synthetic ideas open-help/source -> apply -> browse -> undo case before calling all-three-path lifecycle acceptance complete.

Bounded verdict: retire the specific movement replay and changed-question P1 findings for this local fix, subject to integration. The source-consent and ideas navigation cases, desktop layout, source breadth, real-output execution, artifacts/replay and measurements remain open. No new paid/model calls or product edits by this reviewer.

## 17:57:18Z actual music output and local P2 fix check

Read the terminal stored job `06864f01-6af0-4db6-bda2-242f3a305d44`, its `input.json`, `result.json`, `invocation.json`, and matching `data/state.json` record. This was main's assigned live call, not a call made by this reviewer. Status is succeeded; trace is `tr-2755a5ea4a711c1b2a0cbbdb7e0beaa8`; reported usage is 16,205 input tokens and 814 output tokens; cost is null. The frozen source artifact is `cbf24a46-393f-4d36-b55f-41e48c855a7e`, explicitly agent_review, with original notes 60/64/67/72 at two beats each, tempo 100 and attack 0.4.

**Actual model proposal meets this assigned musical request.** Independently ran the stored result through `validateExperimentProposal`, `proposedLabState`, and `musicSchedule`, with assertions rather than relying on main's report. The first three pitch/beat pairs remain exact; the final high C is replaced with MIDI 64 then 60, at two and four beats; tempo and attack remain exact. The last scheduled tone lasts 2.2 seconds versus 1.1 seconds for the preceding tones, and total phrase schedule is seven seconds. Frozen input is unchanged; stored state result/input match the job files. The model explicitly leaves the subjective feeling of a settled ending open and does not claim playback or learner outcomes.

This changes the evidence assessment: there is now one actual Astra output containing a substantive executable musical variation, not merely atmosphere/narration. Browser delivery is still unverified: this pass did not resume a proposal, hear it, apply/undo it, or save/reopen the resulting artifact. It does not close movement, ideas, unexpected-request breadth, timing, or fresh-clone gates.

Local P2 changes: `experimentDefinition('ideas')` excludes helpOpen/helpSeen/sourceOpened and restoration preserves current navigation flags. The lab callback compares source refs plus raw YouTube URL/timestamp/note, including invalid drafts, and calls contextChanged when those change. This addresses both prior P2 findings by inspection. Ran the updated controller tests: seven pass, including the ideas definition separation check. Full integrated ideas browse/apply/undo and source-checkbox browser checks remain to be demonstrated; seven unit checks are not a complete all-three-path lifecycle result.

Next check on main's supplied resume link: confirm original four-note artifact, preview the stored actual five-note proposal without mutation, explicitly apply, verify per-key and phrase playback initiation plus seven-second schedule, undo to the original four notes, and save/reopen the applied version with correct job lineage. No additional model calls are authorized to this reviewer.

## 18:02:17Z to 18:02:59Z independent actual-output browser replay

Owned Neo page 97 opened main's exact music artifact plus `experiment=06864f01-6af0-4db6-bda2-242f3a305d44` resume URL. Waited for the proposal controls. Initial accessibility state showed the original four keys C4/E4/G4/C5, two beats each, and a proposed Notes difference. No automatic apply occurred; model-request consent remained unchecked and Ask Astra disabled.

Clicked Try this change: the same music lab showed five keys C4/E4/G4/E4/C4, with four beats on the last C. Clicked Hear my version: page text and screenshot showed "Playing your saved phrase settings: 5 notes at 100 BPM, 0.4 s attack." Clicked Undo this change: accessibility state returned to four keys C4/E4/G4/C5, two beats each, with attack 0.4 and the proposal available again. This is independently executed browser replay of an actual stored model output, not a synthetic output or a fresh inference.

Read local event records in this window: apply `d3e4854e-5bf4-485f-adea-bdc827df7826` at 18:02:26.618581Z carries exact four-to-five before/after state and the correct job ID; play `f9fd5d22-42f5-4bb4-a135-c63bf4086657` at 18:02:36.973636Z contains the five-note state and seven-second schedule; ended event `ee4d65dc-9a48-4f5c-9fd9-4c21125ab734` is at 18:02:44.020128Z; undo `821b746f-578d-42fa-bd42-2904691135bc` at 18:02:49.550417Z carries the correct job and exact original state. All relevant action payloads declare agent_review. Main was also testing in its own tab during this window, and the app shares a browser session ID across tabs; event timestamps/state corroborate the observed sequence but are not authenticated per-reviewer/tab attribution. Do not label these learner results.

**Music's bounded actual-output preview/apply/playback-initiation/undo case now passes independent desktop replay.** No audible-quality judgment, measured output latency, human learning, or uninterrupted live-inference claim is made. The current preview is a descriptive state difference; no separate pre-apply audio audition was tested. Main retains apply-save/reopen lineage work. This one-path result does not waive movement, sourced Great Books/YouTube, desktop fluidity, fresh-clone/public replay or timing gates.

## 18:32:46Z isolated visual checkpoint 5617ffe

Verified `/tmp/astral-visual-review-20260910` is clean at `5617ffec7e4b229a9dbb6a8fd30395c76b05ad14`. Opened owned Neo tabs 111 (root, then music) and 112 (fresh direct movement route) against port 5196. Main reports model executable `/usr/bin/false`; no inference attempted. Do not attribute these findings to M4's newer unpushed piano/boxing integration.

### Environment blocker: entry cannot boot the app in this isolated checkout

- Route/repro: open `http://127.0.0.1:5196/?actor=agent_review`, click Play Runaway. The opening disappears and the old forest landing remains at "Preparing your school..."; no music lab appears.
- Evidence: browser resource timing reports `/vendor/three/three.module.js` HTTP 404 while app.js/world.js/learning-paths.js return 200. The isolated checkout has no `node_modules/three/build`. `server.py:969-970` serves that URL from that directory. This prevents the static app import from completing; the separate opening module still runs.
- Classification: missing review-environment dependency, not proof that the product's lab fails after documented setup. It is nevertheless the observed first-entry result in this environment. Reviewer left checkout/dependencies untouched under exclusive-doc ownership.
- Smallest fix, main/setup owner: install the locked dependencies for the isolated server and recheck the vendor module response, then reload the same tabs. Do not spend inference to diagnose it.
- Acceptance: module returns 200, selected/direct pathway actually mounts, no permanent Preparing screen, then repeat keyboard and first-play checks.

### P1 keyboard entry: focus leaves the opening for hidden underlying UI

- Route/repro: fresh owned tab to `http://127.0.0.1:5196/?actor=agent_review&path=movement`. Opening initially focuses Play Runaway. Press Tab four times: active element is the underlying `A` with aria-label "Astral School home", outside `.movie-opening`, while the opening still covers the screen. At three Tabs focus passed through BODY/browser chrome.
- Evidence: read activeElement via page Runtime.evaluate after actual keyboard events. Accessibility tree also exposes the underlying header/main controls along with the opening. `movie-opening.js:6-12` creates a section and focuses the first button but neither makes underlying content inert nor scopes keyboard focus.
- Consequence: keyboard users lose visible focus and can activate hidden navigation. This defect does not depend on the new piano/boxing adapters.
- Smallest fix, M4 entry owner: use a modal dialog or equivalent inert-background/focus lifecycle. Restore prior focus on dismissal. Keep the three choices keyboard accessible without reaching obscured controls.
- Acceptance: Tab/Shift+Tab remain on visible opening choices, Enter selects one, and focus lands on an actionable control in the selected scene; no hidden header control receives focus.

### P2 direct routes: first entry ignores an explicit pathway

- Route/repro: a new tab with `?actor=agent_review&path=movement` shows the three-world chooser instead of directly entering movement. `movie-opening.js:14` exempts only artifact links, not `path`. Opening state is per-tab sessionStorage, so an already tested tab can hide this defect.
- Consequence: a direct link adds an unnecessary choice and initially focuses the unrelated Play Runaway destination. This persists independently of which instrument is integrated.
- Smallest fix, M4 entry owner: bypass the chooser for a recognized explicit pathway; show it for root/unknown destinations. Preserve artifact routing.
- Acceptance: fresh tabs for each of music/movement/ideas enter the requested scene, while root offers three choices.

### Visual evidence and remaining limits

Captured opening screenshot at the browser's current desktop size, then a fresh direct-route opening with device metrics explicitly set to 1440x900. The opening is substantially lighter: three large illustrated choices and roughly 15 visible words including the brand, title and route labels, below the proposed instruction-word threshold. The pictures are navigation buttons, not playable instruments. Those counts therefore establish reduced opening clutter, not meaningful play within ten seconds or a 90% whole-product reduction. No 1920x1080 playable-scene screenshot was possible before the boot blocker was resolved.

Code-only follow-up to verify after boot: `music-scene.js:26-32` changes pitch/rhythm with arrow keys but does not audition the changed note; only Enter/Space and pointer release invoke note playback. The mounted music module in this checkpoint still represents the phrase exercise, so Play Runaway is a stronger promise than the inspected delivery. Do not count it as teaching the song. Check the new actual instrument/reference journey after M4 publishes it. Movement/ideas in-scene interaction and all-three-path visual acceptance remain untested in this isolated pass.

This bounded pass reports the boot blocker and two reproducible entry defects immediately. Review remains available for a dependency-ready/pushed checkpoint until 18:50:08Z; no idle wait, Buzz access, model call, or product edit was performed.

## 2026-09-10T18:46:00Z: actual game checkpoint b3f4c6f

Agent review, not human feedback or learner results. Stopped the isolated 5196 baseline review as requested. HEAD independently reads b3f4c6f. Owned Neo tabs 115 (root), 116 (music), 117 (movement), 118 (ideas) loaded 127.0.0.1:5188 at 1440x900. Tab 122 loaded localhost:5188 with separate origin storage for fresh ideas entry, without clearing shared drafts. Tab 118 also inspected at 1920x1080. Screenshots are in the browser tool record. Existing 127.0.0.1 drafts include earlier agent QA work, so a new tab there is not a clean learner state. Working-tree piano/schema/server edits and untracked runaway-opening.js appeared during this pass; these newer changes are NOT covered by the committed-code conclusions below. No inference invoked.

### P0: foreground piano still disconnected from the bounded music operation

- Evidence: committed experiment-proposal.js validates music as attack, notes, tempo and projects those fields onto the lab. Committed song-lab.js maintains the real instrument in a separate practice object and preserves that object when the variation changes. piano-scene.js renders practice events. The foreground instrument can therefore stay unchanged while Apply changes the collapsed variation. Earlier five-note proposal evidence does not fulfill the newly explicit Runaway goal.
- Consequence: the appealing new foreground scene can again become independently authored play beside Astra rather than play changed through Astra. This is a product/schema gap, not a failed model test.
- Smallest aligned fix, main orchestration plus instrument owner: introduce a bounded, explicit practice-target operation with source-backed scope, preview, apply and exact undo in the foreground scene. Preserve the learner's original performance. Do not merely relabel the variation as song teaching.
- Acceptance: record an attempt, ask for a concrete next Runaway practice step, inspect stored actual proposal, preview its difference, apply and play that difference in the visible piano scene, then undo exactly while retaining the attempt. Reject unsupported song knowledge honestly. Latest uncommitted Runaway work needs this independent check.

### P1: Listen does not supply the promised reference in this browser

- Route/repro: 127.0.0.1:5188/?actor=agent_review&path=music, choose Play Runaway, click Listen. Neo 116 screenshot and accessibility tree show YouTube's "This video is unavailable" inside the scene. The rendered iframe is youtube-nocookie.com/embed/Bm5iA4Zupek?autoplay=0. An external official-video link remains available.
- Consequence: "Listen. Find the first sound." has no functioning in-scene example in this environment. An instrument and a broken embedded reference do not establish actual song learning.
- Classification: verified playback/embed failure here; underlying provider, embedding or environment cause undiagnosed. This does not establish that the linked recording is globally unavailable or incorrectly attributed. External playback and audible quality were not verified.
- Smallest fix, main reference owner: verify the artist source and usable opening segment; make the fallback clear and preserve easy return to the same attempt. Provide a rights-appropriate reference route that actually works in the target browser, not an invented transcription.
- Acceptance: on a clean origin, hear the correct reference, return to the same playable keyboard, make and replay an attempt, compare with the reference. Record external-only fallback separately from in-scene playback.

### P1: ideas has local play, but source-driven scene change remains unproven

- Correction to the interim report: Neo 118 resumed an existing QA draft and showed the concept map, then a source passage and text editor. That is not fresh entry. Neo 122 on localhost begins with two people and an umbrella, roughly ten scene words and two scene actions. A CDP pointer click at the observed umbrella center changed the caption from "Two strangers. One umbrella." to "The rain stays. You make room." and exposed source/continuation controls. The first high-level ref click did not change state; direct browser pointer input did, so do not classify that tool result as an application failure.
- Committed ideas-lab.js labels this an imagined/authored story and toggles a fixed offer_shelter/return_umbrella state. The model proposal instead changes modelComparison prose. Neo 118's "Enter Astra's new situation" opens a text scenario and Compare/Keep-my-view controls, not a changed umbrella scene. The linked lecture UI explicitly states no video or transcript is fetched, verified or analyzed.
- Consequence: genuine no-form local story interaction is now present. It still does not establish the mandatory sourced Great Books/YouTube interpretation causing a playable change through Astra. Source text quotation validation is valuable, but not a substitute for this causal link or wider source support.
- Smallest aligned fix, main ideas owner: let a bounded source-grounded proposal change a visible decision in the current story, retain exact source passage/locator and original learner words, and support refusal/disagreement without forcing a canned interpretation.
- Acceptance: choose a passage and a real supplied lecture excerpt with provenance, make an unexpected interpretation/request, inspect the actual stored operation, apply a visibly different playable choice/consequence, retry and undo. No claim of analyzing a URL alone.

### P2: explicit direct routes still add the unrelated chooser

- Fresh owned tabs for all three ?path= destinations, including localhost:5188/?actor=agent_review&path=ideas, showed the three-world chooser with Play Runaway initially focused. An explicit path is not honored as direct first entry.
- Smallest fix, M4 entry owner: bypass chooser for recognized path values while keeping it for root; preserve artifact/replay links.
- Acceptance: new tabs for music, movement and ideas mount their requested scene without another route choice; root still offers all three.

### Verified improvements and remaining evidence limits

- All three actual labs mounted on 5188. The 5196 missing-three-module blocker does not apply here.
- Opening focus trap improved: four real Tabs from root entry left focus on a visible movement choice, not the hidden header. Committed opening code now makes background inert and cycles choices. This closes the previously reproduced forward-Tab escape for the tested route, not every dialog accessibility case.
- Boxing is genuinely playable in scene. Clicking Try the exchange without movement produced "You stayed inside reach. Try leaving earlier." and 4.0 units inside reach. Retry plus a held Left key visibly moved the boxer; completed feedback was "You escaped. Now find your way back in." The recorded scrubber and retry remain in scene. This establishes local consequence/retry, not Crawford-specific technique, physical skill acquisition or Astra-driven adaptation. Background-tab animation timing is unsuitable for a latency measurement.
- The opening and foreground piano/boxing are substantially less text-heavy. Hidden advanced details should not be counted as initially visible prose. Ideas uses only the upper portion of the desktop, with extensive unused lower space; its comparison/editor remains a small scrolling panel even at 1920x1080. A numeric 90% whole-product reduction has not been measured.
- Piano pointer interaction was exercised; no audible listening-quality verdict is possible from screenshots. No measured event-to-frame/audio p95 under 100ms was collected. No inference-during-play test was run against these latest scenes. No new paid/model calls were made.
- Fresh clone, empty-data reproducibility, replay/public fixture completeness and license remain separate open gates in this review. License selection belongs to the owner. Reported test counts and comparative event/winner claims are not acceptance authority.

Checkpoint verdict: substantial visual and direct-play progress, but not all-three-path product acceptance. Highest next checks are the foreground Runaway operation/reference, actual boxing proposal apply/play/undo with attempts preserved, and source-grounded ideas scene adaptation. Preserve this finding list when newer uncommitted changes are integrated; retest rather than assuming they close it.

## 2026-09-10T18:57:43Z: final closure and write-stop

The review duty window ended at 2026-09-10T18:50:08Z. This administrative closure follows main's explicit finalization request; no further browser interaction, model call or product investigation was performed. Independent findings remain scoped to inspected checkpoint b3f4c6f and the observations recorded above, not the latest build.

Main reports that checkpoint 87b1372 reduces controls and that Hilbert verified actual typed boxing model apply/play/undo. These are attributed implementation/reviewer reports, not independently repeated acceptance by this agent. They update the handoff: boxing's typed lifecycle now has reported verification elsewhere; it should not be represented as wholly untested. This reviewer has not inspected 87b1372 or its evidence and does not extend the b3f4c6f verdict to it.

Final independent verdict: meaningful visual and local-play progress, but the complete product promise is not established by this review. Foreground music and ideas linkage through Astra remain open, as main also confirms. The reference playback failure and unmeasured latency, latest-scene inference continuity, reproducibility/public-fixture and owner-license gates retain their recorded evidence limits. This is agent review, not human feedback, learner outcomes or a comparative winner claim.

Review complete. WRITE-STOP: ownership work on this document is concluded. No further writes, browser/model calls, polling or scheduled duty work will be performed under this expired assignment. No product edits, commits or remote updates were made by this reviewer.
