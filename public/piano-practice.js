const BLACK = new Set([1, 3, 6, 8, 10]);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const COMPUTER_KEYS = Object.freeze({ a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 });
export const noteName = midi => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const noteFrequency = midi => 440 * 2 ** ((midi - 69) / 12);

export function pianoGeometry() {
  let white = 0;
  return Array.from({ length: 37 }, (_, i) => {
    const midi = 48 + i;
    const black = BLACK.has(midi % 12);
    const key = { midi, black, left: (black ? white - .31 : white) / 22 * 100, width: (black ? .62 : 1) / 22 * 100 };
    if (!black) white++;
    return key;
  });
}

export function normalizePianoState(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('A performance must be an object.');
  const duration = value.duration ?? 0;
  if (!Number.isFinite(duration) || duration < 0 || duration > 600) throw new RangeError('A take must last between 0 and 600 seconds.');
  const events = value.events ?? [];
  if (!Array.isArray(events) || events.length > 4096) throw new RangeError('A take supports at most 4096 note events.');
  const active = new Set();
  let previous = 0;
  const normalized = events.map(event => {
    if (!event || !['on', 'off'].includes(event.type) || !Number.isInteger(event.midi) || event.midi < 48 || event.midi > 84 || !Number.isFinite(event.time) || event.time < previous || event.time > duration) throw new RangeError('Note events need ordered times within the take and pitches C3 to C6.');
    if ((event.type === 'on') === active.has(event.midi)) throw new RangeError('Each note-on must be followed by its note-off before repeating.');
    if (event.type === 'on') active.add(event.midi); else active.delete(event.midi);
    previous = event.time;
    return { type: event.type, midi: event.midi, time: event.time };
  });
  let reference = null;
  if (value.reference != null) {
    const { title, url } = value.reference;
    if (typeof title !== 'string' || !title.trim() || title.length > 300 || typeof url !== 'string') throw new TypeError('The reference needs a title and HTTPS URL.');
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new TypeError('Use an HTTPS reference without credentials.');
    reference = { title: title.trim(), url: parsed.href };
  }
  return { events: normalized, duration, reference };
}

export function performanceNotes(value) {
  const state = normalizePianoState(value);
  const active = new Map();
  const notes = [];
  for (const event of state.events) {
    if (event.type === 'on') {
      const note = { midi: event.midi, start: event.time, end: state.duration };
      notes.push(note);
      active.set(event.midi, note);
    } else {
      active.get(event.midi).end = event.time;
      active.delete(event.midi);
    }
  }
  return notes;
}

