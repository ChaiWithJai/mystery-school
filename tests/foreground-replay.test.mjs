import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateExperimentProposal, proposedLabState} from '../public/experiment-proposal.js';

for (const name of ['music','boxing','ideas']) {
  test(`captured foreground ${name} validates with its frozen context`, () => {
    const fixture = JSON.parse(readFileSync(new URL(`../public/fixtures/recorded-foreground-${name}.json`,import.meta.url),'utf8'));
    const original = JSON.stringify(fixture);
    const artifact = {...fixture.artifact,experiment_sources:fixture.experiment_sources || fixture.artifact.experiment_sources || []};
    const proposal = validateExperimentProposal(fixture.proposal,artifact);
    const next = proposedLabState(proposal,artifact,fixture.initial_state);
    assert.equal(fixture.provenance.actor_kind,'agent_review');
    assert.equal(fixture.provenance.cost_usd,null);
    assert.deepEqual(fixture.initial_state,artifact.state.lab);
    if(name==='music') {
      assert.equal(next.practice_target.quarter_bpm,60);
      assert.deepEqual(next.practice,fixture.initial_state.practice);
    } else if(name==='boxing') {
      assert.deepEqual(next.boxing_round.params,{cue:1.5,gap:18});
      assert.deepEqual(next.boxing_round.attempts,fixture.initial_state.boxing_round.attempts);
    } else {
      assert.equal(next.modelComparison.decision_scene.choices.length,2);
      assert.equal(next.interpretation,fixture.initial_state.interpretation);
      assert.throws(()=>validateExperimentProposal(fixture.proposal,{...artifact,experiment_sources:[]}));
    }
    assert.equal(JSON.stringify(fixture),original);
  });
}
