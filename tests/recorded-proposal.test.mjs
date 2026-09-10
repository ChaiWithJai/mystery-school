import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateExperimentProposal, proposedLabState} from '../public/experiment-proposal.js';
import {normalizeSongState} from '../public/song-lab.js';

const fixture = JSON.parse(readFileSync(new URL('../public/fixtures/recorded-music-proposal.json', import.meta.url), 'utf8'));

test('recorded Astra music proposal preserves the opening and changes the ending', () => {
  const before = structuredClone(fixture.initial_state);
  const proposal = validateExperimentProposal(fixture.proposal, fixture.artifact);
  const result = normalizeSongState(proposedLabState(proposal, fixture.artifact, before));
  assert.deepEqual(result.notes.slice(0, 3), before.notes.slice(0, 3));
  assert.deepEqual(result.notes.slice(3), [{midi:64,beats:2},{midi:60,beats:4}]);
  assert.equal(result.tempo, before.tempo);
  assert.equal(result.attack, before.attack);
  assert.deepEqual(before, fixture.initial_state);
  assert.deepEqual(result.practice.events, []);
});

test('recorded proposal cannot overwrite a later performed take', () => {
  // A synthetic take tests preservation; it is not part of the recorded model input.
  const state = normalizeSongState({...fixture.initial_state, practice: {
    events: [{type:'on',midi:64,time:0},{type:'off',midi:64,time:1}], duration:1, reference:null
  }});
  const next = proposedLabState(fixture.proposal, fixture.artifact, state);
  assert.deepEqual(next.practice, state.practice);
  next.practice.events[0].midi = 60;
  assert.equal(state.practice.events[0].midi, 64);
});
