const DRIVER_TEETH = 20;
const FOLLOWER_OPTIONS = [10, 20, 40];
const SVG_NS = 'http://www.w3.org/2000/svg';
let instanceCount = 0;

/** Number of follower turns produced by one driver turn. */
export function gearRatio(driverTeeth, drivenTeeth) {
  if (![driverTeeth, drivenTeeth].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new RangeError('Sprocket tooth counts must be positive whole numbers.');
  }
  return driverTeeth / drivenTeeth;
}

/**
 * Mount a chain-ratio diagram. Load gear-lab.css once in the host page.
 * onChange receives only changed keys from
 * { drivenTeeth, driverTurns, drivenTurns, ratio }; mounting emits nothing.
 * The returned cleanup removes only this instance and cancels its animation.
 */
export function mountGearLab(container, { initialState = {}, onChange } = {}) {
  if (!container || typeof container.append !== 'function' || !container.ownerDocument) {
    throw new TypeError('mountGearLab requires a DOM container.');
  }
  if (onChange !== undefined && typeof onChange !== 'function') {
    throw new TypeError('onChange must be a function.');
  }

  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const prefix = `gear-lab-${++instanceCount}`;
  const listeners = [];
  const drivenTeeth = [10,20,40].includes(initialState.drivenTeeth) ? initialState.drivenTeeth : 20;
  const driverTurns = Number.isFinite(initialState.driverTurns) ? Math.max(0,Math.min(3,initialState.driverTurns)) : 0;
  const ratio = gearRatio(DRIVER_TEETH,drivenTeeth);
  const state = { drivenTeeth, driverTurns, drivenTurns: driverTurns*ratio, ratio };
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let frame = null;
  let displayedTurns = 0;
  let disposed = false;

  function node(tag, className, text) {
    const element = doc.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function svg(tag, attributes = {}, text) {
    const element = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function listen(target, type, handler) {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  }

  const root = node('section', 'gear-lab');
  root.setAttribute('aria-labelledby', `${prefix}-title`);
  const eyebrow = node('p', 'gear-lab__eyebrow', 'Try a small experiment');
  const title = node('h3', 'gear-lab__title', 'What changes when the back sprocket gets smaller?');
  title.id = `${prefix}-title`;
  const intro = node('p', 'gear-lab__intro', 'Turn the pedals. Watch the marked points. Then change the sprocket that follows.');
  root.append(eyebrow, title, intro);

  const diagram = svg('svg', { viewBox: '0 0 500 325', class: 'gear-lab__diagram', role: 'img', 'aria-labelledby': `${prefix}-diagram-title ${prefix}-diagram-description` });
  const diagramTitle = svg('title', { id: `${prefix}-diagram-title` }, 'Two sprockets connected by an uncrossed chain');
  const diagramDescription = svg('desc', { id: `${prefix}-diagram-description` });
  diagram.append(diagramTitle, diagramDescription);
  diagram.append(svg('text', { x: 125, y: 24, class: 'gear-lab__svg-role', 'text-anchor': 'middle' }, 'PEDALS / DRIVER'));
  diagram.append(svg('text', { x: 365, y: 24, class: 'gear-lab__svg-role', 'text-anchor': 'middle' }, 'BACK / FOLLOWER'));
  diagram.append(svg('text', { x: 125, y: 43, class: 'gear-lab__svg-label', 'text-anchor': 'middle' }, '20 teeth'));
  const followerLabel = svg('text', { x: 365, y: 43, class: 'gear-lab__svg-label', 'text-anchor': 'middle' });
  diagram.append(followerLabel);
  const chainTrack = svg('path', { class: 'gear-lab__chain-track', fill: 'none' });
  const chainLinks = svg('path', { class: 'gear-lab__chain-links', fill: 'none', 'stroke-dasharray': `5 ${2 * Math.PI * 52 / DRIVER_TEETH - 5}` });
  const driver = svg('g', { 'data-sprocket': 'driver' });
  const follower = svg('g', { 'data-sprocket': 'follower' });
  diagram.append(driver, follower, chainTrack, chainLinks);
  const direction = svg('g', { class: 'gear-lab__direction', 'aria-hidden': 'true' });
  direction.append(svg('path', { d: 'M 224 88 H 276 M 269 83 L 276 88 L 269 93', fill: 'none' }));
  direction.append(svg('text', { x: 250, y: 74, 'text-anchor': 'middle' }, 'chain moves'));
  diagram.append(direction);
  const driverCount = svg('text', { x: 125, y: 300, class: 'gear-lab__svg-count', 'text-anchor': 'middle' });
  const followerCount = svg('text', { x: 365, y: 300, class: 'gear-lab__svg-count', 'text-anchor': 'middle' });
  diagram.append(driverCount, followerCount);
  root.append(diagram);
  root.append(node('p', 'gear-lab__direction-note', 'The pedals drive the chain. The back sprocket follows. Both turn clockwise.'));

  const controls = node('div', 'gear-lab__controls');
  const choices = node('fieldset', 'gear-lab__choices');
  choices.append(node('legend', '', 'Choose the back sprocket'));
  const options = node('div', 'gear-lab__options');
  for (const teeth of FOLLOWER_OPTIONS) {
    const label = node('label', 'gear-lab__option');
    const input = node('input');
    input.type = 'radio'; input.name = `${prefix}-teeth`; input.value = String(teeth); input.checked = teeth === state.drivenTeeth;
    label.append(input, node('span', '', `${teeth} teeth`));
    options.append(label);
    listen(input, 'change', () => { if (input.checked) change({ drivenTeeth: teeth }); });
  }
  choices.append(options);
  controls.append(choices);
  const sliderRow = node('div', 'gear-lab__slider-label');
  const sliderLabel = node('label', '', 'Pedal turns'); sliderLabel.htmlFor = `${prefix}-turns`;
  const sliderOutput = node('output', 'gear-lab__slider-output'); sliderOutput.htmlFor = `${prefix}-turns`;
  sliderRow.append(sliderLabel, sliderOutput);
  const slider = node('input', 'gear-lab__slider');
  slider.id = `${prefix}-turns`; slider.type = 'range'; slider.min = '0'; slider.max = '3'; slider.step = '0.05'; slider.value = '0';
  slider.setAttribute('aria-describedby', `${prefix}-slider-help`);
  const sliderHelp = node('p', 'gear-lab__hint', '0 to 3 turns. Use the arrow keys for small steps.'); sliderHelp.id = `${prefix}-slider-help`;
  listen(slider, 'input', () => change({ driverTurns: Number(slider.value) }));
  const actions = node('div', 'gear-lab__actions');
  const pedal = node('button', 'gear-lab__pedal', 'Turn pedals once'); pedal.type = 'button';
  const reset = node('button', 'gear-lab__reset', 'Reset turns'); reset.type = 'button';
  const limit = node('p', 'gear-lab__hint'); limit.id = `${prefix}-limit`;
  pedal.setAttribute('aria-describedby', limit.id);
  listen(pedal, 'click', () => { if (!pedal.disabled && state.driverTurns <= 2) change({ driverTurns: state.driverTurns + 1 }, true); });
  listen(reset, 'click', () => change({ driverTurns: 0 }));
  actions.append(pedal, reset);
  controls.append(sliderRow, slider, sliderHelp, actions, limit);
  root.append(controls);

  const observation = node('div', 'gear-lab__observation');
  observation.append(node('p', 'gear-lab__eyebrow', 'Notice what changes'));
  const observationText = node('p', 'gear-lab__observation-text');
  observationText.setAttribute('role', 'status'); observationText.setAttribute('aria-live', 'polite'); observationText.setAttribute('aria-atomic', 'true');
  observation.append(observationText); root.append(observation);
  const explanation = node('details', 'gear-lab__explanation');
  explanation.append(node('summary', '', 'Why does the number of turns change?'));
  explanation.append(node('p', '', 'One pedal turn moves the chain past 20 teeth. A 10-tooth back sprocket turns twice to pass those same 20 teeth; a 40-tooth sprocket turns halfway.'));
  const equation = node('p', 'gear-lab__equation');
  explanation.append(equation, node('p', '', 'The chain is not crossed, so both sprockets turn in the same direction. They are connected by the chain, not meshed against each other.'));
  root.append(explanation, node('p', 'gear-lab__scope', 'A diagram of turns and tooth counts. It does not simulate a whole bicycle, pedal effort, or road speed.'));
  container.append(root);

  function format(value) { return Number(value.toFixed(3)).toString(); }
  function turns(value) { return `${format(value)} ${value === 1 ? 'turn' : 'turns'}`; }

  function makeSprocket(group, teeth, radius, crank) {
    group.replaceChildren();
    const points = [];
    for (let tooth = 0; tooth < teeth; tooth++) {
      for (const [offset, distance] of [[-.45, radius - 4], [-.24, radius + 4], [.24, radius + 4], [.45, radius - 4]]) {
        const angle = (tooth + offset) * 2 * Math.PI / teeth;
        points.push(`${Math.cos(angle) * distance},${Math.sin(angle) * distance}`);
      }
    }
    group.append(svg('polygon', { points: points.join(' '), class: `gear-lab__sprocket ${crank ? 'gear-lab__sprocket--driver' : 'gear-lab__sprocket--follower'}` }));
    group.append(svg('circle', { r: radius * .68, class: 'gear-lab__inner' }));
    for (const angle of [0, 90, 180, 270]) group.append(svg('path', { d: `M 0 0 L 0 ${-radius * .66}`, transform: `rotate(${angle})`, class: 'gear-lab__spoke' }));
    group.append(svg('circle', { cy: -radius * .7, r: 6, class: 'gear-lab__marker' }));
    if (crank) {
      group.append(svg('path', { d: 'M 0 0 L 34 18', class: 'gear-lab__crank' }));
      group.append(svg('rect', { x: 25, y: 13, width: 21, height: 9, rx: 3, class: 'gear-lab__pedal-shape' }));
    }
    group.append(svg('circle', { r: 6, class: 'gear-lab__hub' }));
  }

  function rebuildDiagram() {
    const r1 = 52, r2 = 52 * state.drivenTeeth / DRIVER_TEETH;
    makeSprocket(driver, DRIVER_TEETH, r1, true); makeSprocket(follower, state.drivenTeeth, r2, false);
    // External tangents keep the chain uncrossed for all three sprocket sizes.
    const nx = (r1 - r2) / 240, ny = Math.sqrt(1 - nx * nx);
    const a = [125 + r1 * nx, 170 - r1 * ny], b = [365 + r2 * nx, 170 - r2 * ny];
    const c = [365 + r2 * nx, 170 + r2 * ny], d = [125 + r1 * nx, 170 + r1 * ny];
    const path = `M ${a} L ${b} A ${r2} ${r2} 0 ${nx < 0 ? 1 : 0} 1 ${c} L ${d} A ${r1} ${r1} 0 ${nx > 0 ? 1 : 0} 1 ${a} Z`;
    chainTrack.setAttribute('d', path); chainLinks.setAttribute('d', path);
    followerLabel.textContent = `${state.drivenTeeth} teeth`;
  }

  function paint(value) {
    displayedTurns = value;
    driver.setAttribute('transform', `translate(125 170) rotate(${value * 360})`);
    follower.setAttribute('transform', `translate(365 170) rotate(${value * state.ratio * 360})`);
    chainLinks.setAttribute('stroke-dashoffset', -value * 2 * Math.PI * 52);
    driverCount.textContent = turns(value); followerCount.textContent = turns(value * state.ratio);
  }

  function updateText() {
    slider.value = String(state.driverTurns); sliderOutput.value = turns(state.driverTurns);
    slider.setAttribute('aria-valuetext', `${turns(state.driverTurns)} of the pedals`);
    observationText.textContent = `${turns(state.driverTurns)} of the pedals gives ${turns(state.drivenTurns)} of the ${state.drivenTeeth}-tooth back sprocket. ${state.ratio === 2 ? 'The smaller follower turns twice for each pedal turn.' : state.ratio === .5 ? 'The larger follower turns halfway for each pedal turn.' : 'Equal tooth counts give equal turns.'}`;
    equation.textContent = `Back turns = pedal turns x 20 / ${state.drivenTeeth}. Now: ${format(state.driverTurns)} x ${format(state.ratio)} = ${turns(state.drivenTurns)}.`;
    diagramDescription.textContent = `The driver has 20 teeth and the follower has ${state.drivenTeeth}. An uncrossed chain joins them. Both turn clockwise. The pedals make ${turns(state.driverTurns)} and the follower makes ${turns(state.drivenTurns)}.`;
    limit.textContent = state.driverTurns > 2 ? 'To pedal one full turn again, reset or slide back to 2 turns or fewer.' : 'One pedal turn moves the chain past 20 teeth.';
    pedal.disabled = state.driverTurns > 2 || frame !== null;
    reset.disabled = state.driverTurns === 0 && frame === null;
  }

  function stopAnimation() {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
  }

  function animate(from, to) {
    let start;
    const tick = timestamp => {
      if (disposed) return;
      start ??= timestamp;
      const progress = Math.min(1, (timestamp - start) / 900);
      const eased = progress * progress * (3 - 2 * progress);
      paint(from + (to - from) * eased);
      if (progress < 1) frame = win.requestAnimationFrame(tick);
      else { frame = null; paint(to); updateText(); }
    };
    frame = win.requestAnimationFrame(tick);
  }

  function change(patch, animateTurn = false) {
    if (disposed) return;
    const next = { ...state, ...patch };
    next.driverTurns = Math.max(0, Math.min(3, next.driverTurns));
    next.ratio = gearRatio(DRIVER_TEETH, next.drivenTeeth);
    next.drivenTurns = next.driverTurns * next.ratio;
    const changed = Object.fromEntries(Object.keys(next).filter(key => next[key] !== state[key]).map(key => [key, next[key]]));
    const from = displayedTurns;
    stopAnimation(); Object.assign(state, next);
    if ('drivenTeeth' in changed) rebuildDiagram();
    if (animateTurn && !reducedMotion?.matches && from !== next.driverTurns) animate(from, next.driverTurns);
    else paint(next.driverTurns);
    updateText();
    if (Object.keys(changed).length) onChange?.(changed);
  }

  if (reducedMotion?.addEventListener) listen(reducedMotion, 'change', () => {
    if (reducedMotion.matches) { stopAnimation(); paint(state.driverTurns); updateText(); }
  });
  rebuildDiagram(); paint(state.driverTurns); updateText();

  return function cleanup() {
    if (disposed) return;
    disposed = true; stopAnimation(); listeners.forEach(remove => remove()); root.remove();
  };
}
