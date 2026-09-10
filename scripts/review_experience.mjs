import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const base = new URL(process.env.ASTRAL_URL || 'http://127.0.0.1:5188');
if (!['127.0.0.1','localhost','[::1]'].includes(base.hostname)) throw Error('This smoke review targets a local clone only.');
const output = path.join(root, 'output/playwright/experience-review', new Date().toISOString().replaceAll(':','-'));
await mkdir(output, {recursive:true});
const git = (...values) => execFileSync('git', values, {cwd:root, encoding:'utf8'}).trim();
const report = {
  reviewed_at:new Date().toISOString(), sha:git('rev-parse','HEAD'),
  worktree_changes:git('status','--porcelain','--untracked-files=all'),
  scope:'Isolated agent review: first-action visibility and input-to-next-frame timing. No model requests, learner outcomes, or audio-device latency measurement.',
  source_hashes:{}, paths:[],
  unverified_gates:['Input to corresponding visible/audio state update (frame timing is diagnostic only)','Astra creates a bounded playable change','Preview/apply/undo preserves learner state','Play continues during inference','Unexpected intent changes playable behavior','Subjective visual quality and audible responsiveness','Remote/public replay']
};
let browser;
try {
  if (args.includes('--require-clean') && report.worktree_changes) throw Error('Checkout contains modified or untracked files; commit the reviewed artifact first.');
  for (const tracked of git('ls-files','-z','public/').split('\0').filter(Boolean)) {
    const name = tracked.slice('public/'.length);
    const response = await fetch(new URL(name, base));
    if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
    const served = Buffer.from(await response.arrayBuffer());
    const local = await readFile(path.join(root,'public',name));
    if (!served.equals(local)) throw Error(`${name}: server differs from checkout`);
    report.source_hashes[name] = createHash('sha256').update(served).digest('hex');
  }
  browser = await chromium.launch({headless:true});
  report.browser = browser.version();
  for (const pathway of ['music','movement','ideas']) {
    const context = await browser.newContext({viewport:{width:1080,height:592}});
    await context.addInitScript(() => {
      window.__reviewFrames = [];
      document.addEventListener('click', event => {
        const started = performance.now();
        const target = event.target.closest('button');
        if (!target) return;
        const label = target.getAttribute('aria-label') || target.textContent.trim();
        requestAnimationFrame(() => window.__reviewFrames.push({label,input_to_next_frame_ms:performance.now()-started}));
      }, true);
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/project', route => route.abort('blockedbyclient'));
    await page.goto(new URL(`/?path=${pathway}&actor=agent_review`,base).href);
    const action = pathway === 'music' ? page.getByRole('button',{name:'Play C4',exact:true})
      : pathway === 'movement' ? page.getByRole('button',{name:/^(Play|Continue)$/}).first()
      : page.getByRole('button',{name:'Shape my first thought',exact:true});
    await action.waitFor({state:'visible',timeout:15000});
    const box = await action.boundingBox();
    const entry = {pathway,first_action:await action.getAttribute('aria-label') || await action.innerText(),
      first_action_in_viewport:!!box && box.x>=0 && box.y>=0 && box.x+box.width<=1080 && box.y+box.height<=592,
      errors, screenshots:[`${pathway}-before.png`,`${pathway}-after.png`]};
    report.paths.push(entry);
    await page.screenshot({path:path.join(output,entry.screenshots[0])});
    await action.click();
    await page.waitForFunction(() => window.__reviewFrames.length > 0);
    entry.frame_observations = await page.evaluate(() => window.__reviewFrames);
    if (pathway === 'ideas') await page.locator('textarea[name="interpretation"]').fill('Agent QA: I can choose my response.');
    if (pathway === 'movement') await page.getByRole('button',{name:'Stop',exact:true}).click();
    await page.screenshot({path:path.join(output,entry.screenshots[1])});
    await context.close();
  }
  report.result = report.paths.every(item=>item.first_action_in_viewport && !item.errors.length) ? 'bounded_checks_passed' : 'finding';
  if (report.result === 'finding') process.exitCode = 1;
} catch (error) {
  report.result = 'incomplete'; report.error = error.message; process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({report:path.join(output,'report.json'),...report},null,2));
}
