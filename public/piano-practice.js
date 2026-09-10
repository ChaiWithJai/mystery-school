const BLACK = new Set([1, 3, 6, 8, 10]);
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const COMPUTER_KEYS = Object.freeze({ a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 });
export const PHYSICAL_KEYS = Object.freeze(Object.fromEntries(Object.entries(COMPUTER_KEYS).map(([key,midi]) => [key === ';' ? 'Semicolon' : `Key${key.toUpperCase()}`, midi])));
// Virtual Piano's opening letters, transposed +4 as specified on Jai's sheet.
export const RUNAWAY_OPENING_KEYS = Object.freeze({KeyL:88,KeyS:76,KeyK:87,KeyA:75,KeyJ:85,KeyP:73,KeyG:81,KeyF:80});
const SAMPLED_OPENING_PITCHES = new Set(Object.values(RUNAWAY_OPENING_KEYS));
const mountedPianos = [];
export function physicalPianoKey(event, keyboardMap = 'standard') {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return null;
  const origin = event.composedPath?.()[0] || event.target;
  if (origin?.isContentEditable || origin?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="slider"]')) return null;
  const code = event.code || (event.key === ';' ? 'Semicolon' : `Key${String(event.key || '').toUpperCase()}`);
  const mapping = keyboardMap === 'runaway' ? RUNAWAY_OPENING_KEYS : PHYSICAL_KEYS;
  return Object.hasOwn(mapping, code) ? { midi: mapping[code], source: `physical:${code}` } : null;
}
export const noteName = midi => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const noteFrequency = midi => 440 * 2 ** ((midi - 69) / 12);

