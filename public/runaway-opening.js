import { normalizePianoState, performanceNotes } from './piano-practice.js';

export const RUNAWAY_OPENING_SOURCE = Object.freeze({
  id: 'runaway-mn0103069-opening-two-strikes',
  title: 'Runaway: opening two strikes',
  url: 'https://www.musicnotes.com/sheetmusic/kanye-west/runaway/MN0103069',
  product_id: 'MN0103069',
  locator: 'Original E-major arrangement, page 1, first two right-hand strikes including the tied continuation',
  provenance: 'authored_notation_derived_exercise',
  attribution: 'Runaway by Kanye West; Musicnotes piano/vocal/chords arrangement',
  target_midi: 88,
  target_pitch: 'E6',
  quarter_bpm: 80,
  onset_interval_seconds: 1.5,
  duration_seconds: 3.75,
  limits: 'Notation-derived exercise, not verified original-recording timing. Not a learner attempt, full song, or evidence of mastery.',
});

export function normalizeOpeningTarget(value = null) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 2 || !Object.hasOwn(value, 'exercise_id') || !Object.hasOwn(value, 'quarter_bpm') || value.exercise_id !== RUNAWAY_OPENING_SOURCE.id ||
      !Number.isInteger(value.quarter_bpm) || value.quarter_bpm < 40 || value.quarter_bpm > 80) {
    throw new TypeError('Use the verified opening exercise and an integer tempo from 40 to 80 BPM.');
  }
  return { exercise_id: value.exercise_id, quarter_bpm: value.quarter_bpm };
}

export function openingTempoLabel(target = null) {
  const bpm = normalizeOpeningTarget(target)?.quarter_bpm ?? 80;
  return `${bpm} BPM / ${bpm === 80 ? 'published notation' : 'slower practice adaptation'}`;
}

// Keep demonstrations outside learner recordings. The take uses only the piano
// adapter's supported fields; its author/provenance belongs to the caller's UI.
export function createOpeningDemoTake(target = null) {
  const bpm = normalizeOpeningTarget(target)?.quarter_bpm ?? 80;
  const beat = 60 / bpm;
  return normalizePianoState({
    duration: 5 * beat,
    reference: { title: RUNAWAY_OPENING_SOURCE.title, url: RUNAWAY_OPENING_SOURCE.url },
    events: [
      { type: 'on', midi: 88, time: beat },
      { type: 'off', midi: 88, time: 3 * beat },
      { type: 'on', midi: 88, time: 3 * beat },
      { type: 'off', midi: 88, time: 5 * beat },
    ],
  });
}

export const OPENING_PRESENTER_SOURCE = Object.freeze({
  provenance: 'authored_practice_repetition',
  source_id: RUNAWAY_OPENING_SOURCE.id,
  duration_seconds: 7,
  limits: 'Two-strike exercise repeated at 80 BPM for presentation, not a seven-second song transcription or original recording.',
});

export function createOpeningPresenterTake(offset = 0) {
  if (!Number.isFinite(offset) || offset < 0 || offset >= 7) throw new RangeError('Presenter offset must be within the seven-second opening.');
  const original = createOpeningDemoTake();
  const take = normalizePianoState({
    duration: 7,
    reference: { title: 'Authored repetition of the opening two-strike exercise', url: RUNAWAY_OPENING_SOURCE.url },
    events: [...original.events, ...original.events.map(event => ({ ...event, time: event.time + 3 }))],
  });
  if (offset === 0) return take;
  return normalizePianoState({ ...take, duration: 7 - offset,
    events: performanceNotes(take).filter(note => note.end > offset).flatMap(note => [
      { type: 'on', midi: note.midi, time: Math.max(0, note.start - offset) },
      { type: 'off', midi: note.midi, time: note.end - offset },
    ]),
  });
}

export function analyzeOpening(take, target = null) {
  const bpm = normalizeOpeningTarget(target)?.quarter_bpm ?? 80;
  const targetInterval = 120 / bpm;
  const state = normalizePianoState(take);
  const onsets = state.events.filter(event => event.type === 'on');
  const base = {
    source_id: RUNAWAY_OPENING_SOURCE.id,
    comparison_basis: 'notation_derived_exercise',
    quarter_bpm: bpm,
    practice_adaptation: bpm !== 80,
    alignment: 'first_note_on',
    observed_note_on_count: onsets.length,
    ignored_note_on_count: Math.max(0, onsets.length - 2),
    target_midi: RUNAWAY_OPENING_SOURCE.target_midi,
    target_interval_seconds: targetInterval,
  };
  if (onsets.length < 2) {
    return { ...base, status: 'insufficient', pitches: null, interval_seconds: null, interval_difference_seconds: null };
  }
  const interval = onsets[1].time - onsets[0].time;
  return {
    ...base,
    status: 'compared',
    pitches: onsets.slice(0, 2).map((event, index) => ({
      strike: index + 1,
      actual_midi: event.midi,
      target_midi: RUNAWAY_OPENING_SOURCE.target_midi,
      matches_target: event.midi === RUNAWAY_OPENING_SOURCE.target_midi,
      difference_semitones: event.midi - RUNAWAY_OPENING_SOURCE.target_midi,
    })),
    interval_seconds: interval,
    // Signed difference: positive means farther apart, negative means closer.
    interval_difference_seconds: interval - targetInterval,
  };
}
