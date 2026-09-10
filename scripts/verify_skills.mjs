import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const lock = JSON.parse(await readFile(new URL('.agents/source-lock.json', root), 'utf8'));
assert.match(lock.commit, /^[a-f0-9]{40}$/);
assert.equal(Object.keys(lock.files).length, 8, 'Four skills, three references and license');
for (const [path, expected] of Object.entries(lock.files)) {
  assert.ok(path.startsWith('.agents/') && !path.includes('..'), 'Bounded vendored path');
  const bytes = await readFile(new URL(path, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, `${path}: differs from pinned source`);
  if (path.endsWith('SKILL.md')) {
    for (const [, relative] of bytes.toString().matchAll(/`(\.\.\/\.\.\/references\/[^`]+\.md)`/g)) {
      await readFile(new URL(relative, new URL(path, root)));
    }
  }
}
console.log(JSON.stringify({source:lock.repository, commit:lock.commit, verified_files:Object.keys(lock.files).length}));
