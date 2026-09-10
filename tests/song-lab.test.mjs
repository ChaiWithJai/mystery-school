import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSongState } from '../public/song-lab.js';
import { proposedLabState } from '../public/experiment-proposal.js';

test('saved song retains actual performance separately from proposed phrase', () => {
  const practice = { duration: 2, events: [{type:'on',midi:64,time:.2},{type:'off',midi:64,time:1.7}] };
  const original = normalizeSongState({attack:.4,practice});
  const artifact = { id:'song-base',pathway:'music' };
  const proposal = { version:1,pathway:'music',base_artifact_id:artifact.id,status:'supported',reason:'Try an ending.',
    music:{attack:.4,tempo:100,notes:[{midi:64,beats:2},{midi:60,beats:4}]},movement:null,ideas:null };
  const after = normalizeSongState(proposedLabState(proposal,artifact,original));
  assert.deepEqual(after.practice,original.practice);
  assert.notDeepEqual(after.notes,original.notes);
  assert.deepEqual(normalizeSongState(JSON.parse(JSON.stringify(after))),after);
  after.practice.events[0].midi=60;
  assert.equal(original.practice.events[0].midi,64);
});

test('legacy music artifacts open without inventing a performed take', () => {
  const state = normalizeSongState({attack:.4});
  assert.deepEqual(state.practice.events,[]);
  assert.equal(state.practice.duration,0);
  assert.equal(state.notes.length,4);
});
