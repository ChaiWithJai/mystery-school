import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
// The publish directory contains only public assets, never local data or credentials.
await rm('dist', {recursive: true, force: true});
await cp('public', 'dist', {recursive: true});
await mkdir('dist/vendor/three', {recursive: true});
await cp('node_modules/three/build', 'dist/vendor/three', {recursive: true});
await cp('node_modules/three/examples/jsm', 'dist/vendor/three/addons', {recursive: true});
const commit = process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
await writeFile('dist/deployment.json', JSON.stringify({commit, mode:'hosted-ui-private-companion', built_at:new Date().toISOString()})+'\n');
console.log(`Netlify assets prepared for ${commit}`);
