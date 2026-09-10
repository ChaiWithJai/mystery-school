import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoxingMemory, appendMemory} from '../public/learning-memory.js';

const artifact = () => ({id:'saved-a', pathway:'movement', trace_id:'trace-a', actor_kind:'agent_review',
  source_refs:[{label:'Saved lesson', url:'https://example.org/lesson', locator:'0:12', source_kind:'reviewed_video_reference', frames:['private']}],
  state:{lab:{boxing_mirror:{lessonId:'lesson-a', reflection:'  I noticed my guard drop.\nI want to try again.  ',
    frames:['private'], attempts:[{t:12,type:'JAB',landmarks:['private']},{t:13,type:'invented'}]}}}});

test('saved reflection preserves exact words, source IDs, actor and lesson without promoting estimates',()=>{
  const saved=artifact(), before=structuredClone(saved), memory=createBoxingMemory(saved);
  assert.equal(memory.observation.text,saved.state.lab.boxing_mirror.reflection);
  assert.equal(memory.observation.kind,'agent_review');
  assert.match(memory.observation.label,/not human learning evidence/);
  assert.equal(memory.source_artifact_id,'saved-a');assert.equal(memory.source_trace_id,'trace-a');
  assert.equal(memory.actor_kind,'agent_review');assert.equal(memory.lessonId,'lesson-a');
  assert.equal(memory.detector_estimates.count,1);assert.match(memory.detector_estimates.label,/not verified/);
  assert.equal(memory.source_refs[0].url,saved.source_refs[0].url);
  assert.equal(JSON.stringify(memory).includes('private'),false);
  assert.deepEqual(saved,before);assert.deepEqual(JSON.parse(JSON.stringify(memory)),memory);
});

test('no empty or missing reflection becomes an invented observation',()=>{
  for(const reflection of [undefined,null,'',' \n ',5]){
    const saved=artifact();saved.state.lab.boxing_mirror.reflection=reflection;assert.equal(createBoxingMemory(saved),null);
  }
  assert.equal(createBoxingMemory({id:'saved',pathway:'movement'}),null);
  for(const saved of [null,{}, {id:'x',pathway:'music'}, {id:'x',pathway:'ideas'}, {id:' ',pathway:'movement'}]){
    assert.throws(()=>createBoxingMemory(saved),TypeError);
  }
});

test('historical unknown attribution stays unknown and output is detached and deeply immutable',()=>{
  const saved=artifact();delete saved.trace_id;delete saved.actor_kind;delete saved.state.lab.boxing_mirror.lessonId;
  const memory=createBoxingMemory(saved);assert.equal(memory.source_trace_id,null);assert.equal(memory.actor_kind,null);assert.equal(memory.lessonId,null);
  assert.equal(memory.observation.kind,'unknown');assert.match(memory.observation.label,/unverified authorship/);
  saved.source_refs[0].label='changed';assert.equal(memory.source_refs[0].label,'Saved lesson');
  assert.throws(()=>{memory.observation.text='changed';},TypeError);
  assert.throws(()=>{memory.source_refs.push({});},TypeError);assert.ok(Object.isFrozen(memory.source_refs[0]));
});

test('only a declared user action is labeled a learner self-report',()=>{
  const saved=artifact();saved.actor_kind='user_action';
  const memory=createBoxingMemory(saved);
  assert.equal(memory.observation.kind,'learner_reported');
  assert.match(memory.observation.label,/not independently verified/);
  saved.actor_kind='staged_peer_response';
  assert.equal(createBoxingMemory(saved).observation.kind,'unknown');
});

test('append is idempotent by source artifact and preserves unrelated pathway records',()=>{
  const unrelated=[{kind:'music',source_artifact_id:'music-a',custom:{notes:[60]}},{kind:'ideas',source_artifact_id:'ideas-a',text:'My claim'}];
  const memory=createBoxingMemory(artifact()), result=appendMemory(unrelated,memory);
  assert.equal(result.length,3);assert.deepEqual(result.slice(0,2),unrelated);assert.equal(unrelated.length,2);
  assert.deepEqual(appendMemory(result,{...memory,lessonId:'changed'}),result);
  assert.deepEqual(appendMemory([...result,memory],memory),result);
  unrelated[0].custom.notes.push(64);assert.deepEqual(result[0].custom.notes,[60]);
  assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result[0].custom.notes));
});

test('append bounds history to 60 without changing retained records',()=>{
  const existing=Array.from({length:60},(_,i)=>({source_artifact_id:`saved-${i}`,note:String(i)}));
  const record=createBoxingMemory(artifact()), result=appendMemory(existing,record);
  assert.equal(result.length,60);assert.deepEqual(result[0],existing[1]);assert.deepEqual(result.at(-1),record);
  assert.equal(existing.length,60);assert.throws(()=>appendMemory({},record),TypeError);assert.throws(()=>appendMemory([],null),TypeError);
});
