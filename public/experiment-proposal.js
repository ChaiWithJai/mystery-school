const PATHWAYS = ['music', 'movement', 'ideas'];
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const PRACTICE_EXERCISE = 'runaway-mn0103069-opening-two-strikes';
const PRACTICE_SOURCE = 'https://www.musicnotes.com/sheetmusic/kanye-west/runaway/MN0103069';
const PRACTICE_LOCATOR = 'Original E-major arrangement, page 1, first two right-hand strikes including the tied continuation';

function sameJson(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
}

// Inspect descriptors before reading values: proposals must be data, not getters or code.
function jsonCopy(value, depth = 0) {
  if (depth > 60) throw new TypeError('JSON nesting is too deep.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') throw new TypeError('Use finite JSON data.');
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array)) {
    throw new TypeError('Use plain JSON objects.');
  }
  const result = array ? [] : {};
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string' || FORBIDDEN.has(key)) throw new TypeError('Unsafe JSON key.');
    if (array && !/^(0|[1-9]\d*)$/.test(key)) throw new TypeError('Invalid array field.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !('value' in descriptor)) throw new TypeError('Use enumerable JSON values.');
    result[key] = jsonCopy(descriptor.value, depth + 1);
  }
  if (array && (result.length !== value.length || Object.keys(result).length !== value.length)) {
    throw new TypeError('Sparse arrays are not supported.');
  }
  return result;
}

function fields(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new TypeError('Missing or unexpected proposal fields.');
  }
}

function number(value, low, high, integer = false) {
  if (!Number.isFinite(value) || value < low || value > high || (integer && !Number.isInteger(value))) {
    throw new RangeError('Proposal number is outside the allowed bounds.');
  }
}

function choice(value, allowed) {
  if (!allowed.includes(value)) throw new TypeError('Unsupported proposal value.');
}

