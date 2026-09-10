import { createOpeningDemoTake, normalizeOpeningTarget, openingTempoLabel, RUNAWAY_OPENING_SOURCE } from './runaway-opening.js';
import { performanceNotes } from './piano-practice.js';

export function laneFromRects(key, stage) {
  if (![key.left, key.width, stage.left, stage.width].every(Number.isFinite) || key.width <= 0 || stage.width <= 0) throw new TypeError('Visible keyboard rectangles are required.');
  return { x: key.left - stage.left, width: key.width };
}

export function fallingNote(note, time, height, lookAhead = 3) {
  if (![time, height, lookAhead, note.start, note.end].every(Number.isFinite) || height <= 0 || lookAhead <= 0 || note.end < note.start) throw new TypeError('Valid note times and roll dimensions are required.');
  const speed = height / lookAhead;
  return { y: height - (note.end - time) * speed, height: Math.max(3, (note.end - note.start) * speed), strikeY: height - (note.start - time) * speed };
}

export function compareGuidedStrike(midi, time, index, target = null) {
  if (!Number.isInteger(midi) || midi < 48 || midi > 96 || !Number.isFinite(time) || !Number.isInteger(index) || index < 0) throw new TypeError('A valid key event is required.');
  const notes = performanceNotes(createOpeningDemoTake(target));
  if (index >= notes.length) return { status: 'outside_excerpt', midi, time };
  const expected = notes[index];
  const difference = time - expected.start;
  return { status: 'compared', strike: index + 1, midi, expected_midi: expected.midi,
    pitch_matches: midi === expected.midi, time, expected_time: expected.start,
    timing_difference_seconds: difference, timing: Math.abs(difference) <= .2 ? 'within_practice_window' : difference < 0 ? 'early' : 'late',
    practice_window_seconds: .2, basis: 'authored_notation_exercise', learning_claimed: false };
}

/**
 * Overlay above the real keyboard. Forward adapter events with cleanup.event(type,payload).
 * Optional getPlaybackClock returns {now:()=>audioContext.currentTime,startTime} AFTER
 * demonstrate schedules sound. Without that hook, Hear animation is explicitly approximate.
 * This module never sets adapter state or records demonstration notes as learner input.
 */
