const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.DEMO_BASE_URL || 'http://127.0.0.1:5210';
const out=process.env.DEMO_EVIDENCE_DIR || '/tmp';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1080,height:592}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/demo-60.html');await page.screenshot({path:out+'/presenter-start-polish.png'});
 await page.getByRole('button',{name:'Start 60-second demo',exact:true}).waitFor({timeout:60000});await page.getByRole('button',{name:'Start 60-second demo',exact:true}).click();
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'Next chapter',exact:true}).click();
 if(await page.locator('.demo-time').innerText()!=='25 / 60 s')throw Error('Wrong boxing chapter');
 await page.waitForTimeout(1600);if(await page.locator('.demo-time').innerText()!=='25 / 60 s')throw Error('Chapter navigation did not hold');
 const frame=page.frameLocator('iframe[title="movement / live school"]');await frame.locator('.boxing-journey-intro').waitFor();
 await page.screenshot({path:out+'/presenter-boxing-polish.png'});
 const controls=await page.locator('.demo-controls').boundingBox();if(controls.x<0||controls.y+controls.height>592)throw Error('Presenter controls outside viewport');
 await page.getByRole('button',{name:'Next chapter',exact:true}).click();if(await page.locator('.demo-time').innerText()!=='38 / 60 s')throw Error('World chapter missing');
 await page.getByRole('button',{name:'Previous chapter',exact:true}).click();
 await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForTimeout(1200);await page.getByRole('button',{name:'Pause',exact:true}).click();
 if(await page.locator('.demo-time').innerText()==='25 / 60 s')throw Error('Resume clock did not move');
 if(errors.length)throw Error(errors.join(';'));
 const report={status:'passed',viewport:'1080x592',controls,clock:await page.locator('.demo-time').innerText(),errors};await writeFile(out+'/presenter-polish-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
