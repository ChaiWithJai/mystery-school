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
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image
from server import App, ACTIVE, make_server, codex_diagnostics, job_view
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


if __name__ == "__main__":
    unittest.main()
