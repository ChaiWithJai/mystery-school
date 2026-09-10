import { createLocalSoundtrack } from './local-soundtrack.js';

export const RUNAWAY_REFERENCE = Object.freeze({
  url: 'https://virtualpiano.net/music-sheet/runaway-kanye-west-2/',
  playerURL: 'https://virtualpiano.net/?song-post-28667',
  tempo: 160, transposition: 4, kind: 'virtual_piano_arrangement',
});
let active;
export function mountDemoSoundtrack(track = () => {}, {autoplay = true} = {}) {
  if (new URLSearchParams(location.search).get('soundtrack') === 'off') return {leavePiano(){},stop(){}};
  if (active) return active;
  const root = document.createElement('aside');
  root.className = 'demo-soundtrack';
  root.setAttribute('aria-label', 'Runaway soundtrack');
  root.innerHTML = `<style>
    .demo-soundtrack{position:fixed;right:24px;top:64px;z-index:100;max-width:356px;background:#12241ecc;color:#eee6cb;border:1px solid #c5ba8c55;border-radius:16px;font:12px/1.4 "Avenir Next",sans-serif}
    .demo-soundtrack [hidden]{display:none}
    .demo-soundtrack [data-reference]{display:block;padding:12px 0;color:inherit;text-decoration:none}
    .demo-soundtrack summary{cursor:pointer;padding:4px;list-style:none}
    .demo-soundtrack summary::-webkit-details-marker{display:none}
    .demo-soundtrack :focus-visible{outline:2px solid #ead6a7;outline-offset:4px}
    .demo-soundtrack footer{display:flex;align-items:center;gap:10px;padding:10px 12px}
    .demo-soundtrack button{background:none;color:inherit;border:1px solid #c5ba8c55;border-radius:18px;padding:6px 10px;font:inherit;cursor:pointer}
    .demo-soundtrack label{display:flex;align-items:center;gap:5px;flex:1}
    .demo-soundtrack p{margin:0;padding:8px 12px}
    .demo-soundtrack a{color:inherit}
    .demo-soundtrack details{padding:8px 12px;margin:0;border:0}
    .demo-soundtrack details[open]{width:330px}
    .demo-soundtrack.is-inline{position:static;max-width:none;border:0;background:transparent;display:flex;align-items:center;gap:12px;border-radius:0}
    .demo-soundtrack.is-inline>p,.demo-soundtrack.is-inline [data-play]{display:none!important}
    .demo-soundtrack.is-inline footer{padding:0;gap:12px}
    .demo-soundtrack.is-inline label{white-space:nowrap;font-size:12px}
    .demo-soundtrack.is-inline [data-stop]{display:none}
    .demo-soundtrack.is-inline[data-state=playing] [data-stop]{display:block}
    .piano-roll .demo-soundtrack details{position:static;background:transparent;padding:0;border:0;max-width:none;font-size:12px}
    .piano-roll .demo-soundtrack details[open]{position:absolute;top:52px;left:0;right:auto;z-index:150;background:#102b24;border:1px solid #c5ba8c55;border-radius:16px;padding:16px;width:320px;box-shadow:0 18px 60px #0006}
    .demo-soundtrack.is-carried{top:auto;bottom:24px;left:24px;right:auto;max-width:360px;border-radius:24px}
    .demo-soundtrack.is-carried>p,.demo-soundtrack.is-carried>details,.demo-soundtrack.is-carried [data-play]{display:none}
  </style><p role="status" hidden></p><footer hidden><button data-play>Replay opening</button><label><input type="checkbox" data-keep>Keep playing</label><button data-stop>Stop</button></footer><details><summary>Song reference + audio</summary><a data-reference target="_blank" rel="noopener noreferrer">Hear Runaway on Virtual Piano ↗</a><p>The linked arrangement has Auto Play. It opens separately; this app does not control its playback.</p><p>For a seven-second recording inside this demo, choose audio you have permission to use. It stays in this browser and is not uploaded.</p><input type="file" accept="audio/*" aria-label="Choose local soundtrack"></details>`;
  const drawer = document.querySelector('#drawer');
  (drawer || document.body).append(root);
  const q = selector => root.querySelector(selector);
  q('summary').textContent='Music settings';
  q('[data-stop]').textContent='Pause music';
  q('[data-reference]').href = RUNAWAY_REFERENCE.playerURL;
  let local = null, localURL = null, continuous = false, disposed = false;
  let playbackState = 'loading';
  const subscribers = new Set();
  const publish = state => {playbackState=state;for(const listener of subscribers)listener({state,ready:!!local,continuous});};
  const emit = (type, payload = {}) => track('soundtrack.' + type, {source_kind: local ? 'user_selected_local_audio' : RUNAWAY_REFERENCE.kind, ...payload, learner_attempt: false});
  const observer = new MutationObserver(() => { if (drawer?.classList.contains('hidden')) {if(continuous)document.body.append(root);else stop();} });
  if (drawer) observer.observe(drawer, {attributes: true, attributeFilter: ['class']});
  function stop() {
    if (disposed) return;
    disposed = true; observer.disconnect(); local?.dispose();
    if (localURL) URL.revokeObjectURL(localURL);
    root.remove(); active = null; emit('stop');
  }
  q('[data-reference]').onclick = () => emit('reference.open', {url: RUNAWAY_REFERENCE.playerURL, external_player: true});
  q('[data-play]').onclick = () => { void local?.play(); };
  q('[data-stop]').onclick = () => {continuous=false;q('[data-keep]').checked=false;local?.setContinuous(false);};
  q('[data-keep]').onchange = event => {continuous = event.target.checked; local?.setContinuous(continuous); emit('continuous', {enabled: continuous});};
  function loadRecording(url, playNow) {
    const status = q('[role=status]'); status.hidden = false;
    root.querySelector('audio')?.remove();
    const audio = new Audio(url); audio.preload='auto'; audio.hidden=true;root.append(audio);
    root.dataset.state = 'ready';status.textContent='Runaway / your local recording';
    local = createLocalSoundtrack(audio, {onState(state) {
      if (disposed) return;
      root.dataset.state = state;
      status.textContent = ({playing: continuous ? 'Runaway / playing across the demo' : 'Runaway / first seven seconds', 'opening-ended': 'Your turn. Press L.', ended: 'Recording finished.', blocked: 'Press Play opening to turn the sound on.', error: 'Choose your local Runaway recording in audio options.', paused: 'Paused.'})[state];
      emit(state, {continuous});
      publish(state);
    }});
    publish('ready');
    q('footer').hidden = false; q('details').open = false;
    if (playNow) {if (continuous) local.setContinuous(true); else void local.play();}
  }
  q('input[type=file]').onchange = event => {
    const file = event.target.files?.[0];
    if (!file || disposed) return;
    if (file.type && !file.type.startsWith('audio/')) return;
    local?.dispose(); if (localURL) URL.revokeObjectURL(localURL);
    localURL=URL.createObjectURL(file);loadRecording(localURL,true);
  };
  // A blob URL also supports seeking on the local server without HTTP Range support.
  void fetch('/audio/local/runaway.mp3').then(response=>{
    if(!response.ok)throw new Error('Local recording unavailable');
    return response.blob();
  }).then(blob=>{
    if(disposed||local)return;
    localURL=URL.createObjectURL(blob);loadRecording(localURL,autoplay);
  }).catch(()=>{
    if(disposed)return;
    q('[role=status]').hidden=false;q('[role=status]').textContent='Choose your local Runaway recording in audio options.';
    publish('unavailable');
  });
  q('[data-play]').textContent='Play opening';
  active = {get continuous(){return continuous;},get ready(){return !!local;},
    subscribe(listener){subscribers.add(listener);listener({state:playbackState,ready:!!local,continuous});return()=>subscribers.delete(listener);},
    mountInline(container){root.classList.remove('is-carried');root.classList.add('is-inline');container.append(root);},
    play(restart=true){if(!local){q('details').open=true;return Promise.reject(new Error('Choose your Runaway recording in Music settings.'));}return local.play(restart);},
    pause(){local?.pause();},leavePiano() {if (!continuous) stop();else {root.classList.remove('is-inline');root.classList.add('is-carried');(document.querySelector('#drawer')||document.body).append(root);}}, stop};
  return active;
}
