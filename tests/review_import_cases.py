"""Real HTTP/MLflow import checks; all source records are labeled synthetic."""
import copy
from unittest.mock import patch

from server import App


class ReviewImportChecks:
    def envelope(self, event_id):
        return {'source_system': 'synthetic-test', 'source_event_id': event_id, 'observed_at': '2026-09-10T11:35:00Z',
                'source_channel_id': None, 'source_url': None, 'synthetic': True,
                'actor': {'role': 'evaluator_sidecar', 'identity': 'synthetic-verifier'},
                'review': {'round_id': 'SYNTHETIC-01', 'repo_sha': '7ec7324e1f81efc0ae453467fecea95732eeb611',
                           'finding_type': 'NEXT', 'claim': 'Synthetic draft check', 'evidence': 'Synthetic browser observation',
                           'pass_condition': 'All four fields survive reopen'},
                'events': [{'type': 'tool', 'content': 'Synthetic input value read'}, {'type': 'conclusion', 'content': 'Synthetic pass'}],
                'runtime_usage': None}

    def traces(self, record):
        return self.app.tracing.client.search_traces([self.app.tracing.experiment_id],
               filter_string="tags.`astral.review_import_id` = '" + record['id'] + "'")

    def test_import_readback_dedup_conflict_and_lineage(self):
        source = self.envelope('dedup')
        status, record = self.request('/api/imported-reviews', source)
        self.assertEqual(status, 200, record)
        self.assertEqual(record['source'], source)
        self.assertEqual(record['status'], 'synced')
        self.assertNotEqual(record['imported_at'], source['observed_at'])
        trace = self.app.tracing.client.get_trace(record['trace_id'])
        root = trace.data.spans[0]
        self.assertEqual(root.inputs['source'], source)
        self.assertEqual(root.attributes['astral.source_type'], 'CODE')
        self.assertEqual(root.attributes['astral.actor_role'], 'evaluator_sidecar')
        self.assertNotIn('mlflow.chat.tokenUsage', root.attributes)
        self.assertGreater(root.start_time_ns, 0)
        _, samples = self.request('/api/samples')
        sample = next(s for s in samples if s['id'] == record['id'])
        self.assertIsNone(sample['usage'])
        self.assertIsNone(sample['cost_usd'])
        self.assertIsNone(sample['runtime_usage'])
        self.assertIn('IMPORTED AGENT REVIEW', sample['title'])
        self.assertEqual(sample['trace_id'], record['trace_id'])
        self.assertEqual(self.request('/api/imported-reviews', source), (200, record))
        self.assertEqual(len(self.traces(record)), 1)
        changed = copy.deepcopy(source)
        changed['review']['claim'] = 'Changed source'
        self.assertEqual(self.request('/api/imported-reviews', changed)[0], 409)
        self.assertEqual(self.request('/api/imported-reviews/' + record['id']), (200, record))
        child = self.envelope('verification')
        child['review']['parent_review_id'] = record['id']
        self.assertEqual(self.request('/api/imported-reviews', child)[0], 200)
        self.assertEqual(App(self.temp.name).imported_reviews.get(record['id']), record)

    def test_failure_before_export_then_retry(self):
        source = self.envelope('unavailable')
        with patch.object(self.app.tracing.client, 'start_trace', side_effect=RuntimeError('Synthetic unavailable')):
            self.assertEqual(self.request('/api/imported-reviews', source)[0], 503)
        failed = next(r for r in self.app.imported_reviews.get() if r['source']['source_event_id'] == 'unavailable')
        self.assertEqual(failed['status'], 'failed')
        self.assertIn('Synthetic unavailable', failed['error'])
        status, record = self.request('/api/imported-reviews', source)
        self.assertEqual(status, 200, record)
        self.assertEqual(record['source'], source)
        self.assertEqual(record['imported_at'], failed['imported_at'])
        self.assertEqual(len(self.traces(record)), 1)

    def test_failure_after_completed_export_does_not_duplicate(self):
        source = self.envelope('lost-readback')
        with patch.object(self.app.tracing.client, 'get_trace', side_effect=RuntimeError('Synthetic lost readback')):
            self.assertEqual(self.request('/api/imported-reviews', source)[0], 503)
        failed = next(r for r in self.app.imported_reviews.get() if r['source']['source_event_id'] == 'lost-readback')
        self.assertEqual(len(self.traces(failed)), 1)
        status, record = self.request('/api/imported-reviews', source)
        self.assertEqual(status, 200, record)
        self.assertEqual(record['trace_id'], failed['trace_id'])
        self.assertEqual(len(self.traces(record)), 1)

    def test_failure_during_end_resumes_same_trace(self):
        source = self.envelope('end-failure')
        with patch.object(self.app.tracing.client, 'end_trace', side_effect=RuntimeError('Synthetic interrupted completion')):
            self.assertEqual(self.request('/api/imported-reviews', source)[0], 503)
        failed = next(r for r in self.app.imported_reviews.get() if r['source']['source_event_id'] == 'end-failure')
        self.assertIsNotNone(failed['trace_id'])
        status, record = self.request('/api/imported-reviews', source)
        self.assertEqual(status, 200, record)
        self.assertEqual(record['trace_id'], failed['trace_id'])
        self.assertEqual(len(self.traces(record)), 1)

    def test_reported_usage_is_source_data_not_aggregate(self):
        source = self.envelope('usage')
        source['runtime_usage'] = {'model': 'explicitly-reported-test-model', 'input_tokens': 12,
                                   'output_tokens': None, 'cost_usd': None, 'reported_by': 'synthetic-provider'}
        status, record = self.request('/api/imported-reviews', source)
        self.assertEqual(status, 200, record)
        sample = next(s for s in self.app.samples() if s['id'] == record['id'])
        self.assertEqual(sample['runtime_usage'], source['runtime_usage'])
        self.assertIsNone(sample['usage'])
        trace = self.app.tracing.client.get_trace(record['trace_id'])
        self.assertNotIn('mlflow.chat.tokenUsage', trace.data.spans[0].attributes)

    def test_bad_timestamp_actor_and_caller_import_time_rejected(self):
        for field, value in [('observed_at', 'not-a-date'), ('imported_at', '2026-09-10T00:00:00Z'),
                             ('actor', {'role': 'human', 'identity': 'synthetic'})]:
            source = self.envelope('invalid-' + field)
            source[field] = value
            self.assertEqual(self.request('/api/imported-reviews', source)[0], 400)
        source = self.envelope('negative-usage')
        source['runtime_usage'] = {'input_tokens': -1}
        self.assertEqual(self.request('/api/imported-reviews', source)[0], 400)
