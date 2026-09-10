import test from 'node:test';
import assert from 'node:assert/strict';
import {pianoGeometry} from '../public/piano-practice.js';
import {pianoScenePoint} from '../public/piano-scene.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {performanceNotes,noteName} from '../public/piano-practice.js';
import {RUNAWAY_OPENING_SOURCE,createOpeningDemoTake,analyzeOpening,openingTempoLabel} from '../public/runaway-opening.js';

test('every playable pitch stays inside the scene, including E6 and C7', () => {
  for (const {midi} of pianoGeometry()) {
    const {x,y}=pianoScenePoint(midi);
    assert.ok(x>=45 && x<=1055, `pitch ${midi} remains inside the width`);
    assert.ok(y>=40 && y<=280, `pitch ${midi} remains inside the height`);
  }
  assert.equal(pianoScenePoint(88).y,80);
});

test('scene label, single Hear button and comparison follow the applied target without rewriting take', () => {
  class Element {
    constructor(tag='div'){this.tag=tag;this.children=[];this.queries=new Map();this.classList={add(){}};this.style={};}
    querySelector(key){if(!this.queries.has(key))this.queries.set(key,new Element());return this.queries.get(key);}
    append(...nodes){this.children.push(...nodes);}
    prepend(node){this.children.unshift(node);}
    replaceChildren(...nodes){this.children=nodes;}
    setAttribute(){} remove(){} focus(){}
  }
  const document={head:new Element('head'),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)};
  const rollTargets=[],rollEvents=[];let rollDisposed=false;
  const mountPianoRoll=()=>{const cleanup=()=>{rollDisposed=true;};cleanup.setTarget=value=>rollTargets.push(value);cleanup.event=(type,payload)=>rollEvents.push({type,payload});return cleanup;};
  const source=readFileSync(new URL('../public/piano-scene.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('export function mountPianoScene')).replace('export function','function');
  const mount=vm.runInNewContext(`${body};mountPianoScene`,{document,mountPianoRoll,pianoScenePoint,performanceNotes,noteName,RUNAWAY_OPENING_SOURCE,createOpeningDemoTake,analyzeOpening,openingTempoLabel});
  const container=new Element();const calls=[];const events=[];
  const target={exercise_id:RUNAWAY_OPENING_SOURCE.id,quarter_bpm:60};
  const state={practice:createOpeningDemoTake(target),practice_target:null};
  const before=JSON.stringify(state.practice);
  const adapter={getState:()=>structuredClone(state),demonstrate:take=>calls.push(take)};
  const view=mount(container,adapter,(type,payload)=>events.push({type,payload}));
  const piano=container.querySelector('.piano-practice');const scene=piano.children[0];
  const invitation=scene.querySelector('.piano-scene__invitation');
  const hear=invitation.children.filter(node=>node.tag==='button');
  const label=invitation.children.find(node=>node.tag==='small');
  assert.equal(hear.length,1);assert.equal(label.textContent,'80 BPM / published notation');
  state.practice_target=target;view.render();
  assert.equal(label.textContent,'60 BPM / slower practice adaptation');
  hear[0].onclick();assert.deepEqual(calls[0].events.map(e=>e.time),[1,3,3,5]);
  view.event('performance.stop',{});
  assert.equal(events.at(-1).payload.target_interval_seconds,2);
  assert.equal(events.at(-1).payload.interval_difference_seconds,0);
  assert.equal(JSON.stringify(state.practice),before);
  state.practice_target=null;view.render();
  assert.equal(label.textContent,'80 BPM / published notation');
  assert.equal(invitation.querySelector('p').textContent,'Try the glowing key.');
  view.dispose();
  assert.equal(rollDisposed,true);
  assert.deepEqual(rollTargets,[null,target,null]);
  assert.equal(rollEvents[0].type,'performance.stop');
  assert.equal(invitation.hidden,true);
});
