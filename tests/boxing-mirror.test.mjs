import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanMirrorState} from '../public/boxing-mirror.js';
import {createBoxingMemory} from '../public/learning-memory.js';
import {normalizeStoryWorldState} from '../public/story-world.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('mirror artifacts retain observations and estimated events, never raw frames',()=>{const s=cleanMirrorState({reflection:'I noticed my return',frames:[{private:true}],attempts:[{t:200,type:'JAB',hand:'L',power:99,landmarks:[1]},{t:NaN,type:'HOOK'}]});assert.equal(s.reflection,'I noticed my return');assert.deepEqual(s.attempts,[{t:200,type:'JAB',hand:'L',estimated:true,captureId:null,lessonId:null,sourceMode:null,detectorTime:null,mediaTime:null,seekSegment:null}]);assert.equal('frames' in s,false);});
test('mirror state bounds event history and excludes invalid modes',()=>{const s=cleanMirrorState({sourceMode:'remote-upload',attempts:Array.from({length:100},(_,i)=>({t:i,type:'CROSS',hand:'R'}))});assert.equal(s.sourceMode,null);assert.equal(s.attempts.length,60);assert.equal(s.attempts[0].t,40);});

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
function harness({bitmapFailure=false,transferFailure=false}={}) {
  class Element {
    constructor(){this.queries=new Map();this.children=[];this.classList={add(){},remove(){}};this.readyState=2;this.paused=true;this.currentTime=12;this.videoWidth=640;this.videoHeight=480;}
    querySelector(key){if(!this.queries.has(key))this.queries.set(key,new Element());return this.queries.get(key);}
    append(...nodes){this.children.push(...nodes);} replaceChildren(...nodes){this.children=nodes;}
    pause(){this.paused=true;} async play(){this.paused=false;} removeAttribute(){} remove(){}
    getContext(){return {clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}
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
    crypto:{randomUUID:()=>`capture-${++serial}`},performance:{now:()=>++tick},
    requestAnimationFrame:fn=>{const id=++serial;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),
    createImageBitmap:async()=>{bitmapCalls++;if(bitmapFailure)throw Error('bitmap failed');const bitmap={closed:0,close(){this.closed++;}};bitmaps.push(bitmap);return bitmap;},
    L:{shoulder:11},BONES:[],makeSmoother:()=>({update:points=>new Map(points.map((p,i)=>[i,p]))}),HandTracker:class {update(){return {type:'JAB'};}}
  });
  const container=new Element();const view=mount(container,{lessons:[{id:'lesson-a'},{id:'lesson-b'}],onEvent:(type,payload)=>events.push({type,payload})});
  const root=container.children[0],video=root.querySelector('.boxing-mirror-self');
  return {view,root,video,workers,events,bitmaps,raf,get bitmapCalls(){return bitmapCalls;},
    async begin(){const input=root.querySelector('input');input.files=[{}];input.onchange();await settle();},
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
