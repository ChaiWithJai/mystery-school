import test from 'node:test';
import assert from 'node:assert/strict';
import { pianoGeometry, normalizePianoState, performanceNotes, noteFrequency, noteName, mountPianoPractice } from '../public/piano-practice.js';

const take = { duration: 1.2, events: [{ type: 'on', midi: 60, time: .2 }, { type: 'off', midi: 60, time: .7 }, { type: 'on', midi: 63, time: .9 }, { type: 'off', midi: 63, time: 1.2 }] };

test('chromatic C3-C7 includes the written E6 opening register', () => {
  const keys = pianoGeometry();
  assert.equal(keys.length, 49);
  assert.equal(keys.filter(key => !key.black).length, 29);
  assert.equal(keys.filter(key => key.black).length, 20);
  assert.equal(keys[1].left, .69 / 29 * 100);
  assert.equal(keys[5].left, 3 / 29 * 100);
  assert.equal(keys.at(-1).midi, 96);
  assert.equal(noteName(48), 'C3'); assert.equal(noteName(96), 'C7');
  assert.equal(noteName(keys.find(key => key.midi === 88).midi), 'E6');
  assert.equal(normalizePianoState({duration:1,events:[{type:'on',midi:88,time:0},{type:'off',midi:88,time:1}]}).events[0].midi, 88);
  assert.throws(() => normalizePianoState({events:[{type:'on',midi:97,time:0}]}));
  assert.equal(noteFrequency(69), 440);
});

test('performance preserves silence, durations and actual pitch, with detached state', () => {
  assert.deepEqual(performanceNotes(take), [{ midi: 60, start: .2, end: .7 }, { midi: 63, start: .9, end: 1.2 }]);
  const copy = normalizePianoState(take); copy.events[0].midi = 84;
  assert.equal(take.events[0].midi, 60);
  assert.deepEqual(normalizePianoState(), { events: [], duration: 0, reference: null });
  assert.deepEqual(performanceNotes({duration: 1, events: [{type: 'on', midi: 60, time: .1}]}), [{midi:60,start:.1,end:1}]);
});

test('invalid timing, unmatched release, repeats, pitch and unsafe references rejected', () => {
  for (const value of [null, [], {duration: -1}, {duration: Infinity}, {events: [{type:'off',midi:60,time:0}]}, {events:[{type:'on',midi:47,time:0}]}, {events:[{type:'on',midi:60,time:0},{type:'on',midi:60,time:0}]}, {duration: 1,events:[{type:'on',midi:60,time:2}]}, {reference:{title:'x',url:'javascript:alert(1)'}}, {reference:{title:'x',url:'https://user:pass@example.com'}}]) assert.throws(() => normalizePianoState(value));
  assert.equal(normalizePianoState({reference:{title:' Reference ',url:'https://example.com/song'}}).reference.title, 'Reference');
});

function harness(t) {
  class Element {
    constructor() { this.children=[]; this.dataset={}; this.style={}; this.attributes={}; this.listeners=new Map(); this.queries=new Map(); }
    set innerHTML(value) { this.html=value; }
    querySelector(selector) { if (!this.queries.has(selector)) this.queries.set(selector,new Element()); return this.queries.get(selector); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children=children; }
    setAttribute(key,value) { this.attributes[key]=value; }
    addEventListener(type,fn) { if (!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn); }
    async fire(type,event={}) { for (const fn of this.listeners.get(type)||[]) await fn({preventDefault(){},...event}); await Promise.resolve(); }
    focus() {} contains(value) { return this.children.includes(value); } remove() { this.removed=true; }
  }
  const doc=new Element(); doc.createElement=()=>new Element();
  const win=new Element();
  const audio={contexts:[],oscillators:[],gains:[]};
  const param=()=>({values:[],setValueAtTime(...v){this.values.push(v);},linearRampToValueAtTime(...v){this.values.push(v);},cancelAndHoldAtTime(){}});
  class Audio {
    constructor(){this.state='running';this.currentTime=10;this.destination={};audio.contexts.push(this);}
    createOscillator(){const v={frequency:param(),connect(){},disconnect(){},start(time){this.startTime=time;},stop(time){this.stopTime=time;this.stopped=true;}};audio.oscillators.push(v);return v;}
    createGain(){const v={gain:param(),connect(){},disconnect(){}};audio.gains.push(v);return v;}
    close(){this.state='closed';return Promise.resolve();}
  }
  for (const [name,value] of Object.entries({document:doc,AudioContext:Audio,addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win)})) {
    const original=Object.getOwnPropertyDescriptor(globalThis,name); Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];});
  }
  const host=new Element();
  return {host,audio,win,find:selector=>host.children[0].querySelector(selector)};
}

test('mount never starts audio, full-state callback and atomic setter/cleanup', async t => {
  const h=harness(t);const changes=[];const events=[];
  const api=mountPianoPractice(h.host,{onChange:s=>changes.push(s),onEvent:(...args)=>events.push(args)});
  t.after(api);
  assert.equal(changes.length,1);assert.equal(events.length,0);assert.equal(h.audio.contexts.length,0);
  api.setState(take);assert.deepEqual(api.getState(),normalizePianoState(take));
  assert.throws(()=>api.setState({duration:-1}));assert.deepEqual(api.getState(),normalizePianoState(take));
  const state=api.getState();state.events.length=0;assert.equal(api.getState().events.length,4);
  api();api();assert.throws(()=>api.setState(take));
});

