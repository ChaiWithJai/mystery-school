"""Real MLflow traces, stored separately from durable application records."""
import json

import mlflow
from mlflow import MlflowClient
from mlflow.entities import AssessmentSource, AssessmentSourceType, Span, TraceData

APP_CAPTURE_SCOPE = (
    "One accepted app event or saved reflection and its submitted payload, server timestamp, "
    "and persistence outcome. This is not a model call or continuous browser recording."
)
ARTIFACT_CAPTURE_SCOPE = (
    "One submitted learning artifact version: pathway, goal, state, note, source links, "
    "stage and declared actor kind, with an optional parent version. Actor kind is "
    "explicitly supplied, not inferred or verified identity. Scripted character actions, "
    "staged peer responses and agent reviews are not human learning evidence. No model call."
)
SIDECAR_CAPTURE_SCOPE = (
    "Imported observable agent review, not a live model invocation or human judgment. "
    "Only explicitly submitted input, output, events, decisions and checks are captured; "
    "no hidden reasoning or automatic conversation capture. observed_at is the source timestamp; "
    "imported_at is the server import timestamp; span duration covers envelope validation and "
    "record preparation, not source execution, disk persistence, export or retry latency. "
    "Model, usage and cost are unverified source reports, never inferred or estimated."
)
PROJECTION_CAPTURE_SCOPE = (
    "One Codex CLI subprocess: submitted project data, exact UTF-8 stdin prompt, CLI argv, "
    "and reference manifest with filenames, SHA256 and MIME. Environment and credentials "
    "are not collected. CLI JSONL "
    "stdout events, stderr, server observation timestamps, reported token usage, final JSON, "
    "validation and process outcome. Raw stdout/stderr are saved locally; API text is limited "
    "to the last 200000 characters per stream. MLflow event spans are exported at job completion; "
    "their span durations are event recording time, not model or tool execution time. This does not "
    "capture hidden reasoning, provider HTTP requests, unreported tools, or billing."
)


def normalize_usage(value):
    """Preserve reported counts; missing values remain unknown, including totals."""
    if not isinstance(value, dict) or not value:
        return None
    result = dict(value)
    for key in ("input_tokens", "output_tokens", "cached_input_tokens", "total_tokens"):
        count = result.get(key)
        result[key] = count if type(count) is int and count >= 0 else None
    return result


class Tracing:
    def __init__(self, uri, experiment="Astral School", artifact_location=None, build_id=None):
        mlflow.set_tracking_uri(uri)
        self.client = MlflowClient(tracking_uri=uri)
        existing = self.client.get_experiment_by_name(experiment)
        self.experiment_id = existing.experiment_id if existing else self.client.create_experiment(experiment, artifact_location=artifact_location)
        self.build_id = build_id

    def import_sidecar(self, record):
        """Replay a durable non-model span with stable IDs, including after process loss."""
        attributes = {"mlflow.traceRequestId": record["trace_id"], "mlflow.spanType": "EVENT",
                      "mlflow.spanInputs": record["envelope"], "mlflow.spanOutputs": {"record": record, "persisted": True},
                      "astral.capture_scope": SIDECAR_CAPTURE_SCOPE, "astral.actor_kind": "agent_review",
                      "astral.capture_method": "imported", "astral.actor_id": record["actor_id"],
                      "astral.actor_role": record["actor_role"], "astral.reviewed_sha": record["reviewed_sha"],
                      "astral.build_id": record["build_id"], "astral.cost_source": "source-reported only; no pricing estimate"}
        span = Span.from_dict_v2({"name": "sidecar.imported_review",
            "context": {"trace_id": "0x" + record["trace_id"][3:], "span_id": "0x" + record["span_id"]},
            "parent_id": None, "start_time": record["import_start_ns"], "end_time": record["import_end_ns"],
            "status_code": "OK", "status_message": "", "events": [],
            "attributes": {k: json.dumps(v, ensure_ascii=False) for k, v in attributes.items()}})
        # MLflow 3.4's span ingestion preserves caller IDs and upserts the same span;
        # start_trace/end_trace cannot recover an unfinished in-memory root after restart.
        self.client._tracing_client.log_spans(self.experiment_id, [span])
        info = self.client._tracing_client.get_trace_info(record["trace_id"])
        self.client._tracing_client._upload_trace_data(info, TraceData(spans=[span]))

    def start(self, name, inputs, start_time_ns=None):
        scope = PROJECTION_CAPTURE_SCOPE if name == "astra.projection" else APP_CAPTURE_SCOPE
        if name == "learning.artifact":
            scope = ARTIFACT_CAPTURE_SCOPE
        attributes = {"astral.capture_scope": scope, "astral.cost_source": "unreported; no pricing estimate"}
        if name == "learning.artifact":
            attributes.update({"astral.actor_kind": inputs["actor_kind"], "astral.pathway": inputs["pathway"],
                               "astral.stage": inputs["stage"]})
        if self.build_id:
            attributes["astral.build_id"] = self.build_id
        span = self.client.start_trace(name=name, inputs=inputs, attributes=attributes,
                                      experiment_id=self.experiment_id, start_time_ns=start_time_ns)
        return span.trace_id, span.span_id

    def event(self, trace_id, parent_id, event):
        span = self.client.start_span(name=event.get("type", "observable.event"), trace_id=trace_id,
                                      parent_id=parent_id, span_type="EVENT", inputs=event)
        self.client.end_span(trace_id, span.span_id, outputs=event)

    def end(self, trace_id, outputs, error=False):
        attributes = {}
        usage = normalize_usage(outputs.get("usage")) if isinstance(outputs, dict) else None
        if usage:
            attributes["astral.reported_usage"] = usage
            # MLflow's aggregate usage processing assumes complete counts. Do not let
            # it turn partial usage into a misleading zero or an incomplete total.
            if usage["input_tokens"] is not None and usage["output_tokens"] is not None:
                tokens = {key: usage[key] for key in ("input_tokens", "output_tokens")}
                tokens["total_tokens"] = usage["total_tokens"] if usage["total_tokens"] is not None else sum(tokens.values())
                attributes["mlflow.chat.tokenUsage"] = tokens
        self.client.end_trace(trace_id, outputs=outputs, attributes=attributes, status="ERROR" if error else "OK")

    def feedback(self, trace_id, annotation):
        actor_kind = annotation.get("actor_kind", "unspecified")
        producer = annotation.get("producer", "unspecified")
        source_type = {"human": AssessmentSourceType.HUMAN, "agent_review": AssessmentSourceType.CODE}.get(
            actor_kind, AssessmentSourceType.SOURCE_TYPE_UNSPECIFIED)
        assessment = mlflow.log_feedback(
            trace_id=trace_id, name="review_note", value=annotation["note"],
            source=AssessmentSource(source_type=source_type, source_id=producer),
            rationale=annotation.get("quote", ""),
            metadata={"annotation_id": annotation["id"], "message_id": annotation.get("message_id", ""),
                      "actor_kind": actor_kind, "producer": producer},
        )
        return assessment.assessment_id
