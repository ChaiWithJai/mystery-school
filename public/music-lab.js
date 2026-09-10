export const MIN_ATTACK = 0.02;
export const MAX_ATTACK = 0.8;
export const NOTE_DURATION = 1.1;
const RELEASE_START = 0.92;
const ORIGINAL_ATTACK = MIN_ATTACK;
const SUGGESTED_ATTACK = 0.35;
const NOTE_SPACING = 1.2;
const PHRASE = Object.freeze([
  Object.freeze({ name: 'C4', frequency: 261.625565 }),
  Object.freeze({ name: 'E4', frequency: 329.627557 }),
  Object.freeze({ name: 'G4', frequency: 391.995436 }),
  Object.freeze({ name: 'C5', frequency: 523.251131 }),
]);
const PHRASE_DURATION = Number(((PHRASE.length - 1) * NOTE_SPACING + NOTE_DURATION).toFixed(3));
let instanceCount = 0;

function validateAttack(attack) {
  if (!Number.isFinite(attack) || attack < MIN_ATTACK || attack > MAX_ATTACK) {
    throw new RangeError('Attack must be a number from 0.02 to 0.8 seconds.');
  }
  return attack;
}

/** Rise in normalized amplitude per second during the linear attack. */
export function attackSlope(attack) { return 1 / validateAttack(attack); }

/** Breakpoints of one note's amplitude envelope, not its oscillating waveform. */
export function envelopePoints(attack) {
  validateAttack(attack);
  return [{ time: 0, amplitude: 0 }, { time: attack, amplitude: 1 },
    { time: RELEASE_START, amplitude: 1 }, { time: NOTE_DURATION, amplitude: 0 }];
}

/** Normalized amplitude at a time in seconds; silence outside the note. */
export function envelopeAt(time, attack) {
  validateAttack(attack);
  if (!Number.isFinite(time)) throw new RangeError('Time must be a finite number of seconds.');
  if (time <= 0 || time >= NOTE_DURATION) return 0;
  if (time < attack) return time / attack;
  if (time <= RELEASE_START) return 1;
  return (NOTE_DURATION - time) / (NOTE_DURATION - RELEASE_START);
}

export function normalizeMusicState(initialState = {}) {
  if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
    throw new TypeError('Music state must be an object with an attack value.');
  }
  return { attack: validateAttack(initialState.attack === undefined ? ORIGINAL_ATTACK : initialState.attack) };
}

/**
 * Load music-lab.css in the host. No audio context or event is created on mount.
 * onChange({ attack }) receives full serializable state once on mount, then on change.
 * onEvent(type, metadata) emits play, stop, or help; these describe actions, not learning.
 * cleanup is idempotent, stops sound, releases audio resources, and emits no event.
 */
