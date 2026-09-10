import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldShowOpening,initialPathway} from '../public/opening-route.js';

test('every explicit pathway bypasses the chooser in a fresh tab', () => {
  for(const path of ['music','movement','ideas']){
    assert.equal(shouldShowOpening(`?actor=agent_review&path=${path}`),false);
  }
});

test('root begins at piano while unknown pathways retain the three-world choice', () => {
  assert.equal(shouldShowOpening(''),false);
  assert.equal(initialPathway(''),'music');
  assert.equal(initialPathway('?actor=agent_review'),'music');
  assert.equal(shouldShowOpening('?path=unknown'),true);
  assert.equal(shouldShowOpening('?path='),true);
});

test('direct entry never replaces saved records, corrections, or forest tour',()=>{
  for(const query of ['?artifact=saved','?correct=job','?view=forest']){
    assert.equal(initialPathway(query),null);
    assert.equal(shouldShowOpening(query),false);
  }
  for(const path of ['music','movement','ideas'])assert.equal(initialPathway('?path='+path),path);
});

test('saved artifacts and previously dismissed entry retain their routing', () => {
  assert.equal(shouldShowOpening('?path=music&artifact=saved&experiment=job'),false);
  assert.equal(shouldShowOpening('?artifact=saved'),false);
  assert.equal(shouldShowOpening('',true),false);
});
