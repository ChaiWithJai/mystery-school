import test from 'node:test';
import assert from 'node:assert/strict';
import {savedExperimentContext} from '../public/learning-experiment.js';

test('saved writing context is frozen and excludes camera movement',()=>{
  const artifact={state:{question:'What next?',lab:{story_world:{learnerIntent:'Care',learnerStory:'I make room.',camera:{z:9}}}}};
  const shape={question:'What next?',story_writing:['Changed','Changed']};
  const frozen=savedExperimentContext(artifact,shape);
  assert.deepEqual(frozen.story_writing,['Care','I make room.']);
  assert.notDeepEqual(frozen,shape);
  artifact.state.lab.story_world.camera.z=3;
  assert.deepEqual(savedExperimentContext(artifact,shape),frozen);
  assert.deepEqual(savedExperimentContext({state:{question:'What next?',lab:{}}},shape).story_writing,['','']);
});
