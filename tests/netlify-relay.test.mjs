import test from 'node:test';
import assert from 'node:assert/strict';
import {relay,sessionCookie,validSession,allowedRoute} from '../deployment/netlify-relay.mjs';
import {requestLocalCue} from '../public/local-coach-client.js';
const vars={MYSTERY_SESSION_SECRET:'s'.repeat(40),MYSTERY_DEMO_CODE:'d'.repeat(24),MYSTERY_COMPANION_TOKEN:'t'.repeat(40),MYSTERY_COMPANION_URL:'https://companion.example'};
const env=k=>vars[k];
const cookie=()=>`__Host-mystery-demo=${sessionCookie(vars.MYSTERY_SESSION_SECRET)}`;
const req=(path,options={})=>new Request('https://school.example'+path,options);
test('unit: signed session expires and rejects tampering',()=>{
 const now=Date.now(), valid=`__Host-mystery-demo=${sessionCookie(vars.MYSTERY_SESSION_SECRET,now)}`;
 assert.equal(validSession(valid,vars.MYSTERY_SESSION_SECRET,now),true);
 assert.equal(validSession(valid+'x',vars.MYSTERY_SESSION_SECRET,now),false);
 assert.equal(validSession(valid,vars.MYSTERY_SESSION_SECRET,now+14401000),false);
});
test('unit: only bounded application routes are exposed',()=>{
 for(const path of ['/api/diagnostics','/api/samples','/api/sidecar-records','/api/jobs/id/artifacts/prompt.txt','/references/x','/api/jobs/../state'])assert.equal(allowedRoute('GET',path),false);
 assert.equal(allowedRoute('POST','/api/project'),true);
});
test('integration: no inference or records before connection; misconfiguration is explicit',async()=>{
 const noFetch=()=>{throw Error('must not fetch');};
 assert.equal((await relay(req('/api/state'),env,noFetch)).status,401);
 assert.equal((await relay(req('/api/state'),()=>undefined,noFetch)).status,503);
});
test('integration: login requires matching origin and sets protected cookie',async()=>{
 const options={method:'POST',headers:{Origin:'https://school.example'},body:JSON.stringify({code:vars.MYSTERY_DEMO_CODE})};
 assert.equal((await relay(req('/api/connection',{...options,headers:{Origin:'https://evil.example'}}),env)).status,403);
 const response=await relay(req('/api/connection',options),env);
 assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await relay(req('/api/connection',{...options,body:'{"code":123}'}),env)).status,401);
});
test('integration: relay injects private token only upstream, blocks redirects and arbitrary routes',async()=>{
 let called=false;
 const response=await relay(req('/api/state',{headers:{cookie:cookie()}}),env,async(url,init)=>{
  called=true;assert.equal(String(url),'https://companion.example/api/state');assert.equal(init.headers.Authorization,'Bearer '+vars.MYSTERY_COMPANION_TOKEN);assert.equal(init.redirect,'error');
  return new Response('{"artifacts":[]}',{headers:{'content-type':'application/json'}});
 });
 assert.equal(called,true);assert.equal(response.status,200);assert.equal(response.headers.has('authorization'),false);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal((await relay(req('/api/diagnostics',{headers:{cookie:cookie()}}),env)).status,404);
 assert.equal((await relay(req('/api/state?url=https://evil.example',{headers:{cookie:cookie()}}),env)).status,404);
});
test('integration: unavailable companion and malformed bodies do not claim success',async()=>{
 assert.equal((await relay(req('/api/state',{headers:{cookie:cookie()}}),env,async()=>{throw Error('offline');})).status,503);
 const response=await relay(req('/api/coach',{method:'POST',headers:{cookie:cookie(),origin:'https://school.example','content-type':'application/json'},body:'x'.repeat(130000)}),env);
 assert.equal(response.status,413);
});
test('unit: cue client discards wrong or superseded attempt identity',async()=>{
 const attempt={session_id:'s',attempt_id:'a',state_version:3};
 const fetchImpl=async()=>Response.json({...attempt,cue:'Replay'});
 assert.equal((await requestLocalCue(attempt,{fetchImpl})).status,'ready');
 assert.equal((await requestLocalCue(attempt,{fetchImpl,isCurrent:()=>false})).status,'stale');
 assert.equal((await requestLocalCue(attempt,{fetchImpl:async()=>Response.json({...attempt,state_version:2})})).status,'stale');
});
test('unit: hosted capabilities disable local-only controls without exposing APIs',async()=>{
 const {applyHostedCapabilities,HOSTED_CAPABILITIES}=await import('../public/hosted-capabilities.js');
 const link={dataset:{},tagName:'A',setAttribute(){},removeAttribute(name){this.removed=name;}};
 const button={dataset:{},tagName:'BUTTON',disabled:false,setAttribute(){}};
 applyHostedCapabilities({querySelectorAll:()=>[link,button]});
 assert.equal(HOSTED_CAPABILITIES.referenceUploads,false);assert.equal(link.hidden,true);assert.equal(link.removed,'href');assert.equal(button.disabled,true);
});
