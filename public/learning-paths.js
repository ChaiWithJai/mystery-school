import { mountLearningExperiment } from './learning-experiment.js';
import { mountMusicScene } from './music-scene.js';
import { showMovieOpening } from './movie-opening.js';

const PATHS={
  music:{name:'Maya',age:15,domain:'Music / calculus',goal:'Finish a song for my grandmother.',moment:'Maya can find a melody by ear. She has been playing the same unfinished phrase for her grandmother, who keeps asking to hear the ending.',voice:'I know how I want it to feel. I do not know how to make the first note gentler.',care:'We can stay with your song. Try the sound first. If its beginning feels too sudden, we can look at how quickly its loudness rises.',share:'Could the opening arrive more gently, while keeping the tune I recognize?',peer:'Grandmother',next:'What else could I change to make the ending feel like mine?',module:'./song-lab.js',mount:'mountSongLab'},
  movement:{name:'Andre',age:19,domain:'Movement / physics',goal:'Understand a smooth reach so I can explain it to my training partner.',moment:'Andre watches his training partner move with control. He wants to understand what changes during a reach, but remembers being told he was behind in maths.',voice:'Can we start with the movement? I can show you what I mean before I know the words.',care:'Yes. Follow the marked point. Keep the distance the same and give the movement more time. We can name the relationship after you notice it.',share:'Can you show the same distance taking longer, and point to where the motion is fastest?',peer:'Training partner',next:'How would a different movement change the shape of the graph?',module:'./movement-lab.js',mount:'mountMovementLab'},
  ideas:{name:'Leena',age:28,domain:'Great Books / personal understanding',goal:'Explain one idea I believe to a friend, in my own words.',moment:'After work, Leena saves lectures and passages she wants to return to. Her friend asks what she thinks, and she finds herself repeating someone else instead.',voice:'I have collected so many explanations. I want to work out which part I actually believe.',care:'Stay with one passage. Your first account can be unfinished. We can compare it with another reading without replacing your voice.',share:'Would your interpretation still hold when someone faces an unfair rule? What would you change or defend?',peer:'Friend',next:'Which experience or passage would make me revise this account?',module:'./ideas-lab.js',mount:'mountIdeasLab'}
};
const KEY='astral.learning-path-drafts.v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let drafts={};try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))drafts=saved;}catch{}
let dispose=null,opening=0;

export function savedVersionUrl(base,pathway,artifactId){
  if(!Object.hasOwn(PATHS,pathway)||typeof artifactId!=='string'||!artifactId)throw Error('A saved pathway and version ID are required.');
  const url=new URL(base);url.pathname='/';url.hash='';url.searchParams.delete('correct');url.searchParams.delete('experiment');
  url.searchParams.set('path',pathway);url.searchParams.set('artifact',artifactId);
  return url.href;
}

export async function copySavedVersion(url,clipboard){
  try{
    if(!clipboard?.writeText)throw Error('Clipboard unavailable');
    await clipboard.writeText(url);
    return 'Exact version link copied. It opens only where this same app and its saved records are reachable.';
  }catch{
    return 'Could not copy the link. Select and copy the address below, or use Open this saved version. Nothing was sent.';
  }
}

export function createLearningEventBuffer(track,{unlinkedHistory=false}={}){
  let entries=[];
  return {
    track(type,payload){
      const entry={};entries.push(entry);
      const snapshot=structuredClone(payload);
      entry.result=Promise.resolve().then(()=>track(type,snapshot)).then(record=>typeof record?.id==='string'&&record.id?record.id:null,()=>null);
    },
    capture(){
      const batch=entries.slice();
      return {
        async settle(){const ids=await Promise.all(batch.map(e=>e.result));const unique=[...new Set(ids.filter(Boolean))];return {eventIds:unique.slice(0,100),failed:ids.filter(id=>!id).length,omitted:Math.max(0,unique.length-100),unlinkedHistory};},
        commit(){entries=entries.filter(e=>!batch.includes(e));}
      };
    }
  };
}

