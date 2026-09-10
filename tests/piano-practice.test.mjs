import test from 'node:test';
import assert from 'node:assert/strict';
import { pianoGeometry, normalizePianoState, performanceNotes, noteFrequency, noteName, mountPianoPractice, physicalPianoKey } from '../public/piano-practice.js';

const take = { duration: 1.2, events: [{ type: 'on', midi: 60, time: .2 }, { type: 'off', midi: 60, time: .7 }, { type: 'on', midi: 63, time: .9 }, { type: 'off', midi: 63, time: 1.2 }] };

test('physical map is deterministic and excludes typing, modifiers and composition', () => {
  assert.equal(physicalPianoKey({code:'KeyL',key:'x'},'runaway').midi,88);
  assert.equal(physicalPianoKey({code:'KeyL',key:'l'}).midi,74);
  for(const modifier of ['ctrlKey','altKey','metaKey','shiftKey','isComposing','defaultPrevented']) assert.equal(physicalPianoKey({code:'KeyL',[modifier]:true},'runaway'),null);
  assert.equal(physicalPianoKey({code:'KeyL',target:{closest:()=>({})}},'runaway'),null);
  assert.equal(physicalPianoKey({code:'KeyL',target:{isContentEditable:true}},'runaway'),null);
});

test('Runaway L plays from Close-panel focus; release ignores new modifiers and cleanup detaches', async t => {
  const h=harness(t);const api=mountPianoPractice(h.host,{keyboardMap:'runaway',autoCapture:true});
  const close={closest:selector=>selector==='#drawer'?{}:selector.startsWith('button')?{}:null};
  await h.win.fire('keydown',{code:'KeyL',key:'l',target:close});
  assert.equal(api.getState().events.at(-1).midi,88);
  assert.equal(h.audio.oscillators[0].frequency.values[0][0],noteFrequency(88));
  await h.win.fire('keyup',{code:'KeyL',key:'L',shiftKey:true});
  assert.equal(api.getState().events.at(-1).type,'off');
  const e6=h.find('.piano-practice__keyboard').children[40];
  assert.equal(e6.attributes['aria-keyshortcuts'],'l');
  api();await h.win.fire('keydown',{code:'KeyL',key:'l'});assert.equal(h.audio.oscillators.length,6);
});

test('released first tap survives delayed audio resume and ended taps do not accumulate gain penalties', async t => {
  const h=harness(t);const Base=globalThis.AudioContext;let unlock;
  globalThis.AudioContext=class extends Base {constructor(){super();this.state='suspended';}resume(){return new Promise(resolve=>{unlock=()=>{this.state='running';resolve();};});}};
  const api=mountPianoPractice(h.host,{keyboardMap:'runaway',autoCapture:true});
  h.cleanups.push(api);
  await h.win.fire('keydown',{code:'KeyL',key:'l'});
  await h.win.fire('keyup',{code:'KeyL',key:'l'});
  assert.equal(h.audio.oscillators.length,0);
  const recorded=JSON.stringify(api.getState().events);unlock();for(let i=0;i<20;i++) await Promise.resolve();
  assert.equal(h.audio.oscillators.length,6);assert.equal(h.audio.oscillators[0].stopped,true);
  assert.equal(JSON.stringify(api.getState().events),recorded);
  for (const oscillator of h.audio.oscillators) oscillator.onended();
  await h.win.fire('keydown',{code:'KeyL',key:'l'});
  assert.equal(h.audio.gains[0].gain.values[1][0],.04);
  assert.equal(h.audio.gains[7].gain.values[1][0],.04);
  api();
});

test('sequential replay notes use identical gain instead of cumulative scheduled count', async t => {
  const h=harness(t);const api=mountPianoPractice(h.host);
  await api.demonstrate(take);
  assert.equal(h.audio.gains[0].gain.values[1][0],.04);
  assert.equal(h.audio.gains[7].gain.values[1][0],.04);
  api();
});

