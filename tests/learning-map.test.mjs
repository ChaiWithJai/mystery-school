import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLearningArtifacts, learningArtifactLabel } from '../public/world.js';

test('only the latest six unique saved IDs in the active pathway are selected',()=>{
  const rows=Array.from({length:9},(_,i)=>({id:`a${i}`,pathway:'movement',created_at:`2026-09-10T12:00:0${i}Z`}));
  const input=[...rows].reverse();input.push({...rows[8]}, {id:'other',pathway:'music'},null,{pathway:'movement'});
  assert.deepEqual(selectLearningArtifacts(input,'movement').map(r=>r.id),['a3','a4','a5','a6','a7','a8']);
  assert.equal(input.length,13);
});
test('unknown timestamps preserve input order and no active path has no artifacts',()=>{
  const rows=[{id:'a',pathway:'ideas'},{id:'b',pathway:'ideas'}];
  assert.deepEqual(selectLearningArtifacts(rows,'ideas'),rows);
  assert.deepEqual(selectLearningArtifacts(rows,null),[]);
  assert.deepEqual(selectLearningArtifacts(null,'ideas'),[]);
});
test('stage and explicit QA/staged provenance are visible without achievement claims',()=>{
  assert.equal(learningArtifactLabel({stage:'attempt',actor_kind:'user_action'}),'Attempt');
  assert.equal(learningArtifactLabel({stage:'revision',actor_kind:'agent_review'}),'Revision / agent QA');
  assert.equal(learningArtifactLabel({stage:'sharing_response',actor_kind:'staged_peer_response'}),'Staged response');
  assert.equal(learningArtifactLabel({stage:'sharing_response',state:{explanation:'AGENT QA TEST, not a learner'}}),'Staged response / agent QA');
  assert.equal(learningArtifactLabel({stage:'new_question',note:'AGENT QA TEST: restore check'}),'New question / agent QA');
  assert.equal(learningArtifactLabel({stage:'unknown'}),'Saved version');
});