export function pianoGeometry() {
  let white = 0;
  return Array.from({ length: 49 }, (_, i) => {
    const midi = 48 + i;
    const black = BLACK.has(midi % 12);
    const key = { midi, black, left: (black ? white - .31 : white) / 29 * 100, width: (black ? .62 : 1) / 29 * 100 };
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
    if (!event || !['on', 'off'].includes(event.type) || !Number.isInteger(event.midi) || event.midi < 48 || event.midi > 96 || !Number.isFinite(event.time) || event.time < previous || event.time > duration) throw new RangeError('Note events need ordered times within the take and pitches C3 to C7.');
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

export function mountPianoPractice(container, { initialState = {}, onChange = () => {}, onEvent = () => {}, autoCapture = false, keyboardMap = 'standard' } = {}) {
  if (!['standard', 'runaway'].includes(keyboardMap)) throw new TypeError('Unknown piano keyboard map.');
  let state = normalizePianoState(initialState);
  let disposed = false;
  let context;
  let sampleBuffer = null;
  let sampleDecode = null;
  const sampleWaits = new Set();
  const sampleAbort = new AbortController();
  const sampleTimeout = setTimeout(() => sampleAbort.abort(), 3000);
  const sampleBytes = Promise.resolve().then(() => fetch('/audio/piano/Ds6.mp3', { signal: sampleAbort.signal }))
    .then(response => { if (!response.ok) throw new Error('Piano sample unavailable'); return response.arrayBuffer(); })
    .catch(() => null).finally(() => clearTimeout(sampleTimeout));
  let recording = false;
  let started = 0;
  let replaying = false;
  let replayTimer;
  let playbackClock = null;
  let replayVisual;
  let limitTimer;
  let generation = 0;
  const voices = new Map();
  const held = new Map();
  const pendingStrikes = new Map();
  const scheduled = [];
  const listeners = [];
  const root = document.createElement('section');
  root.className = 'piano-practice';
  root.dataset.keyboardMap = keyboardMap;
  root.innerHTML = `<header class="piano-practice__header"><h2>Piano</h2><div data-reference></div></header>
    <div class="piano-practice__scroll"><div class="piano-practice__keyboard" role="group" aria-label="Piano C3 to C7. Hold a key to sustain; release to stop." tabindex="0"></div></div>
    <div class="piano-practice__transport"><button type="button" data-record>Record</button><button type="button" data-replay>Replay</button><button type="button" data-stop aria-label="Stop sound and finish recording">Stop</button><span data-status role="status" aria-live="polite"></span></div>
    <p data-error role="alert" hidden></p>
    <details class="piano-practice__options"><summary>Practice options</summary>
    <p class="piano-practice__hint">Hold keys with a pointer, or focus the piano and use A W S E D F T G Y H U J K O L P ; for C4 to E5. Space or Enter holds a focused key. Escape stops sound. Recording replaces your previous take, up to 10 minutes.</p>
    <div class="piano-practice__take" data-take></div>
    <button type="button" data-reset>Reset take</button>
    <details><summary>Edit this performance</summary><p>Adjust your own note's pitch, entrance or release in seconds. These are recorded timings, not a score or an accuracy grade.</p><div data-editor></div></details>
    <details><summary>What am I hearing?</summary><p data-timbre>Opening keys use Alexander Holm's Salamander Yamaha C5 piano sample, transposed from D-sharp-6, once loaded. Synthesis is the fallback. This is not audio from Runaway.</p><a href="/audio/piano/SOURCE-LICENSE.txt">Sample attribution and CC BY 3.0 license</a></details></details>`;
  container.append(root);
  mountedPianos.push(root);
  const find = selector => root.querySelector(selector);
  const keyboard = find('.piano-practice__keyboard');
  if (keyboardMap === 'runaway') find('.piano-practice__hint').textContent = 'Opening letters from Virtual Piano, transposed +4: L S K A J P G F. Hold a key to sustain. Click the piano for other notes. The complete arrangement is on Virtual Piano. Typing in a field does not play notes.';
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
      for (const [field, title, min, max, step] of [['midi', 'Pitch (MIDI)', 48, 96, 1], ['start', 'Entrance (s)', 0, 600, .01], ['end', 'Release (s)', 0, 600, .01]]) {
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
    void prepareSample();
    error.hidden = true;
  }
  function prepareSample() {
    sampleDecode ||= (async () => {
      const bytes = await sampleBytes;
      try {
        if (!bytes || disposed) throw new Error('Sample unavailable');
        const buffer = await context.decodeAudioData(bytes);
        if (disposed) return;
        sampleBuffer = buffer;
        root.dataset.timbre = 'sample-ready';
        find('[data-timbre]').textContent = 'Opening keys: recorded Salamander Yamaha C5 piano by Alexander Holm (CC BY 3.0), transposed from D-sharp-6; E6 is one semitone higher. Other keys use synthesis. This is not the Runaway recording.';
      } catch {
        if (!disposed) {
          root.dataset.timbre = 'synthesized-fallback';
          find('[data-timbre]').textContent = 'Local piano sample unavailable. Playing synthesized piano-like tones instead, not a sampled piano or the Runaway recording.';
        }
      }
    })();
    return sampleDecode;
  }
  function waitForSample(milliseconds) {
    if (sampleBuffer || disposed) return Promise.resolve();
    return new Promise(resolve => {
      const finish = () => { clearTimeout(timer); sampleWaits.delete(finish); resolve(); };
      const timer = setTimeout(finish, milliseconds);
      sampleWaits.add(finish);
      void prepareSample().then(finish);
    });
  }
  function voice(midi, start, attack = .012, peak = .04 / Math.max(1, voices.size + scheduled.length + 1)) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + Math.min(attack, .004));
    gain.connect(context.destination);
    if (SAMPLED_OPENING_PITCHES.has(midi) && sampleBuffer) {
      const source = context.createBufferSource();
      source.buffer = sampleBuffer;
      const rate = Math.pow(2, (midi - 87) / 12);
      source.playbackRate.setValueAtTime(rate, start);
      source.connect(gain);
      const entry = { gain, peak, stop(time) { source.stop(time); } };
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        const index = scheduled.indexOf(entry);
        if (index !== -1) scheduled.splice(index, 1);
        if (voices.get(midi) === entry) voices.delete(midi);
      };
      source.start(start);
      emit('audio_voice', { midi, timbre: 'sampled_piano', sample: '/audio/piano/Ds6.mp3', source_midi: 87, playback_rate: rate, scheduled_start: start });
      return entry;
    }
    // Authored additive piano-like timbre, not a sampled piano or song recording.
    // The upper partials lose energy faster after the hammer strike.
    const parts = [];
    const entry = { gain, peak, stop(time) { for (const part of parts) part.oscillator.stop(time); } };
    const decay = 2.8 * Math.pow(2, (60 - midi) / 36);
    const weights = [.55, .22, .11, .06, .04, .02];
    let ended = 0;
    for (const [index, weight] of weights.entries()) {
      const harmonic = index + 1;
      const frequency = noteFrequency(midi) * harmonic * Math.sqrt(1 + .00012 * (harmonic * harmonic - 1));
      if (frequency >= (context.sampleRate || 48000) * .45) continue;
      const oscillator = context.createOscillator();
      const partial = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      partial.gain.setValueAtTime(weight, start);
      partial.gain.exponentialRampToValueAtTime(weight * .001, start + decay / Math.pow(harmonic, .65));
      oscillator.connect(partial); partial.connect(gain);
      parts.push({ oscillator, partial });
      oscillator.onended = () => {
        oscillator.disconnect(); partial.disconnect();
        if (++ended === parts.length) {
          gain.disconnect();
          const index = scheduled.indexOf(entry);
          if (index !== -1) scheduled.splice(index, 1);
          if (voices.get(midi) === entry) voices.delete(midi);
        }
      };
      oscillator.start(start);
      oscillator.stop(start + decay + .065);
    }
    emit('audio_voice', { midi, timbre: 'synthesized', sample: null, source_midi: null, playback_rate: null, scheduled_start: start });
    return entry;
  }
  function releaseVoice(v, time) {
    if (v.gain.gain.cancelAndHoldAtTime) v.gain.gain.cancelAndHoldAtTime(time);
    else { v.gain.gain.cancelScheduledValues(time); v.gain.gain.setValueAtTime(v.peak, time); }
    v.gain.gain.linearRampToValueAtTime(0, time + .06);
    v.stop(time + .065);
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
    if (autoCapture && !recording) {
      if (state.duration >= 600 || state.events.length >= 4000) {
        fail(new Error('This take is full. Keep it before starting a new take.'));
        return;
      }
      // Resume the existing take instead of silently replacing a learner's work.
      started = performance.now() - state.duration * 1000;
      recording = true;
      limitTimer = setTimeout(stop, (600 - state.duration) * 1000);
      render();
      emit('record_start', { source: 'key_press', resumed: state.events.length > 0 });
    }
    const already = [...held.values()].includes(midi);
    held.set(source, midi);
    if (already) return;
    paintKey(midi, true);
    recordEvent('on', midi);
    emit('note_on', { midi, recording, time: recording ? state.duration : null });
    const token = generation;
    const strike = { released: false };
    pendingStrikes.set(midi, strike);
    try {
      await audioReady();
      if (SAMPLED_OPENING_PITCHES.has(midi)) await waitForSample(150);
      if (disposed || generation !== token) return;
      if (strike.released) {
        // A real quick tap may end while the browser unlocks audio. Sound a short
        // tap once ready, without rewriting its recorded input timestamps.
        const tap = voice(midi, context.currentTime);
        releaseVoice(tap, context.currentTime + .06); scheduled.push(tap);
        return;
      }
      if (voices.has(midi)) return;
      voices.set(midi, voice(midi, context.currentTime));
    } catch (err) { if (!disposed) fail(err); }
    finally { if (pendingStrikes.get(midi) === strike) pendingStrikes.delete(midi); }
  }
  function up(source) {
    const midi = held.get(source);
    if (midi === undefined) return;
    held.delete(source);
    if ([...held.values()].includes(midi)) return;
    const pending = pendingStrikes.get(midi);
    if (pending) { pending.released = true; pendingStrikes.delete(midi); }
    const v = voices.get(midi);
    if (v) { releaseVoice(v, context.currentTime); voices.delete(midi); }
    paintKey(midi, false);
    recordEvent('off', midi);
    emit('note_off', { midi, recording, time: recording ? state.duration : null });
  }
  function stop() {
    playbackClock = null;
    generation++;
    for (const finish of sampleWaits) finish();
    for (const source of [...held.keys()]) up(source);
    if (recording) { state.duration = autoCapture ? (state.events.at(-1)?.time || 0) : elapsed(); recording = false; publish(); }
    for (const v of scheduled.splice(0)) { try { v.stop(); } catch {} }
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
    const openingCode = keyboardMap === 'runaway' && Object.keys(RUNAWAY_OPENING_KEYS).find(code => RUNAWAY_OPENING_KEYS[code] === key.midi);
    if (openingCode) {
      const letter = openingCode.slice(3);
      const shortcut = document.createElement('kbd'); shortcut.className = 'piano-practice__shortcut'; shortcut.textContent = letter;
      button.append(shortcut); button.setAttribute('aria-keyshortcuts', letter.toLowerCase()); button.title = `Runaway opening: hold physical ${letter} to play ${noteName(key.midi)}`;
    }
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
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
      if (![' ', 'Enter'].includes(event.key)) return;
      event.preventDefault(); if (!event.repeat) void down(key.midi, `focus:${event.key}`);
    });
    listen(button, 'keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); up(`focus:${event.key}`); } });
  }
  listen(globalThis, 'keydown', event => {
    const active = mountedPianos.findLast(piano => piano.isConnected !== false && !piano.closest?.('[hidden],[inert]') && (!piano.getClientRects || piano.getClientRects().length > 0));
    if (active !== root || document.hidden) return;
    const origin = event.composedPath?.()[0] || event.target;
    if (origin?.closest?.('button,a,[role="button"],[role="menuitem"]') && !root.contains(origin) && !origin.closest?.('#drawer')) return;
    const key = physicalPianoKey(event, keyboardMap);
    if (key) { event.preventDefault(); if (!event.repeat) void down(key.midi, key.source); }
  });
  listen(globalThis, 'keyup', event => {
    const code = event.code || (event.key === ';' ? 'Semicolon' : `Key${String(event.key || '').toUpperCase()}`);
    up(`physical:${code}`);
    if ([' ', 'Enter'].includes(event.key)) up(`focus:${event.key}`);
  });
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
  async function playSnapshot(value, source) {
    if (disposed) throw new Error('This piano is closed.');
    const snapshot = normalizePianoState(value);
    stop(); const token = generation;
    try {
      await audioReady();
      // Demonstrations prefer the sample; live key input never waits for it.
      await waitForSample(1500);
      if (disposed || generation !== token) return;
      const start = context.currentTime + .04;
      const notes = performanceNotes(snapshot);
      const overlap = Math.max(1, ...notes.map(note => notes.filter(other => other.start <= note.start && other.end + .065 > note.start).length));
      for (const note of notes) {
        const v = voice(note.midi, start + note.start, Math.min(.012, (note.end - note.start) / 2), .04 / overlap);
        v.gain.gain.setValueAtTime(v.peak, start + note.end);
        v.gain.gain.linearRampToValueAtTime(0, start + note.end + .06);
        v.stop(start + note.end + .065); scheduled.push(v);
      }
      playbackClock = source === 'notation_exercise' ? Object.freeze({ now: () => context.currentTime, startTime: start }) : null;
      replaying = true; render(); emit('play', { source, state: snapshot });
      replayVisual = setInterval(() => {
        const time = context.currentTime - start;
        for (const midi of keyElements.keys()) paintKey(midi, notes.some(note => note.midi === midi && time >= note.start && time < note.end));
      }, 40);
      replayTimer = setTimeout(() => { playbackClock = null; clearInterval(replayVisual); scheduled.length = 0; replaying = false; for (const midi of keyElements.keys()) paintKey(midi, false); render(); }, (snapshot.duration + .12) * 1000);
    } catch (err) { stop(); if (!disposed) fail(err); }
  }
  listen(find('[data-replay]'), 'click', () => playSnapshot(state, 'own_attempt'));
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
    sampleAbort.abort(); clearTimeout(sampleTimeout);
    const index = mountedPianos.indexOf(root); if (index !== -1) mountedPianos.splice(index, 1);
    if (context) void context.close().catch(() => {});
  }
  cleanup.getState = () => normalizePianoState(state);
  cleanup.demonstrate = value => playSnapshot(value, 'notation_exercise');
  cleanup.getPlaybackClock = () => disposed ? null : playbackClock;
  cleanup.setState = next => {
    if (disposed) throw new Error('This piano is closed.');
    const validated = normalizePianoState(next);
    stop(); state = validated; publish(); render();
  };
  render(); publish();
  return cleanup;
}
