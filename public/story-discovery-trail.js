export const STORY_DISCOVERIES = Object.freeze([
  ['notice', 'Notice what is here.'], ['control', 'Some things are yours to choose.'],
  ['weather', 'The weather is not one of them.'], ['response', 'Your response can be.'],
  ['room', 'You can make room for someone.'], ['other', 'Their response belongs to them.'],
  ['reading', 'What does this idea mean to you?'], ['action', 'Try one small action in life.'],
  ['return', 'Return with what you noticed.'], ['question', 'Let that become your next question.'],
].map(([id, caption], index) => Object.freeze({id, caption, x: 0, z: 7 - index * 2})));
const IDS = new Set(STORY_DISCOVERIES.map(item => item.id));
export function normalizeDiscoveryTrail(value = {}) {
  return {version: 1, collected: [...new Set((Array.isArray(value?.collected) ? value.collected : []).filter(id => IDS.has(id)))]};
}
export function reduceDiscoveryTrail(value, action) {
  const state = normalizeDiscoveryTrail(value);
  return action?.type === 'collect' && IDS.has(action.id)
    ? normalizeDiscoveryTrail({collected: [...state.collected, action.id]}) : state;
}

/** Pickup records show exploration, never understanding, a completed action, or mastery. */
export function mountDiscoveryTrail({THREE, scene, root, initialState = {}, onChange = () => {}, onEvent = () => {}, onFinish = () => {}}) {
  if (!THREE || !scene?.add || !root?.ownerDocument || [onChange, onEvent, onFinish].some(fn => typeof fn !== 'function')) throw TypeError('Discovery trail needs a scene, root and callbacks.');
  const doc = root.ownerDocument, win = doc.defaultView;
  let state = normalizeDiscoveryTrail(initialState), disposed = false, previous = null, popupLeft = 0, audio = null;
  const reduced = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const group = new THREE.Group(); group.name = 'learner_discovery_trail'; scene.add(group);
  const geometry = new THREE.BoxGeometry(.23, .035, .34), sphere = new THREE.SphereGeometry(.075, 8, 8);
  const haloGeometry = new THREE.TorusGeometry(.34, .016, 6, 36);
  const paper = new THREE.MeshStandardMaterial({color:0xfff2c6, emissive:0xd7bc70, emissiveIntensity:.55, roughness:.65});
  const gold = new THREE.MeshBasicMaterial({color:0xffd987, transparent:true, opacity:.75});
  const sparkCanvas=doc.createElement('canvas');sparkCanvas.width=sparkCanvas.height=32;
  const sparkContext=sparkCanvas.getContext?.('2d');
  let sparkMap=null;
  if(sparkContext){const glow=sparkContext.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'rgba(255,255,255,1)');glow.addColorStop(.25,'rgba(255,232,160,.8)');glow.addColorStop(1,'rgba(255,220,140,0)');sparkContext.fillStyle=glow;sparkContext.fillRect(0,0,32,32);sparkMap=new THREE.CanvasTexture(sparkCanvas);}
  const objects = STORY_DISCOVERIES.map((item, index) => {
    const book = new THREE.Group(); book.position.set(item.x, 1.05, item.z); book.scale.setScalar(1.8); group.add(book);
    for (const side of [-1,1]) {const page = new THREE.Mesh(geometry,paper); page.position.x=side*.115;page.rotation.z=-side*.3;book.add(page);}
    const spark=new THREE.Mesh(sphere,gold);spark.position.y=.2;book.add(spark);
    const halo=new THREE.Mesh(haloGeometry,gold);halo.rotation.x=-Math.PI/2;halo.position.y=-.4;book.add(halo);
    return {book,index};
  });
  const light = new THREE.PointLight(0xffd787, 0, 6); group.add(light);
  const bursts = [], voices = new Set();
  const make = (tag, cls, text) => {const e=doc.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const hud=make('section','discovery-trail');hud.setAttribute('aria-label','Story discoveries, not mastery');
  const label=make('small','discovery-trail__label');
  const pips=make('ol','discovery-trail__pips');
  const dots=STORY_DISCOVERIES.map(item=>{const dot=make('li','');dot.title=item.caption;dot.setAttribute('aria-label',item.caption);pips.append(dot);return dot;});
  const popup=make('p','discovery-trail__reward');popup.setAttribute('role','status');popup.hidden=true;
  const finish=make('button','discovery-trail__finish','Make this yours ↗');finish.type='button';finish.setAttribute('aria-label','Make this yours');finish.hidden=true;
  const finishClick=()=>{if(disposed || state.collected.length!==STORY_DISCOVERIES.length)return;onEvent('discovery.finish.requested',{collected:[...state.collected],evidence_kind:'exploration_only'});onFinish();};
  finish.addEventListener('click',finishClick);hud.append(label,pips,popup,finish);root.append(hud);
  function render() {
    label.textContent=`${state.collected.length} / ${STORY_DISCOVERIES.length} discoveries`;
    STORY_DISCOVERIES.forEach((item,i)=>{const collected=state.collected.includes(item.id);objects[i].book.visible=!collected;dots[i].setAttribute('data-collected',String(collected));dots[i].setAttribute('aria-label',`${collected?'Discovered':'Ahead'}: ${item.caption}`);});
    finish.hidden=state.collected.length!==STORY_DISCOVERIES.length;
  }
  async function enableAudio() {
    if(disposed || win?.navigator?.userActivation?.isActive===false)return false;
    const Audio=win?.AudioContext||win?.webkitAudioContext;if(!Audio)return false;
    try {audio ||= new Audio();if(audio.state!=='running')await audio.resume();return !disposed && audio.state==='running';}catch{return false;}
  }
  function chime(index) {
    if(!audio || audio.state!=='running')return;
    const now=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();
    osc.type='sine';osc.frequency.value=440*Math.pow(2,([0,2,4,7,9][index%5]+(index>4?12:0))/12);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.035,now+.012);gain.gain.exponentialRampToValueAtTime(.001,now+.3);
    osc.connect(gain);gain.connect(audio.destination);voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(now);osc.stop(now+.32);
  }
  function burst(item) {
    const positions=new Float32Array(24*3),directions=[];
    for(let i=0;i<24;i++){const angle=i/24*Math.PI*2;directions.push(new THREE.Vector3(Math.cos(angle),.3+Math.sin(i*2.4),Math.sin(angle)));}
    const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color:0xffde94,size:.055,map:sparkMap,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending});
    const points=new THREE.Points(shape,material);points.position.set(item.x,1.05,item.z);points.frustumCulled=false;group.add(points);bursts.push({points,shape,material,positions,directions,age:0});
    light.position.copy(points.position);light.intensity=2.2;
  }
  function clearBursts(){for(const b of bursts){group.remove(b.points);b.shape.dispose();b.material.dispose();}bursts.length=0;light.intensity=0;}
  function update(camera, dt = 0, elapsed = 0, {active = false} = {}) {
    if(disposed)return;const position=camera?.position||camera;
    const seconds=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
    if(position && Number.isFinite(position.x) && Number.isFinite(position.z)) {
      const distance=previous?Math.hypot(position.x-previous.x,position.z-previous.z):0;
      previous={x:position.x,z:position.z};
      // Mount, idle frames, disabled controls and teleport-sized changes cannot collect.
      if(active && distance>.0001 && distance<=1.5) {
        const item=STORY_DISCOVERIES.find(item=>!state.collected.includes(item.id)&&Math.hypot(position.x-item.x,position.z-item.z)<=1.25);
        if(item){state=reduceDiscoveryTrail(state,{type:'collect',id:item.id});render();popup.textContent=item.caption;popup.hidden=false;popupLeft=3;burst(item);chime(STORY_DISCOVERIES.indexOf(item));onChange(structuredClone(state));onEvent('discovery.collected',{id:item.id,caption:item.caption,sourceId:'epictetus-enchiridion-1',caption_kind:'authored_reflection_prompt',evidence_kind:'exploration_only',collected:[...state.collected]});}
      }
    }
    objects.forEach(({book,index})=>{if(!reduced?.matches){book.position.y=1.05+Math.sin(elapsed*1.8+index)*.08;book.rotation.y=Math.sin(elapsed*.5+index)*.2;}});
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.age+=seconds;const radius=reduced?.matches?.35:b.age*1.7;
      b.directions.forEach((v,j)=>{b.positions[j*3]=v.x*radius;b.positions[j*3+1]=v.y*radius;b.positions[j*3+2]=v.z*radius;});b.shape.attributes.position.needsUpdate=true;b.material.opacity=Math.max(0,1-b.age/.65);
      if(b.age>.65){group.remove(b.points);b.shape.dispose();b.material.dispose();bursts.splice(i,1);}}
    light.intensity=Math.max(0,light.intensity-seconds*5);popupLeft=Math.max(0,popupLeft-seconds);if(!popupLeft)popup.hidden=true;
  }
  render();
  return {update,enableAudio,getState:()=>structuredClone(state),setState(value){if(disposed)throw Error('Discovery trail is closed.');state=normalizeDiscoveryTrail(value);previous=null;popup.hidden=true;popupLeft=0;clearBursts();render();},
    dispose(){if(disposed)return;disposed=true;finish.removeEventListener('click',finishClick);clearBursts();for(const voice of voices){try{voice.stop();}catch{}}voices.clear();if(audio)audio.close().catch(()=>{});geometry.dispose();sphere.dispose();haloGeometry.dispose();paper.dispose();gold.dispose();sparkMap?.dispose();group.removeFromParent();hud.remove();}};
}
