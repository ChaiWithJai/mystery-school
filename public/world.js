import * as THREE from 'three';

const PALETTE={pine:0x2b654e,moss:0x7c9470,earth:0x526c52,rock:0x405a4e,gold:0xd7bc70,cream:0xe8dfb5};
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
export class SchoolWorld{
  constructor(container,labels,onSelect,onProjection=()=>{}){
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
    container.addEventListener('pointerup',e=>{if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>8)return;const r=container.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.hitTargets,true)[0];if(hit){let obj=hit.object;while(obj&&obj.userData.index===undefined&&!obj.userData.jobId)obj=obj.parent;if(obj?.userData.jobId)this.onProjection(obj.userData.jobId);else if(obj&&obj.userData.index!==undefined)this.onSelect(obj.userData.index);}});
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
  focus(index){this.selected=index;const g=this.islands[index+1]||this.islands[0];const p=g.position.clone();this.targetLook.copy(p).add(new THREE.Vector3(2.5,.3,0));this.targetPosition.copy(p).add(new THREE.Vector3(8,9,13));this.labels.forEach(l=>{l.button.classList.toggle('active',l.index===index);l.button.style.opacity=l.index===index?'1':'.42';});}
  overview(entered=true){this.selected=null;this.targetLook.set(entered?0:-3,0,0);this.targetPosition.set(entered?22:24,entered?24:26,entered?29:34);this.labels.forEach(l=>{l.button.classList.remove('active');l.button.style.opacity='1';});}
  zoom(factor){const offset=this.targetPosition.clone().sub(this.targetLook).multiplyScalar(factor);const length=THREE.MathUtils.clamp(offset.length(),8,70);offset.setLength(length);this.targetPosition.copy(this.targetLook).add(offset);}
  setLens(name){this.lens=name;this.applyVisual(name==='alone'?{tree_density:.3,connection_strength:.1,light:.55,openness:.3}:name==='open'?{tree_density:.7,connection_strength:1,light:.9,openness:.9}:{tree_density:.75,connection_strength:.65,light:.65,openness:.6});}
  applyVisual(v){this.visual=v;this.lines.forEach(l=>l.material.opacity=.1+v.connection_strength*.85);this.sun.intensity=2+v.light*3;this.renderer.toneMappingExposure=.85+v.light*.55;this.trees.forEach((t,i)=>{t.visible=i%10<3+Math.round(v.tree_density*7);});this.root.scale.setScalar(.94+v.openness*.09);if(this.blenderRoot){this.blenderRoot.scale.setScalar(.94+v.openness*.09);this.blenderFoliage?.forEach(o=>{o.visible=o.userData.foliage_batch<Math.ceil(v.tree_density*o.userData.foliage_batch_count);});this.blenderConnections?.traverse(o=>{if(o.isMesh){o.material.transparent=true;o.material.opacity=v.connection_strength;}});}}
  async loadBlender(){try{const{GLTFLoader}=await import('/vendor/three/addons/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/assets/school.glb');const ids=['memory','questions','experiments','futures','people','reflection'];gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}if(o.name==='island_library')o.userData.index=-1;const i=ids.findIndex(id=>o.name===`island_${id}`);if(i>=0)o.userData.index=i;});this.blenderFoliage=[];gltf.scene.traverse(o=>{if(/^foliage_/.test(o.name)&&Number.isInteger(o.userData.foliage_batch))this.blenderFoliage.push(o);});this.blenderConnections=gltf.scene.getObjectByName('connections');this.blenderConnections?.traverse(o=>{if(o.isMesh)o.material=o.material.clone();});this.blenderRoot=gltf.scene;this.scene.add(gltf.scene);this.root.visible=false;this.hitTargets=[gltf.scene,this.versionRoot];this.blender=true;if(this.visual)this.applyVisual(this.visual);return true;}catch(e){console.warn('Blender asset unavailable',e);return false;}}
  animate(){requestAnimationFrame(()=>this.animate());const t=this.clock.getElapsedTime();this.camera.position.lerp(this.targetPosition,.035);this.look.lerp(this.targetLook,.04);this.camera.lookAt(this.look);if(!this.paused){this.dust.rotation.y=t*.006;this.islands.forEach((g,i)=>{g.position.y=(i===0?.4:Math.sin((i-1)*2)*.25)+Math.sin(t*.45+i)*.07;});this.portalMeshes.forEach(o=>{if(o.userData.curve){o.position.copy(o.userData.curve.getPoint((o.userData.phase+t*.06)%1));}else{o.rotation.y=Math.sin(t*.5)*.1;}});}
    const w=this.container.clientWidth,h=this.container.clientHeight;this.labels.forEach(({button,group,index})=>{const p=group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,index===-1?4.2:2.05,0)).project(this.camera);button.style.left=`${(p.x*.5+.5)*w}px`;button.style.top=`${(-p.y*.5+.5)*h}px`;button.style.visibility=p.z>1||p.x<-1.1||p.x>1.1?'hidden':'visible';});this.versionLabels.forEach(({button,group,index})=>{const p=group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.85,0)).project(this.camera);button.style.left=`${(p.x*.5+.5)*w}px`;button.style.top=`${(-p.y*.5+.5)*h}px`;button.hidden=this.selected!==index||p.z>1||Math.abs(p.x)>1;});this.renderer.render(this.scene,this.camera);}
}
