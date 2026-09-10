import test from 'node:test';
import assert from 'node:assert/strict';
import {pianoGeometry} from '../public/piano-practice.js';
import {pianoScenePoint} from '../public/piano-scene.js';

test('every playable pitch stays inside the scene, including E6 and C7', () => {
  for (const {midi} of pianoGeometry()) {
    const {x,y}=pianoScenePoint(midi);
    assert.ok(x>=45 && x<=1055, `pitch ${midi} remains inside the width`);
    assert.ok(y>=40 && y<=280, `pitch ${midi} remains inside the height`);
  }
  assert.equal(pianoScenePoint(88).y,80);
});
