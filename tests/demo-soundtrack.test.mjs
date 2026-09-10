import test from 'node:test';
import assert from 'node:assert/strict';
import { soundtrackRequest, RUNAWAY_VIDEO } from '../public/demo-soundtrack.js';

test('opening uses the official embed bounded at seven seconds', () => {
  assert.deepEqual(soundtrackRequest(), {videoId: RUNAWAY_VIDEO, startSeconds: 0, endSeconds: 7});
});
test('continuous playback removes the cutoff and keeps current position', () => {
  assert.deepEqual(soundtrackRequest(true, 6.5), {videoId: RUNAWAY_VIDEO, startSeconds: 6.5});
  assert.equal(soundtrackRequest(true, NaN).startSeconds, 0);
  assert.equal(soundtrackRequest(true, -4).startSeconds, 0);
});
