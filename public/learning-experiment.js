import { validateExperimentProposal, proposedLabState } from './experiment-proposal.js';

const ACTIVE = new Set(['queued', 'running', 'pending', 'cancel_requested', 'cancelling']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const MOVEMENT_SETTINGS = ['duration', 'distance', 'shape', 'compare_shape', 'view'];
export function describeExperimentValue(key, value) {
  if (value === null || value === undefined) return 'None yet';
  if (key === 'notes') return value.map(note => {
    const name = ['C', 'C sharp', 'D', 'E flat', 'E', 'F', 'F sharp', 'G', 'A flat', 'A', 'B flat', 'B'][note.midi % 12];
    return `${name}${Math.floor(note.midi / 12) - 1} for ${note.beats} ${note.beats === 1 ? 'beat' : 'beats'}`;
  }).join(', then ');
  if (key === 'tempo') return `${value} beats per minute`;
  if (key === 'attack') return `${value} seconds to full volume`;
  if (key === 'duration') return `${value} seconds`;
  if (key === 'distance') return `${value} metres`;
  if (key === 'modelComparison') return `Source: "${value.source_quote}". Situation: ${value.scenario} Question: ${value.question}`;
  return typeof value === 'object' ? 'Saved experiment details' : String(value);
}
export function experimentDefinition(pathway, state) {
  if (pathway === 'ideas') {
    const { helpOpen, helpSeen, sourceOpened, ...content } = state;
    return structuredClone(content);
  }
  return pathway === 'movement' ? Object.fromEntries(MOVEMENT_SETTINGS.map(key => [key, state[key]])) : structuredClone(state);
}
function restoreDefinition(pathway, target, current) {
  if (pathway === 'ideas') return { ...current, ...experimentDefinition(pathway, target) };
  if (pathway !== 'movement') return structuredClone(target);
  return { ...current, ...experimentDefinition(pathway, target), time: Math.min(current.time || 0, target.duration), playing: false };
}

// Requests keep their immutable base while the learner continues using the lab.
export function mountLearningExperiment(container, { api, sessionId, actorKind, pathway,
  getState, setState, save, track, getQuestion, getContext = () => ({ question: getQuestion().trim() }) }) {
  let disposed = false, busy = false, currentJob = null, timer = null, revision = 0;
  let candidate = null, before = null, applied = null, baseState = null;
  let candidateJobId = null, appliedJobId = null;
  let requestContext = null;
  const root = document.createElement('section');
  root.className = 'learning-experiment';
  root.innerHTML = `<h3>Try your next idea</h3>
    <p>Astra can propose a change to this experiment. Keep exploring while it works.</p>
    <label><input type="checkbox" data-consent> Send my question, this saved experiment and its source excerpts to Astra.</label>
    <button type="button" class="primary" data-request>Ask Astra for a change</button>
    <button type="button" class="text-button" data-cancel hidden>Cancel request</button>
    <p role="status" data-progress></p>
    <section data-preview hidden><h4>Proposed change</h4><p data-reason></p>
      <dl data-difference></dl><p>Your experiment has not changed. Apply only if you want to try this.</p>
      <button type="button" class="primary" data-apply>Try this change</button>
      <button type="button" class="text-button" data-dismiss>Leave it aside</button></section>
    <button type="button" class="text-button" data-undo hidden>Undo this change</button>
    <a data-trace hidden target="_blank" rel="noopener">Inspect Astra's response and trace</a>`;
  container.append(root);
  const q = selector => root.querySelector(selector);
  const status = text => { if (!disposed) q('[data-progress]').textContent = text; };
  const emit = (type, payload = {}) => track('learning.experiment.' + type,
    { pathway, actor_kind: actorKind, job_id: currentJob?.id || null, ...payload });
  function available() {
    if (disposed) return;
    q('[data-request]').disabled = busy || !q('[data-consent]').checked;
    q('[data-cancel]').hidden = !busy || !currentJob;
  }
  q('[data-consent]').onchange = available;
  function difference(oldState, nextState) {
    const list = q('[data-difference]');
    list.replaceChildren();
    for (const key of Object.keys(nextState)) {
      if (same(oldState[key], nextState[key])) continue;
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = ({notes:'Your phrase',attack:'How each note begins',tempo:'Pace',modelComparison:'A situation to think through',compare_shape:'Reference movement',shape:'Your movement',view:'What the graph shows'})[key] || key.replace(/_/g, ' ');
      detail.textContent = `Before: ${describeExperimentValue(key, oldState[key])}. After: ${describeExperimentValue(key, nextState[key])}.`;
      list.append(term, detail);
    }
  }
  function receive(job, artifact, capturedState) {
    let result = job.result;
    if (typeof result === 'string') result = JSON.parse(result);
    if (!result?.experiment) throw Error('This response contains a story, not a playable change. Nothing was applied.');
    const groundedArtifact = { ...artifact, experiment_sources: job.input?.experiment_sources || [] };
    const proposal = validateExperimentProposal(result.experiment, groundedArtifact);
    q('[data-trace]').href = '/review.html?sample=' + encodeURIComponent(job.id);
    q('[data-trace]').hidden = false;
    if (proposal.status === 'unsupported') {
      status('Astra cannot make this change with the current controls: ' + proposal.reason);
      emit('unsupported', { base_artifact_id: artifact.id, reason: proposal.reason });
      return;
    }
    candidate = proposedLabState(proposal, groundedArtifact, capturedState);
    candidateJobId = job.id;
    baseState = structuredClone(capturedState);
    q('[data-reason]').textContent = proposal.reason;
    difference(baseState, candidate);
    q('[data-preview]').hidden = false;
    status(same(getContext(), requestContext) ? 'A change is ready to review. Your current experiment is untouched.' : 'Your question or context changed. This proposal answers the earlier question and cannot be applied.');
    emit('preview', { base_artifact_id: artifact.id, proposal, before: baseState, candidate });
  }
  async function inspect(id, artifact, capturedState, token) {
    try {
      const job = await api('/api/jobs/' + encodeURIComponent(id));
      if (disposed || token !== revision) return;
      currentJob = job;
      if (ACTIVE.has(job.status)) {
        status('Astra is considering your question. You can still play and edit above.');
        timer = setTimeout(() => inspect(id, artifact, capturedState, token), 1800);
        return;
      }
      busy = false; available();
      if (!['completed', 'succeeded', 'success'].includes(job.status)) {
        status('Request ' + job.status + '. Your experiment is unchanged.');
        return;
      }
      receive(job, artifact, capturedState);
    } catch (error) {
      if (!disposed && token === revision) {
        busy = false; available(); status(error.message + ' No change was applied.');
      }
    }
  }
  q('[data-request]').onclick = async () => {
    if (busy || !q('[data-consent]').checked) return;
    const question = getQuestion().trim();
    if (!question) return status('Write the question you want to try above.');
    busy = true; currentJob = null; candidate = null;
    requestContext = structuredClone(getContext());
    q('[data-consent]').checked = false;
    q('[data-preview]').hidden = true;
    const token = ++revision;
    available(); status('Keeping the starting version for this request...');
    try {
      const artifact = await save();
      if (disposed || token !== revision) return;
      if (!same(getContext(), requestContext)) throw Error('Your question or context changed while saving. Review it and confirm again.');
      const capturedState = structuredClone(artifact.state.lab);
      const request = { session_id: sessionId, actor_kind: actorKind, world: 'questions',
        question, premise: 'Propose a bounded, playable change for this saved experiment. Preserve my words and sources. Explain unsupported requests honestly.',
        learning_artifact_id: artifact.id, reference_ids: [], reflection_ids: [] };
      await emit('confirm', { request, confirmation: 'explicit_selection' });
      if (disposed || token !== revision) return;
      if (!same(getContext(), requestContext)) throw Error('Your question or context changed before sending. Review it and confirm again.');
      const job = await api('/api/project', request);
      if (disposed || token !== revision) return;
      currentJob = job; available();
      inspect(job.id, artifact, capturedState, token);
    } catch (error) {
      if (!disposed && token === revision) { busy = false; available(); status(error.message); }
    }
  };
  q('[data-cancel]').onclick = async () => {
    try { await api('/api/jobs/' + encodeURIComponent(currentJob.id) + '/cancel', {}); status('Cancellation requested. Your experiment stays available.'); }
    catch (error) { status(error.message); }
  };
  q('[data-apply]').onclick = () => {
    if (!candidate) return;
    const current = getState();
    if (!same(getContext(), requestContext)) return status('Your question or context changed. Ask again from your current intention.');
    if (!same(experimentDefinition(pathway, current), experimentDefinition(pathway, baseState))) return status('You changed the experiment since this request. Keep those edits. Ask again from the new version.');
    const previous = structuredClone(current);
    try { setState(restoreDefinition(pathway, candidate, current)); }
    catch (error) { return status('Could not apply this change: ' + error.message); }
    before = previous;
    appliedJobId = candidateJobId;
    applied = structuredClone(getState());
    q('[data-preview]').hidden = true; q('[data-undo]').hidden = false;
    status('Change applied. Play with it, undo it, or keep a version in your notebook.');
    emit('apply', { job_id: appliedJobId, before, after: applied });
  };
  q('[data-undo]').onclick = () => {
    if (!before) return;
    if (!same(experimentDefinition(pathway, getState()), experimentDefinition(pathway, applied))) return status('You edited this version after applying it. Undo will not discard those edits.');
    try { setState(restoreDefinition(pathway, before, getState())); }
    catch (error) { return status('Could not restore this change: ' + error.message); }
    emit('undo', { job_id: appliedJobId, before: applied, after: getState() });
    before = null; applied = null; q('[data-undo]').hidden = true;
    q('[data-preview]').hidden = !candidate;
    status('Your previous experiment is restored. Saved versions remain unchanged.');
  };
  q('[data-dismiss]').onclick = () => {
    candidate = null; q('[data-preview]').hidden = true;
    emit('dismiss'); status('Left aside. Your experiment is unchanged.');
  };
  available();
  const cleanup = () => { disposed = true; revision++; clearTimeout(timer); root.remove(); };
  cleanup.contextChanged = () => { q('[data-consent]').checked = false; available(); };
  cleanup.resume = async (jobId, artifactId) => {
    if (busy || disposed) return;
    const token = ++revision;
    busy = true; available(); status('Opening the recorded proposal. No model request is being made.');
    try {
      const job = await api('/api/jobs/' + encodeURIComponent(jobId));
      if (disposed || token !== revision) return;
      if (job.input?.learning_artifact_id !== artifactId) throw Error('This proposal belongs to a different saved experiment.');
      const artifact = await api('/api/artifacts/' + encodeURIComponent(artifactId));
      if (disposed || token !== revision) return;
      if (artifact.pathway !== pathway || artifact.state.question.trim() !== getQuestion().trim()) throw Error('Open the original saved question before reviewing this proposal.');
      if (!same(experimentDefinition(pathway, artifact.state.lab), experimentDefinition(pathway, getState()))) throw Error('The experiment differs from the saved proposal starting point.');
      if (!['completed', 'succeeded', 'success'].includes(job.status)) throw Error('This recorded proposal is not complete. Inspect its trace for status.');
      currentJob = job;
      requestContext = structuredClone(getContext());
      receive(job, artifact, artifact.state.lab);
      emit('resume', { base_artifact_id: artifactId, replay_kind: 'stored_output', model_called: false });
    } catch (error) { status(error.message); }
    finally { if (!disposed && token === revision) { busy = false; available(); } }
  };
  return cleanup;
}
