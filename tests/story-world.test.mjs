import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoryWorldState, stepStoryCamera, storyWorldShelter, isUnderStoryShelter, chooseStoryWorld, mountStoryWorld, STORY_WORLD_SOURCE, displayedStoryChoice } from '../public/story-world.js';
import { ideasComparisonIdentity } from '../public/ideas-lab.js';
import { normalizeStoryMemories, storyMemoryLinks, storyMemorySourceLinks } from '../public/story-world.js';
import { createBoxingMemory, createIdeasMemory } from '../public/learning-memory.js';

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
  assert.ok(stepStoryCamera(camera, { forward: 1 }, .05, [{ x: 0, z: -.6, radius: .3, enabled: false }]).z < 0);
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

const memoryRecord = (id = 'agent-qa-artifact', observation = '  I felt unsure.\nThis is my report, not a measurement.  ') => createBoxingMemory({
  id, pathway: 'movement', actor_kind: 'agent_review', trace_id: 'tr-agent-qa',
  source_refs: [{ label: 'Source', url: 'https://example.test/source', locator: 'Section 1' }],
  state: { lab: { boxing_mirror: { reflection: observation, lessonId: 'basic', attempts: [{ t: 1, type: 'JAB' }] } } },
});

test('compact memories preserve exact reports, helper provenance, and detached snapshots', () => {
  const input = memoryRecord();
  const state = normalizeStoryWorldState({ memories: [input], learnerStory: 'My story.', learnerIntent: 'My question.', camera: { x: 2, z: 3, yaw: 1, pitch: .2 }, writerOpen: true });
  assert.deepEqual(state.memories, [input]);
  assert.equal(state.memoryArtifactId, input.source_artifact_id);
  assert.equal(state.memoriesOpen, false); assert.equal(state.writerOpen, true);
  assert.equal(state.learnerStory, 'My story.'); assert.deepEqual(state.camera, { x: 2, z: 3, yaw: 1, pitch: .2 });
  const copy = structuredClone(state); copy.memories[0].observation.text = 'Changed';
  assert.equal(state.memories[0].observation.text, input.observation.text);
  assert.deepEqual(normalizeStoryWorldState(JSON.parse(JSON.stringify(state))), state);
});

test('appendMemory semantics retain first artifact deposit, latest sixty, and selected existing record', () => {
  const first = memoryRecord('first', 'First exact report.');
  assert.deepEqual(normalizeStoryMemories([first, memoryRecord('first', 'Replacement')]), [first]);
  const memories = Array.from({ length: 65 }, (_, i) => memoryRecord(`id-${i}`));
  const state = normalizeStoryWorldState({ memories, memoryArtifactId: 'id-20', memoriesOpen: true });
  assert.equal(state.memories.length, 60); assert.equal(state.memories[0].source_artifact_id, 'id-5');
  assert.equal(state.memoryArtifactId, 'id-20'); assert.equal(state.memoriesOpen, true);
  assert.equal(normalizeStoryWorldState({ memories, memoryArtifactId: 'missing' }).memoryArtifactId, 'id-64');
  assert.equal(normalizeStoryWorldState({ memories: [], memoriesOpen: true }).memoriesOpen, false);
});

test('memory ingestion drops malformed reports and unrecognized fields without claiming verification', () => {
  const good = structuredClone(memoryRecord()); good.secret = 'not copied'; good.observation.label = 'Verified!'; good.observation.score = 100;
  const memories = normalizeStoryMemories([null, {}, { ...good, observation: { kind: 'measured', text: 'Not a self-report' } }, { ...good, source_artifact_id: '' }, good]);
  assert.equal(memories.length, 1); assert.equal('secret' in memories[0], false); assert.equal('score' in memories[0].observation, false);
  assert.equal(memories[0].observation.label, good.observation.label);
  assert.equal(memories[0].observation.text, good.observation.text);
  assert.deepEqual(normalizeStoryMemories('bad'), []);
});

