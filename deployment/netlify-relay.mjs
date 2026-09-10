import {createHmac, timingSafeEqual} from 'node:crypto';
const COOKIE = '__Host-mystery-demo';
const TTL = 4 * 60 * 60;
const MAX_BODY = 120 * 1024;
export const json = (body, status=200, headers={}) => new Response(JSON.stringify(body), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function equal(a,b) { if(typeof a!=='string'||typeof b!=='string')return false; const aa=Buffer.from(a), bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); }
function signature(value, secret) { return createHmac('sha256',secret).update(value).digest('base64url'); }
export function sessionCookie(secret, now=Date.now()) { const expires=String(Math.floor(now/1000)+TTL); return `${expires}.${signature(expires,secret)}`; }
export function validSession(cookie, secret, now=Date.now()) {
  const value=(cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  const [expires,sig,...extra]=value.split('.');
  return !extra.length && /^\d+$/.test(expires) && Number(expires)>now/1000 && Number(expires)<=now/1000+TTL && equal(sig,signature(expires,secret));
}
export function allowedRoute(method,path) {
  if(method==='GET') return /^\/api\/(state|artifacts|jobs\/[a-zA-Z0-9-]+|artifacts\/[a-zA-Z0-9-]+|coach\/status)$/.test(path);
  if(method==='POST') return /^\/api\/(events|reflections|artifacts|project|coach|jobs\/[a-zA-Z0-9-]+\/cancel)$/.test(path);
  return false;
}
async function limitedBody(request) {
  if(Number(request.headers.get('content-length'))>MAX_BODY) throw new Error('too_large');
  const reader=request.body?.getReader(); if(!reader)return '';
  let size=0; const chunks=[];
  try { for(;;) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY)throw new Error('too_large');chunks.push(value);} }
  finally {await reader.cancel();}
  return Buffer.concat(chunks).toString('utf8');
}
export async function relay(request, env, fetchImpl=fetch) {
  const url=new URL(request.url), path=url.pathname;
  const secret=env('MYSTERY_SESSION_SECRET'), code=env('MYSTERY_DEMO_CODE');
  const token=env('MYSTERY_COMPANION_TOKEN'), upstream=env('MYSTERY_COMPANION_URL');
  if(!secret || secret.length<32 || !code || code.length<16 || !token || token.length<32 || !upstream)
    return json({error:'Companion is not configured. Local play remains available.',code:'companion_unconfigured'},503);
  let base; try {base=new URL(upstream);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error();}
  catch{return json({error:'Invalid companion configuration'},503);}
  // Browser mutations must originate at this exact deployment, including login.
  if(request.method!=='GET' && request.headers.get('origin')!==url.origin) return json({error:'Same-origin request required'},403);
  if(path==='/api/connection' && request.method==='POST') {
    let body;try{body=JSON.parse(await limitedBody(request));}catch{return json({error:'Invalid connection request'},400);}
    if(!equal(body?.code,code))return json({error:'Invalid demo code'},401);
    return json({connected:true,scope:'trusted-presenter-demo',expires_in:TTL},200,{'Set-Cookie':`${COOKIE}=${sessionCookie(secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`});
  }
  if(!validSession(request.headers.get('cookie'),secret))return json({error:'Connect this device at /connect.html',code:'connection_required'},401);
  if(!allowedRoute(request.method,path)||url.search) return json({error:'Route is not exposed by the demo gateway'},404);
  let body;
  if(request.method==='POST') {
    if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'JSON required'},415);
    try{body=await limitedBody(request);const parsed=JSON.parse(body);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error();}
    catch{return json({error:'Invalid or oversized JSON'},413);}
  }
  try {
    const response=await fetchImpl(new URL(path,base),{method:request.method,headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!(response.headers.get('content-type')||'').includes('application/json'))return json({error:'Companion returned an invalid response'},502);
    const data=await response.text();
    if(Buffer.byteLength(data)>2*1024*1024)return json({error:'Companion response too large'},502);
    return new Response(data,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch {return json({error:'Companion is unavailable. Keep playing; retry coaching later.',code:'companion_unavailable'},503);}
}
