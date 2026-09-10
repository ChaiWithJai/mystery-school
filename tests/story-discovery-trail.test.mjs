import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {normalizeDiscoveryTrail,reduceDiscoveryTrail,mountDiscoveryTrail,STORY_DISCOVERIES} from '../public/story-discovery-trail.js';

function fixture(options={}) {
  const elements=[];
  const doc={defaultView:{matchMedia:()=>({matches:true}),navigator:{userActivation:{isActive:false}}},createElement(tag){const e={tag,ownerDocument:doc,children:[],attributes:{},handlers:{},append(...items){this.children.push(...items);items.forEach(i=>i.parent=this);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){this.handlers[k]=f;},removeEventListener(k){delete this.handlers[k];},remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}};elements.push(e);return e;}};
  const root=doc.createElement('main'),scene=new THREE.Scene(),events=[],changes=[];
  const trail=mountDiscoveryTrail({THREE,scene,root,onEvent:(type,payload)=>events.push({type,payload}),onChange:s=>changes.push(s),...options});
  return {trail,scene,events,changes,elements,doc};
}
test('discovery normalization retains unique known IDs without promoting them to skill evidence',()=>{
  assert.deepEqual(normalizeDiscoveryTrail({collected:['notice','bad','notice','question'],mastery:100}),{version:1,collected:['notice','question']});
  const initial={version:1,collected:['notice']};assert.deepEqual(reduceDiscoveryTrail(initial,{type:'collect',id:'notice'}),initial);
  assert.deepEqual(reduceDiscoveryTrail(initial,{type:'collect',id:'bad'}),initial);assert.deepEqual(initial.collected,['notice']);
});
test('mount, idle, inactive movement and teleport do not collect',()=>{
  const {trail,changes}=fixture();trail.update({x:0,z:7},.016,0,{active:true});trail.update({x:0,z:7},.016,0,{active:true});
  trail.update({x:0,z:6.9},.016,0,{active:false});trail.update({x:0,z:3},.016,0,{active:true});
  assert.equal(changes.length,0);assert.deepEqual(trail.getState().collected,[]);trail.dispose();
});
test('walking picks up ten discoveries once, restores IDs and only explicit finish hands off',()=>{
  let finishes=0;const {trail,events,elements,scene}=fixture({onFinish:()=>finishes++});
  for(let z=9;z>=-12;z-=.2)trail.update({x:0,z},.05,9-z,{active:true});
  assert.equal(trail.getState().collected.length,10);assert.equal(events.filter(e=>e.type==='discovery.collected').length,10);
  assert.ok(events.every(e=>e.payload.evidence_kind==='exploration_only'));assert.equal(finishes,0);
  const finish=elements.find(e=>e.className==='discovery-trail__finish');assert.equal(finish.hidden,false);finish.handlers.click();assert.equal(finishes,1);
  const saved=trail.getState();trail.setState(saved);assert.deepEqual(trail.getState(),saved);saved.collected.length=0;assert.equal(trail.getState().collected.length,10);
  trail.dispose();assert.equal(scene.children.length,0);
});
test('audio cannot start without the explicit active user gesture',async()=>{
  const {trail,doc}=fixture();let allocations=0;doc.defaultView.AudioContext=class{constructor(){allocations++;}};
  assert.equal(await trail.enableAudio(),false);assert.equal(allocations,0);trail.dispose();
});
test('source prompts are ten authored invitations and saved discoveries never write learner words',()=>{
  assert.equal(STORY_DISCOVERIES.length,10);assert.deepEqual(STORY_DISCOVERIES.map(s=>s.z),[7,5,3,1,-1,-3,-5,-7,-9,-11]);
  assert.equal('learnerStory' in normalizeDiscoveryTrail({learnerStory:'Invented'}),false);
});
