# Live foreground ideas verification

## Result and limits

One authorized actual Astra request succeeded. Its stored ideas decision scene reached the main UI through recorded resume, preview, and explicit apply. Both choices and Neither fits worked. Undo restored the prior state while preserving decision responses. A saved child reopened with an exact full lab-state match.

This was declared `agent_review` QA using explicitly synthetic learner words. It is not human learning evidence, a prediction of another person's response, or acceptance of all three pathways. No additional inference, product edit, restart, or commit was performed.

## Execution identifiers

| Record | Value |
| --- | --- |
| Date | 2026-09-10 |
| Inspected checkout | `2df25b4` |
| Backend confirmed before dispatch | `6485c6ccd23d33bb` |
| Previous backend, not used | `977a38fc144df9f1` |
| Schema SHA256 | `1353bffa711676b28099ebd121dd610bb6f801ad6fb720485769bc7dfd7131dc` |
| Source artifact | `d91c5841-c2f0-440a-9520-f040efdefbf9` |
| Source artifact trace | `tr-b021188c80009c0f9d354416e9cacbe6` |
| Artifact and request session | `agent-live-foreground-ideas-34093c30-961c-4653-a88e-381df0ecd536` |
| Actual job | `cd93f642-389d-4e72-aeb7-2f5c1c2a1403` |
| Model trace | `tr-ed7191ff58218581b40f1943f91b75b1` |
| Model | `gpt-6-astra` |
| Started UTC | `2026-09-10T19:07:48.513385+00:00` |
| Finished UTC | `2026-09-10T19:08:26.295395+00:00` |
| Elapsed | 37.782010 seconds |
| Status | `succeeded` |
| Input tokens | 16888 |
| Output tokens | 1067 |
| Cached input tokens | 0 |
| Cache write input tokens | 0 |
| Reported reasoning output tokens | 0 |
| Reported total tokens | `null` |
| Cost USD | `null`, unknown, not zero |

The API accepted exactly one POST to `/api/project`, returning HTTP 202. Diagnostics identified `codex-cli 0.153.4` at `/Applications/ChatGPT.app/Contents/Resources/codex`.

## Frozen inputs and source

The source artifact was a new ideas attempt with `actor_kind: agent_review`. Its explanation was `Synthetic words authored by the testing agent, not a learner account.` Its normalized lab contained `storyChoice: offer_shelter`, `modelComparison: null`, and empty `decisionResponses`.

The exact synthetic drafts were:

```text
[SYNTHETIC AGENT QA] I can offer care without deciding whether my friend agrees.
```

```text
[SYNTHETIC AGENT QA] I am unsure whether keeping my shelter means refusing care.
```

The artifact used the app's authentic Epictetus source reference: The Enchiridion, Elizabeth Carter translation, Section 1, at [MIT Classics](https://classics.mit.edu/Epictetus/epicench.html). The job's captured `experiment_sources[0]` contained exactly `Some things are in our control and others not.`, bound to that URL and locator. This check did not independently fetch the source page or claim broader source analysis.

The exact submitted question was:

```text
Reinterpret this disagreement in the rain as a playable shared_shelter decision: exactly choices a and b, one sharing shelter and one keeping shelter for self. Preserve my exact words. Quote Some things are in our control and others not. exactly from source index 0. Label every consequence imagined, not a prediction of another person.
```

The premise additionally required disagreeing friends in rain, both shelter states, and no automatic interpretation writing. `reference_ids` and `reflection_ids` were empty. The frozen learning artifact supplied the indexed source context.

## Stored typed result

The supported version 1 experiment was bound to the exact source artifact and pathway `ideas`. Its music and movement branches were null. Its `source_quote` matched the captured excerpt exactly, and `source_ref_index` was 0.

The actual stored `ideas.decision_scene` was:

```json
{
  "kind": "shared_shelter",
  "choices": [
    {
      "id": "a",
      "label": "Share the shelter",
      "consequence": "Model-imagined possibility: the scene places both friends beneath the shelter while their disagreement remains unresolved. This does not predict either person’s response.",
      "shelter": "shared"
    },
    {
      "id": "b",
      "label": "Keep the shelter for yourself",
      "consequence": "Model-imagined possibility: the scene keeps shelter over Leena alone, leaving open whether she offers care another way. This does not predict either person’s response.",
      "shelter": "self"
    }
  ]
}
```

The returned scenario concerned Leena and a disagreeing friend in a rainy forest clearing. It repeated both synthetic drafts verbatim. The model labeled consequences as imagined possibilities and did not claim an applied action or observed learning.

## Actual main UI checks

