# Open-ended learner requests

Agent QA on September 10, 2026, against the image-consent implementation pushed
as `96a9c73`. No participants were involved. Each request was confirmed in the
browser with saved images and notebook notes excluded. Two calls, no retries.

| Probe | Job | Trace | Input tokens | Output tokens |
| --- | --- | --- | --- | --- |
| Spanish kite request | `2d0708c7-8ccd-4b15-b8f1-cbda1780262c` | `tr-3f27565f6d377064ee23c4346b56ffb0` | 15,164 | 758 |
| Basketball request | `8c3c5bc1-7c21-4a20-906a-d34edb2b912d` | `tr-b5fbed59a908fd85618647da1dcb9b9c` | 15,166 | 622 |

Dollar cost was not reported. Reasoning tokens, where separately reported,
are not added to output tokens. These counts exclude build and review agents.

## Requests and observed responses

Kite: "Quiero hacer una cometa con mi prima. Puedo dibujar mi idea.
¿Por dónde empezamos?"

The returned Spanish response preserves making a kite with the cousin. It asks
for a drawing with a center line and introduces symmetry. It states that flight
requires construction and testing. It does not turn English proficiency into
a prerequisite or claim that the forest has tested a kite.

Basketball: "I want to understand my basketball bounce. Let me try something
first and tell me one thing to notice."

The response proposes three gentle dribbles in a clear, level space and asks
whether return height stays consistent. It labels dribbling as an assumption
and permits another experiment. It does not claim measured results.

Both outputs label imagined scenery. An agent reviewed these particular
responses against the bounded Buzz probes. The review is not a calibrated judge,
a benchmark score, evidence of instruction in practice, or proof of learning.

## Observed defect

The browser used `actor=agent_review`, but the general projection request at
`96a9c73` did not propagate the actor into job input or sample metadata. The exact
IDs above are agent-generated QA. Their historical inputs must remain unchanged.
Do not infer human authorship from the missing field. The correction must apply
to future requests and leave omitted historical provenance unknown.

The correction now captures the current request actor before asynchronous work,
validates it in the backend, and includes it in job input and sample metadata.
Regression tests cover an agent-QA request, a declared visitor request, invalid
values and absent legacy fields. The model probes above were not rerun to
manufacture new historical provenance.

The image checkbox did clear confirmation when toggled, and both captured
requests excluded images and notebook notes. Uploads were preserved locally.
