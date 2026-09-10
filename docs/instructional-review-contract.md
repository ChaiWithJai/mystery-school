# Instructional review contract

## Current delivery gates — fluid play and a reproducible build

Jai's 13:50 Buzz correction rejects the earlier prototype-readiness verdict. Fixed widgets with narration are insufficient. The following gates govern review of the next committed implementation; **they are unverified until checked against its new SHA**. Passing unit tests or the earlier three-path scripts does not establish these qualities. M5 owns the active product implementation; this contract does not describe those uncommitted changes as shipped.

1. **Immediate play:** each path offers a meaningful action immediately, with a visible or audible consequence and no introductory wall or mandatory explanation. Inspect the first screen at 1080×592. The experience should feel like entering a game, with readable controls and a clear next action.
2. **Measured local response:** measure elapsed time from an actual local input to its corresponding visible/audio state update under stated conditions. Report samples and method, not an invented latency target or the claim “instant.” Separate local interaction latency from model latency and record noticeable stalls.
3. **Astra changes playable behavior:** a learner's request produces a bounded, inspectable change they can preview, apply and undo. Inspect what the change can affect and demonstrate the consequence in the running experience. A generated explanation, cosmetic atmosphere change or predetermined widget sequence alone does not meet this gate.
4. **Play continues during inference:** while a real request is pending, demonstrate that existing controls remain usable and responsive, with clear pending/error state. Preserve the current creation. A simulated wait checks UI mechanics only and cannot establish live Astra responsiveness.
5. **Unexpected intent matters:** try a specific, previously unprescribed learner request and record it verbatim. Show how the result visibly changes the experience in service of that intent. If a request exceeds supported boundaries, explain those boundaries and offer an honest actionable alternative; do not silently funnel every request into the same scripted result.
6. **All three promises remain honest:** music/calculus, movement/physics and sourced personal understanding each retain care → try → needed concept → own artifact → sharing response → new question. Identify which playable edits work in each path; do not use one impressive path to imply support in the others.
7. **Reproducible GitHub delivery:** identify the committed SHA, install/start commands, required configuration and exact reproduction steps, plus artifact/trace references. Distinguish local uncommitted demonstrations from the delivered build. A fresh checkout must reproduce the claimed interaction; do not declare completion from screenshots of an unavailable working tree.

Lead the review with observed interaction quality and these delivery results, then report supporting tests. A successful check is specific to its SHA and conditions. Record unsupported and untested behavior explicitly; the prior static-prototype pass is not a pass on these gates.

Review the artifact a person can make, change and return to. Mystery School delivers **all three** connected pathways: Maya's music/calculus, Andre's movement/physics and Leena's Great Books/YouTube account of understanding. [Issue #2](https://github.com/ChaiWithJai/mystery-school/issues/2) defines the experience; [#1](https://github.com/ChaiWithJai/mystery-school/issues/1) defines inspectable provenance. Earlier proposals that defer two paths or substitute gears do not define completion.

The circle is **care → try → needed concept → own artifact → sharing response → new question**. The person's desire survives every step. Maya wants a song for her grandmother; Andre wants to understand a reach with his training partner; Leena wants an account she can explain to a friend. Characters are fictional composites. Unheard knowing, Guarded hope and Restless invention describe situations a person may encounter, not diagnoses or fixed ability groups.

## First inspect the experience

Open each `/?path=music|movement|ideas&actor=agent_review` route. Read that notation as three separate URLs. Inspect at 1080×592 and a larger viewport. The first screen should invite a visible action: play/change a sound, move/scrub a marker, or select and shape a thought orb. A wall of instructions, repeated introductions or a prerequisite questionnaire defeats the current design even when the underlying controls work.

Keep the universe visible and let explanations appear where needed. Essential controls must remain discoverable, keyboard operable and legible; progressive reveal must not hide the way forward. Try the experiment before expanding optional guidance. Preserve the option to disagree, keep an unchanged account or express an idea through sound, movement, drawing, pointing, speech or text. Note facilitator assistance where native capture is absent. Do not add a mandatory exam to an exploratory pathway.

