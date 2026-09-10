import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSongState } from '../public/song-lab.js';
import { proposedLabState } from '../public/experiment-proposal.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { normalizeOpeningTarget } from '../public/runaway-opening.js';
import { normalizePianoState } from '../public/piano-practice.js';

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
  assert.equal(state.practice_target,null);
});

test('song target survives normalization without changing actual performance', () => {
  const target={exercise_id:'runaway-mn0103069-opening-two-strikes',quarter_bpm:60};
  const state=normalizeSongState({practice_target:target,practice:{duration:3,events:[{type:'on',midi:88,time:1},{type:'off',midi:88,time:2}]}});
  assert.deepEqual(state.practice_target,target);
  assert.deepEqual(normalizeSongState(JSON.parse(JSON.stringify(state))),state);
  assert.throws(()=>normalizeSongState({...state,practice_target:{...target,quarter_bpm:90}}));
});

test('actual wrapper target-only apply and undo never reset either instrument', () => {
  const mounts=[];
  const element=()=>({dataset:{},append(){},remove(){}});
  const doc={createElement:element,getElementById:()=>true};
  const container={ownerDocument:doc,append(){}};
  const mount=(_host,options)=>{
    const adapter=()=>{};adapter.calls=[];
    adapter.setState=value=>{adapter.calls.push(value);options.onChange(value);};
    adapter.demonstrate=()=>{};
    adapter.options=options;mounts.push(adapter);return adapter;
  };
  const source=readFileSync(new URL('../public/song-lab.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('export function mountSongLab')).replace('export function','function');
  const run=vm.runInNewContext(`${body}; mountSongLab`,{normalizeSongState,normalizePianoState,normalizeOpeningTarget,normalizeMusicState:value=>({attack:value.attack,tempo:value.tempo,notes:value.notes}),mountPianoPractice:mount,mountMusicLab:mount,structuredClone});
  const changes=[];const api=run(container,{onChange:value=>changes.push(value)});
  const original=api.getState();
  const practice={duration:2,events:[{type:'on',midi:88,time:.2},{type:'off',midi:88,time:1.7}],reference:null};
  mounts[0].options.onChange(practice);
  api.setState({...api.getState(),practice_target:{exercise_id:'runaway-mn0103069-opening-two-strikes',quarter_bpm:60}});
  assert.equal(mounts[0].calls.length,0);assert.equal(mounts[1].calls.length,0);
  assert.deepEqual(api.getState().practice,practice);
  assert.equal(changes.at(-1).practice_target.quarter_bpm,60);
  mounts[1].options.onChange({attack:.3,tempo:100,notes:original.notes});
  assert.equal(api.getState().practice_target.quarter_bpm,60);
  api.setState({...api.getState(),practice_target:null});
  assert.equal(mounts[0].calls.length,0);assert.equal(mounts[1].calls.length,0);
  const before=api.getState();
  assert.throws(()=>api.setState({...before,practice_target:{exercise_id:'bad',quarter_bpm:60}}));
  assert.deepEqual(api.getState(),before);api();
});
