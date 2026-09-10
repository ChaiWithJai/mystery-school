import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoryWorldState, stepStoryCamera, storyWorldShelter, isUnderStoryShelter, chooseStoryWorld, mountStoryWorld, STORY_WORLD_SOURCE, displayedStoryChoice } from '../public/story-world.js';
import { ideasComparisonIdentity } from '../public/ideas-lab.js';

const comparison = (scenario = 'Two people disagree in the rain.') => ({ scenario, question: 'What will you write?', source_quote: STORY_WORLD_SOURCE.excerpt, source_ref_index: 0,
  decision_scene: { kind: 'shared_shelter', choices: [
    { id: 'a', label: 'Share the shelter', consequence: 'An imagined roof covers both places.', shelter: 'shared' },
    { id: 'b', label: 'Keep one place', consequence: 'An imagined roof covers one place.', shelter: 'self' },
  ] } });

test('displayed reversed model choices activate their own IDs',()=>{
  const model=comparison();model.decision_scene.choices.reverse();
  const state=normalizeStoryWorldState({modelComparison:model});
  assert.equal(displayedStoryChoice(state,0),'b');
  assert.equal(storyWorldShelter(chooseStoryWorld(state,displayedStoryChoice(state,0))).shared,false);
  assert.equal(storyWorldShelter(chooseStoryWorld(state,displayedStoryChoice(state,1))).shared,true);
});

test('book-world defaults contain empty learner writing and deterministic camera state', () => {
  const state = normalizeStoryWorldState();
  assert.equal(state.learnerIntent, ''); assert.equal(state.learnerStory, '');
  assert.deepEqual(state.camera, { x: 0, z: 9, yaw: 0, pitch: 0 });
  assert.equal(state.modelComparison, null); assert.deepEqual(state.decisionResponses, {});
  for (const input of [undefined, null, 3, [], 'text']) assert.deepEqual(normalizeStoryWorldState(input), state);
  assert.deepEqual(normalizeStoryWorldState(JSON.parse(JSON.stringify(state))), state);
});

test('normalization bounds camera and text without replacing learner words with model fiction', () => {
  const words = '  My story.\n<script>Literal text.</script>  ';
  const state = normalizeStoryWorldState({ learnerStory: words, learnerIntent: 'My question', modelComparison: comparison(), camera: { x: 1000, z: 1000, yaw: -1, pitch: 50 } });
  assert.equal(state.learnerStory, words); assert.equal(state.learnerIntent, 'My question');
  assert.ok(Math.hypot(state.camera.x, state.camera.z) <= 17.000001);
  assert.ok(state.camera.yaw > 0); assert.equal(state.camera.pitch, .95);
  assert.equal(normalizeStoryWorldState({ learnerStory: 'x'.repeat(12001) }).learnerStory.length, 12000);
  assert.equal(normalizeStoryWorldState({ learnerIntent: 'x'.repeat(2001) }).learnerIntent.length, 2000);
  assert.deepEqual(normalizeStoryWorldState({ camera: { x: NaN, yaw: Infinity } }).camera, { x: 0, z: 9, yaw: 0, pitch: 0 });
});

test('WASD moves the actual camera plane relative to heading with bounded frame delta', () => {
  const camera = { x: 0, z: 9, yaw: 0, pitch: 0 };
  const forward = stepStoryCamera(camera, { forward: 1 }, .05);
  assert.equal(forward.x, 0); assert.ok(Math.abs(forward.z - 8.84) < 1e-8);
  assert.ok(Math.abs(stepStoryCamera(camera, { right: 1 }, .05).x - .16) < 1e-8);
  const turned = stepStoryCamera({ ...camera, yaw: Math.PI / 2 }, { forward: 1 }, .05);
  assert.ok(Math.abs(turned.x + .16) < 1e-8);
  assert.deepEqual(stepStoryCamera(camera, { forward: 1 }, 500), forward);
  assert.deepEqual(camera, { x: 0, z: 9, yaw: 0, pitch: 0 });
});

