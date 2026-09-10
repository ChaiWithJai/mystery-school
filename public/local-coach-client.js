// Call between attempts, never in the animation or pose-estimation loop.
export async function requestLocalCue(attempt,{fetchImpl=fetch,isCurrent=()=>true,signal}={}) {
  const response=await fetchImpl('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt),signal:signal||AbortSignal.timeout(22000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Local coaching unavailable');
  if(result.attempt_id!==attempt.attempt_id||result.state_version!==attempt.state_version||result.session_id!==attempt.session_id||!isCurrent(attempt))return {status:'stale',result:null};
  return {status:'ready',result};
}
