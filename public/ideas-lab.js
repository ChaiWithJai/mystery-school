// Passage and translator verified in BrowserOS Neo on 2026-09-10.
export const IDEAS_SOURCE = Object.freeze({
  id: 'epictetus-enchiridion-1',
  author: 'Epictetus',
  work: 'The Enchiridion',
  section: '1',
  translator: 'Elizabeth Carter',
  url: 'https://classics.mit.edu/Epictetus/epicench.html',
  excerpt: 'Some things are in our control and others not.',
});

export const IDEAS_SOURCES = Object.freeze([
  Object.freeze({
    label: 'Epictetus, The Enchiridion (Elizabeth Carter translation)',
    url: IDEAS_SOURCE.url,
    locator: 'Section 1',
  }),
]);

export const IDEAS_GUIDANCE = Object.freeze({
  id: 'control-and-care',
  label: 'Authored suggestion',
  paraphrase: 'Epictetus distinguishes our own actions and judgments from things such as reputation that are not ours to command.',
  alternateReading: 'One possible reading: caring about a friend and controlling their response are different. You might still act with care even when agreement is uncertain.',
  question: 'Think of a disagreement with a friend. What could you choose to do, and what would still be theirs to decide? Does that support or challenge your first reading?',
});

/** Validate a user reference only; this does not establish that a video exists. */
export function validateYouTubeReference(urlText = '', timestamp = '', note = '') {
  const errors = {};
  let videoId = '';
  try {
    const url = new URL(urlText.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error();
    if (url.hostname === 'youtu.be') videoId = url.pathname.slice(1);
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
      else videoId = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)$/)?.[1] || '';
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error();
  } catch { errors.url = 'Use an HTTPS youtube.com video link or youtu.be link.'; }
  const time = typeof timestamp === 'string' ? timestamp.trim() : '';
  let seconds = null;
  if (/^\d{1,5}$/.test(time)) seconds = Number(time);
  else if (/^\d{1,3}:[0-5]\d$/.test(time)) {
    const [minutes, rest] = time.split(':').map(Number);
    seconds = minutes * 60 + rest;
  } else if (/^\d{1,2}:[0-5]\d:[0-5]\d$/.test(time)) {
    const [hours, minutes, rest] = time.split(':').map(Number);
    seconds = hours * 3600 + minutes * 60 + rest;
  }
  if (seconds === null || seconds > 86400) errors.timestamp = 'Enter seconds, mm:ss, or hh:mm:ss, from 0 to 24 hours.';
  if (typeof note !== 'string' || note.length > 4000) errors.note = 'Keep your note within 4,000 characters.';
  const valid = Object.keys(errors).length === 0;
  return { valid, errors, seconds: valid ? seconds : null, url: valid ? `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s` : null };
}

/** Normalize known fields without trimming, replacing, or grading learner drafts. */
export function validateIdeasState(input = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    version: 1,
    sourceId: IDEAS_SOURCE.id,
    interpretation: typeof value.interpretation === 'string' ? value.interpretation : '',
    revisedInterpretation: typeof value.revisedInterpretation === 'string' ? value.revisedInterpretation : '',
    helpOpen: value.helpOpen === true,
    helpSeen: value.helpSeen === true || value.helpOpen === true,
    sourceOpened: value.sourceOpened === true,
    unchanged: value.unchanged === true,
    storyChoice: ['offer_shelter', 'return_umbrella'].includes(value.storyChoice) ? value.storyChoice : null,
    comparisonChoice: ['keep', 'reconsider'].includes(value.comparisonChoice) ? value.comparisonChoice : null,
    youtubeUrl: typeof value.youtubeUrl === 'string' ? value.youtubeUrl.slice(0, 2048) : '',
    youtubeTimestamp: typeof value.youtubeTimestamp === 'string' ? value.youtubeTimestamp.slice(0, 16) : '',
    youtubeNote: typeof value.youtubeNote === 'string' ? value.youtubeNote.slice(0, 4000) : '',
    modelComparison: value.modelComparison && typeof value.modelComparison === 'object'
      ? { scenario: String(value.modelComparison.scenario || ''), question: String(value.modelComparison.question || ''),
        source_quote: String(value.modelComparison.source_quote || ''), source_ref_index: value.modelComparison.source_ref_index } : null,
  };
}

