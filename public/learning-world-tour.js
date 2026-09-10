// Keep the global soundtrack operable while the tour makes the drawer inert.
export function carryTourSoundtrack(root, doc = document) {
  const soundtrack = doc.querySelector('.demo-soundtrack');
  if (!soundtrack) return () => {};
  const parent = soundtrack.parentNode, sibling = soundtrack.nextSibling;
  root.append(soundtrack);
  return () => {
    if (!soundtrack.isConnected) return;
    if (parent?.isConnected) parent.insertBefore(soundtrack, sibling?.parentNode === parent ? sibling : null);
    else soundtrack.remove();
  };
}
let currentTour;
export const LEARNING_WORLD_TOUR_MODES=Object.freeze(['Simulation','Mirror','Life']);
export function showLearningWorldTour({onContinue=()=>{},onCancel=()=>{}}={}) {
  currentTour?.();
  const previous=document.activeElement,root=document.createElement('section');
  root.className='learning-world-tour';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Three connected learning worlds');
  root.innerHTML=`<div class="learning-world-tour__haze" aria-hidden="true"></div><header><span>MYSTERY SCHOOL</span><h1>Make. Notice.<br><em>Take it into life.</em></h1></header><figure><svg viewBox="0 0 1100 420" aria-hidden="true"><defs><radialGradient id="tour-light"><stop stop-color="#c1c291" stop-opacity=".2"/><stop offset="1" stop-color="#bac9a0" stop-opacity="0"/></radialGradient></defs><path class="tour-thread" d="M126 295C280 402 391 48 550 174S828 372 978 149"/><g class="tour-stars">${Array.from({length:24},(_,i)=>`<circle cx="${(i*137+71)%1080}" cy="${(i*61+31)%380}" r="${i%4===0?2:1}"/>`).join('')}</g><g class="tour-vignette tour-vignette--piano"><ellipse cx="184" cy="230" rx="178" ry="175" fill="url(#tour-light)"/><path d="M59 212Q124 72 172 168T318 80" fill="none" stroke="#cab681" stroke-width="1.5"/>${[90,145,225,290].map((x,i)=>`<circle class="tour-note" cx="${x}" cy="${160-i*21}" r="${6+i}" fill="#eddeb1"/>`).join('')}<g transform="translate(52 245) skewY(-9)">${Array.from({length:11},(_,i)=>`<rect x="${i*25}" y="0" width="23" height="90" rx="3" fill="#e1ddbd"/>${![2,6,9].includes(i)?`<rect x="${i*25+16}" y="-1" width="15" height="52" rx="2" fill="#112e29"/>`:''}`).join('')}</g><path d="M67 348h247" stroke="#ad9b68" opacity=".45"/></g><g class="tour-vignette tour-vignette--body"><ellipse cx="550" cy="225" rx="177" ry="180" fill="url(#tour-light)"/><path d="M447 347V143a104 104 0 0 1 208 0v204" fill="#17382b22" stroke="#d1c598" opacity=".3"/><g stroke="#92a889" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="550" cy="125" r="24"/><path d="m532 153-32 29 3 83 29 17 42-1 26-22-4-78-25-28M510 180l-32 41 2-59m109 18 31 35 9-57"/><circle cx="481" cy="154" r="11"/><circle cx="630" cy="152" r="11"/><path d="m529 281-15 59-26 28m83-86 17 58 29 27"/></g><g stroke="#eddaa2" fill="none" stroke-width="2.5"><path d="m529 281-15 59-26 28m83-86 17 58 29 27"/><ellipse cx="487" cy="371" rx="22" ry="5"/><ellipse cx="617" cy="371" rx="22" ry="5"/><path class="tour-step" d="M455 389h190m-9-5 9 5-9 5"/></g></g><g class="tour-vignette tour-vignette--tree"><ellipse cx="913" cy="230" rx="172" ry="177" fill="url(#tour-light)"/><path d="M914 318v-152m0 102-61-56m61 17 59-45m-59 16-28-66" fill="none" stroke="#c5b28b" stroke-width="8" stroke-linecap="round"/><g fill="#426759" stroke="#b4c390" stroke-width="1"><path d="M914 190C813 192 839 111 887 132c-1-87 103-78 96-8 87-5 61 80-17 77Z"/><path d="M863 220c-74 16-76-56-33-58 36-10 62 37 33 58Z"/></g><g fill="#d9cca2"><rect x="861" y="152" width="10" height="29" rx="1" transform="rotate(-13 861 152)"/><rect x="877" y="151" width="9" height="28" rx="1"/><rect x="944" y="139" width="9" height="31" rx="1" transform="rotate(15 944 139)"/></g><path d="M826 310q44-20 88 4 44-24 88-4l-7 52q-41-16-81 5-40-21-80-5Z" fill="#d9cca2"/><path d="M914 314v53m-66-40q32-8 55 6m24 0q24-14 59-6" fill="none" stroke="#857f5c"/><path d="M914 374q-26 24-43 39m46-39q25 22 43 39" stroke="#b9a575" opacity=".55" fill="none"/></g><circle class="tour-spark" cx="355" cy="234" r="4" fill="#f3dfa1"/><circle class="tour-spark" cx="734" cy="291" r="4" fill="#f3dfa1"/></svg><figcaption><span><strong>Piano</strong><small>Simulation</small></span><span><strong>Boxing</strong><small>Mirror</small></span><span><strong>Stories</strong><small>Life</small></span></figcaption></figure><button class="learning-world-tour__continue">Into the ring <span aria-hidden="true">↗</span></button>`;
  document.body.append(root);
  const restoreSoundtrack=carryTourSoundtrack(root);
  const background=[...document.body.children].filter(el=>el!==root).map(el=>({el,inert:el.inert}));
  background.forEach(({el})=>el.inert=true);
  let closed=false;
  const cleanup=()=>{if(closed)return;closed=true;window.removeEventListener('keydown',onKey,true);window.removeEventListener('keyup',onKeyUp,true);background.forEach(({el,inert})=>{el.inert=inert;});restoreSoundtrack();root.remove();if(previous?.isConnected)previous.focus?.({preventScroll:true});if(currentTour===cleanup)currentTour=null;};
  const button=root.querySelector('.learning-world-tour__continue');
  function onKey(event){event.stopPropagation();if(event.key==='Escape'){event.preventDefault();cleanup();onCancel();}else if(event.key==='Tab'){event.preventDefault();const controls=[...root.querySelectorAll('button,input,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length);const index=controls.indexOf(document.activeElement),step=event.shiftKey?-1:1;(controls[(index+step+controls.length)%controls.length]||button).focus();}else if(!['Enter',' '].includes(event.key)){event.preventDefault();}}
  function onKeyUp(event){event.stopPropagation();if(!['Enter',' '].includes(event.key))event.preventDefault();}
  window.addEventListener('keydown',onKey,true);window.addEventListener('keyup',onKeyUp,true);button.onclick=()=>{if(closed)return;cleanup();onContinue();};
  currentTour=cleanup;button.focus({preventScroll:true});return cleanup;
}
