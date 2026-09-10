"""Real MLflow traces, stored separately from durable application records."""
import mlflow
from mlflow import MlflowClient
from mlflow.entities import AssessmentSource, AssessmentSourceType

APP_CAPTURE_SCOPE = (
    "One accepted app event or saved reflection and its submitted payload, server timestamp, "
    "and persistence outcome. This is not a model call or continuous browser recording."
)
PROJECTION_CAPTURE_SCOPE = (
    "One Codex CLI subprocess: submitted project data and attached reference IDs, CLI JSONL "
    "stdout events, stderr, server observation timestamps, reported token usage, final JSON, "
    "validation and process outcome. Raw stdout/stderr are saved locally; API text is limited "
    "to the last 200000 characters per stream. MLflow event spans are exported at job completion; "
    "their span durations are export time, not model or tool execution time. This does not "
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

    def start(self, name, inputs):
        scope = PROJECTION_CAPTURE_SCOPE if name == "astra.projection" else APP_CAPTURE_SCOPE
        attributes = {"astral.capture_scope": scope, "astral.cost_source": "unreported; no pricing estimate"}
        if self.build_id:
            attributes["astral.build_id"] = self.build_id
        span = self.client.start_trace(name=name, inputs=inputs, attributes=attributes,
                                      experiment_id=self.experiment_id)
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
        assessment = mlflow.log_feedback(
            trace_id=trace_id, name="review_note", value=annotation["note"],
            source=AssessmentSource(source_type=AssessmentSourceType.HUMAN, source_id="local-reviewer"),
            rationale=annotation.get("quote", ""),
            metadata={"annotation_id": annotation["id"], "message_id": annotation.get("message_id", "")},
        )
        return assessment.assessment_id
