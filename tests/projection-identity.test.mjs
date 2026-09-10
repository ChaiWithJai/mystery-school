import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

function harness(){
  const nodes=new Map(),events=[],requests=[];
  const element=()=>({children:[],value:'',checked:true,innerHTML:'',classList:{add(){},remove(){}},
    appendChild(child){this.children.push(child);},replaceChildren(){this.children=[];},focus(){}});
  const $=selector=>{if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);};
  const ctx={$,events,requests,pollingJob:false,currentJob:null,displayedJob:null,activeResult:null,
    selected:0,entered:true,activePathway:null,correction:null,projectionArtifact:null,
    WORLDS:[{id:'futures',title:'Authored scene',story:'Authored story',question:'Authored question',
      evidence:[],choices:[]}],pathwayDoors:[{id:'music',islandIndex:0}],drafts:new Map(),
    api:async(path,body)=>{requests.push({path,body});return {};},renderJob(){},refreshState:async()=>{},
    toast(){},syncLearningMap(){},openDrawer(){},openJournal(){},renderStory(){},wantsGears:()=>false,
    location:{href:'http://localhost/?actor=agent_review'},URL,history:{replaceState(){}},
    localStorage:{setItem(){},removeItem(){}},sessionId:'synthetic-test',world:null,visual:{},
    track:(type,payload)=>events.push({type,payload}),esc:String,
    document:{createElement:element,querySelectorAll:()=>[]}};
  vm.createContext(ctx);
  // Run the actual app functions, without module startup, network, or model workers.
  for(const name of ['pollJob','applyProjection','selectWorld','learningOpened','showOverview',
    'renderLesson','openReflection','openEvidence','updateProjectButton']){
    const line=source.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('));
    assert.ok(line,`App function ${name} exists`);
    vm.runInContext(line,ctx);
  }
  return ctx;
}

const visibleJob={id:'A',world:'futures',status:'succeeded',result:{title:'Visible A',story:'A story',
  question:'A question',evidence:[],choices:[{label:'A choice',consequence:'A outcome'}]}};

test('background poll cannot relabel displayed choices, reflections, or evidence',async()=>{
  const ctx=harness();let resolvePoll;
  const response=new Promise(resolve=>{resolvePoll=resolve;});
  ctx.api=async(path,body)=>{
    if(path==='/api/jobs/B')return response;
    ctx.requests.push({path,body});return {};
  };
  ctx.currentJob={id:'B',status:'running'};
  const polling=ctx.pollJob('B');
  ctx.applyProjection(visibleJob);
  assert.equal(ctx.currentJob.id,'B');
  assert.equal(ctx.currentJob.status,'running');
  ctx.updateProjectButton();
  assert.equal(ctx.$('#project').disabled,true,'Opening A must not enable another request while B runs');
  resolvePoll({id:'B',status:'succeeded',result:{title:'Background B'}});
  await polling;
  assert.equal(ctx.activeResult.title,'Visible A');
  assert.equal(ctx.displayedJob.id,'A');
  assert.equal(ctx.currentJob.id,'B');
  ctx.$('#choices').children[0].onclick();
  assert.equal(ctx.events.find(e=>e.type==='choice.select').payload.job_id,'A');
  ctx.openReflection();
  ctx.$('#reflection').value='Synthetic reflection about A';
  await ctx.$('#save-reflection').onclick();
  assert.equal(ctx.requests.find(r=>r.path==='/api/reflections').body.job_id,'A');
  ctx.openEvidence();
  assert.match(ctx.$('#drawer-body').innerHTML,/review\.html\?sample=A/);
  assert.doesNotMatch(ctx.$('#drawer-body').innerHTML,/sample=B/);
});

test('authored scene, pathway, and overview clear only displayed identity',()=>{
  const ctx=harness();ctx.currentJob={id:'B',status:'running'};
  for(const leave of [()=>ctx.selectWorld(0),()=>ctx.learningOpened('music'),()=>ctx.showOverview()]){
    ctx.applyProjection(visibleJob);
    assert.equal(ctx.displayedJob.id,'A');
    leave();
    assert.equal(ctx.displayedJob,null);
    assert.equal(ctx.activeResult,null);
    assert.equal(ctx.currentJob.id,'B');
  }
  ctx.selectWorld(0);ctx.openEvidence();
  assert.doesNotMatch(ctx.$('#drawer-body').innerHTML,/\?sample=/);
});