export function mountMusicLab(container, { initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  const state = normalizeMusicState(initialState);
  if (!container?.ownerDocument || typeof container.append !== 'function') throw new TypeError('A DOM container is required.');
  if (typeof onChange !== 'function' || typeof onEvent !== 'function') throw new TypeError('Music callbacks must be functions.');
  const doc = container.ownerDocument, win = doc.defaultView;
  const prefix = `music-lab-${++instanceCount}`;
  const listeners = [];
  let context = null, master = null, voices = [], timer = null, playing = null;
  let disposed = false, starting = false, generation = 0, previousAttack = null;

  function node(tag, className, text) {
    const result = doc.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function svg(tag, attrs = {}, text) {
    const result = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) result.setAttribute(key, value);
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  }
  function button(text, handler, className) {
    const result = node('button', className, text); result.type = 'button';
    listen(result, 'click', handler); return result;
  }
  function fmt(value) { return Number(value.toFixed(4)).toString(); }
  function emit(type, data) {
    onEvent(type, { source_kind: 'synthesized_phrase', ...data });
  }

  const root = node('section', 'music-lab'); root.setAttribute('aria-labelledby', `${prefix}-title`);
  root.append(node('p', 'music-lab__eyebrow', 'Maya / a synthesized musical sketch'));
  const title = node('h3', 'music-lab__title', 'A gentler entrance for Grandma.'); title.id = `${prefix}-title`;
  const storyContext = node('details', 'music-lab__context');
  storyContext.append(node('summary', '', 'The song behind this experiment'));
  root.append(title);
  storyContext.append(node('p', 'music-lab__voice', '"I want to finish a song for my grandmother. I hear how it should begin, but this entrance feels too sudden."'));
  root.append(node('p', 'music-lab__intro', 'Hear the phrase. Shape its entrance.'));
  storyContext.append(node('p', '', 'Keep the same four notes; change how gently each one begins.'));

  const phrase = node('div', 'music-lab__phrase'); phrase.setAttribute('aria-label', 'Phrase: C4, E4, G4, C5');
  for (const note of PHRASE) { const key=node('button', 'music-lab__key', note.name); key.type='button'; key.setAttribute('aria-label','Play '+note.name); listen(key,'click',()=>play('after',[note])); phrase.append(key); }
  root.append(phrase);
  const playback = node('div', 'music-lab__playback');
  const before = button('Hear original', () => play('before'), 'music-lab__before');
  const after = button('Hear my version', () => play('after'), 'music-lab__after');
  const stop = button('Stop', () => stopPlayback('requested'), 'music-lab__stop');
  playback.append(before, after, stop); root.append(playback);
  const audioStatus = node('p', 'music-lab__status', 'Ready when you are. Playback begins only when you press Hear.');
  audioStatus.setAttribute('role', 'status'); audioStatus.setAttribute('aria-live', 'polite');
  const audioError = node('p', 'music-lab__error'); audioError.setAttribute('role', 'alert'); audioError.hidden = true;
  root.append(audioStatus, audioError);
  storyContext.append(node('p', 'music-lab__scope', 'A quiet synthesized sine-tone phrase, not a recorded piano. Your device controls the listening level.'));

  const controls = node('div', 'music-lab__controls');
  const row = node('div', 'music-lab__slider-row');
  const label = node('label', '', 'Time to reach full note amplitude'); label.htmlFor = `${prefix}-attack`;
  const output = node('output', 'music-lab__attack-value'); output.htmlFor = `${prefix}-attack`; output.setAttribute('aria-live', 'off');
  row.append(label, output);
  const slider = node('input', 'music-lab__slider'); slider.type = 'range'; slider.min = String(MIN_ATTACK); slider.max = String(MAX_ATTACK); slider.step = 'any'; slider.id = `${prefix}-attack`;
  slider.setAttribute('aria-describedby', `${prefix}-attack-help`);
  const hint = node('p', 'music-lab__hint', 'Attack: 0.02 to 0.8 seconds. Arrow keys change it by 0.01 s.'); hint.id = `${prefix}-attack-help`;
  listen(slider, 'input', () => changeAttack(Number(slider.value)));
  listen(slider, 'keydown', event => {
    const steps = { ArrowRight: .01, ArrowUp: .01, ArrowLeft: -.01, ArrowDown: -.01, PageUp: .1, PageDown: -.1 };
    if (!(event.key in steps) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? MIN_ATTACK : event.key === 'End' ? MAX_ATTACK : Math.max(MIN_ATTACK, Math.min(MAX_ATTACK, Number((state.attack + steps[event.key]).toFixed(4))));
    changeAttack(next);
  });
  controls.append(row, slider, hint); root.append(controls);

  const figure = node('figure', 'music-lab__figure');
  const graph = svg('svg', { viewBox: '0 0 460 250', role: 'img', 'aria-labelledby': `${prefix}-graph-title ${prefix}-graph-desc` });
  graph.append(svg('title', { id: `${prefix}-graph-title` }, 'Amplitude envelope of one synthesized note'));
  const graphDescription = svg('desc', { id: `${prefix}-graph-desc` }); graph.append(graphDescription);
  const x = time => 58 + time / NOTE_DURATION * 374, y = amplitude => 199 - amplitude * 143;
  for (const value of [0, .5, 1]) {
    graph.append(svg('path', { d: `M 58 ${y(value)} H 432`, class: 'music-lab__grid' }));
    graph.append(svg('text', { x: 47, y: y(value) + 4, 'text-anchor': 'end', class: 'music-lab__tick' }, String(value)));
  }
  for (const time of [0, .4, .8, 1.1]) graph.append(svg('text', { x: x(time), y: 216, 'text-anchor': 'middle', class: 'music-lab__tick' }, String(time)));
  graph.append(svg('text', { x: 58, y: 24, class: 'music-lab__axis-label' }, 'Normalized amplitude'));
  graph.append(svg('text', { x: 432, y: 240, 'text-anchor': 'end', class: 'music-lab__axis-label' }, 'Time (seconds)'));
  const pathData = attack => envelopePoints(attack).map((point, index) => `${index ? 'L' : 'M'} ${x(point.time)} ${y(point.amplitude)}`).join(' ');
  const originalPath = svg('path', { d: pathData(ORIGINAL_ATTACK), class: 'music-lab__original-envelope' });
  const currentPath = svg('path', { class: 'music-lab__current-envelope' });
  const peak = svg('circle', { r: 4, class: 'music-lab__peak' });
  graph.append(originalPath, currentPath, peak); figure.append(graph);
  const legend = node('figcaption', 'music-lab__legend');
  legend.append(node('span', 'music-lab__legend-before', 'Dashed: original (0.02 s)'), node('span', 'music-lab__legend-after', 'Solid: my version'));
  figure.append(legend); root.append(figure);
  storyContext.append(node('p', 'music-lab__hint', 'This is the amplitude envelope of one note, not the sound wave. Note pitches and the 1.1-second note duration stay fixed.'));
  const observation = node('p', 'music-lab__observation'); root.append(observation);

  const help = node('details', 'music-lab__help');
  help.append(node('summary', '', 'One idea from Jai, if I want it'));
  help.append(node('p', '', '"You already hear the entrance you want for your grandmother. Shall we give the sound a little more time to arrive? Try it, and tell me if it fits your song."'));
  help.append(node('p', '', 'Attack is the time for this envelope to rise from 0 to 1. A longer linear attack has a smaller slope: the same change in amplitude is spread over more seconds.'));
  const slope = node('p', 'music-lab__equation'); help.append(slope);
  help.append(node('p', 'music-lab__hint', 'This slope describes normalized amplitude per second, not pitch or how loud a sound feels.'));
  const decisions = node('div', 'music-lab__decisions');
  decisions.append(button('Try 0.35 seconds', () => {
    if (previousAttack === null) previousAttack = state.attack;
    changeAttack(SUGGESTED_ATTACK);
    helpStatus.textContent = 'Try hearing your version. You can keep changing it. Reject restores your earlier attack.';
    emit('help', { action: 'try', attack: state.attack, earlier_attack: previousAttack });
  }, 'music-lab__try'));
  decisions.append(button('Keep my choice', () => {
    previousAttack = null; helpStatus.textContent = `Keeping ${fmt(state.attack)} s. The choice is yours; this does not save the song to your notebook.`;
    emit('help', { action: 'keep', attack: state.attack });
  }, 'music-lab__keep'));
  decisions.append(button('Reject suggestion', () => {
    const restore = previousAttack;
    previousAttack = null;
    if (restore !== null) changeAttack(restore);
    helpStatus.textContent = `Suggestion declined. ${restore === null ? 'Your attack stays at' : 'Restored your earlier attack of'} ${fmt(state.attack)} s.`;
    emit('help', { action: 'reject', attack: state.attack, restored: restore !== null });
  }, 'music-lab__reject'));
  const helpStatus = node('p', 'music-lab__hint'); helpStatus.setAttribute('role', 'status');
  help.append(decisions, helpStatus); root.append(help, storyContext);
  listen(help, 'toggle', () => { if (!disposed) emit('help', { action: help.open ? 'open' : 'close', attack: state.attack }); });
  container.append(root);

  function render() {
    slider.value = String(state.attack); output.value = `${fmt(state.attack)} s`;
    slider.setAttribute('aria-valuetext', `${fmt(state.attack)} seconds of attack`);
    currentPath.setAttribute('d', pathData(state.attack)); peak.setAttribute('cx', x(state.attack)); peak.setAttribute('cy', y(1));
    graphDescription.textContent = `Time is in seconds and amplitude is normalized from 0 to 1. Your envelope rises linearly to 1 in ${fmt(state.attack)} seconds, holds until 0.92 seconds, then returns to zero at 1.1 seconds. The dashed original rises in 0.02 seconds.`;
    observation.textContent = state.attack === ORIGINAL_ATTACK ? 'Your version matches the original entrance. Move the control, then listen for what you want to change.' : `Your entrance now takes ${fmt(state.attack)} s instead of 0.02 s. Hear both versions and decide which belongs in the song.`;
    slope.textContent = `Linear attack slope = 1 / attack. Here: 1 / ${fmt(state.attack)} = ${fmt(attackSlope(state.attack))} normalized amplitude per second.`;
    before.disabled = starting; after.disabled = starting; stop.disabled = !starting && !playing;
    before.setAttribute('aria-pressed', String(playing?.version === 'before'));
    after.setAttribute('aria-pressed', String(playing?.version === 'after'));
  }

  function changeAttack(attack) {
    if (disposed || validateAttack(attack) === state.attack) return;
    const previousAttack = state.attack;
    if (playing || starting) stopPlayback('edited');
    state.attack = attack; render(); onChange({ attack: state.attack });
    emit('attack.change', { previous_attack: previousAttack, attack: state.attack });
  }

  function releaseVoices() {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
    for (const voice of voices) {
      voice.oscillator.onended = null;
      try { voice.oscillator.stop(); } catch { /* A completed oscillator is already stopped. */ }
      voice.oscillator.disconnect(); voice.gain.disconnect();
    }
    voices = [];
    master?.disconnect(); master = null;
  }

  function stopPlayback(reason, notify = true) {
    const prior = playing;
    const wasStarting = starting;
    generation++; starting = false; playing = null; releaseVoices();
    if (!disposed) {
      audioStatus.textContent = reason === 'ended' ? 'Phrase finished. What do you want to keep or change?' : reason === 'edited' ? 'Playback stopped so the next listen matches your new attack.' : 'Stopped. Nothing is playing.';
      render();
    }
    if (notify && (prior || wasStarting)) emit('stop', { reason, version: prior?.version ?? null, attack: prior?.attack ?? state.attack });
  }

  async function play(version, notes = PHRASE) {
    const duration = Number(((notes.length - 1) * NOTE_SPACING + NOTE_DURATION).toFixed(3));
    if (disposed) return;
    if (playing || starting) stopPlayback('replaced');
    const token = ++generation;
    const attack = version === 'before' ? ORIGINAL_ATTACK : state.attack;
    starting = true; audioError.hidden = true; audioError.textContent = ''; audioStatus.textContent = 'Opening audio...'; render();
    try {
      if (!context || context.state === 'closed') {
        const AudioContext = win.AudioContext || win.webkitAudioContext;
        if (!AudioContext) throw new Error('This browser does not support Web Audio.');
        context = new AudioContext({ latencyHint: 'interactive' });
      }
      if (context.state !== 'running') await context.resume();
      if (disposed || token !== generation) return;
      if (context.state !== 'running') throw new Error('The browser has not enabled audio. Try pressing Hear again.');
      const startTime = context.currentTime + .03;
      master = context.createGain(); master.gain.value = .05; master.connect(context.destination);
      notes.forEach((note, index) => {
        const start = startTime + index * NOTE_SPACING;
        const oscillator = context.createOscillator(), gain = context.createGain();
        voices.push({ oscillator, gain });
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(note.frequency, start);
        const points = envelopePoints(attack);
        gain.gain.setValueAtTime(points[0].amplitude, start);
        for (const point of points.slice(1)) gain.gain.linearRampToValueAtTime(point.amplitude, start + point.time);
        oscillator.connect(gain); gain.connect(master);
        oscillator.start(start); oscillator.stop(start + NOTE_DURATION + .01);
        if (index === notes.length - 1) oscillator.onended = () => { if (!disposed && token === generation) stopPlayback('ended'); };
      });
      starting = false; playing = { version, attack };
      audioStatus.textContent = notes.length === 1 ? `Playing ${notes[0].name} with ${fmt(attack)} s attack.` : `Playing ${version === 'before' ? 'the original' : 'your version'} with ${fmt(attack)} s attack. Same four notes, different entrance.`;
      render();
      // Detect a suspended context without pretending the phrase finished audibly.
      timer = win.setTimeout(() => {
        if (token === generation && playing && context.state !== 'running') {
          stopPlayback('interrupted'); audioError.hidden = false; audioError.textContent = 'The browser interrupted audio. Press Hear to try again.';
        }
      }, (duration + .3) * 1000);
      emit('play', { version, attack, duration_seconds: duration, oscillator: 'sine', notes: notes.map(note => ({ ...note })), peak_gain: .05 });
    } catch (error) {
      if (disposed || token !== generation) return;
      stopPlayback('error', false); audioError.hidden = false;
      audioError.textContent = `Could not play the phrase. ${error instanceof Error ? error.message : 'Please try again.'}`;
      audioStatus.textContent = 'No phrase is playing. The envelope controls still work.';
    }
  }

  render(); onChange({ attack: state.attack });
  return function cleanup() {
    if (disposed) return;
    disposed = true; stopPlayback('cleanup', false); listeners.forEach(remove => remove()); root.remove();
    if (context && context.state !== 'closed') {
      try { Promise.resolve(context.close()).catch(() => {}); } catch { /* Audio resources may already have been released by the browser. */ }
    }
    context = null;
  };
}
