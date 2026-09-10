import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReflection, mountRealWorldReflection} from '../public/real-world-reflection.js';
function dom() {
 const all=[];const doc={createElement(tag){const e={tag,ownerDocument:doc,children:[],handlers:{},attributes:{},append(...items){this.children.push(...items);items.forEach(i=>i.parentNode=this);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){this.handlers[k]=f;},removeEventListener(k){delete this.handlers[k];},fire(k){this.handlers[k]?.();},focus(){},remove(){}};all.push(e);return e;}};return {container:doc.createElement('main'),all};
}
test('only learner reports with an action and observed account become reported done; never verified',()=>{
 assert.equal(normalizeReflection({status:'reported_done'}).status,'draft');
 assert.equal(normalizeReflection({status:'reported_done',action:'Ask a friend'}).status,'planned');
 const s=normalizeReflection({status:'reported_done',action:'Ask',observation:'They paused.',verified:true,evidenceKind:'verified'});
 assert.equal(s.status,'reported_done');assert.equal(s.verified,false);assert.equal(s.evidenceKind,'learner_report');
});
test('plan, return, observation, interpretation and question stay distinct and restore exactly',()=>{
 const {container,all}=dom();const events=[];const api=mountRealWorldReflection(container,{onEvent:(type,payload)=>events.push({type,payload})});
 const click=text=>all.find(e=>e.textContent===text).fire('click');
 const input=(name,value)=>{const e=all.find(e=>e.name===name);e.value=value;e.fire('input');};
 click('Step outside the page ↗');input('action','  Ask my friend why they disagree.  ');click('Keep my plan');
 assert.equal(api.getState().status,'planned');assert.equal(api.getState().observation,'');
 assert.equal(all.find(e=>e.textContent==='I tried it. Keep my account →').disabled,true);
 input('observation','They paused and asked me a question.');click('I tried it. Keep my account →');
 assert.equal(api.getState().status,'reported_done');input('interpretation','Maybe they wanted to understand.');input('revisedBelief','Disagreement may be curiosity.');
 click('Carry a question →');input('question','Could I ask before defending?');click('See my journey →');
 const saved=api.getState();assert.equal(saved.evidenceKind,'learner_report');assert.equal(saved.verified,false);
 assert.equal(events.filter(e=>e.type==='reflection.reported').length,1);
 api.setState(saved);assert.deepEqual(api.getState(),saved);
 input('action','Try something else');assert.equal(api.getState().status,'draft');
 assert.equal(api.getState().interpretation,saved.interpretation);api.dispose();
});
test('narration requires explicit activation and cancels on disposal',()=>{
 const {container,all}=dom();let spoken=0,cancelled=0;
 container.ownerDocument.defaultView={speechSynthesis:{speak(){spoken++;},cancel(){cancelled++;}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}};
 const api=mountRealWorldReflection(container);assert.equal(spoken,0);all.find(e=>e.textContent==='Hear this moment').fire('click');assert.equal(spoken,1);api.dispose();assert.equal(cancelled,1);
});
test('keeping a journey sends exact structured words once while save is pending',async()=>{
 const {container,all}=dom();let release;const calls=[];
 const initialState={step:'journey',status:'planned',action:'  Ask a friend.\n',question:'What might change?'};
 const api=mountRealWorldReflection(container,{initialState,onKeep:state=>{calls.push(state);return new Promise(resolve=>{release=resolve;});}});
 const keep=all.find(e=>e.textContent==='Keep this journey in my world →');
 const pending=keep.handlers.click();await keep.handlers.click();
 assert.equal(calls.length,1);assert.equal(calls[0].action,initialState.action);
 assert.equal(calls[0].status,'planned');assert.equal(calls[0].verified,false);
 release();await pending;assert.equal(keep.disabled,false);api.dispose();
});