export function createLearningDraftScopes(track){
  const scopes=new WeakMap();
  return (draft,sessionId,knownFresh=false)=>{
    const prior=scopes.get(draft);
    if(prior?.sessionId===sessionId)return prior.events;
    const events=createLearningEventBuffer(track,{unlinkedHistory:!!prior||!knownFresh});
    scopes.set(draft,{sessionId,events});return events;
  };
}

export async function persistLearningSnapshot({events,payload,isCurrent,persist,onSaved}){
  const snapshot=structuredClone(payload),batch=events.capture();
  const {eventIds,failed,omitted,unlinkedHistory}=await batch.settle();
  if(!isCurrent())throw Error('This experiment closed before its version could be saved.');
  const telemetry={status:failed||omitted||unlinkedHistory?'incomplete':'recorded',failed_events:failed,omitted_events:omitted,unlinked_draft_history:unlinkedHistory};
  snapshot.event_ids=eventIds;snapshot.state.telemetry=telemetry;
  const record=await persist(snapshot);
  // A late response remains a saved record but cannot change a newer draft or consume its help links.
  if(isCurrent()){batch.commit();onSaved(record);}
  return {record,telemetry};
}

export function createLearningPaths({openDrawer,body,onCleanup,api,sessionId,track,toast,onImagine,onOpen,onArtifactSaved}){
  const draftEvents=createLearningDraftScopes(track);
  function keep(){try{localStorage.setItem(KEY,JSON.stringify(drafts));}catch{toast('This browser could not keep the draft. Save a version before leaving.');}}
  async function open(pathway,artifactId){
    const person=PATHS[pathway];if(!person)return;
    const actorKind=new URLSearchParams(location.search).get('actor')==='agent_review'?'agent_review':'user_action';
    onOpen?.(pathway,artifactId);
    dispose?.();dispose=null;
    openDrawer('learning',({music:'Play. Listen. Try again.',movement:'Feel what time changes.',ideas:'Make a thought your own.'})[pathway],person.name.toUpperCase()+' / THE LIVING SCHOOL');
    const token=++opening;
    document.querySelector('#drawer').classList.add('learning-drawer');
    let experimentDispose=null,musicScene=null;
    const cleanup=()=>{opening++;musicScene?.dispose();experimentDispose?.();dispose?.();dispose=null;document.querySelector('#drawer').classList.remove('learning-drawer');};
    onCleanup(cleanup);
    const fresh=!drafts[pathway];
    let draft=drafts[pathway]||={lab:{},explanation:'',question:'',parentId:null,stage:'try'};
    if(artifactId){try{const saved=await api('/api/artifacts/'+encodeURIComponent(artifactId));if(token!==opening)return;if(saved.pathway!==pathway)throw Error('That version belongs to another pathway.');draft=drafts[pathway]={lab:saved.state.lab||{},explanation:saved.state.explanation||'',question:saved.state.question||'',parentId:saved.id,stage:saved.state.circle_stage||(saved.stage==='new_question'?'next':saved.stage==='sharing_response'?'share':'try')};keep();}catch(e){if(token===opening){body().innerHTML='<p role="alert">This saved version is unavailable. Your other drafts have not been changed.</p><button class="text-button" data-back>Choose a learner</button>';body().querySelector('[data-back]').onclick=chooser;toast(e.message);}return;}}
    if(token!==opening)return;
    const events=draftEvents(draft,sessionId,fresh||!!artifactId);
    const root=body();root.innerHTML=`<div class="learning-layout"><aside class="learning-person"><details class="learning-care"><summary>${esc(person.name)} · ${esc(person.domain)} <span>↗</span></summary><p>${esc(person.moment)}</p><blockquote>${esc(person.voice)}</blockquote><p>${esc(person.care)}</p><small>Fictional character · authored guidance</small></details><button class="text-button" data-other>Other worlds ↗</button></aside><section class="learning-work"><nav class="learning-steps" aria-label="Learning circle"><span class="active">01 · Explore</span><span>02 · Keep</span><span>03 · Exchange</span><span>04 · Begin again</span></nav><div data-lab><p>Opening the experiment...</p></div><div class="learning-dock"><button class="text-button" aria-expanded="false" data-panel="save">◇ Keep a discovery</button><button class="text-button" aria-expanded="false" data-panel="share">↔ Invite a response</button><button class="text-button" aria-expanded="false" data-panel="next">✧ Follow a question</button></div><p class="learning-action-status" data-status role="status"></p><section class="learning-save" hidden><label for="path-explanation">What changed? <small>A few words, if you like.</small></label><textarea id="path-explanation" rows="2" placeholder="I tried... Nothing changed yet is also a valid answer.">${esc(draft.explanation)}</textarea><button class="primary" data-save>Keep this version</button></section><section class="learning-share" hidden><h3>A different pair of eyes.</h3><p>Demo conversation · nothing is sent.</p><button class="text-button" data-share>Try ${esc(person.peer.toLowerCase())}'s question</button><div data-response ${draft.stage==='share'||draft.stage==='next'?'':'hidden'}><blockquote>${esc(person.share)}</blockquote><small>Staged ${esc(person.peer.toLowerCase())} response</small><p>Return to your experiment above. You can revise it, keep it, or disagree.</p></div></section><section class="learning-next" hidden><label for="path-question">What do you want to try next?</label><textarea id="path-question" rows="2" placeholder="${esc(person.next)}">${esc(draft.question)}</textarea><button class="primary" data-next>Keep my next question</button><button class="text-button" data-imagine>Explore this question with Astra</button><p class="learning-label">Optional · review before sending to Astra.</p></section><details class="learning-versions"><summary>Notebook & traces · ${actorKind==='agent_review'?'agent QA':'visitor activity'}</summary><div data-history></div></details></section></div>`;
    const q=s=>root.querySelector(s);
    const tools=document.createElement('details');tools.className='universe-tools';
    const toolsToggle=document.createElement('summary');toolsToggle.textContent='✧';toolsToggle.setAttribute('aria-label','Keep, share, ask, or open your notebook');tools.append(toolsToggle);
    tools.append(q('.learning-dock'),q('.learning-versions'),q('.learning-person'));q('.learning-work').append(tools);
    const worlds=document.createElement('button');worlds.className='universe-worlds';worlds.textContent='↗';worlds.setAttribute('aria-label','Choose another world');worlds.onclick=()=>showMovieOpening(path=>open(path));q('.learning-work').append(worlds);
    function versionLinks(record){
      const url=savedVersionUrl(location.href,pathway,record.id);
      const box=document.createElement('div');box.dataset.versionLinks=record.id;
      const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent='Open this saved version';
      const copy=document.createElement('button');copy.type='button';copy.className='text-button';copy.textContent='Copy exact version link';
      const address=document.createElement('input');address.type='text';address.readOnly=true;address.value=url;address.setAttribute('aria-label','Exact saved version address');
      const status=document.createElement('p');status.setAttribute('role','status');
      const scope=document.createElement('p');scope.className='learning-label';scope.textContent='Same-app link, not a published upload or authenticated invitation. The recipient must be able to reach this app and its saved records. Unsaved edits are not included.';
      copy.onclick=async()=>{copy.disabled=true;status.textContent='Copying link...';status.textContent=await copySavedVersion(url,navigator.clipboard);copy.disabled=false;};
      box.append(link,copy,address,status,scope);return box;
    }
    const savedLinks=document.createElement('div');q('[data-status]').after(savedLinks);
    if(artifactId)savedLinks.replaceChildren(versionLinks({id:artifactId}));
    q('[data-other]').onclick=chooser;
    root.querySelectorAll('[data-panel]').forEach(button=>button.onclick=()=>{
      const target=q('.learning-'+button.dataset.panel);const reveal=target.hidden;
      root.querySelectorAll('.learning-save,.learning-share,.learning-next').forEach(section=>section.hidden=true);
      root.querySelectorAll('[data-panel]').forEach(item=>item.setAttribute('aria-expanded','false'));
      target.hidden=!reveal;button.setAttribute('aria-expanded',String(reveal));
      tools.open=false;
      events.track('learning.panel.toggle',{pathway,actor_kind:actorKind,panel:button.dataset.panel,open:reveal});
      if(reveal)target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'});
    });
    q('#path-explanation').oninput=e=>{draft.explanation=e.target.value;keep();experimentDispose?.contextChanged();};
    q('#path-question').oninput=e=>{draft.question=e.target.value;keep();experimentDispose?.contextChanged();};
    q('.learning-care').ontoggle=e=>{if(e.target.open)events.track('learning.guidance.open',{pathway,character:person.name,actor_kind:actorKind,guidance_kind:'authored_demo',text:person.care});};
    let sources=[],ready=false,validateVideo=null;
    function currentSources(){
      if(!validateVideo)return sources;
      const reference=validateVideo(draft.lab.youtubeUrl,draft.lab.youtubeTimestamp,draft.lab.youtubeNote);
      return reference.valid?[...sources,{url:reference.url,label:'User-supplied YouTube reference',locator:String(reference.seconds)+' seconds',source_kind:'user_reference_unverified',note:draft.lab.youtubeNote}]:sources;
    }
    const saveButtons=[q('[data-save]'),q('[data-share]'),q('[data-next]'),q('[data-imagine]')];
    saveButtons.forEach(button=>{button.disabled=true;});
    async function history(){try{const records=await api('/api/artifacts');if(token!==opening)return;const matches=records.filter(r=>r.pathway===pathway);q('[data-history]').innerHTML=matches.length?matches.map(r=>`<article><strong>${esc(r.stage)}</strong><span>${esc(r.actor_kind)}</span><p>${esc(r.note||r.goal)}</p><button class="text-button" data-version="${esc(r.id)}">Reopen this version</button><a href="/review.html?sample=${encodeURIComponent(r.id)}" target="_blank" rel="noopener">Inspect its record</a></article>`).join(''):'No versions saved yet.';root.querySelectorAll('[data-version]').forEach(b=>{b.onclick=()=>open(pathway,b.dataset.version);b.parentElement.append(versionLinks({id:b.dataset.version}));});}catch(e){if(token===opening)q('[data-history]').textContent='Saved versions unavailable: '+e.message;}}
    async function save(stage,actor=actorKind,note=draft.explanation){
      if(!ready)throw Error('The experiment must open before a version can be saved.');
      if(token!==opening)throw Error('This experiment is no longer open.');
      // Freeze the artifact and its event boundary before awaiting network telemetry.
      const payload={session_id:sessionId,pathway,stage,actor_kind:actor,goal:person.goal,state:{character:person.name,scenario_kind:'fictional_composite',circle_stage:stage==='sharing_response'?'share':stage==='new_question'?'next':draft.stage,lab:structuredClone(draft.lab),explanation:draft.explanation,question:draft.question},source_refs:structuredClone(currentSources()),note,...(draft.parentId?{parent_id:draft.parentId}:{})};
      const {record,telemetry}=await persistLearningSnapshot({events,payload,isCurrent:()=>token===opening,persist:value=>api('/api/artifacts',value),onSaved:record=>{draft.parentId=record.id;keep();}});
      onArtifactSaved?.(record);if(token===opening){window.history.replaceState({},'',savedVersionUrl(location.href,pathway,record.id));savedLinks.replaceChildren(versionLinks(record));q('[data-status]').textContent='Version saved on this computer. The address now opens this exact version.'+(telemetry.status==='incomplete'?` Event links are incomplete: ${telemetry.failed_events} failed, ${telemetry.omitted_events} omitted; earlier draft history ${telemetry.unlinked_draft_history?'could not be recovered':'retained'}.`:'');await history();}return record;
    }
    async function action(button,work){saveButtons.forEach(b=>{b.disabled=true;});try{await work();}catch(e){if(token===opening)q('[data-status]').textContent='Not saved: '+e.message;}finally{if(token===opening)saveButtons.forEach(b=>{b.disabled=!ready;});}}
    q('[data-save]').onclick=e=>action(e.currentTarget,()=>save(draft.parentId?'revision':'attempt'));
    q('[data-share]').onclick=e=>action(e.currentTarget,async()=>{await save(draft.parentId?'revision':'attempt');await save('sharing_response','staged_peer_response',person.share);if(token===opening){draft.stage='share';keep();q('[data-response]').hidden=false;}});
    q('[data-next]').onclick=e=>action(e.currentTarget,async()=>{if(!draft.question.trim()){q('#path-question').focus();throw Error('Add the question you want to keep.');}await save('new_question',actorKind,draft.question);if(token===opening){draft.stage='next';keep();toast('Your next question is kept with this experiment.');}});
    q('[data-imagine]').onclick=()=>{
      if(experimentDispose)return;
      if(!draft.question.trim()){q('#path-question').focus();return;}
      experimentDispose=mountLearningExperiment(q('.learning-next'),{
        api,sessionId,actorKind,pathway,getQuestion:()=>draft.question,
        getContext:()=>({question:draft.question.trim(),explanation:draft.explanation,source_refs:structuredClone(currentSources()),reference_draft:[draft.lab.youtubeUrl||'',draft.lab.youtubeTimestamp||'',draft.lab.youtubeNote||'']}),
        getState:()=>structuredClone(draft.lab),
        setState:value=>{if(typeof dispose?.setState!=='function')throw Error('This experiment cannot apply changes yet.');dispose.setState(value);},
        save:()=>save('new_question',actorKind,draft.question),
        track:(type,payload)=>events.track(type,payload)
      });
      q('[data-imagine]').hidden=true;
    };
    try{const module=await import(person.module);if(token!==opening)return;validateVideo=module.validateYouTubeReference||null;sources=module.IDEAS_SOURCES||[{label:person.domain+' diagram',url:location.origin+'/'+person.module.slice(2),locator:'Implemented mathematical model; not a real-world measurement'}];q('[data-lab]').replaceChildren();dispose=module[person.mount](q('[data-lab]'),{initialState:draft.lab,onChange:value=>{const priorSources=JSON.stringify([currentSources(),draft.lab.youtubeUrl,draft.lab.youtubeTimestamp,draft.lab.youtubeNote]);draft.lab=structuredClone(value);keep();musicScene?.render();if(JSON.stringify([currentSources(),draft.lab.youtubeUrl,draft.lab.youtubeTimestamp,draft.lab.youtubeNote])!==priorSources)experimentDispose?.contextChanged();},onEvent:(type,payload)=>{musicScene?.event(type,payload);events.track('learning.'+pathway+'.action',{pathway,character:person.name,actor_kind:actorKind,scenario_kind:'fictional_composite',type,payload});}});if(pathway==='music')musicScene=mountMusicScene(q('[data-lab]'),dispose,(type,payload)=>events.track('learning.music.action',{pathway,actor_kind:actorKind,type,payload}));ready=true;saveButtons.forEach(button=>{button.disabled=false;});}catch(e){if(token===opening)q('[data-lab]').textContent='This experiment could not open: '+e.message;}
    const recordedJob=new URLSearchParams(location.search).get('experiment');
    if(ready&&artifactId&&recordedJob){
      q('.learning-next').hidden=false;
      q('[data-panel="next"]').setAttribute('aria-expanded','true');
      q('[data-imagine]').onclick();
      await experimentDispose?.resume(recordedJob,artifactId);
    }
    events.track('learning.path.open',{pathway,character:person.name,actor_kind:actorKind,scenario_kind:'fictional_composite',goal:person.goal});await history();
  }
  function chooser(){dispose?.();dispose=null;opening++;openDrawer('learning-choice','Follow what moves you.','THREE WORLDS / ONE SCHOOL');document.querySelector('#drawer').classList.add('learning-drawer');onCleanup(()=>{opening++;dispose?.();dispose=null;document.querySelector('#drawer').classList.remove('learning-drawer');});body().innerHTML=`<div class="learning-people">${Object.entries(PATHS).map(([id,p])=>`<button data-path="${id}"><span class="learning-world-icon learning-world-icon--${id}" aria-hidden="true">${({music:'♫',movement:'◌',ideas:'✧'})[id]}</span><small>${esc(p.domain)}</small><h3>${esc(p.name)}</h3><p>${esc(p.goal)}</p><span>Begin with ${esc(p.name)} ↗</span></button>`).join('')}</div><p class="learning-label">Interactive worlds · fictional characters</p>`;body().querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>open(b.dataset.path));}
  return {open,chooser};
}
