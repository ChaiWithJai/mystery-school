import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base=process.env.ASTRAL_URL||'http://127.0.0.1:5188';
const get=async route=>{const r=await fetch(base+route);assert.equal(r.status,200,route);return r;};
const state=await (await get('/api/state')).json();
const job=state.jobs.findLast(j=>j.status==='succeeded'&&j.invocation&&j.input?.notebook_context?.length);
assert.ok(job,'A successful real job with explicit notebook context and invocation capture is required');
const prefix=`/api/jobs/${job.id}/artifacts/`;
const prompt=await (await get(prefix+'prompt.txt')).text();
const argv=await (await get(prefix+'argv.json')).json();
const input=await (await get(prefix+'input.json')).json();
assert.equal(prompt,job.invocation.stdin);
assert.deepEqual(argv,job.invocation.argv);
assert.deepEqual(input.notebook_context,job.input.notebook_context);
for(const note of input.notebook_context){
  assert.ok(prompt.includes(JSON.stringify(note.text).slice(1,-1)),'Exact saved note is in the prompt');
}
const references=await (await get(prefix+'references.json')).json();
for(const reference of references){
  const bytes=Buffer.from(await (await get(prefix+reference.filename)).arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),reference.sha256);
}
assert.equal(job.model,'gpt-6-astra');
assert.ok(job.usage.input_tokens>0&&job.usage.output_tokens>0);
assert.equal(job.cost_usd,null);
console.log(JSON.stringify({verified_at:new Date().toISOString(),job_id:job.id,trace_id:job.trace_id,scope:'Exact invocation artifacts and explicit notebook context; not a learning outcome evaluation',references:references.length,notebook_notes:input.notebook_context.length,usage:job.usage,cost_usd:job.cost_usd,result:'passed'},null,2));