/** Validate the experiment object against its immutable artifact, without coercion. */
export function validateExperimentProposal(proposal, artifact) {
  const p = jsonCopy(proposal);
  const base = jsonCopy(artifact);
  fields(p, ['version', 'pathway', 'base_artifact_id', 'status', 'reason', ...PATHWAYS]);
  choice(p.pathway, PATHWAYS);
  choice(p.status, ['supported', 'unsupported']);
  if (p.version !== 1 || typeof p.reason !== 'string' ||
      !base || typeof base.id !== 'string' || !base.id || p.base_artifact_id !== base.id ||
      p.pathway !== base.pathway) throw new TypeError('Proposal does not match its source artifact.');
  for (const path of PATHWAYS) {
    if ((p.status === 'unsupported' || path !== p.pathway) && p[path] !== null) {
      throw new TypeError('Only the supported matching pathway may have a payload.');
    }
  }
  if (p.status === 'unsupported') return p;
  const branch = p[p.pathway];
  if (p.pathway === 'music') {
    fields(branch, ['attack', 'notes', 'tempo',
      ...(branch && Object.hasOwn(branch, 'practice_target') ? ['practice_target'] : [])]);
    number(branch.attack, .02, .8);
    number(branch.tempo, 40, 180, true);
    if (!Array.isArray(branch.notes) || branch.notes.length < 2 || branch.notes.length > 16) {
      throw new RangeError('Music requires 2 to 16 notes.');
    }
    for (const note of branch.notes) {
      fields(note, ['midi', 'beats']);
      number(note.midi, 48, 84, true);
      number(note.beats, .25, 4);
    }
    if (branch.practice_target != null) {
      fields(branch.practice_target, ['exercise_id', 'quarter_bpm']);
      choice(branch.practice_target.exercise_id, [PRACTICE_EXERCISE]);
      number(branch.practice_target.quarter_bpm, 40, 80, true);
      if (!Array.isArray(base.source_refs) || !base.source_refs.some(ref => ref?.url === PRACTICE_SOURCE &&
          ((ref.locator === PRACTICE_LOCATOR && ref.source_kind === 'notation_exercise') ||
            ref.exercise_id === PRACTICE_EXERCISE))) {
        throw new TypeError('Practice target requires the bound Musicnotes exercise source and locator or exercise ID.');
      }
      const lab = base.state?.lab;
      if (!lab || ['attack', 'notes', 'tempo'].some(key => !sameJson(branch[key], lab[key]))) {
        throw new TypeError('Practice target must preserve frozen variation attack, notes, and tempo.');
      }
    }
  } else if (p.pathway === 'movement') {
    fields(branch, ['duration', 'distance', 'shape', 'compare_shape', 'view',
      ...(branch && Object.hasOwn(branch, 'boxing_params') ? ['boxing_params'] : [])]);
    number(branch.duration, 1, 4);
    number(branch.distance, .1, 1);
    choice(branch.shape, ['cubic', 'quintic']);
    choice(branch.compare_shape, ['cubic', 'quintic']);
    choice(branch.view, ['position', 'velocity', 'acceleration']);
    if (branch.boxing_params != null) {
      fields(branch.boxing_params, ['cue', 'gap']);
      number(branch.boxing_params.cue, .65, 1.65);
      number(branch.boxing_params.gap, 10, 22);
      const round = base.state?.lab?.boxing_round;
      if (!round || typeof round !== 'object' || Array.isArray(round)) {
        throw new TypeError('Boxing parameters require a boxing round in the source artifact.');
      }
    }
  } else {
    fields(branch, ['scenario', 'question', 'source_quote', 'source_ref_index',
      ...(branch && Object.hasOwn(branch, 'decision_scene') ? ['decision_scene'] : [])]);
    for (const key of ['scenario', 'question', 'source_quote']) {
      if (typeof branch[key] !== 'string') throw new TypeError('Ideas text must be a string.');
    }
    number(branch.source_ref_index, 0, Number.MAX_SAFE_INTEGER, true);
    const ref = base.source_refs?.[branch.source_ref_index];
    const sources = base.experiment_sources;
    const matches = Array.isArray(sources)
      ? sources.filter(source => source?.source_ref_index === branch.source_ref_index) : [];
    const source = matches[0];
    if (matches.length !== 1 || !ref || typeof ref.url !== 'string' || typeof ref.locator !== 'string' ||
        source.url !== ref.url || source.locator !== ref.locator ||
        typeof source.content !== 'string' || !branch.source_quote.trim() || !source.content.includes(branch.source_quote)) {
      throw new TypeError('Ideas quote must be literal text from the indexed source content.');
    }
    if (branch.decision_scene != null) {
      const scene = branch.decision_scene;
      fields(scene, ['kind', 'choices']);
      choice(scene.kind, ['shared_shelter']);
      if (!Array.isArray(scene.choices) || scene.choices.length !== 2) {
        throw new TypeError('Decision scene requires exactly two choices.');
      }
      for (const item of scene.choices) {
        fields(item, ['id', 'label', 'consequence', 'shelter']);
        choice(item.id, ['a', 'b']);
        choice(item.shelter, ['shared', 'self']);
        for (const [key, max] of [['label', 80], ['consequence', 240]]) {
          if (typeof item[key] !== 'string' || item[key].length < 1 || item[key].length > max) {
            throw new TypeError('Decision text is outside the allowed length.');
          }
        }
      }
      if (new Set(scene.choices.map(item => item.id)).size !== 2 ||
          new Set(scene.choices.map(item => item.shelter)).size !== 2) {
        throw new TypeError('Decision scene requires distinct a/b IDs and both shelter states.');
      }
    }
  }
  return p;
}

/** Return a preview state only. The caller owns explicit apply, playback, and undo. */
export function proposedLabState(proposal, artifact, currentState) {
  const p = validateExperimentProposal(proposal, artifact);
  if (p.status !== 'supported') throw new TypeError('Unsupported proposals cannot be applied.');
  const state = jsonCopy(currentState);
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('Lab state must be an object.');
  if (p.pathway === 'ideas') state.modelComparison = p.ideas;
  else if (p.pathway === 'movement') {
    const {boxing_params, ...physics} = p.movement;
    Object.assign(state, physics);
    if (boxing_params != null) {
      const round = state.boxing_round;
      if (!round || typeof round !== 'object' || Array.isArray(round) ||
          (round.params != null && (typeof round.params !== 'object' || Array.isArray(round.params)))) {
        throw new TypeError('Current state must retain a valid boxing round.');
      }
      round.params = {...round.params, ...boxing_params};
    }
  }
  else {
    const {practice_target, ...music} = p.music;
    Object.assign(state, music);
    if (practice_target != null) state.practice_target = practice_target;
  }
  return state;
}