test('play-first capture starts on a key and preserves the previous take when resumed', async t => {
  const h=harness(t);const events=[];
  const api=mountPianoPractice(h.host,{autoCapture:true,initialState:take,onEvent:(...args)=>events.push(args)});
  assert.equal(h.audio.contexts.length,0);
  const key=h.find('.piano-practice__keyboard').children[12];
  await key.fire('pointerdown',{button:0,pointerId:1});
  await key.fire('pointerup',{pointerId:1});
  await h.find('[data-stop]').fire('click');
  assert.deepEqual(api.getState().events.slice(0,4),take.events);
  assert.equal(api.getState().events.length,6);
  assert.ok(api.getState().events[4].time>=take.duration);
  assert.deepEqual(events.find(([type])=>type==='record_start')[1],{source:'key_press',resumed:true});
  api();
});

test('initial markup is instrument-first with only three primary controls and collapsed options', t => {
  const h=harness(t);const api=mountPianoPractice(h.host);
  const markup=h.host.children[0].html;
  const visible=markup.slice(0,markup.indexOf('<details'));
  assert.equal((visible.match(/<button /g)||[]).length,3);
  assert.ok(visible.indexOf('piano-practice__keyboard')<visible.indexOf('data-record'));
  assert.ok(!visible.includes('<input'));
  assert.ok(!markup.includes('<details open'));
  assert.ok(markup.indexOf('data-reset')>markup.indexOf('<details'));
  api();
});

test('pointer hold/release records real ordered timestamps and replay schedules that take', async t => {
  const h=harness(t);const changes=[];const api=mountPianoPractice(h.host,{onChange:s=>changes.push(s)});t.after(api);
  await h.find('[data-record]').fire('click');
  const key=h.find('.piano-practice__keyboard').children[12];
  await key.fire('pointerdown',{button:0,pointerId:1});
  assert.equal(h.audio.oscillators.length,1);assert.equal(key.attributes['aria-pressed'],'true');
  assert.equal(h.audio.oscillators[0].stopped,undefined);
  await key.fire('pointerup',{pointerId:1});
  assert.equal(h.audio.oscillators[0].stopped,true);
  await h.find('[data-stop]').fire('click');
  const captured=api.getState();assert.deepEqual(captured.events.map(e=>[e.type,e.midi]),[['on',60],['off',60]]);
  assert.ok(captured.events[1].time>=captured.events[0].time);
  api.setState(take);await h.find('[data-replay]').fire('click');
  assert.equal(h.audio.oscillators.length,3);
  assert.ok(Math.abs(h.audio.oscillators[1].startTime-10.24)<1e-10);
  assert.ok(Math.abs(h.audio.oscillators[1].stopTime-10.805)<1e-10);
  assert.equal(h.audio.oscillators[2].frequency.values[0][0],noteFrequency(63));
  api();assert.equal(h.audio.contexts[0].state,'closed');
});

test('computer repeat does not retrigger, global release and blur end held keys', async t => {
  const h=harness(t);const api=mountPianoPractice(h.host);t.after(api);
  const keyboard=h.find('.piano-practice__keyboard');
  await keyboard.fire('keydown',{key:'a',repeat:false});
  await keyboard.fire('keydown',{key:'a',repeat:true});assert.equal(h.audio.oscillators.length,1);
  await h.win.fire('keyup',{key:'a'});assert.equal(h.audio.oscillators[0].stopped,true);
  await keyboard.fire('keydown',{key:'w',repeat:false});await h.win.fire('blur');assert.equal(h.audio.oscillators[1].stopped,true);
  api();
});

test('explicit notation demonstration schedules E6 without replacing the learner take', async t => {
  const h=harness(t);const events=[];
  const api=mountPianoPractice(h.host,{initialState:take,onEvent:(type,payload)=>events.push({type,payload})});t.after(api);
  const before=api.getState();
  await api.demonstrate({duration:3.75,events:[{type:'on',midi:88,time:.75},{type:'off',midi:88,time:2.25},{type:'on',midi:88,time:2.25},{type:'off',midi:88,time:3.75}]});
  assert.deepEqual(api.getState(),before);
  assert.equal(h.audio.oscillators.length,2);
  assert.equal(h.audio.oscillators[0].frequency.values[0][0],noteFrequency(88));
  assert.ok(Math.abs(h.audio.oscillators[1].startTime-h.audio.oscillators[0].startTime-1.5)<1e-10);
  assert.equal(events.find(event=>event.type==='play').payload.source,'notation_exercise');
  api();
  await assert.rejects(api.demonstrate(take),/closed/);
});

test('performance editor publishes changed pitch/timing and reset removes own take', async t => {
  const h=harness(t);const api=mountPianoPractice(h.host,{initialState:take});t.after(api);
  await h.find('[data-editor]').fire('change',{target:{dataset:{index:'1',field:'midi'},value:'66'}});
  assert.equal(api.getState().events[2].midi,66);
  await h.find('[data-editor]').fire('change',{target:{dataset:{index:'1',field:'end'},value:'0'}});
  assert.equal(api.getState().events[3].time,1.2);
  assert.equal(h.find('[data-error]').hidden,false);
  await h.find('[data-reset]').fire('click');assert.equal(api.getState().events.length,0);
  api();
});
