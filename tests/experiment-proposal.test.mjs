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

const practiceSource = 'https://www.musicnotes.com/sheetmusic/kanye-west/runaway/MN0103069';
const practiceTarget = {exercise_id: 'runaway-mn0103069-opening-two-strikes', quarter_bpm: 60};
const practiceLocator = 'Original E-major arrangement, page 1, first two right-hand strikes including the tied continuation';
const practiceArtifact = () => ({...artifact('music'),
  source_refs: [{url: practiceSource, locator: practiceLocator, source_kind: 'notation_exercise'}],
  state: {lab: structuredClone(proposal('music').music)},
  experiment_sources: [{source_ref_index: 0, url: practiceSource, source_id: 'MusicnotesMN0103069',
    exercise_id: practiceTarget.exercise_id, target_pitch: 'E6', target_midi: 88, quarter_bpm: 80, onsets: [.75, 2.25]}]});
const decisionScene = () => ({kind: 'shared_shelter', choices: [
  {id: 'a', label: ' Offer shelter. ', consequence: 'An imagined shared shelter, not agreement.\n', shelter: 'shared'},
  {id: 'b', label: 'Keep it.', consequence: 'An imagined separate shelter.', shelter: 'self'},
]});

test('music practice target replaces only the target and preserves detached practice history', () => {
  for (const quarter_bpm of [40, 60, 80]) {
    const p = proposal('music'); p.music.practice_target = {...practiceTarget, quarter_bpm};
    const a = practiceArtifact();
    const current = {practice_target: {...practiceTarget, quarter_bpm: 75, old: true},
      practice: {attempts: [{timing: [1, 2]}], question: ' My exact words.\n'}, other: {kept: true}};
    const original = structuredClone({p, a, current});
    assert.deepEqual(validateExperimentProposal(p, a), p);
    const next = proposedLabState(p, a, current);
    assert.deepEqual(next, {...current, ...p.music});
    assert.deepEqual(next.practice_target, p.music.practice_target);
    assert.equal(Object.hasOwn(next.practice_target, 'old'), false);
    next.practice.attempts[0].timing.push(3);
    next.practice_target.quarter_bpm = 42;
    assert.deepEqual({p, a, current}, original);
  }
});

test('absent or null practice target is not a new operation and does not erase existing target', () => {
  for (const nullable of [false, true]) {
    const p = proposal('music'); if (nullable) p.music.practice_target = null;
    const a = artifact('music');
    assert.deepEqual(validateExperimentProposal(p, a), p);
    const empty = proposedLabState(p, a, {});
    assert.equal(Object.hasOwn(empty, 'practice_target'), false);
    const current = {practice_target: practiceTarget, practice: {attempts: [1]}};
    assert.deepEqual(proposedLabState(p, a, current), {...current, ...proposal('music').music});
  }
});

test('practice target rejects invalid keys, bounds, numbers and unbound source URLs', () => {
  for (const target of [{...practiceTarget, quarter_bpm: 39}, {...practiceTarget, quarter_bpm: 81},
    {...practiceTarget, quarter_bpm: 60.5}, {...practiceTarget, quarter_bpm: '60'},
    {...practiceTarget, quarter_bpm: NaN}, {...practiceTarget, quarter_bpm: Infinity},
    {...practiceTarget, exercise_id: 'other'}, {...practiceTarget, extra: 1},
    {exercise_id: practiceTarget.exercise_id}, {}, [], false,
    JSON.parse('{"exercise_id":"runaway-mn0103069-opening-two-strikes","quarter_bpm":60,"__proto__":{}}')]) {
    const p = proposal('music'); p.music.practice_target = target;
    assert.throws(() => validateExperimentProposal(p, practiceArtifact()));
  }
  const p = proposal('music'); p.music.practice_target = practiceTarget;
  for (const source_refs of [[], [{url: practiceSource + '-fake'}], [{url: 'https://evil.example/MN0103069'}],
    [{url: 'https://www.musicnotes.com.evil.example/sheetmusic/kanye-west/runaway/MN0103069'}],
    [{url: 'https://www.musicnotes.com/sheetmusic/kanye-west/runaway/MN0000000'}], [{note: practiceSource}]]) {
    assert.throws(() => validateExperimentProposal(p, {...practiceArtifact(), source_refs}));
  }
});

