const STEPS = ['invitation', 'plan', 'observation', 'meaning', 'question', 'journey'];
export function normalizeReflection(value = {}) {
  const text = key => typeof value?.[key] === 'string' ? value[key] : '';
  const action = text('action'), observation = text('observation');
  const status = value?.status === 'reported_done' && action.trim() && observation.trim() ? 'reported_done'
    : ['planned', 'reported_done'].includes(value?.status) && action.trim() ? 'planned' : 'draft';
  return {version: 1, step: STEPS.includes(value?.step) ? value.step : 'invitation', action, observation,
    interpretation: text('interpretation'), revisedBelief: text('revisedBelief'), question: text('question'),
    status, evidenceKind: status === 'reported_done' ? 'learner_report' : 'intention', verified: false};
}

export function mountRealWorldReflection(container, {initialState = {}, onChange = () => {}, onEvent = () => {}, onKeep = null} = {}) {
  if (!container?.ownerDocument || typeof container.append !== 'function') throw TypeError('A DOM container is required.');
  if (typeof onChange !== 'function' || typeof onEvent !== 'function') throw TypeError('Callbacks must be functions.');
  const doc = container.ownerDocument, listeners = [], fields = {}, panels = {};
  let state = normalizeReflection(initialState), disposed = false, speaking = false;
  const speech = doc.defaultView?.speechSynthesis, Voice = doc.defaultView?.SpeechSynthesisUtterance;
  const node = (tag, className, text) => {const e = doc.createElement(tag); e.className = className; if (text !== undefined) e.textContent = text; return e;};
  const listen = (e, type, fn) => {e.addEventListener(type, fn); listeners.push(() => e.removeEventListener(type, fn));};
  const root = node('section', 'world-reflection'); root.setAttribute('aria-label', 'Take an idea into life');
  const portal = node('div', 'world-reflection__portal', '↗'); portal.setAttribute('aria-hidden', 'true'); root.append(portal);
  const emit = (type, detail = {}) => {if (!disposed) onEvent(type, {...detail, state: structuredClone(state), verified: false});};
  const stop = () => {if (speaking && speech) speech.cancel(); speaking = false;};
  function update(patch) {if (disposed) return; state = normalizeReflection({...state, ...patch}); render(); onChange(structuredClone(state));}
  function go(step) {stop(); update({step}); emit('reflection.navigate', {step}); panels[step].heading.focus();}
  function button(parent, text, fn) {const b = node('button', 'world-reflection__button', text); b.type = 'button'; listen(b, 'click', fn); parent.append(b); return b;}
  function panel(step, title) {const p = node('div', 'world-reflection__panel'); const heading = node('h3', '', title); heading.tabIndex = -1; p.append(heading); panels[step] = {element:p, heading};root.append(p);return p;}
  function field(parent, key, label) {
    const wrap = node('label', 'world-reflection__field'); wrap.append(node('span', '', label));
    const input = node('textarea', ''); input.name = key; input.rows = 2; input.value = state[key];
    listen(input, 'input', () => {const patch = {[key]:input.value}; if (key === 'action' && input.value !== state.action) patch.status = 'draft'; if (key === 'observation' && input.value !== state.observation && state.status === 'reported_done') patch.status = 'planned'; update(patch); emit('reflection.draft', {field:key});});
    wrap.append(input);parent.append(wrap); fields[key] = input;
  }
  const invitation = panel('invitation', 'An idea needs a life.');
  invitation.append(node('p', '', 'Take one small action. Come back with what happened.'));
  button(invitation, 'Step outside the page ↗', () => go('plan'));
  const plan = panel('plan', 'What will you try?');
  field(plan, 'action', 'One small action, with someone or somewhere real.');
  const planButton = button(plan, 'Keep my plan', () => {if (!state.action.trim()) return; update({status:'planned'}); emit('reflection.planned');go('observation');});
  const observation = panel('observation', 'Back from the world?');
  observation.append(node('p', '', 'Your plan stays here while you go. Return when you have something to notice.'));
  field(observation, 'observation', 'What happened that someone else could have seen or heard?');
  const doneButton = button(observation, 'I tried it. Keep my account →', () => {if (!state.action.trim() || !state.observation.trim()) return;update({status:'reported_done'});emit('reflection.reported', {evidenceKind:'learner_report'});go('meaning');});
  button(observation, 'Change my plan', () => go('plan'));
  const meaning = panel('meaning', 'What do you make of it?');
  const observed = node('blockquote', 'world-reflection__memory');meaning.append(observed);
  field(meaning, 'interpretation', 'My interpretation — separate from what happened.');
  field(meaning, 'revisedBelief', 'What I believe now. Keeping my view is allowed.');
  button(meaning, 'Carry a question →', () => go('question'));
  button(meaning, 'Revisit what happened', () => go('observation'));
  const question = panel('question', 'What will you notice next?');
  field(question, 'question', 'A question worth taking back into life.');
  button(question, 'See my journey →', () => go('journey'));
  const journey = panel('journey', 'Tell your own journey.');
  const trail = node('div', 'world-reflection__trail'); journey.append(trail);
  const journeyFields = {}; let actionLabel;
  for (const [key,label] of [['action','Tried'],['observation','Noticed'],['interpretation','Made sense of'],['revisedBelief','Believe now'],['question','Wonder']]) {const item=node('div',''); const caption=node('small','',label);if(key==='action')actionLabel=caption;item.append(caption);journeyFields[key]=node('p','');item.append(journeyFields[key]);trail.append(item);}
  journey.append(node('p', '', 'Start with someone you know. Your words, your next beginning.'));
  if (typeof onKeep === 'function') {
    const keep = button(journey, 'Keep this journey in my world →', async () => {
      if (keep.disabled) return;
      keep.disabled = true;
      try { await onKeep(structuredClone(state)); }
      finally { if (!disposed) keep.disabled = false; }
    });
  }
  button(journey, 'Keep shaping my account', () => go('meaning'));
  const status = node('small', 'world-reflection__status');status.setAttribute('role','status');root.append(status);
  if (speech && Voice) button(root, 'Hear this moment', () => {stop();const text=panels[state.step].heading.textContent;const utterance=new Voice(text);speaking=true;utterance.onend=utterance.onerror=()=>{speaking=false;};speech.speak(utterance);emit('reflection.read-aloud',{voice:'browser_speech_synthesis',text});});
  function render() {
    for (const [step,p] of Object.entries(panels)) p.element.hidden = step !== state.step;
    planButton.disabled = !state.action.trim();doneButton.disabled = !state.action.trim() || !state.observation.trim();
    observed.textContent = state.observation;
    actionLabel.textContent = state.status === 'reported_done' ? 'Tried' : 'Planned';
    for (const [key,e] of Object.entries(journeyFields)) {e.textContent=state[key];if (e.parentNode) e.parentNode.hidden = !state[key].trim();}
    status.textContent = state.status === 'reported_done' ? 'Your account · learner reported, not verified' : state.status === 'planned' ? 'Planned · the real-world action is still ahead' : 'Your draft · nothing marked done';
    root.setAttribute('data-step', state.step);
  }
  render();container.append(root);onChange(structuredClone(state));
  return {getState:()=>structuredClone(state), setState(value) {if(disposed)throw Error('This reflection is closed.');stop();state=normalizeReflection(value);for(const [key,input] of Object.entries(fields))input.value=state[key];render();onChange(structuredClone(state));}, dispose() {if(disposed)return;stop();disposed=true;listeners.forEach(remove=>remove());root.remove();}};
}
