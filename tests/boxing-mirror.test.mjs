import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanMirrorState} from '../public/boxing-mirror.js';
import {createBoxingMemory} from '../public/learning-memory.js';
import {normalizeStoryWorldState} from '../public/story-world.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('unknown anatomical hand never becomes a left-hand estimate during restore',()=>{
 const state=cleanMirrorState({attempts:[{t:1,type:'HOOK',lessonId:'left',sessionId:'session'}]});
 assert.equal(state.attempts[0].hand,null);
});
test('mirror artifacts retain observations and estimated events, never raw frames',()=>{const s=cleanMirrorState({reflection:'I noticed my return',frames:[{private:true}],attempts:[{t:200,type:'JAB',hand:'L',power:99,landmarks:[1]},{t:NaN,type:'HOOK'}]});assert.equal(s.reflection,'I noticed my return');assert.deepEqual(s.attempts,[{t:200,type:'JAB',hand:'L',estimated:true,captureId:null,lessonId:null,sourceMode:null,detectorTime:null,mediaTime:null,seekSegment:null}]);assert.equal('frames' in s,false);});
test('mirror state bounds event history and excludes invalid modes',()=>{const s=cleanMirrorState({sourceMode:'remote-upload',attempts:Array.from({length:100},(_,i)=>({t:i,type:'CROSS',hand:'R'}))});assert.equal(s.sourceMode,null);assert.equal(s.attempts.length,60);assert.equal(s.attempts[0].t,40);});

import {keepMirrorObservation} from '../public/boxing-mirror.js';
const lesson={id:'guard',source:'https://example.com/guard',cues:['Hands up.']};
function ready(){return {lessonId:'guard',sourceMode:'camera',lessonProgress:{guard:{reflection:'My left hand drops.',referenceOpenedAt:'2026-09-10T15:00:00Z',mirrorStartedAt:'2026-09-10T15:01:00Z',reportedTried:true,sessionId:'s1',sourceMode:'camera'}},attempts:[{t:100,type:'JAB',hand:'L',lessonId:'guard',sessionId:'s1'},{t:200,type:'CROSS',hand:'R',lessonId:'other',sessionId:'s2'}]};}
test('opening camera or writing alone is never recorded as tried',()=>{for(const key of ['reportedTried','referenceOpenedAt','mirrorStartedAt','reflection']){const s=ready();s.lessonProgress.guard[key]=false;assert.equal(keepMirrorObservation(s,lesson).observations.length,0);}});
test('kept reflection preserves its lesson, source and matching session estimates',()=>{const before=ready(),kept=keepMirrorObservation(before,lesson,{id:'o1',recordedAt:'now'});assert.equal(before.observations,undefined);assert.equal(kept.observations[0].attempts.length,1);assert.equal(kept.observations[0].source,lesson.source);assert.equal(kept.observations[0].sessionId,'s1');kept.lessonProgress.guard.reflection='A different thought';assert.equal(kept.observations[0].reflection,'My left hand drops.');const second=keepMirrorObservation(kept,lesson,{id:'o2'});second.observations[0].attempts[0].t=999;assert.equal(kept.observations[0].attempts[0].t,100);assert.equal(second.observations.length,2);});
test('JSON restore preserves each lesson draft and immutable observation history',()=>{const s=keepMirrorObservation(ready(),lesson,{id:'o1'});s.lessonProgress.other={reflection:'My feet crossed',reportedTried:false};const restored=cleanMirrorState(JSON.parse(JSON.stringify(s)));assert.equal(restored.lessonProgress.guard.reflection,'My left hand drops.');assert.equal(restored.lessonProgress.other.reflection,'My feet crossed');assert.equal(restored.observations[0].reportedTried,true);assert.equal(restored.observations[0].attempts[0].estimated,true);});

