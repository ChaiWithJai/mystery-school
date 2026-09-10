const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const paramsOf = value => ({ cue: clamp(finite(value?.cue, 1.15), .65, 1.65), gap: clamp(finite(value?.gap, 14), 10, 22) });
export const boxingParams = value => paramsOf(value);
const outcomeOf = (jab, endX, params) => jab.x >= 47 + params.gap - 18 ? 'inside_reach' : endX > jab.x && Math.abs(47 + params.gap - endX) <= 18 ? 'outside_then_returned' : 'outside_reply_short';
function restoreState(input) {
  const value = input && typeof input === 'object' ? input : {};
  const attempts = (Array.isArray(value.attempts) ? value.attempts.slice(-6) : []).flatMap(a => {
    if (!a || !Array.isArray(a.trace) || !Number.isFinite(a.jab?.x) || !Number.isFinite(a.jab?.t) || !Number.isFinite(a.endX)) return [];
    const trace = a.trace.slice(0, 1200).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.t) && p.t >= 0 && p.t <= 2.6 && p.x >= 20 && p.x <= 68);
    if (trace.length < 2 || trace.some((p, i) => i > 0 && p.t < trace[i - 1].t) || a.jab.x < 20 || a.jab.x > 68 || a.jab.t < .65 || a.jab.t > 1.65) return [];
    const params = paramsOf(a.params), endX = clamp(a.endX, 20, 68), jab = { t: a.jab.t, x: a.jab.x };
    const outcome = outcomeOf(jab, endX, params);
    return [{ prediction: clamp(finite(a.prediction, 39), 20, 68), params, trace: trace.map(p => ({ t: p.t, x: p.x })), jab, endX, outcome, provenance: { model: 'one-dimensional-distance-v1', units: 'simulation-units', recorded_at: typeof a.provenance?.recorded_at === 'string' ? a.provenance.recorded_at.slice(0, 40) : null } }];
  });
  return { prediction: clamp(finite(value.prediction, 39), 20, 68), attempts, question: typeof value.question === 'string' ? value.question.slice(0, 400) : '', params: paramsOf(value.params) };
}
const figure = (id, flip = false) => `<g class="bg-fighter ${flip ? 'bg-rival' : ''}" id="${id}"><ellipse cy="12" rx="53" ry="13" class="bg-shadow"/><g class="bg-body" transform="${flip ? 'scale(-1 1)' : ''}"><path d="M-15 -103 L-24 -48 L-48 0 M14 -101 L27 -48 L48 0" class="bg-legs"/><path d="M-20 -176 Q-44 -139 -21 -100 L22 -100 Q38 -139 18 -173Z" class="bg-torso"/><circle cy="-196" r="22" class="bg-head"/><path d="M-23 -165 L-42 -137 L-10 -159" class="bg-arm"/><circle cx="-8" cy="-164" r="16" class="bg-glove"/><g class="bg-jab"><path d="M17 -165 L39 -143 L51 -176" class="bg-arm"/><circle cx="52" cy="-180" r="17" class="bg-glove"/></g></g></g>`;

