import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExperimentProposal, proposedLabState} from '../public/experiment-proposal.js';

const artifact = pathway => ({id: 'synthetic-base', pathway,
  source_refs: [{url: 'https://example.org/synthetic', locator: 'Section 1'}],
  experiment_sources: [{source_ref_index: 0, url: 'https://example.org/synthetic', locator: 'Section 1',
    content: 'Some things are in our control and others not.'}]});
const proposal = pathway => ({version: 1, pathway, base_artifact_id: 'synthetic-base', status: 'supported',
  reason: 'Synthetic proposal, not a model output.', music: null, movement: null, ideas: null,
  [pathway]: {
    music: {attack: .2, notes: [{midi: 60, beats: 1}, {midi: 64, beats: .5}], tempo: 90},
    movement: {duration: 2, distance: .4, shape: 'cubic', compare_shape: 'quintic', view: 'velocity'},
    ideas: {scenario: '  A synthetic disagreement.\n', question: 'What can I choose?', source_quote: 'in our control', source_ref_index: 0},
  }[pathway]});

for (const path of ['music', 'movement', 'ideas']) {
  test(`${path}: validates and creates a detached preview without altering input`, () => {
    const p = proposal(path), a = artifact(path);
    const state = {interpretation: '  My unchanged words.\n', revisedInterpretation: 'I disagree.',
      youtubeNote: 'My account, not source content', sourceId: 'original', nested: {saved: [1]}, playing: false};
    const before = structuredClone({p, a, state});
    const validated = validateExperimentProposal(p, a);
    assert.deepEqual(validated, p);
    assert.notEqual(validated[path], p[path]);
    const next = proposedLabState(p, a, state);
    assert.deepEqual(next, path === 'ideas' ? {...state, modelComparison: p.ideas} : {...state, ...p[path]});
    next.nested.saved.push(2);
    if (path === 'music') next.notes[0].midi = 70;
    if (path === 'ideas') next.modelComparison.scenario = 'Changed preview';
    assert.deepEqual({p, a, state}, before);
  });
}

test('rejects mismatched base, pathway, version, status, missing and extra branches', () => {
  for (const change of [{base_artifact_id: 'other'}, {pathway: 'movement'}, {pathway: 'unknown'},
    {version: 2}, {version: '1'}, {status: 'ready'}, {reason: null}, {extra: true},
    {music: null}, {ideas: proposal('ideas').ideas}]) {
    assert.throws(() => validateExperimentProposal({...proposal('music'), ...change}, artifact('music')));
  }
  const p = proposal('music'); delete p.movement;
  assert.throws(() => validateExperimentProposal(p, artifact('music')));
});

test('inclusive music bounds and strict integer/count/finite checks', () => {
  for (const attack of [.02, .8]) for (const tempo of [40, 180]) {
    const p = proposal('music'); Object.assign(p.music, {attack, tempo, notes: [{midi: 48, beats: .25}, {midi: 84, beats: 4}]});
    assert.doesNotThrow(() => validateExperimentProposal(p, artifact('music')));
  }
  const changes = [{attack: .019}, {attack: .801}, {attack: NaN}, {attack: Infinity}, {attack: '.2'},
    {tempo: 39}, {tempo: 181}, {tempo: 90.5}, {notes: []}, {notes: [{midi: 60, beats: 1}]},
    {notes: Array.from({length: 17}, () => ({midi: 60, beats: 1}))}, {extra: true}];
  for (const note of [{midi: 47, beats: 1}, {midi: 85, beats: 1}, {midi: 60.5, beats: 1},
    {midi: 60, beats: .24}, {midi: 60, beats: 4.1}, {midi: 60, beats: 1, extra: 1}]) changes.push({notes: [note, {midi: 60, beats: 1}]});
  for (const change of changes) {
    const p = proposal('music'); Object.assign(p.music, change);
    assert.throws(() => validateExperimentProposal(p, artifact('music')));
  }
});

