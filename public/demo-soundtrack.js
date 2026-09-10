export const RUNAWAY_VIDEO = 'VhEoCOWUtcU';
export function soundtrackRequest(continuous = false, start = 0) {
  return { videoId: RUNAWAY_VIDEO, startSeconds: Math.max(0, Number.isFinite(start) ? start : 0), ...(continuous ? {} : { endSeconds: 7 }) };
}

let apiPromise;
function youtubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => reject(new Error('Player did not load.')), 12000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      resolve(window.YT);
      previous?.();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timer); reject(new Error('Player unavailable.')); };
    document.head.append(script);
  }).catch(error => { apiPromise = null; throw error; });
  return apiPromise;
}

let active;
export function mountDemoSoundtrack(track = () => {}) {
  if (active) return active;
  const root = document.createElement('aside');
  root.className = 'demo-soundtrack';
  root.setAttribute('aria-label', 'Runaway soundtrack');
  root.innerHTML = `<style>
    .demo-soundtrack{position:fixed;right:24px;top:64px;width:356px;z-index:100;background:#12241e;color:#eee6cb;border:1px solid #c5ba8c55;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px #0005;font:12px/1.4 "Avenir Next",sans-serif}
    .demo-soundtrack iframe{display:block;width:356px;height:200px;border:0}
    .demo-soundtrack [hidden]{display:none}
    .demo-soundtrack footer{display:flex;align-items:center;gap:10px;padding:10px 12px}
    .demo-soundtrack button{background:none;color:inherit;border:1px solid #c5ba8c55;border-radius:18px;padding:6px 10px;font:inherit;cursor:pointer}
    .demo-soundtrack label{display:flex;align-items:center;gap:5px;flex:1}
    .demo-soundtrack p{margin:0;padding:8px 12px}
    .demo-soundtrack a{color:inherit}
  </style><div data-video></div><p role="status">Loading the seven-second opening...</p><footer><button data-play>Play opening</button><label><input type="checkbox" data-keep>Keep playing</label><button data-stop>Stop</button></footer><p data-fallback hidden><a href="https://www.youtube.com/watch?v=Bm5iA4Zupek" target="_blank" rel="noopener noreferrer">Open the official recording</a></p>`;
  (document.querySelector('#drawer') || document.body).append(root);
  root.querySelector('[data-fallback] a').href = `https://www.youtube.com/watch?v=${RUNAWAY_VIDEO}`;
  const q = selector => root.querySelector(selector);
  let player, disposed = false, ready = false, continuous = false;
  const drawer = document.querySelector('#drawer');
  const observer = new MutationObserver(() => {
    if (drawer?.classList.contains('hidden')) stop();
  });
  if (drawer) observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
  const status = text => { q('[role=status]').textContent = text; };
  const emit = (type, payload = {}) => track('soundtrack.' + type, { video_id: RUNAWAY_VIDEO, ...payload, learner_attempt: false });
  function stop() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    player?.destroy();
    root.remove();
    active = null;
    emit('stop');
  }
  function play() {
    if (!ready) return;
    q('[data-video]')?.removeAttribute('hidden');
    player.getIframe().hidden = false;
    player.loadVideoById(soundtrackRequest(continuous));
    status(continuous ? 'Runaway / playing across the demo' : 'Runaway / first seven seconds');
  }
  q('[data-play]').onclick = play;
  q('[data-stop]').onclick = stop;
  q('[data-keep]').onchange = event => {
    continuous = event.target.checked;
    if (!ready) return;
    if (continuous) {
      player.setVolume(25);
      player.getIframe().hidden = false;
      player.loadVideoById(soundtrackRequest(true, player.getCurrentTime()));
      status('Runaway / playing across the demo');
    } else {
      player.pauseVideo();
      status('Paused. Play the opening again when you want.');
    }
    emit('continuous', { enabled: continuous });
  };
  active = { leavePiano() { if (!continuous) stop(); }, stop };
  youtubeAPI().then(YT => {
    if (disposed) return;
    player = new YT.Player(q('[data-video]'), {
      width: 356, height: 200, videoId: RUNAWAY_VIDEO,
      host: 'https://www.youtube-nocookie.com',
      playerVars: { playsinline: 1, controls: 1, origin: location.origin, start: 0, end: 7 },
      events: {
        onReady(event) {
          if (disposed) return;
          ready = true;
          event.target.setVolume(continuous ? 25 : 65);
          play();
        },
        onAutoplayBlocked() { if (!disposed) { status('Press Play opening to turn the sound on.'); emit('autoplay_blocked'); } },
        onError(event) { if (!disposed) { root.dataset.state='error';status('YouTube blocked this recording here.'); q('[data-fallback]').hidden = false; q('[data-play]').hidden = true; q('[data-keep]').closest('label').hidden = true; player.getIframe().hidden = true; emit('error', { code: event.data }); } },
        onStateChange(event) {
          if (disposed) return;
          if (event.data === 1) { root.dataset.state='playing';status(continuous ? 'Runaway / playing across the demo' : 'Runaway / first seven seconds'); emit('playing', { continuous }); }
          if (event.data === 0) { status(continuous ? 'Recording finished.' : 'Your turn. Press L.'); player.getIframe().hidden = true; emit('ended', { continuous }); }
        }
      }
    });
  }).catch(() => { if (!disposed) { status('Player unavailable. Piano keys still work.'); q('[data-fallback]').hidden = false; emit('unavailable'); } });
  return active;
}
