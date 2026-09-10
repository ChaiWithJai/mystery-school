import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

function harness({artifact=false,count=2}={}){
  const nodes=new Map(),requests=[],events=[];
  function element(){
    return {value:'',checked:false,isConnected:true,disabled:false,listeners:{},
      addEventListener(type,fn){this.listeners[type]=fn;},prepend(){},after(){},focus(){},
      set innerHTML(html){
        this.html=html;
        for(const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){
          const node=element();node.checked=/\schecked(?:\s|>)/.test(match[0]);nodes.set('#'+match[1],node);
        }
      },get innerHTML(){return this.html||'';}};
  }
  nodes.set('#drawer-body',element());
  const ctx={$:s=>nodes.get(s)||null,selected:0,projectionArtifact:artifact?{id:'artifact-A',pathway:'music'}:null,
    correction:null,currentJob:null,WORLDS:[{id:'futures',question:'Synthetic question'}],drafts:new Map(),
    state:{references:Array.from({length:count},(_,i)=>({id:'image-'+i})),reflections:[]},
    sessionId:'synthetic-test',visual:{},world:null,esc:String,toast:assert.fail,
    openDrawer(){},renderJob(){},pollJob(){},localStorage:{setItem(){}},
    document:{createElement:element,querySelectorAll:()=>[]},
    api:async(path,body)=>{requests.push({path,body});return {id:'synthetic-job',status:'queued'};},
    track:async(type,payload)=>{events.push({type,payload});}};
  vm.createContext(ctx);
  for(const name of ['openImagine','updateProjectButton']){
    vm.runInContext(source.split('\n').find(line=>line.startsWith('function '+name+'(')),ctx);
  }
  vm.runInContext(source.slice(source.indexOf('async function startProjection(){'),source.indexOf('\nfunction renderJob(')),ctx);
  ctx.openImagine();
  ctx.$('#question').value='Synthetic question';ctx.$('#premise').value='Synthetic premise';
  ctx.$('#confirm-premise').checked=true;
  return {ctx,requests,events};
}

test('saved images are unchecked by default and toggling invalidates confirmation',()=>{
  const {ctx}=harness();
  assert.match(ctx.$('#drawer-body').innerHTML,/Include my saved reference images \(2\)/);
  const input=ctx.$('#use-references');assert.equal(input.checked,false);
  for(const checked of [true,false]){
    ctx.$('#confirm-premise').checked=true;input.checked=checked;input.listeners.change();
    assert.equal(ctx.$('#confirm-premise').checked,false);
    assert.equal(ctx.$('#project').disabled,true);
  }
});

for(const scenario of [
  {name:'unchecked general',checked:false,expected:[]},
  {name:'checked general',checked:true,expected:['image-0','image-1']},
  {name:'artifact',artifact:true,checked:false,expected:[]},
  {name:'no uploads',count:0,checked:false,expected:[]},
]){
  test(`${scenario.name} captures only chosen image IDs before awaiting telemetry`,async()=>{
    const {ctx,requests,events}=harness(scenario);
    const checkbox=ctx.$('#use-references');
    if(scenario.artifact||scenario.count===0)assert.equal(checkbox,null);
    else checkbox.checked=scenario.checked;
    let release;
    ctx.track=(type,payload)=>{events.push({type,payload});return new Promise(resolve=>{release=resolve;});};
    const pending=ctx.startProjection();
    assert.equal(requests.length,0,'Project POST waits for confirmation event');
    // Changing the list, checkbox or artifact route cannot rewrite the captured request.
    ctx.state.references[0]&&(ctx.state.references[0].id='changed-id');
    ctx.state.references.push({id:'unrelated-later-upload'});
    if(checkbox)checkbox.checked=!scenario.checked;
    ctx.projectionArtifact=null;
    release();await pending;
    assert.equal(requests.length,1);assert.equal(requests[0].path,'/api/project');
    assert.deepEqual(Array.from(requests[0].body.reference_ids),scenario.expected);
    assert.deepEqual(Array.from(events[0].payload.reference_ids),scenario.expected);
    assert.equal(requests[0].body.learning_artifact_id,scenario.artifact?'artifact-A':undefined);
  });
}

test('artifact request excludes images even if a checked control is unexpectedly present',async()=>{
  const {ctx,requests}=harness({artifact:true});const original=ctx.$;
  ctx.$=selector=>selector==='#use-references'?{checked:true}:original(selector);
  await ctx.startProjection();
  assert.deepEqual(Array.from(requests[0].body.reference_ids),[]);
});