import {mirrorPosition} from '../public/boxing-mirror.js';
test('body trail uses actual visible normalized hip/ankle positions and rejects missing hips',()=>{const p=[];p[23]={x:.2,y:.6,visibility:.9};p[24]={x:.4,y:.8,visibility:.9};p[27]={x:.1,y:.95,visibility:.8};p[28]={x:.5,y:1,visibility:.1};const sample=mirrorPosition(p,125);assert.ok(Math.abs(sample.x-.3)<1e-9);assert.equal(sample.y,.7);assert.deepEqual(sample.ankles,[{side:'L',x:.1,y:.95}]);p[23].visibility=.2;assert.equal(mirrorPosition(p,130),null);assert.equal(mirrorPosition(null,0),null);});
test('practice duration and local image trace survive restore without implying mastery',()=>{const s=cleanMirrorState({practiceRounds:[{id:'r1',lessonId:'guard',status:'elapsed',durationMs:40020,points:[{t:100,x:.4,y:.5,ankles:[]}],mastered:true}]});assert.equal(s.practiceRounds[0].status,'elapsed');assert.equal(s.practiceRounds[0].durationMs,40020);assert.equal(s.practiceRounds[0].coordinateSpace,'normalized_image');assert.equal(s.practiceRounds[0].depthMeasured,false);assert.equal('mastered' in s.practiceRounds[0],false);});
test('long reflection survives saved mirror and knowledge memory without truncation',()=>{
  const reflection='  My observation.\n'.repeat(200)+'Keep this ending.  ';
  const mirror=cleanMirrorState({reflection});
  assert.equal(mirror.reflection,reflection);
  const saved=JSON.parse(JSON.stringify({id:'long-observation',pathway:'movement',actor_kind:'user_action',state:{lab:{boxing_mirror:mirror}}}));
  const memory=createBoxingMemory(saved);
  assert.equal(memory.observation.text,reflection);
  const world=normalizeStoryWorldState({memories:[memory],learnerStory:'My existing story.'});
  assert.equal(world.memories[0].observation.text,reflection);
  assert.equal(world.learnerStory,'My existing story.');
});

test('invalid reflection values never become invented observation text',()=>{
  for(const reflection of [undefined,null,42,true,{},['words']])assert.equal(cleanMirrorState({reflection}).reflection,'');
});

