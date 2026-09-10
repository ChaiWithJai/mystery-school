const PATHWAYS = new Set(['music', 'movement', 'ideas']);

export function shouldShowOpening(search, seen = false) {
  const params = new URLSearchParams(search);
  return !seen && !params.has('artifact') && !PATHWAYS.has(params.get('path'));
}
