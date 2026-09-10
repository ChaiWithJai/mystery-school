import test from 'node:test';
import assert from 'node:assert/strict';
import { mountLearningExperiment, experimentDefinition, describeExperimentValue } from '../public/learning-experiment.js';

test('preview names notes and durations rather than displaying MIDI JSON', () => {
  assert.equal(describeExperimentValue('notes', [{midi:64,beats:2},{midi:60,beats:4}]), 'E4 for 2 beats, then C4 for 4 beats');
  assert.equal(describeExperimentValue('tempo', 100), '100 beats per minute');
  assert.equal(describeExperimentValue('modelComparison', {source_quote:'A source',scenario:'A disagreement.',question:'What would you do?'}), 'Source: "A source". Situation: A disagreement. Question: What would you do?');
});

test('ideas reading navigation is separate from substantive learner and source content', () => {
  const state = { interpretation: 'My words', revisedInterpretation: '', youtubeUrl: 'draft', modelComparison: null, helpOpen: false, helpSeen: false, sourceOpened: false };
  const navigating = { ...state, helpOpen: true, helpSeen: true, sourceOpened: true };
  assert.deepEqual(experimentDefinition('ideas', state), experimentDefinition('ideas', navigating));
  assert.notDeepEqual(experimentDefinition('ideas', state), experimentDefinition('ideas', { ...state, interpretation: 'New words' }));
  assert.notDeepEqual(experimentDefinition('ideas', state), experimentDefinition('ideas', { ...state, youtubeUrl: 'different' }));
});

