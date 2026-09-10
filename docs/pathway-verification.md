# Three-pathway checkpoint

Date: September 10, 2026. Producer: main Codex builder and assigned agents.
Evidence kind: agent-run functional verification, not participant feedback.

## Delivery and alignment

Jai requires all three pathways in issue 2. M4 acknowledged the same scope in
MS-ROLE-CONTRACT-001 and MS-TASKS-ACK. Main integrated M4's isolated test-spec
commit 77c59d0 as a61db75. The test specification keeps its original unrun status;
the observed runs below are separate records.

M5 workers built music, movement, ideas, and shared persistence in parallel.
M4 independently verified the prior commit and supplied changed-case probes.
M4 also reproduced correction-draft loss. Main's local fix keys drafts by
parent trajectory and retains the correction note as well as question,
prediction and premise. BrowserOS Neo verified the four exact edited values
after closing Imagine, visiting References, and reopening. No model was called.

## Saved walkthroughs

All notes explicitly identify agent QA rather than learner evidence. Each chain
contains an attempt, a staged response, a changed revision, and a next question.
The API retains the goal and source references throughout the chain.

The first browser runs used the visitor interaction actor `user_action`, with
agent QA declared in their notes. That historical mismatch is retained, not
silently rewritten. New automated walkthroughs must use
`?path=PATH&actor=agent_review`; the page displays that recording mode. A later
browser regression saved an `agent_review` attempt and a separate
`staged_peer_response`, then reopened the response visibly. New versions also
retain the current circle stage. Review annotations now require an explicit
actor choice or retain `unspecified`, and text edits preserve that choice.

| Pathway | Final artifact ID | Final trace ID |
| --- | --- | --- |
| Music | `ac993df7-50ac-4bf1-a9ae-bc5e047bf2ff` | `tr-75cde984d52b23e5904c6713e7f78821` |
| Movement | `ddeb945e-edb7-4656-81bc-35fdf47216db` | `tr-639fdab9daaa8c9c7c9fa1c5b899cf81` |
| Ideas | `093dda9c-09e7-4430-af77-a5acc2c3ba88` | `tr-343431806a7beed4cc670fd35224f5f5` |

Open `/?path=PATH&artifact=ID` on port 5188 to replay a saved version.
Open `/review.html?sample=ID` to inspect its recorded content. Records live in
the local data directory, not Git. Other machines can repeat the workflow with
their own records but cannot replay these IDs without an explicit data transfer.

`node scripts/verify_pathways.mjs` passed on the running server. It checks each
parent chain, changed artifact, staged actor, trace reference, source links,
review sample, and exact GET replay. It is read-only and fails on a fresh clone
until a labeled QA walkthrough exists for each path.

## Relationship checks

- Music uses a linear normalized amplitude attack. At 0.2 s its slope is 5/s;
  at 0.4 s it is 2.5/s. Pitch and the four-note sequence stay fixed. The API
  walkthrough changed 0.35 s to 0.60 s after the staged grandmother question.
- Movement keeps distance at 0.4 m. At the midpoint, doubling cubic duration
  from 2 s to 4 s changes velocity from 0.3 to 0.15 m/s. The later revision
  changes to quintic motion and preserves the response and explanation.
- Ideas preserves the first interpretation separately from the revision.
  The inspected source is Epictetus, Enchiridion section 1, Elizabeth Carter
  translation at MIT's Internet Classics Archive. The competing reading and
  unfair-rule question are authored suggestions, not source quotations.

## Boundaries and remaining checks

- Audio scheduling and playback controls are tested. An agent cannot certify
  what a person heard or preferred through a screenshot.
- Shared responses are staged. Nothing is sent to a grandmother, partner or
  friend, and multi-user delivery is not implemented.
- A saved source URL does not prove its claims. YouTube content analysis and
  transcript verification must not be claimed from a link alone. Leena can
  attach a YouTube URL, an explicit timestamp and her own note. Only allowed
  HTTPS video domains and valid timestamps produce an outbound link. The
  source remains labeled as an unverified user reference.
- Deterministic interactions are not new Astra model calls. Existing actual
  Astra runs have separate capture evidence in verification.md.
- M4 still needs to inspect the integrated commit. Agreement on scope does not
  count as that review or as a participant study.
- No observed work establishes learning efficacy, spiritual authority,
  consciousness, or a trained personal model.
