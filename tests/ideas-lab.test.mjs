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
  const expected = { version: 1, sourceId: 'epictetus-enchiridion-1', interpretation: '', revisedInterpretation: '', helpOpen: false, helpSeen: false, sourceOpened: false, unchanged: false, storyChoice: null, comparisonChoice: null, youtubeUrl: '', youtubeTimestamp: '', youtubeNote: '', modelComparison: null };
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
  const doc = { createElementNS(namespace, tag) { return this.createElement(tag); }, createElement(tag) {
    const element = {
      tag, ownerDocument: doc, children: [], attributes: {}, handlers: {}, textContent: '',
      append(...children) { this.children.push(...children); children.forEach(child => { child.parent = this; }); },
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key]; },
      focus() {},
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

test('umbrella choice persists and restores the visible story without authoring learner words', () => {
  const original = testContainer();
  const changes = [], events = [];
  const lab = mountIdeasLab(original.container, { onChange: state => changes.push(state), onEvent: (type, payload) => events.push({ type, payload }) });
  original.elements.find(e => e.attributes['aria-label'] === 'Offer your umbrella to the stranger').fire('click');
  assert.equal(changes.at(-1).storyChoice, 'offer_shelter');
  assert.equal(events.at(-1).type, 'story.choice');
  assert.equal(events.at(-1).payload.state.storyChoice, 'offer_shelter');
  const saved = JSON.parse(JSON.stringify(lab.getState())); lab();
  const reopened = testContainer(); const next = mountIdeasLab(reopened.container, { initialState: saved });
  assert.equal(reopened.elements.find(e => e.className === 'ideas-lab__story').attributes['data-shared'], 'true');
  assert.equal(next.getState().interpretation, '');
  next.setState({ ...saved, storyChoice: 'return_umbrella' });
  assert.equal(reopened.elements.find(e => e.className === 'ideas-lab__story').attributes['data-shared'], 'false');
  next.setState(saved); assert.deepEqual(next.getState(), saved); next();
  assert.equal(validateIdeasState({storyChoice:'invented'}).storyChoice, null);
});

test('comparison doorway records learner choice and leaves both exact drafts owned by learner', () => {
  const { container, elements } = testContainer();
  const lab = mountIdeasLab(container, { initialState: { interpretation: ' First. ', revisedInterpretation: ' Still mine. ', modelComparison: { scenario: 'Your friend disagrees.', question: 'What can you choose?', source_quote: IDEAS_SOURCE.excerpt, source_ref_index: 0 } } });
  elements.find(e => e.textContent === 'Keep my view — explain why').fire('click');
  assert.equal(lab.getState().comparisonChoice, 'keep');
  assert.equal(lab.getState().unchanged, true);
  assert.equal(lab.getState().interpretation, ' First. ');
  assert.equal(lab.getState().revisedInterpretation, ' Still mine. ');
  elements.find(e => e.textContent === 'Compare with my reading').fire('click');
  assert.equal(lab.getState().comparisonChoice, 'reconsider');
  assert.equal(lab.getState().unchanged, false); lab();
});

test('read aloud is explicit and stops when its lab closes', () => {
  const { container, elements } = testContainer();
  const spoken = []; let cancelled = 0;
  container.ownerDocument.defaultView = {
    speechSynthesis: { speak: utterance => spoken.push(utterance.text), cancel: () => cancelled++ },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  };
  const lab = mountIdeasLab(container);
  assert.equal(spoken.length, 0);
  elements.find(e => e.attributes['aria-label'] === 'Hear this authored story').fire('click');
  assert.deepEqual(spoken, ['An imagined moment. Two strangers. One umbrella.']);
  lab(); assert.equal(cancelled, 1);
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

test('story thought meets the source before revision and retains the exact first thought nearby', () => {
  const {container, elements} = testContainer();
  const lab = mountIdeasLab(container);
  const labelled = label => elements.find(e => e.attributes['aria-label'] === label);
  labelled('Offer your umbrella to the stranger').fire('click');
  labelled('Make your own thought from this story').fire('click');
  const first = elements.find(e => e.name === 'interpretation');
  const revised = elements.find(e => e.name === 'revisedInterpretation');
  first.value = '  I can make room.\nThe rain is not mine to stop.  ';
  first.fire('input');
  elements.find(e => e.textContent === 'Meet the source →').fire('click');
  assert.equal(elements.find(e => e.className === 'ideas-lab__source').hidden, false);
  assert.equal(revised.parent.hidden, true);
  assert.equal(lab.getState().helpOpen, false);
  elements.find(e => e.textContent === 'What do I think now? →').fire('click');
  assert.equal(revised.parent.hidden, false);
  assert.equal(labelled('My first thought').hidden, false);
  assert.equal(labelled('My first thought').children[1].textContent, first.value);
  assert.equal(lab.getState().revisedInterpretation, '');
  labelled('Shape my first thought').fire('click');
  assert.equal(first.parent.hidden, false);
  labelled('Revisit my thought').fire('click');
  assert.equal(revised.parent.hidden, false);
  lab.setState({...lab.getState(), interpretation: 'A changed first account.'});
  assert.equal(labelled('My first thought').children[1].textContent, 'A changed first account.');
  lab.setState({...lab.getState(), interpretation: ''});
  assert.equal(labelled('My first thought').hidden, true);
  lab();
});
