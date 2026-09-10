import curriculum from './data/boxing-foundations.json' with {type:'json'};

const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => { Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(value); };
// One canonical JSON source is shared by browser and backend adapters.
export const BOXING_FOUNDATIONS = freeze(curriculum);

export function getBoxingFoundation(id) {
  const lesson=BOXING_FOUNDATIONS.foundations.find(item=>item.id===id);
  return lesson?clone(lesson):null;
}
export function getBoxingFoundationCoachContext(id,{metaphorId}={}) {
  const lesson=getBoxingFoundation(id);
  if(!lesson)return null;
  const chosen=lesson.metaphorIds.includes(metaphorId)?metaphorId:lesson.presentation.defaultMetaphorId;
  return {foundation:lesson,metaphors:clone(BOXING_FOUNDATIONS.metaphors.filter(m=>m.id===chosen)),availableMetaphorIds:lesson.metaphorIds,
    instructionBoundary:lesson.gaps.filter(g=>g.blocks!=='extension_only'),
    coachRules:['Reveal only the chosen body-part metaphor and one cue in a practice; the five foundations are depth, not simultaneous HUD content.','Use only this source-backed cue or the explicitly Jai-authored reflection prompt.','Treat A/B definitions and technical extensions marked pending as questions, not instructions.','Say what the visible frame supports; ask about felt experience. Never award mastery from time, pose or a checkbox.'],
    nextFoundationIds:BOXING_FOUNDATIONS.foundations.filter(item=>item.prerequisiteIds.includes(id)).map(item=>item.id)};
}

export function validateBoxingFoundations(data=BOXING_FOUNDATIONS) {
  const errors=[],gaps=[],rows=data?.foundations||[],ids=new Set(rows.map(r=>r.id)),metaphors=new Set((data?.metaphors||[]).map(m=>m.id));
  if(data?.schemaVersion!==1)errors.push('Unsupported curriculum schema version.');
  if(rows.length!==5)errors.push('Exactly five foundations are required.');
  if(ids.size!==rows.length)errors.push('Foundation IDs must be unique.');
  const visited=new Set(),visiting=new Set();
  function visit(id){if(visiting.has(id)){errors.push(`Prerequisite cycle: ${id}`);return;}if(visited.has(id))return;visiting.add(id);for(const p of rows.find(r=>r.id===id)?.prerequisiteIds||[])if(ids.has(p))visit(p);visiting.delete(id);visited.add(id);}
  const alignment=[],learningIds=new Set();
  rows.forEach((r,index)=>{
    for(const o of [...(r.objectives||[]),...(r.concepts||[]),...(r.assessments||[]),...(r.practice?[r.practice]:[])]){if(!o.id||learningIds.has(o.id))errors.push(`${r.id}: missing or duplicate learning-object ID ${o.id}`);learningIds.add(o.id);}
    for(const p of r.prerequisiteIds||[]){if(!ids.has(p))errors.push(`${r.id}: missing prerequisite ${p}`);else if(rows.findIndex(x=>x.id===p)>=index)errors.push(`${r.id}: prerequisite ${p} is not earlier in sequence`);}
    for(const m of r.metaphorIds||[])if(!metaphors.has(m))errors.push(`${r.id}: unknown metaphor ${m}`);
    if(!r.objectives?.length||!r.concepts?.length||!r.assessments?.length||!r.transfer?.prompt)errors.push(`${r.id}: missing instructional structure`);
    for(const o of r.objectives||[]){const matched=(r.assessments||[]).some(a=>a.objectiveIds?.includes(o.id));alignment.push({objectiveId:o.id,assessmentLinked:matched});if(!matched)errors.push(`${r.id}: unassessed objective ${o.id}`);}
    const objectiveIds=new Set((r.objectives||[]).map(o=>o.id));
    for(const a of r.assessments||[])for(const id of a.objectiveIds||[])if(!objectiveIds.has(id))errors.push(`${r.id}: assessment references unknown objective ${id}`);
    const sources=new Map((r.sources||[]).map(s=>[s.id,s]));
    for(const id of r.practice?.sourceIds||[]){const s=sources.get(id);if(!s||s.reviewStatus!=='reviewed_video'||!s.url||!Number.isFinite(s.evidenceTimestampSeconds)||!s.sha256)errors.push(`${r.id}: unresolved practice source ${id}`);}
    if(r.practice?.sourceIds?.length&&![...sources.values()].some(s=>s.cue===r.practice.cue))errors.push(`${r.id}: practice cue is not backed by a reviewed source cue`);
    if(!r.practice?.cue||r.cognitiveLoad?.maxCuesAtOnce!==1||r.presentation?.maxVisibleMetaphors!==1||r.presentation?.maxCuesAtOnce!==1)errors.push(`${r.id}: one cue per practice is required`);
    if((r.gaps||[]).some(g=>g.blocks!=='extension_only')&&r.practice?.technicalInstructionReady)errors.push(`${r.id}: unresolved technical gap marked ready`);
    gaps.push(...(r.gaps||[]).map(g=>({foundationId:r.id,...g})));
    visit(r.id);
  });
  return {structureValid:errors.length===0,fullInstructionReady:errors.length===0&&gaps.length===0,errors,gaps,alignment,
    cognitiveLoad:rows.map(r=>({foundationId:r.id,...r.cognitiveLoad})),learnerOutcomeVerified:false,compositeQualityScore:null,
    recommendations:gaps.filter(g=>g.blocks!=='extension_only').map(g=>`Resolve ${g.id}: ${g.detail}`)};
}
