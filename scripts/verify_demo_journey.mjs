#!/usr/bin/env node
// Browser evidence, not a learner study. No model calls or fabricated camera input.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.DEMO_BASE_URL||'http://127.0.0.1:5210';
const out=resolve(process.env.DEMO_EVIDENCE_DIR||'output/demo-journey');
const fixture=process.env.DEMO_VIDEO_FIXTURE;
const report={base,at:new Date().toISOString(),actor:'agent_review',checks:[],errors:[],modelCallsBlocked:0};
const record=(name,ok,detail)=>report.checks.push({name,status:ok?'verified':'incomplete',detail});
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
let page;
const visible=async selector=>page.locator(selector).first().isVisible().catch(()=>false);
const shot=async name=>page.screenshot({path:resolve(out,name+'.png')});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route(/\/api\/(project|coach)(?:\?|$)/,route=>{report.modelCallsBlocked++;return route.abort();});
 page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>report.errors.push(e.message));
 // Fresh browser, no path or artifact query. Actor only labels synthetic QA.
 const entry=new URL(base);entry.search='?actor=agent_review';await page.goto(entry.href,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
 const direct=await visible('.piano-roll');record('default URL opens Runaway',direct,{url:page.url()});await shot('01-entry');
 if(!direct){const diagnostic=new URL(entry);diagnostic.searchParams.set('path','music');await page.goto(diagnostic.href,{waitUntil:'domcontentloaded'});await page.locator('.piano-roll').waitFor();report.checks.push({name:'diagnostic music route',status:'diagnostic-only',detail:'Explicit route does not satisfy default-entry requirement.'});}
 await page.keyboard.press('l');await page.waitForTimeout(200);
 const take=await page.evaluate(()=>JSON.parse(localStorage.getItem('astral.learning-path-drafts.v1')||'{}').music?.lab?.practice);
 record('physical L captures E6 without piano focus',take?.events?.some(e=>e.type==='on'&&e.midi===88)&&take.events.some(e=>e.type==='off'&&e.midi===88),take);await shot('02-piano');
 const intoRing=page.getByRole('button',{name:'Keep this. Into the ring →',exact:true});
 if(await intoRing.isVisible()){
  await intoRing.click();const tour=page.locator('.learning-world-tour');
  await page.locator('.learning-world-tour,.boxing-journey-intro').first().waitFor({state:'visible'});
  const shown=await tour.isVisible().catch(()=>false);record('guided three-mode tour',shown,'Manual transition alone does not prove the tour.');
  if(shown){
   await page.keyboard.press('Escape');await tour.waitFor({state:'hidden'});
   const cancelled=await visible('.piano-roll')&&await intoRing.isVisible()&&await intoRing.isEnabled();
   record('tour Escape retains piano and permits saving again',cancelled,{url:page.url()});
   if(!cancelled)throw Error('Tour cancel did not restore the playable piano and retry control.');
   await intoRing.click();await tour.waitFor({state:'visible'});
   record('repeat Save reopens tour after cancellation',true,{url:page.url()});
   await tour.getByRole('button').click();await tour.waitFor({state:'hidden'});
  }
  await page.locator('.boxing-journey-intro').waitFor();record('manual advance piano to boxing',true,{url:page.url()});
 }else record('manual advance piano to boxing',false,'No visible explicit transition.');
 if(await visible('.boxing-journey-intro')){
  await page.locator('.boxing-journey-intro [data-try]').click();await page.locator('.boxing-mirror').waitFor({state:'visible'});record('body map opens mirror',true);
 }
 if(await visible('.boxing-mirror')){
  if(fixture){await page.locator('.boxing-mirror input[type=file]').setInputFiles(resolve(fixture));await page.locator('.boxing-mirror.is-live').waitFor();const start=page.locator('.boxing-mirror [data-round]');if(await start.isEnabled()){const mediaDuration=await page.locator('.boxing-mirror-self').evaluate(v=>v.duration);if(!Number.isFinite(mediaDuration)||mediaDuration<41)throw Error('QA video must exceed 41 seconds; short clips are not looped or counted as a full practice.');report.fixture={path:resolve(fixture),duration:mediaDuration,kind:'source-video QA, not learner performance or evidence of selected technique'};await start.click();await page.waitForTimeout(41000);const rounds=await page.evaluate(()=>JSON.parse(localStorage.getItem('astral.learning-path-drafts.v1')||'{}').movement?.lab?.boxing_mirror?.practiceRounds||[]);record('40-second local video practice retained',rounds.some(r=>r.status==='elapsed'&&r.durationMs>=40000),rounds.map(({points,...r})=>({...r,positionSamples:points?.length})));}else record('40-second local video practice retained',false,'Practice control not enabled.');}
  else report.checks.push({name:'40-second local video practice',status:'not-run',detail:'Set DEMO_VIDEO_FIXTURE to an authorized local video. No camera input is simulated.'});
  if(await page.locator('.boxing-mirror-reflection').getAttribute('open')===null)await page.locator('.boxing-mirror-reflection>summary').click();await page.getByRole('textbox',{name:'My boxing reflection',exact:true}).fill('Synthetic source-video QA: observed a moving source demonstration; this is not my boxing performance.');await shot('03-boxing');const next=page.getByRole('button',{name:'Keep my observation →',exact:true});
  if(await next.isVisible()){await next.click();await page.locator('.story-world').waitFor();record('boxing advances to rendered story world',true);await shot('04-world');const text=await page.locator('.story-world__memory-observation').innerText();const link=await page.getByRole('link',{name:'Open exact saved artifact',exact:true}).getAttribute('href');record('world memory displays exact QA observation and source artifact',text.includes('Synthetic source-video QA:')&&!!link,{text,link});}else record('boxing advances to rendered story world',false,'No visible explicit transition.');
 }
 // Save through the visible UI, then verify the exact artifact URL in a fresh page.
 if(await visible('.story-world')){
  await page.locator('.universe-tools>summary').click();await page.locator('[data-panel=save]').click();await page.locator('#path-explanation').fill('Synthetic journey QA: inspect exact saved world and memory; no learning claim.');await page.locator('[data-save]').click();await page.waitForURL(u=>u.searchParams.has('artifact'));
  const exact=page.url(),id=new URL(exact).searchParams.get('artifact');const response=await context.request.get(new URL('/api/artifacts/'+id,base).href);const artifact=await response.json();
  const fresh=await context.newPage();await fresh.goto(exact,{waitUntil:'domcontentloaded'});await fresh.locator('.story-world').waitFor();const restoredExplanation=await fresh.locator('#path-explanation').inputValue();record('exact saved artifact reopens world',response.ok()&&artifact.id===id&&restoredExplanation===artifact.state?.explanation,{id,trace_id:artifact.trace_id,url:exact,stateKeys:Object.keys(artifact.state?.lab||{})});await fresh.screenshot({path:resolve(out,'05-exact-world.png')});record('reopened world displays exact memory text',await fresh.locator('.story-world__memory-observation').innerText()==='Synthetic source-video QA: observed a moving source demonstration; this is not my boxing performance.');await fresh.close();
  record('world memory retained on exact saved reopen',Array.isArray(artifact.state?.lab?.story_world?.memories)&&artifact.state.lab.story_world.memories.some(m=>m.observation?.text?.includes('Synthetic source-video QA:')),artifact.state?.lab?.story_world?.memories);
 }
}catch(error){report.errors.push(error.message);record('journey completed',false,error.message);if(page)await shot('failure').catch(()=>{});}
finally{await browser.close();report.status=report.errors.length||report.checks.some(c=>c.status==='incomplete')?'incomplete':'verified-scoped';await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='incomplete'?2:0;}
