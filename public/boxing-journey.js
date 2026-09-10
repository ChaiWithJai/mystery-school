import {mountBoxingMirror} from './boxing-mirror.js';
import {mountBoxingFoundationScene} from './boxing-foundation-scene.js';
import {BOXING_FOUNDATIONS} from './boxing-foundations.js';
import {BOXING_LESSONS} from './boxing-curriculum.js';
import {requestLocalCue} from './local-coach-client.js';

export const BOXING_JOURNEY_LESSONS=[...BOXING_LESSONS];
for(const foundation of BOXING_FOUNDATIONS.foundations)for(const source of foundation.sources||[]){
  if(source.reviewStatus!=='reviewed_video'||!source.cue)continue;
  const id=source.id;
  if(BOXING_JOURNEY_LESSONS.some(l=>l.id===id))continue;
  const url=new URL(source.url),videoId=url.searchParams.get('v');
  if(!videoId)continue;
  BOXING_JOURNEY_LESSONS.push({id,title:foundation.title,cues:[source.cue],source:source.url,
    embedUrl:`https://www.youtube.com/embed/${videoId}?start=${Math.floor(source.evidenceTimestampSeconds)}&rel=0`,
    evidenceTimestampSeconds:source.evidenceTimestampSeconds,evidenceType:source.evidenceType,sha256:source.sha256});
}

export function mountBoxingJourney(container,{initialState={},onChange=()=>{},onEvent=()=>{},sessionId,actorKind='agent_review'}={}){
  container.classList.add('boxing-journey');
  let alive=true,version=0,mirror,scene,request;
  const intro=document.createElement('div'),stage=document.createElement('div'),coach=document.createElement('details');
  intro.className='boxing-journey-intro';
  stage.hidden=true;coach.hidden=true;
  coach.className='boxing-journey-coach';
  coach.innerHTML='<summary>Coach between attempts</summary><button type="button">Ask local AI for one cue</button><p role="status"></p>';
  const revisit=document.createElement('button');revisit.type='button';revisit.className='boxing-journey-map';revisit.textContent='Body map';revisit.hidden=true;revisit.onclick=()=>{const saved=mirror.getState();mirror.dispose();mountMirror(saved);stage.hidden=true;coach.hidden=true;intro.hidden=false;intro.scrollIntoView({behavior:'smooth',block:'start'});};
  container.append(intro,revisit,stage,coach);
  const getState=()=>({...mirror.getState(),foundation:scene.getState()});
  const changed=()=>{version++;request?.abort();onChange(getState());};
  const mountMirror=state=>{
    mirror=mountBoxingMirror(stage,{initialState:state,lessons:BOXING_JOURNEY_LESSONS,onChange:()=>{if(scene)changed();},onEvent});
  };
  mountMirror(initialState);
  scene=mountBoxingFoundationScene(intro,{initialState:initialState.foundation,onChange:()=>changed(),onEvent,
    onLesson:lesson=>{
      if(!BOXING_JOURNEY_LESSONS.some(l=>l.id===lesson.id))BOXING_JOURNEY_LESSONS.push(lesson);
      const previous=mirror.getState();mirror.dispose();
      const reflection=previous.lessonProgress?.[lesson.id]?.reflection||'';
      mountMirror({...previous,lessonId:lesson.id,reflection});changed();
      intro.hidden=true;revisit.hidden=false;stage.hidden=false;coach.hidden=false;
      stage.scrollIntoView({behavior:'smooth',block:'nearest'});
    }});
  const button=coach.querySelector('button'),status=coach.querySelector('[role=status]');
  button.onclick=async()=>{
    const state=getState(),text=state.reflection;
    if(!text?.trim()){status.textContent='Keep one observation from your attempt first.';return;}
    const captured=version,foundation_id=state.foundation.foundationId;
    const attempt={session_id:sessionId,attempt_id:crypto.randomUUID(),state_version:captured,pathway:'movement',
      actor_kind:actorKind==='agent_review'?'agent_review':'human',foundation_id,
      tracking_confidence:0,observations:[{id:'reflection',fact:text.slice(0,300),source_kind:'learner_report'}]};
    request?.abort();request=new AbortController();button.disabled=true;status.textContent='Considering your observation…';
    onEvent('boxing.coach.request',{attempt_id:attempt.attempt_id,foundation_id,state_version:captured,submitted_reflection_characters:Math.min(text.length,300)});
    try{
      const answer=await requestLocalCue(attempt,{signal:request.signal,isCurrent:()=>alive&&version===captured});
      if(!alive||version!==captured)return;
      if(answer.status==='ready'){status.textContent=answer.result.cue;onEvent('boxing.coach.response',answer.result);}
    }catch(error){if(alive&&version===captured){status.textContent='Local AI is unavailable. Your source-guided practice still works.';onEvent('boxing.coach.unavailable',{attempt_id:attempt.attempt_id,reason:error.name});}}
    finally{if(alive)button.disabled=false;}
  };
  return {getState,setState(value){request?.abort();mirror.setState(value);scene.setState(value.foundation||{});version++;},dispose(){alive=false;request?.abort();scene.dispose?.();mirror.dispose();intro.remove();revisit.remove();stage.remove();coach.remove();}};
}
