export const MIN_ATTACK = 0.02;
export const MAX_ATTACK = 0.8;
export const NOTE_DURATION = 1.1;
const RELEASE_START = 0.92;
const ORIGINAL_ATTACK = MIN_ATTACK;
const SUGGESTED_ATTACK = 0.35;
const DEFAULT_NOTES = Object.freeze([60, 64, 67, 72].map(midi => Object.freeze({midi, beats: 2})));
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
export function envelopePoints(attack, duration = NOTE_DURATION) {
  validateAttack(attack);
  if (!Number.isFinite(duration) || duration < attack + .18 - 1e-12) throw new RangeError('Note duration must allow attack and release.');
  return [{ time: 0, amplitude: 0 }, { time: attack, amplitude: 1 },
    { time: Math.max(attack, Number((duration - .18).toFixed(12))), amplitude: 1 }, { time: duration, amplitude: 0 }];
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
  const attack = validateAttack(initialState.attack === undefined ? ORIGINAL_ATTACK : initialState.attack);
  const tempo = initialState.tempo === undefined ? 100 : initialState.tempo;
  if (!Number.isInteger(tempo) || tempo < 40 || tempo > 180) throw new RangeError('Tempo must be an integer from 40 to 180 BPM.');
  const notes = initialState.notes === undefined ? DEFAULT_NOTES : initialState.notes;
  if (!Array.isArray(notes) || notes.length < 2 || notes.length > 16) throw new RangeError('A phrase needs 2 to 16 notes.');
  return {attack, tempo, notes: Array.from(notes, note => {
    if (!note || !Number.isInteger(note.midi) || note.midi < 48 || note.midi > 84 || !Number.isFinite(note.beats) || note.beats < .25 || note.beats > 4) throw new RangeError('Each note needs MIDI pitch 48 to 84 and 0.25 to 4 beats.');
    return {midi: note.midi, beats: note.beats};
  })};
}

export function validateMusicState(value) {
  if (!value || ['attack', 'notes', 'tempo'].some(key => value[key] === undefined)) throw new TypeError('Full music state requires attack, notes and tempo.');
  return normalizeMusicState(value);
}

export function musicSchedule(value) {
  const state = validateMusicState(value);
  let start = 0;
  const notes = state.notes.map(note => {
    const spacing = note.beats * 60 / state.tempo;
    const duration = Math.max(spacing * 11 / 12, state.attack + .18);
    const result = {...note, start, duration, frequency: 440 * 2 ** ((note.midi - 69) / 12), envelope: envelopePoints(state.attack, duration)};
    start += spacing;
    return result;
  });
  const duration = Math.max(...notes.map(note => note.start + note.duration));
  const overlap = Math.max(...notes.map(note => notes.filter(other => other.start <= note.start && other.start + other.duration > note.start).length));
  return {notes, duration: Number(duration.toFixed(12)), peakGain: .05 / overlap};
}

/**
 * Load music-lab.css in the host. No audio context or event is created on mount.
 * onChange({ attack, notes, tempo }) receives full state on mount and each change.
 * onEvent(type, metadata) emits play, stop, or help; these describe actions, not learning.
 * cleanup is idempotent, stops sound, releases audio resources, and emits no event.
 */
