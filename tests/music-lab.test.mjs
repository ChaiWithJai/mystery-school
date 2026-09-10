import test from 'node:test';
import assert from 'node:assert/strict';
import { attackSlope, envelopeAt, envelopePoints, normalizeMusicState, validateMusicState, musicSchedule, mountMusicLab, NOTE_DURATION } from '../public/music-lab.js';

test('linear attack slope is 1 / attack in normalized amplitude per second', () => {
  assert.equal(attackSlope(.02), 50);
  assert.equal(attackSlope(.2), 5);
  assert.equal(attackSlope(.8), 1.25);
});

test('each allowed attack reaches 1 at attack time and keeps a fixed note length', () => {
  for (const attack of [.02, .125, .35, .8]) {
    assert.deepEqual(envelopePoints(attack), [
      { time: 0, amplitude: 0 }, { time: attack, amplitude: 1 },
      { time: .92, amplitude: 1 }, { time: 1.1, amplitude: 0 },
    ]);
    assert.equal(envelopeAt(attack / 2, attack), .5);
    assert.equal(envelopeAt(attack, attack), 1);
    assert.equal(envelopeAt(.92, attack), 1);
    assert.ok(Math.abs(envelopeAt(1.01, attack) - .5) < 1e-12);
    assert.equal(envelopeAt(NOTE_DURATION, attack), 0);
  }
});

test('silence before and after a note; normalized amplitude stays bounded', () => {
  for (const attack of [.02, .35, .8]) {
    assert.equal(envelopeAt(-1, attack), 0);
    assert.equal(envelopeAt(0, attack), 0);
    assert.equal(envelopeAt(2, attack), 0);
    for (let i = 0; i <= 120; i++) {
      const amplitude = envelopeAt(i / 100, attack);
      assert.ok(amplitude >= 0 && amplitude <= 1);
    }
  }
});

test('initial state preserves a fractional attack and derives no caller-supplied fields', () => {
  assert.deepEqual(normalizeMusicState(), { attack: .02, tempo: 100, notes: [60, 64, 67, 72].map(midi => ({midi, beats: 2})) });
  const input = { attack: .125, slope: 999, mastery: true };
  assert.deepEqual(normalizeMusicState(input), {...normalizeMusicState(), attack: .125});
  assert.equal(input.slope, 999);
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeMusicState(input))), {...normalizeMusicState(), attack: .125});
});

test('invalid attacks, times, and initial states fail explicitly', () => {
  for (const invalid of [0, .019, .801, -1, NaN, Infinity, '0.2', null]) {
    assert.throws(() => attackSlope(invalid), RangeError);
    assert.throws(() => envelopePoints(invalid), RangeError);
    assert.throws(() => envelopeAt(.1, invalid), RangeError);
    assert.throws(() => normalizeMusicState({ attack: invalid }), RangeError);
  }
  for (const time of [NaN, Infinity, '0.2']) assert.throws(() => envelopeAt(time, .2), RangeError);
  for (const state of [null, [], .2, 'hello']) assert.throws(() => normalizeMusicState(state), TypeError);
});

test('envelope point arrays are independent between callers', () => {
  const points = envelopePoints(.2); points[1].amplitude = 42;
  assert.equal(envelopePoints(.2)[1].amplitude, 1);
});