test('movement bounds and enums reject instead of clamping', () => {
  for (const duration of [1, 4]) for (const distance of [.1, 1]) {
    const p = proposal('movement'); Object.assign(p.movement, {duration, distance});
    assert.doesNotThrow(() => validateExperimentProposal(p, artifact('movement')));
  }
  for (const change of [{duration: .9}, {duration: 4.1}, {distance: .09}, {distance: 1.1},
    {duration: -Infinity}, {shape: 'linear'}, {compare_shape: 'linear'}, {view: 'force'}, {extra: 1}]) {
    const p = proposal('movement'); Object.assign(p.movement, change);
    assert.throws(() => validateExperimentProposal(p, artifact('movement')));
  }
});

test('unsupported requires null branches and can never create an apply state', () => {
  for (const path of ['music', 'movement', 'ideas']) {
    const p = {...proposal(path), status: 'unsupported', [path]: null};
    assert.deepEqual(validateExperimentProposal(p, artifact(path)), p);
    assert.throws(() => proposedLabState(p, artifact(path), {}));
    p[path] = proposal(path)[path];
    assert.throws(() => validateExperimentProposal(p, artifact(path)));
  }
});

test('ideas quote grounding uses only exact indexed source content', () => {
  for (const change of [{source_quote: 'IN OUR CONTROL'}, {source_quote: ''}, {source_quote: ' '},
    {source_quote: 'My own note'}, {source_ref_index: 1}, {source_ref_index: -1},
    {source_ref_index: .5}, {source_ref_index: '0'}, {question: null}, {extra: 1}]) {
    const p = proposal('ideas'); Object.assign(p.ideas, change);
    assert.throws(() => validateExperimentProposal(p, artifact('ideas')));
  }
  for (const source_refs of [[], [{url: 'https://example.org', note: 'in our control'}], [{content: null}]]) {
    assert.throws(() => validateExperimentProposal(proposal('ideas'), {...artifact('ideas'), source_refs}));
  }
  const a = artifact('ideas'), source = a.experiment_sources[0];
  for (const experiment_sources of [[], [source, source], [{...source, source_ref_index: 1}],
    [{...source, url: 'https://example.org/other'}], [{...source, locator: 'Section 2'}],
    [{...source, content: null}], [{...source, content: 'A different passage'}]]) {
    assert.throws(() => validateExperimentProposal(proposal('ideas'), {...a, experiment_sources}));
  }
  const missing = artifact('ideas'); delete missing.experiment_sources;
  missing.source_refs[0].content = source.content;
  assert.throws(() => validateExperimentProposal(proposal('ideas'), missing));
});

test('rejects prototype keys, inherited objects, accessors, sparse arrays and non-JSON', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const p = proposal('music'); p.music.notes[0] = JSON.parse(`{"midi":60,"beats":1,"${key}":{}}`);
    assert.throws(() => validateExperimentProposal(p, artifact('music')));
  }
  const inherited = Object.assign(Object.create({hidden: true}), proposal('music'));
  assert.throws(() => validateExperimentProposal(inherited, artifact('music')));
  let invoked = false;
  const getter = proposal('music'); Object.defineProperty(getter, 'reason', {enumerable: true, get() {invoked = true; return 'bad';}});
  assert.throws(() => validateExperimentProposal(getter, artifact('music')));
  assert.equal(invoked, false);
  for (const notes of [new Array(2), [undefined, {midi: 60, beats: 1}]]) {
    const p = proposal('music'); p.music.notes = notes;
    assert.throws(() => validateExperimentProposal(p, artifact('music')));
  }
  assert.throws(() => proposedLabState(proposal('music'), artifact('music'), JSON.parse('{"__proto__":{}}')));
  assert.throws(() => proposedLabState(proposal('music'), artifact('music'), {x: NaN}));
  assert.equal({}.hidden, undefined);
});