const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function harness({bitmapFailure=false,transferFailure=false,lessons=[{id:'lesson-a'},{id:'lesson-b'}],punch='JAB'}={}) {
  class Element {
    constructor(){this.queries=new Map();this.children=[];this.classList={add(){},remove(){},toggle(){},contains(){return true}};this.readyState=2;this.paused=true;this.currentTime=12;this.videoWidth=640;this.videoHeight=480;}
    querySelector(key){if(!this.queries.has(key))this.queries.set(key,new Element());return this.queries.get(key);}
    append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
    setAttribute(){} pause(){this.paused=true;} async play(){this.paused=false;} removeAttribute(){} remove(){}
    getContext(){return {save(){},restore(){},arc(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}
  }
  const workers=[],events=[],bitmaps=[],raf=new Map();let tick=100,serial=0,bitmapCalls=0;
  class Worker {
    constructor(){this.sent=[];this.dead=false;workers.push(this);}
    postMessage(message){if(message.type==='frame'&&transferFailure)throw Error('transfer failed');this.sent.push(message);}
    terminate(){this.dead=true;}
  }
  const source=readFileSync(new URL('../public/boxing-mirror.js',import.meta.url),'utf8')
    .replace(/^import .*\n/,'').replaceAll('export function','function').replaceAll('import.meta.url',JSON.stringify(import.meta.url));
  const mount=vm.runInNewContext(source+';mountBoxingMirror',{
    document:{createElement:()=>new Element()},Worker,URL:class extends URL {static createObjectURL(){return 'blob:test';}static revokeObjectURL(){}},
    Date,structuredClone,clearInterval,setInterval,crypto:{randomUUID:()=>`capture-${++serial}`},performance:{now:()=>++tick},
    requestAnimationFrame:fn=>{const id=++serial;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),
    createImageBitmap:async()=>{bitmapCalls++;if(bitmapFailure)throw Error('bitmap failed');const bitmap={closed:0,close(){this.closed++;}};bitmaps.push(bitmap);return bitmap;},
    L:{shoulder:11},BONES:[],makeSmoother:()=>({update:points=>new Map(points.map((p,i)=>[i,p]))}),HandTracker:class {update(){return {type:punch};}}
  });
  const container=new Element();const view=mount(container,{lessons,onEvent:(type,payload)=>events.push({type,payload})});
  const root=container.children[0],video=root.querySelector('.boxing-mirror-self');
  return {view,root,video,workers,events,bitmaps,raf,get bitmapCalls(){return bitmapCalls;},
    async begin(){const input=root.querySelector('input[type=file]');input.files=[{}];input.onchange();await settle();},
    async ready(){workers.at(-1).onmessage({data:{type:'ready'}});await settle();},
    async frame(){const next=raf.entries().next().value;if(next){raf.delete(next[0]);await next[1]();}await settle();},
    result(worker=workers.at(-1)){const frame=worker.sent.findLast(m=>m.type==='frame');const points=Array.from({length:25},(_,i)=>({x:i/30,y:.5,visibility:1}));worker.onmessage({data:{type:'landmarks',landmarks:points,t:frame.t,provenance:frame.provenance}});return frame;}
  };
}

test('capture estimates preserve immutable identity and separate media time across seeks and captures',async()=>{
  const h=harness();
  assert.match(h.root.querySelector('.boxing-mirror-center').children[0].textContent,/Before you start.*saved locally/);
  await h.begin();await h.ready();const firstFrame=h.result();
  const first=h.view.getState().attempts[0];assert.equal(first.mediaTime,12);assert.equal(first.seekSegment,0);assert.equal(first.lessonId,'lesson-a');assert.equal(first.sourceMode,'local-video');assert.equal(first.detectorTime,firstFrame.t);
  h.video.currentTime=3;h.video.onseeking();await h.frame();h.result();
  const second=h.view.getState().attempts.at(-1);assert.equal(second.mediaTime,3);assert.equal(second.seekSegment,1);assert.equal(second.captureId,first.captureId);assert.ok(second.detectorTime>first.detectorTime);
  const select=h.root.querySelector('select');select.value='lesson-b';select.onchange();
  await h.begin();await h.ready();h.result();const latest=h.view.getState().attempts.at(-1);assert.notEqual(latest.captureId,first.captureId);assert.equal(latest.lessonId,'lesson-b');
  assert.deepEqual(h.view.getState().attempts[0],first);assert.deepEqual(cleanMirrorState(h.view.getState()).attempts[0],JSON.parse(JSON.stringify(first)));h.view.dispose();
});

test('mirror textarea and restoration retain the complete long observation',()=>{
  const h=harness();
  try{
    const input=h.root.querySelector('textarea');
    const reflection='Observation '.repeat(300)+'The last words matter.';
    input.value=reflection;input.oninput();
    const saved=JSON.parse(JSON.stringify(h.view.getState()));
    assert.equal(saved.reflection,reflection);
    h.view.setState(saved);
    assert.equal(input.value,reflection);
    assert.equal(h.view.getState().reflection,reflection);
  }finally{h.view.dispose();}
});

test('results in flight before seek are discarded',async()=>{
  const h=harness();await h.begin();await h.ready();h.video.onseeking();h.result();assert.equal(h.view.getState().attempts.length,0);h.view.dispose();
});

for(const mode of ['bitmap','transfer'])test(`${mode} failures stop after three tries with event/status and close owned bitmaps`,async()=>{
  const h=harness({bitmapFailure:mode==='bitmap',transferFailure:mode==='transfer'});await h.begin();await h.ready();await h.frame();await h.frame();
  assert.equal(h.bitmapCalls,3);assert.equal(h.workers[0].dead,true);assert.equal(h.raf.size,0);assert.match(h.root.querySelector('[data-status]').textContent,/tracking is unavailable/);
  assert.equal(h.events.filter(e=>e.type==='boxing.mirror.detector_error').length,1);assert.equal(h.events.at(-1).payload.frameFailures,3);
  assert.ok(h.bitmaps.every(b=>b.closed===1));h.view.dispose();
});

test('stale worker errors cannot terminate a replacement or mutate disposed UI',async()=>{
  const h=harness();await h.begin();const old=h.workers[0];await h.begin();const replacement=h.workers[1];const before=h.root.querySelector('[data-status]').textContent;
  old.onerror();assert.equal(replacement.dead,false);assert.equal(h.root.querySelector('[data-status]').textContent,before);
  h.view.dispose();const events=h.events.length;replacement.onerror();assert.equal(h.events.length,events);
});

test('worker echoes frame provenance and always closes bitmap on detector error',async()=>{
  const source=readFileSync(new URL('../public/boxing-mirror-worker.js',import.meta.url),'utf8');
  for(const throws of [false,true]){
    const self={},messages=[];let closed=0;
    const context=vm.createContext({self,postMessage:m=>messages.push(m),detector:{detectForVideo(){if(throws)throw Error('detector failed');return {landmarks:[[1]]};}}});
    vm.runInContext(source.replace('let pose;','let pose=detector;'),context);
    const origin={captureId:'capture-a',lessonId:'lesson-a',sourceMode:'local-video',mediaTime:3,seekSegment:1,detectorTime:100};
    await self.onmessage({data:{type:'frame',t:100,provenance:origin,bitmap:{close(){closed++;}}}});
    assert.equal(closed,1);assert.equal(messages[0].type,throws?'error':'landmarks');if(!throws)assert.equal(messages[0].provenance,origin);
  }
});

test('kept lesson observation retains frame provenance and the practice session together',()=>{
 const state=ready();Object.assign(state.attempts[0],{captureId:'capture1',sourceMode:'local-video',detectorTime:250,mediaTime:1.5,seekSegment:2});state.attempts.push(null);
 const saved=keepMirrorObservation(state,lesson,{id:'proof'});const event=saved.observations[0].attempts[0];
 assert.equal(event.sessionId,'s1');assert.equal(event.captureId,'capture1');assert.equal(event.lessonId,'guard');assert.equal(event.mediaTime,1.5);assert.equal(event.seekSegment,2);
 assert.deepEqual(cleanMirrorState(JSON.parse(JSON.stringify(saved))).observations[0].attempts[0],event);
});


test('lesson drafts and kept observation history preserve full learner text including whitespace',()=>{
 const s=ready(),reflection='  My extended observation.\n'.repeat(200)+'Keep this ending.  ';
 s.lessonProgress.guard.reflection=reflection;s.reflection=reflection;
 const kept=keepMirrorObservation(s,lesson,{id:'long-history'});
 assert.equal(kept.reflection,reflection);assert.equal(kept.lessonProgress.guard.reflection,reflection);assert.equal(kept.observations[0].reflection,reflection);
 const restored=cleanMirrorState(JSON.parse(JSON.stringify(kept)));assert.equal(restored.observations[0].reflection,reflection);
});

test('only approved authored attention can keep a reflection without a fabricated video opening',async()=>{
const {keepMirrorObservation}=await import('../public/boxing-mirror.js');
const lesson={id:'jai.attention',source:null,evidenceType:'jai_authored_reflection',cues:['Notice one body part.']};
const state={lessonProgress:{'jai.attention':{referenceOpenedAt:'',mirrorStartedAt:'now',reportedTried:true,reflection:'I noticed my feet.'}}};
const kept=keepMirrorObservation(state,lesson);assert.equal(kept.observations.length,1);assert.equal(kept.observations[0].referenceOpenedAt,'');
assert.equal(keepMirrorObservation(state,{...lesson,evidenceType:undefined}).observations.length,0);
assert.equal(keepMirrorObservation(state,{...lesson,source:undefined}).observations.length,0);
assert.equal(keepMirrorObservation({...state,lessonProgress:{'jai.attention':{...state.lessonProgress['jai.attention'],reportedTried:false}}},lesson).observations.length,0);
assert.equal(keepMirrorObservation({...state,lessonProgress:{'jai.attention':{...state.lessonProgress['jai.attention'],mirrorStartedAt:''}}},lesson).observations.length,0);
assert.equal(keepMirrorObservation({...state,lessonProgress:{'jai.attention':{...state.lessonProgress['jai.attention'],reflection:'   '}}},lesson).observations.length,0);
});
test('target drill estimates require exact anatomical hand, lesson and session; reports stay separate',async()=>{const {targetPunchProgress}=await import('../public/boxing-mirror.js');const l={id:'left',targetPunch:['HOOK','UPPERCUT'],targetHand:'L'};const a={lessonId:'left',sessionId:'s',hand:'L',type:'HOOK'};assert.deepEqual(targetPunchProgress({attempts:[a]},l,'s').map(x=>x.estimated),[true,false]);for(const bad of [{...a,hand:'R'},{...a,sessionId:'old'},{...a,lessonId:'other'}])assert.equal(targetPunchProgress({attempts:[bad]},l,'s')[0].estimated,false);assert.equal(targetPunchProgress({attempts:[a]},l,'')[0].estimated,false);const clean=cleanMirrorState({drillReports:[{lessonId:'left',reportedCompleted:true,mastery:true}]});assert.equal(clean.drillReports[0].evidenceType,'learner_report');assert.equal(clean.drillReports[0].mastery,undefined);});

test('drill achievements survive rolling event eviction and exact saved reopen',async()=>{
 const {newMirrorPractice,recordDrillAchievement,targetPunchProgress}=await import('../public/boxing-mirror.js');
 const l={id:'left',targetHand:'L',targetPunch:['UPPERCUT','HOOK']};
 let s=newMirrorPractice({},l,{id:'practice',startedAt:'now'});
 s.drillPractices[0].captures.push({captureId:'capture',sessionId:'session'});
 for(const type of l.targetPunch)s=recordDrillAchievement(s,l,{t:1,type,hand:'L',lessonId:l.id,captureId:'capture',sessionId:'session',sourceMode:'camera',detectorTime:10});
 const saved=structuredClone(s.drillPractices);
 s.attempts=Array.from({length:65},()=>({t:2,type:'JAB',hand:'L'}));s=cleanMirrorState(s);
 assert.deepEqual(targetPunchProgress(s,l,'session').map(t=>t.estimated),[true,true]);
 assert.deepEqual(s.drillPractices,saved);
 assert.deepEqual(cleanMirrorState(JSON.parse(JSON.stringify(s))),s);
 const retry=newMirrorPractice(s,l,{id:'retry'});
 assert.deepEqual(targetPunchProgress(retry,l,'session').map(t=>t.estimated),[false,false]);
 assert.deepEqual(retry.drillPractices[0],saved[0]);
});

test('drill evidence rejects wrong capture, session, lesson, hand and non-target shapes',async()=>{
 const {newMirrorPractice,recordDrillAchievement}=await import('../public/boxing-mirror.js');
 const l={id:'left',targetHand:'L',targetPunch:['UPPERCUT','HOOK']};
 const s=newMirrorPractice({},l,{id:'p'});s.drillPractices[0].captures.push({captureId:'c',sessionId:'s'});
 const good={t:1,type:'HOOK',hand:'L',lessonId:'left',captureId:'c',sessionId:'s'};
 for(const patch of [{captureId:'old'},{captureId:null},{sessionId:'old'},{lessonId:'other'},{hand:'R'},{type:'JAB'}])assert.equal(recordDrillAchievement(s,l,{...good,...patch}).drillPractices[0].achievements.length,0);
 const once=recordDrillAchievement(s,l,good);assert.equal(recordDrillAchievement(once,l,good).drillPractices[0].achievements.length,1);
 assert.equal(s.drillPractices[0].achievements.length,0);
});

test('capture-free reports have distinct practice IDs and retry clears current completion only',async()=>{
 const {newMirrorPractice,reportMirrorPractice}=await import('../public/boxing-mirror.js');
 const l={id:'left',targetHand:'L',targetPunch:['UPPERCUT','HOOK']};
 const input={lessonId:'left',reflection:' Exact words\n',sourceMode:'camera',lessonProgress:{left:{reflection:' Exact words\n',reportedTried:true,mirrorStartedAt:'old',sessionId:'old',referenceOpenedAt:'reference',sourceMode:'camera'}}};
 const a=newMirrorPractice(input,l,{id:'a',startedAt:'now'});
 assert.equal(a.lessonProgress.left.reportedTried,false);assert.equal(a.lessonProgress.left.mirrorStartedAt,'');assert.equal(a.lessonProgress.left.sessionId,'');assert.equal(a.sourceMode,null);
 assert.equal(a.reflection,input.reflection);assert.equal(a.lessonProgress.left.referenceOpenedAt,'reference');
 const reported=reportMirrorPractice(a,{recordedAt:'reported'});
 assert.equal(reported.drillReports[0].practiceId,'a');assert.equal(reported.drillReports[0].sessionId,'');
 assert.equal(reportMirrorPractice(reported).drillReports.length,1);
 const b=reportMirrorPractice(newMirrorPractice(reported,l,{id:'b'}));
 assert.deepEqual(b.drillReports.map(r=>r.practiceId),['a','b']);
 assert.deepEqual(b.drillReports[0],reported.drillReports[0]);
 assert.deepEqual(cleanMirrorState(JSON.parse(JSON.stringify(b))),b);
 assert.throws(()=>newMirrorPractice(b,l,{id:'a'}),/must be new/);
});

test('current target selects matching demonstration and advances without changing lesson refs',async()=>{
 const {newMirrorPractice,recordDrillAchievement,currentTargetSource}=await import('../public/boxing-mirror.js');
 const l={id:'left',targetHand:'L',targetPunch:['UPPERCUT','HOOK'],targetSources:{UPPERCUT:{url:'https://example.test/upper',embedUrl:'https://example.test/embed/upper',evidenceTimestampSeconds:2419,label:'Uppercut'},HOOK:{url:'https://example.test/hook',embedUrl:'https://example.test/embed/hook',evidenceTimestampSeconds:1824,label:'Hook'}}};
 const before=structuredClone(l);let s=newMirrorPractice({},l,{id:'p'});
 assert.deepEqual(currentTargetSource(s,l),{...l.targetSources.UPPERCUT,target:'UPPERCUT'});
 s.drillPractices[0].captures.push({captureId:'c',sessionId:'s'});
 s=recordDrillAchievement(s,l,{t:1,type:'UPPERCUT',hand:'L',lessonId:'left',captureId:'c',sessionId:'s'});
 assert.deepEqual(currentTargetSource(s,l),{...l.targetSources.HOOK,target:'HOOK'});
  assert.deepEqual(l,before);
});

test('mounted drill advances the actual source, retries stop capture, and late frames cannot complete retry',async()=>{
 const lesson={id:'left',targetHand:'L',targetPunch:['UPPERCUT','HOOK'],cues:['Lift','Turn'],targetSources:{UPPERCUT:{url:'https://example.test/upper',embedUrl:'https://example.test/embed/upper',label:'Upper'},HOOK:{url:'https://example.test/hook',embedUrl:'https://example.test/embed/hook',label:'Hook'}}};
 const h=harness({lessons:[lesson],punch:'UPPERCUT'});
 try{
  const first=h.view.newPractice();assert.equal(h.root.querySelector('aside a').href,lesson.targetSources.UPPERCUT.url);
  await h.begin();await h.ready();h.result();
  assert.equal(h.root.querySelector('aside a').href,lesson.targetSources.HOOK.url);
  h.root.querySelector('[data-watch]').onclick();
  assert.equal(h.root.querySelector('[data-lesson-player]').children[0].src,lesson.targetSources.HOOK.embedUrl);
  const oldWorker=h.workers.at(-1),old=JSON.parse(JSON.stringify(h.view.getState().drillPractices[0]));
  const retry=h.view.newPractice();assert.notEqual(retry,first);assert.equal(oldWorker.dead,true);
  h.result(oldWorker);
  const state=h.view.getState();assert.equal(state.drillPractices[1].achievements.length,0);
  assert.deepEqual(JSON.parse(JSON.stringify(state.drillPractices[0])),old);
  assert.equal(h.root.querySelector('aside a').href,lesson.targetSources.UPPERCUT.url);
  assert.equal(state.lessonProgress.left.reportedTried,false);assert.equal(state.lessonProgress.left.mirrorStartedAt,'');
  const saved=JSON.parse(JSON.stringify(state));h.view.setState(saved);assert.equal(h.view.getState().activeDrillId,retry);
 }finally{h.view.dispose();}
});
