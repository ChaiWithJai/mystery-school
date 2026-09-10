import {performanceNotes,noteName} from './piano-practice.js';
export const OPENING_EXERCISE=Object.freeze({midi:88,tempo:80,onsets:[.75,2.25],end:3.75,source:'https://www.musicnotes.com/sheetmusic/kanye-west/runaway/MN0103069'});
export function openingFeedback(practice){
  const notes=performanceNotes(practice);if(notes.length<2)return '';
  const first=notes.slice(0,2),gap=first[1].start-first[0].start;
  if(first.some(note=>note.midi!==88))return `You played ${first.map(note=>noteName(note.midi)).join(', ')}. This arrangement starts on E6.`;
  const delta=1.5-gap;
  return `Your strikes are ${gap.toFixed(2)} s apart. `+(Math.abs(delta)<.08?'Hear how that space feels.':`Try ${Math.abs(delta).toFixed(2)} s ${delta>0?'more':'less'} space.`);
}
export function mountPianoScene(container,adapter,track,onContinue){
  const piano=container.querySelector('.piano-practice');if(!piano)return null;
  const scene=document.createElement('section');scene.className='piano-scene';
  scene.innerHTML=`<div class="piano-scene__light" aria-hidden="true"></div><div class="piano-scene__invitation"><span>RUNAWAY · OPENING EXERCISE</span><p>Two strikes. Leave room.</p><button class="piano-scene__listen" aria-label="Hear the two-strike arrangement exercise">▷ Hear it</button><button class="piano-scene__source" aria-label="Inspect the exercise sources">↗ Source</button><small data-example-status role="status"></small><p class="piano-scene__feedback" data-feedback role="status"></p></div><svg viewBox="0 0 1100 330" class="piano-scene__notes" role="img" aria-label="Your played notes, shown as light"><g data-take-lines></g><g data-held-lights></g></svg><div class="piano-scene__reference" hidden><button data-close-reference aria-label="Close song reference">×</button><p>Two strikes from the published arrangement. Synthesized example, not the original recording.</p><a href="${OPENING_EXERCISE.source}" target="_blank" rel="noopener">Inspect Musicnotes MN0103069 ↗</a><p>E6 · 80 BPM · 1.5 seconds between strikes.</p><a href="https://www.youtube.com/watch?v=Bm5iA4Zupek" target="_blank" rel="noopener">Artist video ↗</a><p>Your take contains only your own key presses. This comparison does not assess full-song accuracy.</p></div>`;
  piano.prepend(scene);
  const next=document.createElement('button');next.className='universe-next';next.textContent='Keep this. Into the ring →';next.hidden=true;piano.append(next);
  next.onclick=async()=>{piano.querySelector('[data-stop]').click();next.disabled=true;try{await onContinue?.();}catch(error){const message=piano.querySelector('[data-error]');message.hidden=false;message.textContent='Could not keep this take: '+error.message;}finally{next.disabled=false;}};
  const reference=scene.querySelector('.piano-scene__reference');
  scene.querySelector('.piano-scene__source').onclick=()=>{reference.hidden=false;track('reference.open',{url:OPENING_EXERCISE.source,source_kind:'published_arrangement_excerpt',automatic_transcription:false});};
  scene.querySelector('[data-close-reference]').onclick=()=>{reference.hidden=true;scene.querySelector('.piano-scene__source').focus();};
  let exampleContext=null,exampleToken=0,timers=[],voices=[];
  const exampleKey=()=>piano.querySelector('[aria-label="E6, hold to play"]');
  const stopExample=()=>{exampleToken++;timers.forEach(clearTimeout);timers=[];for(const voice of voices){try{voice.stop();}catch{}}voices=[];exampleKey()?.removeAttribute('data-example-active');scene.querySelector('[data-example-status]').textContent='';};
  scene.querySelector('.piano-scene__listen').onclick=async()=>{
    piano.querySelector('[data-stop]').click();stopExample();const token=exampleToken;
    try{
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw Error('Audio is unavailable');exampleContext ||=new Audio();await exampleContext.resume();if(disposed||token!==exampleToken)return;if(exampleContext.state!=='running')throw Error('Audio did not start');
      const start=exampleContext.currentTime+.05;
      for(const onset of OPENING_EXERCISE.onsets){const oscillator=exampleContext.createOscillator(),gain=exampleContext.createGain();oscillator.type='triangle';oscillator.frequency.value=440*2**((88-69)/12);gain.gain.setValueAtTime(0,start+onset);gain.gain.linearRampToValueAtTime(.006,start+onset+.015);gain.gain.setValueAtTime(.006,start+onset+1.42);gain.gain.linearRampToValueAtTime(0,start+onset+1.5);oscillator.connect(gain);gain.connect(exampleContext.destination);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(start+onset);oscillator.stop(start+onset+1.52);voices.push(oscillator);
        timers.push(setTimeout(()=>{if(disposed||token!==exampleToken)return;exampleKey()?.setAttribute('data-example-active','true');},(onset+.05)*1000));timers.push(setTimeout(()=>exampleKey()?.removeAttribute('data-example-active'),(onset+1.5)*1000));}
      scene.querySelector('[data-example-status]').textContent='Published arrangement · two-strike example';
      timers.push(setTimeout(()=>{if(disposed||token!==exampleToken)return;scene.querySelector('[data-example-status]').textContent='Your turn. Record two strikes.';exampleKey()?.focus({preventScroll:true});},3900));
      track('reference.example.play',{...OPENING_EXERCISE,source_kind:'published_arrangement_excerpt',learner_performance:false});
    }catch(error){scene.querySelector('[data-example-status]').textContent='Could not play the example: '+error.message;}
  };
  const ns='http://www.w3.org/2000/svg',held=new Set();let disposed=false;
  const el=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  function render(){if(disposed)return;const state=adapter.getState().practice;if(!state)return;next.hidden=!state.events.some(event=>event.type==='off');const notes=performanceNotes(state),lines=scene.querySelector('[data-take-lines]');lines.replaceChildren();const duration=Math.max(4,state.duration);
    for(const note of notes){const x=45+note.start/duration*1010,y=280-(note.midi-48)*4.5;lines.append(el('rect',{x,y,width:Math.max(5,(note.end-note.start)/duration*1010),height:9,rx:4,fill:'#d8c4a5',opacity:.7}));}
    const lights=scene.querySelector('[data-held-lights]');lights.replaceChildren();for(const midi of held){const x=45+(midi-48)/48*1010;lights.append(el('path',{d:`M${x} 320Q${x-35} 180 ${x} 80`,stroke:'#f1d3a0','stroke-width':3,fill:'none',class:'piano-scene__beam'}));lights.append(el('circle',{cx:x,cy:80,r:14,fill:'#ffedc3'}));const text=el('text',{x,y:45,'text-anchor':'middle',fill:'#fff0d1'});text.textContent=noteName(midi);lights.append(text);}}
  function event(type,payload){if(type==='performance.note_on'){stopExample();held.add(payload.midi);}if(type==='performance.record_start')stopExample();if(type==='performance.note_off')held.delete(payload.midi);if(type==='performance.stop'){stopExample();held.clear();scene.querySelector('[data-feedback]').textContent=openingFeedback(adapter.getState().practice);}render();}
  const current=adapter.getState();if(!current.practice.reference){current.practice.reference={title:'Runaway — published opening exercise',url:OPENING_EXERCISE.source};adapter.setState(current);}
  render();return{render,event,dispose(){disposed=true;stopExample();exampleContext?.close().catch(()=>{});scene.remove();}};
}