For each path, change something, add your own explicitly synthetic annotation, save, reveal the labeled staged response, revise or retain the artifact and save a new question. Close the panel; use its forest marker to reopen the exact saved version. Open the exact-version URL in a fresh browser context. Compare the restored state with the version you saved, including original/revised words and source references. An exact link should restore that version, not silently substitute the latest draft.

## Check one meaningful relationship per pathway

These are optional changed-case review probes, not required learner gates. They check domain grounding, **not the new playable-Astra gates above**. Offer a prediction before revealing the result when testing instructional opportunity. Match fixtures to the actual committed model and controls, including any applied edit; do not rewrite product behavior to fit stale test data.

| Path | Change and expected relationship | Inspectable artifact and boundary |
|---|---|---|
| Music/calculus | Keep the actual C4/E4/G4/C5 phrase pitches fixed; change linear attack from 0.2 to 0.4 seconds. The normalized envelope rises 0→1, so its interior slope changes from 5 to 2.5 amplitude units/s. | Saved attack and musical choice; audible output and visible envelope. This is synthesized sound, not a recorded piano. Envelope slope is neither pitch nor perceived loudness. Do not assert a derivative at piecewise corners or confuse the envelope with the oscillating waveform. |
| Movement/physics | Hold distance/displacement at 0.4 m and shape fixed; change duration 2→4 seconds. Average velocity changes 0.2→0.1 m/s. At equal normalized phase the cubic/quintic models halve instantaneous velocity and quarter acceleration. For the cubic midpoint, position stays 0.2 m and velocity changes 0.3→0.15 m/s. | Saved duration, shape, inspected instant and annotation. Label meters/seconds and simulation assumptions. Endpoints alone do not establish instantaneous motion or impact force. The cubic's join to rest has an acceleration discontinuity. |
| Books/YouTube/understanding | Preserve a first interpretation of Epictetus, *Enchiridion* §1, Elizabeth Carter translation. Offer an explicitly authored alternative; apply the staged unfair-rule question; retain a revision or reasoned disagreement. | Two learner-owned accounts linked to the actual [section](https://classics.mit.edu/Epictetus/epicench.html). Distinguish source content, paraphrase, interpretation and inference. The passage does not uniquely settle activism versus passivity. A supplied YouTube URL/time/note is an unverified reference until someone inspects its content; syntactic link validity is not source verification. |

The current implementation lives in `public/music-lab.js`, `public/movement-lab.js`, `public/ideas-lab.js` and `public/learning-paths.js`. Inspect those files before applying numeric fixtures from older documents. For an actual text-accuracy verdict, inspect the cited source rather than treating this contract as its substitute.

## Separate three levels of evidence

**UI function:** A control changed state, a save succeeded, an exact link restored it, or a trace appeared. This establishes software behavior. A synthetic script supplying the correct explanation is still a software check.

**Learning opportunity:** A person can make a consequential choice, encounter a useful relationship, inspect its effect, seek targeted help and revise their own artifact. A fresh case is available without its answer being supplied first. This establishes that the design offers a coherent opportunity; it does not establish that a person learned.

**Observed learning:** An actual learner attempts a changed case, explains or demonstrates the relationship in a suitable form, and their assistance and prior attempt are recorded. Report the narrow observed capability. Fluency, compliance, attractive animation, time spent and agreement with the model are not substitutes. Retention, transfer beyond that case and comparative learning gains require additional evidence; never infer them from a staged demo.

## Leave a useful, bounded review

Record the commit/build, route, action, expected versus observed result, artifact IDs, trace IDs, source anchor and assistance. Inspect linked event IDs for relevant focus/help/panel actions; distinguish current events from unrecoverable older draft history. Keep agent review, staged peer response and real learner observation separate. Unknown model usage/cost remains unknown. Imported reviews must distinguish source publication time from import time and link finding → correction → verification where available.

Return status for each path: **observed pass**, **observed failure**, **not observed**, or **unsupported**. Attach a screenshot/readback where it matters. For a failure, propose the smallest correction and one reproducible retest; do not restart alignment or invent another approval gate. Stop repeating checks once the changed behavior and relevant regression pass. Report remaining gaps plainly rather than averaging an absent path into success.
