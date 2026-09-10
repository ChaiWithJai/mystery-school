"""Explicit, bounded review imports; source records are never rewritten on retry."""
import copy
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import jsonschema

CAPTURE_SCOPE = ("Explicitly imported observable evaluator review. Source observed_at is not execution time; "
                 "MLflow spans measure import/export only. No hidden reasoning, inferred model identity, "
                 "unreported usage, or human judgment is captured. Reported runtime usage is source data, "
                 "not an additional model call or aggregate token usage.")
TEXT = {"type": "string", "minLength": 1, "maxLength": 8000}
NULL_TEXT = {"type": ["string", "null"], "maxLength": 2048}
SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["source_system", "source_event_id", "observed_at", "actor", "review", "runtime_usage"],
    "properties": {
        "source_system": {"type": "string", "pattern": "^[a-zA-Z0-9_.-]{1,80}$"},
        "source_event_id": {"type": "string", "minLength": 1, "maxLength": 300},
        "source_channel_id": NULL_TEXT, "source_url": NULL_TEXT,
        "observed_at": {"type": "string", "format": "date-time"},
        "actor": {"type": "object", "additionalProperties": False, "required": ["role", "identity"],
                  "properties": {"role": {"const": "evaluator_sidecar"}, "identity": TEXT}},
        "review": {"type": "object", "additionalProperties": False,
                   "required": ["round_id", "repo_sha", "finding_type", "claim", "evidence", "pass_condition"],
                   "properties": {"round_id": TEXT, "repo_sha": {"type": "string", "pattern": "^[0-9a-fA-F]{40}$"},
                                  "finding_type": TEXT, "claim": TEXT, "evidence": TEXT, "pass_condition": TEXT,
                                  "parent_review_id": TEXT, "source_sample_id": NULL_TEXT, "source_trace_id": NULL_TEXT}},
        "events": {"type": "array", "maxItems": 30, "items": {"type": "object", "additionalProperties": False,
                   "required": ["type", "content"], "properties": {"type": {"enum": ["task", "tool", "result", "conclusion"]},
                   "content": TEXT, "observed_at": {"type": "string", "format": "date-time"}}}},
        "runtime_usage": {"type": ["object", "null"], "additionalProperties": False,
                          "properties": {"model": NULL_TEXT, "invocation_id": NULL_TEXT,
                          **{k: {"type": ["integer", "null"], "minimum": 0} for k in
                             ("input_tokens", "output_tokens", "cached_input_tokens", "reasoning_tokens", "total_tokens")},
                          "cost_usd": {"type": ["number", "null"], "minimum": 0},
                          "reported_by": NULL_TEXT}},
        "synthetic": {"type": "boolean"},
    },
}


