import * as T from './vendor/three.module.js';
import {createClassicAircraft} from './classic-aircraft.js';
import {aircraftDefinition} from './aircraft-catalog.js';
import {parseMig23Glb,normalizeMig23,rigMig23Sweep} from './mig23mld-glb.js?v=2';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const ENGINE_PART=7, NOZZLE_PART=22;
const DRY_CONTRACTION=.10;

// Type 16 uses a shared contact height for all three native gear probes.
const GEAR_CONTACT_Y=-1.42;

function alignGroundContact(root){
 root.updateMatrixWorld(true);
 const wheels=['OBJ0109','OBJ0131'].map(name=>root.getObjectByName(name));
 if(wheels.some(wheel=>!wheel))return;
 const bounds=new T.Box3();
 for(const wheel of wheels)bounds.expandByObject(wheel,true);
 if(!bounds.isEmpty())root.position.y+=GEAR_CONTACT_Y-bounds.min.y;
}

// OBJ0024 is authored in the starboard-folded position. The two points
// are the centres of the hinge pads, measured in normalized airframe metres.
function rigVentralFin(root){
 const fin=root.getObjectByName('OBJ0024');
 if(!fin)return ()=>{};
 const pivot=new T.Group();
 pivot.name='MiG-23MLD ventral fin hinge';
 const forward=root.worldToLocal(new T.Vector3(-.063,-1.818,5.267));
 const aft=root.worldToLocal(new T.Vector3(-.050,-1.759,6.085));
 const axis=aft.sub(forward).normalize();
 pivot.position.copy(forward);
 root.add(pivot);
 pivot.attach(fin);
 return gear=>pivot.quaternion.setFromAxisAngle(axis,-Math.PI/2*(1-gear));
}

// The authored soplo mesh already contains the petals. Move their lips
// radially while keeping the forward mounting ring fixed.
function rigExhaust(root, plume){
 const nozzle=root.getObjectByName('soplo');
 if(!nozzle)return null;
 root.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(nozzle,true);
 const center=bounds.getCenter(new T.Vector3());
 plume.position.set(center.x,center.y,bounds.max.z);
 // The smallest radius of the authored lip is 84% of the mounting radius.
 const radius=bounds.getSize(new T.Vector3()).x*.42;
 const petals=[];
 nozzle.traverse(mesh=>{
  const geometry=mesh.geometry, position=geometry?.getAttribute('position');
  if(!position)return;
  geometry.computeBoundingBox();
  const localCenter=mesh.worldToLocal(center.clone());
  const {min,max}=geometry.boundingBox;
  const offsets=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++){
   // The source model faces +Z before normalization, so its lip is at -Z.
   const travel=DRY_CONTRACTION*(1-T.MathUtils.smoothstep(position.getZ(i),min.z,max.z));
   offsets[i*3]=(localCenter.x-position.getX(i))*travel;
   offsets[i*3+1]=(localCenter.y-position.getY(i))*travel;
  }
  geometry.morphAttributes.position=[new T.BufferAttribute(offsets,3)];
  geometry.morphTargetsRelative=true;
  mesh.updateMorphTargets();
  petals.push(mesh);
 });
 return (opening,length)=>{
  for(const mesh of petals)mesh.morphTargetInfluences[0]=1-opening;
  const aperture=radius*(1-DRY_CONTRACTION*(1-opening));
  plume.scale.set(aperture,aperture,length);
 };
}

