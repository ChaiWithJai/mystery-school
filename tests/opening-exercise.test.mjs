import test from 'node:test';
import assert from 'node:assert/strict';
import {openingFeedback,OPENING_EXERCISE} from '../public/piano-scene.js';
const take=(pitch,gap)=>({duration:gap+1,events:[{type:'on',midi:pitch,time:0},{type:'off',midi:pitch,time:.1},{type:'on',midi:pitch,time:gap},{type:'off',midi:pitch,time:gap+.1}]});
test('feedback uses actual learner pitch and timing without a mastery score',()=>{assert.equal(openingFeedback({events:[],duration:0}),'');assert.match(openingFeedback(take(76,1.5)),/E5, E5.*E6/);assert.match(openingFeedback(take(88,1)),/0.50 s more/);assert.match(openingFeedback(take(88,2)),/0.50 s less/);assert.doesNotMatch(openingFeedback(take(88,1.5)),/master|correct|score/i);});
test('opening is a bounded arrangement excerpt in the verified register',()=>{assert.equal(OPENING_EXERCISE.midi,88);assert.equal(OPENING_EXERCISE.onsets[1]-OPENING_EXERCISE.onsets[0],60/80*2);assert.equal(OPENING_EXERCISE.end,3.75);});
