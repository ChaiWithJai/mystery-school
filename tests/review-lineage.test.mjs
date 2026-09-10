import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code = readFileSync(new URL('../public/review.js', import.meta.url), 'utf8');
const related = runInNewContext(code.slice(0, code.indexOf('(() => {')) + '\nrelatedReviews;');
const sample = (id, parents = []) => ({id, metadata: {capture_method: 'imported', parent_finding_ids: parents}, messages: [{content: 'unchanged source'}]});

test('known original finding resolves to the loaded sample without reading message JSON', () => {
  const parent = sample('parent'), child = sample('child', ['parent']);
  const result = related(child, [parent, child]);
  assert.equal(result.length, 1);
  assert.equal(result[0].sample, parent);
  assert.equal(result[0].relation, 'Original finding');
});
test('reverse follow-up resolves from known imported samples', () => {
  const parent = sample('parent'), child = sample('child', ['parent']);
  const result = related(parent, [parent, child]);
  assert.equal(result.length, 1);
  assert.equal(result[0].sample, child);
  assert.equal(result[0].relation, 'Follow-up review');
});
test('unknown parents remain unavailable, not arbitrary URL links', () => {
  const result = related(sample('child', ['missing', 'https://example.org']), []);
  assert.equal(result.length, 2);
  assert.ok(result.every(item => item.sample === null));
});
test('duplicate, self and malformed references are filtered without changing sources', () => {
  const parent = sample('parent');
  const child = sample('child', ['parent', 'parent', 'child', '', null, 42]);
  const records = [parent, child, child, sample('other', ['child', 'child'])];
  const before = JSON.stringify(records);
  const result = related(child, records);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'parent');
  assert.equal(result[1].id, 'other');
  assert.equal(JSON.stringify(records), before);
});
test('non-imported samples and message-embedded URLs do not create lineage', () => {
  const ordinary = {id: 'ordinary', messages: [{content: '{"parent_finding_ids":["parent"]}'}]};
  assert.equal(related(ordinary, [sample('parent')]).length, 0);
  assert.equal(related(sample('parent'), [ordinary]).length, 0);
});
