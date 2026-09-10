// Included only by the Netlify build; localhost retains its complete studio.
export const HOSTED_CAPABILITIES=Object.freeze({referenceUploads:false,trajectoryStudio:false,localMlflow:false});
export const LOCAL_ONLY_SELECTOR='#reference-open, #photo, label[for="photo"], #use-references, label:has(#use-references), [data-action="reference"], a[href^="/review.html"], a[href^="http://127.0.0.1:5189"], a.trace-link';
export function applyHostedCapabilities(root=document) {
  for(const control of root.querySelectorAll(LOCAL_ONLY_SELECTOR)) {
    if(control.dataset.localOnly==='true')continue;
    control.dataset.localOnly='true';control.hidden=true;control.setAttribute('aria-hidden','true');
    if('disabled' in control)control.disabled=true;
    if(control.tagName==='A')control.removeAttribute('href');
  }
}
if(typeof document!=='undefined') {
  document.documentElement.dataset.deployment='hosted';
  const style=document.createElement('style');style.textContent='[data-local-only="true"]{display:none!important}';document.head.append(style);
  applyHostedCapabilities();
  const observer=new MutationObserver(()=>applyHostedCapabilities());
  observer.observe(document.body,{childList:true,subtree:true});
  // Prevent existing target handlers before they can open an unsupported flow.
  document.addEventListener('click',event=>{if(event.target.closest?.(LOCAL_ONLY_SELECTOR+', [data-local-only="true"]')){event.preventDefault();event.stopImmediatePropagation();}},true);
}
