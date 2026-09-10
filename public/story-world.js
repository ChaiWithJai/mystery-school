import * as THREE from 'three';
import { IDEAS_SOURCE, ideasComparisonIdentity, validateIdeasState } from './ideas-lab.js';
import { appendMemory } from './learning-memory.js';

const LIMIT = 17;
const EYE = 1.68;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
export const STORY_WORLD_SOURCE = IDEAS_SOURCE;
export const STORY_WORLD_CHOICES = Object.freeze([
  Object.freeze({ id: 'a', label: 'Make room for both', shelter: 'shared', consequence: 'Authored possibility: the roof covers both places. Neither person\'s response is decided.' }),
  Object.freeze({ id: 'b', label: 'Keep one place sheltered', shelter: 'self', consequence: 'Authored possibility: the smaller roof covers one place. What happens next is yours to write.' }),
]);
export function displayedStoryChoice(state,index) {
  return (state.modelComparison?.decision_scene?.choices || STORY_WORLD_CHOICES)[index]?.id;
}

/** Only compact self-report fields enter the world; no URLs are fetched or interpreted. */
export function normalizeStoryMemories(input) {
  let memories = [];
  for (const value of Array.isArray(input) ? input : []) {
    if (!value || value.version !== 1 || value.kind !== 'boxing_reflection' || value.pathway !== 'movement' ||
      typeof value.source_artifact_id !== 'string' || !value.source_artifact_id.trim() || value.source_artifact_id.length > 256 ||
      !['learner_reported', 'agent_review', 'unknown'].includes(value.observation?.kind) ||
      typeof value.observation.label !== 'string' || !value.observation.label.trim() ||
      typeof value.observation.text !== 'string' || !value.observation.text.trim()) continue;
    const optional = key => typeof value[key] === 'string' && value[key].trim() ? value[key] : null;
    const refs = (Array.isArray(value.source_refs) ? value.source_refs : []).filter(ref => ref && typeof ref === 'object').map(ref =>
      Object.fromEntries(['id', 'label', 'url', 'locator', 'source_kind'].filter(key => typeof ref[key] === 'string').map(key => [key, ref[key]])));
    memories = appendMemory(memories, {
      version: 1, kind: 'boxing_reflection', pathway: 'movement', source_artifact_id: value.source_artifact_id,
      source_trace_id: optional('source_trace_id'), actor_kind: optional('actor_kind'), lessonId: optional('lessonId'),
      observation: { kind: value.observation.kind, label: value.observation.label, text: value.observation.text },
      detector_estimates: { label: 'Detector estimates, not verified punches or technique', count: Number.isSafeInteger(value.detector_estimates?.count) && value.detector_estimates.count >= 0 ? value.detector_estimates.count : 0 },
      source_refs: refs,
    });
  }
  return memories;
}

export function storyMemoryLinks(memory) {
  const id = encodeURIComponent(memory.source_artifact_id);
  return { artifact: `/?path=movement&artifact=${id}${memory.actor_kind === 'agent_review' ? '&actor=agent_review' : ''}`,
    trace: memory.source_trace_id ? `/review.html?sample=${id}` : null };
}

/** All lengths are scene units, not measured human distances. */
export function normalizeStoryWorldState(input = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const ideas = validateIdeasState(value);
  if (ideas.modelComparison && (ideas.modelComparison.source_ref_index !== 0 || !ideas.modelComparison.source_quote ||
    !IDEAS_SOURCE.excerpt.includes(ideas.modelComparison.source_quote))) throw new TypeError('The book-world comparison must quote the available Epictetus excerpt at source index 0.');
  const camera = value.camera || {};
  const memories = normalizeStoryMemories(value.memories);
  let x = finite(camera.x, 0), z = finite(camera.z, 9);
  const length = Math.hypot(x, z);
  if (length > LIMIT) { x *= LIMIT / length; z *= LIMIT / length; }
  return {
    version: 1,
    learnerIntent: text(value.learnerIntent, 2000),
    learnerStory: text(value.learnerStory, 12000),
    camera: { x, z, yaw: ((finite(camera.yaw, 0) % TAU) + TAU) % TAU, pitch: clamp(finite(camera.pitch, 0), -.95, .95) },
    modelComparison: ideas.modelComparison,
    decisionResponses: ideas.decisionResponses,
    storyChoice: ideas.storyChoice,
    sourceOpen: value.sourceOpen === true,
    writerOpen: value.writerOpen === true,
    memories,
    memoriesOpen: value.memoriesOpen === true && memories.length > 0,
    memoryArtifactId: memories.some(memory => memory.source_artifact_id === value.memoryArtifactId) ? value.memoryArtifactId : memories.at(-1)?.source_artifact_id || null,
  };
}