test('hammer attack has decaying stretched partials, bounded gain and complete release cleanup', async t => {
  const h=harness(t);const api=mountPianoPractice(h.host,{keyboardMap:'runaway'});
  await h.win.fire('keydown',{code:'KeyL'});
  assert.equal(h.audio.oscillators.length,6);
  assert.ok(h.audio.oscillators.every(oscillator=>oscillator.type==='sine'));
  assert.equal(h.audio.oscillators[0].frequency.values[0][0],noteFrequency(88));
  assert.ok(h.audio.oscillators[5].frequency.values[0][0]>noteFrequency(88)*6);
  assert.deepEqual(h.audio.gains[0].gain.values,[[0,10],[.04,10.004]]);
  const partials=h.audio.gains.slice(1);
  assert.ok(Math.abs(partials.reduce((sum,p)=>sum+p.gain.values[0][0],0)-1)<1e-12);
  for (const part of partials) {
    assert.equal(part.gain.exponential[0][0],part.gain.values[0][0]*.001);
    assert.ok(part.gain.exponential[0][1]>10);
  }
  assert.ok(partials[5].gain.exponential[0][1]<partials[0].gain.exponential[0][1]);
  h.audio.contexts[0].currentTime=10.5;
  await h.win.fire('keyup',{code:'KeyL'});
  assert.deepEqual(h.audio.gains[0].gain.holds,[10.5]);
  assert.deepEqual(h.audio.gains[0].gain.values.at(-1),[0,10.56]);
  assert.ok(h.audio.oscillators.every(oscillator=>oscillator.stopTime===10.565));
  for (const oscillator of h.audio.oscillators) oscillator.onended();
  assert.ok(h.audio.oscillators.every(oscillator=>oscillator.disconnected));
  assert.ok(h.audio.gains.every(gain=>gain.disconnected));
  api();
});

test('stop cancels every partial of scheduled demonstration without changing the take', async t => {
  const h=harness(t);const api=mountPianoPractice(h.host,{initialState:take});
  await api.demonstrate(take);
  await h.find('[data-stop]').fire('click');
  assert.equal(h.audio.oscillators.length,12);
  assert.ok(h.audio.oscillators.every(oscillator=>oscillator.stopped && oscillator.stopTime===undefined));
  for(const oscillator of h.audio.oscillators) oscillator.onended();
  assert.ok(h.audio.gains.every(gain=>gain.disconnected));
  assert.deepEqual(api.getState(),normalizePianoState(take));
  assert.equal(api.getPlaybackClock(),null);
  api();
});

test('local sample preloads without audio and E6 demo decodes on gesture at one-semitone rate', async t => {
  const h=harness(t);const requests=[];const events=[];
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};};
  const api=mountPianoPractice(h.host,{initialState:take,onEvent:(type,payload)=>events.push({type,payload})});
  await Promise.resolve();await Promise.resolve();
  assert.equal(requests[0].url,'/audio/piano/Ds6.mp3');
  assert.equal(h.audio.contexts.length,0);assert.equal(h.audio.decodes,0);
  const demo={duration:1,events:[{type:'on',midi:88,time:.2},{type:'off',midi:88,time:1}]};
  await api.demonstrate(demo);
  assert.equal(h.audio.decodes,1);assert.equal(h.audio.oscillators.length,0);
  assert.equal(h.audio.buffers.length,1);
  const source=h.audio.buffers[0];
  assert.equal(source.playbackRate.values[0][0],2**(1/12));
  assert.deepEqual(events.find(event=>event.type==='audio_voice').payload,{midi:88,timbre:'sampled_piano',sample:'/audio/piano/Ds6.mp3',source_midi:87,playback_rate:2**(1/12),scheduled_start:source.startTime});
  assert.ok(Math.abs(source.startTime-10.24)<1e-10);
  assert.equal(api.getPlaybackClock().startTime,10.04);
  assert.deepEqual(api.getState(),normalizePianoState(take));
  assert.match(h.find('[data-timbre]').textContent,/Alexander Holm/);
  await h.find('[data-stop]').fire('click');source.onended();
  assert.equal(source.disconnected,true);assert.equal(h.audio.gains[0].disconnected,true);
  api();assert.equal(requests[0].options.signal.aborted,true);
});

test('live E6 bounds sample decoding to 150ms and keeps original recorded input', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness(t);let finishDecode;
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  const Base=globalThis.AudioContext;
  globalThis.AudioContext=class extends Base {decodeAudioData(){return new Promise(resolve=>{finishDecode=resolve;});}};
  const api=mountPianoPractice(h.host,{keyboardMap:'runaway',autoCapture:true});
  await h.win.fire('keydown',{code:'KeyL'});
  assert.equal(h.audio.oscillators.length,0);
  await h.win.fire('keyup',{code:'KeyL'});
  const before=JSON.stringify(api.getState());
  t.mock.timers.tick(150);await Promise.resolve();await Promise.resolve();
  assert.equal(h.audio.oscillators.length,6);
  for(let i=0;i<10 && !finishDecode;i++) await Promise.resolve();
  assert.equal(typeof finishDecode,'function');finishDecode({duration:4});
  await Promise.resolve();await Promise.resolve();
  assert.equal(JSON.stringify(api.getState()),before);
  await h.win.fire('keydown',{code:'KeyL'});
  assert.equal(h.audio.buffers.length,1);
  await h.win.fire('keyup',{code:'KeyL'});
  assert.equal(h.audio.buffers[0].stopTime,10.065);
  api();
});

