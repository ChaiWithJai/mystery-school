import test from 'node:test';
import assert from 'node:assert/strict';
import {RUNAWAY_REFERENCE} from '../public/demo-soundtrack.js';
test('reference uses the user-selected sheet and its linked player', () => {
  assert.equal(RUNAWAY_REFERENCE.url, 'https://virtualpiano.net/music-sheet/runaway-kanye-west-2/');
  assert.equal(RUNAWAY_REFERENCE.playerURL, 'https://virtualpiano.net/?song-post-28667');
});
test('reference settings are distinct from the separate Musicnotes exercise', () => {
  assert.equal(RUNAWAY_REFERENCE.tempo, 160);
  assert.equal(RUNAWAY_REFERENCE.transposition, 4);
  assert.equal(Object.isFrozen(RUNAWAY_REFERENCE), true);
});