export function mountPianoRoll(container, { keyboard = container.querySelector('.piano-practice__keyboard'), adapter,
  target = adapter?.getState?.().practice_target ?? null, onEvent = () => {}, getPlaybackClock = null } = {}) {
  let currentTarget = normalizeOpeningTarget(target);
  if (!keyboard) throw new TypeError('Mount the actual piano keyboard before its roll.');
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const root = doc.createElement('section'); root.className = 'piano-roll';
  root.setAttribute('aria-label', 'Runaway opening practice guidance');
  root.innerHTML = `<div class="piano-roll__controls"><button type="button" data-hear>Hear</button><button type="button" data-play>Play</button><button type="button" data-stop>Stop</button><span data-tempo></span></div><p role="status" aria-live="polite" data-feedback>Play E6 when the bar reaches the keys.</p><svg class="piano-roll__track" role="img" aria-label="Two E6 notes fall toward the actual E6 key"><g data-lanes></g><g data-notes></g><line data-hit stroke="currentColor" stroke-width="2"/></svg><details><summary>Source & timing</summary><a target="_blank" rel="noopener noreferrer" data-source>Published two-strike opening</a><p>Synthesized exercise, not the original recording or a full-song score. Timing feedback uses a practice window of 0.2 seconds, not a mastery grade.</p><p data-clock></p></details>`;
  container.append(root);
  const q = selector => root.querySelector(selector);
  q('[data-feedback]').textContent = 'Press L or tap the glowing key.';
  q('[data-source]').href = RUNAWAY_OPENING_SOURCE.url;
  const svg = q('svg');
  const ns = 'http://www.w3.org/2000/svg';
  let disposed = false, mode = 'idle', frame = null, token = 0, origin = 0;
  let now = () => win.performance.now() / 1000;
  let clockKind = 'performance_clock', strikes = [], held = new Set(), lanes = new Map();
  let stageHeight = 160, stageWidth = 1, started = false;
  const listeners = [];
  const listen = (object, type, fn, options) => { object.addEventListener(type, fn, options); listeners.push(() => object.removeEventListener(type, fn, options)); };
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const emit = (type, payload = {}) => onEvent(type, { exercise_id: RUNAWAY_OPENING_SOURCE.id, target: currentTarget, mode, ...payload });
  const make = (tag, attrs) => { const node = doc.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); return node; };
  function layout() {
    const rect = keyboard.getBoundingClientRect();
    stageWidth = rect.width;
    const top = Math.max(8, rect.top - 300);
    stageHeight = Math.max(1, rect.top - top - 100);
    root.style.left = `${rect.left}px`; root.style.top = `${top}px`; root.style.width = `${rect.width}px`;
    svg.style.height = `${stageHeight}px`; svg.setAttribute('viewBox', `0 0 ${Math.max(1, stageWidth)} ${stageHeight}`);
    lanes = new Map();
    for (const key of keyboard.querySelectorAll('.piano-practice__key')) {
      const match = /^([A-G])(#?)([3-7]), hold to play$/.exec(key.getAttribute('aria-label') || '');
      if (!match) continue;
      const midi = (Number(match[3]) + 1) * 12 + {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]] + Number(!!match[2]);
      const keyRect = key.getBoundingClientRect();
      if (keyRect.width > 0 && rect.width > 0) lanes.set(midi, laneFromRects(keyRect, rect));
    }
    const laneGroup = q('[data-lanes]'); laneGroup.replaceChildren();
    const lane = lanes.get(88);
    if (lane) laneGroup.append(make('rect', {x:lane.x,y:0,width:lane.width,height:stageHeight,fill:'currentColor',opacity:.08}));
    for (const [key,value] of Object.entries({x1:0,x2:stageWidth,y1:stageHeight-1,y2:stageHeight-1})) q('[data-hit]').setAttribute(key,value);
    const unavailable = !lane || stageHeight < 30;
    q('[data-play]').disabled = unavailable;
    q('[data-hear]').disabled = unavailable || typeof adapter?.demonstrate !== 'function';
    if (unavailable) q('[data-feedback]').textContent = 'The E6 key needs visible space above it. Resize or reveal the keyboard.';
    q('[data-tempo]').textContent = openingTempoLabel(currentTarget);
  }
  function draw(time = -2) {
    const group = q('[data-notes]'); group.replaceChildren();
    const lane = lanes.get(88); if (!lane) return;
    const notes = performanceNotes(createOpeningDemoTake(currentTarget));
    notes.forEach((note,index) => {
      const position = fallingNote(note,time,stageHeight,Math.max(3,120/(currentTarget?.quarter_bpm??80)));
      const active = time >= note.start && time < note.end;
      if (reduced?.matches) {
        if (time >= 0 && !active) return;
        position.y = stageHeight - 36; position.height = 32;
      }
      group.append(make('rect',{x:lane.x+2,y:position.y,width:Math.max(1,lane.width-4),height:position.height,rx:4,fill:held.has(88)?'#f8e9b8':active?'#dbf2ba':'#aacb8e','data-strike':index+1}));
    });
  }
  function stop(reason = 'requested') {
    token++; win.cancelAnimationFrame(frame); frame = null;
    const wasRunning = mode !== 'idle'; mode = 'idle'; started = false; held.clear();
    // Use the existing instrument's stop control, never setState or clear a take.
    if (wasRunning) container.querySelector('[data-stop]:not(.piano-roll [data-stop])')?.click();
    layout(); draw();
    if (wasRunning) emit('guide.stop', {reason});
  }
  function tick() {
    if (disposed || mode === 'idle') return;
    const time = now() - origin; draw(time);
    if (mode === 'practice' && time < 0) q('[data-feedback]').textContent = `Ready ${Math.max(1,Math.ceil(-time/(60/(currentTarget?.quarter_bpm??80))))}`;
    else if (mode === 'practice' && !started) { started = true; q('[data-feedback]').textContent = 'Press L at the line. Release, then press again.'; }
    if (time > createOpeningDemoTake(currentTarget).duration + .5) {
      const count = strikes.length; stop('finished');
      q('[data-feedback]').textContent = count < 2 && count > 0 ? 'One strike captured. Try both next time.' : count === 0 ? 'Your turn. Press Play to follow the two strikes.' : 'Take finished. Listen back on your piano.';
      emit('guide.finish',{observations:structuredClone(strikes),mastery_claimed:false});return;
    }
    frame = win.requestAnimationFrame(tick);
  }
  async function start(nextMode = 'practice') {
    if (disposed) return;
    if (!['practice','hear'].includes(nextMode)) throw new TypeError('Choose practice or hear.');
    stop('replaced'); layout(); if (q('[data-play]').disabled) return;
    mode = nextMode; strikes = []; const id = token;
    now = () => win.performance.now()/1000; clockKind = 'performance_clock';
    try {
      if (mode === 'hear') {
        if (typeof adapter?.demonstrate !== 'function') throw new Error('Demonstration playback is unavailable.');
        await adapter.demonstrate(createOpeningDemoTake(currentTarget));
        if (disposed || id !== token) return;
        const audioClock = getPlaybackClock?.();
        if (audioClock && typeof audioClock.now === 'function' && Number.isFinite(audioClock.startTime) && Number.isFinite(audioClock.now())) {
          now = audioClock.now; origin = audioClock.startTime; clockKind = 'audio_context';
        } else origin = now() + .04;
        q('[data-feedback]').textContent = clockKind === 'audio_context' ? 'Listen, then press Play.' : 'Listen, then Play. Visual timing is approximate.';
      } else { origin = now() + 120/(currentTarget?.quarter_bpm??80); }
      q('[data-clock]').textContent = clockKind === 'audio_context' ? 'Animation follows the supplied audio playback clock.' : 'Visual guidance uses the browser clock. Audio latency is not measured.';
      emit('guide.start',{clock_kind:clockKind,learner_attempt:mode==='practice'}); tick();
    } catch (error) { if (!disposed && id === token) {stop('error');q('[data-feedback]').textContent=`Guidance unavailable: ${error.message}`;} }
  }
  function event(type,payload = {}) {
    if (disposed || mode !== 'practice') return;
    if (type === 'performance.note_off' || type === 'note_off') { held.delete(payload.midi); return; }
    if (!['performance.note_on','note_on'].includes(type) || held.has(payload.midi)) return;
    const time = now()-origin; if (time < 0) return;
    held.add(payload.midi);
    const observation = compareGuidedStrike(payload.midi,time,strikes.length,currentTarget);
    if (observation.status === 'outside_excerpt') return;
    strikes.push(observation);
    q('[data-feedback]').textContent = !observation.pitch_matches ? 'Try E6, the lit lane.' : observation.timing === 'within_practice_window' ? 'Near the cue.' : `${Math.abs(observation.timing_difference_seconds).toFixed(2)} s ${observation.timing}.`;
    emit('guide.strike',{observation,clock_kind:clockKind});
  }
  listen(q('[data-hear]'),'click',()=>{void start('hear');});
  listen(q('[data-play]'),'click',()=>{void start('practice');});
  listen(q('[data-stop]'),'click',()=>stop());
  listen(win,'resize',()=>{layout();if(mode==='idle')draw();});
  listen(win,'scroll',()=>{layout();if(mode==='idle')draw();},true);
  listen(win,'blur',()=>stop('blur'));
  listen(doc,'visibilitychange',()=>{if(doc.hidden)stop('hidden');});
  const observer = win.ResizeObserver ? new win.ResizeObserver(()=>{layout();if(mode==='idle')draw();}) : null;
  observer?.observe(keyboard);
  function cleanup() { if(disposed)return;stop('closed');disposed=true;observer?.disconnect();listeners.forEach(remove=>remove());root.remove(); }
  cleanup.start=start;cleanup.stop=stop;cleanup.event=event;cleanup.layout=()=>{layout();draw(mode==='idle'?-2:now()-origin);};
  cleanup.setTarget=value=>{const validated=normalizeOpeningTarget(value);if(disposed)throw new Error('This guide is closed.');if(JSON.stringify(validated)===JSON.stringify(currentTarget))return;stop('target_changed');currentTarget=validated;layout();draw();};
  cleanup.getState=()=>({target:structuredClone(currentTarget),mode,clock_kind:clockKind,observations:structuredClone(strikes)});
  layout();draw();return cleanup;
}