export function mountPianoPractice(container, { initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  let state = normalizePianoState(initialState);
  let disposed = false;
  let context;
  let recording = false;
  let started = 0;
  let replaying = false;
  let replayTimer;
  let replayVisual;
  let limitTimer;
  let generation = 0;
  const voices = new Map();
  const held = new Map();
  const scheduled = [];
  const listeners = [];
  const root = document.createElement('section');
  root.className = 'piano-practice';
  root.innerHTML = `<header class="piano-practice__header"><h2>Piano</h2><div data-reference></div></header>
    <div class="piano-practice__scroll"><div class="piano-practice__keyboard" role="group" aria-label="Piano C3 to C6. Hold a key to sustain; release to stop." tabindex="0"></div></div>
    <div class="piano-practice__transport"><button type="button" data-record>Record</button><button type="button" data-replay>Replay</button><button type="button" data-stop aria-label="Stop sound and finish recording">Stop</button><span data-status role="status" aria-live="polite"></span></div>
    <p data-error role="alert" hidden></p>
    <details class="piano-practice__options"><summary>Practice options</summary>
    <p class="piano-practice__hint">Hold keys with a pointer, or focus the piano and use A W S E D F T G Y H U J K O L P ; for C4 to E5. Space or Enter holds a focused key. Escape stops sound. Recording replaces your previous take, up to 10 minutes.</p>
    <div class="piano-practice__take" data-take></div>
    <button type="button" data-reset>Reset take</button>
    <details><summary>Edit this performance</summary><p>Adjust your own note's pitch, entrance or release in seconds. These are recorded timings, not a score or an accuracy grade.</p><div data-editor></div></details>
    <details><summary>What am I hearing?</summary><p>A quiet synthesized tone, not a recorded piano. Higher keys have higher frequencies. Holding a key sustains its tone; releasing it lets the volume fade. Black keys are the pitches between adjacent white keys, except E/F and B/C.</p></details></details>`;
  container.append(root);
  const find = selector => root.querySelector(selector);
  const keyboard = find('.piano-practice__keyboard');
  const status = find('[data-status]');
  const error = find('[data-error]');
  const keyElements = new Map();
  const listen = (target, type, fn) => { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); };
  const emit = (type, payload = {}) => onEvent(type, payload);
  const publish = () => onChange(normalizePianoState(state));
  const fail = err => { error.hidden = false; error.textContent = `Sound or performance unavailable: ${err.message}`; };
  const elapsed = () => Math.min(600, Math.max(0, (performance.now() - started) / 1000));
  const paintKey = (midi, active) => keyElements.get(midi)?.setAttribute('aria-pressed', String(active));

  function render() {
    const notes = performanceNotes(state);
    status.textContent = recording ? 'Recording' : replaying ? 'Replaying' : notes.length ? `${notes.length} notes saved in this take` : '';
    find('[data-record]').disabled = recording;
    find('[data-replay]').disabled = recording || !notes.length;
    find('[data-take]').textContent = notes.length ? `${notes.length} notes / ${state.duration.toFixed(2)} seconds. Your performance, not an accuracy assessment.` : 'No take recorded yet. Play freely, or start recording.';
    const reference = find('[data-reference]');
    reference.replaceChildren();
    if (state.reference) {
      const link = document.createElement('a');
      link.textContent = state.reference.title;
      link.setAttribute('aria-label', `Open reference: ${state.reference.title} (new tab)`);
      link.href = state.reference.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      reference.append(link);
    }
    const editor = find('[data-editor]');
    editor.replaceChildren();
    if (recording) { editor.textContent = 'Finish this take before editing.'; return; }
    notes.forEach((note, index) => {
      const row = document.createElement('div');
      row.className = 'piano-practice__note';
      for (const [field, title, min, max, step] of [['midi', 'Pitch (MIDI)', 48, 84, 1], ['start', 'Entrance (s)', 0, 600, .01], ['end', 'Release (s)', 0, 600, .01]]) {
        const label = document.createElement('label');
        label.textContent = `${index + 1}. ${title}`;
        const input = document.createElement('input');
        input.type = 'number'; input.min = min; input.max = max; input.step = step; input.value = note[field];
        input.dataset.index = index; input.dataset.field = field;
        label.append(input); row.append(label);
      }
      editor.append(row);
    });
  }

  async function audioReady() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) throw new Error('Web Audio is not supported in this browser.');
    context ||= new Audio();
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') throw new Error('Audio did not start. Try another explicit key press.');
    error.hidden = true;
  }
  function voice(midi, start, attack = .012) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(noteFrequency(midi), start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(.006, start + attack);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    return { oscillator, gain };
  }
  function releaseVoice(v, time) {
    if (v.gain.gain.cancelAndHoldAtTime) v.gain.gain.cancelAndHoldAtTime(time);
    else { v.gain.gain.cancelScheduledValues(time); v.gain.gain.setValueAtTime(.006, time); }
    v.gain.gain.linearRampToValueAtTime(0, time + .06);
    v.oscillator.stop(time + .065);
  }
  function recordEvent(type, midi) {
    if (!recording) return;
    state.duration = elapsed();
    state.events.push({ type, midi, time: state.duration });
    publish();
    if (state.events.length >= 4000 && type === 'on') stop();
  }
  async function down(midi, source) {
    if (disposed || held.has(source)) return;
    if (replaying) stop();
    const already = [...held.values()].includes(midi);
    held.set(source, midi);
    if (already) return;
    paintKey(midi, true);
    recordEvent('on', midi);
    emit('note_on', { midi, recording, time: recording ? state.duration : null });
    const token = generation;
    try {
      await audioReady();
      if (disposed || generation !== token || ![...held.values()].includes(midi) || voices.has(midi)) return;
      voices.set(midi, voice(midi, context.currentTime));
    } catch (err) { if (!disposed) fail(err); }
  }
  function up(source) {
    const midi = held.get(source);
    if (midi === undefined) return;
    held.delete(source);
    if ([...held.values()].includes(midi)) return;
    const v = voices.get(midi);
    if (v) { releaseVoice(v, context.currentTime); voices.delete(midi); }
    paintKey(midi, false);
    recordEvent('off', midi);
    emit('note_off', { midi, recording, time: recording ? state.duration : null });
  }
  function stop() {
    generation++;
    for (const source of [...held.keys()]) up(source);
    if (recording) { state.duration = elapsed(); recording = false; publish(); }
    for (const v of scheduled.splice(0)) { try { v.oscillator.stop(); } catch {} }
    clearTimeout(replayTimer); clearTimeout(limitTimer); clearInterval(replayVisual);
    replaying = false;
    for (const midi of keyElements.keys()) paintKey(midi, false);
    render();
  }

  for (const key of pianoGeometry()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `piano-practice__key ${key.black ? 'is-black' : 'is-white'}`;
    button.style.left = `${key.left}%`; button.style.width = `${key.width}%`;
    button.textContent = noteName(key.midi);
    button.setAttribute('aria-label', `${noteName(key.midi)}, hold to play`);
    button.setAttribute('aria-pressed', 'false');
    keyElements.set(key.midi, button); keyboard.append(button);
    listen(button, 'pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); button.focus(); button.setPointerCapture?.(event.pointerId);
      void down(key.midi, `pointer:${event.pointerId}`);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, type, event => up(`pointer:${event.pointerId}`));
    listen(button, 'keydown', event => {
      if (![' ', 'Enter'].includes(event.key)) return;
      event.preventDefault(); if (!event.repeat) void down(key.midi, `focus:${event.key}`);
    });
    listen(button, 'keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); up(`focus:${event.key}`); } });
  }
  listen(keyboard, 'keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const midi = COMPUTER_KEYS[event.key.toLowerCase()];
    if (midi !== undefined) { event.preventDefault(); if (!event.repeat) void down(midi, `keyboard:${event.key.toLowerCase()}`); }
  });
  listen(globalThis, 'keyup', event => up(`keyboard:${event.key.toLowerCase()}`));
  listen(globalThis, 'blur', stop);
  listen(document, 'visibilitychange', () => { if (document.hidden) stop(); });
  listen(root, 'keydown', event => { if (event.key === 'Escape') { stop(); emit('stop'); } });
  listen(keyboard, 'focusout', event => { if (!keyboard.contains(event.relatedTarget)) for (const source of [...held.keys()]) up(source); });
  listen(find('[data-stop]'), 'click', () => { stop(); emit('stop'); });
  listen(find('[data-record]'), 'click', () => {
    stop(); state = { ...state, events: [], duration: 0 }; started = performance.now(); recording = true;
    publish(); render(); emit('record_start'); limitTimer = setTimeout(stop, 600000);
  });
  listen(find('[data-reset]'), 'click', () => { stop(); state = { ...state, events: [], duration: 0 }; publish(); render(); emit('reset'); });
  listen(find('[data-replay]'), 'click', async () => {
    stop(); const token = generation; const snapshot = normalizePianoState(state);
    try {
      await audioReady();
      if (disposed || generation !== token) return;
      const start = context.currentTime + .04;
      const notes = performanceNotes(snapshot);
      for (const note of notes) {
        const v = voice(note.midi, start + note.start, Math.min(.012, (note.end - note.start) / 2));
        v.gain.gain.setValueAtTime(.006, start + note.end);
        v.gain.gain.linearRampToValueAtTime(0, start + note.end + .06);
        v.oscillator.stop(start + note.end + .065); scheduled.push(v);
      }
      replaying = true; render(); emit('play', { source: 'own_attempt', state: snapshot });
      replayVisual = setInterval(() => {
        const time = context.currentTime - start;
        for (const midi of keyElements.keys()) paintKey(midi, notes.some(note => note.midi === midi && time >= note.start && time < note.end));
      }, 40);
      replayTimer = setTimeout(() => { clearInterval(replayVisual); scheduled.length = 0; replaying = false; for (const midi of keyElements.keys()) paintKey(midi, false); render(); }, (snapshot.duration + .12) * 1000);
    } catch (err) { stop(); if (!disposed) fail(err); }
  });
  listen(find('[data-editor]'), 'change', event => {
    const { index, field } = event.target.dataset;
    if (index === undefined || !['midi', 'start', 'end'].includes(field)) return;
    try {
      const notes = performanceNotes(state); notes[Number(index)][field] = Number(event.target.value);
      if (notes.some(note => note.start < 0 || note.end <= note.start)) throw new RangeError('Release must come after entrance.');
      const events = notes.flatMap(note => [{ type: 'on', midi: note.midi, time: note.start }, { type: 'off', midi: note.midi, time: note.end }]).sort((a, b) => a.time - b.time || (a.type === 'off' ? -1 : 1));
      cleanup.setState({ ...state, events, duration: Math.max(...notes.map(note => note.end), 0) });
      emit('edit', { state: cleanup.getState() }); error.hidden = true;
    } catch (err) { fail(err); render(); }
  });
  function cleanup() {
    if (disposed) return;
    stop(); disposed = true; listeners.forEach(remove => remove()); root.remove();
    if (context) void context.close().catch(() => {});
  }
  cleanup.getState = () => normalizePianoState(state);
  cleanup.setState = next => {
    if (disposed) throw new Error('This piano is closed.');
    const validated = normalizePianoState(next);
    stop(); state = validated; publish(); render();
  };
  render(); publish();
  return cleanup;
}
