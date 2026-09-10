import { mountMusicLab, normalizeMusicState } from './music-lab.js';
import { mountPianoPractice, normalizePianoState } from './piano-practice.js';
import { normalizeOpeningTarget } from './runaway-opening.js';

export function normalizeSongState(value = {}) {
  return { ...normalizeMusicState(value), practice: normalizePianoState(value.practice || {}), practice_target: normalizeOpeningTarget(value.practice_target) };
}

export function mountSongLab(container, { initialState = {}, onChange = () => {}, onEvent = () => {} } = {}) {
  let state = normalizeSongState(initialState), disposed = false, applying = false;
  const doc = container.ownerDocument;
  if (!doc.getElementById('piano-practice-styles')) {
    const link = doc.createElement('link');
    link.id = 'piano-practice-styles'; link.rel = 'stylesheet'; link.href = '/piano-practice.css';
    doc.head.append(link);
  }
  const root = doc.createElement('section'); root.className = 'song-lab';
  const pianoHost = doc.createElement('div'); pianoHost.dataset.songInstrument = '';
  const advanced = doc.createElement('details'); advanced.className = 'song-lab__variations';
  const summary = doc.createElement('summary'); summary.textContent = 'Explore a variation';
  const variationHost = doc.createElement('div');
  advanced.append(summary, variationHost); root.append(pianoHost, advanced); container.append(root);
  const publish = () => { if (!disposed && !applying) onChange(structuredClone(state)); };
  const piano = mountPianoPractice(pianoHost, {
    autoCapture: true,
    initialState: state.practice,
    onChange: practice => { state.practice = structuredClone(practice); publish(); },
    onEvent: (type, payload) => onEvent('performance.' + type, payload)
  });
  const variation = mountMusicLab(variationHost, {
    initialState: state,
    onChange: value => { state = { ...value, practice: state.practice, practice_target: state.practice_target }; publish(); },
    onEvent
  });
  const cleanup = () => {
    if (disposed) return;
    disposed = true; piano(); variation(); root.remove();
  };
  cleanup.getState = () => structuredClone(state);
  cleanup.demonstrate = value => piano.demonstrate(value);
  cleanup.getPlaybackClock = () => disposed ? null : piano.getPlaybackClock();
  cleanup.setState = value => {
    if (disposed) throw Error('This instrument is closed.');
    const next = normalizeSongState(value);
    applying = true;
    try {
      if (JSON.stringify(next.practice) !== JSON.stringify(normalizePianoState(state.practice))) piano.setState(next.practice);
      if (JSON.stringify(normalizeMusicState(next)) !== JSON.stringify(normalizeMusicState(state))) variation.setState(next);
      state = next;
    }
    finally { applying = false; }
    publish();
  };
  publish();
  return cleanup;
}