test('memory links stay local and encode IDs rather than interpreting untrusted text as URLs', () => {
  const record = memoryRecord('a/?actor=user_action#<script>');
  const links = storyMemoryLinks(record);
  assert.equal(links.artifact, '/?path=movement&artifact=a%2F%3Factor%3Duser_action%23%3Cscript%3E&actor=agent_review');
  assert.equal(links.trace, '/review.html?sample=a%2F%3Factor%3Duser_action%23%3Cscript%3E');
  assert.equal(storyMemoryLinks({ ...record, source_trace_id: null }).trace, null);
  assert.equal(storyMemoryLinks({ ...record, actor_kind: 'user_action' }).artifact.includes('&actor=agent_review'), false);
});

test('memory enrichment and shelter changes do not overwrite writing or camera', () => {
  const original = normalizeStoryWorldState({ learnerIntent: 'Exact intent', learnerStory: 'Exact story\n', modelComparison: comparison(), camera: { x: 1, z: 2, yaw: 0, pitch: 0 } });
  const enriched = normalizeStoryWorldState({ ...original, memories: [memoryRecord()] });
  const chosen = chooseStoryWorld(enriched, 'a');
  assert.deepEqual(chosen.memories, enriched.memories);
  assert.deepEqual(chosen.camera, original.camera);
  assert.equal(chosen.learnerIntent, original.learnerIntent); assert.equal(chosen.learnerStory, original.learnerStory);
});

test('world restores ideas journeys beside boxing reports and links to the right saved pathway',()=>{
  const idea=createIdeasMemory({id:'idea/?x=1',pathway:'ideas',actor_kind:'agent_review',trace_id:'trace-idea',
    source_refs:[{label:'Saved passage',url:'https://example.org/passage',locator:'Section 1'}],
    state:{lab:{real_world_reflection:{action:'  Ask.  ',status:'planned',question:'Why?'}}}});
  const boxing=memoryRecord();
  const world=normalizeStoryWorldState({memories:[boxing,idea],memoryArtifactId:idea.source_artifact_id,memoriesOpen:true,learnerStory:'Unchanged story'});
  assert.deepEqual(world.memories,[boxing,idea]);assert.equal(world.memoriesOpen,true);assert.equal(world.learnerStory,'Unchanged story');
  assert.equal(world.memories[1].reflection.status,'planned');assert.equal(world.memories[1].observation.text,'');
  assert.equal(storyMemoryLinks(idea).artifact,'/?path=ideas&artifact=idea%2F%3Fx%3D1&actor=agent_review');
  assert.deepEqual(normalizeStoryWorldState(JSON.parse(JSON.stringify(world))),world);
});

test('ideas ingestion derives honest attribution and cannot upgrade a plan to verified experience',()=>{
  const idea={version:1,kind:'ideas_reflection',pathway:'ideas',source_artifact_id:'a',actor_kind:'agent_review',
    observation:{kind:'learner_reported',text:'Invented verified event'},reflection:{status:'reported_done',action:'Try',observation:'',verified:true}};
  const [memory]=normalizeStoryMemories([idea]);
  assert.equal(memory.reflection.status,'planned');assert.equal(memory.reflection.verified,false);
  assert.equal(memory.observation.kind,'agent_review');assert.equal(memory.observation.text,'');
  assert.deepEqual(normalizeStoryMemories([{...idea,reflection:{}}]),[]);
});

test('saved source anchors reject executable URLs while preserving source labels and locators',()=>{
  const links=storyMemorySourceLinks({source_refs:[null,{url:'javascript:alert(1)'},{url:'data:text/html,x'},
    {url:'https://example.org/source',label:'Exact source',locator:'Paragraph 2'}]});
  assert.deepEqual(links,[{url:'https://example.org/source',label:'Exact source',locator:'Paragraph 2'}]);
  assert.deepEqual(storyMemorySourceLinks(null),[]);
});
