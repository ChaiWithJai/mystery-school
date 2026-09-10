const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = ['cubic', 'quintic'];
const VIEWS = ['position', 'velocity', 'acceleration'];
const VIEW_AXES = { position: { min: 0, max: 1, unit: 'm' }, velocity: { min: 0, max: 1.875, unit: 'm/s' }, acceleration: { min: -6, max: 6, unit: 'm/s^2' } };
let instances = 0;

/** Position (m), velocity (m/s), acceleration (m/s^2). Rest strictly outside [0,T]. */
export function sampleMovement(time, { duration = 2, distance = 0.4, shape = 'cubic' } = {}) {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(distance) || distance < 0 || !SHAPES.includes(shape)) {
    throw new RangeError('Use finite time, positive duration, nonnegative distance, and cubic or quintic shape.');
  }
  if (time < 0) return { position: 0, velocity: 0, acceleration: 0 };
  if (time > duration) return { position: distance, velocity: 0, acceleration: 0 };
  const u = time / duration;
  if (shape === 'quintic') {
    return {
      position: distance * (10 * u ** 3 - 15 * u ** 4 + 6 * u ** 5),
      velocity: distance / duration * 30 * u ** 2 * (1 - u) ** 2,
      acceleration: distance / duration ** 2 * 60 * u * (1 - u) * (1 - 2 * u),
    };
  }
  return {
    position: distance * (3 * u ** 2 - 2 * u ** 3),
    velocity: distance / duration * (6 * u - 6 * u ** 2),
    acceleration: distance / duration ** 2 * (6 - 12 * u),
  };
}

const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Restore artifact inputs; playback never starts automatically on mount. */
export function normalizeMovementState(initialState = {}) {
  const input = initialState && typeof initialState === 'object' ? initialState : {};
  const duration = clamp(finiteOr(input.duration, 2), 1, 4);
  return {
    duration,
    distance: clamp(finiteOr(input.distance, 0.4), 0.1, 1),
    shape: SHAPES.includes(input.shape) ? input.shape : 'cubic',
    compare_shape: SHAPES.includes(input.compare_shape) ? input.compare_shape : 'quintic',
    view: VIEWS.includes(input.view) ? input.view : 'position',
    time: clamp(finiteOr(input.time, 0), 0, duration),
    playing: false,
    assistanceOpen: input.assistanceOpen === true,
  };
}

/** Strict model-proposal boundary. Never silently clamp or substitute a proposal. */
export function validateMovementProposal(proposal) {
  const keys = ['duration', 'distance', 'shape', 'compare_shape', 'view'];
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal) ||
      Object.keys(proposal).some(key => !keys.includes(key)) ||
      !Number.isFinite(proposal.duration) || proposal.duration < 1 || proposal.duration > 4 ||
      !Number.isFinite(proposal.distance) || proposal.distance < .1 || proposal.distance > 1 ||
      !SHAPES.includes(proposal.shape) || !SHAPES.includes(proposal.compare_shape) || !VIEWS.includes(proposal.view)) {
    throw new RangeError('Movement proposal requires duration 1..4 s, distance .1..1 m, cubic/quintic shape and compare_shape, and position/velocity/acceleration view.');
  }
  return Object.fromEntries(keys.map(key => [key, proposal[key]]));
}

export function sampleMovementComparison(time, state) {
  const inputs = validateMovementProposal(Object.fromEntries(['duration', 'distance', 'shape', 'compare_shape', 'view'].map(key => [key, state[key]])));
  return { candidate: sampleMovement(time, inputs), reference: sampleMovement(time, { ...inputs, shape: inputs.compare_shape }), axis: { ...VIEW_AXES[inputs.view] } };
}

/**
 * onChange(fullState) receives a fresh JSON snapshot, including on mount.
 * onEvent(type, fullState) records actions, never individual animation frames.
 * State inputs: duration seconds (1..4), distance meters (.1..1), shape, time,
 * assistanceOpen, compare_shape, view. Returns callable cleanup with getState/setState.
 */
