# Mystery School working agreement

Jai's current priorities are a fluid, game-like desktop experience and clean,
reproducible GitHub delivery. Passing tests is evidence about tested machinery,
not a verdict on either priority. Preserve all three pathways and the learner's
desire through making, response and revision. Read `docs/instructional-review-contract.md`.

## Work that accelerates delivery

- Identify the current pushed SHA and active file owners before editing. M5 is
  maincar; isolated sidecar changes go through a concrete PR. Do independent
  work while awaiting a checkpoint; do not invent its behavior or receipt.
- Make a bounded change, reproduce the affected interaction, inspect the
  screenshot and actual trace, then deliver. Reopen a passed check only for a
  changed implementation, a new failure, or a specific uncovered requirement.
- Keep narrative and administrative UI out of the learner's way. Unexpected
  intent must change the playable artifact; fixed widgets plus narration do
  not establish the new preview/apply/undo and continuous-play requirements.
- Use existing tools and stack: vanilla JS/Three.js, Python, Playwright, MLflow.
  No framework migration, additional telemetry service, background model worker
  or browser MCP installation follows merely from a skill example.
- Keep source, generated proposal, learner changes and evaluator evidence
  distinct. Use `actor=agent_review` in automated walkthroughs. Never call
  staged responses real collaboration or report clicks as learning.

## Installed skills

Project-local skills are in `.agents/skills/`, pinned with their references and
MIT license. See `.agents/README.md` and `.agents/source-lock.json`.

- `frontend-ui-engineering`: apply visual hierarchy, real controls, focus,
  responsive and error-state checks to our existing modules; React examples
  are illustrative, not a dependency request.
- `browser-testing-with-devtools`: use existing isolated browser automation
  and actual screenshots/network evidence. DevTools MCP is optional. Start
  with `npm run review:experience`; it records a narrow baseline, not full UX
  acceptance. Read and report untested gates explicitly.
- `observability-and-instrumentation`: map intent, proposed change, apply,
  undo and saved version to questions answered by existing events and MLflow.
  Verify actual emitted records; a `trace_id` alone is insufficient.
- `doubt-driven-development`: available **on explicit request**, not an
  automatic prerequisite. Its own exclusions cover requests prioritizing
  speed. If invoked, read it fully, honor its bounded stop conditions, and
  disclose its cross-model choice requirements. Installation does not launch
  reviews, model CLIs, or recursive workers. Do not claim to have run it when
  only doing a normal code review.

## Delivery evidence

Run `npm run skills:verify` to check the pinned Markdown subset. Run affected
tests and `npm run check`. For browser-facing work, use the review command and
inspect its PNGs at the user's viewport. Record the SHA, source hashes, dirty
files, browser version, observed outcomes and limitations. `--require-clean`
rejects modified and nonignored untracked files; unpublished editor work cannot pass as a
reproducible GitHub build. No test command here authorizes a model request.

For uncertain cross-module claims, a bounded fresh reviewer may receive only
the changed artifact and the relevant contract, without the author's verdict.
Return concrete failure/reproduction/fix entries; no ceremonial extra rounds.
Apply user direction and actual tool permissions over generic skill examples.
