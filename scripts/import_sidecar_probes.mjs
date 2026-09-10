import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const base=process.env.ASTRAL_URL||'http://127.0.0.1:5188';
const path='docs/sidecar-three-path-probes.json';
const commits=['77c59d0783da83b94e449d3b5499c9d3ee715368','01201a49c79c46689ca83b7af321a04540badce7'];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const request=async(route,body)=>{
  const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const value=await response.json();assert.ok(response.ok,`${route}: ${JSON.stringify(value)}`);return value;
};
let parent=null;const imported=[];
for(const sha of commits){
  const raw=git('show',`${sha}:${path}`), document=JSON.parse(raw);
  const publishedAt=git('show','-s','--format=%cI',sha).trim();
  const url=`https://github.com/ChaiWithJai/mystery-school/blob/${sha}/${path}`;
  const envelope={
    source_system:'mystery-school-git',source_event_id:`git:${sha}:${path}`,
    observed_at:publishedAt,actor_kind:'agent_review',actor_id:'m4-sidecar-reported-in-buzz',actor_role:'evaluator_sidecar',
    reviewed_sha:document.base_commit,session_id:'MS-TASKS-M4',task_id:'three-path-probes',capture_method:'imported',
    input:{assignment:document.assignment},output:document,
    events:[{type:'published_review_artifact',sha,path,sha256:createHash('sha256').update(raw).digest('hex'),source_url:url}],
    decision:'Preserve all three pathways. These are proposed verification probes, not executed learner tests. Source attribution is from the bounded Buzz handoff and Git artifact; no raw sidecar tool transcript was supplied.',
    checks:[{name:'probe_execution',status:'not_observed',basis:'The source document explicitly marks the probes proposed_not_executed.'}],
    source_refs:[{url,label:'Exact published sidecar artifact'}],source_url:url,
    model:null,usage:null,cost_usd:null,invocation_id:null,
    timing:{source_time_kind:'git_commit_publication',original_activity_times:'unavailable'},
    parent_finding_ids:parent?[parent]:[]
  };
  const first=await request('/api/sidecar-records',envelope);
  const retry=await request('/api/sidecar-records',envelope);
  assert.deepEqual(retry,first,'Identical reimport must return the same immutable record');
  assert.deepEqual(await request('/api/sidecar-records/'+first.id),first,'Readback matches');
  const samples=await request('/api/samples');
  assert.equal(samples.filter(sample=>sample.id===first.id).length,1,'One review sample');
  assert.equal(samples.find(sample=>sample.id===first.id).trace_id,first.trace_id);
  assert.equal(first.model,null);assert.equal(first.usage,null);assert.equal(first.cost_usd,null);
  parent=first.id;imported.push({sha,id:first.id,trace_id:first.trace_id,review_url:`${base}/review.html?sample=${first.id}`});
}
console.log(JSON.stringify({scope:'Imported published agent review artifacts, not live inference or executed learner tests',imported},null,2));
