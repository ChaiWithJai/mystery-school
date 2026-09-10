import {cp, mkdir, rm, writeFile, readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
// The publish directory contains only public assets, never local data or credentials.
await rm('dist', {recursive: true, force: true});
await cp('public', 'dist', {recursive: true, filter: source => !source.replaceAll('\\', '/').startsWith('public/audio/local')});
const index=await readFile('dist/index.html','utf8');
await writeFile('dist/index.html',index.replace('</head>','<script type="module" src="/hosted-capabilities.js"></script></head>'));
// A direct saved review URL also explains the capability boundary without
// booting the local-only review client or fetching private review APIs.
await writeFile('dist/review.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local studio · Mystery School</title><link rel="stylesheet" href="/connection.css"><main><h1>Review on the studio computer.</h1><p>Trajectory Studio, MLflow and reference uploads are available in the presenter’s local school. This hosted demo keeps those private.</p><a href="/">Return to the school</a></main></html>');
await mkdir('dist/vendor/three', {recursive: true});
await cp('node_modules/three/build', 'dist/vendor/three', {recursive: true});
await cp('node_modules/three/examples/jsm', 'dist/vendor/three/addons', {recursive: true});
const commit = process.env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
await writeFile('dist/deployment.json', JSON.stringify({commit, mode:'hosted-ui-private-companion', built_at:new Date().toISOString()})+'\n');
console.log(`Netlify assets prepared for ${commit}`);
