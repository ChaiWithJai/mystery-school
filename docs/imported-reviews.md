# Explicit evaluator review import

`POST /api/imported-reviews` accepts one selected review envelope. `GET /api/imported-reviews` lists import status; `GET /api/imported-reviews/{id}` reads one record. This does not change POST `/api/samples`, which still selects existing samples. Import only deliberately selected observable review material; this endpoint does not crawl Buzz, GitHub, private conversations or learner uploads.

Required envelope fields:

- `source_system`, `source_event_id`: stable source identity, deduplicated as a pair.
- `observed_at`: ISO timestamp with timezone, preserved as supplied source data.
- `actor`: `{ "role": "evaluator_sidecar", "identity": "declared producer" }`.
- `review`: `round_id`, exact 40-character `repo_sha`, `finding_type`, `claim`, `evidence`, `pass_condition`.
- `runtime_usage`: null when unavailable, otherwise only explicitly reported fields. No estimation or inferred model name.

Optional: `source_channel_id`, `source_url`, `synthetic`; up to 30 `events` with type task/tool/result/conclusion and content; optional review `parent_review_id` linking an existing imported finding, or source sample/trace IDs. The JSON schema lives in `imported_reviews.py` and rejects unknown fields. Runtime usage can preserve model, invocation ID, input/output/cached/reasoning/total counts, cost and reporting source; missing fields stay missing. It is retained as source data and deliberately excluded from aggregate token/cost metrics to avoid counting a prior model call twice.

The server assigns `imported_at`; a caller cannot override it. The source envelope and its digest remain immutable. Exact retries return the original record; altered content with the same source identity returns 409. Submit a new event ID for a correction and link its `parent_review_id`. A client may retry a collection one envelope at a time; there is no batch transaction API.

A successful response has `status: synced` only after MLflow readback. The trace is explicitly `sidecar.imported_review`, with CODE source attribution, evaluator role and producer attributes. It is an imported review, not a fabricated live LLM span or a human feedback assessment. Source tool events remain observable content inside the imported envelope; their durations are not invented. Trajectory Studio receives a sample headed IMPORTED AGENT REVIEW and a distinct agent-review heading. Human acceptance, if any, must be separately attributed; it does not rewrite this source.

## Failure and retry scope

The source is atomically persisted before export. An export or readback exception returns 503 and keeps a failed record with the error. Retry the identical envelope. A completed trace is recovered by its deterministic import-ID tag; interrupted same-process completion resumes the known trace ID. Retries do not issue another model call or count the source as new usage.

This store assumes one local application process, matching the existing file-backed backend. If the process dies with an uncompleted MLflow root span, MLflow may not permit that lost in-memory span to be resumed. The record then stays visibly failed and requires reconciliation; the importer will not knowingly create a second trace. Cross-process ingestion, authenticated producer attestation, automatic secret redaction, and full crash recovery are not established by this change. Source actor identity is declared, not authenticated.

Tests use synthetic records with real HTTP, file persistence and MLflow: exact readback, unchanged retries, conflicting source, lineage, unknown/reported usage without aggregate inflation, rejected caller import time and malformed timestamp, failure before trace creation, interruption during completion, and lost readback after completed export.
