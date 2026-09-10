"""Exercise real gateway selection with deterministic model responses, no inference."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import companion
from boxing_coach import load_foundations

ATTEMPT={'session_id':'s1','attempt_id':'a1','state_version':7,'pathway':'movement','actor_kind':'agent_review','tracking_confidence':.9,'foundation_id':'feet','observations':[{'id':'o1','fact':'I noticed my feet in the replay.','source_kind':'learner_report'}]}

class FoundationCompanionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.requests=[];self.cue='practice'
        def model(request):
            self.requests.append(request)
            return {'model':companion.MODEL,'choices':[{'message':{'content':json.dumps({'cue_id':self.cue,'evidence_ids':['o1']})}}]}
        self.service=companion.Companion('x'*40,'http://localhost:1','http://localhost:2',self.temp.name,model_request=model)
    def tearDown(self):self.temp.cleanup()
    def test_each_foundation_supplies_its_own_curated_practice_and_reflection(self):
        data,digest=load_foundations()
        for lesson in data['foundations']:
            attempt={**ATTEMPT,'foundation_id':lesson['id']}
            result=self.service.coach(attempt);prompt=json.loads(self.requests[-1]['messages'][1]['content'])
            self.assertEqual(prompt['available_cues'],{'practice':lesson['practice']['cue'],'reflection':lesson['assessments'][0]['prompt']})
            self.assertEqual(result['cue'],lesson['practice']['cue']);self.assertEqual(result['foundation_id'],lesson['id'])
            self.assertEqual(result['curriculum_sha256'],digest);self.assertEqual(prompt['curated_foundation']['curriculum_sha256'],digest)
            self.assertEqual(result['state_version'],7);self.assertEqual(result['attempt_id'],'a1')
            if lesson['practice']['sourceIds']:
                self.assertTrue(any(s['cue']==result['cue'] for s in result['source_refs']))
            else:self.assertEqual(result['cue_kind'],'authored_reflection')
            self.assertEqual(prompt['curated_foundation']['gaps'],lesson['gaps'])
    def test_unknown_and_nonmovement_foundations_fail_before_model(self):
        for attempt in [{**ATTEMPT,'foundation_id':'invented'},{**ATTEMPT,'foundation_id':None},{**ATTEMPT,'pathway':'music'},{**ATTEMPT,'pathway':'ideas'}]:
            with self.assertRaises(companion.Problem) as error:self.service.coach(attempt)
            self.assertEqual(error.exception.status,400)
        self.assertEqual(self.requests,[])
    def test_cannot_escape_to_old_other_foundation_or_unapproved_cues(self):
        for cue in ['replay','repeat','coordination','A','B','invented']:
            self.cue=cue
            with self.assertRaises(companion.Problem) as error:self.service.coach(copy.deepcopy(ATTEMPT))
            self.assertEqual(error.exception.status,502)
        self.cue='reflection';result=self.service.coach(copy.deepcopy(ATTEMPT))
        self.assertEqual(result['cue_kind'],'reflection')
        self.assertEqual(result['cue'],companion.foundation_context('feet')['reflection'])
    def test_cache_identity_tracks_curriculum_content_and_not_just_foundation_id(self):
        one=self.service.coach(copy.deepcopy(ATTEMPT));self.service.coach(copy.deepcopy(ATTEMPT));self.assertEqual(len(self.requests),1)
        data,digest=load_foundations();data=copy.deepcopy(data);data['foundations'][1]['assessments'][0]['prompt']='What did you notice in your own movement?'
        with patch.object(companion,'load_foundations',return_value=(data,'changed-source-hash')):
            two=self.service.coach(copy.deepcopy(ATTEMPT))
        self.assertNotEqual(one['request_id'],two['request_id']);self.assertEqual(len(self.requests),2)
        records=[json.loads(line) for line in (Path(self.temp.name)/'coach-trajectory.jsonl').read_text().splitlines()]
        prompt=json.loads([r for r in records if r['event']=='model.request'][-1]['request']['messages'][1]['content'])
        self.assertEqual(prompt['curated_foundation']['curriculum_sha256'],'changed-source-hash')
    def test_low_tracking_is_still_deterministic_and_preserves_source_metadata(self):
        attempt=copy.deepcopy(ATTEMPT);attempt['tracking_confidence']=.2;attempt['observations'][0]['source_kind']='camera_estimate'
        result=self.service.coach(attempt)
        self.assertEqual(self.requests,[]);self.assertEqual(result['status'],'insufficient_tracking');self.assertEqual(result['foundation_id'],'feet');self.assertTrue(result['source_refs'])
