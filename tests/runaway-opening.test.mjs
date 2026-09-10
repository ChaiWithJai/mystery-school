import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNAWAY_OPENING_SOURCE, createOpeningDemoTake, analyzeOpening, normalizeOpeningTarget, openingTempoLabel } from '../public/runaway-opening.js';
import { normalizePianoState } from '../public/piano-practice.js';

test('target normalization is exact, bounded and detached with null legacy default', () => {
  assert.equal(normalizeOpeningTarget(),null);
  assert.equal(normalizeOpeningTarget(null),null);
  const target={exercise_id:RUNAWAY_OPENING_SOURCE.id,quarter_bpm:60};
  assert.deepEqual(normalizeOpeningTarget(target),target);
  assert.notEqual(normalizeOpeningTarget(target),target);
  for(const bpm of [40,80]) assert.equal(normalizeOpeningTarget({...target,quarter_bpm:bpm}).quarter_bpm,bpm);
  for(const value of [{},[],false,{...target,extra:1},{...target,exercise_id:'other'},...[39,81,60.5,'60',NaN,Infinity,null].map(quarter_bpm=>({...target,quarter_bpm}))]) {
    assert.throws(()=>normalizeOpeningTarget(value));
    assert.throws(()=>createOpeningDemoTake(value));
    assert.throws(()=>analyzeOpening({},value));
  }
});

test('60 BPM adapts only time; demo and comparison share the two-second interval', () => {
  const target={exercise_id:RUNAWAY_OPENING_SOURCE.id,quarter_bpm:60};
  const demo=createOpeningDemoTake(target);
  assert.deepEqual(demo.events.map(e=>e.time),[1,3,3,5]);
  assert.ok(demo.events.every(e=>e.midi===88));assert.equal(demo.duration,5);
  assert.equal(analyzeOpening(demo,target).interval_difference_seconds,0);
  assert.equal(analyzeOpening(demo,target).target_interval_seconds,2);
  assert.equal(analyzeOpening(demo,target).practice_adaptation,true);
  assert.equal(analyzeOpening(demo).interval_difference_seconds,.5);
  assert.equal(openingTempoLabel(target),'60 BPM / slower practice adaptation');
  assert.equal(openingTempoLabel(),'80 BPM / published notation');
  assert.equal(RUNAWAY_OPENING_SOURCE.quarter_bpm,80);
});

test('frozen metadata identifies the arrangement and limits, not learner authorship', () => {
  assert.ok(Object.isFrozen(RUNAWAY_OPENING_SOURCE));
  assert.equal(RUNAWAY_OPENING_SOURCE.product_id, 'MN0103069');
  assert.equal(RUNAWAY_OPENING_SOURCE.provenance, 'authored_notation_derived_exercise');
  assert.equal(RUNAWAY_OPENING_SOURCE.quarter_bpm, 80);
  assert.equal(RUNAWAY_OPENING_SOURCE.target_midi, 88);
  assert.match(RUNAWAY_OPENING_SOURCE.limits, /not verified original-recording timing/);
  assert.throws(() => { RUNAWAY_OPENING_SOURCE.target_midi = 76; }, TypeError);
});

test('demo has exact two strikes and is normalized, serializable and fresh each call', () => {
  const take = createOpeningDemoTake();
  assert.equal(take.duration, 3.75);
  assert.deepEqual(take.events, [
    {type:'on',midi:88,time:.75}, {type:'off',midi:88,time:2.25},
    {type:'on',midi:88,time:2.25}, {type:'off',midi:88,time:3.75},
  ]);
  assert.deepEqual(normalizePianoState(take), take);
  assert.deepEqual(JSON.parse(JSON.stringify(take)), take);
  take.events[0].midi = 76; take.reference.title = 'Changed';
  assert.equal(createOpeningDemoTake().events[0].midi, 88);
  assert.equal(createOpeningDemoTake().reference.title, RUNAWAY_OPENING_SOURCE.title);
});

test('empty and single-strike takes are insufficient, not failures or zero scores', () => {
  for (const take of [{}, {duration:1,events:[{type:'on',midi:88,time:.2}]}]) {
    const result = analyzeOpening(take);
    assert.equal(result.status, 'insufficient');
    assert.equal(result.pitches, null);
    assert.equal(result.interval_difference_seconds, null);
    assert.ok(!('score' in result));
  }
});

test('first-onset alignment ignores delay after Record and leaves the take untouched', () => {
  const take = createOpeningDemoTake();
  const shifted = { ...take, duration: take.duration + 20, events: take.events.map(event => ({...event,time:event.time + 20})) };
  const before = JSON.stringify(shifted);
  assert.deepEqual(analyzeOpening(shifted), analyzeOpening(take));
  assert.equal(JSON.stringify(shifted), before);
  assert.equal(analyzeOpening(take).interval_difference_seconds, 0);
});

test('pitch differences and signed interval differences are separate observations', () => {
  const take = { duration:4, events:[{type:'on',midi:76,time:1},{type:'off',midi:76,time:1.1},{type:'on',midi:89,time:3}] };
  const result = analyzeOpening(take);
  assert.deepEqual(result.pitches.map(p => p.difference_semitones), [-12,1]);
  assert.deepEqual(result.pitches.map(p => p.matches_target), [false,false]);
  assert.equal(result.interval_seconds, 2);
  assert.equal(result.interval_difference_seconds, .5);
  take.events[2].time = 2;
  assert.equal(analyzeOpening(take).interval_difference_seconds, -.5);
});

test('only first two onsets are compared; later notes and release timing are not graded', () => {
  const take = createOpeningDemoTake();
  take.events[1].time = .8;
  take.events.push({type:'on',midi:60,time:3.75});
  const result = analyzeOpening(take);
  assert.equal(result.status, 'compared');
  assert.equal(result.ignored_note_on_count, 1);
  assert.equal(result.interval_difference_seconds, 0);
  assert.ok(result.pitches.every(p => p.matches_target));
  assert.ok(!('mastery' in result));
});

test('invalid input is rejected without mutation rather than reported as learner failure', () => {
  const bad = {duration:1,events:[{type:'off',midi:88,time:0}]};
  const before = JSON.stringify(bad);
  assert.throws(() => analyzeOpening(bad));
  assert.equal(JSON.stringify(bad), before);
});
