import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalSoundtrack } from '../public/local-soundtrack.js';

class Media extends EventTarget {
  currentTime = 0; paused = true; ended = false; playbackRate = 1;
  play() { this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  removeAttribute(name) { this.removed = name; }
  load() { this.loaded = true; }
}
function fixture() {
  const media = new Media(), states = [], pending = new Map(); let id = 0;
  const controller = createLocalSoundtrack(media, {onState: state => states.push(state), schedule: (fn, ms) => { pending.set(++id, {fn, ms}); return id; }, cancel: key => pending.delete(key)});
  return {media, states, pending, controller};
}
test('seven-second cutoff follows media time and pauses at the boundary', async () => {
  const {media, controller, pending, states} = fixture();
  await controller.play();
  assert.equal([...pending.values()][0].ms, 7000);
  media.currentTime = 6;
  media.dispatchEvent(new Event('timeupdate'));
  assert.equal([...pending.values()][0].ms, 1000);
  media.currentTime = 7.1;
  media.dispatchEvent(new Event('timeupdate'));
  assert.equal(media.currentTime, 7);
  assert.equal(media.paused, true);
  assert.equal(states.at(-1), 'opening-ended');
  assert.equal(pending.size, 0);
  controller.dispose();
});
test('keep playing preserves position, lowers volume, and removes cutoff', async () => {
  const {media, controller, pending} = fixture();
  await controller.play(); media.currentTime = 5.5;
  controller.setContinuous(true);
  assert.equal(media.currentTime, 5.5);
  assert.equal(media.volume, .25);
  media.currentTime = 10; media.dispatchEvent(new Event('timeupdate'));
  assert.equal(media.paused, false);
  assert.equal(pending.size, 0);
  controller.setContinuous(false);
  assert.equal(media.paused, true);
  await controller.play();
  assert.equal(media.currentTime, 0);
  assert.equal(media.volume, .65);
  controller.dispose();
});
test('disposal cancels clocks, detaches callbacks, and releases the media source', async () => {
  const {media, controller, pending, states} = fixture();
  await controller.play(); controller.dispose();
  const before = states.length;
  media.dispatchEvent(new Event('playing'));
  assert.equal(states.length, before);
  assert.equal(pending.size, 0);
  assert.equal(media.removed, 'src');
  assert.equal(media.loaded, true);
  assert.equal(media.paused, true);
});
test('presenter pause and resume preserve recording position and the remaining cutoff', async () => {
  const {media, controller, pending} = fixture();
  await controller.play();media.currentTime=3.25;controller.pause();
  assert.equal(media.paused,true);assert.equal(pending.size,0);
  await controller.play(false);
  assert.equal(media.currentTime,3.25);assert.equal(media.paused,false);
  assert.equal([...pending.values()][0].ms,3750);
  controller.dispose();
});
test('autoplay refusal is reported, not mistaken for audible playback', async () => {
  const {media, controller, states} = fixture();
  media.play = () => Promise.reject(Object.assign(new Error('blocked'), {name:'NotAllowedError'}));
  await controller.play();
  assert.deepEqual(states, ['blocked']);
  controller.dispose();
});