export function storyWorldShelter(state) {
  const scene = state.modelComparison?.decision_scene;
  const response = state.decisionResponses?.[ideasComparisonIdentity(state.modelComparison)];
  const choice = scene?.choices.find(item => item.id === response);
  const shared = scene ? choice?.shelter === 'shared' : state.storyChoice === 'offer_shelter';
  return { shared, centerX: shared ? 0 : -1.2, centerZ: -3.8, width: shared ? 6.2 : 2.6, depth: 4.2,
    response: scene ? response || null : state.storyChoice === 'offer_shelter' ? 'a' : state.storyChoice === 'return_umbrella' ? 'b' : null,
    consequence: choice?.consequence || (scene ? '' : STORY_WORLD_CHOICES.find(item => item.id === (shared ? 'a' : 'b'))?.consequence || '') };
}

export function isUnderStoryShelter(x, z, shelter) {
  return Math.abs(x - shelter.centerX) < shelter.width / 2 && Math.abs(z - shelter.centerZ) < shelter.depth / 2;
}

export function chooseStoryWorld(input, choice) {
  if (!['a', 'b', 'neither'].includes(choice)) throw new TypeError('Choose a, b, or neither.');
  const state = normalizeStoryWorldState(input);
  if (state.modelComparison?.decision_scene) {
    const key = ideasComparisonIdentity(state.modelComparison);
    delete state.decisionResponses[key];
    state.decisionResponses[key] = choice;
  } else if (state.modelComparison) {
    throw new TypeError('This historical comparison contains text only, not playable model choices.');
  } else state.storyChoice = choice === 'a' ? 'offer_shelter' : choice === 'b' ? 'return_umbrella' : null;
  return normalizeStoryWorldState(state);
}

/** Slide along obstacles rather than stepping through shelves or tree trunks. */
export function stepStoryCamera(camera, input, seconds, obstacles = []) {
  const dt = clamp(finite(seconds, 0), 0, .05);
  const yaw = ((camera.yaw + clamp(finite(input.turn, 0), -1, 1) * dt * 1.65) % TAU + TAU) % TAU;
  const pitch = clamp(camera.pitch + clamp(finite(input.look, 0), -1, 1) * dt, -.95, .95);
  let forward = clamp(finite(input.forward, 0), -1, 1), right = clamp(finite(input.right, 0), -1, 1);
  const magnitude = Math.hypot(forward, right);
  if (magnitude > 1) { forward /= magnitude; right /= magnitude; }
  const speed = 3.2 * dt;
  const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed;
  const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed;
  const allowed = (x, z) => Math.hypot(x, z) <= LIMIT && !obstacles.some(o => o.enabled !== false && Math.hypot(x - o.x, z - o.z) < o.radius + .28);
  let { x, z } = camera;
  if (allowed(x + dx, z)) x += dx;
  if (allowed(x, z + dz)) z += dz;
  return { x, z, yaw, pitch };
}

let instances = 0;

/**
 * Host loads story-world.css. Reuses the homepage school.glb; no inference or global key listeners.
 * onChange receives detached full state; onEvent(type, payload) labels authored/model fiction.
 * Movement snapshots are emitted at most four times per second and once on key release.
 */
