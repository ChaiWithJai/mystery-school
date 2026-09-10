const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.DEMO_BASE_URL || 'http://127.0.0.1:5210';
const out=process.env.DEMO_EVIDENCE_DIR || '/tmp';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?path=ideas&actor=agent_review');
 await page.getByRole('button',{name:'Enter the world',exact:true}).click();
 await page.screenshot({path:out+'/discovery-start.png'});
 const started=Date.now();await page.keyboard.down('w');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('astral.learning-path-drafts.v1')||'{}').ideas?.lab?.story_world?.discoveryTrail?.collected?.length===10,{},{timeout:60000});await page.keyboard.up('w');const collectionSeconds=(Date.now()-started)/1000;
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('astral.learning-path-drafts.v1')).ideas.lab.story_world);
 if(state.discoveryTrail.collected.length!==10)throw Error('Expected10 discoveries, got '+JSON.stringify(state));
 await page.screenshot({path:out+'/discovery-finish.png'});
 await page.getByRole('button',{name:'Make this yours',exact:true}).click();await page.getByLabel('Write the story in your own words',{exact:true}).fill('Synthetic QA: I decide how to respond.');
 await page.locator('.story-world__writer').getByRole('button',{name:'Return to the world',exact:true}).click();
 await page.locator('.universe-tools>summary').click();await page.locator('[data-panel=save]').click();await page.locator('[data-save]').click();
 await page.waitForURL(u=>u.searchParams.has('artifact'));const url=page.url();await page.reload();await page.locator('.story-world').waitFor();
 const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('astral.learning-path-drafts.v1')).ideas.lab.story_world);
 if(restored.discoveryTrail.collected.length!==10)throw Error('Lost discoveries on reload');
 if(errors.length)throw Error(errors.join(';'));
 const report={status:'passed',url,secondsToCollect:collectionSeconds,state,restored,errors};await writeFile(out+'/discovery-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
