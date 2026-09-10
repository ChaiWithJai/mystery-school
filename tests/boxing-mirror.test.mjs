import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanMirrorState} from '../public/boxing-mirror.js';
test('mirror artifacts retain observations and estimated events, never raw frames',()=>{const s=cleanMirrorState({reflection:'I noticed my return',frames:[{private:true}],attempts:[{t:200,type:'JAB',hand:'L',power:99,landmarks:[1]},{t:NaN,type:'HOOK'}]});assert.equal(s.reflection,'I noticed my return');assert.deepEqual(s.attempts,[{t:200,type:'JAB',hand:'L',estimated:true}]);assert.equal('frames' in s,false);});
test('mirror state bounds event history and excludes invalid modes',()=>{const s=cleanMirrorState({sourceMode:'remote-upload',attempts:Array.from({length:100},(_,i)=>({t:i,type:'CROSS',hand:'R'}))});assert.equal(s.sourceMode,null);assert.equal(s.attempts.length,60);assert.equal(s.attempts[0].t,40);});