export function mountMusicLab(container, { initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  let state = normalizeMusicState(initialState);
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
  root.append(node('p', 'music-lab__intro', 'Change a note, shape the rhythm, and hear your ending.'));
  storyContext.append(node('p', '', 'Create a short musical variation for your grandmother. Compare it with the original four-note sketch, not a finished or recorded piano song.'));

  const phrase = node('div', 'music-lab__phrase'); phrase.setAttribute('aria-label', 'Phrase: C4, E4, G4, C5');
  listen(phrase, 'click', event => {
    const index = Number(event.target.dataset.noteIndex);
    if (event.target.dataset.noteIndex !== undefined && Number.isInteger(index) && state.notes[index]) return play('after', index);
  });
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
  const editor = node('details', 'music-lab__phrase-editor');
  editor.open = true;
  editor.append(node('summary', '', 'Change pitches and rhythm'));
  const tempoLabel = node('label', '', 'Tempo (beats per minute)');
  const tempoInput = node('input', 'music-lab__tempo'); tempoInput.type = 'number'; tempoInput.min = '40'; tempoInput.max = '180'; tempoInput.step = '1';
  tempoLabel.append(tempoInput); editor.append(tempoLabel);
  const noteRows = node('div', 'music-lab__note-rows'); editor.append(noteRows);
  const addNote = button('Add ending note', () => editState({...state, notes: [...state.notes, {midi: 60, beats: 2}]}), 'music-lab__add-note');
  editor.append(addNote, node('p', 'music-lab__hint', '2 to 16 notes. MIDI 60 is C4. Beats set time until the next note; a long attack can overlap the next note.'));
  const editError = node('p', 'music-lab__error'); editError.setAttribute('role', 'alert'); editError.hidden = true; editor.append(editError);
  root.append(editor);
  listen(tempoInput, 'change', () => editState({...state, tempo: Number(tempoInput.value)}));
  listen(noteRows, 'change', event => {
    const index = Number(event.target.dataset.index), key = event.target.dataset.key;
    if (!Number.isInteger(index) || !['midi', 'beats'].includes(key)) return;
    editState({...state, notes: state.notes.map((note, i) => i === index ? {...note, [key]: Number(event.target.value)} : note)});
  });
  listen(noteRows, 'click', event => {
    const index = Number(event.target.dataset.remove);
    if (event.target.dataset.remove !== undefined && Number.isInteger(index)) editState({...state, notes: state.notes.filter((_, i) => i !== index)});
  });
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
  graph.append(svg('title', { id: `${prefix}-graph-title` }, 'Amplitude envelope of a 1.1-second reference note'));
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
  storyContext.append(node('p', 'music-lab__hint', 'This graph isolates attack using a 1.1-second reference note, not a sound wave or every rhythmic note. Playback holds longer notes and extends short notes when the attack needs more time, then releases over 0.18 seconds.'));
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
    if (phrase.children.length !== state.notes.length) {
      phrase.replaceChildren(...state.notes.map((note, index) => {
        const key = node('button', 'music-lab__key'); key.type = 'button'; key.dataset.noteIndex = String(index); return key;
      }));
    }
    [...phrase.children].forEach((key, index) => {
      const note = state.notes[index];
      key.textContent = `${noteName(note.midi)} / ${fmt(note.beats)}`;
      key.setAttribute('aria-label', `Play ${noteName(note.midi)}, ${fmt(note.beats)} beats`);
    });
    phrase.setAttribute('aria-label', `Current phrase: ${state.notes.map(note => `${noteName(note.midi)}, ${note.beats} beats`).join('; ')}`);
    tempoInput.value = String(state.tempo);
    if (noteRows.children.length !== state.notes.length) {
      noteRows.replaceChildren(...state.notes.map((note, index) => {
        const row = node('div', 'music-lab__note-row');
        for (const [key, title, min, max, step] of [['midi', 'Pitch (MIDI)', 48, 84, 1], ['beats', 'Beats', .25, 4, 'any']]) {
          const label = node('label', '', `Note ${index + 1}: ${title}`);
          const input = node('input'); input.type = 'number'; input.min = String(min); input.max = String(max); input.step = String(step); input.dataset.index = String(index); input.dataset.key = key;
          label.append(input); row.append(label);
        }
        const remove = node('button', '', 'Remove'); remove.type = 'button'; remove.dataset.remove = String(index); remove.setAttribute('aria-label', `Remove note ${index + 1}`); row.append(remove); return row;
      }));
    }
    [...noteRows.children].forEach((row, index) => {
      row.children[0].children[0].value = String(state.notes[index].midi);
      row.children[1].children[0].value = String(state.notes[index].beats);
      row.children[2].disabled = state.notes.length <= 2;
    });
    addNote.disabled = state.notes.length >= 16;
    slider.value = String(state.attack); output.value = `${fmt(state.attack)} s`;
    slider.setAttribute('aria-valuetext', `${fmt(state.attack)} seconds of attack`);
    currentPath.setAttribute('d', pathData(state.attack)); peak.setAttribute('cx', x(state.attack)); peak.setAttribute('cy', y(1));
    graphDescription.textContent = `A 1.1-second reference note isolates attack; rhythm can change playback note lengths. Time is in seconds and amplitude is normalized from 0 to 1. The reference rises linearly to 1 in ${fmt(state.attack)} seconds, holds until 0.92 seconds, then returns to zero at 1.1 seconds. The dashed original rises in 0.02 seconds.`;
    observation.textContent = `${state.notes.length} notes at ${state.tempo} BPM; attack ${fmt(state.attack)} s. Hear both versions and decide which ending belongs in your song. To compare only attack, keep pitches, beats and tempo unchanged.`;
    slope.textContent = `Linear attack slope = 1 / attack. Here: 1 / ${fmt(state.attack)} = ${fmt(attackSlope(state.attack))} normalized amplitude per second.`;
    before.disabled = starting; after.disabled = starting; stop.disabled = !starting && !playing;
    before.setAttribute('aria-pressed', String(playing?.version === 'before'));
    after.setAttribute('aria-pressed', String(playing?.version === 'after'));
  }

  function changeAttack(attack) {
    if (disposed || validateAttack(attack) === state.attack) return;
    const previous = state.attack;
    if (playing || starting) stopPlayback('edited');
    setState({...state, attack});
    emit('attack.change', { previous_attack: previous, attack: state.attack });
  }

  function noteName(midi) { return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12] + (Math.floor(midi / 12) - 1); }
  function getState() { return normalizeMusicState(state); }
  function setState(nextState) {
    if (disposed) throw new Error('This music lab is closed.');
    const next = validateMusicState(nextState);
    if (playing || starting) stopPlayback('edited');
    state = next; editError.hidden = true; render(); onChange(getState());
  }
  function editState(next) {
    try { setState(next); emit('change', {state: getState()}); }
    catch (error) { editError.hidden = false; editError.textContent = error.message; }
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
      audioStatus.textContent = reason === 'ended' ? 'Phrase finished. What do you want to keep or change?' : reason === 'edited' ? 'Playback stopped so the next listen matches your new phrase.' : 'Stopped. Nothing is playing.';
      render();
    }
    if (notify && (prior || wasStarting)) emit('stop', { reason, version: prior?.version ?? null, attack: prior?.attack ?? state.attack });
  }

  async function play(version, noteIndex = null) {
    if (disposed) return;
    if (playing || starting) stopPlayback('replaced');
    const token = ++generation;
    const playbackState = version === 'before' ? normalizeMusicState() : getState();
    const {attack} = playbackState;
    const schedule = musicSchedule(playbackState);
    if (noteIndex !== null) {
      const note = schedule.notes[noteIndex];
      schedule.notes = [{...note, start: 0}];
      schedule.duration = note.duration;
      schedule.peakGain = .05;
    }
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
      master = context.createGain(); master.gain.value = schedule.peakGain; master.connect(context.destination);
      const lastEnd = Math.max(...schedule.notes.map(note => note.start + note.duration));
      let endAssigned = false;
      schedule.notes.forEach(note => {
        const start = startTime + note.start;
        const oscillator = context.createOscillator(), gain = context.createGain();
        voices.push({ oscillator, gain });
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(note.frequency, start);
        const points = note.envelope;
        gain.gain.setValueAtTime(points[0].amplitude, start);
        for (const point of points.slice(1)) gain.gain.linearRampToValueAtTime(point.amplitude, start + point.time);
        oscillator.connect(gain); gain.connect(master);
        oscillator.start(start); oscillator.stop(start + note.duration + .01);
        if (!endAssigned && note.start + note.duration === lastEnd) { endAssigned = true; oscillator.onended = () => { if (!disposed && token === generation) stopPlayback('ended'); }; }
      });
      starting = false; playing = { version, attack };
      audioStatus.textContent = noteIndex !== null ? `Playing ${noteName(playbackState.notes[noteIndex].midi)} at ${playbackState.tempo} BPM, ${fmt(attack)} s attack.` : `Playing ${version === 'before' ? 'the original sketch' : 'your saved phrase settings'}: ${schedule.notes.length} notes at ${playbackState.tempo} BPM, ${fmt(attack)} s attack.`;
      render();
      // Detect a suspended context without pretending the phrase finished audibly.
      timer = win.setTimeout(() => {
        if (token === generation && playing && context.state !== 'running') {
          stopPlayback('interrupted'); audioError.hidden = false; audioError.textContent = 'The browser interrupted audio. Press Hear to try again.';
        }
      }, (schedule.duration + .3) * 1000);
      emit('play', { version, attack, state: playbackState, duration_seconds: schedule.duration, oscillator: 'sine', notes: schedule.notes, peak_gain: schedule.peakGain });
    } catch (error) {
      if (disposed || token !== generation) return;
      stopPlayback('error', false); audioError.hidden = false;
      audioError.textContent = `Could not play the phrase. ${error instanceof Error ? error.message : 'Please try again.'}`;
      audioStatus.textContent = 'No phrase is playing. The envelope controls still work.';
    }
  }

  render(); onChange(getState());
  function cleanup() {
    if (disposed) return;
    disposed = true; stopPlayback('cleanup', false); listeners.forEach(remove => remove()); root.remove();
    if (context && context.state !== 'closed') {
      try { Promise.resolve(context.close()).catch(() => {}); } catch { /* Audio resources may already have been released by the browser. */ }
    }
    context = null;
  }
  cleanup.setState = setState;
  cleanup.getState = getState;
  return cleanup;
}
