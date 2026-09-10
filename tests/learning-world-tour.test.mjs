import test from 'node:test';
import assert from 'node:assert/strict';
import {showLearningWorldTour,LEARNING_WORLD_TOUR_MODES,carryTourSoundtrack} from '../public/learning-world-tour.js';
function environment(){const listeners=new Map();class Element{constructor(){this.inert=false;this.isConnected=true;this.listeners={};}setAttribute(){}querySelector(){return this.button||(this.button=new Element());}querySelectorAll(){return [this.querySelector()];}getClientRects(){return [{}];}focus(){document.activeElement=this;}remove(){this.isConnected=false;document.body.children=document.body.children.filter(e=>e!==this);}}const previous=new Element(),alreadyInert=new Element();alreadyInert.inert=true;globalThis.document={activeElement:previous,querySelector:()=>null,createElement:()=>new Element(),body:{children:[previous,alreadyInert],append(el){this.children.push(el);}}};globalThis.window={addEventListener(type,fn,capture){assert.equal(capture,true);listeners.set(type,fn);},removeEventListener(type){listeners.delete(type);}};return{previous,alreadyInert,listeners,key(key,type='keydown'){const event={key,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};listeners.get(type)?.(event);return event;}};}
test('tour presents the three modes without changing their order',()=>assert.deepEqual(LEARNING_WORLD_TOUR_MODES,['Simulation','Mirror','Life']));
test('Escape restores prior inert state/focus and never continues',()=>{const e=environment();let cancelled=0,continued=0;const cleanup=showLearningWorldTour({onCancel:()=>cancelled++,onContinue:()=>continued++});assert.equal(e.previous.inert,true);const key=e.key('Escape');assert.equal(key.prevented,true);assert.equal(key.stopped,true);assert.equal(cancelled,1);assert.equal(continued,0);assert.equal(e.previous.inert,false);assert.equal(e.alreadyInert.inert,true);assert.equal(document.activeElement,e.previous);assert.equal(e.listeners.size,0);cleanup();});
test('piano keys are captured and Tab stays on the one primary action',()=>{const e=environment();const cleanup=showLearningWorldTour();const button=document.activeElement;for(const type of ['keydown','keyup']){const key=e.key('l',type);assert.equal(key.stopped,true);assert.equal(key.prevented,true);}e.key('Tab');assert.equal(document.activeElement,button);cleanup();});
test('continue is explicit, called once, and cleanup is idempotent',()=>{const e=environment();let count=0;const cleanup=showLearningWorldTour({onContinue:()=>count++});assert.equal(count,0);const button=document.activeElement;button.onclick();button.onclick();cleanup();assert.equal(count,1);assert.equal(document.body.children.length,2);assert.equal(e.listeners.size,0);});
test('opening another tour disposes the previous modal before claiming focus',()=>{environment();let cancelled=0;showLearningWorldTour({onCancel:()=>cancelled++});const cleanup=showLearningWorldTour();assert.equal(document.body.children.length,3);assert.equal(cancelled,0);cleanup();assert.equal(document.body.children.length,2);});
test('tour carries the same soundtrack and restores it without recreating playback',()=>{
  const parent={isConnected:true,insertBefore(node,sibling){this.restored={node,sibling};node.parentNode=this;}},sibling={parentNode:parent};
  const soundtrack={parentNode:parent,nextSibling:sibling,isConnected:true};
  const root={append(node){this.child=node;node.parentNode=this;}};
  const restore=carryTourSoundtrack(root,{querySelector:()=>soundtrack});
  assert.equal(root.child,soundtrack);
  restore();
  assert.equal(parent.restored.node,soundtrack);
  assert.equal(parent.restored.sibling,sibling);
});
test('Stop during the tour does not resurrect a removed soundtrack',()=>{
  let restored=false;
  const parent={isConnected:true,insertBefore(){restored=true;}};
  const soundtrack={parentNode:parent,isConnected:true};
  const restore=carryTourSoundtrack({append(){}},{querySelector:()=>soundtrack});
  soundtrack.isConnected=false;
  restore();
  assert.equal(restored,false);
});
