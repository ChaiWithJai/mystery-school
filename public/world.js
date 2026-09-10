import * as THREE from 'three';

const PALETTE={pine:0x2b654e,moss:0x7c9470,earth:0x526c52,rock:0x405a4e,gold:0xd7bc70,cream:0xe8dfb5};
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const ISLAND_IDS=['memory','questions','experiments','futures','people','reflection'];

export function selectLearningArtifacts(artifacts,pathway){
  const unique=new Map();
  for(const record of Array.isArray(artifacts)?artifacts:[]){
    if(record&&typeof record.id==='string'&&record.id&&record.pathway===pathway)unique.set(record.id,record);
  }
  return [...unique.values()].sort((a,b)=>{
    const at=Date.parse(a.created_at||a.timestamp)||0,bt=Date.parse(b.created_at||b.timestamp)||0;
    return at-bt;
  }).slice(-6);
}

export function learningArtifactLabel(record){
  const stage={attempt:'Attempt',revision:'Revision',sharing_response:'Staged response',new_question:'New question'}[record.stage]||'Saved version';
  const agent=record.actor_kind==='agent_review'||/^AGENT QA TEST\b/.test(record.note||'')||/^AGENT QA TEST\b/.test(record.state?.explanation||'');
  const staged=record.actor_kind==='staged_peer_response'||record.stage==='sharing_response';
  return `${stage}${agent?' / agent QA':''}${staged&&record.stage!=='sharing_response'?' / staged':''}`;
}