test('diagonal input does not increase speed and camera cannot cross world edge or obstacle', () => {
  const camera = { x: 0, z: 0, yaw: 0, pitch: 0 };
  const diagonal = stepStoryCamera(camera, { forward: 1, right: 1 }, .05);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - .16) < 1e-8);
  assert.equal(stepStoryCamera({ ...camera, x: 16.99 }, { right: 1 }, .05).x, 16.99);
  assert.equal(stepStoryCamera(camera, { forward: 1 }, .05, [{ x: 0, z: -.6, radius: .3 }]).z, 0);
  const slide = stepStoryCamera(camera, { forward: 1, right: 1 }, .05, [{ x: 0, z: -.6, radius: .3 }]);
  assert.ok(slide.x > 0); assert.equal(slide.z, 0);
});

test('arrow look clamps pitch and camera turns without translating', () => {
  const camera = { x: 2, z: 3, yaw: 0, pitch: .94 };
  const next = stepStoryCamera(camera, { turn: 1, look: 1 }, .05);
  assert.equal(next.x, 2); assert.equal(next.z, 3); assert.equal(next.pitch, .95); assert.ok(next.yaw > 0);
});

test('shelter choices change roof geometry and actual rain-coverage predicate', () => {
  const base = normalizeStoryWorldState({ learnerStory: 'I choose the ending.' });
  const shared = storyWorldShelter(chooseStoryWorld(base, 'a')), self = storyWorldShelter(chooseStoryWorld(base, 'b'));
  assert.equal(shared.width, 6.2); assert.equal(self.width, 2.6); assert.notEqual(shared.centerX, self.centerX);
  assert.equal(isUnderStoryShelter(1.3, -3.7, shared), true);
  assert.equal(isUnderStoryShelter(1.3, -3.7, self), false);
  assert.equal(isUnderStoryShelter(-1.2, -3.7, self), true);
  assert.equal(isUnderStoryShelter(0, 9, shared), false);
});

test('model choices and neither preserve authored choice, intent and exact story', () => {
  const base = normalizeStoryWorldState({ learnerIntent: ' My intention ', learnerStory: ' My ending\n', storyChoice: 'offer_shelter', modelComparison: comparison() });
  for (const choice of ['a', 'b', 'neither']) {
    const next = chooseStoryWorld(base, choice);
    assert.equal(next.decisionResponses[ideasComparisonIdentity(base.modelComparison)], choice);
    assert.equal(next.learnerIntent, base.learnerIntent); assert.equal(next.learnerStory, base.learnerStory);
    assert.equal(next.storyChoice, 'offer_shelter'); assert.deepEqual(base.decisionResponses, {});
  }
  assert.throws(() => chooseStoryWorld(base, 'invented'));
});

test('full snapshots round-trip and restore previous comparison geometry without response leakage', () => {
  const a = chooseStoryWorld({ modelComparison: comparison('A'), learnerStory: 'My words' }, 'a');
  const b = chooseStoryWorld({ ...a, modelComparison: comparison('B') }, 'b');
  assert.equal(storyWorldShelter(b).shared, false);
  const undo = normalizeStoryWorldState({ ...a, decisionResponses: b.decisionResponses });
  assert.equal(storyWorldShelter(undo).shared, true);
  assert.deepEqual(normalizeStoryWorldState(JSON.parse(JSON.stringify(undo))), undo);
  assert.equal(Object.keys(undo.decisionResponses).length, 2);
});

test('invalid source/model scenes reject; historical text is not promoted to playable output', () => {
  assert.throws(() => normalizeStoryWorldState({ modelComparison: { ...comparison(), source_quote: 'Invented quote.' } }));
  assert.throws(() => normalizeStoryWorldState({ modelComparison: { ...comparison(), source_ref_index: 1 } }));
  const { decision_scene, ...legacy } = comparison();
  assert.ok(normalizeStoryWorldState({ modelComparison: legacy }).modelComparison);
  assert.throws(() => chooseStoryWorld({ modelComparison: legacy }, 'a'));
  assert.throws(() => normalizeStoryWorldState({ modelComparison: { ...comparison(), decision_scene: { kind: 'other', choices: [] } } }));
});

test('mount rejects an invalid host or callbacks rather than claiming a rendered world', () => {
  assert.throws(() => mountStoryWorld(null), TypeError);
  assert.throws(() => mountStoryWorld({ ownerDocument: {}, append() {} }, { onChange: null }), TypeError);
});
