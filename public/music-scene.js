// A direct-manipulation view of the existing phrase; the lab owns sound and state.
export function mountMusicScene(container, adapter, track) {
  const lab = container.querySelector('.music-lab');
  if (!lab || !adapter?.getState || !adapter?.setState) return null;
  const scene = document.createElement('section');
  scene.className = 'music-scene';
  scene.innerHTML = `<div class="music-scene__sky" aria-hidden="true"><i></i><i></i><i></i></div><div class="music-scene__caption"><span>YOUR SOUND, TAKING SHAPE</span><small>Drag a light. Hear what changes.</small></div><svg class="music-scene__score" viewBox="0 0 1000 380" role="group" aria-label="Your phrase. Drag notes up or down to change pitch; arrow keys change pitch and rhythm."><defs><linearGradient id="note-light" x2="0" y2="1"><stop stop-color="#fff0bc"/><stop offset="1" stop-color="#e8a6ff"/></linearGradient></defs><g class="music-scene__lines" aria-hidden="true"></g><g class="music-scene__notes"></g></svg><p class="music-scene__hint">↑ pitch <span>↔ rhythm · arrow keys</span></p>`;
  lab.prepend(scene);
  const svg=scene.querySelector('svg'), notes=scene.querySelector('.music-scene__notes');
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el;};
  for(let i=0;i<7;i++)scene.querySelector('.music-scene__lines').append(make('path',{d:`M 55 ${65+i*40} Q 500 ${40+i*40} 945 ${65+i*40}`}));
  const name=midi=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][midi%12]+(Math.floor(midi/12)-1);
  let dragging=null, disposed=false;
  function render() {
    if(disposed||dragging)return;
    const state=adapter.getState(),total=state.notes.reduce((sum,n)=>sum+n.beats,0);
    notes.replaceChildren();let beat=0;
    state.notes.forEach((note,index)=>{
      const x=60+beat/total*880,w=Math.max(20,note.beats/total*880-10),y=325-(note.midi-48)/36*260;
      const group=make('g',{tabindex:0,role:'button','aria-label':`${name(note.midi)}, ${note.beats} beats. Drag to change pitch.`,transform:`translate(${x} ${y})`,'data-note':index});
      group.append(make('path',{d:`M ${w/2} 12 V ${355-y}`,class:'music-scene__trail'}));
      group.append(make('rect',{x:0,y:-14,width:w,height:28,rx:14,fill:'url(#note-light)'}));
      const text=make('text',{x:w/2,y:-28,'text-anchor':'middle'});text.textContent=name(note.midi);group.append(text);
      group.addEventListener('pointerdown',event=>{event.preventDefault();dragging={index,y:event.clientY,midi:note.midi,original:structuredClone(state),changed:false};svg.setPointerCapture(event.pointerId);});
      group.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();lab.querySelector(`[data-note-index="${index}"]`)?.click();return;}
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
        event.preventDefault();const current=adapter.getState();const before=structuredClone(current);
        const n=current.notes[index];if(event.key==='ArrowUp'||event.key==='ArrowDown')n.midi=Math.max(48,Math.min(84,n.midi+(event.key==='ArrowUp'?1:-1)));
        else n.beats=Math.max(.25,Math.min(4,n.beats+(event.key==='ArrowRight'?.25:-.25)));
        adapter.setState(current);render();notes.children[index]?.focus();track('visual.note.edit',{before,after:adapter.getState(),method:'keyboard'});
      });
      notes.append(group);beat+=note.beats;
    });
  }
  const move=event=>{if(!dragging)return;const state=adapter.getState();const midi=Math.max(48,Math.min(84,dragging.midi+Math.round((dragging.y-event.clientY)/9)));if(state.notes[dragging.index].midi===midi)return;state.notes[dragging.index].midi=midi;dragging.changed=true;adapter.setState(state);const pending=dragging;dragging=null;render();dragging=pending;};
  const end=()=>{if(!dragging)return;const finished=dragging;dragging=null;render();if(finished.changed)track('visual.note.edit',{before:finished.original,after:adapter.getState(),method:'pointer'});lab.querySelector(`[data-note-index="${finished.index}"]`)?.click();};
  svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',end);
  svg.addEventListener('pointercancel',()=>{dragging=null;render();});
  const soundShape=document.createElement('details');soundShape.className='music-scene__shape';
  const summary=document.createElement('summary');summary.textContent='∿ Shape the sound';soundShape.append(summary);
  for(const selector of ['.music-lab__figure','.music-lab__controls','.music-lab__observation','.music-lab__help','.music-lab__context']){const item=lab.querySelector(selector);if(item)soundShape.append(item);}
  lab.append(soundShape);
  const editor=lab.querySelector('.music-lab__phrase-editor');if(editor)editor.open=false;
  for(const [selector,icon,label] of [['.music-lab__before','↶','Original'],['.music-lab__after','▶','Play'],['.music-lab__stop','■','Stop']]){const button=lab.querySelector(selector);if(button){button.setAttribute('aria-label',button.textContent);button.innerHTML=`<span aria-hidden="true">${icon}</span><small>${label}</small>`;}}
  render();
  return {render,event(type){if(type==='play')scene.classList.add('is-playing');if(type==='stop')scene.classList.remove('is-playing');},dispose(){disposed=true;scene.remove();}};
}