test('failed sample decoding explicitly falls back to synthesis', async t => {
  const h=harness(t);const events=[];
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  const Base=globalThis.AudioContext;
  globalThis.AudioContext=class extends Base {decodeAudioData(){return Promise.reject(new Error('Bad MP3'));}};
  const api=mountPianoPractice(h.host,{onEvent:(type,payload)=>events.push({type,payload})});
  await api.demonstrate({duration:1,events:[{type:'on',midi:88,time:0},{type:'off',midi:88,time:1}]});
  assert.equal(h.audio.buffers.length,0);assert.equal(h.audio.oscillators.length,6);
  assert.match(h.find('[data-timbre]').textContent,/unavailable/);
  assert.equal(events.filter(event=>event.type==='audio_voice').length,1);
  assert.equal(events.find(event=>event.type==='audio_voice').payload.timbre,'synthesized');
  assert.equal(events.find(event=>event.type==='audio_voice').payload.sample,null);
  api();
});

test('first released E6 tap uses sample when decoding finishes inside the bounded wait', async t => {
  const h=harness(t);let finishDecode;
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  const Base=globalThis.AudioContext;
  globalThis.AudioContext=class extends Base {decodeAudioData(){return new Promise(resolve=>{finishDecode=resolve;});}};
  const api=mountPianoPractice(h.host,{keyboardMap:'runaway',autoCapture:true});h.cleanups.push(api);
  await h.win.fire('keydown',{code:'KeyL'});await h.win.fire('keyup',{code:'KeyL'});
  const before=JSON.stringify(api.getState());
  assert.equal(h.audio.oscillators.length,0);assert.equal(h.audio.buffers.length,0);
  finishDecode({duration:4});for(let i=0;i<20;i++) await Promise.resolve();
  assert.equal(h.audio.buffers.length,1);assert.equal(h.audio.oscillators.length,0);
  assert.equal(h.audio.buffers[0].playbackRate.values[0][0],2**(1/12));
  assert.ok(h.audio.buffers[0].stopTime>10);
  assert.equal(JSON.stringify(api.getState()),before);
});

test('cleanup during first-key decode wait cancels pending sound and late decoding', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness(t);let finishDecode;
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  const Base=globalThis.AudioContext;
  globalThis.AudioContext=class extends Base {decodeAudioData(){return new Promise(resolve=>{finishDecode=resolve;});}};
  const api=mountPianoPractice(h.host,{keyboardMap:'runaway'});
  await h.win.fire('keydown',{code:'KeyL'});api();
  finishDecode({duration:4});t.mock.timers.tick(5000);
  for(let i=0;i<20;i++) await Promise.resolve();
  assert.equal(h.audio.buffers.length,0);assert.equal(h.audio.oscillators.length,0);
  assert.equal(h.audio.contexts[0].state,'closed');
});

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
  const cleanups=[];
  t.after(()=>{for(const cleanup of cleanups) cleanup();});
  class Element {
    constructor() { this.children=[]; this.dataset={}; this.style={}; this.attributes={}; this.listeners=new Map(); this.queries=new Map(); }
    set innerHTML(value) { this.html=value; }
    querySelector(selector) { if (!this.queries.has(selector)) this.queries.set(selector,new Element()); return this.queries.get(selector); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children=children; }
    setAttribute(key,value) { this.attributes[key]=value; }
    addEventListener(type,fn) { if (!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn); }
    async fire(type,event={}) { for (const fn of this.listeners.get(type)||[]) await fn({preventDefault(){},...event}); for(let i=0;i<20;i++) await Promise.resolve(); }
    focus() {} contains(value) { return this.children.includes(value); } remove() { this.removed=true; }
  }
  const doc=new Element(); doc.createElement=()=>new Element();
  const win=new Element();
  const audio={contexts:[],oscillators:[],gains:[],buffers:[],decodes:0};
  const param=()=>({values:[],exponential:[],holds:[],setValueAtTime(...v){this.values.push(v);},linearRampToValueAtTime(...v){this.values.push(v);},exponentialRampToValueAtTime(...v){this.exponential.push(v);},cancelAndHoldAtTime(time){this.holds.push(time);}});
  class Audio {
    constructor(){this.state='running';this.currentTime=10;this.destination={};audio.contexts.push(this);}
    createOscillator(){const v={frequency:param(),connect(){},disconnect(){this.disconnected=true;},start(time){this.startTime=time;},stop(time){this.stopTime=time;this.stopped=true;}};audio.oscillators.push(v);return v;}
    createGain(){const v={gain:param(),connect(){},disconnect(){this.disconnected=true;}};audio.gains.push(v);return v;}
    decodeAudioData(){audio.decodes++;return Promise.resolve({duration:4});}
    createBufferSource(){const v={playbackRate:param(),connect(){},disconnect(){this.disconnected=true;},start(time){this.startTime=time;},stop(time){this.stopTime=time;}};audio.buffers.push(v);return v;}
    close(){this.state='closed';return Promise.resolve();}
  }
  for (const [name,value] of Object.entries({document:doc,AudioContext:Audio,fetch:async()=>({ok:false}),addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win)})) {
    const original=Object.getOwnPropertyDescriptor(globalThis,name); Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];});
  }
  const host=new Element();
  return {host,audio,win,cleanups,find:selector=>host.children[0].querySelector(selector)};
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
  assert.equal(api.getState().duration,api.getState().events.at(-1).time);
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
  assert.equal(h.audio.oscillators.length,6);assert.equal(key.attributes['aria-pressed'],'true');
  assert.ok(h.audio.oscillators[0].stopTime>12);
  await key.fire('pointerup',{pointerId:1});
  assert.equal(h.audio.oscillators[0].stopped,true);
  await h.find('[data-stop]').fire('click');
  const captured=api.getState();assert.deepEqual(captured.events.map(e=>[e.type,e.midi]),[['on',60],['off',60]]);
  assert.ok(captured.events[1].time>=captured.events[0].time);
  api.setState(take);await h.find('[data-replay]').fire('click');
  assert.equal(h.audio.oscillators.length,18);
  assert.ok(Math.abs(h.audio.oscillators[6].startTime-10.24)<1e-10);
  assert.ok(Math.abs(h.audio.oscillators[6].stopTime-10.805)<1e-10);
  assert.equal(h.audio.oscillators[12].frequency.values[0][0],noteFrequency(63));
  api();assert.equal(h.audio.contexts[0].state,'closed');
});

