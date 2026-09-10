import test from 'node:test';
import assert from 'node:assert/strict';
import {boxingLessonSources} from '../public/learning-paths.js';
import {BOXING_JOURNEY_LESSONS} from '../public/boxing-journey.js';

test('authored Attention can save without fabricating an external video',()=>{
  assert.deepEqual(boxingLessonSources('jai.attention'),[]);
});

test('video lessons retain their exact reviewed source and timestamp',()=>{
  for(const lesson of BOXING_JOURNEY_LESSONS.filter(lesson=>lesson.source)){
    const [source]=boxingLessonSources(lesson.id);
    assert.equal(source.url,lesson.source);
    assert.equal(source.locator,'Demonstration at '+lesson.evidenceTimestampSeconds+' seconds');
    assert.equal(source.source_kind,'reviewed_video_reference');
  }
});