The [recorded resume route](http://127.0.0.1:5188/?actor=agent_review&path=ideas&artifact=d91c5841-c2f0-440a-9520-f040efdefbf9&experiment=cd93f642-389d-4e72-aeb7-2f5c1c2a1403) was opened in an owned Neo tab. These checks used the actual main renderer and controller, not a synthetic renderer mount.

1. Preview displayed the new scenario and quote without changing the lab. `modelComparison` was still null before apply.
2. Clicking Try this change opened the actual model story in the foreground. Its caption contained the returned scenario, and the buttons displayed the returned choice labels. Both drafts, `unchanged`, and authored `storyChoice` matched the pre-apply values.
3. Clicking Share the shelter set `data-shared` to true and displayed choice a's imagined consequence. The response map stored `a` under the exact normalized comparison identity.
4. Clicking Keep the shelter for yourself set `data-shared` to false and displayed choice b's consequence. The same identity now stored `b`.
5. Clicking Neither fits stored `neither` and displayed `Neither choice selected. Your words and authored story choice are unchanged.` No draft was auto-written.
6. The actual Keep a discovery and Keep this version controls saved a child with the scene and `neither` selection. Saving changed the address to the exact child version and preserved the actor query.
7. The save panel hid the next-question panel. Reopening the tools disclosure and Follow a question revealed Undo this change. Undo restored `modelComparison: null`, authored caption `The rain stays. You make room.`, and authored shared state. The prior concept-map view returned because both drafts were nonempty. Both drafts and the complete response map remained unchanged.
8. A fresh owned tab opened the saved child. The model scene returned in the foreground, Neither fits had `aria-pressed: true`, and the full normalized lab state was JSON-identical to the saved record.
9. A fresh GET confirmed the frozen source artifact remained JSON-identical to its value before inference.

The reopened desktop screenshot showed the scenario, both choices, Neither fits, and the model-imagined disclaimer. It also showed the source-book icon overlapping the comparison doorway near the upper-right. That visual issue was not fixed in this document-only lane. No mobile or comprehensive animation-quality claim is made. Continuous play during the inference interval was not tested.

## Saved version and event evidence

| Saved child field | Value |
| --- | --- |
| ID | `6cc2e41a-9d5a-4073-b19b-de95efd9d963` |
| Parent ID | `d91c5841-c2f0-440a-9520-f040efdefbf9` |
| Trace | `tr-74f873348deaa5bf5123b2278105c438` |
| Actor | `agent_review` |
| Browser session | `2334695f-a13b-4ffa-977f-597e9640a944` |
| Linked event count | 10 |
| Telemetry | `recorded`, 0 failed, 0 omitted, no unlinked draft history |

The [exact saved child](http://127.0.0.1:5188/?actor=agent_review&path=ideas&artifact=6cc2e41a-9d5a-4073-b19b-de95efd9d963) requires access to this same local app and dataset. No remote availability or authenticated identity is implied.

The following persisted events were inspected in `/api/state`. All declared `agent_review` and used the browser session above. Preview, resume, apply, and undo carried the exact job ID. Each decision event carried its comparison identity and selected choice.

| Action | Event ID | Trace ID |
| --- | --- | --- |
| Preview | `dbc29a0d-2828-47bb-bf7c-7b4192602d41` | `tr-21b373bff077270624166e81d059e58f` |
| Recorded resume | `84a466ad-d7a9-4907-ac70-64e5f978a653` | `tr-092111e013ee118d3c8b20b87bfa8fcf` |
| Apply | `d0da7dd9-d424-4655-bf29-35c0e87d9a13` | `tr-2978d1e71b569f99a3b1ab8ac851751b` |
| Choice a | `5bfdedb4-211e-4ad5-9865-58c5f5ffa540` | `tr-69fa39aa339f7d37dfdf182e37619f53` |
| Choice b | `47df2c4b-50ce-4df6-9f61-a61d263f08c8` | `tr-97c1f46e99991dec5f63998883bd217f` |
| Neither fits | `1ea82340-d493-4bff-b816-5acf4c9e7894` | `tr-4f218be5a1e97b8ba669b1c6bf324a43` |
| Undo | `db8c3604-50a3-46b5-889a-a1e635a2a2aa` | `tr-9a508ec6ed743c3a15d3b7bdebe46c43` |

The child links the preview, resume, apply, and three decision events listed above. Its other linked IDs are `743848c6-6fbd-4df4-8f3f-40f658b06a2f`, `f48fddf8-af7e-4da5-a676-1a8163c7ccb4`, `ab753f26-a8e0-491b-9901-5b28115dcf2f`, and `2ddc5f9b-53e2-4c62-b1e0-768a7f36ef2f`. Undo occurred after saving, so it is a separate persisted event and is not retroactively attached to the immutable child.

The [actual Studio job page](http://127.0.0.1:5188/review.html?sample=cd93f642-389d-4e72-aeb7-2f5c1c2a1403) displayed succeeded status and a [stored result link](http://127.0.0.1:5188/api/jobs/cd93f642-389d-4e72-aeb7-2f5c1c2a1403/artifacts/result.json). Its [MLflow link](http://127.0.0.1:5189/#/experiments/1/traces?selectedEvaluationId=tr-ed7191ff58218581b40f1943f91b75b1) selected the exact model trace. The MLflow destination itself was not inspected.

Only this document was written. The one-call allowance is exhausted. No retries were made.

## Main-builder visual follow-up

Agent QA on the working tree over `2df25b4`, reopening child `6cc2e41a-9d5a-4073-b19b-de95efd9d963`. No new inference.

The source book and comparison doorway no longer intersect. Their measured horizontal bounds were 1195.08 to 1302.84px and 1425.10 to 1490.10px. Full model scenario and question now appear under the closed `The situation` disclosure, rather than filling the main scene. The three decision buttons remain visible. Clicking Share changed `data-shared` to true and displayed the stored imagined consequence. Opening the disclosure showed the full scenario. Source and learner text remain unchanged.

The shared illustration now places both people together beneath the umbrella instead of leaving the second person outside its width. The existing model output and saved child remain unchanged. These checks do not establish human learning or predicted human behavior.