test('playable keys follow edited pitch and rhythm without changing the saved phrase', async () => {
  const {host, audio, find} = harness(); const events = [];
  const cleanup = mountMusicLab(host, {onEvent: (type, metadata) => events.push({type, metadata})});
  const state = normalizeMusicState({attack: .4, tempo: 120, notes: [{midi: 69, beats: 1}, {midi: 74, beats: 3}]});
  cleanup.setState(state);
  const phrase = find('music-lab__phrase'); const key = phrase.children[1];
  await phrase.fire('click', {target: key});
  assert.equal(audio.oscillators.length, 1);
  assert.equal(events.at(-1).metadata.notes[0].midi, 74);
  assert.equal(events.at(-1).metadata.notes[0].start, 0);
  assert.equal(events.at(-1).metadata.duration_seconds, 1.375);
  assert.equal(events.at(-1).metadata.attack, .4);
  assert.equal(phrase.children[1], key);
  assert.deepEqual(cleanup.getState(), state);
  await find('music-lab__after').fire('click');
  assert.equal(events.at(-1).metadata.notes.length, 2);
  assert.equal(audio.oscillators[0].disconnected, true);
  const slider = find('music-lab__slider'); slider.value = '.3';
  await slider.fire('input'); await slider.fire('input');
  assert.equal(events.at(-2).metadata.reason, 'edited');
  assert.deepEqual(events.at(-1), {type: 'attack.change', metadata: {source_kind: 'synthesized_phrase', previous_attack: .4, attack: .3}});
  assert.deepEqual(cleanup.getState().notes, state.notes);
  assert.equal(cleanup.getState().tempo, 120);
  cleanup();
});

function harness() {
  const audio = { contexts: [], gains: [], oscillators: [] };
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.listeners = new Map(); this.attributes = {}; this.ownerDocument = doc; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
    removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
    async fire(name, event = {}) { for (const callback of this.listeners.get(name) || []) await callback(event); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const parameter = () => ({ values: [], setValueAtTime(...value) { this.values.push(['set', ...value]); }, linearRampToValueAtTime(...value) { this.values.push(['linear', ...value]); } });
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 1; this.destination = {}; audio.contexts.push(this); }
    createGain() { const gain = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } }; audio.gains.push(gain); return gain; }
    createOscillator() { const oscillator = { frequency: parameter(), connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; } }; audio.oscillators.push(oscillator); return oscillator; }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  const doc = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag), defaultView: { AudioContext, setTimeout: () => 1, clearTimeout() {} } };
  const host = new Element('main');
  const find = (className, root = host) => root.className?.split(' ').includes(className) ? root : root.children.map(child => find(className, child)).find(Boolean);
  return { host, audio, find };
}

test('mount publishes state without audio/events; before/after attacks and cleanup are correct', async () => {
  const { host, audio, find } = harness();
  const sentinel = host.ownerDocument.createElement('aside'); host.append(sentinel);
  const changes = [], events = [];
  const cleanup = mountMusicLab(host, { initialState: { attack: .125 }, onChange: value => changes.push(value), onEvent: (type, metadata) => events.push({ type, metadata }) });
  assert.equal(audio.contexts.length, 0); assert.deepEqual(changes, [normalizeMusicState({ attack: .125 })]); assert.equal(events.length, 0);
  assert.equal(find('music-lab__slider').value, '0.125');
  await find('music-lab__before').fire('click');
  assert.equal(audio.contexts.length, 1); assert.equal(audio.oscillators.length, 4);
  assert.equal(events.at(-1).type, 'play'); assert.equal(events.at(-1).metadata.attack, .02);
  assert.equal(events.at(-1).metadata.duration_seconds, 4.7);
  assert.equal(audio.gains[0].gain.value, .05);
  assert.ok(Math.abs(audio.gains[1].gain.values[1][2] - 1.05) < 1e-12);
  await find('music-lab__after').fire('click');
  assert.equal(events.at(-2).type, 'stop'); assert.equal(events.at(-2).metadata.reason, 'replaced');
  assert.equal(events.at(-1).metadata.attack, .125);
  assert.ok(Math.abs(audio.gains[6].gain.values[1][2] - 1.155) < 1e-12);
  await find('music-lab__stop').fire('click');
  assert.equal(events.at(-1).metadata.reason, 'requested');
  const slider = find('music-lab__slider');
  const count = events.length; cleanup(); cleanup();
  assert.deepEqual(host.children, [sentinel]); assert.equal(audio.contexts[0].state, 'closed');
  slider.value = '.4'; await slider.fire('input');
  assert.equal(changes.length, 1); assert.equal(events.length, count);
});

