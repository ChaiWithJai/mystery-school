import assert from 'node:assert/strict';
import {attackSlope, envelopeAt} from '../public/music-lab.js';
import {sampleMovement} from '../public/movement-lab.js';

const base=process.env.ASTRAL_URL||'http://127.0.0.1:5188';
const get=async route=>{const response=await fetch(base+route);assert.equal(response.status,200,route);return response.json();};
const records=await get('/api/artifacts');
const samples=await get('/api/samples');
const byId=new Map(records.map(record=>[record.id,record]));
const report=[];
for(const pathway of ['music','movement','ideas']){
  const final=records.findLast(record=>record.pathway===pathway&&record.stage==='new_question'&&/agent.?qa|agent qa/i.test(record.note));
  assert.ok(final,`${pathway}: complete a labeled agent-QA browser walkthrough first`);
  const chain=[];let cursor=final;const seen=new Set();
  while(cursor){assert.ok(!seen.has(cursor.id),'No lineage cycle');seen.add(cursor.id);chain.unshift(cursor);assert.equal(cursor.pathway,pathway);if(!cursor.parent_id)break;assert.ok(byId.has(cursor.parent_id),'Parent exists');cursor=byId.get(cursor.parent_id);}
  assert.equal(chain[0].stage,'attempt');
  const sharing=chain.findIndex(record=>record.stage==='sharing_response');
  assert.ok(sharing>0,`${pathway}: response follows an attempt`);
  assert.equal(chain[sharing].actor_kind,'staged_peer_response');
  const revision=chain.slice(sharing+1).find(record=>record.stage==='revision');
  assert.ok(revision,`${pathway}: saved revision follows the response`);
  assert.notDeepEqual(revision.state.lab,chain[sharing].state.lab,`${pathway}: artifact changed, not just a completion click`);
  assert.ok(final.state.question.trim());
  for(const record of chain){
    assert.equal(record.goal,final.goal,'Desire survives every stage');
    assert.equal(record.state.scenario_kind,'fictional_composite');
    assert.ok(record.trace_id?.startsWith('tr-'));
    assert.ok(record.source_refs.length,'Sources retained');
    assert.deepEqual(await get('/api/artifacts/'+record.id),record,'Exact immutable record can be replayed');
    const sample=samples.find(item=>item.id===record.id);
    assert.ok(sample,'Record is inspectable in Trajectory Studio');
    assert.equal(sample.trace_id,record.trace_id);
    assert.ok(sample.messages.some(message=>message.actor_kind===record.actor_kind));
  }
  report.push({pathway,route:`${base}/?path=${pathway}&artifact=${final.id}`,artifact_ids:chain.map(record=>record.id),final_trace_id:final.trace_id,result:'passed'});
}
// Bind the sidecar's proposed numeric probes to the implemented models.
assert.equal(attackSlope(.2),5);assert.equal(attackSlope(.4),2.5);
assert.equal(envelopeAt(.2,.2),1);assert.equal(envelopeAt(.4,.4),1);
const before=sampleMovement(1,{distance:.4,duration:2});
const after=sampleMovement(2,{distance:.4,duration:4});
assert.equal(before.position,after.position);assert.equal(before.velocity/2,after.velocity);
console.log(JSON.stringify({verified_at:new Date().toISOString(),scope:'Read-only verification of labeled agent-QA artifact chains and numeric probes. Not human learning efficacy, acoustic measurement, or a new model run.',pathways:report},null,2));
