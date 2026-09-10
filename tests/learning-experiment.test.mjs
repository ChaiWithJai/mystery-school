import test from 'node:test';
import assert from 'node:assert/strict';
import { mountLearningExperiment } from '../public/learning-experiment.js';

// Synthetic response and DOM doubles test lifecycle, not live Astra or browser rendering.
function element() {
  return { hidden: false, disabled: false, checked: false, textContent: '', children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; }, remove() { this.removed = true; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness({ delay = false } = {}) {
  const nodes = new Map();
  const root = { ...element(), querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  } };
  const previous = globalThis.document;
  let first = true;
  globalThis.document = { createElement() { if (first) { first = false; return root; } return element(); } };
  const initial = { attack: .02, notes: [{ midi: 60, beats: 1 }, { midi: 64, beats: 1 }], tempo: 100 };
  let state = structuredClone(initial), release;
  const artifact = { id: 'base', pathway: 'music', state: { lab: structuredClone(initial) } };
  const proposal = { version: 1, pathway: 'music', base_artifact_id: 'base', status: 'supported', reason: 'Hear a different ending.',
    music: { ...initial, notes: [{ midi: 60, beats: 1 }, { midi: 67, beats: 2 }] }, movement: null, ideas: null };
  const events = [];
  const dispose = mountLearningExperiment(element(), {
    sessionId: 'test', actorKind: 'agent_review', pathway: 'music',
    getQuestion: () => 'Change the ending.', getState: () => structuredClone(state),
    setState: value => { state = structuredClone(value); }, save: async () => structuredClone(artifact),
    track: async (type, payload) => { events.push({ type, payload }); },
    api: async path => {
      if (path === '/api/project') {
        if (delay) await new Promise(resolve => { release = resolve; });
        return { id: 'synthetic-job', status: 'queued' };
      }
      return { id: 'synthetic-job', status: 'completed', result: { experiment: proposal } };
    }
  });
  return { nodes, events, initial, proposal, get state() { return state; }, edit(value) { state = value; },
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
