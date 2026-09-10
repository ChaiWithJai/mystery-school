import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '-z', '--', 'public'], {cwd: root, encoding: 'utf8'})
  .split('\0').filter(file => file.endsWith('.js'));
if (!files.length) throw new Error('No tracked public JavaScript files found.');
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax checked ${files.length} tracked public JavaScript files. Modules were not executed.`);
