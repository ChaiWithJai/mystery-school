import { normalizePianoState } from './piano-practice.js';

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

// Keep demonstrations outside learner recordings. The take uses only the piano
// adapter's supported fields; its author/provenance belongs to the caller's UI.
export function createOpeningDemoTake() {
  return normalizePianoState({
    duration: RUNAWAY_OPENING_SOURCE.duration_seconds,
    reference: { title: RUNAWAY_OPENING_SOURCE.title, url: RUNAWAY_OPENING_SOURCE.url },
    events: [
      { type: 'on', midi: 88, time: .75 },
      { type: 'off', midi: 88, time: 2.25 },
      { type: 'on', midi: 88, time: 2.25 },
      { type: 'off', midi: 88, time: 3.75 },
    ],
  });
}

export function analyzeOpening(take) {
  const state = normalizePianoState(take);
  const onsets = state.events.filter(event => event.type === 'on');
  const base = {
    source_id: RUNAWAY_OPENING_SOURCE.id,
    comparison_basis: 'notation_derived_exercise',
    alignment: 'first_note_on',
    observed_note_on_count: onsets.length,
    ignored_note_on_count: Math.max(0, onsets.length - 2),
    target_midi: RUNAWAY_OPENING_SOURCE.target_midi,
    target_interval_seconds: RUNAWAY_OPENING_SOURCE.onset_interval_seconds,
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
    interval_difference_seconds: interval - RUNAWAY_OPENING_SOURCE.onset_interval_seconds,
  };
}
