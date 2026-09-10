import test from 'node:test';
import assert from 'node:assert/strict';
import {laneFromRects,fallingNote,compareGuidedStrike,mountPianoRoll} from '../public/piano-roll.js';
const target={exercise_id:'runaway-mn0103069-opening-two-strikes',quarter_bpm:60};

test('lanes use actual rendered key offsets and widths, including scroll and black keys',()=>{
  assert.deepEqual(laneFromRects({left:482.5,width:18.25},{left:100,width:900}),{x:382.5,width:18.25});
  assert.deepEqual(laneFromRects({left:82.5,width:18.25},{left:-300,width:900}),{x:382.5,width:18.25});
  assert.throws(()=>laneFromRects({left:0,width:0},{left:0,width:900}));
});
test('falling leading edge reaches the strike line at exact onset; tail at release',()=>{
  const n={start:1,end:3};
  assert.equal(fallingNote(n,1,200).strikeY,200);
  assert.equal(fallingNote(n,3,200).y,200);
  assert.ok(fallingNote(n,0,200).strikeY<200);
  assert.throws(()=>fallingNote(n,NaN,200));
});
test('feedback reports bounded cue differences without a score or mastery claim',()=>{
  assert.equal(compareGuidedStrike(88,1,0,target).timing_difference_seconds,0);
  assert.equal(compareGuidedStrike(88,3.4,1,target).timing,'late');
  assert.equal(compareGuidedStrike(88,.5,0,target).timing,'early');
  assert.equal(compareGuidedStrike(76,1,0,target).pitch_matches,false);
  assert.equal(compareGuidedStrike(88,7,2,target).status,'outside_excerpt');
  assert.ok(!('score' in compareGuidedStrike(88,1,0,target)));
  assert.throws(()=>compareGuidedStrike(999,1,0,target));
});

function harness(options={}){
  class Element {
    constructor(){this.style={};this.attrs={};this.children=[];this.queries=new Map();this.listeners=new Map();this.rect={left:0,top:0,width:20};}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=nodes;}
    setAttribute(k,v){this.attrs[k]=v;}
    getAttribute(k){return this.attrs[k];}
    querySelector(s){if(!this.queries.has(s))this.queries.set(s,new Element());return this.queries.get(s);}
    querySelectorAll(){return this.keys||[];}
    addEventListener(t,f){this.listeners.set(t,f);}
    removeEventListener(t){this.listeners.delete(t);}
    getBoundingClientRect(){return this.rect;}
    click(){this.clicks=(this.clicks||0)+1;this.listeners.get('click')?.();}
    remove(){this.removed=true;}
  }
  let milliseconds=0,callback=null;
  const win=new Element();win.performance={now:()=>milliseconds};win.matchMedia=()=>({matches:false});
  win.requestAnimationFrame=fn=>{callback=fn;return 1;};win.cancelAnimationFrame=()=>{callback=null;};
  const doc=new Element();doc.defaultView=win;doc.createElement=()=>new Element();doc.createElementNS=()=>new Element();
  const container=new Element();container.ownerDocument=doc;
  const keyboard=new Element();keyboard.rect={left:100,top:500,width:900};
  const key=new Element();key.attrs['aria-label']='E6, hold to play';key.rect={left:820,top:500,width:28};keyboard.keys=[key];
  const demos=[],events=[];const adapter={getState:()=>({practice_target:target}),demonstrate:async take=>{demos.push(take);}};
  const api=mountPianoRoll(container,{keyboard,adapter,onEvent:(...v)=>events.push(v),...options});
  return {api,container,keyboard,key,demos,events,win,root:container.children[0],tick(time){milliseconds=time;const fn=callback;callback=null;fn?.();},setTime(time){milliseconds=time;}};
}
test('mount is silent, aligned to real E6, and practice judges only forwarded real key events',async()=>{
  const h=harness();
  assert.equal(h.demos.length,0);assert.equal(h.events.length,0);
  assert.equal(h.root.querySelector('[data-lanes]').children[0].attrs.x,720);
  await h.api.start('practice');
  h.setTime(1000);h.api.event('performance.note_on',{midi:88});assert.equal(h.api.getState().observations.length,0);
  h.tick(3000);h.api.event('performance.note_on',{midi:88});
  h.api.event('performance.note_on',{midi:88});assert.equal(h.api.getState().observations.length,1);
  h.api.event('performance.note_off',{midi:88});h.tick(5000);h.api.event('performance.note_on',{midi:88});
  assert.equal(h.api.getState().observations[1].timing_difference_seconds,0);
  assert.equal(h.demos.length,0);h.api();assert.equal(h.root.removed,true);
});
test('Hear uses target demo, labels approximate clock, and never judges demonstration events',async()=>{
  const h=harness();await h.api.start('hear');
  assert.deepEqual(h.demos[0].events.map(e=>e.time),[1,3,3,5]);
  assert.match(h.root.querySelector('[data-feedback]').textContent,/approximate/);
  h.api.event('performance.note_on',{midi:88});assert.equal(h.api.getState().observations.length,0);
  const before=h.api.getState();assert.throws(()=>h.api.setTarget({...target,quarter_bpm:90}));assert.deepEqual(h.api.getState(),before);
  h.api.setTarget(null);assert.equal(h.api.getState().mode,'idle');assert.match(h.root.querySelector('[data-tempo]').textContent,/80 BPM/);
  h.key.rect.left=700;h.api.layout();assert.equal(h.root.querySelector('[data-lanes]').children[0].attrs.x,600);
  h.api();
});

test('supplied playback clock drives Hear instead of browser elapsed time',async()=>{
  let audioTime=10;
  const h=harness({getPlaybackClock:()=>({now:()=>audioTime,startTime:10})});
  await h.api.start('hear');assert.equal(h.api.getState().clock_kind,'audio_context');
  const lane=h.root.querySelector('[data-lanes]').children[0];
  audioTime=11;h.tick(90000);
  const bar=h.root.querySelector('[data-notes]').children[0];
  assert.ok(Math.abs(Number(bar.attrs.y)+Number(bar.attrs.height)-200)<1e-9);
  assert.equal(h.root.querySelector('[data-lanes]').children[0],lane);
  assert.equal(h.api.getState().mode,'hear');h.api();
});

test('missing rendered target disables guidance rather than inventing a lane',async()=>{
  const h=harness();h.keyboard.keys=[];h.api.layout();
  assert.equal(h.root.querySelector('[data-play]').disabled,true);
  await h.api.start('practice');assert.equal(h.api.getState().mode,'idle');
  assert.match(h.root.querySelector('[data-feedback]').textContent,/visible space/);h.api();
});

test('compact desktop lane clears the song title and idle Stop stays hidden',async()=>{
  const h=harness();
  h.container.querySelector('.piano-scene__title').rect={bottom:180};
  h.keyboard.rect.top=420;
  h.api.layout();
  assert.equal(h.root.style.top,'204px');
  assert.equal(h.root.querySelector('[data-stop]').hidden,true);
  await h.api.start('practice');
  assert.equal(h.root.querySelector('[data-stop]').hidden,false);
  h.api.stop();
  assert.equal(h.root.querySelector('[data-stop]').hidden,true);
  h.api();
});