test('practice source accepts canonical notation locator or explicit exercise ID, not URL alone', () => {
  const p = proposal('music'); p.music.practice_target = practiceTarget;
  const a = practiceArtifact();
  assert.doesNotThrow(() => validateExperimentProposal(p, a));
  assert.doesNotThrow(() => validateExperimentProposal(p, {...a,
    source_refs: [{url: practiceSource, exercise_id: practiceTarget.exercise_id}]}));
  assert.throws(() => validateExperimentProposal(p, {...a,
    source_refs: [{url: practiceSource, id: practiceTarget.exercise_id}]}));
  for (const ref of [{url: practiceSource}, {url: practiceSource, locator: practiceLocator},
    {url: practiceSource, locator: 'Wrong section', source_kind: 'notation_exercise'},
    {url: practiceSource, locator: practiceLocator, source_kind: 'external_reference'},
    {url: practiceSource, exercise_id: 'different-exercise'}, {url: practiceSource, id: 'different-exercise'},
    {url: 'https://example.org', id: practiceTarget.exercise_id}]) {
    assert.throws(() => validateExperimentProposal(p, {...a, source_refs: [ref]}));
  }
});

test('practice target cannot change frozen variation and ignores JSON key order', () => {
  const p = proposal('music'); p.music.practice_target = practiceTarget;
  const a = practiceArtifact();
  a.state.lab.notes = a.state.lab.notes.map(({midi, beats}) => ({beats, midi}));
  assert.doesNotThrow(() => validateExperimentProposal(p, a));
  for (const change of [{attack: .3}, {tempo: 100}, {notes: [{midi: 61, beats: 1}, {midi: 64, beats: .5}]}]) {
    assert.throws(() => validateExperimentProposal({...p, music: {...p.music, ...change}}, a));
  }
  const missing = practiceArtifact(); delete missing.state;
  assert.throws(() => validateExperimentProposal(p, missing));
  for (const key of ['attack', 'notes', 'tempo']) {
    const incomplete = practiceArtifact(); delete incomplete.state.lab[key];
    assert.throws(() => validateExperimentProposal(p, incomplete));
  }
});

test('ideas scene maps into detached modelComparison without writing learner fields', () => {
  const p = proposal('ideas'); p.ideas.decision_scene = decisionScene();
  const a = artifact('ideas');
  const current = {interpretation: '  Keep my view.\n', revisedInterpretation: 'I disagree.', unchanged: true,
    storyChoice: 'return_umbrella', comparisonChoice: 'keep', sourceId: 'original',
    youtubeUrl: 'https://example.org/user-reference', youtubeNote: 'My account.', practice: {kept: [1]}};
  const original = structuredClone({p, a, current});
  assert.deepEqual(validateExperimentProposal(p, a), p);
  const next = proposedLabState(p, a, current);
  assert.deepEqual(next, {...current, modelComparison: p.ideas});
  assert.equal(Object.hasOwn(next, 'decision_scene'), false);
  next.modelComparison.decision_scene.choices[0].label = 'Different preview';
  next.practice.kept.push(2);
  assert.deepEqual({p, a, current}, original);
});

test('ideas absence and null remain text-only and length limits are inclusive', () => {
  for (const nullable of [false, true]) {
    const p = proposal('ideas'); if (nullable) p.ideas.decision_scene = null;
    assert.deepEqual(validateExperimentProposal(p, artifact('ideas')), p);
    const next = proposedLabState(p, artifact('ideas'), {});
    assert.equal(Object.hasOwn(next.modelComparison, 'decision_scene'), nullable);
    if (nullable) assert.equal(next.modelComparison.decision_scene, null);
  }
  for (const length of [1, 80]) {
    const p = proposal('ideas'); p.ideas.decision_scene = decisionScene();
    p.ideas.decision_scene.choices[0].label = 'x'.repeat(length);
    p.ideas.decision_scene.choices[0].consequence = 'x'.repeat(length === 1 ? 1 : 240);
    assert.doesNotThrow(() => validateExperimentProposal(p, artifact('ideas')));
  }
});

test('ideas scene rejects malformed choices, duplicate IDs, single outcomes and unsafe JSON', () => {
  const scenes = [{...decisionScene(), extra: 1}, {...decisionScene(), kind: 'script'},
    {kind: 'shared_shelter', choices: []}, {kind: 'shared_shelter', choices: decisionScene().choices.slice(0, 1)},
    {kind: 'shared_shelter', choices: [...decisionScene().choices, decisionScene().choices[0]]}, {}, [], false];
  for (const change of [{id: 'b'}, {id: 'c'}, {shelter: 'self'}, {shelter: 'unknown'},
    {label: ''}, {label: 'x'.repeat(81)}, {label: 3}, {consequence: ''},
    {consequence: 'x'.repeat(241)}, {consequence: false}, {extra: 1}]) {
    const scene = decisionScene(); Object.assign(scene.choices[0], change); scenes.push(scene);
  }
  const missing = decisionScene(); delete missing.choices[0].label; scenes.push(missing);
  const unsafe = decisionScene(); unsafe.choices[0] = JSON.parse('{"id":"a","label":"x","consequence":"x","shelter":"shared","constructor":{}}'); scenes.push(unsafe);
  for (const scene of scenes) {
    const p = proposal('ideas'); p.ideas.decision_scene = scene;
    assert.throws(() => validateExperimentProposal(p, artifact('ideas')));
  }
});