test('guidance is optional, changes full serializable state, and rejection restores the learner choice', async () => {
  const { host, audio, find } = harness(); const changes = [], events = [];
  const cleanup = mountMusicLab(host, { initialState: { attack: .125 }, onChange: value => changes.push(value), onEvent: (type, metadata) => events.push({ type, ...metadata }) });
  await find('music-lab__try').fire('click');
  assert.deepEqual(changes.at(-1), normalizeMusicState({ attack: .35 })); assert.equal(events.at(-1).action, 'try');
  const slider = find('music-lab__slider'); slider.value = '.4'; await slider.fire('input');
  await find('music-lab__reject').fire('click');
  assert.deepEqual(changes.at(-1), normalizeMusicState({ attack: .125 })); assert.equal(events.at(-1).action, 'reject');
  await find('music-lab__keep').fire('click'); assert.equal(events.at(-1).action, 'keep');
  assert.equal(audio.contexts.length, 0);
  const count = changes.length; slider.value = '.125'; await slider.fire('input'); assert.equal(changes.length, count);
  cleanup();
});

test('default mount reports the real original attack; unsupported audio fails visibly', async () => {
  const { host, find } = harness(); const changes = [], events = [];
  delete host.ownerDocument.defaultView.AudioContext;
  const cleanup = mountMusicLab(host, { onChange: value => changes.push(value), onEvent: (...event) => events.push(event) });
  assert.deepEqual(changes, [normalizeMusicState()]);
  await find('music-lab__after').fire('click');
  assert.equal(find('music-lab__error').hidden, false);
  assert.match(find('music-lab__error').textContent, /does not support Web Audio/);
  assert.equal(events.length, 0); assert.equal(find('music-lab__stop').disabled, true);
  cleanup();
});

test('cleanup while audio permission is pending prevents delayed playback', async () => {
  const { host, audio, find } = harness(); const events = [];
  const BaseContext = host.ownerDocument.defaultView.AudioContext;
  let resume;
  host.ownerDocument.defaultView.AudioContext = class extends BaseContext {
    constructor() { super(); this.state = 'suspended'; }
    resume() { return new Promise(resolve => { resume = resolve; }); }
  };
  const cleanup = mountMusicLab(host, { onEvent: (...event) => events.push(event) });
  const pending = find('music-lab__after').fire('click');
  cleanup(); resume(); await pending;
  assert.equal(audio.oscillators.length, 0); assert.equal(audio.contexts[0].state, 'closed'); assert.equal(events.length, 0);
});

test('legacy phrase preserves original timing, pitch and independent state copies', () => {
  const state = normalizeMusicState({attack: .2});
  const schedule = musicSchedule(state);
  schedule.notes.forEach((note, index) => {
    assert.ok(Math.abs(note.start - index * 1.2) < 1e-12);
    assert.ok(Math.abs(note.duration - 1.1) < 1e-12);
  });
  assert.equal(schedule.duration, 4.7);
  assert.equal(schedule.peakGain, .05);
  state.notes[0].midi = 84;
  assert.equal(normalizeMusicState().notes[0].midi, 60);
});