export function mountMovementLab(container, { initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  if (!container?.ownerDocument || typeof container.append !== 'function') throw new TypeError('A DOM container is required.');
  if (typeof onChange !== 'function' || typeof onEvent !== 'function') throw new TypeError('Callbacks must be functions.');
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const state = normalizeMovementState(initialState);
  const id = `movement-lab-${++instances}`;
  const listeners = [];
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let frame = null;
  let startAt = null;
  let startTime = 0;
  let lastPublish = -Infinity;
  const format = value => Math.abs(value) < 0.00005 ? '0' : Number(value.toFixed(3)).toString();

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attrs = {}, text) {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    listeners.push(() => target.removeEventListener(type, callback));
  }
  function snapshot() {
    return { ...state, ...sampleMovement(state.time, state), progress: state.time / state.duration,
      version: 1, source_kind: 'labeled_simulation',
      units: { time: 's', duration: 's', distance: 'm', position: 'm', velocity: 'm/s', acceleration: 'm/s^2' } };
  }
  function publish(type) {
    onChange(snapshot());
    if (type) onEvent(type, snapshot());
  }

  const root = el('section', 'movement-lab');
  root.setAttribute('aria-labelledby', `${id}-title`);
  root.append(el('p', 'movement-lab__eyebrow', 'ANDRE / THE MOVEMENT STUDIO'));
  const title = el('h3', 'movement-lab__title', 'Find your flow.');
  title.id = `${id}-title`;
  root.append(title, el('p', 'movement-lab__intro', 'Drag the glowing glove. Feel time change the reach.'));

  const stage = el('div', 'movement-lab__stage');
  const diagram = svg('svg', { viewBox: '0 0 720 420', class: 'movement-lab__diagram', role: 'group', 'aria-labelledby': `${id}-diagram-title ${id}-diagram-desc` });
  diagram.append(svg('title', { id: `${id}-diagram-title` }, 'Andre’s non-contact reach studio. Drag the glove to move through time.'));
  const diagramDesc = svg('desc', { id: `${id}-diagram-desc` });
  diagram.append(diagramDesc);
  const defs = svg('defs');
  const halo = svg('radialGradient', { id: `${id}-halo` });
  halo.append(svg('stop', { offset: '0%', 'stop-color': '#e6aa69', 'stop-opacity': '.22' }), svg('stop', { offset: '100%', 'stop-color': '#e6aa69', 'stop-opacity': '0' }));
  defs.append(halo); diagram.append(defs);
  diagram.append(svg('ellipse', { cx: 365, cy: 210, rx: 310, ry: 205, fill: `url(#${id}-halo)` }), svg('ellipse', { cx: 235, cy: 378, rx: 155, ry: 19, class: 'movement-lab__shadow' }));
  for (const y of [295, 330, 375]) diagram.append(svg('path', { d: `M 25 ${y} L 690 ${y - 26}`, class: 'movement-lab__ring' }));
  for (const x of [55, 665]) diagram.append(svg('path', { d: `M ${x} 220 V 390`, class: 'movement-lab__ring-post' }));
  const silhouette = svg('g', { class: 'movement-lab__athlete' });
  silhouette.append(svg('path', { d: 'M 226 241 L 192 305 L 169 368 M 245 242 L 270 300 L 297 367', class: 'movement-lab__legs' }), svg('path', { d: 'M 210 155 Q 239 145 257 173 L 254 242 Q 230 258 203 240 Z', class: 'movement-lab__torso' }), svg('path', { d: 'M 213 170 L 183 209 L 208 150', class: 'movement-lab__back-arm' }), svg('circle', { cx: 237, cy: 119, r: 28, class: 'movement-lab__head' }), svg('path', { d: 'M 210 112 Q 218 80 248 92 L 262 106 L 254 110 L 232 103 L 212 120', class: 'movement-lab__hair' }), svg('path', { d: 'M 227 143 L 227 157', class: 'movement-lab__neck' }), svg('path', { d: 'M 154 369 H 180 M 290 369 H 317', class: 'movement-lab__shoes' }), svg('circle', { cx: 207, cy: 147, r: 15, class: 'movement-lab__guard' }));
  diagram.append(silhouette);
  const trail = svg('path', { class: 'movement-lab__trail' });
  const target = svg('circle', {cy: 165, r: 32, class: 'movement-lab__target'});
  const referenceArm = svg('path', { class: 'movement-lab__reference-arm' });
  const activeArm = svg('path', { class: 'movement-lab__active-arm' });
  diagram.append(trail, target, referenceArm, activeArm);
  for (const x of [310, 400, 490, 580, 670]) diagram.append(svg('path', { d: `M ${x} 209 V 216`, class: 'movement-lab__tick' }));
  diagram.append(svg('text', { x: 310, y: 237, class: 'movement-lab__label', 'text-anchor': 'middle' }, '0'));
  const endLabel = svg('text', { x: 670, y: 237, class: 'movement-lab__label', 'text-anchor': 'middle' });
  diagram.append(endLabel);
  const hand = svg('g', { class: 'movement-lab__hand', tabindex: '0', role: 'slider', 'aria-label': 'Reach time', 'aria-valuemin': '0', 'aria-valuemax': '100' });
  const referenceHand = svg('circle', { r: 23, cy: 165, class: 'movement-lab__reference-marker' });
  hand.append(svg('circle', { r: 32, class: 'movement-lab__grab-zone' }), svg('path', { d: 'M -18 -12 Q -13 -26 5 -24 Q 27 -22 25 0 Q 26 17 7 19 L -15 16 L -23 5 Z', class: 'movement-lab__glove' }), svg('path', { d: 'M -19 -7 L -23 5 L -15 16 M 4 -16 Q 17 -14 17 -2', class: 'movement-lab__hand-line' }));
  diagram.append(referenceHand, hand);
  const stageCaption = el('span', 'movement-lab__stage-caption', 'NON-CONTACT SIMULATION');
  const instant = el('output', 'movement-lab__instant');
  stage.append(diagram, stageCaption, instant); root.append(stage);

  const controls = el('div', 'movement-lab__controls');
  function range(labelText, suffix, min, max, step) {
    const label = el('label', 'movement-lab__control-label', labelText);
    label.htmlFor = `${id}-${suffix}`;
    const input = el('input');
    input.type = 'range'; input.id = label.htmlFor; input.min = min; input.max = max; input.step = step;
    controls.append(label, input);
    return { label, input };
  }
  const durationControl = range('Duration', 'duration', 1, 4, .1);
  const distanceControl = range('Distance', 'distance', .1, 1, .05);
  const shapeField = el('fieldset', 'movement-lab__shapes');
  shapeField.append(el('legend', '', 'Trajectory shape'));
  const shapeInputs = [];
  for (const [value, text] of [['cubic', 'Cubic: gentle start and finish'], ['quintic', 'Quintic: gentler acceleration at the ends']]) {
    const label = el('label');
    const input = el('input'); input.type = 'radio'; input.name = `${id}-shape`; input.value = value;
    label.append(input, doc.createTextNode(text)); shapeField.append(label); shapeInputs.push(input);
    listen(input, 'change', () => { if (input.checked) edit({ shape: value }, 'movement.shape'); });
  }
  controls.append(shapeField);
  function selectControl(labelText, suffix, values) {
    const label = el('label', 'movement-lab__control-label', labelText);label.htmlFor = `${id}-${suffix}`;
    const select = el('select');select.id = label.htmlFor;
    for (const value of values) { const option = el('option', '', value);option.value = value;select.append(option); }
    controls.append(label, select);return select;
  }
  const compareControl = selectControl('Dashed reference shape (same distance and duration)', 'compare-shape', SHAPES);
  const viewControl = selectControl('Graph view', 'view', VIEWS);
  const scrub = range('Position in the replay', 'progress', 0, 100, .1);
  scrub.input.setAttribute('aria-describedby', `${id}-scrub-help`);
  const scrubHelp = el('p', 'movement-lab__note', 'Slide through elapsed time to inspect the marker position. Arrow keys make small steps.');
  scrubHelp.id = `${id}-scrub-help`; controls.append(scrubHelp);
  const actions = el('div', 'movement-lab__actions');
  function button(text) { const node = el('button', '', text); node.type = 'button'; actions.append(node); return node; }
  const play = button('Play'); const replay = button('Replay'); const stop = button('Stop');
  controls.prepend(actions);
  const motionNote = el('p', 'movement-lab__note'); controls.append(motionNote);
  const adjustments = el('details', 'movement-lab__adjustments');
  adjustments.append(el('summary', '', 'Tune the experiment'), controls);
  const transport = el('div', 'movement-lab__transport');
  transport.append(actions, scrub.label, scrub.input);stage.append(transport);
  const dials = el('div', 'movement-lab__dials');
  for (const control of [durationControl, distanceControl]) { const dial = el('div', 'movement-lab__dial'); dial.append(control.label, control.input); dials.append(dial); }
  root.append(dials, adjustments);

  const graph = svg('svg', { viewBox: '0 0 520 270', class: 'movement-lab__graph', role: 'img', 'aria-labelledby': `${id}-graph-title ${id}-graph-desc` });
  const graphTitle = svg('title', { id: `${id}-graph-title` });graph.append(graphTitle);
  const graphDesc = svg('desc', { id: `${id}-graph-desc` }); graph.append(graphDesc);
  const axisLabel = svg('text', { x: 60, y: 24, class: 'movement-lab__label' });graph.append(axisLabel);
  for (let i = 0; i <= 4; i++) {
    const x = 60 + i * 100;
    graph.append(svg('path', { d: `M ${x} 44 V 214`, class: 'movement-lab__grid' }));
    graph.append(svg('text', { x, y: 237, 'text-anchor': 'middle', class: 'movement-lab__label' }, String(i)));
  }
  graph.append(svg('text', { x: 460, y: 260, 'text-anchor': 'end', class: 'movement-lab__label' }, 'Time (s)'));
  const distanceTick = svg('text', { x: 49, y: 52, 'text-anchor': 'end', class: 'movement-lab__label' });
  const minimumTick = svg('text', { x: 49, y: 218, 'text-anchor': 'end', class: 'movement-lab__label' });
  const zeroLine = svg('path', { class: 'movement-lab__grid' });
  graph.append(distanceTick, minimumTick, zeroLine);
  graph.append(svg('path', { d: 'M 60 44 V 214 H 460', class: 'movement-lab__axis' }));
  const curve = svg('path', { class: 'movement-lab__curve' });
  const referenceCurve = svg('path', { class: 'movement-lab__reference-curve' });
  const cursor = svg('path', { class: 'movement-lab__cursor' });
  const dot = svg('circle', { r: 5, class: 'movement-lab__dot' }); graph.append(referenceCurve, curve, cursor, dot);
  const tracePanel = el('div', 'movement-lab__trace-panel');
  const traceTabs = el('div', 'movement-lab__trace-tabs');
  const traceButtons = VIEWS.map(view => { const node = el('button', '', ({position:'Distance',velocity:'Speed',acceleration:'Acceleration'})[view]); node.type = 'button'; listen(node, 'click', () => edit({view}, 'movement.view')); traceTabs.append(node); return node; });
  tracePanel.append(traceTabs, graph);stage.append(tracePanel);
  const reading = el('p', 'movement-lab__reading');
  const status = el('p', 'movement-lab__status'); status.setAttribute('role', 'status'); root.append(status);

  const help = el('details', 'movement-lab__help');
  help.append(el('summary', '', 'Why does it feel different?'));
  help.append(el('p', '', 'The steepness of the position graph is velocity. A flatter start and finish means the marker starts and stops with zero velocity. Try giving Andre the same reach more time, then replay it. Notice how the graph becomes less steep.'));
  help.open = state.assistanceOpen;
  const assumptions = el('details', 'movement-lab__assumptions');
  assumptions.append(el('summary', '', 'Model, units and limits'), reading);
  const formula = el('p', 'movement-lab__formula'); assumptions.append(formula);
  assumptions.append(el('p', '', 'D is reach distance in meters, T is duration in seconds, and u = t/T during 0 <= t <= T. Before t = 0 the marker rests at x = 0; after t = T it rests at x = D. Velocity and acceleration are zero strictly outside the interval.'));
  assumptions.append(el('p', '', 'The cubic has nonzero acceleration at the interval endpoints, which jumps to zero during rest. This is an idealization. The quintic joins rest with zero acceleration, but still simplifies human movement. Pausing playback freezes the display; the numbers describe the modeled instant.'));
  assumptions.append(el('p', '', 'Andre wants a smooth reach. This is an on-screen model; no physical movement is required.'));
  assumptions.append(el('p', '', 'The body is an illustration, not a biomechanical reconstruction. Only the glove’s horizontal position follows the one-dimensional model; the ghost uses the reference curve.'));
  assumptions.append(el('p', 'movement-lab__scope', 'This simulation describes one-dimensional position, velocity and acceleration. It measures no person, analyzes no video, and cannot establish impact force, boxing skill or learning progress.'));
  root.append(help, assumptions);
  container.append(root);

  function paint() {
    const comparison = sampleMovementComparison(state.time, state), sample = comparison.candidate;
    const x = 310 + 360 * sample.position;
    const rx = 310 + 360 * comparison.reference.position;
    referenceHand.setAttribute('cx', rx);
    target.setAttribute('cx', 310 + 360 * state.distance);
    hand.setAttribute('transform', `translate(${x} 165)`);
    hand.setAttribute('aria-valuenow', String(Math.round(state.time / state.duration * 100)));
    hand.setAttribute('aria-valuetext', `${format(state.time)} seconds, ${format(sample.position)} meters`);
    // The arm is an illustrative linkage; only the glove's horizontal coordinate is modeled.
    const armPath = hx => `M 250 172 Q ${270 + (hx - 310) * .35} ${215 - (hx - 310) * .09} ${hx - 20} 165`;
    referenceArm.setAttribute('d', armPath(rx)); activeArm.setAttribute('d', armPath(x));
    trail.setAttribute('d', `M 310 165 H ${x}`);
    instant.textContent = `${format(sample.position)} m`;
    traceButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(VIEWS[i] === state.view)));
    endLabel.textContent = '1 m';
    diagramDesc.textContent = `Modeled marker at ${format(sample.position)} meters after ${format(state.time)} seconds. Total reach ${format(state.distance)} meters.`;
    durationControl.input.value = String(state.duration);
    durationControl.label.textContent = `Duration: ${format(state.duration)} s`;
    durationControl.input.setAttribute('aria-valuetext', `${format(state.duration)} seconds`);
    distanceControl.input.value = String(state.distance);distanceControl.label.textContent = `Distance: ${format(state.distance)} m`;
    distanceControl.input.setAttribute('aria-valuetext', `${format(state.distance)} meters`);
    compareControl.value = state.compare_shape;viewControl.value = state.view;
    shapeInputs.forEach(input => { input.checked = input.value === state.shape; });
    scrub.input.value = String(state.time / state.duration * 100);
    scrub.label.textContent = `Position in replay: ${format(state.time)} of ${format(state.duration)} s`;
    scrub.input.setAttribute('aria-valuetext', `${format(state.time)} seconds, position ${format(sample.position)} meters`);
    const {min,max,unit} = comparison.axis;
    const yAt = value => 214 - 166 * (value - min) / (max - min);
    // Explicit endpoint/rest samples show the acceleration jump instead of a sloping tail.
    const times = [...new Set([...Array.from({length:101}, (_, i) => 4*i/100), state.duration, Math.min(4,state.duration+1e-7)])].sort((a,b)=>a-b);
    function pathFor(shape) { return times.map((t,i)=>`${i?'L':'M'}${60+100*t} ${yAt(sampleMovement(t,{...state,shape})[state.view])}`).join(' '); }
    curve.setAttribute('d', pathFor(state.shape));referenceCurve.setAttribute('d', pathFor(state.compare_shape));
    const cx = 60 + 100 * state.time, cy = yAt(sample[state.view]);
    cursor.setAttribute('d', `M ${cx} ${yAt(0)} V ${cy}`); dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
    distanceTick.textContent = format(max);minimumTick.textContent = format(min);
    zeroLine.setAttribute('d', `M 60 ${yAt(0)} H 460`);
    axisLabel.textContent = `${state.view} (${unit})`;graphTitle.textContent = `${state.view} comparison against elapsed time`;
    graphDesc.textContent = `Shared fixed axes: time 0 to 4 seconds, ${state.view} ${min} to ${max} ${unit}. Solid candidate ${state.shape}; dashed reference ${state.compare_shape}. Both cover ${format(state.distance)} meters in ${format(state.duration)} seconds, followed by rest.`;
    reading.textContent = `Solid candidate: ${state.shape} / Dashed reference: ${state.compare_shape}. At ${format(state.time)} s: ${state.view} ${format(sample[state.view])} / ${format(comparison.reference[state.view])} ${unit}. Candidate position ${format(sample.position)} m / velocity ${format(sample.velocity)} m/s / acceleration ${format(sample.acceleration)} m/s\u00b2.`;
    formula.textContent = state.shape === 'cubic'
      ? 'Cubic: x = D(3u^2 - 2u^3); v = (D/T)(6u - 6u^2); a = (D/T^2)(6 - 12u).'
      : 'Quintic: x = D(10u^3 - 15u^4 + 6u^5); v = (D/T)30u^2(1-u)^2; a = (D/T^2)60u(1-u)(1-2u).';
    play.disabled = state.playing; stop.disabled = !state.playing;
    play.textContent = state.time > 0 && state.time < state.duration ? 'Continue' : 'Play';
    motionNote.textContent = media?.matches ? 'Reduced motion is on. Play shows the endpoint immediately; use the slider to inspect each instant.' : 'Play animates the marker. Stop keeps the current instant available to inspect.';
  }
  function cancelFrame() { if (frame !== null) win.cancelAnimationFrame(frame); frame = null; state.playing = false; }
  function edit(patch, type) {
    cancelFrame(); Object.assign(state, patch); state.time = clamp(state.time, 0, state.duration);
    paint(); status.textContent = `Showing ${format(state.time)} s of the ${state.shape} reach.`; publish(type);
  }
  function tick(timestamp) {
    if (disposed) return;
    startAt ??= timestamp;
    state.time = Math.min(state.duration, startTime + (timestamp - startAt) / 1000);
    if (state.time >= state.duration) {
      cancelFrame(); paint(); status.textContent = 'Replay complete. Compare the graph or change the duration.'; publish('movement.complete');
    } else {
      paint();
      if (timestamp - lastPublish >= 100) { lastPublish = timestamp; publish(); }
      frame = win.requestAnimationFrame(tick);
    }
  }
  function start(restart) {
    cancelFrame();
    if (restart || state.time >= state.duration) state.time = 0;
    if (media?.matches) {
      state.time = state.duration; paint(); status.textContent = 'Endpoint shown without animation. Slide through time to compare positions.';
      publish(restart ? 'movement.replay' : 'movement.play'); return;
    }
    state.playing = true; startAt = null; startTime = state.time; lastPublish = -Infinity;
    paint(); status.textContent = 'Playing the modeled reach.'; publish(restart ? 'movement.replay' : 'movement.play');
    frame = win.requestAnimationFrame(tick);
  }
  listen(durationControl.input, 'input', () => edit({ duration: Number(durationControl.input.value), time: 0 }, 'movement.duration'));
  listen(distanceControl.input, 'input', () => edit({ distance: Number(distanceControl.input.value) }, 'movement.distance'));
  listen(compareControl, 'change', () => edit({ compare_shape: compareControl.value }, 'movement.compare_shape'));
  listen(viewControl, 'change', () => edit({ view: viewControl.value }, 'movement.view'));
  listen(scrub.input, 'input', () => edit({ time: Number(scrub.input.value) / 100 * state.duration }, 'movement.scrub'));
  listen(play, 'click', () => start(false)); listen(replay, 'click', () => start(true));
  listen(stop, 'click', () => edit({}, 'movement.stop'));
  let dragging = false;
  function scrubAt(event) {
    const point = diagram.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const transform = diagram.getScreenCTM(); if (!transform) return;
    const desiredPosition = clamp((point.matrixTransform(transform.inverse()).x - 310) / 360, 0, state.distance);
    // Invert the monotone position curve: dragging the glove follows the same trajectory.
    let low = 0, high = state.duration;
    for (let i = 0; i < 25; i++) { const mid = (low + high) / 2; if (sampleMovement(mid, state).position < desiredPosition) low = mid; else high = mid; }
    edit({ time: (low + high) / 2 }, 'movement.scrub');
  }
  listen(hand, 'pointerdown', event => { dragging = true; hand.setPointerCapture?.(event.pointerId); event.preventDefault(); scrubAt(event); });
  listen(hand, 'pointermove', event => { if (dragging) scrubAt(event); });
  listen(hand, 'pointerup', () => { dragging = false; });
  listen(hand, 'pointercancel', () => { dragging = false; });
  listen(hand, 'keydown', event => {
    const delta = { ArrowRight: .02, ArrowUp: .02, ArrowLeft: -.02, ArrowDown: -.02 }[event.key];
    if (delta !== undefined || event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); edit({ time: event.key === 'Home' ? 0 : event.key === 'End' ? state.duration : clamp(state.time + delta * state.duration, 0, state.duration) }, 'movement.scrub');
    }
  });
  listen(help, 'toggle', () => {
    if (state.assistanceOpen !== help.open) { state.assistanceOpen = help.open; publish(help.open ? 'movement.assistance.request' : 'movement.assistance.close'); }
  });
  listen(doc, 'visibilitychange', () => { if (doc.hidden && state.playing) edit({}, 'movement.stop'); });
  if (media?.addEventListener) listen(media, 'change', () => {
    if (state.playing && media.matches) edit({}, 'movement.stop'); else paint();
  });
  paint(); publish();
  function cleanup() { disposed = true; cancelFrame(); listeners.forEach(remove => remove()); root.remove(); }
  cleanup.getState = () => snapshot();
  cleanup.setState = fullState => {
    if (disposed) throw new Error('Movement lab is disposed.');
    validateMovementProposal(Object.fromEntries(['duration','distance','shape','compare_shape','view'].map(key=>[key,fullState?.[key]])));
    if (fullState.time !== undefined && (!Number.isFinite(fullState.time) || fullState.time < 0)) throw new RangeError('Time must be finite and nonnegative.');
    const next = normalizeMovementState(fullState);
    cancelFrame();Object.assign(state,next);help.open = state.assistanceOpen;
    if (fullState.playing === true && state.time < state.duration && !media?.matches) {
      state.playing = true;startAt = null;startTime = state.time;lastPublish = -Infinity;frame = win.requestAnimationFrame(tick);
    }
    paint();status.textContent = 'Showing the applied movement state.';publish();return snapshot();
  };
  return cleanup;
}
