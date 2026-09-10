import copy
import json
from pathlib import Path
import tempfile
import unittest
from boxing_coach import build_boxing_coach_context, load_foundations


class BoxingCoachTests(unittest.TestCase):
    def setUp(self):
        self.artifact = {'id': 'qa-frozen-artifact', 'pathway': 'movement', 'state': {'lab': {
            'boxing_mirror': {'lessonId': 'ghDNbod8B3s', 'reflection': 'I noticed my exit.',
                'practiceRounds': [{'id': 'round-1', 'durationMs': 40000, 'points': [{'x': .4, 'y': .5}],
                                    'status': 'elapsed', 'depthMeasured': True}],
                'observations': [{'id': 'observation-1', 'reflection': 'My exact words.', 'reportedTried': True}]}}}}

    def test_context_preserves_words_and_separates_evidence(self):
        before = copy.deepcopy(self.artifact)
        result = build_boxing_coach_context(self.artifact, 'feet')
        self.assertEqual(result['learner_evidence']['reflection'], 'I noticed my exit.')
        self.assertEqual(result['learner_evidence']['observations'][0]['reflection'], 'My exact words.')
        self.assertFalse(result['learner_evidence']['verified_learning'])
        self.assertNotIn('points', result['learner_evidence']['practice_rounds'][0])
        self.assertFalse(result['learner_evidence']['practice_rounds'][0]['depth_measured'])
        self.assertEqual(self.artifact, before)
        self.assertEqual(len(result['metaphors']), 1)
        self.assertEqual(len(result['curriculum_sha256']), 64)
        result['foundation']['title'] = 'changed'
        self.assertNotEqual(build_boxing_coach_context(self.artifact, 'feet')['foundation']['title'], 'changed')

    def test_unknown_or_wrong_context_is_rejected(self):
        for value, foundation in [({}, 'feet'), (self.artifact, 'invented')]:
            with self.assertRaises(ValueError):
                build_boxing_coach_context(value, foundation)
        malformed = copy.deepcopy(self.artifact)
        malformed['state'] = ['not a state']
        with self.assertRaises(ValueError):
            build_boxing_coach_context(malformed, 'feet')

    def test_source_gaps_and_no_pose_inferences_survive(self):
        result = build_boxing_coach_context(self.artifact, 'eyes_head')
        self.assertTrue(result['foundation']['gaps'])
        self.assertIn('torque', result['coaching_contract']['never_infer_from_pose'])
        self.assertEqual(result['coaching_contract']['demo_duration_seconds'], 40)

    def test_invalid_prerequisites_are_rejected(self):
        data, _ = load_foundations()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'curriculum.json'
            data['foundations'][0]['prerequisiteIds'] = [data['foundations'][0]['id']]
            path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, 'Cyclic'):
                load_foundations(path)
            data['foundations'][0]['prerequisiteIds'] = ['missing']
            path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, 'Missing'):
                load_foundations(path)


if __name__ == '__main__':
    unittest.main()