class ImportErrorResponse(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class ReviewImports:
    def __init__(self, path, tracing, atomic_json, lock):
        self.path, self.tracing, self.write, self.lock = Path(path), tracing, atomic_json, lock
        self.records = json.loads(self.path.read_text()) if self.path.exists() else []

    def get(self, record_id=None):
        with self.lock:
            if record_id is None:
                return copy.deepcopy(self.records)
            record = next((r for r in self.records if r['id'] == record_id), None)
            if record is None:
                raise ImportErrorResponse(404, "Imported review not found")
            return copy.deepcopy(record)

    def save(self):
        self.write(self.path, self.records)

    def ingest(self, source):
        try:
            jsonschema.validate(source, SCHEMA, format_checker=jsonschema.FormatChecker())
            for timestamp in [source['observed_at']] + [e['observed_at'] for e in source.get('events', []) if 'observed_at' in e]:
                parsed = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                if parsed.tzinfo is None:
                    raise ValueError('observed_at must include a timezone')
            canonical = json.dumps(source, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
        except (jsonschema.ValidationError, ValueError, TypeError) as exc:
            raise ImportErrorResponse(400, "Invalid review import: " + str(exc).split('\n')[0])
        if len(canonical.encode()) > 100 * 1024:
            raise ImportErrorResponse(413, "Review import exceeds 100KB")
        key = hashlib.sha256(json.dumps([source['source_system'], source['source_event_id']]).encode()).hexdigest()
        digest = hashlib.sha256(canonical.encode()).hexdigest()
        with self.lock:
            record = next((r for r in self.records if r['id'] == 'review-' + key), None)
            if record:
                if record['source_sha256'] != digest:
                    raise ImportErrorResponse(409, "Source event already exists with different content; use a new event ID")
            else:
                parent = source['review'].get('parent_review_id')
                if parent and not any(r['id'] == parent for r in self.records):
                    raise ImportErrorResponse(400, "parent_review_id must identify an existing imported review")
                record = {'id': 'review-' + key, 'source': copy.deepcopy(source), 'source_sha256': digest,
                          'imported_at': datetime.now(timezone.utc).isoformat(), 'capture_method': 'imported',
                          'capture_scope': CAPTURE_SCOPE, 'actor_kind': 'agent_review', 'source_type': 'CODE',
                          'trace_id': None, 'status': 'pending', 'error': None}
                self.records.append(record)
                try:
                    self.save()
                except Exception:
                    self.records.remove(record)
                    raise
            if record['status'] != 'synced':
                try:
                    self.export(record)
                    record.update(status='synced', error=None)
                    self.save()
                except Exception as exc:
                    record.update(status='failed', error=str(exc))
                    self.save()
                    raise ImportErrorResponse(503, 'Review source preserved; trace export/readback failed. Retry the same envelope. ' + str(exc))
            return copy.deepcopy(record)

    def export(self, record):
        client = self.tracing.client
        # A completed export can survive a lost response or failed local status write.
        matches = client.search_traces([self.tracing.experiment_id],
                    filter_string="tags.`astral.review_import_id` = '" + record['id'] + "'", max_results=2)
        if len(matches) > 1:
            raise RuntimeError('Multiple matching import traces; manual reconciliation required')
        if matches:
            record['trace_id'] = matches[0].info.trace_id
            trace = client.get_trace(record['trace_id'])
            if not trace.data.spans or trace.data.spans[0].inputs.get('source') != record['source']:
                raise RuntimeError('Existing import trace source mismatch; reconciliation required')
            if trace.data.spans[0].outputs == {'imported_review_id': record['id'], 'source_sha256': record['source_sha256']}:
                return
            # Resume only this known trace. If its in-memory root was lost on process
            # restart, MLflow may refuse completion; leave a visible retry error,
            # never manufacture a second trace for the same source event.
        if not record['trace_id']:
            span = client.start_trace('sidecar.imported_review', span_type='CHAIN',
                        experiment_id=self.tracing.experiment_id,
                        inputs={'source': record['source'], 'imported_at': record['imported_at']},
                        tags={'astral.review_import_id': record['id']},
                        attributes={'astral.capture_scope': CAPTURE_SCOPE, 'astral.actor_kind': 'agent_review',
                                    'astral.actor_role': 'evaluator_sidecar', 'astral.source_type': 'CODE',
                                    'astral.producer': record['source']['actor']['identity'],
                                    'astral.source_sha256': record['source_sha256']})
            record['trace_id'] = span.trace_id
            self.save()
        client.end_trace(record['trace_id'], outputs={'imported_review_id': record['id'], 'source_sha256': record['source_sha256']})
        trace = client.get_trace(record['trace_id'])
        if not trace.data.spans or trace.data.spans[0].inputs.get('source') != record['source']:
            raise RuntimeError('Imported trace readback does not match source')

    def samples(self):
        return [{'id': r['id'], 'title': 'IMPORTED AGENT REVIEW: ' + r['source']['review']['claim'],
                 'model': 'Imported evaluator review (not a model run)', 'world': 'evaluator_sidecar',
                 'status': r['status'], 'trace_id': r['trace_id'], 'created_at': r['imported_at'],
                 'observed_at': r['source']['observed_at'], 'imported_at': r['imported_at'],
                 'capture_scope': CAPTURE_SCOPE, 'actor_kind': 'agent_review', 'producer': r['source']['actor']['identity'],
                 'usage': None, 'cost_usd': None, 'runtime_usage': r['source']['runtime_usage'],
                 'parent_review_id': r['source']['review'].get('parent_review_id'),
                 'messages': [{'id': r['id'] + ':source', 'role': 'system', 'actor_kind': 'agent_review',
                               'content': 'IMPORTED EVALUATOR REVIEW — not learner evidence or human feedback\n' + json.dumps(r, ensure_ascii=False, indent=2)}]}
                for r in self.get()]
