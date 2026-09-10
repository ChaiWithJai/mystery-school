import {mountMusicLab} from './music-lab.js';
import {mountLearningExperiment} from './learning-experiment.js';

const events = [];
let instrument, controller;
const track = (type, payload) => {
  events.push({type, payload, replay_kind:'stored_output', model_called:false});
  document.querySelector('#events').textContent = JSON.stringify(events.slice(-20), null, 2);
};

try {
  const response = await fetch('/fixtures/recorded-music-proposal.json');
  if (!response.ok) throw Error('The recorded fixture could not be loaded.');
  const fixture = await response.json();
  const question = 'Keep the first three notes. Replace the ending with a descending phrase and a longer final note.';
  const artifact = {...fixture.artifact, state:{lab:fixture.initial_state, question}};
  // This local envelope reuses the exact captured proposal. It is not a new backend job.
  const job = {id:fixture.provenance.job_id, status:'succeeded',
    input:{learning_artifact_id:artifact.id}, result:{experiment:fixture.proposal}};
  let state = structuredClone(fixture.initial_state);
  instrument = mountMusicLab(document.querySelector('#instrument'), {
    initialState:state, onChange:value => {state = structuredClone(value);}, onEvent:track
  });
  controller = mountLearningExperiment(document.querySelector('#proposal'), {
    api:async (route, payload) => {
      if (payload !== undefined) throw Error('Recorded replay cannot send model requests.');
      if (route === '/api/jobs/' + job.id) return structuredClone(job);
      if (route === '/api/artifacts/' + artifact.id) return structuredClone(artifact);
      throw Error('Only the bundled recorded proposal is available here.');
    },
    sessionId:'local-recorded-replay', actorKind:'agent_review', pathway:'music',
    getState:() => structuredClone(state), setState:value => instrument.setState(value),
    getQuestion:() => question, save:async () => {throw Error('Use the school to save a new version.');}, track
  });
  const root = document.querySelector('.learning-experiment');
  root.querySelector('h3').textContent = 'Recorded proposal';
  root.querySelector('p').textContent = 'Captured model output. No request will be sent.';
  root.querySelector('[data-consent]').closest('label').hidden = true;
  root.querySelector('[data-request]').hidden = true;
  await controller.resume(job.id, artifact.id);
  const trace = root.querySelector('[data-trace]');
  trace.href = '/fixtures/recorded-music-proposal.json';
  trace.textContent = 'Inspect the bundled output and provenance';
  document.querySelector('#provenance').textContent = JSON.stringify(fixture.provenance, null, 2);
} catch (error) {
  const notice = document.querySelector('#error');
  notice.hidden = false; notice.textContent = error.message;
}
window.addEventListener('pagehide', () => {controller?.(); instrument?.();}, {once:true});
