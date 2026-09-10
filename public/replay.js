import {mountMusicLab} from './music-lab.js';
import {mountSongLab} from './song-lab.js';
import {mountPianoScene} from './piano-scene.js';
import {mountBoxingGame} from './boxing-game.js';
import {mountIdeasLab} from './ideas-lab.js';
import {mountLearningExperiment} from './learning-experiment.js';

const events = [];
let instrument, controller, scene;
const choices = {
  music: ['recorded-foreground-music.json', 'Try a slower opening.', 'music'],
  movement: ['recorded-foreground-boxing.json', 'Try a different exchange.', 'movement'],
  ideas: ['recorded-foreground-ideas.json', 'Try another choice.', 'ideas'],
  phrase: ['recorded-music-proposal.json', 'Hear the proposed ending.', 'music']
};
const selected = new URLSearchParams(location.search).get('path') || 'music';
const choice = choices[selected];
const track = (type, payload) => {
  events.push({type, payload, replay_kind:'stored_output', model_called:false});
  document.querySelector('#events').textContent = JSON.stringify(events.slice(-20), null, 2);
};

try {
  if (!choice) throw Error('Choose Piano, Boxing, Story, or Phrase above.');
  const [filename, title, pathway] = choice;
  document.querySelector('h1').textContent = title;
  document.body.dataset.pathway = selected;
  document.querySelector(`[data-path="${selected}"]`).setAttribute('aria-current','page');
  const response = await fetch('/fixtures/' + filename);
  if (!response.ok) throw Error('The recorded fixture could not be loaded.');
  const fixture = await response.json();
  const question = fixture.artifact.state?.question || 'Keep the first three notes. Replace the ending with a descending phrase and a longer final note.';
  const artifact = {...fixture.artifact, state:{...fixture.artifact.state, lab:fixture.initial_state, question}};
  // This local envelope reuses the exact captured proposal. It is not a new backend job.
  const job = {id:fixture.provenance.job_id, status:'succeeded',
    input:{learning_artifact_id:artifact.id,experiment_sources:fixture.experiment_sources || artifact.experiment_sources || []}, result:{experiment:fixture.proposal}};
  let state = structuredClone(fixture.initial_state);
  const host = document.querySelector('#instrument');
  host.setAttribute('aria-label', title);
  const changed = value => {state = structuredClone(value); scene?.render();};
  if (selected === 'movement') {
    const game = mountBoxingGame(host, {initialState:state.boxing_round,
      getSettings:() => structuredClone(state),
      onChange:value => {state.boxing_round = structuredClone(value);}, onEvent:track});
    instrument = () => game.dispose();
    instrument.setState = value => {state = structuredClone(value); game.setState(state.boxing_round);};
  } else {
    const mount = selected === 'music' ? mountSongLab : selected === 'ideas' ? mountIdeasLab : mountMusicLab;
    instrument = mount(host, {initialState:state, onChange:changed,
      onEvent:(type,payload) => {track(type,payload); scene?.event(type,payload);}});
    if (selected === 'music') {
      scene = mountPianoScene(host,instrument,track);
      host.querySelector('.universe-next')?.remove();
    }
  }
  document.querySelectorAll('#instrument details').forEach(details => {details.open = false;});
  controller = mountLearningExperiment(document.querySelector('#proposal'), {
    api:async (route, payload) => {
      if (payload !== undefined) throw Error('Recorded replay cannot send model requests.');
      if (route === '/api/jobs/' + job.id) return structuredClone(job);
      if (route === '/api/artifacts/' + artifact.id) return structuredClone(artifact);
      throw Error('Only the bundled recorded proposal is available here.');
    },
    sessionId:'local-recorded-replay', actorKind:'agent_review', pathway,
    getState:() => structuredClone(state), setState:value => instrument.setState(value),
    getContext:() => ({question, explanation:artifact.state.explanation || '', source_refs:artifact.source_refs || [],
      reference_draft:[state.youtubeUrl || '',state.youtubeTimestamp || '',state.youtubeNote || '']}),
    getQuestion:() => question, save:async () => {throw Error('Use the school to save a new version.');}, track
  });
  const root = document.querySelector('.learning-experiment');
  root.querySelector('h3').textContent = 'Recorded proposal';
  root.querySelector('p').textContent = 'Captured model output. No request will be sent.';
  root.querySelector('[data-consent]').closest('label').hidden = true;
  root.querySelector('[data-request]').hidden = true;
  await controller.resume(job.id, artifact.id);
  const trace = root.querySelector('[data-trace]');
  trace.href = '/fixtures/' + filename;
  trace.textContent = 'Inspect the bundled output and provenance';
  document.querySelector('#provenance').textContent = JSON.stringify(fixture.provenance, null, 2);
} catch (error) {
  const notice = document.querySelector('#error');
  notice.hidden = false; notice.textContent = error.message;
}
window.addEventListener('pagehide', event => {
  // A cached page keeps its live adapters for Back navigation.
  if (event.persisted) return;
  controller?.(); scene?.dispose(); instrument?.();
});
