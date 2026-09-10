import {DEMO_BEATS,demoBeatAt,renderFinale} from './demo-finale.js';
const $=s=>document.querySelector(s),frames=new Map(),stage=$('#demo-stage');
$('.demo-controls').hidden=true;
const portraitURL=new URLSearchParams(location.search).get('portrait')||'/assets/jai-portrait.jpg';
let started=false,paused=false,elapsed=0,last=0,scene='',raf=0;
const chapterNames={music:'01 / Play',civilization:'02 / Possibility',teachers:'03 / Teaching',jai:'04 / Purpose',movement:'05 / Move',ideas:'06 / Discover',architecture:'07 / How it works'};
function opening(offset=0){frames.get('music').contentDocument?.querySelector('.piano-practice')?.dispatchEvent(new CustomEvent('presenter-opening',{detail:{offset}}));}
function stopOpening(){frames.get('music').contentDocument?.querySelector('.piano-practice [data-stop]')?.click();}
for(const path of ['music','movement','ideas']){
  const frame=document.createElement('iframe');frame.title=path+' / live school';frame.src=`/?path=${path}&actor=agent_review`;frame.hidden=true;frame.allow='autoplay; camera';stage.append(frame);frames.set(path,frame);
}
function show(seconds){
  const beat=demoBeatAt(seconds);
  if(beat.id!==scene){if(scene==='music')stopOpening();scene=beat.id;for(const [id,frame]of frames)frame.hidden=id!==scene;$('.demo-slide').hidden=frames.has(scene);$('.demo-slide').dataset.scene=scene;if(!frames.has(scene))renderFinale($('.demo-slide'),scene,portraitURL);$('.demo-chapter').textContent=chapterNames[scene];$('#demo-back').disabled=scene===DEMO_BEATS[0].id;$('#demo-next').disabled=scene===DEMO_BEATS.at(-1).id;}
  $('.demo-time').textContent=`${Math.floor(Math.min(seconds,60))} / 60 s`;
  $('.demo-progress').style.transform=`scaleX(${Math.min(seconds/60,1)})`;
}
function tick(now){if(!started||paused)return;elapsed+=Math.max(0,now-last)/1000;last=now;show(elapsed);if(elapsed>=60){paused=true;$('#demo-pause').textContent='Replay';return;}raf=requestAnimationFrame(tick);}
$('#demo-start').onclick=()=>{
  $('.demo-start').hidden=true;$('.demo-controls').hidden=false;for(const id of ['demo-pause','demo-back','demo-next'])$('#'+id).hidden=false;started=true;paused=false;elapsed=0;last=performance.now();show(0);
  opening();
  raf=requestAnimationFrame(tick);
};
function chapterStep(direction){
  if(!started)return;
  const index=DEMO_BEATS.findIndex(beat=>beat.id===scene),next=DEMO_BEATS[index+direction];if(!next)return;
  cancelAnimationFrame(raf);stopOpening();paused=true;elapsed=next.start;show(elapsed);$('#demo-pause').textContent='Resume';
}
$('#demo-back').onclick=()=>chapterStep(-1);
$('#demo-next').onclick=()=>chapterStep(1);
$('#demo-pause').onclick=()=>{
  if(elapsed>=60){$('#demo-start').click();$('#demo-pause').textContent='Pause';return;}
  paused=!paused;$('#demo-pause').textContent=paused?'Resume':'Pause';
  if(paused){cancelAnimationFrame(raf);stopOpening();}else{if(elapsed<7)opening(elapsed);last=performance.now();raf=requestAnimationFrame(tick);}
};
// Preparation is event-driven; a missing scene keeps Start disabled, not a fake readiness claim.
await Promise.all([...frames.values()].map(frame=>new Promise(resolve=>{
  const ready=()=>{const doc=frame.contentDocument;if(!doc)return;const observer=new MutationObserver(()=>{if(doc.querySelector('.piano-roll,.boxing-journey-intro,.story-world')){observer.disconnect();resolve();}});observer.observe(doc,{subtree:true,childList:true});if(doc.querySelector('.piano-roll,.boxing-journey-intro,.story-world')){observer.disconnect();resolve();}};
  frame.addEventListener('load',ready,{once:true});if(frame.contentDocument?.readyState==='complete')ready();
})));
$('#demo-start').disabled=false;$('#demo-start').textContent='Start 60-second demo';
