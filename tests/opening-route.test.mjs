import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldShowOpening} from '../public/opening-route.js';

test('every explicit pathway bypasses the chooser in a fresh tab', () => {
  for(const path of ['music','movement','ideas']){
    assert.equal(shouldShowOpening(`?actor=agent_review&path=${path}`),false);
  }
});

test('fresh root and unknown pathways retain the three-world choice', () => {
  assert.equal(shouldShowOpening(''),true);
  assert.equal(shouldShowOpening('?path=unknown'),true);
  assert.equal(shouldShowOpening('?path='),true);
});

test('saved artifacts and previously dismissed entry retain their routing', () => {
  assert.equal(shouldShowOpening('?path=music&artifact=saved&experiment=job'),false);
  assert.equal(shouldShowOpening('?artifact=saved'),false);
  assert.equal(shouldShowOpening('',true),false);
});
