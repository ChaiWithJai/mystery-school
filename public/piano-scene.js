import {performanceNotes,noteName} from './piano-practice.js';
export function mountPianoScene(container,adapter,track,onContinue){
  const piano=container.querySelector('.piano-practice');if(!piano)return null;
  const scene=document.createElement('section');scene.className='piano-scene';
  scene.innerHTML=`<div class="piano-scene__light" aria-hidden="true"></div><div class="piano-scene__invitation"><span>RUNAWAY</span><p>Listen. Find the first sound.</p><button class="piano-scene__listen" aria-label="Listen to the Runaway reference">▷ Listen</button></div><svg viewBox="0 0 1100 330" class="piano-scene__notes" role="img" aria-label="Your played notes, shown as light"><g data-take-lines></g><g data-held-lights></g></svg><div class="piano-scene__reference" hidden><button data-close-reference aria-label="Close song reference">×</button><div data-player></div><a href="https://www.youtube.com/watch?v=Bm5iA4Zupek" target="_blank" rel="noopener">Open the official video ↗</a></div>`;
  piano.prepend(scene);
  const next=document.createElement('button');next.className='universe-next';next.textContent='Keep this. Into the ring →';next.hidden=true;piano.append(next);
  next.onclick=async()=>{piano.querySelector('[data-stop]').click();next.disabled=true;try{await onContinue?.();}catch(error){const message=piano.querySelector('[data-error]');message.hidden=false;message.textContent='Could not keep this take: '+error.message;}finally{next.disabled=false;}};
  const reference=scene.querySelector('.piano-scene__reference');
  scene.querySelector('.piano-scene__listen').onclick=()=>{reference.hidden=false;scene.querySelector('[data-player]').innerHTML='<iframe title="Runaway — official video reference" src="https://www.youtube-nocookie.com/embed/Bm5iA4Zupek?autoplay=0" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>';track('reference.open',{url:'https://www.youtube.com/watch?v=Bm5iA4Zupek',source_kind:'artist_video',automatic_transcription:false});};
  scene.querySelector('[data-close-reference]').onclick=()=>{reference.hidden=true;scene.querySelector('[data-player]').replaceChildren();scene.querySelector('.piano-scene__listen').focus();};
  const ns='http://www.w3.org/2000/svg',held=new Set();let disposed=false;
  const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  function render(){if(disposed)return;const state=adapter.getState().practice;if(!state)return;next.hidden=!state.events.some(event=>event.type==='off');const notes=performanceNotes(state),lines=scene.querySelector('[data-take-lines]');lines.replaceChildren();const duration=Math.max(4,state.duration);
    for(const note of notes){const x=45+note.start/duration*1010,y=280-(note.midi-48)*6;lines.append(el('rect',{x,y,width:Math.max(5,(note.end-note.start)/duration*1010),height:9,rx:4,fill:'#d8c4a5',opacity:.7}));}
    const lights=scene.querySelector('[data-held-lights]');lights.replaceChildren();for(const midi of held){const x=45+(midi-48)/36*1010;lights.append(el('path',{d:`M${x} 320Q${x-35} 180 ${x} 80`,stroke:'#f1d3a0','stroke-width':3,fill:'none',class:'piano-scene__beam'}));lights.append(el('circle',{cx:x,cy:80,r:14,fill:'#ffedc3'}));const text=el('text',{x,y:45,'text-anchor':'middle',fill:'#fff0d1'});text.textContent=noteName(midi);lights.append(text);}}
  function event(type,payload){if(type==='performance.note_on')held.add(payload.midi);if(type==='performance.note_off')held.delete(payload.midi);if(type==='performance.stop')held.clear();render();}
  const current=adapter.getState();if(!current.practice.reference){current.practice.reference={title:'Runaway — Kanye West',url:'https://www.youtube.com/watch?v=Bm5iA4Zupek'};adapter.setState(current);}
  render();return{render,event,dispose(){disposed=true;scene.remove();}};
}
