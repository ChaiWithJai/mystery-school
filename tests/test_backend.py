"""Integration tests use real HTTP, disk, subprocesses, and MLflow, never a model."""
import base64
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image
import jsonschema
from server import (App, ACTIVE, make_server, codex_diagnostics, job_view, validate_projection,
                    captured_experiment_sources, EPICTETUS_URL, EPICTETUS_EXCERPT)
from tracing import normalize_usage


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.app = App(cls.temp.name)
        cls.server = make_server(cls.app, 0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = "http://127.0.0.1:" + str(cls.server.server_address[1])

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.temp.cleanup()

    def request(self, path, body=None):
        request = Request(self.url + path, data=None if body is None else json.dumps(body).encode(),
                          headers={"Content-Type": "application/json"})
        try:
            response = urlopen(request)
        except HTTPError as exc:
            response = exc
        with response:
            raw = response.read()
            return response.status, json.loads(raw) if response.headers.get_content_type() == "application/json" else raw

    def wait_job(self, job_id):
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            with self.app.lock:
                job = self.app.job(job_id)
                if job["status"] not in ACTIVE and job.get("finished_at"):
                    return json.loads(json.dumps(job))
            time.sleep(0.03)
        self.fail("Job did not finish")

    def project(self):
        return self.request("/api/project", {"session_id": "test-session", "question": "What could we learn?",
                                              "premise": "An imagined school", "world": "forest", "reference_ids": []})

    def test_event_and_human_review_persistence(self):
        status, event = self.request("/api/events", {"session_id": "test-session", "type": "slider.changed", "payload": {"light": 0.7}})
        self.assertEqual(status, 201)
        trace = self.app.tracing.client.get_trace(event["trace_id"])
        self.assertIn("app.slider.changed", [s.name for s in trace.data.spans])
        _, samples = self.request("/api/samples")
        sample = next(s for s in samples if s["id"] == event["id"])
        self.assertEqual(sample["model"], "app event")
        before = json.loads(self.app.path.read_text())
        self.assertEqual(self.request("/api/samples", {"samples": [{"id": event["id"], "messages": "do not overwrite"}]})[0], 200)
        self.assertEqual(before, json.loads(self.app.path.read_text()))
        annotation = {"id": "test-human-note", "sample_id": event["id"], "quote": "light", "note": "Test reviewer note",
                      "message_id": sample["messages"][0]["id"], "start": 0, "end": 5}
        status, annotations = self.request("/api/annotations", {"annotation": annotation})
        self.assertEqual(status, 200)
        self.assertNotIn("feedback_error", annotations[-1])
        self.assertTrue(annotations[-1].get("assessment_id"))
        self.assertEqual(self.request("/api/patterns", {"patterns": [{"id": "p", "label": "Test pattern", "annotation_ids": [annotation["id"]]}]})[0], 200)
        self.assertEqual(self.request("/api/suggestions", {"suggestions": [{"id": "s", "sample_id": event["id"], "quote": "light", "note": "Test suggestion", "status": "pending"}]})[0], 200)
        reopened = App(self.temp.name)
        self.assertEqual(reopened.review["annotations"][0]["note"], annotation["note"])
        self.assertEqual(reopened.review["patterns"][0]["id"], "p")
        self.assertEqual(reopened.review["suggestions"][0]["status"], "pending")
        self.assertEqual(self.request("/api/graph")[0], 200)
        self.assertEqual(self.request("/api/annotations", {"delete_id": annotation["id"]})[1], [])

    def test_annotation_actor_provenance(self):
        _, event = self.request("/api/events", {"session_id": "actor-test", "type": "test.provenance", "payload": {}})
        for declared, expected in (({"actor_kind": "agent_review", "producer": "backend-test-agent"}, "CODE"),
                                   ({"actor_kind": "human", "producer": "test-human-declaration"}, "HUMAN"),
                                   ({}, "SOURCE_TYPE_UNSPECIFIED")):
            note = {"sample_id": event["id"], "quote": "", "note": "Test provenance routing", **declared}
            status, annotations = self.request("/api/annotations", {"annotation": note})
            self.assertEqual(status, 200)
            annotation = annotations[-1]
            self.assertEqual(annotation["actor_kind"], declared.get("actor_kind", "unspecified"))
            self.assertEqual(annotation["producer"], declared.get("producer", "unspecified"))
            self.assertNotIn("feedback_error", annotation)
            trace = self.app.tracing.client.get_trace(event["trace_id"])
            assessment = next(a for a in trace.info.assessments if a.assessment_id == annotation["assessment_id"])
            self.assertEqual(str(assessment.source.source_type), expected)
            self.assertEqual(assessment.source.source_id, annotation["producer"])
            self.assertEqual(assessment.metadata["actor_kind"], annotation["actor_kind"])
            # An older client editing note text cannot erase already-declared provenance.
            _, edited = self.request("/api/annotations", {"annotation": {"id": annotation["id"], "sample_id": event["id"], "note": "Edited text"}})
            self.assertEqual(edited[-1]["actor_kind"], annotation["actor_kind"])
            self.assertEqual(edited[-1]["producer"], annotation["producer"])
            self.request("/api/annotations", {"delete_id": annotation["id"]})
        before = self.request("/api/annotations")[1]
        for invalid in ({"actor_kind": "robot"}, {"actor_kind": None}, {"producer": 12}, {"producer": "x" * 201}):
            status, _ = self.request("/api/annotations", {"annotation": {"sample_id": event["id"], "note": "Test invalid actor", **invalid}})
            self.assertEqual(status, 400)
        self.assertEqual(self.request("/api/annotations")[1], before)

    def test_upload_validation_and_traversal(self):
        image = io.BytesIO()
        Image.new("RGB", (2, 2), "green").save(image, format="PNG")
        body = {"name": "../../outside.png", "mime": "image/png", "data_base64": base64.b64encode(image.getvalue()).decode()}
        status, ref = self.request("/api/references", body)
        self.assertEqual(status, 201)
        self.assertNotIn("..", ref["url"])
        self.assertEqual(self.request(ref["url"])[1], image.getvalue())
        self.assertEqual(self.request("/api/references", dict(body, mime="image/jpeg"))[0], 400)
        self.assertEqual(self.request("/api/references", dict(body, mime="text/html"))[0], 400)
        self.assertEqual(self.request("/api/references", dict(body, data_base64="bad!"))[0], 400)
        self.assertEqual(self.request("/api/events", {"session_id": "s", "type": "large", "payload": "x" * 102401})[0], 413)
        for path in ("/%2e%2e/CONTRACT.md", "/references/%2e%2e/state.json", "/vendor/three/%2e%2e/package.json", "/vendor/three/addons/%2e%2e/%2e%2e/package.json"):
            self.assertEqual(self.request(path)[0], 404)
        self.assertEqual(self.request("/vendor/three/addons/loaders/GLTFLoader.js")[0], 200)
        self.assertEqual(self.request("/vendor/three/addons/utils/BufferGeometryUtils.js")[0], 200)

    def test_cancel_and_busy(self):
        self.app.command_builder = lambda folder, images: [sys.executable, "-c", "import time; print('{\"type\":\"test.started\"}', flush=True); time.sleep(60)"]
        status, job = self.project()
        self.assertEqual(status, 202)
        self.assertEqual(self.project()[0], 409)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            with self.app.lock:
                if self.app.job(job["id"])["events"]:
                    break
            time.sleep(0.02)
        self.assertTrue(self.app.job(job["id"])["events"], "Test child must be running before cancellation")
        self.assertEqual(self.request("/api/jobs/" + job["id"] + "/cancel", {})[0], 200)
        ended = self.wait_job(job["id"])
        self.assertEqual(ended["status"], "cancelled")
        self.assertIsNone(ended["result"])

    def test_invalid_projection_output_is_failed(self):
        self.app.command_builder = lambda folder, images: [sys.executable, "-c", "from pathlib import Path; print('{\"type\":\"turn.completed\",\"usage\":{\"input_tokens\":3}}'); Path('result.json').write_text('{}')"]
        status, job = self.project()
        self.assertEqual(status, 202)
        ended = self.wait_job(job["id"])
        self.assertEqual(ended["status"], "failed")
        self.assertIsNone(ended["result"])
        self.assertIn("required", ended["error"])
        self.assertEqual(ended["usage"]["input_tokens"], 3)
        self.assertIsNone(ended["usage"]["output_tokens"])
        self.assertIsNone(ended["usage"]["total_tokens"])
        self.assertIsNone(ended["cost_usd"])
        trace = self.app.tracing.client.get_trace(ended["trace_id"])
        self.assertTrue(any(s.name == "turn.completed" for s in trace.data.spans))
        self.assertNotIn("mlflow.chat.tokenUsage", trace.data.spans[0].attributes)
        self.assertTrue((self.app.data / "jobs" / job["id"] / "stdout.log").exists())
        parent_snapshot = json.loads(json.dumps(ended))
        status, child = self.request("/api/project", {"session_id": "test-session", "question": "Revise this?",
                                   "premise": "An imagined school", "world": "forest", "parent_job_id": job["id"],
                                   "correction": "Test correction"})
        self.assertEqual(status, 202)
        corrected = self.wait_job(child["id"])
        self.assertEqual(corrected["parent_job_id"], job["id"])
        self.assertNotEqual(corrected["trace_id"], ended["trace_id"])
        self.assertEqual(self.app.job(job["id"]), parent_snapshot)
        reopened = App(self.temp.name)
        self.assertEqual(reopened.job(job["id"]), parent_snapshot)

    @staticmethod
    def experiment_result(pathway=None, artifact_id="synthetic-artifact"):
        branches = {
            "music": {"attack": 0.1, "notes": [{"midi": 60, "beats": 1}, {"midi": 64, "beats": 0.5}], "tempo": 90},
            "movement": {"duration": 2, "distance": 0.5, "shape": "cubic", "compare_shape": "quintic", "view": "velocity", "boxing_params": None},
            "ideas": {"scenario": "A friend disagrees with your claim.", "question": "What can you choose?",
                      "source_quote": EPICTETUS_EXCERPT, "source_ref_index": 0}}
        experiment = None if pathway is None else dict(version=1, pathway=pathway, base_artifact_id=artifact_id,
            status="supported", reason="Synthetic bounded variation", music=None, movement=None, ideas=None)
        if pathway:
            experiment[pathway] = branches[pathway]
        return dict(title="Synthetic proposal", premise="Test only", story="Not learner evidence", surprise="Compare",
                    question="What changes?", choices=[], assumptions=[], evidence=[],
                    visual=dict(tree_density=0.5, connection_strength=0.5, light=0.5, openness=0.5), experiment=experiment)

    def test_experiment_contract_supported_unsupported_and_bounds(self):
        validate_projection(self.experiment_result(), self.app.schema, {})
        for pathway in ("music", "movement", "ideas"):
            artifact = {"id": "synthetic-artifact", "pathway": pathway,
                        "source_refs": [{"url": EPICTETUS_URL, "locator": "Section 1"}]}
            inputs = {"learning_artifact_context": artifact, "experiment_sources": captured_experiment_sources(artifact)}
            result = self.experiment_result(pathway)
            validate_projection(result, self.app.schema, inputs)
            invalid = [dict(result, experiment=None)]
            for changes in ({"base_artifact_id": "other"}, {"pathway": "movement" if pathway != "movement" else "ideas"},
                            {"status": "unsupported"}, {"version": 2}, {"extra": True}, {pathway: None}):
                invalid.append(dict(result, experiment=dict(result["experiment"], **changes)))
            unsupported = dict(result, experiment=dict(result["experiment"], status="unsupported", **{pathway: None}))
            validate_projection(unsupported, self.app.schema, inputs)
            other = "music" if pathway != "music" else "movement"
            invalid.append(dict(result, experiment=dict(result["experiment"], **{other: self.experiment_result(other)["experiment"][other]})))
            bad_branches = {
                "music": [{"attack": 0.019}, {"attack": 0.801}, {"tempo": 39}, {"tempo": 181}, {"tempo": 90.5},
                          {"notes": []}, {"notes": [{"midi": 60, "beats": 1}] * 17},
                          *({"notes": [note, {"midi": 60, "beats": 1}]} for note in
                            ({"midi": 47, "beats": 1}, {"midi": 85, "beats": 1}, {"midi": 60.5, "beats": 1},
                             {"midi": 60, "beats": 0.24}, {"midi": 60, "beats": 4.1}))],
                "movement": [{"duration": 0.9}, {"duration": 4.1}, {"distance": 0.09}, {"distance": 1.1},
                             {"shape": "physics"}, {"compare_shape": "linear"}, {"view": "force"}],
                "ideas": [{"source_quote": "Invented quote"}, {"source_quote": ""}, {"source_ref_index": -1},
                          {"source_ref_index": 1}, {"source_ref_index": 0.5}, {"scenario": ""}, {"question": ""}]}
            for changes in bad_branches[pathway]:
                branch = dict(result["experiment"][pathway], **changes)
                invalid.append(dict(result, experiment=dict(result["experiment"], **{pathway: branch})))
            for candidate in invalid:
                with self.subTest(pathway=pathway, candidate=candidate["experiment"]):
                    with self.assertRaises((ValueError, jsonschema.ValidationError)):
                        validate_projection(candidate, self.app.schema, inputs)
            with self.assertRaises(ValueError):
                validate_projection(result, self.app.schema, {})
        legacy = self.experiment_result()
        del legacy["experiment"]
        with self.assertRaises(jsonschema.ValidationError):
            validate_projection(legacy, self.app.schema, {})
        nonfinite = self.experiment_result("music")
        nonfinite["experiment"]["music"]["attack"] = float("nan")
        with self.assertRaises(ValueError):
            validate_projection(nonfinite, self.app.schema, {})

    def test_inference_schema_requires_every_object_property(self):
        def check(node, path="root"):
            if isinstance(node, dict):
                if node.get("type") == "object":
                    self.assertEqual(set(node.get("required", [])), set(node.get("properties", {})), path)
                    self.assertIs(node.get("additionalProperties"), False, path)
                for key, value in node.items():
                    check(value, path + "." + key)
            elif isinstance(node, list):
                for index, value in enumerate(node):
                    check(value, path + "." + str(index))
        check(self.app.schema)

    def test_experiment_boxing_nullable_bounds_and_frozen_baseline(self):
        result = self.experiment_result("movement")
        artifact = {"id": "synthetic-artifact", "pathway": "movement", "state": {"lab": {}}}
        inputs = {"learning_artifact_context": artifact}
        legacy = json.loads(json.dumps(result))
        del legacy["experiment"]["movement"]["boxing_params"]
        # Strict inference rejects omission, but historical read views never normalize it.
        with self.assertRaises(jsonschema.ValidationError):
            validate_projection(legacy, self.app.schema, inputs)
        self.assertEqual(job_view({"result": legacy})["result"], legacy)
        result["experiment"]["movement"]["boxing_params"] = None
        validate_projection(result, self.app.schema, inputs)
        result["experiment"]["movement"]["boxing_params"] = {"cue": 1, "gap": 16}
        for state in ({}, {"lab": None}, {"lab": {}}, {"lab": {"boxing_round": None}}):
            with self.subTest(state=state), self.assertRaisesRegex(ValueError, "frozen artifact"):
                validate_projection(result, self.app.schema, {"learning_artifact_context": dict(artifact, state=state)})
        artifact["state"]["lab"] = {"boxing_round": {"attempts": ["synthetic miss"], "prediction": "Later cue"},
                                    "question": "Can I try again?"}
        before = json.loads(json.dumps(inputs))
        for params in ({"cue": 0.65, "gap": 10}, {"cue": 1.65, "gap": 22}):
            result["experiment"]["movement"]["boxing_params"] = params
            validate_projection(result, self.app.schema, inputs)
        for params in ({"cue": 0.649, "gap": 16}, {"cue": 1.651, "gap": 16},
                       {"cue": 1, "gap": 9.99}, {"cue": 1, "gap": 22.01},
                       {"cue": True, "gap": 16}, {"cue": "1", "gap": 16},
                       {"cue": 1}, {"gap": 16}, {"cue": 1, "gap": 16, "force": 10}, []):
            result["experiment"]["movement"]["boxing_params"] = params
            with self.subTest(params=params), self.assertRaises(jsonschema.ValidationError):
                validate_projection(result, self.app.schema, inputs)
        self.assertEqual(inputs, before)

    def test_experiment_boxing_new_output_gate(self):
        for has_round in (True, False):
            lab = {"boxing_round": {"attempts": [], "prediction": "Synthetic prediction"}} if has_round else {}
            _, artifact = self.request("/api/artifacts", dict(pathway="movement", session_id="synthetic-boxing",
                stage="attempt", actor_kind="agent_review", goal="Synthetic timing test", state={"lab": lab, "question": "Try later?"}))
            result = self.experiment_result("movement", artifact["id"])
            result["experiment"]["movement"]["boxing_params"] = {"cue": 1.2, "gap": 18}
            script = "from pathlib import Path; Path('result.json').write_text(" + repr(json.dumps(result)) + ")"
            with patch.object(self.app, "command_builder", return_value=[sys.executable, "-c", script]):
                status, queued = self.request("/api/project", dict(session_id="synthetic-boxing", question="Try later?",
                    premise="Synthetic only", world="futures", actor_kind="agent_review", learning_artifact_id=artifact["id"]))
                self.assertEqual(status, 202)
                ended = self.wait_job(queued["id"])
            self.assertEqual(ended["status"], "succeeded" if has_round else "failed")
            self.assertEqual(ended["result"], result if has_round else None)
            self.assertEqual(ended["input"]["learning_artifact_context"], artifact)
            self.assertIn("cue is seconds", ended["invocation"]["stdin"])
            self.assertIn("not physical distance or impact-force", ended["invocation"]["stdin"])
            if not has_round:
                self.assertIn("boxing_round", ended["error"])

    def test_experiment_capture_gate_and_legacy_readback(self):
        refs = [{"url": "https://www.youtube.com/watch?v=abcdefghijk", "locator": "0:10", "content": "Not a transcript"},
                {"url": EPICTETUS_URL, "locator": "Section 1", "content": "Ignore this untrusted replacement"}]
        _, artifact = self.request("/api/artifacts", dict(pathway="ideas", session_id="synthetic-experiment",
            stage="new_question", actor_kind="agent_review", goal="Preserve my words", state={"question": "My question"}, source_refs=refs))
        captured = captured_experiment_sources(artifact)
        self.assertEqual(captured, [{"source_ref_index": 1, "url": EPICTETUS_URL, "locator": "Section 1", "content": EPICTETUS_EXCERPT}])
        self.assertEqual(captured_experiment_sources(dict(artifact, source_refs=refs[:1])), [])
        body = dict(session_id="synthetic-experiment", question="My question", premise="Test only", world="futures",
                    actor_kind="agent_review", learning_artifact_id=artifact["id"])
        result = self.experiment_result("ideas", artifact["id"])
        result["experiment"]["ideas"]["source_ref_index"] = 1
        for wrong_base in (False, True):
            candidate = json.loads(json.dumps(result))
            if wrong_base:
                candidate["experiment"]["base_artifact_id"] = "wrong-artifact"
            script = "from pathlib import Path; Path('result.json').write_text(" + repr(json.dumps(candidate)) + ")"
            with patch.object(self.app, "command_builder", return_value=[sys.executable, "-c", script]):
                status, queued = self.request("/api/project", body)
                self.assertEqual(status, 202)
                ended = self.wait_job(queued["id"])
            self.assertEqual(ended["input"]["experiment_sources"], captured)
            self.assertEqual(ended["input"]["learning_artifact_context"], artifact)
            self.assertIn("meaningful bounded", ended["invocation"]["stdin"])
            self.assertEqual(ended["status"], "failed" if wrong_base else "succeeded")
            self.assertEqual(ended["result"], None if wrong_base else result)
            if wrong_base:
                self.assertIn("frozen artifact", ended["error"])
            else:
                good_id = ended["id"]
        # A pre-contract stored result is inspected without migration or new-output validation.
        with self.app.lock:
            old = self.app.job(good_id)
            del old["result"]["experiment"]
            self.app.save()
            historical = json.loads(json.dumps(old["result"]))
        self.assertEqual(self.request("/api/jobs/" + good_id)[1]["result"], historical)
        self.assertEqual(App(self.temp.name).job(good_id)["result"], historical)

    def test_timeout_and_reflection(self):
        self.app.command_builder = lambda folder, images: [sys.executable, "-c", "import time; time.sleep(30)"]
        self.app.timeout = 0.15
        try:
            _, job = self.project()
            ended = self.wait_job(job["id"])
            self.assertEqual(ended["status"], "failed")
            self.assertIn("runtime", ended["error"])
        finally:
            self.app.timeout = 240
        status, reflection = self.request("/api/reflections", {"session_id": "test-session", "world": "forest", "text": "Test reflection"})
        self.assertEqual(status, 201)
        self.assertEqual(self.request("/api/state")[1]["reflections"][-1]["id"], reflection["id"])

    def test_unknown_usage_diagnostics_and_build(self):
        self.assertIsNone(normalize_usage({}))
        self.assertIsNone(normalize_usage(None))
        self.assertIsNone(normalize_usage({"input_tokens": 2})["output_tokens"])
        self.assertEqual(normalize_usage({"input_tokens": 0})["input_tokens"], 0)
        original = {"id": "historical", "usage": {}}
        self.assertIsNone(job_view(original)["usage"])
        self.assertIsNone(job_view(original)["cost_usd"])
        self.assertEqual(original, {"id": "historical", "usage": {}})
        with patch.dict("os.environ", {"ASTRAL_CODEX_BIN": sys.executable}):
            diagnostics = codex_diagnostics()
            self.assertEqual(diagnostics["path"], str(Path(sys.executable).resolve()))
            self.assertTrue(diagnostics["version"].startswith("Python"))
            self.assertTrue(diagnostics["exists"])
        with patch.dict("os.environ", {"ASTRAL_CODEX_BIN": "/does/not/exist/codex"}):
            self.assertFalse(codex_diagnostics()["exists"])
        status, diagnostics = self.request("/api/diagnostics")
        self.assertEqual(status, 200)
        self.assertIn("not guaranteed", diagnostics["live_availability_scope"])
        self.assertIn("hidden reasoning", diagnostics["capture_scope"]["projection"])
        build = json.loads((self.app.data / "builds" / (diagnostics["build"]["id"] + ".json")).read_text())
        self.assertEqual(build, diagnostics["build"])

    def test_exact_invocation_and_reference_artifacts(self):
        picture = io.BytesIO()
        Image.new("RGB", (3, 2), "blue").save(picture, format="PNG")
        _, ref = self.request("/api/references", {"name": "test-reference.png", "mime": "image/png",
                             "data_base64": base64.b64encode(picture.getvalue()).decode()})
        # The child echoes bytes it actually received; no model is invoked.
        script = "import sys,json; print(json.dumps({'type':'test.stdin','received':sys.stdin.read(),'args':sys.argv[1:]})); sys.exit(2)"
        self.app.command_builder = lambda folder, images: [sys.executable, "-c", script, "literal argument", str(images[0])]
        before = {j["id"]: json.loads(json.dumps(j)) for j in self.app.state["jobs"]}
        with patch.dict("os.environ", {"ASTRAL_TEST_PRIVATE": "secret-not-to-be-recorded"}):
            status, queued = self.request("/api/project", {"session_id": "test-session", "question": "A quoted question?",
                "premise": "Line one\nLine two with a literal $HOME", "world": "forest", "reference_ids": [ref["id"]]})
            self.assertEqual(status, 202)
            ended = self.wait_job(queued["id"])
        folder = self.app.data / "jobs" / ended["id"]
        invocation = ended["invocation"]
        event = next(e for e in ended["events"] if e["type"] == "test.stdin")
        self.assertEqual((folder / "prompt.txt").read_bytes(), event["received"].encode("utf-8"))
        self.assertEqual(invocation["stdin"], event["received"])
        self.assertEqual(invocation["argv"], self.app.command_builder(folder, [folder / (ref["id"] + ".png")]))
        self.assertEqual(invocation["argv"][3:], event["args"])
        self.assertEqual(json.loads((folder / "argv.json").read_text()), invocation["argv"])
        self.assertEqual(json.loads((folder / "invocation.json").read_text()), invocation)
        manifest = json.loads((folder / "references.json").read_text())
        self.assertEqual(manifest, invocation["references"])
        self.assertEqual(manifest[0]["sha256"], hashlib.sha256(picture.getvalue()).hexdigest())
        self.assertEqual(manifest[0]["mime"], "image/png")
        self.assertEqual((folder / manifest[0]["filename"]).read_bytes(), picture.getvalue())
        trace = self.app.tracing.client.get_trace(ended["trace_id"])
        self.assertEqual(trace.data.spans[0].inputs["invocation"], invocation)
        self.assertIn("event recording time", trace.data.spans[0].attributes["astral.capture_scope"])
        self.assertNotIn("secret-not-to-be-recorded", json.dumps(invocation))
        for name in ("prompt.txt", "argv.json", "references.json", "stdout.log", "stderr.log"):
            self.assertEqual(self.request(invocation["artifacts"][name])[0], 200)
        self.assertEqual(self.request(manifest[0]["url"])[1], picture.getvalue())
        for suffix in ("%2e%2e/state.json", "%2e%2e%2fstate.json", "unknown.txt"):
            self.assertEqual(self.request(f"/api/jobs/{ended['id']}/artifacts/{suffix}")[0], 404)
        self.assertEqual(before, {j["id"]: j for j in self.app.state["jobs"] if j["id"] in before})

    def test_notebook_context_is_explicit_validated_and_immutable(self):
        self.app.command_builder = lambda folder, images: [sys.executable, "-c", "import sys; sys.stdin.read(); sys.exit(2)"]
        _, selected = self.request("/api/reflections", {"session_id": "test-session", "world": "forest",
                                                       "text": "Exact selected note\nwith a second line."})
        _, excluded = self.request("/api/reflections", {"session_id": "test-session", "world": "forest",
                                                       "text": "Unselected private notebook note"})
        body = {"session_id": "test-session", "question": "What could we try?", "premise": "An imagined school", "world": "forest"}
        count = len(self.app.state["jobs"])
        for ids in (["unknown-note"], [selected["id"]] * 21, "not-a-list", [1], None):
            self.assertEqual(self.request("/api/project", dict(body, reflection_ids=ids))[0], 400)
        self.assertEqual(len(self.app.state["jobs"]), count)
        # Client-supplied note text must never bypass the saved-record lookup.
        _, queued = self.request("/api/project", dict(body, notebook_context=[excluded]))
        default = self.wait_job(queued["id"])
        self.assertNotIn("notebook_context", default["input"])
        self.assertNotIn(selected["text"], default["invocation"]["stdin"])
        self.assertNotIn(excluded["text"], default["invocation"]["stdin"])
        _, queued = self.request("/api/project", dict(body, reflection_ids=[selected["id"]]))
        ended = self.wait_job(queued["id"])
        self.assertEqual(ended["input"]["notebook_context"], [selected])
        prompt_data = json.loads(ended["invocation"]["stdin"].split("\n", 1)[1])
        self.assertEqual(prompt_data["notebook_context"], [selected])
        self.assertNotIn(excluded["text"], ended["invocation"]["stdin"])
        trace = self.app.tracing.client.get_trace(ended["trace_id"])
        self.assertEqual(trace.data.spans[0].inputs["notebook_context"], [selected])
        self.assertIn("not verified facts", ended["invocation"]["stdin"])
        with self.app.lock:
            note = next(r for r in self.app.state["reflections"] if r["id"] == selected["id"])
            note["text"] = "Changed later in test"
            self.app.save()
        self.assertEqual(self.app.job(ended["id"])["input"]["notebook_context"], [selected])
        reopened = App(self.temp.name)
        self.assertEqual(reopened.job(ended["id"])["input"]["notebook_context"], [selected])
        saved = json.loads((self.app.data / "jobs" / ended["id"] / "input.json").read_text())
        self.assertEqual(saved["notebook_context"], [selected])

    def test_learning_artifacts_roundtrip_and_parent_immutability(self):
        created = []
        for pathway, actor in (("music", "scripted_character_action"), ("movement", "user_action"), ("ideas", "agent_review")):
            payload = {"pathway": pathway, "session_id": "artifact-test", "stage": "attempt", "actor_kind": actor,
                       "goal": "Keep the original desire", "state": {"value": 2, "units": "test units"},
                       "source_refs": [{"url": "https://example.org/source", "label": "Test source", "page": 2}],
                       "note": "Synthetic persistence check"}
            status, record = self.request("/api/artifacts", payload)
            self.assertEqual(status, 201)
            created.append(record)
            self.assertEqual(self.request("/api/artifacts/" + record["id"])[1], record)
            trace = self.app.tracing.client.get_trace(record["trace_id"])
            self.assertEqual(trace.data.spans[0].name, "learning.artifact")
            self.assertEqual(trace.data.spans[0].inputs, payload)
            self.assertEqual(trace.data.spans[0].outputs["artifact"], record)
            self.assertEqual(trace.data.spans[0].attributes["astral.actor_kind"], actor)
            self.assertIsNone(record["usage"])
            self.assertIsNone(record["cost_usd"])
        parent = created[0]
        payload = {k: parent[k] for k in ("pathway", "session_id", "stage", "actor_kind", "goal", "state", "source_refs", "note")}
        parent_trace = self.app.tracing.client.get_trace(parent["trace_id"]).to_dict()
        for stage, actor in (("revision", "user_action"), ("sharing_response", "staged_peer_response"), ("new_question", "scripted_character_action")):
            status, child = self.request("/api/artifacts", dict(payload, stage=stage, actor_kind=actor, parent_id=parent["id"]))
            self.assertEqual(status, 201)
            self.assertNotEqual(child["id"], parent["id"])
            self.assertNotEqual(child["trace_id"], parent["trace_id"])
        self.assertEqual(self.request("/api/artifacts/" + parent["id"])[1], parent)
        self.assertEqual(self.app.tracing.client.get_trace(parent["trace_id"]).to_dict(), parent_trace)
        records = self.request("/api/artifacts")[1]
        self.assertEqual(json.loads(self.app.artifacts_path.read_text()), records)
        self.assertNotIn("artifacts", json.loads(self.app.path.read_text()))
        self.assertEqual(self.request("/api/state")[1]["artifacts"], records)
        reopened = App(self.temp.name)
        self.assertEqual(reopened.artifacts, records)
        samples = {s["id"]: s for s in self.request("/api/samples")[1]}
        for record in records:
            sample = samples[record["id"]]
            self.assertEqual(sample["metadata"]["actor_kind"], record["actor_kind"])
            self.assertEqual(sample["messages"][0]["metadata"]["actor_kind"], record["actor_kind"])
            self.assertTrue(sample["messages"][0]["content"].startswith(record["actor_kind"] + "\n"))
            if record["actor_kind"] != "user_action":
                self.assertNotEqual(sample["messages"][0]["role"], "user")

    def test_learning_artifact_validation_and_bounds(self):
        payload = {"pathway": "music", "session_id": "artifact-test", "stage": "attempt", "actor_kind": "user_action",
                   "goal": "A test goal", "state": {}, "source_refs": [], "note": ""}
        _, parent = self.request("/api/artifacts", payload)
        before = self.request("/api/artifacts")[1]
        for changes in ({"pathway": "other"}, {"stage": "made_up"}, {"actor_kind": "human_judgment"},
                        {"session_id": ""}, {"parent_id": "missing"}, {"parent_id": parent["id"], "pathway": "ideas"},
                        {"goal": ""}, {"note": []}, {"id": parent["id"]}, {"source_refs": "not-a-list"},
                        {"source_refs": [{"url": "javascript:alert(1)"}]}, {"source_refs": ["https://example.org"] * 21}):
            self.assertEqual(self.request("/api/artifacts", dict(payload, **changes))[0], 400, changes)
        self.assertEqual(self.request("/api/artifacts", dict(payload, state="x" * (30 * 1024)))[0], 413)
        self.assertEqual(self.request("/api/artifacts", dict(payload, source_refs=[{"url": "https://example.org", "note": "x" * 8192}]))[0], 413)
        self.assertEqual(self.request("/api/artifacts")[1], before)
        self.assertEqual(self.request("/api/artifacts/missing")[0], 404)
        # JSON string quotes count toward the exact 30KB limit.
        self.assertEqual(self.request("/api/artifacts", dict(payload, state="x" * (30 * 1024 - 2)))[0], 201)

    def test_artifact_event_ids_roundtrip_and_deduplication(self):
        payload = {"pathway": "ideas", "session_id": "event-link-test", "stage": "attempt",
                   "actor_kind": "agent_review", "goal": "Synthetic event linkage", "state": {}}
        events = []
        for action in ("open", "help"):
            status, event = self.request("/api/events", {"session_id": payload["session_id"],
                "type": "learning.ideas.action", "payload": {"pathway": "ideas", "type": action}})
            self.assertEqual(status, 201)
            events.append(event)
        ids = [event["id"] for event in events]
        status, artifact = self.request("/api/artifacts", dict(payload, event_ids=[ids[0], ids[1], ids[0]]))
        self.assertEqual(status, 201)
        self.assertEqual(artifact["event_ids"], ids)
        self.assertEqual(self.request("/api/artifacts/" + artifact["id"])[1], artifact)
        self.assertEqual(App(self.temp.name).learning_artifact(artifact["id"]), artifact)
        trace = self.app.tracing.client.get_trace(artifact["trace_id"])
        self.assertEqual(trace.data.spans[0].inputs["event_ids"], ids)
        sample = next(s for s in self.request("/api/samples")[1] if s["id"] == artifact["id"])
        self.assertEqual(sample["metadata"]["event_ids"], ids)
        self.assertEqual(sample["messages"][0]["metadata"]["event_ids"], ids)
        self.assertEqual([e for e in self.app.state["events"] if e["id"] in ids], events)

    def test_artifact_event_ids_reject_invalid_links_before_side_effects(self):
        payload = {"pathway": "ideas", "session_id": "event-link-rejection", "stage": "attempt",
                   "actor_kind": "agent_review", "goal": "Synthetic invalid linkage", "state": {}}
        invalid_ids = ["unknown-event"]
        for session, event_payload in (("other-session", {"pathway": "ideas"}),
                                       (payload["session_id"], {"pathway": "music"}),
                                       (payload["session_id"], {}), (payload["session_id"], None),
                                       (payload["session_id"], ["ideas"])):
            status, event = self.request("/api/events", {"session_id": session, "type": "synthetic.link-test",
                                                         "payload": event_payload})
            self.assertEqual(status, 201)
            invalid_ids.append(event["id"])
        before_records = json.loads(json.dumps(self.app.artifacts))
        before_disk = self.app.artifacts_path.read_bytes() if self.app.artifacts_path.exists() else None
        before_state = self.app.path.read_bytes()
        invalid_lists = [None, "event-id", {}, [1], [True], [None], [[]], [""], [" "], ["x" * 129], ["x"] * 101]
        invalid_lists.extend([event_id] for event_id in invalid_ids)
        with patch.object(self.app.tracing, "start") as start, patch("server.atomic_json") as persist:
            for event_ids in invalid_lists:
                with self.subTest(event_ids=event_ids):
                    status, _ = self.request("/api/artifacts", dict(payload, event_ids=event_ids))
                    self.assertEqual(status, 400)
            start.assert_not_called()
            persist.assert_not_called()
        self.assertEqual(self.app.artifacts, before_records)
        self.assertEqual(self.app.path.read_bytes(), before_state)
        self.assertEqual(self.app.artifacts_path.read_bytes() if self.app.artifacts_path.exists() else None, before_disk)

    def test_artifact_event_ids_missing_and_empty_preserve_old_records(self):
        payload = {"pathway": "movement", "session_id": "event-link-legacy", "stage": "attempt",
                   "actor_kind": "agent_review", "goal": "Synthetic legacy artifact", "state": {}}
        status, old = self.request("/api/artifacts", payload)
        self.assertEqual(status, 201)
        self.assertNotIn("event_ids", old)
        old_trace = self.app.tracing.client.get_trace(old["trace_id"]).to_dict()
        status, empty = self.request("/api/artifacts", dict(payload, event_ids=[], parent_id=old["id"]))
        self.assertEqual(status, 201)
        self.assertEqual(empty["event_ids"], [])
        samples = {s["id"]: s for s in self.request("/api/samples")[1]}
        self.assertEqual(samples[old["id"]]["metadata"]["event_ids"], [])
        self.assertEqual(samples[empty["id"]]["metadata"]["event_ids"], [])
        self.assertEqual(self.request("/api/artifacts/" + old["id"])[1], old)
        self.assertEqual(App(self.temp.name).learning_artifact(old["id"]), old)
        self.assertEqual(self.app.tracing.client.get_trace(old["trace_id"]).to_dict(), old_trace)

    def sidecar_payload(self, source_event_id):
        return {"source_system": "synthetic-unittest", "source_event_id": source_event_id,
                "observed_at": "2026-09-01T12:00:00Z", "actor_kind": "agent_review",
                "actor_id": "synthetic-reviewer", "actor_role": "evaluator_sidecar",
                "reviewed_sha": "7ec7324", "session_id": "synthetic-session", "task_id": "SYNTH-FIND-001",
                "capture_method": "imported", "events": [{"type": "tool.result", "input": "synthetic check",
                "output": "synthetic result, not an executed tool"}], "input": {"question": "Synthetic review"},
                "output": "Synthetic finding", "decision": "Check the source binding",
                "checks": [{"name": "synthetic-only", "outcome": "proposed"}],
                "source_refs": [{"url": "https://example.org/synthetic", "sample_id": "synthetic-source"}]}

    def test_suggestion_decision_preserves_separate_authorship(self):
        _, event = self.request("/api/events", {"session_id": "synthetic-decision", "type": "synthetic.review", "payload": {}})
        original = {"id": "synthetic-agent-suggestion", "sample_id": event["id"], "quote": "", "note": "Synthetic proposal",
                    "status": "pending", "actor_kind": "agent_review", "producer": "synthetic-agent",
                    "created_at": "2026-09-01T10:00:00Z"}
        legacy = {"id": "synthetic-legacy-suggestion", "sample_id": event["id"], "quote": "", "note": "Unknown author",
                  "status": "pending"}
        before = self.request("/api/suggestions")[1]
        try:
            self.assertEqual(self.request("/api/suggestions", {"suggestions": [original, legacy]}), (200, [original, legacy]))
            decision = {"actor_kind": "human", "producer": "synthetic-declared-human", "decided_at": "2026-09-02T12:30:00+02:00"}
            accepted = dict(original, status="accepted", decision=decision)
            # A decision-only older client may omit author fields, but cannot erase them.
            request = {k: v for k, v in accepted.items() if k not in ("actor_kind", "producer", "created_at")}
            self.assertEqual(self.request("/api/suggestions", {"suggestions": [request, legacy]}), (200, [accepted, legacy]))
            self.assertEqual(self.request("/api/suggestions")[1], [accepted, legacy])
            self.assertEqual(App(self.temp.name).review["suggestions"], [accepted, legacy])
            self.assertEqual(json.loads((self.app.review_dir / "suggestions.json").read_text()), [accepted, legacy])
            self.assertNotEqual(accepted["actor_kind"], accepted["decision"]["actor_kind"])
            self.assertNotEqual(accepted["created_at"], accepted["decision"]["decided_at"])
            # An old batch writer omitting decision cannot silently remove attribution.
            self.assertEqual(self.request("/api/suggestions", {"suggestions": [dict(original, status="accepted"), legacy]})[1], [accepted, legacy])
            for change in ({"actor_kind": "human"}, {"producer": "different-author"}, {"created_at": decision["decided_at"]}):
                self.assertEqual(self.request("/api/suggestions", {"suggestions": [dict(accepted, **change), legacy]})[0], 409)
                self.assertEqual(self.request("/api/suggestions")[1], [accepted, legacy])
            self.assertEqual(self.request("/api/suggestions", {"suggestions": [accepted, dict(legacy, actor_kind="human")]})[0], 409)
            unknown_accepted = dict(legacy, status="accepted")
            self.assertEqual(self.request("/api/suggestions", {"suggestions": [accepted, unknown_accepted]})[1], [accepted, unknown_accepted])
            self.assertNotIn("decision", self.request("/api/suggestions")[1][1])
        finally:
            self.request("/api/suggestions", {"suggestions": before})

    def test_suggestion_invalid_decision_rejects_whole_batch(self):
        _, event = self.request("/api/events", {"session_id": "synthetic-decision", "type": "synthetic.review", "payload": {}})
        before = self.request("/api/suggestions")[1]
        proposal = {"id": "synthetic-validation-suggestion", "sample_id": event["id"], "quote": "", "note": "Synthetic",
                    "status": "accepted"}
        valid = {"actor_kind": "agent_review", "producer": "synthetic-QA", "decided_at": "2026-09-02T12:00:00Z"}
        for invalid in (None, {}, {**valid, "actor_kind": "robot"}, {**valid, "producer": " "},
                        {**valid, "producer": "x" * 201}, {**valid, "decided_at": "2026-09-02T12:00:00"},
                        {**valid, "decided_at": 123}, {**valid, "extra": "unknown"}):
            self.assertEqual(self.request("/api/suggestions", {"suggestions": before + [dict(proposal, decision=invalid)]})[0], 400)
            self.assertEqual(self.request("/api/suggestions")[1], before)
        self.assertEqual(self.request("/api/suggestions", {"suggestions": [proposal, proposal]})[0], 400)
        self.assertEqual(self.request("/api/suggestions")[1], before)

    def test_sidecar_roundtrip_idempotency_lineage_and_usage(self):
        payload = self.sidecar_payload("roundtrip")
        status, record = self.request("/api/sidecar-records", payload)
        self.assertEqual(status, 201)
        self.assertEqual(record["envelope"], payload)
        self.assertNotEqual(record["observed_at"], record["imported_at"])
        self.assertEqual(self.request("/api/sidecar-records/" + record["id"]), (200, record))
        for key in ("model", "usage", "cost_usd"):
            self.assertIsNone(record[key])
        trace = self.app.tracing.client.get_trace(record["trace_id"])
        self.assertEqual(len(trace.data.spans), 1)
        root = trace.data.spans[0]
        self.assertEqual(root.span_type, "EVENT")
        self.assertEqual(root.inputs, payload)
        self.assertEqual(root.outputs, {"record": record, "persisted": True})
        self.assertEqual(root.attributes["astral.actor_kind"], "agent_review")
        self.assertNotIn("mlflow.chat.tokenUsage", root.attributes)
        with patch.object(self.app.tracing, "start", side_effect=AssertionError("Must not start another trace")):
            self.assertEqual(self.request("/api/sidecar-records", payload), (200, record))
            self.assertEqual(self.request("/api/sidecar-records", dict(payload, output="changed"))[0], 409)
        self.assertEqual(self.app.tracing.client.get_trace(record["trace_id"]).to_dict(), trace.to_dict())
        child_payload = dict(self.sidecar_payload("verification"), parent_finding_ids=[record["id"]],
                             model="explicitly-source-reported-test-model", usage={"input_tokens": 17, "output_tokens": None},
                             cost_usd=0.0123, invocation_id="synthetic-invocation", timing={"duration_ms": 123})
        status, child = self.request("/api/sidecar-records", child_payload)
        self.assertEqual(status, 201)
        for key in ("model", "usage", "cost_usd", "parent_finding_ids", "timing"):
            self.assertEqual(child[key], child_payload[key])
        child_root = self.app.tracing.client.get_trace(child["trace_id"]).data.spans[0]
        self.assertEqual(child_root.inputs, child_payload)
        self.assertNotIn("mlflow.chat.tokenUsage", child_root.attributes)
        samples = self.request("/api/samples")[1]
        self.assertEqual(sum(s["id"] == record["id"] for s in samples), 1)
        sample = next(s for s in samples if s["id"] == child["id"])
        self.assertEqual(sample["metadata"]["parent_finding_ids"], [record["id"]])
        self.assertEqual(sample["messages"][0]["metadata"]["actor_role"], "evaluator_sidecar")
        self.assertEqual(sample["usage"], child_payload["usage"])
        reopened = App(self.temp.name)
        self.assertEqual(reopened.sidecar_record(record["id"]), record)
        with patch.object(reopened.tracing, "start", side_effect=AssertionError("No duplicate after reopen")):
            self.assertEqual(reopened.import_sidecar(payload), (record, False))
        self.assertEqual(json.loads(self.app.sidecar_path.read_text()), self.request("/api/sidecar-records")[1])

    def test_sidecar_validation_and_retryable_export(self):
        payload = self.sidecar_payload("validation")
        before = self.request("/api/sidecar-records")[1]
        for missing in payload:
            self.assertEqual(self.request("/api/sidecar-records", {k: v for k, v in payload.items() if k != missing})[0], 400)
        for changes in ({"actor_kind": "human"}, {"capture_method": "live"}, {"reviewed_sha": "not-a-sha"},
                        {"observed_at": "2026-09-01"}, {"actor_id": ""}, {"events": [{}]}, {"checks": ["bad"]},
                        {"usage": {"input_tokens": -1}}, {"cost_usd": True}, {"parent_finding_ids": ["missing"]},
                        {"source_refs": ["javascript:alert(1)"]}, {"source_refs": ["https://user:secret@example.org"]},
                        {"events": [{"type": "test"}] * 101}, {"id": "overwrite"}):
            self.assertEqual(self.request("/api/sidecar-records", dict(payload, **changes))[0], 400, changes)
        self.assertEqual(self.request("/api/sidecar-records", dict(payload, input="x" * (60 * 1024)))[0], 413)
        self.assertEqual(self.request("/api/sidecar-records")[1], before)
        self.assertEqual(self.request("/api/sidecar-records/missing")[0], 404)
        with patch.object(self.app.tracing, "import_sidecar", side_effect=RuntimeError("Synthetic export outage")):
            status, error = self.request("/api/sidecar-records", payload)
        self.assertEqual(status, 503)
        record = self.request("/api/sidecar-records")[1][-1]
        self.assertIn(record["id"], error["error"])
        # Retry from a fresh App: there is no in-memory live span to depend on.
        reopened = App(self.temp.name)
        self.assertEqual(reopened.import_sidecar(payload), (record, False))
        with patch.object(self.app.tracing, "start", side_effect=AssertionError("Retry must reuse trace")):
            self.assertEqual(self.request("/api/sidecar-records", payload), (200, record))
        self.assertEqual(self.app.tracing.client.get_trace(record["trace_id"]).data.spans[0].outputs["record"], record)
        partial = self.sidecar_payload("partial-export")
        with patch.object(self.app.tracing.client._tracing_client, "_upload_trace_data",
                          side_effect=RuntimeError("Synthetic artifact upload outage")):
            self.assertEqual(self.request("/api/sidecar-records", partial)[0], 503)
        saved = self.request("/api/sidecar-records")[1][-1]
        recovered = App(self.temp.name)
        self.assertEqual(recovered.import_sidecar(partial), (saved, False))
        trace = recovered.tracing.client.get_trace(saved["trace_id"])
        self.assertEqual(len(trace.data.spans), 1)
        self.assertEqual(trace.data.spans[0].outputs["record"], saved)
        self.assertEqual(sum(r["source_event_id"] == "partial-export" for r in recovered.sidecar_records), 1)

    def assert_sidecar_readback_retry(self, source_event_id, readback, error_message):
        payload = self.sidecar_payload(source_event_id)
        before = len(self.app.sidecar_records)
        with patch.object(self.app.tracing.client, "get_trace", **readback) as reader, \
                patch.object(self.app.tracing, "import_sidecar", wraps=self.app.tracing.import_sidecar) as exporter:
            status, error = self.request("/api/sidecar-records", payload)
            self.assertEqual(status, 503)
            record = self.app.sidecar_records[-1]
            self.assertIn(record["id"], error["error"])
            self.assertIn(error_message, error["error"])
            self.assertEqual(self.request("/api/sidecar-records/" + record["id"]), (200, record))
            persisted = self.app.sidecar_path.read_bytes()
            self.assertEqual(json.loads(persisted)[-1], record)
            status, error = self.request("/api/sidecar-records", payload)
            self.assertEqual(status, 503)
            self.assertIn(record["id"], error["error"])
            self.assertIn(error_message, error["error"])
            self.assertEqual(reader.call_count, 4)
            self.assertEqual(exporter.call_count, 2)
            for call in exporter.call_args_list:
                self.assertEqual(call.args, (record,))
            for call in reader.call_args_list:
                self.assertEqual(call.args, (record["trace_id"],))
            self.assertEqual(self.app.sidecar_path.read_bytes(), persisted)
            self.assertEqual(len(self.app.sidecar_records), before + 1)

        # Export succeeded despite failed readback; recovery must acknowledge it without re-export.
        reopened = App(self.temp.name)
        trace = reopened.tracing.client.get_trace(record["trace_id"])
        self.assertEqual(len(trace.data.spans), 1)
        self.assertEqual(trace.data.spans[0].outputs, {"record": record, "persisted": True})
        with patch.object(reopened.tracing, "import_sidecar", side_effect=AssertionError("No duplicate export")), \
                patch.object(reopened.tracing, "start", side_effect=AssertionError("No new trace")):
            self.assertEqual(reopened.import_sidecar(payload), (record, False))
        with patch.object(self.app.tracing, "import_sidecar", side_effect=AssertionError("No duplicate export")):
            self.assertEqual(self.request("/api/sidecar-records", payload), (200, record))
        self.assertEqual(reopened.tracing.client.get_trace(record["trace_id"]).to_dict(), trace.to_dict())
        self.assertEqual(self.app.sidecar_path.read_bytes(), persisted)
        self.assertEqual(sum(r["source_event_id"] == source_event_id for r in reopened.sidecar_records), 1)

    def test_sidecar_readback_failure_blocks_ack_until_recovery(self):
        self.assert_sidecar_readback_retry("readback-failure",
            {"side_effect": RuntimeError("Synthetic readback outage")}, "Synthetic readback outage")

    def test_sidecar_readback_mismatch_blocks_ack_until_recovery(self):
        trace = Mock()
        trace.data.spans = [Mock(outputs={"record": {"id": "wrong-record"}, "persisted": True})]
        self.assert_sidecar_readback_retry("readback-mismatch", {"return_value": trace}, "Trace readback differs")

    def test_projection_learning_artifact_snapshot(self):
        _, artifact = self.request("/api/artifacts", {"pathway": "music", "session_id": "synthetic-bridge",
            "stage": "attempt", "actor_kind": "user_action", "goal": "Synthetic sound comparison", "state": {"hz": 220}})
        payload = {"session_id": "synthetic-bridge", "question": "Synthetic bridge test", "premise": "Test only",
                   "world": "music", "learning_artifact_id": artifact["id"]}
        self.assertEqual(self.request("/api/project", dict(payload, learning_artifact_id="unknown"))[0], 400)
        with patch.object(self.app, "run_job"):
            status, queued = self.request("/api/project", payload)
        self.assertEqual(status, 202)
        job = self.app.job(queued["id"])
        self.assertEqual(job["input"]["learning_artifact_context"], artifact)
        original = next(a for a in self.app.artifacts if a["id"] == artifact["id"])
        original["state"]["hz"] = 440
        try:
            self.assertEqual(job["input"]["learning_artifact_context"]["state"], {"hz": 220})
        finally:
            original["state"]["hz"] = 220
        self.app.command_builder = lambda folder, images: [sys.executable, "-c", "import sys; sys.stdin.read(); sys.exit(2)"]
        self.app.run_job(job["id"])
        ended = self.wait_job(job["id"])
        self.assertEqual(json.loads(ended["invocation"]["stdin"].split("\n", 1)[1])["learning_artifact_context"], artifact)
        sample = next(s for s in self.request("/api/samples")[1] if s["id"] == job["id"])
        self.assertEqual(sample["metadata"]["learning_artifact_id"], artifact["id"])
        self.assertEqual(App(self.temp.name).job(job["id"])["input"]["learning_artifact_context"], artifact)

    def test_projection_actor_capture_validation_and_historical_unknown(self):
        payload = {"session_id": "synthetic-actor", "question": "Synthetic actor capture", "premise": "Not learner evidence",
                   "world": "futures"}
        self.app.command_builder = lambda folder, images: [sys.executable, "-c", "import sys; sys.stdin.read(); sys.exit(2)"]
        count = len(self.app.state["jobs"])
        for actor in ("human", "robot", None, 42, []):
            self.assertEqual(self.request("/api/project", dict(payload, actor_kind=actor))[0], 400)
        self.assertEqual(len(self.app.state["jobs"]), count)
        records = []
        for actor in ("agent_review", "user_action", "unspecified"):
            body = dict(payload, actor_kind=actor)
            if records:
                body.update(parent_job_id=records[0]["id"], correction="Explicit current actor, not parent identity")
            status, queued = self.request("/api/project", body)
            self.assertEqual(status, 202)
            record = self.wait_job(queued["id"])
            records.append(record)
            self.assertEqual(record["input"]["actor_kind"], actor)
            prompt = json.loads(record["invocation"]["stdin"].split("\n", 1)[1])
            self.assertEqual(prompt["actor_kind"], actor)
            trace = self.app.tracing.client.get_trace(record["trace_id"])
            self.assertEqual(trace.data.spans[0].inputs["actor_kind"], actor)
            sample = next(s for s in self.request("/api/samples")[1] if s["id"] == record["id"])
            self.assertEqual(sample["actor_kind"], actor)
            self.assertEqual(sample["metadata"]["actor_kind"], actor)
            self.assertIn("not verified human", sample["metadata"]["actor_scope"])
        _, queued = self.request("/api/project", payload)
        omitted = self.wait_job(queued["id"])
        self.assertEqual(omitted["input"]["actor_kind"], "unspecified")
        # Simulate a genuinely historical stored job without adding inferred provenance.
        with self.app.lock:
            historical = self.app.job(omitted["id"])
            del historical["input"]["actor_kind"]
            self.app.save()
            snapshot = json.loads(json.dumps(historical))
        sample = next(s for s in self.request("/api/samples")[1] if s["id"] == omitted["id"])
        self.assertEqual(sample["metadata"]["actor_kind"], "unspecified")
        self.assertEqual(self.app.job(omitted["id"]), snapshot)
        self.assertEqual(App(self.temp.name).job(omitted["id"]), snapshot)


if __name__ == "__main__":
    unittest.main()
