import assert from 'node:assert/strict';

// GET-only integrity check. Optional positional job ID; no ID checks every linked job.
// Exit 2 means a live result is still needed, not a passing verification.
const base = new URL(process.env.ASTRAL_URL || 'http://127.0.0.1:5188');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Local server only');
assert.ok(['http:', 'https:'].includes(base.protocol));
const jobId = process.argv[2];
assert.ok(process.argv.length <= 3, 'Usage: node scripts/verify_learning_projection.mjs [job-id]');

async function get(route, json = true) {
  const url = new URL(route, base);
  assert.equal(url.origin, base.origin, 'Reads must stay on the local server');
  assert.ok(!url.username && !url.password, 'No URL credentials');
  const response = await fetch(url, {method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200, `GET ${url.pathname}`);
  return json ? response.json() : response.text();
}

async function verify(job, samples) {
  const input = job.input;
  const id = input.learning_artifact_id;
  assert.equal(typeof id, 'string');
  const artifact = await get('/api/artifacts/' + encodeURIComponent(id));
  assert.equal(artifact.id, id);
  assert.deepEqual(input.learning_artifact_context, artifact, 'Job retains the exact saved artifact');
  assert.ok(['music', 'movement', 'ideas'].includes(artifact.pathway));
  assert.ok(artifact.goal?.trim() && artifact.state?.question?.trim(), 'Goal and learner question survive');
  assert.ok(input.question?.trim() && input.premise?.trim(), 'Confirmed request is nonempty');
  assert.ok(artifact.actor_kind && artifact.trace_id, 'Source provenance survives');
  assert.deepEqual(input.reference_ids || [], [], 'Artifact bridge must not silently attach image uploads');
  const invocation = job.invocation;
  assert.ok(invocation?.artifacts, 'Exact invocation capture required');
  async function file(name, json = true) {
    const route = invocation.artifacts[name];
    assert.equal(typeof route, 'string', `${name} is declared`);
    const url = new URL(route, base);
    assert.equal(url.pathname, `/api/jobs/${encodeURIComponent(job.id)}/artifacts/${name}`, 'File belongs to this job');
    assert.ok(!url.search && !url.hash, 'Unambiguous execution file URL');
    return get(url.href, json);
  }
  const captured = await file('input.json');
  const expected = structuredClone(input);
  if (job.parent_job_id) {
    const parent = await get('/api/jobs/' + encodeURIComponent(job.parent_job_id));
    expected.prior_projection = parent.result;
  }
  assert.deepEqual(captured, expected, 'Execution input matches persisted job and correction parent');
  const prompt = await file('prompt.txt', false);
  assert.equal(prompt, invocation.stdin, 'Exact prompt equals captured stdin');
  const boundary = prompt.indexOf('\n');
  assert.ok(boundary > 0, 'Prompt instruction/data boundary exists');
  assert.deepEqual(JSON.parse(prompt.slice(boundary + 1)), captured, 'Prompt contains exact input, not a different artifact');
  assert.deepEqual(await file('argv.json'), invocation.argv, 'Exact argv survives');
  assert.deepEqual(await file('references.json'), invocation.references, 'Reference manifest survives');
  assert.deepEqual(invocation.references, [], 'No image files accompany this artifact request');
  const result = await file('result.json');
  assert.ok(result && typeof result === 'object', 'A real result is required');
  assert.deepEqual(result, job.result, 'Returned result is the captured model result');
  await file('stdout.log', false);
  await file('stderr.log', false);
  const sourceSample = samples.find(sample => sample.id === id);
  const jobSample = samples.find(sample => sample.id === job.id);
  assert.ok(sourceSample && jobSample, 'Both records are inspectable');
  assert.equal(sourceSample.trace_id, artifact.trace_id);
  assert.ok(job.trace_id, 'Projection trace exists');
  assert.equal(jobSample.trace_id, job.trace_id);
  assert.equal(jobSample.learning_artifact_id, id);
  assert.equal(jobSample.metadata?.learning_artifact_id, id);
  const message = suffix => jobSample.messages.find(item => item.id === job.id + suffix);
  assert.deepEqual(JSON.parse(message(':input')?.content), input, 'Review input matches the job');
  assert.deepEqual(JSON.parse(message(':output')?.content), result, 'Review output matches the result');
  assert.deepEqual(await get('/api/artifacts/' + encodeURIComponent(id)), artifact, 'Source remains unchanged');
  return {job_id: job.id, learning_artifact_id: id, pathway: artifact.pathway,
    artifact_trace_id: artifact.trace_id, job_trace_id: job.trace_id,
    question_edited_for_projection: input.question !== artifact.state.question,
    return_url: new URL(`/?path=${artifact.pathway}&artifact=${encodeURIComponent(id)}`, base).href};
}

try {
  const state = await get('/api/state');
  const jobs = jobId ? [await get('/api/jobs/' + encodeURIComponent(jobId))]
    : state.jobs.filter(job => job.input?.learning_artifact_id);
  if (jobId) assert.ok(jobs[0].input?.learning_artifact_id, 'Requested job must link a learning artifact');
  const samples = await get('/api/samples');
  const verified = [], pending = [];
  for (const summary of jobs) {
    const job = await get('/api/jobs/' + encodeURIComponent(summary.id));
    if (['queued', 'running', 'pending', 'cancel_requested', 'cancelling'].includes(job.status)) {
      pending.push({job_id: job.id, status: job.status});
      continue;
    }
    assert.ok(['completed', 'succeeded', 'success'].includes(job.status), `${job.id}: result unavailable (${job.status})`);
    verified.push(await verify(job, samples));
  }
  const ready = verified.length > 0 && pending.length === 0;
  console.log(JSON.stringify({status: ready ? 'passed' : 'not_verified', verified, pending,
    reason: jobs.length ? undefined : 'No linked live projection exists. No model call was made.',
    scope: 'Read-only saved artifact/job/prompt/result integrity. Does not verify browser confirmation, audible output, model understanding, or learner outcomes.'}, null, 2));
  if (!ready) process.exitCode = 2;
} catch (error) {
  console.error('FAIL: ' + error.message);
  process.exitCode = 1;
}