function createPlume(){
 // One open, axisymmetric mesh. UV.y runs from the lip to the plume tip.
 const profile=[[1,0],[.97,.10],[.98,.23],[.89,.41],[.72,.61],[.49,.81],[.09,1]];
 const geometry=new T.LatheGeometry(profile.map(([r,z])=>new T.Vector2(r,z)),32);
 geometry.rotateX(Math.PI/2);
 const material=new T.ShaderMaterial({
  transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
  uniforms:{heat:{value:0},time:{value:0}},
  vertexShader:`
   #include <common>
   #include <logdepthbuf_pars_vertex>
   varying vec2 plumeUV;
   void main(){
    plumeUV=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`
   #include <logdepthbuf_pars_fragment>
   uniform float heat;
   uniform float time;
   varying vec2 plumeUV;
   void main(){
    #include <logdepthbuf_fragment>
    float z=plumeUV.y;
    float cells=pow(0.5+0.5*cos(33.0*z-1.3*z*z),4.0);
    float flicker=0.91+0.09*sin(28.0*z-21.0*time);
    float fade=(1.0-smoothstep(0.17,1.0,z))*smoothstep(0.0,0.035,z);
    vec3 tint=mix(vec3(1.0,0.67,0.33),vec3(0.52,0.42,0.94),smoothstep(0.1,0.63,z));
    gl_FragColor=vec4(tint,heat*fade*flicker*(0.21+0.34*cells));
   }`
 });
 const plume=new T.Mesh(geometry,material);
 plume.name='R-35-300 exhaust visual';
 plume.visible=false;
 return plume;
}

// The gameplay shell must exist synchronously for camera, damage, gear,
// weapons and fixed-tick effects while the large authored GLB streams.
export function createMig23mldAircraft(options={}){
 const base=createClassicAircraft(4,options);
 base.group.name='MiG-23MLD | R-35-300 / Flogger-K';
 base.group.userData.aircraftType=16;
 base.group.userData.previewOnly=false;
 const standIns=[];
 base.group.traverse(n=>{if(n.isMesh||n.isLineSegments)standIns.push(n);});
 let sweep=()=>{},setVentralFin=()=>{},exhaust=null,loaded=false,failed=false,lastAngle=16,lastGear=1;
 const plume=createPlume();
 base.group.add(plume);
 const controller=new AbortController();
 (async()=>{
  try{
   const r=await fetch('./assets/mig23mld/Mig-23.glb?v=3',{signal:controller.signal});
   if(!r.ok)throw Error('MiG-23 source GLB HTTP '+r.status);
   const buffer=await r.arrayBuffer(),asset=await parseMig23Glb(buffer);
   const normalized=normalizeMig23(asset.scene);
   const rig=rigMig23Sweep(asset.scene,asset.nodes);
   if(controller.signal.aborted){normalized.root.traverse(n=>{n.geometry?.dispose?.();});return;}
   setVentralFin=rigVentralFin(normalized.root);
   alignGroundContact(normalized.root);
   exhaust=rigExhaust(normalized.root,plume);
   sweep=rig;
   base.group.add(normalized.root);
   sweep(lastAngle);
   setVentralFin(lastGear);
   exhaust?.(0,0);
   loaded=true;
   for(const node of standIns)node.visible=false;
  }catch(error){if(!controller.signal.aborted){failed=true;console.error('MiG-23MLD original exterior unavailable; using flight geometry fallback:',error);}}
 })();
 const originalUpdate=base.update.bind(base);
 function update(state={},dt=0){
  originalUpdate(state,dt);
  const angle=Number.isFinite(state.wingSweep)?clamp(state.wingSweep,16,72):lastAngle;
  lastAngle=angle;
  if(Number.isFinite(state.gear))lastGear=clamp(state.gear,0,1);
  if(loaded){
   sweep(angle);
   setVentralFin(lastGear);
   for(const node of standIns)node.visible=false;
  }
  const ab=clamp(Number(state.afterburner)||0,0,1);
  const engineHealth=clamp(state.health?.[ENGINE_PART]??1,0,1);
  const nozzleHealth=clamp(state.health?.[NOZZLE_PART]??1,0,1);
  const running=(state.enabled?.[ENGINE_PART]??1)>0 && engineHealth>.04;
  const heat=running?ab*engineHealth*nozzleHealth:0;
  const opening=running&&(state.enabled?.[NOZZLE_PART]??1)>0?ab*nozzleHealth:0;
  plume.visible=exhaust!==null&&heat>.03;
  plume.material.uniforms.heat.value=heat;
  plume.material.uniforms.time.value=state.time??0;
  exhaust?.(opening,1.35+2.3*heat);
 }
 function dispose(){
  controller.abort();
  plume.material.dispose();
  plume.geometry.dispose();
 }
 return {...base,definition:aircraftDefinition(16),group:base.group,update,dispose,get sourceLoaded(){return loaded},get sourceFailed(){return failed}};
}