export function mountStoryWorld(container, { initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  if (!container?.ownerDocument || typeof container.append !== 'function') throw new TypeError('A DOM container is required.');
  if (typeof onChange !== 'function' || typeof onEvent !== 'function') throw new TypeError('Callbacks must be functions.');
  let state = normalizeStoryWorldState(initialState);
  const doc = container.ownerDocument, win = doc.defaultView;
  const id = `story-world-${++instances}`;
  const root = doc.createElement('section'); root.className = 'story-world';
  root.setAttribute('aria-label', 'Walkable book-world: your story in the forest');
  const make = (tag, className, content) => { const n = doc.createElement(tag); n.className = className; if (content !== undefined) n.textContent = content; return n; };
  const viewport = make('div', 'story-world__viewport'); viewport.tabIndex = 0;
  viewport.setAttribute('role', 'group'); viewport.setAttribute('aria-label', '3D world. W A S D to walk, arrow keys or drag to look, E to interact, Escape to release controls.');
  const header = make('header', 'story-world__header');
  header.append(make('span', 'story-world__eyebrow', 'THE UNWRITTEN CLEARING'), make('h2', '', 'Walk into the question.'));
  const tools = make('div', 'story-world__tools');
  const button = (label, title) => { const n = make('button', '', label); n.type = 'button'; if (title) n.setAttribute('aria-label', title); return n; };
  const enter = button('Enter the world'), write = button('Write my story'), source = button('Open the source'), reset = button('Return to the path'), memoryControl = button('Visit reported memories');
  tools.append(enter, write); header.append(tools);
  const sceneNote = make('p', 'story-world__scene-note');
  const crosshair = make('span', 'story-world__crosshair', '+'); crosshair.setAttribute('aria-hidden', 'true');
  const prompt = make('button', 'story-world__prompt'); prompt.type = 'button'; prompt.hidden = true;
  const status = make('p', 'story-world__status'); status.setAttribute('role', 'status');
  const compass = make('output', 'story-world__compass'); compass.setAttribute('aria-label', 'Position in the imagined world');
  const controls = make('details', 'story-world__controls'); controls.append(make('summary', '', 'Movement & accessible choices'));
  controls.append(make('p', '', 'Click Enter, then W A S D to walk. Arrow keys or drag to look. E activates a nearby place. Escape releases movement. These are scene coordinates, not a physical measurement.'));
  const choiceRow = make('div', 'story-world__choices');
  const choiceButtons = [button(''), button('')], neither = button('Neither fits');
  choiceRow.append(...choiceButtons, neither); controls.append(choiceRow, memoryControl);
  const writer = make('section', 'story-world__writer'); writer.setAttribute('aria-label', 'Write your own story');
  const closeWriter = button('Return to the world');
  writer.append(make('p', 'story-world__eyebrow', 'YOUR WORDS / NEVER AUTO-WRITTEN'), make('h3', '', 'What happens here?'));
  const intentLabel = make('label', '', 'What do you want to explore?'); intentLabel.htmlFor = `${id}-intent`;
  const intent = make('textarea', ''); intent.id = intentLabel.htmlFor; intent.rows = 2; intent.maxLength = 2000;
  const storyLabel = make('label', '', 'Write the story in your own words'); storyLabel.htmlFor = `${id}-story`;
  const story = make('textarea', ''); story.id = storyLabel.htmlFor; story.rows = 8; story.maxLength = 12000;
  story.placeholder = 'Start anywhere. You decide what the people say, do, or leave unresolved.';
  writer.append(intentLabel, intent, storyLabel, story, make('p', '', 'Choosing a shelter changes the setting, not your writing. The host app receives your draft; this module does not save or send it by itself.'), closeWriter);
  const sourcePanel = make('section', 'story-world__source'); sourcePanel.setAttribute('aria-label', 'Optional source passage');
  const closeSource = button('Return to the world');
  const sourceLink = make('a', '', 'Read section 1 in context'); sourceLink.href = IDEAS_SOURCE.url; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer';
  sourcePanel.append(make('p', 'story-world__eyebrow', 'SOURCE / NOT THE FICTION'), make('h3', '', 'Epictetus, The Enchiridion'), make('blockquote', '', IDEAS_SOURCE.excerpt), make('p', '', 'Section 1. Elizabeth Carter translation. The forest and its choices are imagined settings, not events or instructions from this passage.'), sourceLink, closeSource);
  const memoryPanel = make('section', 'story-world__memories'); memoryPanel.setAttribute('aria-label', 'Reported memories');
  const closeMemories = button('Return to the world');
  const memoryLabel = make('label', '', 'Saved report'); memoryLabel.htmlFor = `${id}-memory`;
  const memorySelect = make('select', ''); memorySelect.id = memoryLabel.htmlFor;
  const memoryActor = make('p', 'story-world__memory-actor');
  const memoryKindLabel = make('p', 'story-world__memory-label');
  const memoryObservation = make('blockquote', 'story-world__memory-observation');
  const memoryArtifactLink = make('a', '', 'Open exact saved artifact');
  const memoryTraceLink = make('a', '', 'Inspect source record and trace');
  for (const link of [memoryArtifactLink, memoryTraceLink]) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  const memoryTrace = make('p', 'story-world__memory-trace');
  memoryPanel.append(make('p', 'story-world__eyebrow', 'REPORTED MEMORY / NOT MODEL FICTION'), make('h3', '', 'What was reported'),
    make('p', '', 'Reports are not independently verified. Saving a report does not establish its accuracy, technique, or authorship.'),
    memoryLabel, memorySelect, memoryActor, memoryKindLabel, memoryObservation, memoryArtifactLink, memoryTraceLink, memoryTrace, closeMemories);
  const context=make('details','story-world__context');context.append(make('summary','','About this scene'),sceneNote,source,reset);
  root.append(viewport, header, context, crosshair, prompt, status, compass, controls, writer, sourcePanel, memoryPanel); container.append(root);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
  catch (error) { root.remove(); throw new Error(`This explorable world needs WebGL: ${error.message}`); }
  renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true'); viewport.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x173e35); scene.fog = new THREE.FogExp2(0x173e35, .012);
  const camera = new THREE.PerspectiveCamera(65, 1, .08, 110); camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xeaf4d5, 0x17362f, 2.4));
  const sun = new THREE.DirectionalLight(0xffe2ab, 4); sun.position.set(-12, 22, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 }); sun.shadow.bias = -.0004; scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9ddcda, 2); rim.position.set(15, 6, -12); scene.add(rim);
  const materials = {}, geometries = new Set(), textures = new Set();
  for (const [name, color] of Object.entries({ ground: 0x526c52, moss: 0x7c9470, pine: 0x2b654e, bark: 0x526c52, rock: 0x405a4e, paper: 0xe8dfb5, cover: 0x2b654e, brass: 0xd7bc70, blue: 0x536a75, cloth: 0xb3925a })) materials[name] = new THREE.MeshStandardMaterial({ color, roughness: .88 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xfce1a2, emissive: 0xf5c16a, emissiveIntensity: 1.1 }); materials.glow = glow;
  const box = new THREE.BoxGeometry(1, 1, 1), cylinder = new THREE.CylinderGeometry(1, 1, 1, 10), cone = new THREE.ConeGeometry(1, 1, 8), sphere = new THREE.IcosahedronGeometry(1, 1);
  for (const geometry of [box, cylinder, cone, sphere]) geometries.add(geometry);
  function mesh(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, parent = scene) {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.scale.set(sx, sy, sz); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  mesh(cylinder, materials.ground, 0, -.38, 0, 20, .7, 20);
  mesh(cone, materials.rock, 0, -4.2, 0, 20, 7, 20).rotation.z = Math.PI;
  mesh(box, materials.paper, 0, -.012, 4, 3.4, .035, 17);
  for (let i = 0; i < 16; i++) mesh(box, materials.brass, 0, .012, 11 - i, 3.45, .025, .035);
  const obstacles = [], targets = [];
  let seed = 3701;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // Match the school’s mixed pine/canopy silhouette, leaving the home landmarks visible.
  for (let i = 0; i < 30; i++) {
    const angle = random() * TAU, radius = 13 + random() * 8, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    if (z < -8 && Math.abs(x) < 12) continue;
    const h = 1.8 + random() * 2.5;
    mesh(cylinder, materials.bark, x, h / 2, z, .17, h, .17); obstacles.push({ x, z, radius: .3 });
    if (i % 3 === 0) {
      for (let j = 0; j < 3; j++) mesh(sphere, j === 2 ? materials.moss : materials.pine, x + (j - 1) * .5, h + j * .3, z, 1.2, .7, 1.1);
    } else for (let j = 0; j < 3; j++) mesh(cone, j === 2 ? materials.moss : materials.pine, x, h * .6 + j * .7, z, 1.2 - j * .22, 2, 1.2 - j * .22);
  }
  // Giant bound volumes form an open colonnade, with walkable gaps between them.
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = side * (9 + Math.sin(i) * .65), z = 7 - i * 3.5, h = 3.5 + (i % 3) * .65;
    const book = new THREE.Group(); book.position.set(x, 0, z); book.rotation.y = side * (.2 + i * .12); scene.add(book);
    mesh(box, materials.paper, 0, h / 2, 0, .9, h, 2.4, book);
    for (const edge of [-1, 1]) mesh(box, materials.cover, edge * .53, h / 2, 0, .14, h + .15, 2.6, book);
    for (let line = 0; line < 7; line++) mesh(box, materials.brass, 0, .5 + line * .4, 1.21, .92, .018, .02, book);
    obstacles.push({ x, z, radius: 1.25 });
  }
  function sign(label, x, y, z, width = 3.2) {
    const canvas = doc.createElement('canvas'); canvas.width = 768; canvas.height = 192;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e7dab7'; ctx.fillRect(0, 0, 768, 192); ctx.fillStyle = '#263e33'; ctx.font = '36px Georgia'; ctx.textAlign = 'center'; ctx.fillText(label, 384, 108, 710);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); materials[`sign-${textures.size}`] = material;
    const geometry = new THREE.PlaneGeometry(width, width / 4); geometries.add(geometry);
    return mesh(geometry, material, x, y, z);
  }
  const shelterGroup = new THREE.Group(); scene.add(shelterGroup);
  const roof = mesh(box, materials.cloth, -1.2, 3.25, -3.8, 2.6, .14, 4.2, shelterGroup);
  const roofRidge = mesh(box, materials.brass, -1.2, 3.38, -3.8, 2.6, .06, .08, shelterGroup);
  const posts = [-1, 1].flatMap(x => [-1, 1].map(z => ({ x, z, mesh: mesh(cylinder, materials.bark, 0, 1.6, 0, .055, 3.2, .055, shelterGroup) })));
  for (const [x, material] of [[-1.2, materials.paper], [1.3, materials.blue]]) {
    mesh(cylinder, material, x, .62, -3.7, .23, .9, .23); mesh(sphere, materials.paper, x, 1.32, -3.7, .18, .2, .18);
    mesh(box, materials.bark, x, .15, -3.7, .85, .3, .8); obstacles.push({ x, z: -3.7, radius: .5 });
  }
  const sharedLamp = new THREE.PointLight(0xf8ce88, 0, 7); sharedLamp.position.set(1.3, 2.6, -3.7); scene.add(sharedLamp);
  function placeTarget(action, label, x, z, material = materials.brass) {
    const object = mesh(box, material, x, .75, z, .65, 1.5, .65); object.userData.action = action; targets.push(object);
    sign(label, x, 1.9, z + .38, 2.6); return object;
  }
  placeTarget('a', 'MAKE ROOM', -3.6, -.7); placeTarget('b', 'ONE SHELTER', 3.6, -.7);
  const desk = mesh(box, materials.bark, 5.4, .85, 4, 2.4, .18, 1.25); desk.userData.action = 'writer'; targets.push(desk);
  mesh(box, materials.paper, 5.4, .97, 4, 1.4, .035, .9); sign('YOUR UNWRITTEN PAGE', 5.4, 1.8, 4, 3.6);
  obstacles.push({ x: 5.4, z: 4, radius: 1.15 });
  const memoryPlace = new THREE.Group(); memoryPlace.position.set(-5.4, 0, 4); scene.add(memoryPlace);
  // Interaction targets use world positions, as do the desk and shelter markers.
  const memoryTarget = mesh(box, materials.cover, -5.4, .55, 4, 1.8, 1.1, 1.05); memoryTarget.userData.action = 'memories'; targets.push(memoryTarget);
  const memoryBooks = Array.from({ length: 3 }, (_, i) => mesh(box, i % 2 ? materials.paper : materials.brass, 0, 1.17 + i * .14, 0, 1.35 - i * .12, .11, .8, memoryPlace));
  const memorySign = sign('REPORTED MEMORIES', -5.4, 2.1, 4, 3.2);
  const memoryObstacle = { x: -5.4, z: 4, radius: 1.05 }; obstacles.push(memoryObstacle);
  const door = placeTarget('source', 'EPICTETUS / SECTION 1', -6, -6.8, materials.cover);
  door.scale.set(1.8, 3.4, .3); door.position.y = 1.7;
  for (const x of [-7.05, -4.95]) mesh(box, materials.paper, x, 1.85, -6.8, .14, 3.7, .4);
  mesh(box, materials.paper, -6, 3.7, -6.8, 2.3, .14, .4);
  for (const x of [-2, 2]) for (let z = 2; z <= 10; z += 4) { mesh(cylinder, materials.bark, x, .5, z, .06, 1, .06); mesh(sphere, glow, x, 1.05, z, .13, .2, .13); }
  // Rain is omitted below the active roof, so a choice changes actual coverage.
  const rainCount = 550, rainValues = new Float32Array(rainCount * 6), rainSeeds = Array.from({ length: rainCount }, () => ({ x: random() * 36 - 18, z: random() * 36 - 18, y: random() * 12 }));
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainValues, 3)); geometries.add(rainGeometry);
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0xa3b7ad, transparent: true, opacity: .26 }); materials.rain = rainMaterial;
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial); rain.frustumCulled = false; scene.add(rain);

  const listeners = [], keys = new Set(); let disposed = false, frame, lastTime = 0, elapsed = 0, lastNotify = 0, dirty = false, nearest = null, drag = null;
  const motionQuery = win.matchMedia('(prefers-reduced-motion: reduce)'); let reduced = motionQuery.matches;
  const schoolResources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  let schoolBackdrop = null;
  const disposeSchoolResources = () => {
    schoolResources.geometries.forEach(resource => resource.dispose());
    schoolResources.materials.forEach(resource => resource.dispose());
    schoolResources.textures.forEach(resource => resource.dispose());
    Object.values(schoolResources).forEach(set => set.clear());
  };
  root.dataset.schoolAsset = 'loading';
  import('/vendor/three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync('/assets/school.glb')).then(gltf => {
    gltf.scene.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = true;
      schoolResources.geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        schoolResources.materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) schoolResources.textures.add(value);
      }
    });
    if (disposed) { disposeSchoolResources(); return; }
    schoolBackdrop = gltf.scene; schoolBackdrop.position.set(0, 1.5, -39); schoolBackdrop.scale.setScalar(2.3); scene.add(schoolBackdrop);
    root.dataset.schoolAsset = 'ready'; renderScene();
    emit('world.asset.ready', { asset: '/assets/school.glb', sharedWith: 'homepage', effect: 'visual continuity only' });
  }).catch(() => { if (!disposed) { root.dataset.schoolAsset = 'unavailable'; emit('world.asset.unavailable', { asset: '/assets/school.glb' }); } });
  const snapshot = () => structuredClone(state);
  const notify = () => { if (!disposed) { dirty = false; onChange(snapshot()); } };
  const emit = (type, extra = {}) => { if (!disposed) onEvent(type, { lab: 'story-world', fiction_kind: state.modelComparison?.decision_scene ? 'model_imagined' : 'authored_setting', sourceId: IDEAS_SOURCE.id, ...extra, state: snapshot() }); };
  const listen = (element, name, fn, options) => { element.addEventListener(name, fn, options); listeners.push(() => element.removeEventListener(name, fn, options)); };
  function refresh() {
    const shelter = storyWorldShelter(state);
    roof.position.x = roofRidge.position.x = shelter.centerX; roof.scale.x = roofRidge.scale.x = shelter.width;
    for (const post of posts) post.mesh.position.set(shelter.centerX + post.x * (shelter.width / 2 - .12), 1.6, shelter.centerZ + post.z * 1.92);
    sharedLamp.intensity = shelter.shared ? 5 : 0;
    const model = state.modelComparison, choices = model?.decision_scene?.choices || STORY_WORLD_CHOICES;
    root.dataset.shelter = shelter.shared ? 'shared' : 'self';
    sceneNote.textContent = model ? `${model.decision_scene ? 'Model-imagined scene' : 'Historical text-only comparison; the 3D setting is authored'}: ${model.scenario}` : 'An authored world beside an old passage. Walk, change the setting, then write what happens. No ending is written for you.';
    choiceButtons.forEach((b, index) => { b.textContent = choices[index].label; b.disabled = Boolean(model && !model.decision_scene); b.setAttribute('aria-pressed', String(shelter.response === choices[index].id)); });
    neither.disabled = Boolean(model && !model.decision_scene); neither.setAttribute('aria-pressed', String(shelter.response === 'neither'));
    status.textContent = shelter.response === 'neither' ? 'Neither fits. Your story is unchanged.' : shelter.response ? `${model ? 'Model-imagined consequence' : 'Authored possibility'}: ${shelter.consequence}` : 'Your page is blank until you write. Walk toward the two brass markers to explore the shelter.';
    writer.hidden = !state.writerOpen; sourcePanel.hidden = !state.sourceOpen; memoryPanel.hidden = !state.memoriesOpen;
    viewport.setAttribute('aria-hidden', String(panelOpen()));
    root.dataset.panel = panelOpen() ? 'open' : 'closed';
    write.setAttribute('aria-expanded', String(state.writerOpen)); source.setAttribute('aria-expanded', String(state.sourceOpen));
    intent.value = state.learnerIntent; story.value = state.learnerStory;
    memoryPlace.visible = memoryTarget.visible = memorySign.visible = state.memories.length > 0;
    memoryObstacle.enabled = state.memories.length > 0;
    memoryBooks.forEach((book, index) => { book.visible = index < state.memories.length; });
    memoryControl.disabled = !state.memories.length; memoryControl.textContent = state.memories.length ? `Visit reported memories (${state.memories.length})` : 'No reported memories yet';
    memoryControl.setAttribute('aria-expanded', String(state.memoriesOpen));
    memorySelect.replaceChildren(...state.memories.map((memory, index) => { const option = make('option', '', `Report ${index + 1}${memory.actor_kind === 'agent_review' ? ' / agent QA' : ''}`); option.value = memory.source_artifact_id; return option; }));
    memorySelect.value = state.memoryArtifactId || '';
    const memory = state.memories.find(record => record.source_artifact_id === state.memoryArtifactId);
    memoryObservation.textContent = memory?.observation.text || '';
    memoryKindLabel.textContent = memory?.observation.label || '';
    memoryActor.textContent = memory?.actor_kind === 'agent_review' ? 'Agent QA record, not learner evidence.' : `Declared actor: ${memory?.actor_kind || 'not supplied'}. This is not verified identity.`;
    if (memory) {
      const links = storyMemoryLinks(memory); memoryArtifactLink.href = links.artifact;
      memoryTraceLink.hidden = !links.trace; if (links.trace) memoryTraceLink.href = links.trace;
      memoryTrace.textContent = memory.source_trace_id ? `Recorded trace ID: ${memory.source_trace_id}` : 'No source trace ID was supplied.';
    }
    renderScene();
  }
  function panelOpen() { return state.writerOpen || state.sourceOpen || state.memoriesOpen; }
  function openPanel(kind) {
    if (kind === 'memories' && !state.memories.length) return;
    keys.clear(); state.writerOpen = kind === 'writer'; state.sourceOpen = kind === 'source'; state.memoriesOpen = kind === 'memories'; refresh(); notify(); emit(`${kind}.open`, kind === 'memories' ? { source_artifact_id: state.memoryArtifactId, observation_kind: state.memories.find(record => record.source_artifact_id === state.memoryArtifactId)?.observation.kind, independently_verified: false } : {});
    (kind === 'writer' ? intent : kind === 'memories' ? memorySelect : closeSource).focus();
  }
  function closePanels() { state.writerOpen = state.sourceOpen = state.memoriesOpen = false; refresh(); notify(); viewport.focus({ preventScroll: true }); }
  function choose(choice) {
    try { state = chooseStoryWorld(state, choice); refresh(); notify(); emit('decision', { choice, physical_measurement: false }); }
    catch (error) { status.textContent = error.message; }
  }
  function activate(action) { if (['writer', 'source', 'memories'].includes(action)) openPanel(action); else choose(action); }
  listen(enter, 'click', () => { viewport.focus({ preventScroll: true }); status.textContent = 'You have control. W A S D to walk; arrows or drag to look; E near a marker.'; });
  listen(write, 'click', () => openPanel('writer')); listen(source, 'click', () => openPanel('source'));
  listen(closeWriter, 'click', closePanels); listen(closeSource, 'click', closePanels);
  listen(memoryControl, 'click', () => openPanel('memories')); listen(closeMemories, 'click', closePanels);
  listen(memorySelect, 'change', () => { state.memoryArtifactId = memorySelect.value; refresh(); notify(); emit('memories.select', { source_artifact_id: state.memoryArtifactId, observation_kind: state.memories.find(record => record.source_artifact_id === state.memoryArtifactId)?.observation.kind, independently_verified: false }); });
  listen(sourceLink, 'click', () => emit('source.open', { url: IDEAS_SOURCE.url }));
  listen(reset, 'click', () => { keys.clear(); state.camera = { x: 0, z: 9, yaw: 0, pitch: 0 }; notify(); emit('navigation.reset'); });
  choiceButtons.forEach((b, i) => listen(b, 'click', () => choose(displayedStoryChoice(state,i)))); listen(neither, 'click', () => choose('neither'));
  listen(intent, 'input', () => { state.learnerIntent = intent.value.slice(0, 2000); notify(); });
  listen(story, 'input', () => { state.learnerStory = story.value.slice(0, 12000); notify(); });
  listen(intent, 'change', () => emit('writing.intent')); listen(story, 'change', () => emit('writing.story'));
  listen(root, 'keydown', event => { if (event.key === 'Escape') { keys.clear(); if (panelOpen()) closePanels(); else { viewport.blur(); notify(); } } });
  const movementKeys = new Set(['w', 'a', 's', 'd', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  listen(viewport, 'keydown', event => {
    if (panelOpen()) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (movementKeys.has(key)) { event.preventDefault(); keys.add(key); }
    if (key === 'e' && nearest && !event.repeat) { event.preventDefault(); activate(nearest.userData.action); }
  });
  listen(viewport, 'keyup', event => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; if (movementKeys.has(key)) { event.preventDefault(); keys.delete(key); notify(); emit('navigation.stop'); } });
  listen(viewport, 'blur', () => { keys.clear(); if (dirty) notify(); });
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  listen(viewport, 'pointerdown', event => { if (event.button !== 0 || panelOpen()) return; viewport.focus({ preventScroll: true }); drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY }; viewport.setPointerCapture(event.pointerId); });
  listen(viewport, 'pointermove', event => { if (!drag) return; state.camera.yaw = (state.camera.yaw - (event.clientX - drag.x) * .004 + TAU) % TAU; state.camera.pitch = clamp(state.camera.pitch - (event.clientY - drag.y) * .003, -.95, .95); drag.x = event.clientX; drag.y = event.clientY; dirty = true; });
  listen(viewport, 'pointerup', event => {
    if (!drag) return; const clicked = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5; drag = null; notify();
    if (clicked) { const rect = viewport.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(targets.filter(target => target.visible))[0]; if (hit) { if (Math.hypot(hit.object.position.x - state.camera.x, hit.object.position.z - state.camera.z) <= 3.5) activate(hit.object.userData.action); else status.textContent = 'Walk closer to that place, then click it or press E.'; } }
  });
  listen(viewport, 'pointercancel', () => { drag = null; if (dirty) notify(); });
  listen(prompt, 'click', () => { if (nearest) activate(nearest.userData.action); });
  listen(motionQuery, 'change', event => { reduced = event.matches; });
  listen(doc, 'visibilitychange', () => { keys.clear(); drag = null; if (dirty) notify(); });
  listen(renderer.domElement, 'webglcontextlost', event => { event.preventDefault(); keys.clear(); status.textContent = 'The 3D graphics context was lost. Your writing is still in the draft. Reopen this world to resume navigation.'; });
  function renderScene() {
    camera.position.set(state.camera.x, EYE, state.camera.z); camera.rotation.set(state.camera.pitch, state.camera.yaw, 0);
    compass.textContent = `${state.camera.x.toFixed(1)}, ${state.camera.z.toFixed(1)} / ${isUnderStoryShelter(state.camera.x, state.camera.z, storyWorldShelter(state)) ? 'Under the shelter' : 'On the forest path'}`;
    renderer.render(scene, camera);
  }
  const resize = () => { const rect = viewport.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix(); renderScene(); };
  const observer = new win.ResizeObserver(resize); observer.observe(viewport);
  function animate(now) {
    if (disposed) return;
    const dt = lastTime ? clamp((now - lastTime) / 1000, 0, .05) : 0; lastTime = now;
    if (!doc.hidden) {
      if (!panelOpen() && keys.size) {
        state.camera = stepStoryCamera(state.camera, { forward: Number(keys.has('w')) - Number(keys.has('s')), right: Number(keys.has('d')) - Number(keys.has('a')), turn: Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight')), look: Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown')) }, dt, obstacles); dirty = true;
      }
      if (!reduced) elapsed += dt;
      camera.position.set(state.camera.x, EYE, state.camera.z); camera.rotation.set(state.camera.pitch, state.camera.yaw, 0);
      const shelter = storyWorldShelter(state);
      rainSeeds.forEach((p, i) => { const y = ((p.y - elapsed * 5) % 12 + 12) % 12; const hidden = y < 3.3 && isUnderStoryShelter(p.x, p.z, shelter); const n = i * 6; rainValues.set([p.x, hidden ? -2 : y, p.z, p.x + .025, hidden ? -2 : y - .3, p.z], n); });
      rainGeometry.attributes.position.needsUpdate = true;
      nearest = targets.filter(o => o.visible && Math.hypot(o.position.x - state.camera.x, o.position.z - state.camera.z) <= 3.5).sort((a, b) => camera.position.distanceToSquared(a.position) - camera.position.distanceToSquared(b.position))[0] || null;
      prompt.hidden = !nearest || panelOpen();
      if (nearest) { const action = nearest.userData.action; prompt.textContent = action === 'memories' ? 'E / Read a reported memory' : action === 'writer' ? 'E / Write at this desk' : action === 'source' ? 'E / Read the source' : `E / ${(state.modelComparison?.decision_scene?.choices || STORY_WORLD_CHOICES).find(c => c.id === action).label}`; }
      compass.textContent = `${state.camera.x.toFixed(1)}, ${state.camera.z.toFixed(1)} / ${isUnderStoryShelter(state.camera.x, state.camera.z, shelter) ? 'Under the shelter' : 'On the forest path'}`;
      renderScene();
      if (dirty && now - lastNotify >= 250) { lastNotify = now; notify(); }
    }
    frame = win.requestAnimationFrame(animate);
  }
  refresh(); resize(); notify(); emit('open'); frame = win.requestAnimationFrame(animate);
  return {
    getState: snapshot,
    setState(value) {
      if (disposed) throw new Error('This book-world is closed.');
      const next = normalizeStoryWorldState(value);
      keys.clear(); drag = null; state = next; refresh(); notify(); emit('state.restored');
    },
    dispose() {
      if (disposed) return;
      disposed = true; keys.clear(); win.cancelAnimationFrame(frame); observer.disconnect(); listeners.forEach(remove => remove());
      schoolBackdrop?.removeFromParent(); disposeSchoolResources(); geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); Object.values(materials).forEach(m => m.dispose()); renderer.dispose(); renderer.forceContextLoss(); root.remove();
    },
  };
}