export function mountBoxingGame(container, { getSettings = () => ({}), initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  // getSettings is intentionally unused: old movement-lab meters/seconds are not
  // boxing parameters. Typed Astra boxing proposals must update boxing_round.
  const state = restoreState(initialState);
  let x = 47, phase = 'predict', raf = 0, start = 0, elapsed = 0, trace = [], frozen = null, disposed = false, drag = false, replayTime = null;
  const keys = new Set();
  const root = document.createElement('section'); root.className = 'boxing-game'; root.tabIndex = 0; root.setAttribute('aria-label', 'Boxing distance and timing game');
  root.innerHTML = `<div class="bg-film-title"><span>THE SWEET SCIENCE</span><h2>Make him miss.</h2></div><svg class="bg-ring" viewBox="0 0 1000 440" role="img" aria-label="A training ring with two boxers and a predicted position"><defs><radialGradient id="bg-light"><stop stop-color="#e8c780" stop-opacity=".22"/><stop offset="1" stop-color="#e8c780" stop-opacity="0"/></radialGradient></defs><ellipse cx="500" cy="235" rx="440" ry="210" fill="url(#bg-light)"/><path d="M40 315 L500 220 L960 315 L500 430 Z" class="bg-floor"/><g class="bg-ropes"><path d="M40 215 L500 125 L960 215 M40 245 L500 155 L960 245 M40 275 L500 185 L960 275"/><path d="M40 210 V340 M960 210 V340"/></g><path class="bg-ghost"/><path class="bg-current-trail"/><path class="bg-reach"/><g class="bg-prediction" tabindex="0" role="slider" aria-label="Predicted position" aria-valuemin="20" aria-valuemax="68"><ellipse cy="350" rx="25" ry="8"/><path d="M0 335 V310 M-7 317 L0 310 L7 317"/><text y="380" text-anchor="middle">YOUR PREDICTION</text></g>${figure('bg-you')}${figure('bg-opponent', true)}<line class="bg-gap-line" y1="146" y2="146"/><text class="bg-gap-label" x="500" y="128" text-anchor="middle"></text></svg><div class="bg-coach" aria-live="polite">Where will you be when the jab arrives?</div><div class="bg-controls"><button class="bg-start">Try the exchange</button><button class="bg-left" aria-label="Step back">←</button><button class="bg-right" aria-label="Step in">→</button></div><div class="bg-instruction">Drag your prediction · Move with ← → or A D</div><div class="bg-tuning"><label>WHEN <input class="bg-cue" type="range" min="0.65" max="1.65" step="0.05" value="${state.params.cue}" aria-label="Opponent jab delay"/></label><label>DISTANCE <input class="bg-distance" type="range" min="20" max="35" step="1" value="${state.params.gap}" aria-label="Opponent starting distance"/></label></div><details class="bg-notebook"><summary>Take it to the gym ↗</summary><p>Try a slow, non-contact step out and return with a coach. Can you keep your stance and guard?</p><label>Your next question <input class="bg-question" placeholder="What would I try with a coach?" maxlength="400"/></label><a href="https://www.englandboxing.org/wp-content/uploads/2022/03/EB_Boxing-Coaching-Handbook-Part-1_v8-002.pdf#page=66" target="_blank" rel="noopener">England Boxing · stance, guard and footwork</a><small>This is a distance model. It does not measure your body or boxing ability.</small></details>`;
  container.append(root);
  const $ = s => root.querySelector(s), svg = $('.bg-ring'), you = $('#bg-you'), rival = $('#bg-opponent'), prediction = $('.bg-prediction'), status = $('.bg-coach'), button = $('.bg-start');
  $('.bg-question').value = state.question;
  $('.bg-distance').min = '10'; $('.bg-distance').max = '22'; $('.bg-distance').value = String(state.params.gap);
  const listeners = []; const listen = (el, name, fn) => { el.addEventListener(name, fn); listeners.push(() => el.removeEventListener(name, fn)); };
  const replay = document.createElement('div'); replay.className = 'bg-replay'; replay.hidden = true;
  replay.innerHTML = '<div class="bg-replay-track"><input type="range" min="0" max="2.6" step="0.01" value="0" aria-label="Scrub recorded boxing attempt"/><span class="bg-jab-marker" aria-hidden="true"></span></div><div class="bg-replay-readout"><output></output><button type="button">At the jab</button></div>';
  $('.bg-controls').before(replay);
  const snapshot = () => JSON.parse(JSON.stringify(state));
  const save = () => onChange(snapshot());
  const event = (name, data = {}) => onEvent(name, { ...data, model: 'one-dimensional-distance', units: 'simulation-units' });
  const opponentX = () => 47 + state.params.gap;
  function draw() {
    replay.hidden = phase !== 'replay';
    you.setAttribute('transform', `translate(${x * 10} 348)`); rival.setAttribute('transform', `translate(${opponentX() * 10} 348)`);
    prediction.setAttribute('transform', `translate(${state.prediction * 10} 0)`); prediction.setAttribute('aria-valuenow', String(state.prediction));
    const extension = phase === 'running' || phase === 'replay' ? clamp(1 - Math.abs((phase === 'replay' ? replayTime ?? elapsed : elapsed) - state.params.cue) / .22, 0, 1) : frozen ? 1 : 0;
    const jab = rival.querySelector('.bg-jab'), reach = extension * 128;
    jab.querySelector('path').setAttribute('d', `M17 -165 L${39 + reach * .5} ${-143 - extension * 25} L${51 + reach} -176`);
    jab.querySelector('circle').setAttribute('cx', String(52 + reach));
    const endpoint = opponentX() - 18;
    $('.bg-reach').setAttribute('d', `M${endpoint * 10} 195 V351`);
    $('.bg-current-trail').setAttribute('d', trace.map((p, i) => `${i ? 'L' : 'M'}${p.x * 10} ${359 - p.t * 7}`).join(' '));
    const prior = state.attempts.at(phase === 'replay' ? -2 : -1); $('.bg-ghost').setAttribute('d', prior?.trace?.map((p, i) => `${i ? 'L' : 'M'}${p.x * 10} ${359 - p.t * 7}`).join(' ') || '');
    $('.bg-gap-line').setAttribute('x1', x * 10); $('.bg-gap-line').setAttribute('x2', endpoint * 10);
    $('.bg-gap-label').textContent = frozen ? `${Math.abs(x - endpoint).toFixed(1)} units ${x < endpoint ? 'outside' : 'inside'} reach` : '';
    root.dataset.phase = phase;
  }
  function scrub(t) {
    if (phase !== 'replay') return;
    const attempt = state.attempts.at(-1); if (!attempt) return;
    const points = [...attempt.trace, attempt.jab].sort((a, b) => a.t - b.t), first = points[0], end = points.at(-1);
    replayTime = clamp(t, first.t, end.t);
    const right = points.find(p => p.t >= replayTime) || end, left = [...points].reverse().find(p => p.t <= replayTime) || first;
    x = right.t === left.t ? left.x : left.x + (right.x - left.x) * (replayTime - left.t) / (right.t - left.t);
    replay.querySelector('input').value = String(replayTime);
    const dt = replayTime - first.t, displacement = x - first.x;
    replay.querySelector('output').textContent = dt > 0 ? `${replayTime.toFixed(2)}s · Δx ${displacement.toFixed(1)} ÷ Δt ${dt.toFixed(2)} = ${(displacement / dt).toFixed(1)} simulation units/s (average)` : '0.00s · Starting position · Average velocity needs elapsed time';
    replay.querySelector('.bg-jab-marker').style.left = `${attempt.jab.t / 2.6 * 100}%`;
    draw();
  }
  listen(replay.querySelector('input'), 'input', e => scrub(Number(e.target.value)));
  listen(replay.querySelector('input'), 'change', () => event('boxing_replay_inspected', { t: replayTime, x }));
  listen(replay.querySelector('button'), 'click', () => scrub(state.attempts.at(-1)?.jab.t ?? 0));
  function finish() {
    phase = 'replay'; keys.clear(); const endpoint = opponentX() - 18;
    const attempt = { prediction: state.prediction, params: { ...state.params }, trace: trace.map(p => ({ t: +p.t.toFixed(3), x: +p.x.toFixed(2) })), jab: frozen, endX: +x.toFixed(2) };
    attempt.outcome = outcomeOf(frozen, attempt.endX, state.params);
    attempt.provenance = { model: 'one-dimensional-distance-v1', units: 'simulation-units', recorded_at: new Date().toISOString() };
    state.attempts.push(attempt); state.attempts = state.attempts.slice(-6);
    status.textContent = attempt.outcome === 'inside_reach' ? 'You stayed inside reach. Try leaving earlier.' : attempt.outcome === 'outside_reply_short' ? 'You escaped. Now find your way back in.' : 'Outside reach. Back in range.';
    button.textContent = 'Try a different rhythm'; event('boxing_attempt_completed', attempt); save(); scrub(frozen.t);
  }
  function tick(now) {
    if (disposed || phase !== 'running') return;
    const next = Math.min((now - start) / 1000, 2.6), dt = next - elapsed;
    const velocity = (keys.has('right') ? 15 : 0) - (keys.has('left') ? 15 : 0);
    if (!frozen && next >= state.params.cue) { const atCue = clamp(x + velocity * Math.max(0, state.params.cue - elapsed), 20, 68); frozen = { t: state.params.cue, x: +atCue.toFixed(2) }; event('boxing_jab_observed', frozen); }
    x = clamp(x + velocity * dt, 20, 68); elapsed = next; trace.push({ t: elapsed, x }); draw();
    if (elapsed >= 2.6) finish(); else raf = requestAnimationFrame(tick);
  }
  function begin() {
    if (phase === 'running') event('boxing_attempt_interrupted', { elapsed, reason: 'restart' });
    cancelAnimationFrame(raf); phase = 'running'; x = 47; elapsed = 0; frozen = null; replayTime = null; trace = [{ t: 0, x }]; keys.clear();
    status.textContent = 'Move. Watch the glove. Return.'; button.textContent = 'Restart exchange'; root.focus({ preventScroll: true });
    event('boxing_attempt_started', { prediction: state.prediction, params: { ...state.params } }); start = performance.now(); draw(); raf = requestAnimationFrame(tick);
  }
  listen(button, 'click', begin);
  const direction = key => ['ArrowLeft', 'a', 'A'].includes(key) ? 'left' : ['ArrowRight', 'd', 'D'].includes(key) ? 'right' : null;
  listen(root, 'keydown', e => { if (/INPUT|TEXTAREA/.test(e.target.tagName)) return; const dir = direction(e.key); if (!dir || e.target === prediction) return; e.preventDefault(); if (phase === 'running') keys.add(dir); });
  listen(root, 'keyup', e => { const dir = direction(e.key); if (dir) { e.preventDefault(); keys.delete(dir); } });
  listen(root, 'focusout', e => { if (!root.contains(e.relatedTarget)) keys.clear(); });
  for (const [selector, dir] of [['.bg-left', 'left'], ['.bg-right', 'right']]) {
    const el = $(selector); listen(el, 'pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); if (phase === 'running') keys.add(dir); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(el, type, () => keys.delete(dir));
  }
  function locate(e) { const point = svg.createSVGPoint(); point.x = e.clientX; point.y = e.clientY; const matrix = svg.getScreenCTM(); if (!matrix) return; state.prediction = Math.round(clamp(point.matrixTransform(matrix.inverse()).x / 10, 20, 68)); draw(); }
  listen(prediction, 'pointerdown', e => { if (phase === 'running') return; drag = true; prediction.setPointerCapture(e.pointerId); locate(e); });
  listen(prediction, 'pointermove', e => { if (drag) locate(e); });
  listen(prediction, 'pointerup', () => { if (drag) { drag = false; save(); event('boxing_prediction_set', { prediction: state.prediction }); } });
  listen(prediction, 'pointercancel', () => { drag = false; });
  listen(prediction, 'keydown', e => { const dir = direction(e.key); if (!dir || phase === 'running') return; e.preventDefault(); state.prediction = clamp(state.prediction + (dir === 'left' ? -1 : 1), 20, 68); draw(); save(); });
  for (const [selector, key] of [['.bg-cue', 'cue'], ['.bg-distance', 'gap']]) listen($(selector), 'input', e => { cancelAnimationFrame(raf); phase = 'predict'; keys.clear(); frozen = null; x = 47; trace = []; state.params[key] = Number(e.target.value); button.textContent = 'Try this experiment'; status.textContent = 'A new distance. A new question.'; draw(); save(); event('boxing_experiment_changed', { params: { ...state.params } }); });
  listen($('.bg-question'), 'change', e => { state.question = e.target.value; save(); event('boxing_transfer_question_saved', { question: state.question }); });
  draw();
  return {
    dispose() { disposed = true; cancelAnimationFrame(raf); listeners.forEach(fn => fn()); root.remove(); },
    render() { if (!disposed) draw(); },
    getState() { return snapshot(); },
    setState(next) {
      if (disposed) return;
      cancelAnimationFrame(raf); keys.clear(); drag = false; phase = 'predict'; x = 47; elapsed = 0; trace = []; frozen = null;
      Object.assign(state, restoreState(next));
      $('.bg-cue').value = String(state.params.cue); $('.bg-distance').value = String(state.params.gap); $('.bg-question').value = state.question;
      button.textContent = 'Try the exchange'; status.textContent = 'Where will you be when the jab arrives?'; draw();
      // Restoration deliberately does not call onChange or invent a learner attempt.
    },
  };
}
