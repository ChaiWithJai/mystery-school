import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from companion import Companion, MODEL, Problem, allowed, local_url, make_gateway, validate_attempt

ATTEMPT={'session_id':'test-session','attempt_id':'test-attempt','state_version':1,'pathway':'movement','actor_kind':'agent_review','tracking_confidence':0.9,'observations':[{'id':'movement-1','fact':'Simulated movement began 0.2 seconds after the cue.','source_kind':'simulation'}]}
def completion(request):return {'model':MODEL,'choices':[{'message':{'content':'{"cue_id":"replay","evidence_ids":["movement-1"]}'}}],'usage':{'prompt_tokens':40,'completion_tokens':12}}

class CompanionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.service=Companion('t'*40,'http://127.0.0.1:5188','http://127.0.0.1:8080',self.temp.name,model_request=completion)
    def tearDown(self):self.temp.cleanup()
    def test_unit_loopback_and_route_boundary(self):
        for value in ('https://example.org','http://127.0.0.1@evil.example','http://127.0.0.1/path'):
            with self.assertRaises(ValueError):local_url(value)
        self.assertFalse(allowed('GET','/api/diagnostics'));self.assertFalse(allowed('POST','/api/references'))
    def test_unit_rejects_duplicate_evidence_and_bad_confidence(self):
        bad=copy.deepcopy(ATTEMPT);bad['observations']*=2
        with self.assertRaises(Problem):validate_attempt(bad)
        bad=copy.deepcopy(ATTEMPT);bad['tracking_confidence']=float('nan')
        with self.assertRaises(Problem):validate_attempt(bad)
    def test_integration_selection_is_grounded_durable_and_idempotent(self):
        calls=[]
        def model(body):calls.append(body);return completion(body)
        self.service.model_request=model
        result=self.service.coach(copy.deepcopy(ATTEMPT));again=self.service.coach(copy.deepcopy(ATTEMPT))
        self.assertEqual(result,again);self.assertEqual(len(calls),1)
        self.assertEqual(result['model'],MODEL);self.assertEqual(result['evidence_ids'],['movement-1'])
        events=[json.loads(line) for line in (Path(self.temp.name)/'coach-trajectory.jsonl').read_text().splitlines()]
        self.assertEqual([e['event'] for e in events],['coach.request','model.request','model.response','coach.completed'])
        self.assertEqual(events[1]['request'],calls[0]);self.assertEqual(events[-1]['result']['attempt_id'],'test-attempt')
    def test_unit_cache_is_invalidated_by_companion_revision(self):
        calls=[]
        def model(body):calls.append(body);return completion(body)
        self.service.model_request=model
        first=self.service.coach(copy.deepcopy(ATTEMPT))
        self.service.build='new-revision'
        second=self.service.coach(copy.deepcopy(ATTEMPT))
        self.assertNotEqual(first['request_id'],second['request_id']);self.assertEqual(len(calls),2)
    def test_integration_low_tracking_does_not_call_model(self):
        self.service.model_request=lambda _:self.fail('must not call model')
        attempt=copy.deepcopy(ATTEMPT);attempt['tracking_confidence']=0.2;attempt['observations'][0]['source_kind']='camera_estimate'
        result=self.service.coach(attempt)
        self.assertEqual(result['provider'],'deterministic');self.assertIsNone(result['model'])
    def test_integration_rejects_invented_evidence_and_wrong_model(self):
        for result in ({'model':MODEL,'choices':[{'message':{'content':'{"cue_id":"replay","evidence_ids":["invented"]}'}}]}, {'model':'other-model','choices':[{'message':{'content':'{}'}}]}):
            self.service.model_request=lambda _,result=result:result
            with self.assertRaises(Problem):self.service.coach(copy.deepcopy(ATTEMPT))
        self.assertIn('coach.failed',(Path(self.temp.name)/'coach-trajectory.jsonl').read_text())
    def test_integration_busy_rejects_without_queueing(self):
        self.service.gate.acquire()
        try:
            with self.assertRaises(Problem) as error:self.service.coach(copy.deepcopy(ATTEMPT))
            self.assertEqual(error.exception.status,429)
        finally:self.service.gate.release()
    def test_acceptance_private_http_cue_flow(self):
        server=make_gateway(self.service,0);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        url=f'http://127.0.0.1:{server.server_port}/api/coach'
        try:
            with self.assertRaises(HTTPError) as error:urlopen(Request(url,data=json.dumps(ATTEMPT).encode()),timeout=3)
            self.assertEqual(error.exception.code,401);error.exception.close()
            request=Request(url,data=json.dumps(ATTEMPT).encode(),headers={'Authorization':'Bearer '+'t'*40,'Content-Type':'application/json'})
            with urlopen(request,timeout=3) as response:result=json.load(response)
            self.assertEqual(result['status'],'completed');self.assertEqual(result['state_version'],1)
        finally:server.shutdown();server.server_close();thread.join()
