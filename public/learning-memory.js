import { normalizeReflection } from './real-world-reflection.js';

const textOrNull = value => typeof value === 'string' && value.trim() ? value : null;

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** A saved self-report, not proof of technique, observation accuracy, or authorship. */
export function createBoxingMemory(savedArtifact) {
  if (!savedArtifact || savedArtifact.pathway !== 'movement' || !textOrNull(savedArtifact.id)) {
    throw new TypeError('A saved movement artifact with an ID is required.');
  }
  const mirror = savedArtifact.state?.lab?.boxing_mirror;
  if (!textOrNull(mirror?.reflection)) return null;
  const actor = textOrNull(savedArtifact.actor_kind);
  const observationKind = actor === 'user_action' ? 'learner_reported' : actor === 'agent_review' ? 'agent_review' : 'unknown';
  const observationLabel = observationKind === 'learner_reported' ? 'Learner-reported observation (not independently verified)' : observationKind === 'agent_review' ? 'Agent test reflection (not human learning evidence)' : 'Reflection with unverified authorship';
  const source_refs = (Array.isArray(savedArtifact.source_refs) ? savedArtifact.source_refs : [])
    .filter(ref => ref && typeof ref === 'object' && !Array.isArray(ref))
    .map(ref => Object.fromEntries(['id', 'label', 'url', 'locator', 'source_kind']
      .filter(key => typeof ref[key] === 'string').map(key => [key, ref[key]])))
    .filter(ref => Object.keys(ref).length);
  const estimateCount = (Array.isArray(mirror.attempts) ? mirror.attempts : [])
    .filter(attempt => attempt && Number.isFinite(attempt.t)
      && ['JAB', 'CROSS', 'HOOK', 'UPPERCUT'].includes(attempt.type)).length;
  return freeze({
    version: 1,
    kind: 'boxing_reflection',
    pathway: 'movement',
    source_artifact_id: savedArtifact.id,
    source_trace_id: textOrNull(savedArtifact.trace_id),
    actor_kind: actor,
    lessonId: textOrNull(mirror.lessonId),
    observation: {kind: observationKind, label: observationLabel, text: mirror.reflection},
    detector_estimates: {label: 'Detector estimates, not verified punches or technique', count: estimateCount},
    source_refs,
  });
}

/** Carry an explicitly saved ideas journey into the world without completing it. */
export function createIdeasMemory(savedArtifact) {
  if (!savedArtifact || savedArtifact.pathway !== 'ideas' || !textOrNull(savedArtifact.id)) {
    throw new TypeError('A saved ideas artifact with an ID is required.');
  }
  const reflection = normalizeReflection(savedArtifact.state?.lab?.real_world_reflection);
  if (!['action', 'observation', 'interpretation', 'revisedBelief', 'question'].some(key => reflection[key].trim())) return null;
  const actor = textOrNull(savedArtifact.actor_kind);
  const kind = actor === 'user_action' ? 'learner_reported' : actor === 'agent_review' ? 'agent_review' : 'unknown';
  const label = kind === 'agent_review' ? 'Agent test journey (not human learning evidence)'
    : kind === 'unknown' ? 'Journey with unverified authorship'
      : reflection.status === 'reported_done' ? 'Learner-reported journey (not independently verified)' : 'Learner journey draft or plan (not a completed action)';
  const source_refs = (Array.isArray(savedArtifact.source_refs) ? savedArtifact.source_refs : [])
    .filter(ref => ref && typeof ref === 'object' && !Array.isArray(ref))
    .map(ref => Object.fromEntries(['id', 'label', 'url', 'locator', 'source_kind']
      .filter(key => typeof ref[key] === 'string').map(key => [key, ref[key]])))
    .filter(ref => Object.keys(ref).length);
  return freeze({version: 1, kind: 'ideas_reflection', pathway: 'ideas',
    source_artifact_id: savedArtifact.id, source_trace_id: textOrNull(savedArtifact.trace_id), actor_kind: actor,
    observation: {kind, label, text: reflection.observation}, reflection, source_refs});
}

/** First deposit wins for a saved artifact. Retain the most recent 60 deposits. */
export function appendMemory(existing, record) {
  if (!Array.isArray(existing)) throw new TypeError('Existing memories must be an array.');
  if (!record || !textOrNull(record.source_artifact_id)) throw new TypeError('A memory with a source artifact ID is required.');
  const seen = new Set();
  const combined = [...existing, record].filter(item => {
    const id = textOrNull(item?.source_artifact_id);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  // JSON detaches unrelated serializable records without changing their fields.
  return freeze(JSON.parse(JSON.stringify(combined.slice(-60))));
}
