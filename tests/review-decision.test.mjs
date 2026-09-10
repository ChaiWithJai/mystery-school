import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Execute the same pure transition used by the classic browser script.
const source = readFileSync(new URL('../public/review.js', import.meta.url), 'utf8');
const decide = runInNewContext(source.slice(0, source.indexOf('(() => {')) + '\nsuggestionDecision;');
const original = Object.freeze({id: 'synthetic-proposal', status: 'pending', note: 'Synthetic QA only',
  actor_kind: 'agent_review', producer: 'synthetic-author', created_at: '2026-09-01T00:00:00.000Z'});
const time = '2026-09-10T17:00:00.000Z';

for (const actor of ['agent_review', 'human', 'unspecified']) {
  for (const status of ['accepted', 'dismissed']) {
    test(`isolated synthetic ${actor} ${status} retains original authorship`, () => {
      const result = decide(original, status, {actor_kind: actor, producer: ' synthetic-decider '}, time);
      assert.equal(result.actor_kind, original.actor_kind);
      assert.equal(result.producer, original.producer);
      assert.equal(result.created_at, original.created_at);
      assert.equal(result.decision.actor_kind, actor);
      assert.equal(result.decision.producer, 'synthetic-decider');
      assert.equal(result.decision.decided_at, time);
      assert.equal(result.status, status);
      assert.equal(original.status, 'pending');
      assert.equal(original.decision, undefined);
    });
  }
}
test('no inferred human, empty producer, invalid time, or overwrite', () => {
  for (const declaration of [{producer: 'test'}, {actor_kind: 'robot', producer: 'test'},
    {actor_kind: 'human', producer: '  '}, {actor_kind: 'human', producer: 'x'.repeat(201)}]) {
    assert.throws(() => decide(original, 'accepted', declaration, time));
  }
  const declaration = {actor_kind: 'unspecified', producer: 'synthetic'};
  assert.throws(() => decide(original, 'accepted', declaration, 'yesterday'));
  assert.throws(() => decide(original, 'pending', declaration, time));
  assert.throws(() => decide({...original, status: 'accepted'}, 'dismissed', declaration, time));
  assert.throws(() => decide({...original, note: ''}, 'accepted', declaration, time));
});
test('legacy source identity and timestamp are not fabricated', () => {
  const result = decide({id: 'legacy', status: 'pending', note: 'Synthetic legacy'}, 'accepted',
    {actor_kind: 'unspecified', producer: 'synthetic'}, time);
  assert.equal(result.actor_kind, undefined);
  assert.equal(result.producer, undefined);
  assert.equal(result.created_at, undefined);
});
