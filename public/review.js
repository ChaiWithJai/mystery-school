function suggestionDecision(suggestion, status, declaration, decidedAt) {
  if (suggestion.status !== 'pending') throw new Error('This suggestion has already been decided.');
  if (!['accepted', 'dismissed'].includes(status)) throw new Error('Choose accept or dismiss.');
  if (!['human', 'agent_review', 'unspecified'].includes(declaration.actor_kind)) throw new Error('Declare the decision actor.');
  const producer = typeof declaration.producer === 'string' ? declaration.producer.trim() : '';
  if (!producer || producer.length > 200) throw new Error('Enter a producer of 1 to 200 characters.');
  if (typeof decidedAt !== 'string' || !Number.isFinite(Date.parse(decidedAt)) || new Date(decidedAt).toISOString() !== decidedAt) throw new Error('Decision timestamp must be ISO UTC.');
  if (status === 'accepted' && !suggestion.note?.trim()) throw new Error('A suggestion needs note text before acceptance.');
  return {...suggestion, status, decision: {actor_kind: declaration.actor_kind, producer, decided_at: decidedAt}};
}

(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const storageKey = 'astral-school.review.v1';
  const state = { samples: [], annotations: [], patterns: [], suggestions: [], graph: { nodes: [], clusters: [] }, app: {}, active: null, view: 'content', queue: [], draft: null, selected: new Set(), errors: {}, loading: true, syncing: false, refreshing: false, lastSignature: '' };
  let saveTimer, layoutFrame, storageFailed = false, mutationVersion = 0;
  const expandedMessages = new Map();
  const id = () => globalThis.crypto?.randomUUID?.() || `review-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let sessionId;
  try {
    sessionId = localStorage.getItem('astral.session') || id();
    localStorage.setItem('astral.session', sessionId);
    const backup = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (backup && Array.isArray(backup.queue)) {
      state.queue = backup.queue.filter(item => item && ['annotation', 'delete', 'suggestion'].includes(item.type));
      state.annotations = Array.isArray(backup.annotations) ? backup.annotations : [];
      state.draft = backup.draft || null;
    }
  } catch { storageFailed = true; sessionId = id(); }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function button(text, action, className = 'quiet') {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  }

  function notice(key, message, error = false) {
    let box = $$('[data-notice]').find(node => node.dataset.notice === key);
    if (!message) { box?.remove(); return; }
    if (!box) { box = el('div', 'notice'); box.dataset.notice = key; $('#notices').append(box); }
    box.className = `notice${error ? ' error' : ''}`;
    box.replaceChildren(el('p', '', message), button('Dismiss', () => box.remove()));
  }

  async function api(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.status === 204 ? null : await response.json();
    } finally { clearTimeout(timeout); }
  }

  function track(type, payload = {}) {
    api('/api/events', { session_id: sessionId, type: `review.${type}`, payload }).catch(() => {
      notice('events', 'Action tracing is unavailable. Your annotation save status is shown separately.', true);
    });
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, updated_at: new Date().toISOString(), annotations: state.annotations, queue: state.queue, draft: state.draft }));
      storageFailed = false;
    } catch { storageFailed = true; notice('storage', 'This browser could not store a local backup. Export a backup to preserve any unsynced notes.', true); }
    updateSaveStatus();
  }

  function updateSaveStatus() {
    const target = $('#save-status');
    const failed = Boolean(state.errors.save || state.errors.annotations);
    target.dataset.state = failed || storageFailed ? 'error' : state.queue.length ? 'pending' : 'saved';
    target.textContent = state.syncing ? 'Saving notes...' : state.queue.length ? `${state.queue.length} change${state.queue.length === 1 ? '' : 's'} ${storageFailed ? 'unsaved' : 'backed up locally'}` : state.loading ? 'Connecting...' : failed ? 'Saved state unavailable' : storageFailed ? 'Local backup unavailable' : 'All notes saved';
    $('#recovery').hidden = !state.draft || $('#note-editor').open;
  }

  function enqueue(operation) {
    mutationVersion++;
    operation.revision = id();
    const key = operation.type === 'annotation' ? operation.annotation.id : operation.id;
    state.queue = state.queue.filter(item => !(item.type === operation.type && (item.annotation?.id || item.id) === key));
    if (operation.type === 'delete') state.queue = state.queue.filter(item => item.annotation?.id !== operation.id);
    state.queue.push(operation);
    persist();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 500);
  }

  function overlayPending(annotations, suggestions) {
    const notes = new Map(annotations.map(note => [note.id, note]));
    const proposals = new Map(suggestions.map(item => [item.id, item]));
    for (const operation of state.queue) {
      if (operation.type === 'annotation') notes.set(operation.annotation.id, operation.annotation);
      if (operation.type === 'delete') notes.delete(operation.id);
      if (operation.type === 'suggestion' && proposals.has(operation.id)) proposals.set(operation.id, { ...proposals.get(operation.id), status: operation.status, ...(operation.decision ? {decision: operation.decision} : {}) });
    }
    return { annotations: [...notes.values()], suggestions: [...proposals.values()] };
  }

  async function flush() {
    if (state.syncing || !state.queue.length) return;
    state.syncing = true;
    updateSaveStatus();
    try {
      while (state.queue.length) {
        const operation = state.queue[0];
        if (operation.type === 'annotation') await api('/api/annotations', { annotation: operation.annotation });
        if (operation.type === 'delete') await api('/api/annotations', { delete_id: operation.id });
        if (operation.type === 'suggestion') {
          const latest = asList(await api('/api/suggestions'), 'suggestions');
          if (!latest.some(item => item.id === operation.id)) throw new Error('Suggestion no longer available');
          await api('/api/suggestions', { suggestions: latest.map(item => item.id === operation.id ? { ...item, status: operation.status, ...(operation.decision ? {decision: operation.decision} : {}) } : item) });
        }
        state.queue = state.queue.filter(item => item.revision !== operation.revision);
        mutationVersion++;
        delete state.errors.save;
        persist();
      }
      notice('save', '');
    } catch (error) {
      state.errors.save = error.message;
      notice('save', 'The server could not save a change. Your notes stay in this browser and will retry automatically. You can also export a backup.', true);
    } finally { state.syncing = false; updateSaveStatus(); }
  }

  function asList(value, key) {
    const result = Array.isArray(value) ? value : value?.[key];
    if (!Array.isArray(result)) throw new Error('Unexpected response format');
    return result;
  }

  async function refresh(manual = false) {
    if (state.refreshing) return;
    state.refreshing = true;
    $('#refresh').disabled = true;
    const routes = ['samples', 'annotations', 'patterns', 'suggestions', 'graph', 'state'];
    const versionAtStart = mutationVersion;
    const results = await Promise.allSettled(routes.map(route => api(`/api/${route}`)));
    const oldSampleIds = new Set(state.samples.map(sample => sample.id));
    const oldSuggestionIds = new Set(state.suggestions.map(item => item.id));
    const wasLoading = state.loading;
    results.forEach((result, index) => {
      const route = routes[index];
      try {
        if (result.status === 'rejected') throw result.reason;
        if (route === 'state') state.app = result.value || {};
        else if (route === 'graph') {
          if (!Array.isArray(result.value?.nodes)) throw new Error('Unexpected graph format');
          state.graph = result.value;
        } else {
          const records = asList(result.value, route);
          // A slow GET must not replace a note edited or saved after that GET began.
          if (!['annotations', 'suggestions'].includes(route) || (versionAtStart === mutationVersion && !state.syncing)) state[route] = records;
        }
        delete state.errors[route];
      } catch (error) { state.errors[route] = error.message; }
    });
    Object.assign(state, overlayPending(state.annotations, state.suggestions));
    state.loading = false;
    state.refreshing = false;
    $('#refresh').disabled = false;
    const failed = routes.filter(route => state.errors[route]);
    notice('load', failed.length ? `Could not refresh ${failed.join(', ')}. Showing any previously loaded records; retrying automatically.` : '', true);
    if (!wasLoading) {
      const added = state.samples.filter(sample => !oldSampleIds.has(sample.id)).length;
      const proposed = state.suggestions.filter(item => !oldSuggestionIds.has(item.id) && item.status === 'pending').length;
      if (added || proposed) notice('new', `${added ? `${added} new trajector${added === 1 ? 'y' : 'ies'}` : ''}${added && proposed ? ' and ' : ''}${proposed ? `${proposed} new suggestion${proposed === 1 ? '' : 's'}` : ''} available.`);
    }
    if (!state.active && state.samples.length) {
      const requested = new URLSearchParams(location.search).get('sample');
      state.active = state.samples.some(sample => sample.id === requested) ? requested : orderedSamples()[0].id;
    }
    const signature = JSON.stringify([state.samples, state.annotations, state.patterns, state.suggestions, state.graph, state.app.jobs, state.app.mlflow_url, state.errors]);
    const editing = document.activeElement?.tagName === 'TEXTAREA' || $('#note-editor').open;
    if (signature !== state.lastSignature && !editing) { render(); state.lastSignature = signature; }
    updateSaveStatus();
    if (manual) track('refresh', { records: state.samples.length });
    if (wasLoading) track('opened', { records: state.samples.length });
    flush();
  }

  function activeSample() { return state.samples.find(sample => sample.id === state.active); }
  function textContent(message) { return typeof message.content === 'string' ? message.content : message.content == null ? '' : JSON.stringify(message.content, null, 2); }
  function importedJsonOffset(content) {
    const prefix = 'Imported observable agent_review (not a live model call)';
    if (!content.startsWith(prefix)) return 0;
    const separator = content.slice(prefix.length).match(/^\s+/);
    if (!separator) return 0;
    const offset = prefix.length + separator[0].length;
    try { JSON.parse(content.slice(offset)); return offset; }
    catch { return 0; }
  }
  function segmentRanges(ranges, start, end) {
    return ranges.filter(range => range.start < end && range.end > start).map(range => ({
      ...range, start: Math.max(start, range.start) - start, end: Math.min(end, range.end) - start
    }));
  }
  function messages(sample) { return Array.isArray(sample?.messages) ? sample.messages : []; }
  function noteCount(sampleId) { return state.annotations.filter(note => note.sample_id === sampleId).length; }
  function actorKind(note) { return ['human', 'agent_review', 'unspecified'].includes(note.actor_kind) ? note.actor_kind : 'unspecified'; }
  function provenanceBadges(note) {
    const group = el('div', 'note-provenance');
    const label = { human: 'Human (declared)', agent_review: 'Agent review', unspecified: 'Unspecified' }[actorKind(note)];
    group.append(el('span', 'note-tag', `${label}${note.actor_kind == null ? ' / historical provenance absent' : ''}`),
      el('span', 'note-tag', `Producer: ${note.producer || 'unspecified'}`));
    if (note.created_at) group.append(el('span', 'note-tag', `Authored: ${note.created_at}`));
    const suggestion = note.id?.startsWith('accepted-') ? state.suggestions.find(item => `accepted-${item.id}` === note.id) : note;
    if (suggestion && ['accepted', 'dismissed'].includes(suggestion.status)) {
      const decision = suggestion.decision;
      group.append(el('span', 'note-tag decision-provenance', decision
        ? `${suggestion.status} / ${decision.actor_kind} (declared, not authenticated) / ${decision.producer} / ${decision.decided_at}`
        : `${suggestion.status} / decision actor and time unknown (legacy record)`));
    }
    return group;
  }
  function pending() { return state.suggestions.filter(item => item.status === 'pending'); }
  function modelJob(sample) { return Array.isArray(state.app.jobs) && state.app.jobs.some(job => job.id === sample.id); }
  function orderedSamples() {
    const jobs = new Set((Array.isArray(state.app.jobs) ? state.app.jobs : []).map(job => job.id));
    return [...state.samples.filter(sample => jobs.has(sample.id)), ...state.samples.filter(sample => !jobs.has(sample.id))];
  }
  function sampleTitle(sample) { return sample?.title || sample?.id || 'Untitled trajectory'; }
  function dateLabel(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function roleKind(role) { const value = String(role || 'event').toLowerCase(); return /tool|function/.test(value) ? 'tool' : /thinking|reasoning/.test(value) ? 'thinking' : /human|user|input/.test(value) ? 'user' : /output|result/.test(value) ? 'output' : /system|developer/.test(value) ? 'system' : /assistant|agent/.test(value) ? 'assistant' : 'event'; }

  function render() {
    renderList(); renderReader(); renderMap(); renderProgress();
    $('#pending-count').textContent = pending().length || '';
    scheduleLayout();
  }

  function renderList() {
    const query = $('#record-search').value.trim().toLowerCase();
    const filtered = orderedSamples().filter(sample => [sample.title, sample.id, sample.model, typeof sample.world === 'object' ? JSON.stringify(sample.world) : sample.world].join(' ').toLowerCase().includes(query));
    $('#record-count').textContent = `${filtered.length} of ${state.samples.length} trajectories`;
    $('#record-list').replaceChildren();
    for (const sample of filtered) {
      const item = button('', () => openSample(sample.id), 'record-card');
      if (sample.id === state.active) item.setAttribute('aria-current', 'true');
      item.append(el('strong', '', sampleTitle(sample)), el('span', 'record-meta', `${modelJob(sample) ? 'Model run' : sample.model === 'app' || /event/i.test(sample.model || '') ? 'App events' : sample.model || 'Trajectory'} / ${sample.status || 'Status unavailable'}`));
      if (noteCount(sample.id)) item.append(el('span', 'note-count', `${noteCount(sample.id)} ${noteCount(sample.id) === 1 ? 'note' : 'notes'}`));
      $('#record-list').append(item);
    }
    if (!filtered.length) $('#record-list').append(el('p', 'fine-print', query ? 'No matching trajectories.' : state.errors.samples ? 'Trajectories unavailable. Use Refresh to retry.' : 'No trajectories recorded yet.'));
  }

  function openSample(sampleId, annotationId) {
    if (!state.samples.some(sample => sample.id === sampleId)) { notice('missing', 'This trajectory is not in the current review set. Refresh the samples to check for it.', true); return; }
    closeEditor();
    state.active = sampleId;
    const url = new URL(location.href); url.searchParams.set('sample', sampleId); history.replaceState(null, '', url);
    setView('content', false);
    renderList(); renderReader();
    track('trajectory_opened', { sample_id: sampleId, annotation_id: annotationId });
    if (annotationId) requestAnimationFrame(() => jumpToNote(annotationId));
    else $('#trajectory-header').scrollIntoView({ block: 'start' });
  }

  function setView(view, log = true) {
    state.view = view;
    for (const name of ['content', 'map', 'progress']) $(`#${name}-view`).hidden = name !== view;
    $$('[data-view]').forEach(node => { if (node.dataset.view === view) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
    if (view === 'content') scheduleLayout();
    if (view === 'progress') renderProgress();
    if (log) track('view_changed', { view });
  }

  function renderReader(highlightDraft = false) {
    const sample = activeSample();
    $('#trajectory-header').replaceChildren(); $('#messages').replaceChildren(); $('#margin-notes').replaceChildren();
    $('#reading-layout').hidden = !sample;
    $('#reader-footer').hidden = !sample;
    $('#reader-empty').hidden = Boolean(sample);
    if (!sample) {
      $('#reader-empty').replaceChildren(el('span', 'empty-glyph', '*'), el('h2', '', state.errors.samples ? 'The field book is unavailable.' : 'A fresh page.'), el('p', '', state.errors.samples ? 'The review API could not be reached. Refresh to try again; no example traces have been substituted.' : 'There are no saved trajectories yet. Explore the school or run a projection, then return here to review what happened.'));
      const link = el('a', '', 'Return to the school'); link.href = '/'; $('#reader-empty').append(link);
      return;
    }
    const header = el('div', 'trajectory-heading');
    header.append(el('p', 'eyebrow', modelJob(sample) ? 'Observable trajectory / model run' : 'Observable trajectory / saved record'), el('h1', '', sampleTitle(sample)));
    const metadata = el('div', 'trajectory-metadata');
    const world = typeof sample.world === 'string' ? sample.world : sample.world?.title || sample.world?.name;
    for (const value of [sample.model, world, dateLabel(sample.created_at), `${messages(sample).length} ${messages(sample).length === 1 ? 'message' : 'messages'}`]) if (value) metadata.append(el('span', '', value));
    metadata.append(el('span', 'badge', sample.status || 'Status unavailable'));
    const lengths = state.samples.map(item => messages(item).reduce((sum, message) => sum + textContent(message).length, 0)).sort((a, b) => a - b);
    const length = messages(sample).reduce((sum, message) => sum + textContent(message).length, 0);
    if (lengths.length >= 10 && length > lengths[Math.floor(lengths.length * .9)]) metadata.append(el('span', 'badge', 'Among the longest 10%'));
    if (sample.usage) {
      const tokens = sample.usage.total_tokens ?? ((sample.usage.input_tokens != null && sample.usage.output_tokens != null) ? sample.usage.input_tokens + sample.usage.output_tokens : null);
      if (tokens != null) metadata.append(el('span', '', `${Number(tokens).toLocaleString()} tokens`));
    }
    header.append(metadata);
    const actions = el('div', 'trajectory-actions');
    if (sample.trace_id && state.app.mlflow_url) {
      try {
        const url = new URL(state.app.mlflow_url, location.origin);
        if (['http:', 'https:'].includes(url.protocol)) {
          url.hash = state.app.experiment_id != null ? `/experiments/${encodeURIComponent(state.app.experiment_id)}/traces?selectedEvaluationId=${encodeURIComponent(sample.trace_id)}` : '';
          const link = el('a', '', 'Inspect in MLflow'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = `Trace ${sample.trace_id}`; actions.append(link);
        }
      } catch { /* Invalid trace URLs are not rendered as links. */ }
    } else actions.append(el('span', '', 'MLflow trace link unavailable'));
    if (modelJob(sample)) {
      const link = el('a', 'correction-link', 'Correct this trajectory'); link.href = `/?correct=${encodeURIComponent(sample.id)}`;
      link.addEventListener('click', async event => {
        if (!state.queue.length && !state.syncing && !state.draft?.note.trim()) return;
        event.preventDefault();
        if (state.draft?.note.trim()) { notice('correction-save', 'Save your unfinished note before opening a correction. Use Resume note above.'); return; }
        await flush();
        if (state.queue.length || state.syncing) notice('correction-save', 'Your latest notes are still waiting to reach the server. Try the correction link again once the save status is clear.', true);
        else location.assign(link.href);
      });
      actions.append(link);
    }
    else actions.append(el('span', 'correction-help', 'Corrections are available for model jobs.'));
    if (sample.parent_job_id) { const parent = button('View previous version', () => openSample(sample.parent_job_id), 'text-button'); actions.append(parent); }
    header.append(actions, el('p', 'read-hint', 'Select a passage to leave a free-text note. Saved notes appear in the margin. Corrections create a new version.'));
    const job = Array.isArray(state.app.jobs) ? state.app.jobs.find(item => item.id === sample.id) : null;
    if (job) header.append(renderExecutionFiles(job));
    $('#trajectory-header').append(header);
    const items = [...state.annotations.filter(note => note.sample_id === sample.id).map(note => ({ ...note, kind: 'annotation' })), ...pending().filter(note => note.sample_id === sample.id).map(note => ({ ...note, kind: 'suggestion' }))];
    const anchors = new Map(items.map(item => [item.id, resolveAnchor(sample, item)]));
    let group = null;
    for (const [index, message] of messages(sample).entries()) {
      const kind = roleKind(message.role);
      const block = el('section', 'message'); block.dataset.role = kind;
      const heading = el('div', 'message-header'); heading.append(el('span', 'role-label', String(message.role || 'App event').replace(/_/g, ' ')), el('span', 'message-id', message.id || `Message ${index + 1}`)); block.append(heading);
      const content = textContent(message);
      const jsonOffset = importedJsonOffset(content);
      const isCode = jsonOffset > 0 || typeof message.content === 'object' || /^[\s]*[\[{]/.test(content) || kind === 'tool';
      const body = el(isCode ? 'pre' : 'div', `message-content${isCode ? ' code' : ''}`);
      body.dataset.contentOffset = jsonOffset;
      body.dataset.messageIndex = index;
      if (message.id != null) body.dataset.messageId = String(message.id);
      const ranges = items.filter(item => anchors.get(item.id)?.index === index).map(item => ({ ...anchors.get(item.id), id: item.id, kind: item.kind }));
      if (state.draft?.sample_id === sample.id && state.draft.message_id === message.id && ($('#note-editor').open || highlightDraft)) ranges.push({ start: state.draft.start, end: state.draft.end, id: 'draft', kind: 'pending' });
      if (jsonOffset) {
        const note = el('div', 'message-content fine-print');
        note.dataset.messageIndex = index;
        note.dataset.contentOffset = 0;
        if (message.id != null) note.dataset.messageId = String(message.id);
        paintText(note, content.slice(0, jsonOffset), segmentRanges(ranges, 0, jsonOffset));
        block.append(note);
      }
      // Never pretty-print the suffix: selection offsets refer to the original message.
      paintText(body, content.slice(jsonOffset), segmentRanges(ranges, jsonOffset, content.length));
      if (jsonOffset || kind === 'tool' || (isCode && content.length > 1800)) {
        const details = el('details');
        const detailKey = `${sample.id}:${message.id || index}`;
        details.open = expandedMessages.get(detailKey) ?? (!jsonOffset && (kind !== 'tool' || content.length < 800));
        let summary = `${kind === 'tool' ? 'Tool data' : 'Structured content'} / ${content.length.toLocaleString()} characters`;
        try { const parsed = typeof message.content === 'object' ? message.content : JSON.parse(content.slice(jsonOffset)); if (parsed?.name || parsed?.function?.name) summary = `${parsed.name || parsed.function.name} / ${summary}`; } catch { /* Non-JSON tool output remains plain text. */ }
        details.append(el('summary', '', summary), body);
        details.addEventListener('toggle', () => { expandedMessages.set(detailKey, details.open); scheduleLayout(); });
        block.append(details);
      } else block.append(body);
      if (kind === 'tool') { if (!group) { group = el('div', 'tool-group'); $('#messages').append(group); } group.append(block); }
      else { group = null; $('#messages').append(block); }
    }
    if (!messages(sample).length) $('#messages').append(el('p', 'compact-empty', 'No observable messages are available for this record.'));
    for (const item of items) $('#margin-notes').append(renderMarginNote(item, anchors.get(item.id)));
    if (!items.length) $('#margin-notes').append(el('p', 'fine-print', 'Your observations belong here. Select text to begin.'));
    const index = orderedSamples().findIndex(item => item.id === sample.id);
    $('#record-position').textContent = `${index + 1} / ${state.samples.length}`;
    $('#previous-record').disabled = index <= 0; $('#next-record').disabled = index >= state.samples.length - 1;
    scheduleLayout();
  }

  function artifactUrl(value, jobId, filename) {
    if (typeof value !== 'string' || !value.trim() || typeof filename !== 'string' || !filename || /[/\\\u0000-\u001f]/.test(filename) || ['.', '..'].includes(filename)) return null;
    try {
      const url = new URL(value, location.origin);
      const parts = url.pathname.split('/').map(part => decodeURIComponent(part));
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin || url.username || url.password || url.search || url.hash) return null;
      if (parts.length !== 6 || parts[1] !== 'api' || parts[2] !== 'jobs' || parts[3] !== jobId || parts[4] !== 'artifacts' || parts[5] !== filename) return null;
      return url.href;
    } catch { return null; }
  }

  function artifactLink(url, label) {
    const link = el('a', '', label);
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    return link;
  }

  function renderExecutionFiles(job) {
    const details = el('details', 'execution-files');
    const detailKey = `execution-files:${job.id}`;
    details.open = expandedMessages.get(detailKey) ?? false;
    details.append(el('summary', '', 'Execution files'));
    details.addEventListener('toggle', () => { expandedMessages.set(detailKey, details.open); scheduleLayout(); });
    const invocation = job.invocation;
    if (!invocation || typeof invocation !== 'object' || Array.isArray(invocation)) {
      const waiting = ['queued', 'pending', 'running'].includes(job.status);
      details.append(el('p', 'execution-empty', waiting ? 'Execution files are not available yet. No invocation has been captured for this job.' : 'Historical execution files are unavailable. This job has no saved invocation capture.'));
      return details;
    }
    details.append(el('p', 'execution-intro', 'Exact files from this job. Output files become available as execution writes them.'));
    const files = el('ul', 'execution-file-list');
    for (const filename of ['prompt.txt', 'argv.json', 'references.json', 'stdout.log', 'stderr.log', 'result.json']) {
      const item = el('li');
      const url = artifactUrl(invocation.artifacts?.[filename], job.id, filename);
      if (url) item.append(artifactLink(url, filename));
      else item.append(el('span', 'execution-unavailable', `${filename} / unavailable`));
      files.append(item);
    }
    details.append(files, el('h3', 'execution-reference-heading', 'Reference manifest'));
    if (!Array.isArray(invocation.references)) details.append(el('p', 'execution-empty', 'Reference manifest unavailable for this invocation.'));
    else if (!invocation.references.length) details.append(el('p', 'execution-empty', 'No reference files were attached to this invocation.'));
    else {
      const references = el('ul', 'execution-references');
      for (const reference of invocation.references) {
        if (!reference || typeof reference !== 'object') continue;
        const item = el('li');
        const name = reference.name || reference.filename || 'Unnamed reference';
        const url = artifactUrl(reference.url, job.id, reference.filename);
        item.append(url ? artifactLink(url, name) : el('span', 'execution-unavailable', `${name} / file unavailable`));
        const metadata = el('dl', 'execution-reference-metadata');
        for (const [label, value] of [['File', reference.filename], ['Type', reference.mime], ['Size', Number.isFinite(reference.bytes) ? `${reference.bytes.toLocaleString()} bytes` : null], ['SHA-256', reference.sha256]]) {
          if (value == null) continue;
          metadata.append(el('dt', '', label), el('dd', label === 'SHA-256' ? 'execution-hash' : '', value));
        }
        item.append(metadata); references.append(item);
      }
      details.append(references);
    }
    return details;
  }

  function resolveAnchor(sample, item) {
    const candidates = messages(sample).map((message, index) => ({ message, index, text: textContent(message) })).filter(({ message }) => !item.message_id || message.id === item.message_id);
    for (const candidate of candidates) if (item.message_id && Number.isInteger(item.start) && Number.isInteger(item.end) && item.end > item.start && candidate.text.slice(item.start, item.end) === item.quote) return { index: candidate.index, start: item.start, end: item.end };
    if (!item.quote) return null;
    const matches = [];
    for (const candidate of candidates) {
      let start = candidate.text.indexOf(item.quote);
      while (start >= 0) { matches.push({ index: candidate.index, start, end: start + item.quote.length }); if (matches.length > 1) return null; start = candidate.text.indexOf(item.quote, start + item.quote.length); }
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function paintText(target, content, ranges) {
    const points = [...new Set([0, content.length, ...ranges.flatMap(range => [range.start, range.end])])].filter(point => Number.isInteger(point) && point >= 0 && point <= content.length).sort((a, b) => a - b);
    for (let index = 0; index < points.length - 1; index++) {
      const start = points[index], end = points[index + 1];
      const active = ranges.filter(range => range.start <= start && range.end >= end);
      const text = content.slice(start, end);
      if (!active.length) target.append(document.createTextNode(text));
      else {
        const kind = active.some(range => range.kind === 'pending') ? 'pending' : active.some(range => range.kind === 'annotation') ? 'annotation' : 'suggestion';
        const mark = el('mark', `${kind}-highlight`, text); mark.dataset.noteIds = JSON.stringify(active.map(range => range.id));
        mark.addEventListener('mouseenter', () => linkNotes(active.map(range => range.id), true)); mark.addEventListener('mouseleave', () => linkNotes(active.map(range => range.id), false));
        mark.addEventListener('click', () => { if (!window.getSelection()?.toString()) jumpToNote(active[0].id); }); target.append(mark);
      }
    }
  }

  function highlights(noteId) { return $$('mark[data-note-ids]', $('#messages')).filter(mark => JSON.parse(mark.dataset.noteIds).includes(noteId)); }
  function noteElement(noteId) { return $$('.margin-note').find(node => node.dataset.noteId === noteId); }
  function linkNotes(ids, active) { for (const noteId of ids) { noteElement(noteId)?.classList.toggle('linked', active); highlights(noteId).forEach(mark => mark.classList.toggle('linked', active)); } }

  function renderMarginNote(item, anchor) {
    const box = el('section', `margin-note${item.kind === 'suggestion' ? ' suggestion' : ''}`); box.dataset.noteId = item.id; box.tabIndex = -1;
    box.append(el('span', 'note-tag', item.kind === 'suggestion' ? 'Suggestion / unconfirmed' : 'Saved field note'), provenanceBadges(item));
    if (item.quote) box.append(el('blockquote', '', item.quote));
    if (!anchor) box.append(el('span', 'anchor-warning', 'Exact passage could not be located. The original quote is preserved.'));
    const note = el('p', '', item.note || 'No note text provided.'); box.append(note);
    const actions = el('div', `note-actions${item.kind === 'annotation' && actorKind(item) === 'human' ? ' human' : ''}`);
    if (item.kind === 'suggestion') actions.append(button('Accept', () => decideSuggestions([item.id], 'accepted')), button('Dismiss', () => decideSuggestions([item.id], 'dismissed')));
    else {
      actions.append(button('Edit', () => {
        if ($('textarea', box)) return;
        const input = el('textarea'); input.value = item.note; input.setAttribute('aria-label', 'Edit field note'); note.replaceWith(input);
        input.addEventListener('input', () => {
          const current = state.annotations.find(annotation => annotation.id === item.id);
          if (!current) return;
          input.setAttribute('aria-invalid', String(!input.value.trim()));
          if (!input.value.trim()) return;
          current.note = input.value; enqueue({ type: 'annotation', annotation: { ...current } }); scheduleLayout();
        });
        input.addEventListener('blur', () => {
          if (!input.value.trim()) notice('blank-note', 'A note needs text. The last nonempty version was kept; use Delete to remove it.');
          note.textContent = state.annotations.find(annotation => annotation.id === item.id)?.note || item.note;
          input.replaceWith(note); scheduleLayout(); track('annotation_edited', { annotation_id: item.id, sample_id: item.sample_id });
        });
        input.focus(); scheduleLayout();
      }), button('Delete', () => {
        const original = state.annotations.find(annotation => annotation.id === item.id);
        state.annotations = state.annotations.filter(annotation => annotation.id !== item.id); enqueue({ type: 'delete', id: item.id }); render();
        notice('undo', 'Note deleted.'); const box = $$('[data-notice]').find(node => node.dataset.notice === 'undo');
        box?.append(button('Undo', () => { if (original) { state.annotations.push(original); enqueue({ type: 'annotation', annotation: original }); render(); } notice('undo', ''); }));
        track('annotation_deleted', { annotation_id: item.id, sample_id: item.sample_id });
      }));
    }
    box.append(actions); box.addEventListener('mouseenter', () => linkNotes([item.id], true)); box.addEventListener('mouseleave', () => linkNotes([item.id], false));
    return box;
  }

  function scheduleLayout() { cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(layoutNotes); }
  function layoutNotes() {
    if (state.view !== 'content' || !activeSample()) return;
    const margin = $('#margin-notes');
    if (window.innerWidth <= 900) { margin.style.minHeight = ''; return; }
    const origin = margin.getBoundingClientRect().top;
    const notes = $$('.margin-note', margin).map(node => {
      const mark = highlights(node.dataset.noteId).find(item => item.getClientRects().length);
      return { node, top: mark ? mark.getBoundingClientRect().top - origin : 0 };
    }).sort((a, b) => a.top - b.top);
    let bottom = 0;
    for (const { node, top } of notes) { const position = Math.max(top, bottom, 0); node.style.top = `${position}px`; bottom = position + node.getBoundingClientRect().height + 14; }
    margin.style.minHeight = `${bottom}px`;
  }

  function jumpToNote(noteId) {
    const marks = highlights(noteId);
    for (const mark of marks) { const details = mark.closest('details'); if (details) details.open = true; }
    scheduleLayout();
    requestAnimationFrame(() => { const target = marks[0] || noteElement(noteId); target?.scrollIntoView({ block: 'center', behavior: 'smooth' }); const note = noteElement(noteId); note?.classList.add('flash'); setTimeout(() => note?.classList.remove('flash'), 1600); });
  }

  function captureSelection() {
    if ($('#note-editor').open) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !selection.toString().trim()) return;
    const range = selection.getRangeAt(0);
    const parent = node => (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest('.message-content');
    const startBody = parent(range.startContainer), endBody = parent(range.endContainer);
    if (!startBody || startBody !== endBody) {
      if (startBody || endBody) notice('selection', 'Select a passage within one message so the note can keep an exact message anchor.');
      return;
    }
    if (!startBody.dataset.messageId) { notice('selection', 'This message has no message ID. It cannot support a durable selection note.', true); return; }
    if (state.draft?.note.trim()) { notice('draft', 'You have an unfinished note. Resume it or discard its draft before starting another.'); updateSaveStatus(); return; }
    const preceding = range.cloneRange(); preceding.selectNodeContents(startBody); preceding.setEnd(range.startContainer, range.startOffset);
    const start = Number(startBody.dataset.contentOffset || 0) + preceding.toString().length;
    const quote = range.toString();
    const rect = range.getBoundingClientRect();
    state.draft = { id: id(), sample_id: state.active, message_id: startBody.dataset.messageId, quote, start, end: start + quote.length, note: '', actor_kind: 'unspecified', producer: 'unspecified', created_at: new Date().toISOString() };
    persist(); showEditor(rect);
    track('passage_selected', { sample_id: state.active, message_id: state.draft.message_id, start, end: start + quote.length });
  }

  function showEditor(rect) {
    const dialog = $('#note-editor');
    $('#selected-quote').textContent = state.draft.quote;
    $('#note-text').value = state.draft.note;
    $('#note-actor').value = actorKind(state.draft);
    $('#note-producer').value = state.draft.producer || 'unspecified';
    // Repaint the selected range before moving focus so its anchor remains visible.
    renderReader(true);
    dialog.show();
    window.getSelection()?.removeAllRanges();
    const width = Math.min(360, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect?.left ?? (window.innerWidth - width) / 2, window.innerWidth - width - 16));
    const top = Math.max(16, Math.min((rect?.bottom ?? 100) + 12, window.innerHeight - dialog.offsetHeight - 16));
    dialog.style.left = `${left}px`; dialog.style.top = `${top}px`;
    $('#note-text').focus(); updateSaveStatus();
  }

  function closeEditor(discard = false) {
    if (!$('#note-editor').open) return;
    $('#note-editor').close();
    if (discard || !state.draft?.note.trim()) state.draft = null;
    persist(); renderReader();
  }

  function saveDraft(event) {
    event.preventDefault();
    if (!state.draft || !$('#note-text').value.trim()) return;
    const annotation = { ...state.draft, note: $('#note-text').value.trim(), actor_kind: $('#note-actor').value,
      producer: $('#note-producer').value.trim() || 'unspecified' };
    state.annotations.push(annotation); state.draft = null; $('#note-editor').close();
    enqueue({ type: 'annotation', annotation }); render(); track('annotation_added', { sample_id: annotation.sample_id, annotation_id: annotation.id, message_id: annotation.message_id });
  }

  function decideSuggestions(ids, status) {
    const dialog = $('#decision-editor');
    dialog.dataset.ids = JSON.stringify(ids);
    dialog.dataset.status = status;
    $('#decision-title').textContent = `${status === 'accepted' ? 'Accept' : 'Dismiss'} ${ids.length} suggestion${ids.length === 1 ? '' : 's'}`;
    $('#decision-form').reset();
    $('#decision-error').textContent = '';
    dialog.showModal();
    $('#decision-actor').focus();
  }

  function applySuggestionDecisions(ids, status, declaration) {
    const requested = state.suggestions.filter(item => ids.includes(item.id) && item.status === 'pending');
    const targets = requested.filter(item => status !== 'accepted' || item.note?.trim());
    if (targets.length !== requested.length) notice('empty-suggestion', 'A suggestion without note text cannot be accepted. It remains pending and may be dismissed.', true);
    const decidedAt = new Date().toISOString();
    const decisions = targets.map(suggestion => suggestionDecision(suggestion, status, declaration, decidedAt));
    for (const suggestion of decisions) {
      if (status === 'accepted') {
        const sample = state.samples.find(item => item.id === suggestion.sample_id);
        const anchor = resolveAnchor(sample, suggestion);
        const annotation = { id: `accepted-${suggestion.id}`, sample_id: suggestion.sample_id, quote: suggestion.quote || '', note: suggestion.note || '',
          actor_kind: actorKind(suggestion), producer: suggestion.producer || 'unspecified', ...(suggestion.created_at ? {created_at: suggestion.created_at} : {}) };
        if (anchor) Object.assign(annotation, { message_id: messages(sample)[anchor.index].id, start: anchor.start, end: anchor.end });
        else if (suggestion.message_id) annotation.message_id = suggestion.message_id;
        if (!state.annotations.some(item => item.id === annotation.id)) { state.annotations.push(annotation); enqueue({ type: 'annotation', annotation }); }
      }
      state.suggestions = state.suggestions.map(item => item.id === suggestion.id ? suggestion : item);
      enqueue({ type: 'suggestion', id: suggestion.id, status, decision: suggestion.decision }); state.selected.delete(suggestion.id);
    }
    render();
    if (decisions.length) track('suggestions_decided', { suggestion_ids: decisions.map(item => item.id), status, decision: decisions[0].decision });
  }

  const palette = ['#769379', '#b1996a', '#7d969d', '#a18c7d', '#8d93a5', '#a1a979', '#849c91', '#ac96a0'];
  function svg(tag, attributes = {}) { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); return node; }
  function renderMap() {
    const container = $('#map-container'); container.replaceChildren(); $('#map-legend').replaceChildren();
    const nodes = (state.graph.nodes || []).filter(node => Number.isFinite(node.x) && Number.isFinite(node.y));
    $('#map-count').textContent = `${nodes.length} mapped records`;
    if (!nodes.length) { container.append(el('div', 'empty-state', state.errors.graph ? 'The map API is unavailable. Refresh to retry.' : 'The map will appear when the server has recorded trajectories.')); return; }
    const plot = svg('svg', { viewBox: '0 0 1100 560', role: 'group', 'aria-label': 'Trajectory cluster map. Focus a record and press Enter to read it.' });
    const minX = Math.min(...nodes.map(node => node.x)), maxX = Math.max(...nodes.map(node => node.x));
    const minY = Math.min(...nodes.map(node => node.y)), maxY = Math.max(...nodes.map(node => node.y));
    const x = node => maxX === minX ? 550 : 85 + (node.x - minX) / (maxX - minX) * 930;
    const y = node => maxY === minY ? 280 : 75 + (node.y - minY) / (maxY - minY) * 405;
    const clusters = [...new Set(nodes.map(node => node.cluster))];
    for (const [index, clusterId] of clusters.entries()) {
      const members = nodes.filter(node => node.cluster === clusterId);
      const color = palette[index % palette.length];
      const label = state.graph.clusters?.find(cluster => cluster.id === clusterId)?.label || `Group ${index + 1}`;
      const left = Math.min(...members.map(x)), right = Math.max(...members.map(x)), top = Math.min(...members.map(y)), bottom = Math.max(...members.map(y));
      const hull = convexHull(members.map(node => [x(node), y(node)]));
      if (hull.length >= 3) plot.append(svg('polygon', { points: hull.map(point => point.join(',')).join(' '), fill: color, 'fill-opacity': '.10', stroke: color, 'stroke-opacity': '.24', 'stroke-width': 30, 'stroke-linejoin': 'round' }));
      else plot.append(svg('ellipse', { cx: (left + right) / 2, cy: (top + bottom) / 2, rx: (right - left) / 2 + 32, ry: (bottom - top) / 2 + 32, fill: color, 'fill-opacity': '.12' }));
      const text = svg('text', { x: left, y: Math.max(22, top - 39), class: 'map-cluster-label' }); text.textContent = label; plot.append(text);
      const legend = el('span', 'legend-entry'); const dot = el('span', 'legend-dot'); dot.style.background = color; legend.append(dot, document.createTextNode(label)); $('#map-legend').append(legend);
    }
    for (const node of nodes) {
      const available = node.sampled !== false && state.samples.some(sample => sample.id === node.id);
      const group = svg('g', { transform: `translate(${x(node)},${y(node)})`, class: `map-node${available ? '' : ' unavailable'}`, tabindex: 0, role: available ? 'button' : 'img', 'aria-label': `${node.title || node.id}. ${node.model || 'Model unavailable'}. ${noteCount(node.id)} saved notes.${available ? ' Open trajectory.' : ' Not in the review set.'}` });
      const radius = available ? 9 : 5;
      const color = palette[clusters.indexOf(node.cluster) % palette.length];
      if (noteCount(node.id) || node.annotated) group.append(svg('circle', { r: radius + 5, fill: 'none', stroke: '#a98232', 'stroke-width': 2 }));
      const attributes = { class: 'node-core', fill: color, stroke: available ? '#254735' : color, 'stroke-width': available ? 2 : 1 };
      if (/app|event|human/i.test(node.model || '')) group.append(svg('rect', { ...attributes, x: -radius, y: -radius, width: radius * 2, height: radius * 2, rx: 2 }));
      else group.append(svg('circle', { ...attributes, r: radius }));
      const title = svg('title'); title.textContent = `${node.title || node.id}\n${node.model || 'No model'} / ${node.status || 'Status unavailable'}\n${noteCount(node.id)} saved notes${available ? '' : '\nNot in the current review set'}`; group.append(title);
      if (available) { group.addEventListener('click', () => openSample(node.id)); group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSample(node.id); } }); }
      plot.append(group);
    }
    container.append(plot);
    $('#map-legend').append(el('span', 'legend-entry', 'Circle: model / other trajectory'), el('span', 'legend-entry', 'Square: app/event records (not actor attribution)'));
  }

  function convexHull(points) {
    if (points.length < 3) return points;
    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const point of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop(); lower.push(point); }
    for (const point of sorted.slice().reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop(); upper.push(point); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  function renderProgress() {
    $('#progress-counts').replaceChildren();
    const annotatedSamples = new Set(state.annotations.map(note => note.sample_id));
    for (const [value, label] of [[annotatedSamples.size, 'trajectories with notes'], [state.annotations.length, 'saved notes'], [pending().length, 'pending suggestions']]) { const stat = el('div', 'progress-stat'); stat.append(el('strong', '', value), el('span', '', label)); $('#progress-counts').append(stat); }
    const used = new Set();
    const groups = state.patterns.map(pattern => {
      const notes = state.annotations.filter(note => pattern.annotation_ids?.includes(note.id) || state.suggestions.some(suggestion => suggestion.pattern_id === pattern.id && suggestion.status === 'accepted' && note.id === `accepted-${suggestion.id}`));
      notes.forEach(note => used.add(note.id)); return { label: pattern.label || 'Unnamed mode', notes };
    }).filter(group => group.notes.length);
    const ungrouped = state.annotations.filter(note => !used.has(note.id));
    if (ungrouped.length) groups.push({ label: 'Not yet grouped', notes: ungrouped });
    const modes = $('#failure-modes'); modes.replaceChildren();
    if (!groups.length) { modes.style.height = 'auto'; modes.append(el('p', 'compact-empty', state.errors.patterns ? 'Failure modes are unavailable. Any saved notes will appear here once loaded.' : 'No failure modes have been confirmed yet. Leave free-text observations in Content; grouped patterns will appear here when available.')); }
    else {
      modes.style.height = `${Math.max(360, Math.min(760, groups.length * 125))}px`;
      const rects = treemap(groups.sort((a, b) => b.notes.length - a.notes.length));
      for (const { group, x, y, width, height } of rects) {
        const block = el('section', 'mode-block'); Object.assign(block.style, { left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` });
        const title = el('h3', '', group.label); title.append(el('span', 'mode-count', `${group.notes.length} saved note${group.notes.length === 1 ? '' : 's'}`)); block.append(title);
        const list = el('ul');
        for (const note of group.notes) { const li = el('li'); li.append(button(note.note || '(Empty note)', () => openSample(note.sample_id, note.id), ''), provenanceBadges(note)); list.append(li); }
        block.append(list); modes.append(block);
      }
    }
    const proposals = pending();
    state.selected = new Set([...state.selected].filter(selected => proposals.some(item => item.id === selected)));
    $('#suggestion-controls').hidden = !proposals.length;
    $('#suggestion-list').replaceChildren();
    if (!proposals.length) $('#suggestion-list').append(el('p', 'compact-empty', state.errors.suggestions ? 'Suggestions could not be loaded.' : 'No suggestions waiting for review. Suggestions will appear here when the agent proposes them.'));
    for (const suggestion of state.suggestions) {
      const row = el('div', 'suggestion-row');
      const check = el('input'); check.type = 'checkbox'; check.checked = state.selected.has(suggestion.id); check.setAttribute('aria-label', `Select suggestion: ${suggestion.note || suggestion.id}`);
      check.addEventListener('change', () => { if (check.checked) state.selected.add(suggestion.id); else state.selected.delete(suggestion.id); updateSuggestionControls(); });
      check.hidden = suggestion.status !== 'pending'; check.disabled = suggestion.status !== 'pending';
      const content = button('', () => openSample(suggestion.sample_id, suggestion.id), 'suggestion-jump');
      const pattern = state.patterns.find(item => item.id === suggestion.pattern_id);
      content.append(el('strong', '', pattern?.label || 'Ungrouped suggestion'), el('small', '', sampleTitle(state.samples.find(sample => sample.id === suggestion.sample_id))));
      if (suggestion.quote) content.append(el('blockquote', '', suggestion.quote)); content.append(el('p', '', suggestion.note || 'No note text provided.'));
      const actions = el('div', 'note-actions'); actions.append(button('Accept', () => decideSuggestions([suggestion.id], 'accepted')), button('Dismiss', () => decideSuggestions([suggestion.id], 'dismissed')));
      actions.hidden = suggestion.status !== 'pending';
      const description = el('div'); description.append(content, provenanceBadges(suggestion));
      row.append(check, description, actions); $('#suggestion-list').append(row);
    }
    updateSuggestionControls();
  }

  function treemap(groups, x = 0, y = 0, width = 100, height = 100) {
    if (groups.length === 1) return [{ group: groups[0], x, y, width, height }];
    const total = groups.reduce((sum, group) => sum + group.notes.length, 0);
    let split = 1, weight = groups[0].notes.length;
    while (split < groups.length - 1 && weight + groups[split].notes.length <= total / 2) weight += groups[split++].notes.length;
    const ratio = weight / total;
    return width >= height ? [...treemap(groups.slice(0, split), x, y, width * ratio, height), ...treemap(groups.slice(split), x + width * ratio, y, width * (1 - ratio), height)] : [...treemap(groups.slice(0, split), x, y, width, height * ratio), ...treemap(groups.slice(split), x, y + height * ratio, width, height * (1 - ratio))];
  }

  function updateSuggestionControls() {
    $('#select-all-suggestions').checked = pending().length > 0 && state.selected.size === pending().length;
    $('#select-all-suggestions').indeterminate = state.selected.size > 0 && state.selected.size < pending().length;
    $('#accept-selected').disabled = !state.selected.size; $('#dismiss-selected').disabled = !state.selected.size;
  }

  $$('[data-view]').forEach(node => node.addEventListener('click', () => { closeEditor(); setView(node.dataset.view); }));
  $('#record-search').addEventListener('input', renderList);
  $('#record-search').addEventListener('change', () => track('search', { query: $('#record-search').value }));
  $('#refresh').addEventListener('click', () => refresh(true));
  $('#previous-record').addEventListener('click', () => { const samples = orderedSamples(); const index = samples.findIndex(sample => sample.id === state.active); if (index > 0) openSample(samples[index - 1].id); });
  $('#next-record').addEventListener('click', () => { const samples = orderedSamples(); const index = samples.findIndex(sample => sample.id === state.active); if (index < samples.length - 1) openSample(samples[index + 1].id); });
  $('#messages').addEventListener('mouseup', () => setTimeout(captureSelection, 0));
  $('#messages').addEventListener('keyup', event => { if (event.key === 'Shift') captureSelection(); });
  $('#messages').addEventListener('touchend', () => setTimeout(captureSelection, 100));
  $('#note-form').addEventListener('submit', saveDraft);
  $('#note-text').addEventListener('input', () => { if (state.draft) { state.draft.note = $('#note-text').value; persist(); } });
  $('#note-actor').addEventListener('change', () => { if (state.draft) { state.draft.actor_kind = $('#note-actor').value; persist(); } });
  $('#note-producer').addEventListener('input', () => { if (state.draft) { state.draft.producer = $('#note-producer').value; persist(); } });
  $('#note-text').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); saveDraft(event); } });
  $('#close-editor').addEventListener('click', () => closeEditor());
  $('#note-editor').addEventListener('cancel', event => { event.preventDefault(); closeEditor(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#note-editor').open) closeEditor(); });
  document.addEventListener('pointerdown', event => { if ($('#note-editor').open && !$('#note-editor').contains(event.target)) closeEditor(); });
  $('#restore-draft').addEventListener('click', () => {
    if (!state.draft) return;
    if (!state.samples.some(sample => sample.id === state.draft.sample_id)) { notice('draft', 'The draft trajectory is not currently available. Export a backup to keep the draft, or refresh to retry.', true); return; }
    state.active = state.draft.sample_id; setView('content'); renderList(); showEditor();
  });
  $('#discard-draft').addEventListener('click', () => { state.draft = null; persist(); });
  $('#select-all-suggestions').addEventListener('change', event => { state.selected = new Set(event.target.checked ? pending().map(item => item.id) : []); renderProgress(); });
  $('#decision-cancel').addEventListener('click', () => $('#decision-editor').close());
  $('#decision-form').addEventListener('submit', event => {
    event.preventDefault();
    const dialog = $('#decision-editor');
    try {
      if (!$('#decision-confirm').checked) throw new Error('Confirm your declared decision identity.');
      applySuggestionDecisions(JSON.parse(dialog.dataset.ids), dialog.dataset.status, {actor_kind: $('#decision-actor').value, producer: $('#decision-producer').value});
      dialog.close();
    } catch (error) { $('#decision-error').textContent = error.message; }
  });
  $('#accept-selected').addEventListener('click', () => decideSuggestions([...state.selected], 'accepted'));
  $('#dismiss-selected').addEventListener('click', () => decideSuggestions([...state.selected], 'dismissed'));
  $('#backup').addEventListener('click', () => {
    const data = { version: 1, exported_at: new Date().toISOString(), samples: state.samples, annotations: state.annotations, patterns: state.patterns, suggestions: state.suggestions, pending_changes: state.queue, draft: state.draft };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = el('a'); link.href = url; link.download = `astral-review-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    track('backup_exported', { annotations: state.annotations.length });
  });
  document.addEventListener('click', event => { const link = event.target.closest('a'); if (link && !link.download) track('link_opened', { href: link.getAttribute('href'), sample_id: state.active }); });
  window.addEventListener('resize', scheduleLayout);
  window.addEventListener('online', () => { flush(); refresh(); });
  window.addEventListener('beforeunload', event => { persist(); if (storageFailed && state.queue.length) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); else { persist(); flush(); } });
  if (storageFailed) notice('storage', 'Local backup storage is unavailable in this browser. Export a backup before leaving if a save fails.', true);
  refresh();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 8000);
})();
