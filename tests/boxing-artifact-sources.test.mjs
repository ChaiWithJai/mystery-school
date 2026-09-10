import test from 'node:test';
import assert from 'node:assert/strict';
import {boxingLessonSources} from '../public/learning-paths.js';
import {BOXING_JOURNEY_LESSONS} from '../public/boxing-journey.js';

test('authored Attention can save without fabricating an external video',()=>{
  assert.deepEqual(boxingLessonSources('jai.attention'),[]);
});

test('video lessons retain their exact reviewed source and timestamp',()=>{
  for(const lesson of BOXING_JOURNEY_LESSONS.filter(lesson=>lesson.source&&!lesson.targetSources)){
    const [source]=boxingLessonSources(lesson.id);
    assert.equal(source.url,lesson.source);
    assert.equal(source.locator,'Demonstration at '+lesson.evidenceTimestampSeconds+' seconds');
    assert.equal(source.source_kind,'reviewed_video_reference');
  }
});

test('the combined left-hand drill preserves both reviewed source timestamps',()=>{
  const sources=boxingLessonSources('jai.left-hook-uppercut');
  assert.equal(sources.length,2);
  assert.deepEqual(sources.map(s=>s.locator),['Demonstration at 2419 seconds','Demonstration at 1824 seconds']);
  assert.ok(sources[0].url.includes('2419s'));
  assert.ok(sources[1].url.includes('1824s'));
});
