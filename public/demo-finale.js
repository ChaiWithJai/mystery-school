export const DEMO_BEATS = Object.freeze([
  {id:'music',start:0,end:7},
  {id:'civilization',start:7,end:12},
  {id:'teachers',start:12,end:17},
  {id:'jai',start:17,end:25},
  {id:'movement',start:25,end:38},
  {id:'ideas',start:38,end:50},
  {id:'architecture',start:50,end:60},
].map(Object.freeze));
export function demoBeatAt(seconds) {
  return DEMO_BEATS.find(beat=>seconds>=beat.start&&seconds<beat.end)||DEMO_BEATS[seconds<0?0:DEMO_BEATS.length-1];
}
export function finaleMarkup(id, portraitURL = '') {
  if(id==='civilization')return '<p class="demo-kicker">WHEN ANYONE CAN MAKE A WORLD</p><h1>What does this mean<br>for civilization?</h1>';
  if(id==='teachers')return '<p class="demo-kicker">A CHATBOT IS NOT A TEACHER</p><h1>A good teacher can<br>change a life.</h1>';
  if(id==='jai')return `<div class="demo-teacher"><div class="demo-portrait" data-portrait></div><div><p class="demo-kicker">JAI BHAGAT / TEACHER</p><h1>Start with what<br>the student loves.</h1><p class="demo-values"><span>Courage.</span><span>Passion.</span><span>Imagination.</span></p><p class="demo-caption">I build the sandbox. We learn together.</p></div></div>`;
  if(id==='architecture')return `<p class="demo-kicker">HOW WE BUILT THIS</p><h1>Human direction.<br>AI-built worlds.</h1><div class="demo-architecture"><div class="demo-build"><span><b>Astra</b>Code + visual iteration</span><span class="demo-arrow">↔</span><span><b>Buzz</b>Agent coordination</span><span class="demo-arrow">→</span><span><b>GitHub</b>Reviewed code</span></div><div class="demo-runtime"><div><b>Browser</b>Piano · camera · 3D world</div><span class="demo-arrow">→</span><div><b>Python</b>Saved work + request checks</div><span class="demo-arrow">→</span><div><b>Astra / Bonsai</b>Asked-for changes / local cues</div></div><div class="demo-traces"><b>MLflow</b> Traces · artifacts · reported usage</div></div><p class="demo-footnote">Bonsai requires a configured local runtime. Buzz coordinates builders, not learner requests.</p>`;
  return '';
}
export function renderFinale(root,id,portraitURL='') {
  root.innerHTML=finaleMarkup(id);
  const slot=root.querySelector('[data-portrait]');
  if(slot&&portraitURL){const image=document.createElement('img');image.src=portraitURL;image.alt='Jai Bhagat';image.onerror=()=>{image.remove();slot.textContent='Jai Bhagat';};slot.append(image);}
  else if(slot){slot.textContent='Jai Bhagat';slot.dataset.missing='true';}
}
export function showDemoFinale({portraitURL='',onClose=()=>{}}={}) {
  const root=document.createElement('section');root.className='demo-finale';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','The teacher and the school');
  const stage=document.createElement('main'),next=document.createElement('button'),close=document.createElement('button');
  next.className='demo-next';next.textContent='Continue';close.className='demo-close';close.textContent='Close';
  const ids=['civilization','teachers','jai','architecture'];let index=0;
  root.append(stage,next,close);document.body.append(root);
  const previous=document.activeElement,background=[...document.body.children].filter(el=>el!==root).map(el=>[el,el.inert]);background.forEach(([el])=>el.inert=true);
  function cleanup(){background.forEach(([el,inert])=>el.inert=inert);root.remove();previous?.focus?.();onClose();}
  next.onclick=()=>{if(++index===ids.length){cleanup();return;}renderFinale(stage,ids[index],portraitURL);next.textContent=index===ids.length-1?'Back to the school':'Continue';};
  close.onclick=cleanup;root.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cleanup();}if(e.key==='Tab'){e.preventDefault();(document.activeElement===next?close:next).focus();}};
  renderFinale(stage,ids[0],portraitURL);next.focus();return cleanup;
}
