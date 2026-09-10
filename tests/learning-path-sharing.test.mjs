import test from 'node:test';
import assert from 'node:assert/strict';
import {savedVersionUrl,copySavedVersion,createLearningEventBuffer,createLearningDraftScopes,persistLearningSnapshot} from '../public/learning-paths.js';
const batchResult=(eventIds=[],failed=0)=>({eventIds,failed,omitted:0,unlinkedHistory:false});

for(const pathway of ['music','movement','ideas'])test(`${pathway}: exact version replaces stale route and preserves actor`,()=>{
  const url=new URL(savedVersionUrl('http://localhost:5188/?actor=agent_review&path=music&artifact=old&correct=job#old',pathway,'saved / version'));
  assert.equal(url.searchParams.get('path'),pathway);
  assert.equal(url.searchParams.get('artifact'),'saved / version');
  assert.equal(url.searchParams.get('actor'),'agent_review');
  assert.equal(url.searchParams.has('correct'),false);
  assert.equal(url.hash,'');
});
test('visitor links do not invent an actor and IDs are required',()=>{
  assert.equal(new URL(savedVersionUrl('http://localhost:5188/','ideas','one')).searchParams.has('actor'),false);
  assert.throws(()=>savedVersionUrl('http://localhost/','unknown','one'));
  assert.throws(()=>savedVersionUrl('http://localhost/','music',''));
});
test('clipboard success waits for actual write',async()=>{
  let written;
  const message=await copySavedVersion('http://localhost/?artifact=one',{writeText:async value=>{written=value;}});
  assert.equal(written,'http://localhost/?artifact=one');
  assert.match(message,/link copied/);
});
test('clipboard denial and unavailability never claim success',async()=>{
  for(const clipboard of [undefined,{writeText:async()=>{throw Error('Denied');}}]){
    const message=await copySavedVersion('http://localhost/',clipboard);
    assert.match(message,/Could not copy/);
    assert.match(message,/Nothing was sent/);
    assert.doesNotMatch(message,/link copied/);
  }
});
test('capture waits for pending events and leaves later actions for the next save',async()=>{
  let finish;
  const buffer=createLearningEventBuffer(type=>type==='help'?new Promise(resolve=>{finish=resolve;}):{id:'later'});
  buffer.track('help',{});const batch=buffer.capture();const settled=batch.settle();
  buffer.track('change',{});await Promise.resolve();finish({id:'help-id'});
  assert.deepEqual(await settled,batchResult(['help-id']));
  batch.commit();assert.deepEqual(await buffer.capture().settle(),batchResult(['later']));
});
test('unsuccessful save retains batch; success clears it; a reopened scope is empty',async()=>{
  const buffer=createLearningEventBuffer(()=>({id:'event'}));buffer.track('open',{});
  assert.deepEqual(await buffer.capture().settle(),batchResult(['event']));
  const retry=buffer.capture();assert.deepEqual(await retry.settle(),batchResult(['event']));retry.commit();
  assert.deepEqual(await buffer.capture().settle(),batchResult());
  assert.deepEqual(await createLearningEventBuffer(()=>({id:'old-session'})).capture().settle(),batchResult());
});
test('null and rejected telemetry report missing links without fabricated IDs',async()=>{
  const buffer=createLearningEventBuffer(type=>{if(type==='reject')throw Error('offline');return null;});
  buffer.track('null',{});buffer.track('reject',{});
  assert.deepEqual(await buffer.capture().settle(),batchResult([],2));
});
test('pending old scope cannot leak into a reopened pathway or mutate its event payload',async()=>{
  let finish,observed;
  const old=createLearningEventBuffer((type,payload)=>{observed=payload;return new Promise(resolve=>{finish=resolve;});});
  const payload={pathway:'music',attack:.2};old.track('help',payload);payload.attack=.8;
  const reopened=createLearningEventBuffer(()=>({id:'new-session-ideas'}));reopened.track('open',{pathway:'ideas'});
  await Promise.resolve();finish({id:'old-session-music'});
  assert.equal(observed.attack,.2);
  assert.deepEqual(await reopened.capture().settle(),batchResult(['new-session-ideas']));
  assert.deepEqual(await old.capture().settle(),batchResult(['old-session-music']));
});
test('101 events save with 100 links and explicit incomplete omission; failed POST retains retry',async()=>{
  const events=createLearningEventBuffer(type=>({id:type}));
  for(let i=0;i<101;i++)events.track('event-'+i,{});
  const options={events,payload:{state:{}},isCurrent:()=>true,onSaved:()=>{}};
  await assert.rejects(persistLearningSnapshot({...options,persist:async()=>{throw Error('offline');}}));
  const result=await persistLearningSnapshot({...options,persist:async payload=>{
    assert.equal(payload.event_ids.length,100);
    assert.equal(payload.state.telemetry.omitted_events,1);
    assert.equal(payload.state.telemetry.failed_events,0);
    assert.equal(payload.state.telemetry.status,'incomplete');return {id:'saved'};
  }});
  assert.equal(result.record.id,'saved');assert.deepEqual(await events.capture().settle(),batchResult());
});
test('late POST A cannot replace B parent; C keeps B and stale A does not consume pending help',async()=>{
  const events=createLearningEventBuffer(()=>({id:'help'}));events.track('help',{});
  let generation=1,parent='original',finishA,postStarted;
  const started=new Promise(resolve=>{postStarted=resolve;});
  const a=persistLearningSnapshot({events,payload:{state:{}},isCurrent:()=>generation===1,onSaved:r=>{parent=r.id;},persist:()=>{postStarted();return new Promise(resolve=>{finishA=resolve;});}});
  await started;generation=2;
  await persistLearningSnapshot({events,payload:{state:{}},isCurrent:()=>generation===2,onSaved:r=>{parent=r.id;},persist:async()=>({id:'B'})});
  events.track('later-help',{});finishA({id:'A'});await a;
  assert.equal(parent,'B');assert.deepEqual(await events.capture().settle(),batchResult(['help']));
  await persistLearningSnapshot({events,payload:{state:{},parent_id:parent},isCurrent:()=>true,onSaved:()=>{},persist:async payload=>{assert.equal(payload.parent_id,'B');return {id:'C'};}});
});
test('same draft detour retains pending help; explicit restore resets; session mismatch discloses history',async()=>{
  let finish;
  const scopes=createLearningDraftScopes(()=>new Promise(resolve=>{finish=resolve;}));
  const draft={lab:{helpSeen:true}},events=scopes(draft,'session-A',true);events.track('help',{});
  const resumed=scopes(draft,'session-A');assert.equal(resumed,events);
  await Promise.resolve();finish({id:'help-before-detour'});
  assert.deepEqual(await resumed.capture().settle(),batchResult(['help-before-detour']));
  assert.deepEqual(await scopes({lab:{helpSeen:true}},'session-A',true).capture().settle(),batchResult());
  const other=await scopes(draft,'session-B').capture().settle();assert.deepEqual(other.eventIds,[]);assert.equal(other.unlinkedHistory,true);
  assert.equal((await scopes({lab:{helpSeen:true}},'session-A').capture().settle()).unlinkedHistory,true);
});
test('closing during pending telemetry prevents POST and artifact state stays snapshotted',async()=>{
  let finish,current=true,posted=false;
  const events=createLearningEventBuffer(()=>new Promise(resolve=>{finish=resolve;}));events.track('help',{});
  const payload={state:{lab:{duration:2}}};
  const saving=persistLearningSnapshot({events,payload,isCurrent:()=>current,onSaved:()=>{},persist:async()=>{posted=true;}});
  await Promise.resolve();current=false;payload.state.lab.duration=4;finish({id:'help'});
  await assert.rejects(saving,/closed/);assert.equal(posted,false);
  assert.deepEqual(await events.capture().settle(),batchResult(['help']));
});
