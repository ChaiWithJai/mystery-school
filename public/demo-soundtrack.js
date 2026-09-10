import { createLocalSoundtrack } from './local-soundtrack.js';

export const RUNAWAY_REFERENCE = Object.freeze({
  url: 'https://virtualpiano.net/music-sheet/runaway-kanye-west-2/',
  playerURL: 'https://virtualpiano.net/?song-post-28667',
  tempo: 160, transposition: 4, kind: 'virtual_piano_arrangement',
});
let active;
export function mountDemoSoundtrack(track = () => {}) {
  if (active) return active;
  const root = document.createElement('aside');
  root.className = 'demo-soundtrack';
  root.setAttribute('aria-label', 'Runaway soundtrack');
  root.innerHTML = `<style>
    .demo-soundtrack{position:fixed;right:24px;top:64px;z-index:100;max-width:356px;background:#12241ecc;color:#eee6cb;border:1px solid #c5ba8c55;border-radius:16px;font:12px/1.4 "Avenir Next",sans-serif}
    .demo-soundtrack [hidden]{display:none}
    .demo-soundtrack>a{display:block;padding:12px 16px;color:inherit;text-decoration:none}
    .demo-soundtrack footer{display:flex;align-items:center;gap:10px;padding:10px 12px}
    .demo-soundtrack button{background:none;color:inherit;border:1px solid #c5ba8c55;border-radius:18px;padding:6px 10px;font:inherit;cursor:pointer}
    .demo-soundtrack label{display:flex;align-items:center;gap:5px;flex:1}
    .demo-soundtrack p{margin:0;padding:8px 12px}
    .demo-soundtrack a{color:inherit}
    .demo-soundtrack details{padding:8px 12px}
    .demo-soundtrack details[open]{width:330px}
  </style><a data-reference target="_blank" rel="noopener noreferrer">Hear Runaway on Virtual Piano ↗</a><p role="status" hidden></p><footer hidden><button data-play>Replay opening</button><label><input type="checkbox" data-keep>Keep playing</label><button data-stop>Stop</button></footer><details><summary>Audio options</summary><p>The linked arrangement has Auto Play. It opens separately; this app does not control its playback.</p><p>For a seven-second opening inside this demo, choose an audio recording you have permission to use. It stays in this browser and is not uploaded.</p><input type="file" accept="audio/*" aria-label="Choose local soundtrack"></details>`;
  const drawer = document.querySelector('#drawer');
  (drawer || document.body).append(root);
  const q = selector => root.querySelector(selector);
  q('[data-reference]').href = RUNAWAY_REFERENCE.playerURL;
  let local = null, localURL = null, continuous = false, disposed = false;
  const emit = (type, payload = {}) => track('soundtrack.' + type, {source_kind: local ? 'user_selected_local_audio' : RUNAWAY_REFERENCE.kind, ...payload, learner_attempt: false});
  const observer = new MutationObserver(() => { if (drawer?.classList.contains('hidden')) stop(); });
  if (drawer) observer.observe(drawer, {attributes: true, attributeFilter: ['class']});
  function stop() {
    if (disposed) return;
    disposed = true; observer.disconnect(); local?.dispose();
    if (localURL) URL.revokeObjectURL(localURL);
    root.remove(); active = null; emit('stop');
  }
  q('[data-reference]').onclick = () => emit('reference.open', {url: RUNAWAY_REFERENCE.playerURL, external_player: true});
  q('[data-play]').onclick = () => { void local?.play(); };
  q('[data-stop]').onclick = stop;
  q('[data-keep]').onchange = event => {continuous = event.target.checked; local?.setContinuous(continuous); emit('continuous', {enabled: continuous});};
  q('input[type=file]').onchange = event => {
    const file = event.target.files?.[0];
    if (!file || disposed) return;
    const status = q('[role=status]'); status.hidden = false;
    if (file.type && !file.type.startsWith('audio/')) {status.textContent = 'Choose an audio recording.'; return;}
    local?.dispose(); if (localURL) URL.revokeObjectURL(localURL);
    localURL = URL.createObjectURL(file); root.dataset.state = 'loading';
    local = createLocalSoundtrack(new Audio(localURL), {onState(state) {
      if (disposed) return;
      root.dataset.state = state;
      status.textContent = ({playing: continuous ? 'Local audio / playing across the demo' : 'Local audio / first seven seconds', 'opening-ended': 'Your turn. Press L.', ended: 'Recording finished.', blocked: 'Press Replay opening to turn the sound on.', error: 'This audio file could not play. Choose another file.', paused: 'Paused.'})[state];
      emit(state, {continuous});
    }});
    q('footer').hidden = false; q('details').open = false;
    if (continuous) local.setContinuous(true); else void local.play();
  };
  active = {leavePiano() {if (!continuous) stop();}, stop};
  return active;
}