export class SchoolWorld{
  constructor(container,labels,onSelect,onProjection=()=>{},onLearningSelect=()=>{}){
    this.onLearningSelect=onLearningSelect;this.learningMap={pathways:[],artifacts:[],activePathway:null};this.learningEntries=[];
    this.container=container;this.labelContainer=labels;this.onSelect=onSelect;this.onProjection=onProjection;this.versionLabels=[];this.versionRoot=new THREE.Group();this.random=rng(4271);this.paused=matchMedia('(prefers-reduced-motion: reduce)').matches;this.selected=null;this.lens='together';this.blender=false;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x173e35);this.scene.fog=new THREE.FogExp2(0x173e35,.019);
    this.camera=new THREE.PerspectiveCamera(37,1,.1,250);this.camera.position.set(23,23,28);this.look=new THREE.Vector3(0,0,0);this.targetLook=new THREE.Vector3(-3,0,0);this.targetPosition=new THREE.Vector3(24,26,34);this.sceneCenter=new THREE.Vector3();
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xeaf4d5,0x17362f,2.4));this.sun=new THREE.DirectionalLight(0xffe2ab,4);this.sun.position.set(-12,22,4);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:60});this.sun.shadow.bias=-.0003;this.scene.add(this.sun);const rim=new THREE.DirectionalLight(0x9ddcda,2);rim.position.set(15,6,-12);this.scene.add(rim);
    this.root=new THREE.Group();this.scene.add(this.root);this.islands=[];this.labels=[];this.portalMeshes=[];this.lines=[];this.trees=[];this.hitTargets=[];this.clock=new THREE.Clock();
    this.materials={};for(const[k,c]of Object.entries(PALETTE))this.materials[k]=new THREE.MeshStandardMaterial({color:c,roughness:.88});
    this.scene.add(this.versionRoot);this.makeIslands();this.makeAtmosphere();this.makeConnections();this.addLabels();this.resize();new ResizeObserver(()=>this.resize()).observe(container);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();let start=null;
    container.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};});
    container.addEventListener('pointermove',e=>{if(!start||!e.buttons)return;const dx=e.clientX-start.lastX,dy=e.clientY-start.lastY;start.lastX=e.clientX;start.lastY=e.clientY;const offset=this.targetPosition.clone().sub(this.targetLook);const spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta-=dx*.005;spherical.phi=THREE.MathUtils.clamp(spherical.phi+dy*.005,.25,1.35);this.targetPosition.copy(this.targetLook).add(new THREE.Vector3().setFromSpherical(spherical));});
    container.addEventListener('pointerup',e=>{if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)return;const r=container.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.hitTargets,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});if(hit){let obj=hit.object;while(obj&&obj.userData.index===undefined&&!obj.userData.jobId&&!obj.userData.learningTarget)obj=obj.parent;if(obj?.userData.learningTarget)this.activateLearning(obj.userData.learningTarget);else if(obj?.userData.jobId)this.onProjection(obj.userData.jobId);else if(obj&&obj.userData.index!==undefined){const pathway=this.learningMap.pathways.find(p=>p.islandIndex===obj.userData.index);if(pathway)this.activateLearning({pathway:pathway.id,artifactId:null});else this.onSelect(obj.userData.index);}}});
    container.addEventListener('wheel',e=>{e.preventDefault();this.zoom(e.deltaY>0?1.06:.94);},{passive:false});
    this.animate();
  }
  mesh(geometry,material,parent,x=0,y=0,z=0){const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  tree(parent,x,z,scale=1,type=0){
    const tree=new THREE.Group();tree.position.set(x,.18,z);tree.scale.setScalar(scale);this.mesh(new THREE.CylinderGeometry(.035,.085,.9,6),this.materials.earth,tree,0,.42,0);
    if(type===1){for(let k=0;k<3;k++)this.mesh(new THREE.IcosahedronGeometry(.38-k*.04,1),this.materials[k%2?'moss':'pine'],tree,k===1?.18:-.08,.85+k*.3,k===2?.15:0);}
    else{for(let k=0;k<3;k++){const m=this.materials[k===2?'moss':'pine'];this.mesh(new THREE.ConeGeometry(.42-k*.09,.9-k*.09,7),m,tree,0,.8+k*.35,0);}}
    parent.add(tree);this.trees.push(tree);return tree;
  }
  island(x,z,radius,index){
    const g=new THREE.Group();g.position.set(x,index===-1?.4:Math.sin(index*2)*.25,z);g.userData.index=index;this.root.add(g);
    const top=new THREE.CylinderGeometry(radius*.96,radius,0.25,48);this.mesh(top,this.materials.earth,g,0,.04,0);
    const mound=new THREE.SphereGeometry(radius,36,18,0,Math.PI*2,0,Math.PI/2);const cap=this.mesh(mound,this.materials.moss,g,0,.11,0);cap.scale.y=.095;
    const underside=this.mesh(new THREE.ConeGeometry(radius,2.5,11,3),this.materials.rock,g,0,-1.3,0);underside.rotation.z=Math.PI;
    const path=new THREE.Mesh(new THREE.RingGeometry(radius*.58,radius*.62,80),new THREE.MeshStandardMaterial({color:0xccbc8b,roughness:1,side:THREE.DoubleSide}));path.rotation.x=-Math.PI/2;path.position.y=.23;g.add(path);
    for(let n=0;n<(index===-1?32:17);n++){const a=this.random()*Math.PI*2,rr=radius*(.38+this.random()*.5);this.tree(g,Math.cos(a)*rr,Math.sin(a)*rr,.6+this.random()*.55,n%6===0?1:0);}
    for(let k=0;k<10;k++){const a=k/10*Math.PI*2;const rock=this.mesh(new THREE.DodecahedronGeometry(.2+this.random()*.25),this.materials.rock,g,Math.cos(a)*radius*.94,-.2,Math.sin(a)*radius*.94);rock.rotation.set(this.random()*2,this.random()*3,this.random());}
    const ring=new THREE.Mesh(new THREE.RingGeometry(radius+0.28,radius+.30,100),new THREE.MeshBasicMaterial({color:PALETTE.gold,transparent:true,opacity:.25,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-.08;g.add(ring);
    this.islands.push(g);this.hitTargets.push(g);return g;
  }
  makeIslands(){
    const main=this.island(0,0,3.3,-1);this.makeGreatTree(main);this.makeBooks(main,0,.1,1.2);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;const g=this.island(Math.cos(a)*9.2,Math.sin(a)*9.2,2,i);this.addFeature(g,i);}
    this.makeSteps(main);
  }
  makeGreatTree(parent){
    const bronze=new THREE.MeshStandardMaterial({color:0x90713e,roughness:.75});
    this.mesh(new THREE.CylinderGeometry(.19,.42,2.6,8),bronze,parent,0,1.25,0);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const branch=this.mesh(new THREE.CylinderGeometry(.055,.11,1.8,6),bronze,parent,Math.cos(a)*.55,2.0+Math.sin(i)*.15,Math.sin(a)*.55);branch.rotation.z=Math.cos(a)*-.7;branch.rotation.x=Math.sin(a)*.7;
      const canopy=this.mesh(new THREE.IcosahedronGeometry(1.1,2),this.materials[i%3===0?'moss':'pine'],parent,Math.cos(a)*.8,2.8+this.random()*.55,Math.sin(a)*.8);canopy.scale.y=.65;}
    this.mesh(new THREE.IcosahedronGeometry(.95,2),this.materials.moss,parent,0,3.55,0);
    const glow=this.mesh(new THREE.SphereGeometry(.10,12,12),new THREE.MeshBasicMaterial({color:0xffe5a2}),parent,0,1.0,1.0);const lamp=new THREE.PointLight(0xfadc94,3,6);lamp.position.copy(glow.position);parent.add(lamp);
  }
  makeBooks(parent,x,y,z){const cream=this.materials.cream;for(let i=0;i<5;i++){const book=this.mesh(new THREE.BoxGeometry(.9,.12,.6),i%2?this.materials.pine:cream,parent,x,y+.22+i*.13,z);book.rotation.y=i*.28;}this.mesh(new THREE.BoxGeometry(1.2,.07,.7),this.materials.earth,parent,x,y+.12,z);}
  makeSteps(parent){for(let i=0;i<5;i++)this.mesh(new THREE.BoxGeometry(.95,.15,.3),this.materials.cream,parent,0,.16-i*.12,2.5+i*.25);}
  addFeature(g,i){
    const cream=this.materials.cream;const brass=new THREE.MeshStandardMaterial({color:PALETTE.gold,metalness:.45,roughness:.4});
    if(i===0){for(let k=0;k<3;k++){this.mesh(new THREE.BoxGeometry(.12,1.1,.55),this.materials.earth,g,-.5+k*.5,.7,0);for(let b=0;b<4;b++)this.mesh(new THREE.BoxGeometry(.27,.15,.32),b%2?cream:brass,g,-.27+k*.5,.3+b*.23,0);}this.makeBooks(g,0,.05,.7);}
    if(i===1){const portal=this.mesh(new THREE.TorusGeometry(.72,.032,8,70),brass,g,0,1.12,0);this.portalMeshes.push(portal);this.mesh(new THREE.SphereGeometry(.12,16,16),new THREE.MeshBasicMaterial({color:0xffe4a3}),g,0,1.14,0);this.mesh(new THREE.CylinderGeometry(.28,.35,.14,24),cream,g,0,.25,0);}
    if(i===2){const table=this.mesh(new THREE.CylinderGeometry(.65,.65,.09,24),cream,g,0,.66,0);for(let a=0;a<3;a++){const angle=a/3*Math.PI*2;this.mesh(new THREE.CylinderGeometry(.04,.05,.5,8),this.materials.earth,g,Math.cos(angle)*.42,.4,Math.sin(angle)*.42);}for(let a=0;a<3;a++){const box=this.mesh(new THREE.DodecahedronGeometry(.16),a%2?brass:this.materials.pine,g,(a-1)*.35,.9,0);box.rotation.y=a;}}
    if(i===3){for(let k=0;k<3;k++){const door=this.mesh(new THREE.TorusGeometry(.45,.028,7,50,Math.PI),brass,g,(k-1)*.72,.95,0);this.portalMeshes.push(door);for(let s of [-1,1])this.mesh(new THREE.CylinderGeometry(.027,.027,.6,8),brass,g,(k-1)*.72+s*.45,.63,0);}}
    if(i===4){this.mesh(new THREE.CylinderGeometry(.47,.47,.09,24),cream,g,0,.65,0);for(let k=0;k<5;k++){const a=k/5*Math.PI*2;const x=Math.cos(a)*.88,z=Math.sin(a)*.88;this.mesh(new THREE.CylinderGeometry(.15,.18,.2,12),this.materials.earth,g,x,.32,z);this.mesh(new THREE.SphereGeometry(.09,10,10),brass,g,x,.62,z);}}
    if(i===5){const pool=this.mesh(new THREE.CircleGeometry(.8,48),new THREE.MeshStandardMaterial({color:0x6fa7a0,metalness:.55,roughness:.15}),g,0,.22,0);pool.rotation.x=-Math.PI/2;const edge=this.mesh(new THREE.TorusGeometry(.85,.035,8,64),cream,g,0,.23,0);edge.rotation.x=Math.PI/2;this.makeBooks(g,.75,.1,.65);}
  }
  makeConnections(){
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,start=new THREE.Vector3(Math.cos(a)*3.4,.1,Math.sin(a)*3.4),end=new THREE.Vector3(Math.cos(a)*7.2,.1,Math.sin(a)*7.2);
      const curve=new THREE.QuadraticBezierCurve3(start,new THREE.Vector3(Math.cos(a+.09)*5.1,1.4,Math.sin(a+.09)*5.1),end);
      const line=new THREE.Mesh(new THREE.TubeGeometry(curve,40,.018,5,false),new THREE.MeshBasicMaterial({color:0xddc887,transparent:true,opacity:.7}));this.scene.add(line);this.lines.push(line);
      for(let j=0;j<6;j++){const t=(j+1)/7;const p=curve.getPoint(t);const mote=this.mesh(new THREE.SphereGeometry(.035,6,6),new THREE.MeshBasicMaterial({color:0xffedb6}),this.scene,p.x,p.y,p.z);mote.userData={curve,phase:t};this.portalMeshes.push(mote);}
    }
    const orbit=new THREE.Mesh(new THREE.RingGeometry(12.4,12.413,240),new THREE.MeshBasicMaterial({color:0xacc59d,transparent:true,opacity:.22,side:THREE.DoubleSide}));orbit.rotation.x=-Math.PI/2;orbit.position.y=-1.5;this.scene.add(orbit);
  }
  makeAtmosphere(){
    const random=this.random;const positions=new Float32Array(600*3);for(let i=0;i<600;i++){positions[i*3]=(random()-.5)*65;positions[i*3+1]=random()*18-5;positions[i*3+2]=(random()-.5)*65;}
    const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(positions,3));this.dust=new THREE.Points(geom,new THREE.PointsMaterial({color:0xd1dfac,size:.038,transparent:true,opacity:.5,sizeAttenuation:true}));this.scene.add(this.dust);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x173b32,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-5;floor.receiveShadow=true;this.scene.add(floor);
    for(let i=0;i<7;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(13+i*2.3,13.015+i*2.3,200),new THREE.MeshBasicMaterial({color:0x6c8e74,side:THREE.DoubleSide,transparent:true,opacity:.08}));ring.rotation.x=-Math.PI/2;ring.position.y=-4.95;this.scene.add(ring);}
  }
  addLabels(){const names=['Memory','Questions','Experiments','Possible futures','Other people','Reflection'];this.islands.forEach((g,k)=>{const b=document.createElement('button');b.className='world-label'+(k===0?' overview-center':'');b.innerHTML=k===0?'Jai’s school':`<span class="num">0${k}</span>${names[k-1]}`;b.setAttribute('aria-label',k===0?'Explore Jai’s school':`Explore ${names[k-1]}`);b.addEventListener('click',()=>this.onSelect(k-1));this.labelContainer.appendChild(b);this.labels.push({button:b,group:g,index:k-1});});}
  learningAnchor(index){return this.blenderRoot?.getObjectByName(index===-1?'island_library':`island_${ISLAND_IDS[index]}`)||this.islands[index+1];}
  activateLearning(target){
    this.setLearningMap({...this.learningMap,activePathway:target.pathway});
    this.onLearningSelect({...target});
  }
  // Declarative input only. Fetching, persistence and opening activities stay in app.js.
  setLearningMap({pathways=[],artifacts=[],activePathway=null}={}){
    const seenIds=new Set(),seenIslands=new Set();
    pathways=(Array.isArray(pathways)?pathways:[]).filter(p=>{
      if(!p||!['music','movement','ideas'].includes(p.id)||!Number.isInteger(p.islandIndex)||p.islandIndex<0||p.islandIndex>5||seenIds.has(p.id)||seenIslands.has(p.islandIndex))return false;
      seenIds.add(p.id);seenIslands.add(p.islandIndex);return true;
    }).map(p=>({id:p.id,label:String(p.label||p.id),islandIndex:p.islandIndex}));
    const active=pathways.find(p=>p.id===activePathway);
    const oldActive=this.learningMap.activePathway;
    this.learningMap={pathways,artifacts:Array.isArray(artifacts)?artifacts:[],activePathway:active?.id||null};
    this.rebuildLearningMap();
    if(active&&oldActive!==active.id)this.focus(active.islandIndex);
    else if(!active&&oldActive)this.overview();
  }
  rebuildLearningMap(){
    const focused=document.activeElement;
    const focusTarget=focused?.matches?.('.learning-doorway,.learning-artifact')?{pathway:focused.dataset.pathway,artifactId:focused.dataset.artifactId||null}:null;
    for(const entry of this.learningEntries){
      entry.button.remove();entry.group.removeFromParent();
      entry.group.traverse(o=>{o.geometry?.dispose();if(o.isLine)o.material.dispose();});
    }
    this.learningEntries=[];
    const {pathways,artifacts,activePathway}=this.learningMap;
    this.labels.forEach(label=>{label.button.hidden=pathways.some(p=>p.islandIndex===label.index);});
    for(const pathway of pathways){
      const anchor=this.learningAnchor(pathway.islandIndex);if(!anchor)continue;
      const doorway=new THREE.Group();doorway.name=`learning_doorway_${pathway.id}`;doorway.position.set(0,.18,1.7);anchor.add(doorway);
      const target={pathway:pathway.id,artifactId:null};doorway.userData.learningTarget=target;
      this.mesh(new THREE.CylinderGeometry(.27,.30,.10,16),this.materials.cream,doorway);
      this.mesh(new THREE.TorusGeometry(.24,.023,7,32),this.materials.gold,doorway,0,.34,0);
      const button=document.createElement('button');button.type='button';button.className='world-label learning-doorway';button.textContent=pathway.label;
      button.dataset.pathway=pathway.id;button.setAttribute('aria-label',`Open pathway: ${pathway.label}`);button.setAttribute('aria-pressed',String(activePathway===pathway.id));button.onclick=()=>this.activateLearning(target);
      this.labelContainer.appendChild(button);this.learningEntries.push({button,group:doorway,pathway:pathway.id,artifact:false});
      if(pathway.id!==activePathway)continue;
      const records=selectLearningArtifacts(artifacts,pathway.id),positions=new Map();
      records.forEach((record,i)=>{
        const group=new THREE.Group();group.name=`learning_artifact_${record.id}`;
        group.position.set((i%3-1)*2.25,.12,3.5+Math.floor(i/3)*1.7);anchor.add(group);
        group.userData.learningTarget={pathway:pathway.id,artifactId:record.id};
        this.mesh(new THREE.CylinderGeometry(.19,.23,.12,12),this.materials.moss,group);
        this.mesh(new THREE.BoxGeometry(.21,.045,.15),this.materials.cream,group,0,.09,0);
        const parent=positions.get(record.parent_id);
        if(parent){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([parent.clone().sub(group.position),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:PALETTE.gold,transparent:true,opacity:.4}));group.add(line);}
        positions.set(record.id,group.position.clone());
        const button=document.createElement('button');button.type='button';button.className='world-label learning-artifact';button.textContent=`${i+1}. ${learningArtifactLabel(record)}`;
        button.dataset.artifactId=record.id;button.dataset.pathway=pathway.id;
        button.title=[learningArtifactLabel(record),record.goal,record.note].filter(Boolean).join('\n');
        button.setAttribute('aria-label',`Reopen ${learningArtifactLabel(record)} for ${pathway.label}, saved ${record.created_at||record.timestamp||'version'}, ID ${record.id}`);
        button.onclick=()=>this.activateLearning({pathway:pathway.id,artifactId:record.id});
        this.labelContainer.appendChild(button);this.learningEntries.push({button,group,pathway:pathway.id,artifact:true});
      });
    }
    if(focusTarget){const entry=this.learningEntries.find(e=>e.pathway===focusTarget.pathway&&(e.button.dataset.artifactId||null)===focusTarget.artifactId);entry?.button.focus({preventScroll:true});}
  }
  renderLearningLabels(w,h){
    for(const entry of this.learningEntries){
      const p=entry.group.localToWorld(new THREE.Vector3(0,entry.artifact ? .32 : .75,0)).project(this.camera);
      entry.button.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1.03||Math.abs(p.y)>1.03;
      let x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;
      if(!entry.artifact&&!entry.button.hidden){
        const halfWidth=entry.button.offsetWidth/2,halfHeight=entry.button.offsetHeight/2;
        x=Math.max(halfWidth+12,Math.min(w-halfWidth-12,x));
        y=Math.max(halfHeight+12,Math.min(h-halfHeight-12,y));
      }
      entry.button.style.left=`${x}px`;entry.button.style.top=`${y}px`;
    }
    if(this.learningMap.activePathway){
      // Pathway labels take priority; retain the central school before other generic labels.
      const occupied=this.learningEntries.filter(e=>!e.button.hidden).map(e=>e.button.getBoundingClientRect());
      for(const {button} of this.labels){
        if(button.hidden||button.style.visibility==='hidden')continue;
        const rect=button.getBoundingClientRect();
        if(occupied.some(r=>rect.left<r.right+6&&rect.right>r.left-6&&rect.top<r.bottom+6&&rect.bottom>r.top-6))button.style.visibility='hidden';
        else occupied.push(rect);
      }
    }
  }
  setProjections(jobs){
    const records=jobs.filter(j=>j.status==='succeeded'&&j.result);
    const signature=records.map(j=>j.id).join('|');if(this.versionSignature===signature)return;this.versionSignature=signature;
    this.versionLabels.forEach(v=>v.button.remove());this.versionLabels=[];this.versionRoot.traverse(o=>{o.geometry?.dispose();if(o.isLine)o.material.dispose();});this.versionRoot.clear();
    const ids=['memory','questions','experiments','futures','people','reflection'],anchors=new Map(),counts={};
    records.forEach(job=>{
      const index=ids.indexOf(job.world);if(index<0)return;const n=counts[index]||0;counts[index]=n+1;
      const home=this.islands[index+1].position.clone();home.y=.3;
      const parent=anchors.get(job.parent_job_id)||home;
      const angle=index*Math.PI/3+(job.parent_job_id ? .02 : -.35)+n*.32;
      const point=parent.clone().add(new THREE.Vector3(Math.cos(angle)*(n?1.6:3.0),.3,Math.sin(angle)*(n?1.6:3.0)));
      const g=new THREE.Group();g.position.copy(point);g.userData.jobId=job.id;this.versionRoot.add(g);anchors.set(job.id,point);
      this.mesh(new THREE.CylinderGeometry(.42,.48,.12,12),this.materials.moss,g);
      const tip=this.mesh(new THREE.ConeGeometry(.48,.65,7),this.materials.rock,g,0,-.38,0);tip.rotation.z=Math.PI;
      this.mesh(new THREE.TorusGeometry(.23,.026,6,30),this.materials.gold,g,0,.32,0);
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([parent,point]),new THREE.LineBasicMaterial({color:PALETTE.gold,transparent:true,opacity:.6}));this.versionRoot.add(line);
      const button=document.createElement('button');button.className='world-label version-label';button.textContent=`v${n+1} · ${job.result.title.replace(/^Astral School:\s*/,'').slice(0,30)}`;button.setAttribute('aria-label',`Open saved projection: ${job.result.title}`);button.onclick=()=>this.onProjection(job.id);this.labelContainer.appendChild(button);this.versionLabels.push({button,group:g,index});
    });
    if(!this.hitTargets.includes(this.versionRoot))this.hitTargets.push(this.versionRoot);
  }
  resize(){const{clientWidth:w,clientHeight:h}=this.container;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  focus(index){this.selected=index;const g=this.learningAnchor(index)||this.islands[0];g.updateWorldMatrix(true,false);const p=g.getWorldPosition(new THREE.Vector3());this.targetLook.copy(p).add(new THREE.Vector3(2.5,.3,0));this.targetPosition.copy(p).add(new THREE.Vector3(8,9,13));this.labels.forEach(l=>{l.button.classList.toggle('active',l.index===index);l.button.style.opacity=l.index===index?'1':'.42';});if(this.learningMap.activePathway&&!this.learningMap.pathways.some(p=>p.id===this.learningMap.activePathway&&p.islandIndex===index)){this.learningMap.activePathway=null;this.rebuildLearningMap();}}
  overview(entered=true){this.selected=null;if(this.learningMap.activePathway){this.learningMap.activePathway=null;this.rebuildLearningMap();}this.targetLook.set(entered?0:-3,0,0);this.targetPosition.set(entered?22:24,entered?24:26,entered?29:34);this.labels.forEach(l=>{l.button.classList.remove('active');l.button.style.opacity='1';});}
  zoom(factor){const offset=this.targetPosition.clone().sub(this.targetLook).multiplyScalar(factor);const length=THREE.MathUtils.clamp(offset.length(),8,70);offset.setLength(length);this.targetPosition.copy(this.targetLook).add(offset);}
  setLens(name){this.lens=name;this.applyVisual(name==='alone'?{tree_density:.3,connection_strength:.1,light:.55,openness:.3}:name==='open'?{tree_density:.7,connection_strength:1,light:.9,openness:.9}:{tree_density:.75,connection_strength:.65,light:.65,openness:.6});}
  applyVisual(v){this.visual=v;this.lines.forEach(l=>l.material.opacity=.1+v.connection_strength*.85);this.sun.intensity=2+v.light*3;this.renderer.toneMappingExposure=.85+v.light*.55;this.trees.forEach((t,i)=>{t.visible=i%10<3+Math.round(v.tree_density*7);});this.root.scale.setScalar(.94+v.openness*.09);if(this.blenderRoot){this.blenderRoot.scale.setScalar(.94+v.openness*.09);this.blenderFoliage?.forEach(o=>{o.visible=o.userData.foliage_batch<Math.ceil(v.tree_density*o.userData.foliage_batch_count);});this.blenderConnections?.traverse(o=>{if(o.isMesh){o.material.transparent=true;o.material.opacity=v.connection_strength;}});}}
  async loadBlender(){try{const{GLTFLoader}=await import('/vendor/three/addons/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/assets/school.glb');const ids=['memory','questions','experiments','futures','people','reflection'];gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.name==='island_library')o.userData.index=-1;const i=ids.findIndex(id=>o.name===`island_${id}`);if(i>=0)o.userData.index=i;});this.blenderFoliage=[];gltf.scene.traverse(o=>{if(/^foliage_/.test(o.name)&&Number.isInteger(o.userData.foliage_batch))this.blenderFoliage.push(o);});this.blenderConnections=gltf.scene.getObjectByName('connections');this.blenderConnections?.traverse(o=>{if(o.isMesh)o.material=o.material.clone();});this.blenderRoot=gltf.scene;this.scene.add(gltf.scene);this.root.visible=false;this.hitTargets=[gltf.scene,this.versionRoot];this.blender=true;if(this.visual)this.applyVisual(this.visual);this.rebuildLearningMap();if(this.learningMap.activePathway){const path=this.learningMap.pathways.find(p=>p.id===this.learningMap.activePathway);if(path)this.focus(path.islandIndex);}return true;}catch(e){console.warn('Blender asset unavailable',e);return false;}}
  animate(){requestAnimationFrame(()=>this.animate());const t=this.clock.getElapsedTime();this.camera.position.lerp(this.targetPosition,.035);this.look.lerp(this.targetLook,.04);this.camera.lookAt(this.look);if(!this.paused){this.dust.rotation.y=t*.006;this.islands.forEach((g,i)=>{g.position.y=(i===0?.4:Math.sin((i-1)*2)*.25)+Math.sin(t*.45+i)*.07;});this.portalMeshes.forEach(o=>{if(o.userData.curve){o.position.copy(o.userData.curve.getPoint((o.userData.phase+t*.06)%1));}else{o.rotation.y=Math.sin(t*.5)*.1;}});}
    const w=this.container.clientWidth,h=this.container.clientHeight;this.scene.updateMatrixWorld();this.camera.updateMatrixWorld();this.labels.forEach(({button,group,index})=>{const anchor=this.learningAnchor(index)||group;const p=anchor.localToWorld(new THREE.Vector3(0,index===-1?4.2:2.05,0)).project(this.camera);button.style.left=`${(p.x*.5+.5)*w}px`;button.style.top=`${(-p.y*.5+.5)*h}px`;button.style.visibility=p.z>1||p.x<-1.1||p.x>1.1?'hidden':'visible';});this.versionLabels.forEach(({button,group,index})=>{const p=group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.85,0)).project(this.camera);button.style.left=`${(p.x*.5+.5)*w}px`;button.style.top=`${(-p.y*.5+.5)*h}px`;button.hidden=!!this.learningMap.activePathway||this.selected!==index||p.z>1||Math.abs(p.x)>1;});this.renderLearningLabels(w,h);this.renderer.render(this.scene,this.camera);}
}
