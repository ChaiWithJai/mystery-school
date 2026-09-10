const PATHWAYS = new Set(['music', 'movement', 'ideas']);

export function shouldShowOpening(search, seen = false) {
  const params = new URLSearchParams(search);
  return !seen && !params.has('artifact') && !params.has('correct') && params.get('view')!=='forest' && params.has('path') && !PATHWAYS.has(params.get('path'));
}

export function initialPathway(search) {
  const params=new URLSearchParams(search);
  if(PATHWAYS.has(params.get('path')))return params.get('path');
  if(params.has('path')||params.has('artifact')||params.has('correct')||params.get('view')==='forest')return null;
  return 'music';
}
