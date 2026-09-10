const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = ['cubic', 'quintic'];
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
    time: clamp(finiteOr(input.time, 0), 0, duration),
    playing: false,
    assistanceOpen: input.assistanceOpen === true,
  };
}

/**
 * onChange(fullState) receives a fresh JSON snapshot, including on mount.
 * onEvent(type, fullState) records actions, never individual animation frames.
 * State inputs: duration seconds (1..4), distance meters (.1..1), shape, time,
 * assistanceOpen. Load movement-lab.css in the host. Returns cleanup.
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
  root.append(el('p', 'movement-lab__eyebrow', 'Labeled simulation / controlled non-contact reach'));
  const title = el('h3', 'movement-lab__title', 'Make the reach smoother.');
  title.id = `${id}-title`;
  root.append(title, el('p', 'movement-lab__intro', 'Andre wants a smooth reach. Try the marker, then compare its timing and shape. This is an on-screen model; no physical movement is required.'));

  const diagram = svg('svg', { viewBox: '0 0 520 160', class: 'movement-lab__diagram', role: 'img', 'aria-labelledby': `${id}-diagram-title ${id}-diagram-desc` });
  diagram.append(svg('title', { id: `${id}-diagram-title` }, 'A hand marker moves along a straight modeled reach'));
  const diagramDesc = svg('desc', { id: `${id}-diagram-desc` });
  diagram.append(diagramDesc, svg('path', { d: 'M 60 80 H 460', class: 'movement-lab__track' }));
  for (const x of [60, 160, 260, 360, 460]) diagram.append(svg('path', { d: `M ${x} 72 V 88`, class: 'movement-lab__tick' }));
  diagram.append(svg('text', { x: 60, y: 125, class: 'movement-lab__label', 'text-anchor': 'middle' }, '0 m'));
  const endLabel = svg('text', { x: 460, y: 125, class: 'movement-lab__label', 'text-anchor': 'middle' });
  diagram.append(endLabel);
  const hand = svg('g', { class: 'movement-lab__hand' });
  hand.append(svg('circle', { r: 21 }), svg('path', { d: 'M -10 7 V -3 Q -10 -6 -7 -4 L -5 -1 V -12 Q -3 -16 -1 -12 V -4 V -15 Q 2 -18 4 -14 V -4 V -12 Q 7 -15 9 -11 V -2 Q 14 -8 15 -3 L 12 7 Q 8 14 0 14 Q -6 14 -10 7', class: 'movement-lab__hand-line' }));
  diagram.append(hand);
  root.append(diagram);

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
  const scrub = range('Position in the replay', 'progress', 0, 100, .1);
  scrub.input.setAttribute('aria-describedby', `${id}-scrub-help`);
  const scrubHelp = el('p', 'movement-lab__note', 'Slide through elapsed time to inspect the marker position. Arrow keys make small steps.');
  scrubHelp.id = `${id}-scrub-help`; controls.append(scrubHelp);
  const actions = el('div', 'movement-lab__actions');
  function button(text) { const node = el('button', '', text); node.type = 'button'; actions.append(node); return node; }
  const play = button('Play'); const replay = button('Replay'); const stop = button('Stop');
  controls.append(actions);
  const motionNote = el('p', 'movement-lab__note'); controls.append(motionNote);
  root.append(controls);

  const graph = svg('svg', { viewBox: '0 0 520 270', class: 'movement-lab__graph', role: 'img', 'aria-labelledby': `${id}-graph-title ${id}-graph-desc` });
  graph.append(svg('title', { id: `${id}-graph-title` }, 'Position against elapsed time'));
  const graphDesc = svg('desc', { id: `${id}-graph-desc` }); graph.append(graphDesc);
  graph.append(svg('text', { x: 60, y: 24, class: 'movement-lab__label' }, 'Position (m)'));
  for (let i = 0; i <= 4; i++) {
    const x = 60 + i * 100;
    graph.append(svg('path', { d: `M ${x} 44 V 214`, class: 'movement-lab__grid' }));
    graph.append(svg('text', { x, y: 237, 'text-anchor': 'middle', class: 'movement-lab__label' }, String(i)));
  }
  graph.append(svg('text', { x: 460, y: 260, 'text-anchor': 'end', class: 'movement-lab__label' }, 'Time (s)'));
  const distanceTick = svg('text', { x: 49, y: 52, 'text-anchor': 'end', class: 'movement-lab__label' });
  graph.append(distanceTick, svg('text', { x: 49, y: 218, 'text-anchor': 'end', class: 'movement-lab__label' }, '0'));
  graph.append(svg('path', { d: 'M 60 44 V 214 H 460', class: 'movement-lab__axis' }));
  const curve = svg('path', { class: 'movement-lab__curve' });
  const cursor = svg('path', { class: 'movement-lab__cursor' });
  const dot = svg('circle', { r: 5, class: 'movement-lab__dot' }); graph.append(curve, cursor, dot); root.append(graph);
  const reading = el('p', 'movement-lab__reading'); root.append(reading);
  const status = el('p', 'movement-lab__status'); status.setAttribute('role', 'status'); root.append(status);

  const help = el('details', 'movement-lab__help');
  help.append(el('summary', '', 'Help me understand the smoother reach'));
  help.append(el('p', '', 'The steepness of the position graph is velocity. A flatter start and finish means the marker starts and stops with zero velocity. Try giving Andre the same reach more time, then replay it. Notice how the graph becomes less steep.'));
  help.open = state.assistanceOpen;
  const assumptions = el('details', 'movement-lab__assumptions');
  assumptions.append(el('summary', '', 'Model, units and limits'));
  const formula = el('p', 'movement-lab__formula'); assumptions.append(formula);
  assumptions.append(el('p', '', 'D is reach distance in meters, T is duration in seconds, and u = t/T during 0 <= t <= T. Before t = 0 the marker rests at x = 0; after t = T it rests at x = D. Velocity and acceleration are zero strictly outside the interval.'));
  assumptions.append(el('p', '', 'The cubic has nonzero acceleration at the interval endpoints, which jumps to zero during rest. This is an idealization. The quintic joins rest with zero acceleration, but still simplifies human movement. Pausing playback freezes the display; the numbers describe the modeled instant.'));
  root.append(help, assumptions, el('p', 'movement-lab__scope', 'This simulation describes one-dimensional position, velocity and acceleration. It measures no person, analyzes no video, and cannot establish impact force, boxing skill or learning progress.'));
  container.append(root);

  function paint() {
    const sample = sampleMovement(state.time, state);
    const x = 60 + 400 * sample.position / state.distance;
    hand.setAttribute('transform', `translate(${x} 80)`);
    endLabel.textContent = `${format(state.distance)} m`;
    diagramDesc.textContent = `Modeled marker at ${format(sample.position)} meters after ${format(state.time)} seconds. Total reach ${format(state.distance)} meters.`;
    durationControl.input.value = String(state.duration);
    durationControl.label.textContent = `Duration: ${format(state.duration)} s`;
    durationControl.input.setAttribute('aria-valuetext', `${format(state.duration)} seconds`);
    shapeInputs.forEach(input => { input.checked = input.value === state.shape; });
    scrub.input.value = String(state.time / state.duration * 100);
    scrub.label.textContent = `Position in replay: ${format(state.time)} of ${format(state.duration)} s`;
    scrub.input.setAttribute('aria-valuetext', `${format(state.time)} seconds, position ${format(sample.position)} meters`);
    let path = '';
    for (let i = 0; i <= 100; i++) {
      const t = 4 * i / 100;
      const y = 214 - 166 * sampleMovement(t, state).position / state.distance;
      path += `${i ? 'L' : 'M'}${60 + 100 * t} ${y} `;
    }
    curve.setAttribute('d', path);
    const cx = 60 + 100 * state.time, cy = 214 - 166 * sample.position / state.distance;
    cursor.setAttribute('d', `M ${cx} 214 V ${cy}`); dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
    distanceTick.textContent = format(state.distance);
    graphDesc.textContent = `Fixed time axis from zero to four seconds. ${state.shape} reach of ${format(state.distance)} meters over ${format(state.duration)} seconds, followed by rest. Current position ${format(sample.position)} meters.`;
    reading.textContent = `Position ${format(sample.position)} m / Velocity ${format(sample.velocity)} m/s / Acceleration ${format(sample.acceleration)} m/s\u00b2`;
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
  listen(scrub.input, 'input', () => edit({ time: Number(scrub.input.value) / 100 * state.duration }, 'movement.scrub'));
  listen(play, 'click', () => start(false)); listen(replay, 'click', () => start(true));
  listen(stop, 'click', () => edit({}, 'movement.stop'));
  listen(help, 'toggle', () => {
    if (state.assistanceOpen !== help.open) { state.assistanceOpen = help.open; publish(help.open ? 'movement.assistance.request' : 'movement.assistance.close'); }
  });
  listen(doc, 'visibilitychange', () => { if (doc.hidden && state.playing) edit({}, 'movement.stop'); });
  if (media?.addEventListener) listen(media, 'change', () => {
    if (state.playing && media.matches) edit({}, 'movement.stop'); else paint();
  });
  paint(); publish();
  return function cleanup() { disposed = true; cancelFrame(); listeners.forEach(remove => remove()); root.remove(); };
}
