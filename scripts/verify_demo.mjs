import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=process.env.ASTRAL_URL||'http://127.0.0.1:5188';
const get=async route=>{const response=await fetch(base+route);assert.equal(response.status,200,route);return response.json();};
const state=await get('/api/state');
const child=state.jobs.findLast(job=>job.parent_job_id&&job.status==='succeeded');
assert.ok(child,'A real corrected projection must exist');
const parent=state.jobs.find(job=>job.id===child.parent_job_id);
assert.equal(parent?.status,'succeeded');
assert.notEqual(parent.trace_id,child.trace_id);
const savedInput=JSON.parse(await readFile(path.join(root,'data/jobs',child.id,'input.json'),'utf8'));
assert.deepEqual(savedInput.prior_projection,parent.result,'Original projection is preserved');
const annotations=await get('/api/annotations');
const note=annotations.find(note=>note.sample_id===parent.id&&note.note.includes('QA agent review'));
assert.ok(note,'A real anchored review note must exist');
assert.ok(child.input.correction.includes(note.note),'Correction includes the saved review note');
const words=text=>text.trim().split(/\s+/).length;
assert.ok(words(child.result.title)<=8,'Requested title limit');
assert.ok(words(child.result.story)<=90,'Requested story limit');
assert.ok(child.result.choices.some(choice=>/reject/i.test(choice.label)),'Learner can reject the premise');
assert.ok(child.result.evidence.some(item=>item.basis==='reference_observation'),'Image observations are explicit');
assert.ok(child.result.evidence.some(item=>item.basis==='imagined'),'Imagined content is explicit');
assert.ok(parent.input.reference_ids.length,'Parent used an image reference');
assert.ok(state.reflections.some(entry=>entry.job_id===child.id),'Reflection links to the corrected projection');
const completed=[parent,child];
for(const job of completed){
  assert.equal(job.model,'gpt-6-astra');
  assert.ok(job.usage.input_tokens>0&&job.usage.output_tokens>0,'Actual reported usage');
  assert.equal(job.cost_usd,null,'Unknown price is not invented');
  assert.ok(job.events.some(event=>event.type==='turn.completed'),'Completed CLI event');
}
const report={verified_at:new Date().toISOString(),scope:'Live local projection and correction snapshot; not a participant learning evaluation',parent_id:parent.id,child_id:child.id,parent_trace:parent.trace_id,child_trace:child.trace_id,parent_story_words:words(parent.result.story),child_story_words:words(child.result.story),input_tokens:completed.reduce((n,j)=>n+j.usage.input_tokens,0),output_tokens:completed.reduce((n,j)=>n+j.usage.output_tokens,0),cost_usd:null,verification:'passed'};
console.log(JSON.stringify(report,null,2));
