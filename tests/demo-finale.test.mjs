import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_BEATS,demoBeatAt,finaleMarkup} from '../public/demo-finale.js';
test('presenter cut is continuous, sixty seconds, and reserves final ten for architecture',()=>{
  assert.equal(DEMO_BEATS[0].start,0);assert.equal(DEMO_BEATS.at(-1).end,60);
  DEMO_BEATS.slice(1).forEach((beat,i)=>assert.equal(beat.start,DEMO_BEATS[i].end));
  assert.equal(demoBeatAt(0).id,'music');assert.equal(demoBeatAt(49.99).id,'ideas');assert.equal(demoBeatAt(50).id,'architecture');assert.equal(demoBeatAt(60).id,'architecture');
});
test('closing keeps Jai values and separates builder coordination from runtime',()=>{
  const values=finaleMarkup('jai');for(const word of ['Courage.','Passion.','Imagination.'])assert.ok(values.includes(word));
  const architecture=finaleMarkup('architecture');for(const name of ['Astra','Bonsai','Buzz','MLflow','Python','Browser'])assert.ok(architecture.includes(name));
  assert.ok(architecture.includes('configured local runtime'));
});
test('teacher framing preserves human care rather than claiming an AI teacher',()=>{
  assert.ok(finaleMarkup('teachers').includes('A CHATBOT IS NOT A TEACHER'));
  assert.ok(finaleMarkup('jai').includes('the student loves.'));
  assert.ok(finaleMarkup('jai').includes('We learn together.'));
});