test('saved pitch and beat values determine the playback schedule', () => {
  const state = {attack: .2, tempo: 120, notes: [{midi: 69, beats: 1}, {midi: 72, beats: 3}, {midi: 48, beats: .5}]};
  const schedule = musicSchedule(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(schedule.notes.map(note => note.start), [0, .5, 2]);
  assert.equal(schedule.notes[0].frequency, 440);
  assert.ok(Math.abs(schedule.notes[1].frequency - 523.2511306011972) < 1e-9);
  assert.equal(schedule.notes[0].envelope[1].time, .2);
  assert.equal(schedule.duration, 2.38);
  assert.equal(musicSchedule({...state, tempo: 60}).notes[2].start, 4);
});

test('short rhythms keep attack slope and conservative gain during overlapping tails', () => {
  const state = {attack: .8, tempo: 180, notes: Array.from({length: 16}, () => ({midi: 84, beats: .25}))};
  const schedule = musicSchedule(state);
  assert.ok(schedule.peakGain < .05);
  for (const note of schedule.notes) {
    assert.equal(note.duration, .98);
    assert.equal(note.envelope[1].time, .8);
    assert.equal(note.envelope[1].amplitude / note.envelope[1].time, 1.25);
  }
  assert.ok(schedule.duration > schedule.notes.at(-1).start);
});

test('full setter is atomic on invalid state, stops valid playback and returns defensive copies', async () => {
  const {host, find, audio} = harness(); const changes = [];
  const cleanup = mountMusicLab(host, {onChange: value => changes.push(value)});
  const baseline = cleanup.getState();
  await find('music-lab__after').fire('click');
  const voice = audio.oscillators[0], stopTime = voice.stopTime;
  const invalid = [
    {attack: .2}, {...baseline, tempo: 39}, {...baseline, tempo: 180.1},
    {...baseline, notes: []}, {...baseline, notes: [{midi: 60, beats: 2}]},
    {...baseline, notes: Array.from({length: 17}, () => ({midi: 60, beats: 2}))},
    ...[47, 85, 60.5, '60', NaN].map(midi => ({...baseline, notes: [{midi, beats: 1}, {midi: 60, beats: 1}]})),
    ...[.24, 4.1, '1', Infinity].map(beats => ({...baseline, notes: [{midi: 60, beats}, {midi: 60, beats: 1}]})),
    {...baseline, notes: new Array(2)},
  ];
  for (const value of invalid) {
    assert.throws(() => cleanup.setState(value));
    assert.deepEqual(cleanup.getState(), baseline);
    assert.equal(changes.length, 1);
    assert.equal(voice.stopTime, stopTime);
    assert.equal(voice.disconnected, undefined);
  }
  const next = {attack: .4, tempo: 80, notes: [{midi: 48, beats: .25}, {midi: 84, beats: 4}]};
  cleanup.setState(next);
  assert.equal(voice.disconnected, true);
  assert.deepEqual(changes.at(-1), next);
  next.notes[0].midi = 60;
  changes.at(-1).notes[0].midi = 61;
  const copy = cleanup.getState(); copy.notes[0].midi = 62;
  assert.equal(cleanup.getState().notes[0].midi, 48);
  cleanup(); assert.throws(() => cleanup.setState(baseline), /closed/);
});

test('actual oscillator scheduling uses saved phrase while original comparison stays fixed', async () => {
  const {host, find, audio} = harness(); const events = [];
  const state = {attack: .2, tempo: 120, notes: [{midi: 69, beats: 1}, {midi: 48, beats: 2}]};
  const cleanup = mountMusicLab(host, {initialState: state, onEvent: (type, data) => events.push({type, data})});
  await find('music-lab__after').fire('click');
  assert.equal(audio.oscillators.length, 2);
  assert.equal(audio.oscillators[0].frequency.values[0][1], 440);
  assert.equal(audio.oscillators[1].startTime, 1.53);
  assert.deepEqual(events.at(-1).data.state, state);
  await find('music-lab__before').fire('click');
  assert.equal(audio.oscillators.length, 6);
  assert.deepEqual(events.at(-1).data.state, normalizeMusicState());
  assert.deepEqual(cleanup.getState(), state);
  cleanup();
});

test('phrase editor changes ending and beats and enforces note count', async () => {
  const {host, find} = harness();
  const cleanup = mountMusicLab(host);
  const rows = find('music-lab__note-rows');
  const pitch = rows.children[3].children[0].children[0]; pitch.value = '74';
  await rows.fire('change', {target: pitch});
  const beats = rows.children[3].children[1].children[0]; beats.value = '3';
  await rows.fire('change', {target: beats});
  assert.deepEqual(cleanup.getState().notes[3], {midi: 74, beats: 3});
  await find('music-lab__add-note').fire('click');
  assert.equal(cleanup.getState().notes.length, 5);
  await rows.fire('click', {target: rows.children[4].children[2]});
  assert.equal(cleanup.getState().notes.length, 4);
  cleanup();
});
