// The media clock, not time since mounting, controls the opening cutoff.
export function createLocalSoundtrack(audio, { onState = () => {}, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let continuous = false, disposed = false, timer = null, generation = 0;
  const clear = () => { if (timer !== null) cancel(timer); timer = null; };
  function boundary() {
    clear();
    if (disposed || continuous || audio.paused || audio.ended) return;
    const remaining = 7 - audio.currentTime;
    if (remaining <= 0) {
      audio.pause();
      audio.currentTime = 7;
      onState('opening-ended');
    } else {
      timer = schedule(boundary, remaining / (audio.playbackRate || 1) * 1000);
    }
  }
  const playing = () => { if (!disposed) { onState('playing'); boundary(); } };
  const ended = () => { clear(); if (!disposed) onState('ended'); };
  const failed = () => { clear(); if (!disposed) onState('error'); };
  const listeners = { playing, timeupdate: boundary, seeked: boundary, ratechange: boundary, pause: clear, ended, error: failed };
  for (const [event, listener] of Object.entries(listeners)) audio.addEventListener(event, listener);
  async function play(restart = true) {
    if (disposed) return;
    const token = ++generation;
    if (restart || audio.ended) audio.currentTime = 0;
    audio.volume = continuous ? .25 : .65;
    try { await audio.play(); }
    catch (error) {
      if (!disposed && token === generation) onState(error.name === 'NotAllowedError' ? 'blocked' : 'error');
    }
    if (disposed) audio.pause();
  }
  return {
    play,
    pause() { if (!disposed) { generation++; clear(); audio.pause(); onState('paused'); } },
    setContinuous(value) {
      if (disposed) return;
      continuous = Boolean(value);
      clear();
      if (continuous) void play(false);
      else { generation++; audio.pause(); onState('paused'); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      clear();
      audio.pause();
      for (const [event, listener] of Object.entries(listeners)) audio.removeEventListener(event, listener);
      audio.removeAttribute('src');
      audio.load();
    }
  };
}
