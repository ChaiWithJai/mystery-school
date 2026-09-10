import {performanceNotes,noteName} from './piano-practice.js';
import {RUNAWAY_OPENING_SOURCE,createOpeningDemoTake,analyzeOpening} from './runaway-opening.js';
export const pianoScenePoint = midi => ({x:45+(midi-48)/48*1010,y:280-(midi-48)*5});
export function mountPianoScene(container,adapter,track,onContinue){
  const piano=container.querySelector('.piano-practice');if(!piano)return null;
  const scene=document.createElement('section');scene.className='piano-scene';
  scene.innerHTML=`<div class="piano-scene__light" aria-hidden="true"></div><div class="piano-scene__invitation"><span>RUNAWAY</span><p>Listen. Find the first sound.</p><button class="piano-scene__listen" aria-label="Listen to the Runaway reference">▷ Listen</button></div><svg viewBox="0 0 1100 330" class="piano-scene__notes" role="img" aria-label="Your played notes, shown as light"><g data-take-lines></g><g data-held-lights></g></svg><div class="piano-scene__reference" hidden><button data-close-reference aria-label="Close song reference">×</button><div data-player></div><a href="https://www.youtube.com/watch?v=Bm5iA4Zupek" target="_blank" rel="noopener">Open the official video ↗</a></div>`;
  piano.prepend(scene);
  const invitation=scene.querySelector('.piano-scene__invitation');
  const referenceButton=scene.querySelector('.piano-scene__listen');
  const feedback=invitation.querySelector('p');
  feedback.textContent='Hear it. Then try E6 twice.';
  const demonstration=document.createElement('button');demonstration.className='piano-scene__listen';demonstration.textContent='Hear the opening';
  demonstration.onclick=()=>{void adapter.demonstrate(createOpeningDemoTake());track('lesson.demonstrate',{source:RUNAWAY_OPENING_SOURCE,kind:'notation_exercise',learner_attempt:false});};
  invitation.append(demonstration);
  const sourceDetails=document.createElement('details');sourceDetails.className='piano-scene__source';
  sourceDetails.innerHTML='<summary>Song & exercise source</summary><p>Two strikes from the published arrangement, played with synthesized tones. Not the original recording or a full-song lesson.</p>';
  sourceDetails.append(referenceButton);
  const sourceLink=document.createElement('a');sourceLink.href=RUNAWAY_OPENING_SOURCE.url;sourceLink.target='_blank';sourceLink.rel='noopener';sourceLink.textContent='Inspect the published opening';sourceDetails.append(sourceLink);
  piano.querySelector('.piano-practice__options').append(sourceDetails);
  const targetKey=piano.querySelector('[aria-label="E6, hold to play"]');targetKey?.classList.add('is-lesson-target');
  const next=document.createElement('button');next.className='universe-next';next.textContent='Keep this. Into the ring →';next.hidden=true;piano.append(next);
  next.onclick=async()=>{piano.querySelector('[data-stop]').click();next.disabled=true;try{await onContinue?.();}catch(error){const message=piano.querySelector('[data-error]');message.hidden=false;message.textContent='Could not keep this take: '+error.message;}finally{next.disabled=false;}};
  const reference=scene.querySelector('.piano-scene__reference');
  referenceButton.onclick=()=>{reference.hidden=false;scene.querySelector('[data-player]').innerHTML='<iframe title="Runaway — official video reference" src="https://www.youtube-nocookie.com/embed/Bm5iA4Zupek?autoplay=0" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>';track('reference.open',{url:'https://www.youtube.com/watch?v=Bm5iA4Zupek',source_kind:'artist_video',automatic_transcription:false});};
  scene.querySelector('[data-close-reference]').onclick=()=>{reference.hidden=true;scene.querySelector('[data-player]').replaceChildren();referenceButton.focus();};
  const ns='http://www.w3.org/2000/svg',held=new Set();let disposed=false;
  const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  function render(){if(disposed)return;const state=adapter.getState().practice;if(!state)return;next.hidden=!state.events.some(event=>event.type==='off');const notes=performanceNotes(state),lines=scene.querySelector('[data-take-lines]');lines.replaceChildren();const duration=Math.max(4,state.duration);
    for(const note of notes){const x=45+note.start/duration*1010,y=pianoScenePoint(note.midi).y;lines.append(el('rect',{x,y,width:Math.max(5,(note.end-note.start)/duration*1010),height:9,rx:4,fill:'#d8c4a5',opacity:.7}));}
    const lights=scene.querySelector('[data-held-lights]');lights.replaceChildren();for(const midi of held){const {x}=pianoScenePoint(midi);lights.append(el('path',{d:`M${x} 320Q${x-35} 180 ${x} 80`,stroke:'#f1d3a0','stroke-width':3,fill:'none',class:'piano-scene__beam'}));lights.append(el('circle',{cx:x,cy:80,r:14,fill:'#ffedc3'}));const text=el('text',{x,y:45,'text-anchor':'middle',fill:'#fff0d1'});text.textContent=noteName(midi);lights.append(text);}}
  function event(type,payload){if(type==='performance.note_on')held.add(payload.midi);if(type==='performance.note_off')held.delete(payload.midi);if(type==='performance.stop'){
    held.clear();const comparison=analyzeOpening(adapter.getState().practice);
    if(comparison.status==='compared'){
      feedback.textContent=`First two strikes: ${comparison.pitches.map(p=>noteName(p.actual_midi)).join(', ')}. ${comparison.interval_seconds.toFixed(2)}s apart; try E6 twice, 1.50s apart.`;
      track('lesson.compare',{...comparison,learner_outcome_claimed:false});
    }
  }render();}
  render();return{render,event,dispose(){disposed=true;scene.remove();}};
}