test('playable ideas scene still requires exact quote, index, URL and locator binding', () => {
  const p = proposal('ideas'); p.ideas.decision_scene = decisionScene();
  for (const change of [{source_quote: 'Invented quotation'}, {source_ref_index: 1}]) {
    assert.throws(() => validateExperimentProposal({...p, ideas: {...p.ideas, ...change}}, artifact('ideas')));
  }
  for (const change of [{url: 'https://example.org/wrong'}, {locator: 'Wrong section'}, {content: 'Other passage'}]) {
    const a = artifact('ideas'); Object.assign(a.experiment_sources[0], change);
    assert.throws(() => validateExperimentProposal(p, a));
  }
});

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

test('optional boxing parameters accept absence and null without creating game state', () => {
  for (const includeNull of [false, true]) {
    const p = proposal('movement');
    if (includeNull) p.movement.boxing_params = null;
    assert.deepEqual(validateExperimentProposal(p, artifact('movement')), p);
    const next = proposedLabState(p, artifact('movement'), {time: 0});
    assert.equal(Object.hasOwn(next, 'boxing_params'), false);
    assert.equal(Object.hasOwn(next, 'boxing_round'), false);
    assert.deepEqual(next, {time: 0, ...proposal('movement').movement});
  }
});

test('boxing parameters merge only into params and preserve detached game history', () => {
  for (const cue of [.65, 1.65]) for (const gap of [10, 22]) {
    const p = proposal('movement'); p.movement.boxing_params = {cue, gap};
    const round = {prediction: '  My prediction\n', attempts: [{result: 'synthetic', nested: [1]}],
      question: 'My exact question?', params: {cue: 1, gap: 15, other: 'preserved'}, score: 7};
    const a = {...artifact('movement'), state: {lab: {boxing_round: structuredClone(round)}}};
    const current = {duration: 3, distance: .3, shape: 'quintic', compare_shape: 'cubic', view: 'position',
      time: .2, assistanceOpen: true, boxing_round: round};
    const before = structuredClone({p, a, current});
    assert.deepEqual(validateExperimentProposal(p, a), p);
    const next = proposedLabState(p, a, current);
    assert.deepEqual(next, {...current, ...proposal('movement').movement,
      boxing_round: {...round, params: {...round.params, cue, gap}}});
    assert.equal(Object.hasOwn(next, 'boxing_params'), false);
    next.boxing_round.attempts[0].nested.push(2);
    next.boxing_round.params.cue = 1;
    assert.deepEqual({p, a, current}, before);
  }
});

test('boxing parameters reject bounds, nonfinite, extra fields and missing source game', () => {
  const a = {...artifact('movement'), state: {lab: {boxing_round: {params: {cue: 1, gap: 15}}}}};
  for (const boxing_params of [{cue: .64, gap: 15}, {cue: 1.66, gap: 15}, {cue: 1, gap: 9.9},
    {cue: 1, gap: 22.1}, {cue: NaN, gap: 15}, {cue: 1, gap: Infinity}, {cue: '1', gap: 15},
    {cue: 1, gap: 15, extra: 1}, {cue: 1}, {}, [], false,
    JSON.parse('{"cue":1,"gap":15,"__proto__":{}}')]) {
    const p = proposal('movement'); p.movement.boxing_params = boxing_params;
    assert.throws(() => validateExperimentProposal(p, a));
  }
  const p = proposal('movement'); p.movement.boxing_params = {cue: 1.1, gap: 15.5};
  assert.doesNotThrow(() => validateExperimentProposal(p, a));
  for (const base of [artifact('movement'), {...a, state: {lab: {}}},
    ...[null, false, 'round', []].map(boxing_round => ({...a, state: {lab: {boxing_round}}}))]) {
    assert.throws(() => validateExperimentProposal(p, base));
  }
  for (const current of [{}, {boxing_round: null}, {boxing_round: []}, {boxing_round: {params: 'bad'}}]) {
    assert.throws(() => proposedLabState(p, a, current));
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