test('computer repeat does not retrigger, global release and blur end held keys', async t => {
  const h=harness(t);const api=mountPianoPractice(h.host);t.after(api);
  const keyboard=h.find('.piano-practice__keyboard');
  await h.win.fire('keydown',{key:'a',repeat:false});
  await h.win.fire('keydown',{key:'a',repeat:true});assert.equal(h.audio.oscillators.length,6);
  await h.win.fire('keyup',{key:'a'});assert.equal(h.audio.oscillators[0].stopped,true);
  await h.win.fire('keydown',{key:'w',repeat:false});await h.win.fire('blur');assert.equal(h.audio.oscillators[6].stopped,true);
  api();
});

test('explicit notation demonstration schedules E6 without replacing the learner take', async t => {
  const h=harness(t);const events=[];
  const api=mountPianoPractice(h.host,{initialState:take,onEvent:(type,payload)=>events.push({type,payload})});t.after(api);
  const before=api.getState();
  assert.equal(api.getPlaybackClock(),null);
  await api.demonstrate({duration:3.75,events:[{type:'on',midi:88,time:.75},{type:'off',midi:88,time:2.25},{type:'on',midi:88,time:2.25},{type:'off',midi:88,time:3.75}]});
  assert.deepEqual(api.getState(),before);
  assert.equal(h.audio.oscillators.length,12);
  assert.equal(h.audio.oscillators[0].frequency.values[0][0],noteFrequency(88));
  assert.ok(Math.abs(h.audio.oscillators[6].startTime-h.audio.oscillators[0].startTime-1.5)<1e-10);
  assert.equal(events.find(event=>event.type==='play').payload.source,'notation_exercise');
  const clock=api.getPlaybackClock();
  assert.ok(Object.isFrozen(clock));
  assert.deepEqual(Object.keys(clock).sort(),['now','startTime']);
  assert.equal(clock.startTime,10.04);
  assert.equal(clock.now(),10);
  h.audio.contexts[0].currentTime=11.5;
  assert.equal(clock.now(),11.5);
  api();
  assert.equal(api.getPlaybackClock(),null);
  await assert.rejects(api.demonstrate(take),/closed/);
});

test('clock clears on stop, own-attempt playback and natural demo completion', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness(t);const api=mountPianoPractice(h.host,{initialState:take});
  await api.demonstrate(take);assert.ok(api.getPlaybackClock());
  await h.find('[data-stop]').fire('click');assert.equal(api.getPlaybackClock(),null);
  await api.demonstrate(take);await h.find('[data-replay]').fire('click');assert.equal(api.getPlaybackClock(),null);
  await api.demonstrate(take);assert.ok(api.getPlaybackClock());
  t.mock.timers.tick(2000);assert.equal(api.getPlaybackClock(),null);
  api();
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
