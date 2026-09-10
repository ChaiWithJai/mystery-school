import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code = readFileSync(new URL('../public/review.js', import.meta.url), 'utf8');
const related = runInNewContext(code.slice(0, code.indexOf('(() => {')) + '\nrelatedArtifactRecords;');
const artifact = (id, metadata = {}) => ({id, model: 'learning artifact', metadata, messages: [{content: 'unaltered'}]});

test('artifact parent and reverse children resolve only to artifact samples', () => {
  const parent = artifact('p'), child = artifact('c', {parent_id: 'p'});
  assert.equal(related(child, [parent, child])[0].sample, parent);
  assert.equal(related(parent, [parent, child])[0].sample, child);
  assert.equal(related(parent, [parent, child])[0].relation, 'Child version');
});
test('synthetic event IDs resolve from sample metadata without message parsing', () => {
  const event = {id: 'e', model: 'app event'};
  const source = artifact('a', {event_ids: ['e']});
  const result = related(source, [source, event]);
  assert.equal(result[0].relation, 'Recorded event');
  assert.equal(result[0].sample, event);
});
test('unknown IDs and non-artifact parent stay unavailable', () => {
  const source = artifact('a', {parent_id: 'review', event_ids: ['missing', 'https://example.org']});
  const result = related(source, [{id: 'review', model: 'sidecar'}]);
  assert.equal(result.length, 3);
  assert.ok(result.every(item => item.sample === null));
});
test('deduplicates and filters self or malformed IDs without changing records', () => {
  const source = artifact('a', {parent_id: 'a', event_ids: ['e', 'e', 'a', null, '', 1]});
  const event = {id: 'e', model: 'app event'};
  const records = [source, event, event];
  const before = JSON.stringify(records);
  assert.equal(related(source, records).length, 1);
  assert.equal(JSON.stringify(records), before);
});
test('imported review lineage and JSON source URLs are not artifact lineage', () => {
  assert.equal(related({id: 'r', model: 'sidecar', metadata: {parent_id: 'a'}}, [artifact('a')]).length, 0);
  const source = artifact('a', {parent_finding_ids: ['r']});
  source.messages[0].content = '{"event_ids":["r"],"source_refs":["https://example.org"]}';
  assert.equal(related(source, [{id: 'r', model: 'sidecar'}]).length, 0);
});
