import test from 'node:test';
import assert from 'node:assert/strict';
import { IDEAS_SOURCE, IDEAS_SOURCES, validateIdeasState, validateYouTubeReference, deriveConceptMap, mountIdeasLab } from '../public/ideas-lab.js';

test('parent artifact source references include a work, URL and section locator', () => {
  assert.deepEqual(IDEAS_SOURCES, [{
    label: 'Epictetus, The Enchiridion (Elizabeth Carter translation)',
    url: IDEAS_SOURCE.url,
    locator: 'Section 1',
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(IDEAS_SOURCES)), IDEAS_SOURCES);
});

test('empty and malformed persisted state normalize to a complete JSON state', () => {
  const expected = { version: 1, sourceId: 'epictetus-enchiridion-1', interpretation: '', revisedInterpretation: '', helpOpen: false, helpSeen: false, sourceOpened: false, unchanged: false, youtubeUrl: '', youtubeTimestamp: '', youtubeNote: '', modelComparison: null };
  for (const value of [undefined, null, [], 2, 'draft', { interpretation: {}, revisedInterpretation: 10, helpOpen: 'true' }]) {
    assert.deepEqual(validateIdeasState(value), expected);
  }
});

test('drafts retain exact whitespace, punctuation, Unicode and HTML as literal text', () => {
  const input = { interpretation: '  I disagree.\nWhy? <script>no()</script>', revisedInterpretation: 'I\u2019m still unsure.\n  ', helpOpen: true, sourceOpened: true, unchanged: true };
  const state = validateIdeasState(input);
  assert.equal(state.interpretation, input.interpretation);
  assert.equal(state.revisedInterpretation, input.revisedInterpretation);
  assert.equal(state.helpSeen, true);
  assert.deepEqual(validateIdeasState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(input.helpSeen, undefined);
});

test('closing help keeps the record that the suggestion was seen', () => {
  const open = validateIdeasState({ helpOpen: true });
  assert.equal(validateIdeasState({ ...open, helpOpen: false }).helpSeen, true);
});

test('map separates source text from learner drafts and retains citation', () => {
  const map = deriveConceptMap({ interpretation: 'This seems too simple.', revisedInterpretation: 'I can care without deciding for my friend.' });
  assert.equal(map.nodes[0].text, IDEAS_SOURCE.excerpt);
  assert.equal(map.nodes[0].source.url, 'https://classics.mit.edu/Epictetus/epicench.html');
  assert.equal(map.nodes[0].source.section, '1');
  assert.equal(map.nodes[0].source.translator, 'Elizabeth Carter');
  assert.equal(map.nodes[1].text, 'This seems too simple.');
  assert.equal(map.nodes[2].text, 'I can care without deciding for my friend.');
  assert.deepEqual(map.edges.map(edge => [edge.from, edge.to]), [['source', 'interpretation'], ['interpretation', 'revision']]);
  assert.deepEqual(JSON.parse(JSON.stringify(map)), map);
});

test('an empty account stays empty and a unchanged view is not replaced or scored', () => {
  const empty = deriveConceptMap();
  assert.equal(empty.nodes[1].text, '');
  assert.equal(empty.nodes[2].text, '');
  const map = deriveConceptMap({ interpretation: 'I disagree.', unchanged: true });
  assert.equal(map.nodes[1].text, 'I disagree.');
  assert.equal(map.nodes[2].text, '');
  assert.equal(map.edges[1].label, 'I am keeping my view for now');
  assert.equal('score' in map, false);
});

test('state and map results do not share mutable objects with input or constants', () => {
  const input = { interpretation: 'Keep this.' };
  const state = validateIdeasState(input);
  state.interpretation = 'Changed';
  assert.equal(input.interpretation, 'Keep this.');
  const map = deriveConceptMap(input);
  map.nodes[0].source.url = 'bad';
  assert.equal(deriveConceptMap(input).nodes[0].source.url, IDEAS_SOURCE.url);
  assert.ok(IDEAS_SOURCE.excerpt.split(/\s+/).length <= 25);
});

test('mount rejects invalid containers and callbacks before DOM work', () => {
  assert.throws(() => mountIdeasLab(null), TypeError);
  assert.throws(() => mountIdeasLab({ ownerDocument: {}, append() {} }, { onChange: false }), TypeError);
  assert.throws(() => mountIdeasLab({ ownerDocument: {}, append() {} }, { onEvent: false }), TypeError);
});

// Minimal DOM double exercises the host callback contract without a browser dependency.
function testContainer() {
  const elements = [];
  const doc = { createElement(tag) {
    const element = {
      tag, ownerDocument: doc, children: [], attributes: {}, handlers: {}, textContent: '',
      append(...children) { this.children.push(...children); children.forEach(child => { child.parent = this; }); },
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(type, handler) { (this.handlers[type] ??= new Set()).add(handler); },
      removeEventListener(type, handler) { this.handlers[type]?.delete(handler); },
      fire(type, event = {}) { this.handlers[type]?.forEach(handler => handler(event)); },
      remove() { this.parent.children = this.parent.children.filter(child => child !== this); },
    };
    elements.push(element);
    return element;
  } };
  return { container: doc.createElement('main'), elements };
}

test('Astra comparison changes the activity without replacing learner words and restores exactly', () => {
  const { container, elements } = testContainer();
  const cleanup = mountIdeasLab(container, { initialState: { interpretation: '  My words.', revisedInterpretation: 'My uncertainty.' } });
  const before = cleanup.getState();
  const modelComparison = { scenario: 'A friend disagrees with a rule you support.', question: 'What would you choose, and what cannot you choose?', source_quote: IDEAS_SOURCE.excerpt, source_ref_index: 0 };
  cleanup.setState({ ...before, modelComparison });
  assert.equal(cleanup.getState().interpretation, before.interpretation);
  assert.equal(cleanup.getState().revisedInterpretation, before.revisedInterpretation);
  assert.ok(elements.some(element => element.textContent === modelComparison.scenario));
  const applied = cleanup.getState();
  assert.throws(() => cleanup.setState({ ...before, modelComparison: { ...modelComparison, source_quote: 'Invented quotation.' } }));
  assert.deepEqual(cleanup.getState(), applied);
  cleanup.setState(before);
  assert.deepEqual(cleanup.getState(), before);
  cleanup();
});

test('mount emits complete defaults once, uses two-argument events, and cleanup detaches', () => {
  const { container, elements } = testContainer();
  const changes = [], events = [];
  const cleanup = mountIdeasLab(container, {
    onChange: state => changes.push(state),
    onEvent: (type, payload) => events.push({ type, payload }),
  });
  assert.deepEqual(changes, [validateIdeasState()]);
  assert.equal(events[0].type, 'open');
  const first = elements.find(element => element.name === 'interpretation');
  first.value = '  My words\n';
  first.fire('input');
  assert.deepEqual(changes.at(-1), validateIdeasState({ interpretation: first.value }));
  assert.equal(changes[0].interpretation, '');
  const button = elements.find(element => element.tag === 'button');
  button.fire('click');
  assert.equal(events.at(-1).type, 'help');
  assert.equal(events.at(-1).payload.expanded, true);
  assert.equal(changes.at(-1).interpretation, first.value);
  elements.find(element => element.tag === 'a').fire('click');
  assert.equal(events.at(-1).type, 'source');
  assert.equal(changes.at(-1).sourceOpened, true);
  const count = changes.length;
  cleanup();
  cleanup();
  first.fire('input');
  button.fire('click');
  assert.equal(changes.length, count);
  assert.equal(container.children.length, 0);
});

test('restoring a draft preserves both versions and help without altering the input', () => {
  const { container, elements } = testContainer();
  const initialState = { interpretation: 'First.', revisedInterpretation: 'Still first.', helpOpen: true, unchanged: true };
  const changes = [];
  const cleanup = mountIdeasLab(container, { initialState, onChange: state => changes.push(state) });
  assert.deepEqual(elements.filter(element => ['interpretation', 'revisedInterpretation'].includes(element.name)).map(element => element.value), ['First.', 'Still first.']);
  assert.equal(elements.find(element => element.tag === 'button').attributes['aria-expanded'], 'true');
  changes[0].interpretation = 'Mutation in parent';
  assert.equal(initialState.interpretation, 'First.');
  elements.find(element => element.tag === 'button').fire('click');
  assert.equal(changes.at(-1).interpretation, 'First.');
  assert.equal(changes.at(-1).helpSeen, true);
  cleanup();
});

test('YouTube references canonicalize only allowed video domains and explicit times', () => {
  for (const url of ['https://youtu.be/abcdefghijk', 'https://www.youtube.com/watch?v=abcdefghijk&t=2s', 'https://m.youtube.com/shorts/abcdefghijk', 'https://youtube.com/embed/abcdefghijk', 'https://youtube.com/live/abcdefghijk']) {
    const reference = validateYouTubeReference(url, '01:02:03', 'My own note.');
    assert.equal(reference.valid, true);
    assert.equal(reference.seconds, 3723);
    assert.equal(reference.url, 'https://www.youtube.com/watch?v=abcdefghijk&t=3723s');
  }
  for (const time of ['0', '00:00', '24:00:00', '86400']) assert.equal(validateYouTubeReference('https://youtu.be/abcdefghijk', time).valid, true);
});

test('spoofed domains, unsafe schemes, malformed video IDs and invalid times never produce a link', () => {
  for (const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://evil.test/youtube.com', 'javascript:alert(1)', 'http://youtu.be/abcdefghijk', 'https://user@youtube.com/watch?v=abcdefghijk', 'https://youtube.com:8080/watch?v=abcdefghijk', 'https://youtu.be/short', 'https://youtube.com/playlist?list=abcdefghijk', null]) {
    assert.equal(validateYouTubeReference(url, '60').url, null);
  }
  for (const time of ['', '-1', '1.5', '1:60', '25:00:00', '86401', '1h2m', null]) {
    assert.equal(validateYouTubeReference('https://youtu.be/abcdefghijk', time).valid, false);
  }
});

test('reference drafts persist while incomplete, are bounded, and remain separate from inspected source', () => {
  const state = validateIdeasState({ youtubeUrl: 'bad unfinished URL', youtubeTimestamp: '1:', youtubeNote: '  My note\n', interpretation: 'My belief' });
  assert.deepEqual(validateIdeasState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(state.youtubeNote, '  My note\n');
  assert.equal(state.sourceId, IDEAS_SOURCE.id);
  assert.equal(validateIdeasState({ youtubeNote: 'x'.repeat(4001) }).youtubeNote.length, 4000);
  assert.equal(validateYouTubeReference('https://youtu.be/abcdefghijk', '0', 'x'.repeat(4001)).valid, false);
  const { container, elements } = testContainer();
  const changes = [];
  const cleanup = mountIdeasLab(container, { initialState: state, onChange: value => changes.push(value) });
  const input = elements.find(element => element.name === 'youtubeTimestamp');
  assert.equal(input.value, '1:');
  input.value = '60'; input.fire('input');
  assert.equal(changes.at(-1).youtubeTimestamp, '60');
  assert.equal(changes.at(-1).youtubeNote, '  My note\n');
  assert.equal(changes.at(-1).interpretation, 'My belief');
  cleanup();
});