// Synthetic response and DOM doubles test lifecycle, not live Astra or browser rendering.
function element() {
  return { hidden: false, disabled: false, checked: false, textContent: '', children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }, remove() { this.removed = true; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness({ delay = false, delayTelemetry = false, pathway = 'music' } = {}) {
  const nodes = new Map();
  const root = { ...element(), querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  } };
  const previous = globalThis.document;
  let first = true;
  globalThis.document = { createElement() { if (first) { first = false; return root; } return element(); } };
  const initial = pathway === 'movement'
    ? { duration: 2, distance: .4, shape: 'cubic', compare_shape: 'quintic', view: 'position', time: 0, playing: false }
    : { attack: .02, notes: [{ midi: 60, beats: 1 }, { midi: 64, beats: 1 }], tempo: 100 };
  let state = structuredClone(initial), release, releaseTelemetry, dispatched = 0;
  let question = 'Change the ending.';
  const artifact = { id: 'base', pathway, state: { lab: structuredClone(initial), question } };
  const proposal = { version: 1, pathway, base_artifact_id: 'base', status: 'supported', reason: 'Try a comparison.',
    music: pathway === 'music' ? { ...initial, notes: [{ midi: 60, beats: 1 }, { midi: 67, beats: 2 }] } : null,
    movement: pathway === 'movement' ? { duration: 2, distance: .4, shape: 'cubic', compare_shape: 'quintic', view: 'acceleration' } : null, ideas: null };
  const events = [];
  const dispose = mountLearningExperiment(element(), {
    sessionId: 'test', actorKind: 'agent_review', pathway,
    getQuestion: () => question, getState: () => structuredClone(state),
    setState: value => { state = structuredClone(value); }, save: async () => structuredClone(artifact),
    track: async (type, payload) => { events.push({ type, payload }); if(delayTelemetry && type === 'learning.experiment.confirm') await new Promise(resolve => { releaseTelemetry = resolve; }); },
    api: async path => {
      if (path === '/api/artifacts/base') return structuredClone(artifact);
      if (path === '/api/project') {
        dispatched++;
        if (delay) await new Promise(resolve => { release = resolve; });
        return { id: 'synthetic-job', status: 'queued' };
      }
      return { id: 'synthetic-job', status: 'completed', input: { learning_artifact_id: 'base' }, result: { experiment: proposal } };
    }
  });
  return { nodes, events, initial, proposal, get state() { return state; }, edit(value) { state = value; },
    get dispatched() { return dispatched; }, releaseTelemetry: () => releaseTelemetry(),
    changeQuestion(value) { question = value; dispose.contextChanged(); },
    resume: id => dispose.resume('synthetic-job', id),
    async request() { nodes.get('[data-consent]').checked = true; await nodes.get('[data-request]').onclick(); await settle(); },
    release: () => release(), close() { dispose(); globalThis.document = previous; } };
}

test('synthetic proposal previews without mutation, applies, and undoes exactly', async () => {
  const h = harness();
  try {
    await h.request();
    assert.deepEqual(h.state, h.initial);
    assert.equal(h.nodes.get('[data-preview]').hidden, false);
    h.nodes.get('[data-apply]').onclick();
    assert.deepEqual(h.state.notes, h.proposal.music.notes);
    h.nodes.get('[data-undo]').onclick();
    assert.deepEqual(h.state, h.initial);
    assert.ok(h.events.some(event => event.type === 'learning.experiment.undo'));
  } finally { h.close(); }
});

test('local edits continue during delayed inference and stale result cannot overwrite them', async () => {
  const h = harness({ delay: true });
  try {
    const pending = h.request(); await settle();
    const edited = { ...h.initial, attack: .5 };
    h.edit(edited);
    assert.deepEqual(h.state, edited);
    h.release(); await pending;
    h.nodes.get('[data-apply]').onclick();
    assert.deepEqual(h.state, edited);
    assert.match(h.nodes.get('[data-progress]').textContent, /changed the experiment/);
  } finally { h.close(); }
});

test('undo does not discard edits made after applying a proposal', async () => {
  const h = harness();
  try {
    await h.request(); h.nodes.get('[data-apply]').onclick();
    h.edit({ ...h.state, tempo: 120 });
    h.nodes.get('[data-undo]').onclick();
    assert.equal(h.state.tempo, 120);
    assert.match(h.nodes.get('[data-progress]').textContent, /will not discard/);
  } finally { h.close(); }
});

test('movement can play during inference, apply, play again and undo settings', async () => {
  const h = harness({ delay: true, pathway: 'movement' });
  try {
    const pending = h.request(); await settle();
    h.edit({ ...h.state, time: 1.2, playing: true, position: .26, velocity: .3 });
    h.release(); await pending;
    h.nodes.get('[data-apply]').onclick();
    assert.equal(h.state.view, 'acceleration');
    assert.equal(h.state.time, 1.2);
    assert.equal(h.state.playing, false);
    h.edit({ ...h.state, time: 1.8, playing: true, position: .39 });
    h.nodes.get('[data-undo]').onclick();
    assert.equal(h.state.view, 'position');
    assert.equal(h.state.time, 1.8);
    assert.equal(h.state.playing, false);
  } finally { h.close(); }
});

test('movement parameter edits still invalidate a proposal', async () => {
  const h = harness({ pathway: 'movement' });
  try {
    await h.request(); h.edit({ ...h.state, duration: 4 });
    h.nodes.get('[data-apply]').onclick();
    assert.equal(h.state.view, 'position');
    assert.equal(h.state.duration, 4);
    assert.match(h.nodes.get('[data-progress]').textContent, /changed the experiment/);
  } finally { h.close(); }
});

test('a changed intention cannot silently accept an earlier answer', async () => {
  const h = harness({ delay: true });
  try {
    const pending = h.request(); await settle();
    h.changeQuestion('Keep the melody and only change the rhythm.');
    assert.equal(h.nodes.get('[data-consent]').checked, false);
    h.release(); await pending;
    h.nodes.get('[data-apply]').onclick();
    assert.deepEqual(h.state, h.initial);
    assert.match(h.nodes.get('[data-progress]').textContent, /current intention/);
  } finally { h.close(); }
});

test('recorded proposal opens without confirmation or new inference and does not auto-apply', async () => {
  const h = harness();
  try {
    await h.resume('base');
    assert.deepEqual(h.state, h.initial);
    assert.equal(h.nodes.get('[data-preview]').hidden, false);
    assert.equal(h.nodes.get('[data-consent]').checked, false);
    assert.ok(h.events.some(event => event.type === 'learning.experiment.resume' && event.payload.model_called === false));
    assert.ok(!h.events.some(event => event.type === 'learning.experiment.confirm'));
    h.nodes.get('[data-apply]').onclick();
    assert.deepEqual(h.state.notes, h.proposal.music.notes);
  } finally { h.close(); }
});

test('recorded proposal cannot open against a different artifact', async () => {
  const h = harness();
  try {
    await h.resume('wrong-base');
    assert.deepEqual(h.state, h.initial);
    assert.match(h.nodes.get('[data-progress]').textContent, /different saved experiment/);
  } finally { h.close(); }
});

test('changing intention during awaited confirmation telemetry prevents dispatch', async () => {
  const h = harness({ delayTelemetry: true });
  try {
    const pending = h.request(); await settle();
    h.changeQuestion('Do not change those notes.');
    h.releaseTelemetry(); await pending;
    assert.equal(h.dispatched, 0);
    assert.equal(h.nodes.get('[data-consent]').checked, false);
    assert.match(h.nodes.get('[data-progress]').textContent, /before sending/);
  } finally { h.close(); }
});
