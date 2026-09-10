"""Local school -> private gateway integration; model responses are fixtures."""
import json
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request,urlopen
from companion import Companion,make_gateway,model_usage
from server import make_server
from test_companion import ATTEMPT,completion

class LocalCoachTests(unittest.TestCase):
    def test_usage_preserves_unknowns_and_maps_reported_counts(self):
        self.assertEqual(model_usage({'prompt_tokens':40,'completion_tokens':12}),{'input_tokens':40,'output_tokens':12,'total_tokens':None})
        self.assertEqual(model_usage({'prompt_tokens':0}),{'input_tokens':0,'output_tokens':None,'total_tokens':None})
        self.assertIsNone(model_usage({'prompt_tokens':True,'completion_tokens':-1}))
    def test_school_same_origin_route_reaches_authenticated_gateway(self):
        with tempfile.TemporaryDirectory() as data:
            service=Companion('s'*40,'http://127.0.0.1:5188','http://127.0.0.1:8080',data,model_request=completion)
            gateway=make_gateway(service,0);school=make_server(None,0)
            threads=[threading.Thread(target=s.serve_forever,daemon=True) for s in (gateway,school)]
            for thread in threads:thread.start()
            origin=f'http://127.0.0.1:{school.server_port}'
            def request(origin_header):
                req=Request(origin+'/api/coach',data=json.dumps(ATTEMPT).encode(),headers={'Content-Type':'application/json','Origin':origin_header})
                try:response=urlopen(req,timeout=3)
                except HTTPError as error:response=error
                with response:return response.status,json.load(response)
            try:
                with patch.dict('os.environ',{'MYSTERY_COMPANION_TOKEN':'s'*40,'MYSTERY_COMPANION_LOCAL_URL':f'http://127.0.0.1:{gateway.server_port}'}):
                    status,result=request(origin);self.assertEqual(status,200);self.assertEqual(result['attempt_id'],ATTEMPT['attempt_id']);self.assertEqual(result['usage']['input_tokens'],40)
                    self.assertNotIn('s'*40,json.dumps(result));self.assertEqual(request('https://untrusted.example')[0],403)
                    service.gate.acquire()
                    try:self.assertEqual(request(origin)[0],429)
                    finally:service.gate.release()
                with patch.dict('os.environ',{'MYSTERY_COMPANION_TOKEN':''}):self.assertEqual(request(origin)[0],503)
            finally:
                for server in (school,gateway):server.shutdown();server.server_close()
                for thread in threads:thread.join()