/** Literal links between the passage and drafts, with no inferred belief or score. */
export function deriveConceptMap(input = {}) {
  const state = validateIdeasState(input);
  return {
    nodes: [
      { id: 'source', kind: 'source', label: 'Source passage', text: IDEAS_SOURCE.excerpt, source: { ...IDEAS_SOURCE } },
      { id: 'interpretation', kind: 'learner', label: 'My first reading', text: state.interpretation },
      { id: 'revision', kind: 'learner', label: 'My account now', text: state.revisedInterpretation },
    ],
    edges: [
      { from: 'source', to: 'interpretation', label: 'I interpret' },
      { from: 'interpretation', to: 'revision', label: state.unchanged ? 'I am keeping my view for now' : 'I reconsider' },
    ],
  };
}

let instances = 0;

/**
 * Host loads ideas-lab.css and persists each full onChange snapshot.
 * Mounting emits the full normalized onChange state, then onEvent('open', payload).
 * Help toggles emit 'help'; activating the citation emits 'source'.
 * Events include a detached full state plus
 * source and guidance IDs for host trace linkage. Draft input emits onChange.
 * Cleanup removes only this instance and its listeners. No network/model calls.
 */
export function mountIdeasLab(container, { initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  if (!container?.ownerDocument || typeof container.append !== 'function') {
    throw new TypeError('mountIdeasLab requires a DOM container.');
  }
  if (typeof onChange !== 'function' || typeof onEvent !== 'function') {
    throw new TypeError('onChange and onEvent must be functions.');
  }
  const doc = container.ownerDocument;
  const prefix = `ideas-lab-${++instances}`;
  const listeners = [];
  let state = validateIdeasState(initialState);
  let disposed = false;
  const speech = doc.defaultView?.speechSynthesis;
  const Utterance = doc.defaultView?.SpeechSynthesisUtterance;
  let speaking = false;
  function stopSpeech() { if (speaking && speech) speech.cancel(); speaking = false; }
  function speak(text) {
    if (!speech || !Utterance) return;
    stopSpeech(); speaking = true;
    const utterance = new Utterance(text);
    utterance.onend = utterance.onerror = () => { speaking = false; };
    speech.speak(utterance);
    emit('story.read-aloud', { text, voice: 'browser_speech_synthesis' });
  }

  function node(tag, className, text) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function listen(element, type, handler) {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  }
  function emit(type, detail = {}) {
    if (!disposed) onEvent(type, { lab: 'ideas', sourceId: IDEAS_SOURCE.id, guidanceId: IDEAS_GUIDANCE.id, ...detail, state: { ...state } });
  }
  function update(patch) {
    if (disposed) return;
    state = validateIdeasState({ ...state, ...patch });
    render();
    onChange(structuredClone(state));
  }

  const root = node('section', 'ideas-lab');
  root.setAttribute('aria-labelledby', `${prefix}-title`);
  root.append(node('p', 'ideas-lab__eyebrow', 'Leena / Ideas after work'));
  const title = node('h3', 'ideas-lab__title', 'Make a thought your own.');
  title.id = `${prefix}-title`;
  root.append(title, node('p', 'ideas-lab__intro', 'An old idea. A thought only you can make.'));

  const source = node('section', 'ideas-lab__source');
  source.append(node('h4', 'ideas-lab__step', '01 / Read the source'));
  source.append(node('blockquote', 'ideas-lab__quote', IDEAS_SOURCE.excerpt));
  const citation = node('p', 'ideas-lab__citation', `${IDEAS_SOURCE.author}, ${IDEAS_SOURCE.work}, section ${IDEAS_SOURCE.section}. Translation: ${IDEAS_SOURCE.translator}. `);
  const sourceLink = node('a', '', 'Read section 1 in context (new tab)');
  sourceLink.href = IDEAS_SOURCE.url;
  sourceLink.target = '_blank';
  sourceLink.rel = 'noopener noreferrer';
  citation.append(sourceLink);
  source.append(citation);
  const paraphrase = node('p', 'ideas-lab__paraphrase');
  paraphrase.append(node('strong', '', 'Authored paraphrase: '), node('span', '', IDEAS_GUIDANCE.paraphrase));
  source.append(paraphrase);

  listen(sourceLink, 'click', () => { update({ sourceOpened: true }); emit('source', { url: IDEAS_SOURCE.url }); });
  listen(sourceLink, 'auxclick', event => {
    if (event.button === 1) { update({ sourceOpened: true }); emit('source', { url: IDEAS_SOURCE.url }); }
  });

  const videoSection = node('details', 'ideas-lab__video');
  videoSection.append(node('summary', '', '+ Connect a lecture'));

  const videoNotice = node('p', 'ideas-lab__note', 'User reference, not a verified source. No video or transcript is fetched, verified, or analyzed here. Your note is your account of the moment; the Epictetus passage remains separate.');
  videoNotice.id = `${prefix}-video-notice`;
  videoSection.append(videoNotice);
  const videoFields = {};
  for (const [key, labelText, maxLength, tag] of [
    ['youtubeUrl', 'YouTube video URL (HTTPS)', 2048, 'input'],
    ['youtubeTimestamp', 'Moment in the video (seconds, mm:ss, or hh:mm:ss)', 16, 'input'],
    ['youtubeNote', 'Your note: how does this moment connect to your reading?', 4000, 'textarea'],
  ]) {
    const label = node('label', 'ideas-lab__label', labelText);
    const input = node(tag, tag === 'textarea' ? 'ideas-lab__textarea' : 'ideas-lab__reference-input');
    input.id = `${prefix}-${key}`;
    input.name = key;
    input.maxLength = maxLength;
    input.value = state[key];
    if (tag === 'input') input.type = key === 'youtubeUrl' ? 'url' : 'text';
    else input.rows = 3;
    label.htmlFor = input.id;
    input.setAttribute('aria-describedby', `${videoNotice.id} ${prefix}-video-status`);
    listen(input, 'input', () => update({ [key]: input.value }));
    videoFields[key] = input;
    videoSection.append(label, input);
  }
  videoSection.append(node('p', 'ideas-lab__hint', 'Enter the timestamp separately, even if your link contains a time. This field sets the moment to open. Notes are limited to 4,000 characters.'));
  const videoStatus = node('p', 'ideas-lab__hint');
  videoStatus.id = `${prefix}-video-status`;
  videoStatus.setAttribute('role', 'status');
  const videoLink = node('a', 'ideas-lab__video-link', 'Open your video reference at this moment (new tab)');
  videoLink.target = '_blank';
  videoLink.rel = 'noopener noreferrer';
  listen(videoLink, 'click', () => {
    const reference = validateYouTubeReference(state.youtubeUrl, state.youtubeTimestamp, state.youtubeNote);
    if (reference.valid) emit('source', { sourceId: 'user-youtube-reference', referenceKind: 'user_reference_unverified', url: reference.url, seconds: reference.seconds });
  });
  videoSection.append(videoStatus, videoLink);


  function draftField(key, heading, labelText, hintText) {
    const section = node('section', 'ideas-lab__draft');
    section.append(node('h4', 'ideas-lab__step', heading));
    const label = node('label', 'ideas-lab__label', labelText);
    const input = node('textarea', 'ideas-lab__textarea');
    input.id = `${prefix}-${key}`;
    input.name = key;
    input.rows = 3;
    input.value = state[key];
    label.htmlFor = input.id;
    const hint = node('p', 'ideas-lab__hint', hintText);
    hint.id = `${input.id}-hint`;
    input.setAttribute('aria-describedby', hint.id);
    listen(input, 'input', () => update({ [key]: input.value }));
    section.append(label, hint, input);
    return { section, input };
  }
  const first = draftField('interpretation', '02 / Make a first reading', 'What does this mean to you?', 'Try one sentence you could say to a friend. You can agree, disagree, or be unsure.');


  const helpSection = node('section', 'ideas-lab__help');
  helpSection.append(node('h4', 'ideas-lab__step', '03 / Consider another reading'));
  const helpButton = node('button', 'ideas-lab__button');
  helpButton.type = 'button';
  const helpContent = node('div', 'ideas-lab__help-content');
  helpContent.id = `${prefix}-help`;
  helpButton.setAttribute('aria-controls', helpContent.id);
  helpContent.append(node('p', 'ideas-lab__eyebrow', 'Authored suggestion / optional'));
  helpContent.append(node('p', '', IDEAS_GUIDANCE.alternateReading));
  helpContent.append(node('p', 'ideas-lab__probe', IDEAS_GUIDANCE.question));
  helpContent.append(node('p', 'ideas-lab__note', 'Written for this activity, not generated from or used to judge your answer. Keep what helps; you can leave it aside.'));
  listen(helpButton, 'click', () => { update({ helpOpen: !state.helpOpen }); emit('help', { expanded: state.helpOpen }); });
  helpSection.append(helpButton, helpContent);


  const revised = draftField('revisedInterpretation', '04 / Say what you believe now', 'What would you say to your friend now?', 'Keep, change, or qualify your view. Your first reading stays above so you can compare.');
  const unchangedLabel = node('label', 'ideas-lab__unchanged');
  const unchangedInput = node('input');
  unchangedInput.type = 'checkbox';
  unchangedInput.checked = state.unchanged;
  unchangedLabel.append(unchangedInput, node('span', '', 'Nothing changed yet. I am keeping my view for now.'));
  listen(unchangedInput, 'change', () => update({ unchanged: unchangedInput.checked }));
  revised.section.append(unchangedLabel);


  const map = node('section', 'ideas-lab__map');
  const mapTitle = node('h4', 'ideas-lab__step', 'Your concept map');
  mapTitle.id = `${prefix}-map-title`;
  map.setAttribute('aria-labelledby', mapTitle.id);
  map.append(mapTitle);
  const sky = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sky.setAttribute('viewBox', '0 0 900 470');
  sky.setAttribute('preserveAspectRatio', 'none');
  sky.setAttribute('class', 'ideas-lab__sky');
  sky.setAttribute('aria-hidden', 'true');
  // These paths connect the source, first reading and revision controls below.
  for (const d of ['M 190 300 C 270 300 320 130 450 130', 'M 450 130 C 620 130 590 300 735 275']) {
    const path = doc.createElementNS(sky.namespaceURI, 'path');
    path.setAttribute('d', d); sky.append(path);
  }
  for (let i = 0; i < 36; i++) {
    const star = doc.createElementNS(sky.namespaceURI, 'circle');
    star.setAttribute('cx', String((i * 137 + 31) % 900));
    star.setAttribute('cy', String((i * 79 + 19) % 440));
    star.setAttribute('r', String(i % 5 === 0 ? 2 : 1)); sky.append(star);
  }
  map.append(sky);
  const chain = node('ol', 'ideas-lab__chain');
  const mapTexts = [];
  const mapCards = [];
  const mapEdges = [];
  const initialMap = deriveConceptMap(state);
  for (const [index, item] of initialMap.nodes.entries()) {
    const entry = node('li', `ideas-lab__map-entry ideas-lab__map-entry--${item.kind}`);
    if (index) {
      const edge = node('p', 'ideas-lab__edge');
      mapEdges.push(edge);
      entry.append(edge);
    }
    const card = node('button', 'ideas-lab__map-card');
    card.type = 'button';
    mapCards.push(card);
    card.setAttribute('aria-label', ['Open source passage', 'Shape my first thought', 'Revisit my thought'][index]);
    listen(card, 'click', () => selectOrb(index));
    const symbol = node('span', `ideas-lab__symbol ideas-lab__symbol--${index}`);
    symbol.setAttribute('aria-hidden', 'true');
    if (index === 0) { symbol.append(node('span', 'ideas-lab__page'), node('span', 'ideas-lab__page')); }
    else symbol.textContent = index === 1 ? '✧' : '✦';
    card.append(symbol);
    card.append(node('h5', '', item.label));
    const text = node('p');
    mapTexts.push(text);
    card.append(text);
    if (!index) card.append(node('small', '', 'Epictetus / The Enchiridion / section 1'));
    entry.append(card);
    chain.append(entry);
  }
  map.append(chain);
  const story = node('section', 'ideas-lab__story');
  story.setAttribute('aria-label', 'Authored story: two strangers in the rain');
  story.append(node('small', 'ideas-lab__story-origin', 'An imagined moment'));
  const storyCaption = node('p', 'ideas-lab__story-caption', 'Two strangers. One umbrella.');
  storyCaption.setAttribute('role', 'status');
  const rain = node('div', 'ideas-lab__rain'); rain.setAttribute('aria-hidden', 'true');
  const street = node('div', 'ideas-lab__street'); street.setAttribute('aria-hidden', 'true');
  for (const name of ['you', 'stranger']) {
    const person = node('span', `ideas-lab__person ideas-lab__person--${name}`);
    person.append(node('i', 'ideas-lab__head'), node('i', 'ideas-lab__body'), node('i', 'ideas-lab__leg'), node('i', 'ideas-lab__leg'));
    street.append(person);
  }
  const umbrella = node('button', 'ideas-lab__umbrella'); umbrella.type = 'button';
  umbrella.setAttribute('aria-label', 'Offer your umbrella to the stranger');
  const umbrellaIcon = node('span', '', '☂'); umbrellaIcon.setAttribute('aria-hidden', 'true');
  umbrella.append(umbrellaIcon);
  const bookDoor = node('button', 'ideas-lab__story-book'); bookDoor.type = 'button';
  bookDoor.setAttribute('aria-label', 'Discover the idea behind this story');
  bookDoor.append(node('span', 'ideas-lab__page'), node('span', 'ideas-lab__page'));
  bookDoor.hidden = true;
  const enterMap = node('button', 'ideas-lab__story-next', '✧'); enterMap.type = 'button';
  enterMap.setAttribute('aria-label', 'Make your own thought from this story'); enterMap.hidden = true;
  listen(umbrella, 'click', () => {
    const shared = state.storyChoice !== 'offer_shelter';
    update({ storyChoice: shared ? 'offer_shelter' : 'return_umbrella' });
    emit('story.choice', { storyId: 'authored-rain-and-care', authored: true, action: shared ? 'offer_shelter' : 'return_umbrella', outcome: 'Authored illustration; not a prediction of another person’s response.' });
  });
  const leaveStory = index => { stopSpeech(); story.hidden = true; chain.hidden = false; selectOrb(index); };
  listen(bookDoor, 'click', () => leaveStory(0));
  listen(enterMap, 'click', () => leaveStory(1));
  story.append(rain, street, storyCaption, umbrella, bookDoor, enterMap);
  if (speech && Utterance) {
    const storyVoice = node('button', 'ideas-lab__voice', '◖))'); storyVoice.type = 'button';
    storyVoice.setAttribute('aria-label', 'Hear this authored story');
    listen(storyVoice, 'click', () => speak(`An imagined moment. ${storyCaption.textContent}`));
    story.append(storyVoice);
  }
  if (!state.interpretation && !state.revisedInterpretation) chain.hidden = true;
  else story.hidden = true;
  map.append(story);
  root.append(map);
  const editor = node('div', 'ideas-lab__editor');
  const closeEditor = node('button', 'ideas-lab__close', '×');
  closeEditor.type = 'button'; closeEditor.setAttribute('aria-label', 'Return to the constellation');
  listen(closeEditor, 'click', () => { stopSpeech(); editor.hidden = true; mapCards[activeOrb]?.focus(); });
  listen(editor, 'keydown', event => { if (event.key === 'Escape') { stopSpeech(); editor.hidden = true; mapCards[activeOrb]?.focus(); } });
  editor.append(closeEditor, source, first.section, revised.section, helpSection);
  root.append(editor, videoSection);
  const comparison = node('details', 'ideas-lab__model-comparison');
  const comparisonDoor = node('summary', '', '✦');
  comparisonDoor.setAttribute('aria-label', 'Enter Astra’s new situation');
  comparison.append(comparisonDoor);
  const comparisonTitle = node('h4', 'ideas-lab__step', 'Try your reading in another situation');
  const comparisonSource = node('blockquote');
  const comparisonScenario = node('p');
  const comparisonQuestion = node('p', 'ideas-lab__probe');
  const comparisonTry = node('button', 'ideas-lab__button', 'Compare with my reading');
  comparisonTry.type = 'button';
  listen(comparisonTry, 'click', () => { stopSpeech(); comparison.open = false; story.hidden = true; chain.hidden = false; update({ comparisonChoice: 'reconsider', unchanged: false }); selectOrb(2); revised.input.focus(); emit('model-comparison.try', { comparison: state.modelComparison, choice: 'reconsider' }); });
  const comparisonKeep = node('button', 'ideas-lab__button', 'Keep my view — explain why'); comparisonKeep.type = 'button';
  listen(comparisonKeep, 'click', () => { stopSpeech(); comparison.open = false; story.hidden = true; chain.hidden = false; update({ comparisonChoice: 'keep', unchanged: true }); selectOrb(2); revised.input.focus(); emit('model-comparison.try', { comparison: state.modelComparison, choice: 'keep' }); });
  comparison.append(comparisonTitle, node('small', '', 'Astra’s thought experiment · the rain scene is authored separately'),
    comparisonSource, comparisonScenario, comparisonQuestion, comparisonTry);
  comparison.append(comparisonKeep);
  if (speech && Utterance) {
    const comparisonVoice = node('button', 'ideas-lab__button', 'Hear the situation'); comparisonVoice.type = 'button';
    listen(comparisonVoice, 'click', () => speak(`Astra's thought experiment. ${state.modelComparison?.scenario || ''} ${state.modelComparison?.question || ''} Source excerpt: ${state.modelComparison?.source_quote || ''}`));
    comparison.append(comparisonVoice);
  }
  listen(comparison, 'toggle', () => { if (!comparison.open) stopSpeech(); });
  map.append(comparison);
  let activeOrb = state.revisedInterpretation ? 2 : 0;
  function selectOrb(index, notify = true) {
    activeOrb = index;
    editor.hidden = !notify;
    root.setAttribute('data-focus', String(index));
    source.hidden = index !== 0;
    first.section.hidden = index !== 1;
    revised.section.hidden = index !== 2;
    helpSection.hidden = index === 0;
    mapCards.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (notify) {
      const focusTarget = index === 1 ? first.input : index === 2 ? revised.input : closeEditor;
      focusTarget.focus({ preventScroll: true });
    }
    if (notify) emit('focus', { node: ['source', 'interpretation', 'revision'][index] });
  }
  const begin = node('button', 'ideas-lab__button', 'What do I think? →');
  listen(begin, 'click', () => { selectOrb(1); first.input.focus(); });
  source.append(begin);
  const connect = node('button', 'ideas-lab__button', 'Try another angle →');
  listen(connect, 'click', () => { selectOrb(2); update({helpOpen: true}); emit('help', {expanded:true}); revised.input.focus(); });
  first.section.append(connect);
  selectOrb(activeOrb, false);
  const status = node('p', 'ideas-lab__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.append(status);

  function render() {
    const shared = state.storyChoice === 'offer_shelter';
    story.setAttribute('data-shared', String(shared));
    umbrella.setAttribute('aria-label', shared ? 'Bring the umbrella back' : 'Offer your umbrella to the stranger');
    storyCaption.textContent = shared ? 'The rain stays. You make room.' : 'Two strangers. One umbrella.';
    bookDoor.hidden = enterMap.hidden = !shared;
    comparison.hidden = !state.modelComparison;
    comparisonSource.textContent = state.modelComparison?.source_quote || '';
    comparisonScenario.textContent = state.modelComparison?.scenario || '';
    comparisonQuestion.textContent = state.modelComparison?.question || '';
    const reference = validateYouTubeReference(state.youtubeUrl, state.youtubeTimestamp, state.youtubeNote);
    const hasReference = Boolean(state.youtubeUrl || state.youtubeTimestamp || state.youtubeNote);
    videoLink.hidden = !reference.valid;
    videoLink.href = reference.url || '';
    videoStatus.textContent = !hasReference ? 'Optional. Your reference draft is kept with your other words.' : reference.valid
      ? 'Link format and time are valid. Video availability and content have not been verified.'
      : Object.values(reference.errors).join(' ');
    videoFields.youtubeUrl.setAttribute('aria-invalid', String(hasReference && Boolean(reference.errors.url)));
    videoFields.youtubeTimestamp.setAttribute('aria-invalid', String(hasReference && Boolean(reference.errors.timestamp)));
    helpContent.hidden = !state.helpOpen;
    helpButton.textContent = state.helpOpen ? 'Hide the suggestion' : 'Offer me another reading';
    helpButton.setAttribute('aria-expanded', String(state.helpOpen));
    const conceptMap = deriveConceptMap(state);
    conceptMap.nodes.forEach((item, index) => {
      mapTexts[index].textContent = index === 0 ? 'An idea across centuries' : item.text || (index === 1 ? 'Your thought' : 'Look again');
      mapCards[index].setAttribute('data-has-thought', String(Boolean(item.text)));
    });
    conceptMap.edges.forEach((edge, index) => { mapEdges[index].textContent = edge.label; });
    const nextStatus = state.revisedInterpretation.trim()
      ? 'Both versions are here for you to compare. You can keep revising.'
      : state.unchanged ? 'Keeping your view is an option. Both draft fields remain yours to edit.'
        : 'A rough thought is enough to begin. There is no scored or correct answer.';
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
  }

  render();
  container.append(root);
  onChange(structuredClone(state));
  emit('open');
  const cleanup = () => {
    if (disposed) return;
    stopSpeech();
    disposed = true;
    for (const remove of listeners) remove();
    root.remove();
  };
  cleanup.getState = () => structuredClone(state);
  cleanup.setState = value => {
    if (disposed) throw Error('This experiment is closed.');
    const next = validateIdeasState(value);
    if (next.modelComparison && (!next.modelComparison.source_quote ||
      !IDEAS_SOURCE.excerpt.includes(next.modelComparison.source_quote))) throw Error('Comparison must quote the available source excerpt.');
    state = next;
    first.input.value = state.interpretation;
    revised.input.value = state.revisedInterpretation;
    unchangedInput.checked = state.unchanged;
    for (const key of Object.keys(videoFields)) videoFields[key].value = state[key];
    render(); onChange(structuredClone(state)); emit('model-comparison.change');
  };
  return cleanup;
}
