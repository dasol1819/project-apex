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

function rigHinge(root,name,parts,forwardPoint,aftPoint){
 const pivot=new T.Group();
 pivot.name=name;
 const forward=root.worldToLocal(new T.Vector3(...forwardPoint));
 const aft=root.worldToLocal(new T.Vector3(...aftPoint));
 const axis=aft.sub(forward).normalize();
 pivot.position.copy(forward);
 root.add(pivot);
 for(const part of parts)pivot.attach(part);
 return angle=>pivot.quaternion.setFromAxisAngle(axis,angle);
}

function rigTailControls(root){
 // MiG-23 slab tails rotate about swept shafts, rather than an elevator
 // hinge. The shaft crosses approximately half the authored root chord.
 // Samara University's structural reference gives about 45 degrees to the
 // fuselage side; the exact installation position is a visual fit.
 const controls=[
  {name:'port stabilator',mesh:'stab2',field:'leftTail',part:3,sign:-1,
   start:[-.68,-.60,6.62],end:[.32,-.60,5.62]},
  {name:'starboard stabilator',mesh:'stab',field:'rightTail',part:4,sign:-1,
   start:[.68,-.60,6.62],end:[1.68,-.60,7.62]},
  // The forward skin vertices define the rudder's swept, nearly vertical pin.
  {name:'rudder',mesh:'rudder',field:'leftRudder',part:20,sign:1,
   start:[0,.0922,6.8594],end:[0,1.2794,7.5492]}
 ].map(control=>{
  const mesh=root.getObjectByName(control.mesh);
  return {...control,rotate:mesh?rigHinge(root,'MiG-23MLD '+control.name,[mesh],control.start,control.end):null};
 });
 return state=>{
  for(const c of controls){
   if(!c.rotate||!Number.isFinite(state[c.field])||state.enabled?.[c.part]===0||state.enabled?.[c.part]===false)continue;
   c.rotate(c.sign*clamp(state[c.field],-.6,.6));
  }
 };
}

// OBJ0024 is authored in the starboard-folded position.
function rigVentralFin(root){
 const fin=root.getObjectByName('OBJ0024');
 if(!fin)return ()=>{};
 const rotate=rigHinge(root,'MiG-23MLD ventral fin hinge',[fin],
  [-.063,-1.818,5.267],[-.050,-1.759,6.085]);
 return gear=>rotate(-Math.PI/2*(1-gear));
}

function rigNoseGear(root){
 const strut=['stoykanos','nos','OBJ0041','OBJ0355'].map(name=>root.getObjectByName(name));
 const doors=['OBJ0047','OBJ0063'].map(name=>root.getObjectByName(name));
 if([...strut,...doors].some(part=>!part))return ()=>{};
 // The transverse pin sits at the front of the bay. The strut folds aft.
 const fold=rigHinge(root,'MiG-23MLD nose strut hinge',strut,
  [0,-.887,-3.93],[1,-.887,-3.93]);
 const close=doors.map((door,i)=>{
  const x=i===0?-.208:.208;
  return rigHinge(root,`MiG-23MLD nose door ${i===0?'port':'starboard'}`,[door],
   [x,-1.082,-4.136],[x,-1.179,-2.377]);
 });
 return gear=>{
  const stow=1-gear;
  // The doors clear the moving wheel before closing, in either direction.
  const travel=T.MathUtils.smoothstep(stow,0,.80);
  const closure=Math.PI/2*T.MathUtils.smoothstep(stow,.78,1);
  fold(-T.MathUtils.degToRad(92)*travel);
  close[0](closure);
  close[1](-closure);
 };
}

// Port and starboard use the original GLB's mirrored parts. Closed door
// positions register the door skin UV vertices to the matching fuselage edges.
function rigMainGear(root){
 const range=(first,last)=>Array.from({length:last-first+1},(_,i)=>i+first);
 const sides=[
  {side:-1,name:'port',doors:[43,44],wheel:[46,...range(109,124)],
   beam:[125,130,134,136,138,140],cylinder:108,rod:141},
  {side:1,name:'starboard',doors:[61,62],wheel:[131,...range(147,162)],
   beam:[163,168,170,172,174,176,177],cylinder:181,rod:182}
 ];
 const find=id=>root.getObjectByName('OBJ'+String(id).padStart(4,'0'));
 const rig=sides.map(({side,name,doors,wheel,beam,cylinder,rod})=>{
  const point=([x,y,z])=>root.worldToLocal(new T.Vector3(side*x,y,z));
  const origin=point([0,0,0]);
  const rotation=([x,y,z],degrees)=>new T.Quaternion().setFromAxisAngle(
   point([x,y,z]).sub(origin).normalize().multiplyScalar(side),T.MathUtils.degToRad(degrees));
  const mount=(label,at,ids)=>{
   const pivot=new T.Group();
   pivot.name=`MiG-23MLD main gear ${name} ${label}`;
   pivot.position.copy(at);
   root.add(pivot);
   for(const id of ids){const part=find(id);if(part)pivot.attach(part);}
   return pivot;
  };
  const panel=(part,label,start,end,axis,angle)=>{
   const at=point(start),closed=point(end);
   const pivot=mount(label,at,[]);
   if(part)pivot.attach(part);
   const turn=rotation(axis,angle);
   return amount=>{
    pivot.position.lerpVectors(at,closed,amount);
    pivot.quaternion.identity().slerp(turn,amount);
   };
  };
  const closeLower=panel(find(doors[0]),'lower door',[.25437,-1.46876,2],[.25435,-1.46986,2.01661],
   [-.00127,-.06628,.99780],90);
  const closeUpper=panel(find(doors[1]),'upper door',[.79182,-.46903,2],[.79188,-.46977,2.01384],
   [-.00473,.05363,-.99855],30);
  const base=point([.24,-1.38,1.55]),joint=point([.938,-1.662,1.706]);
  const startArm=joint.clone().sub(base),endArm=point([.59344,-.70923,1.70638]).sub(base);
  const beamAxis=startArm.clone().normalize(),twist=new T.Quaternion();
  const beamEnd=new T.Quaternion().setFromUnitVectors(beamAxis,endArm.normalize());
  const wheelEnd=rotation([-.34044,.17258,-.92429],42.661);
  const upper=mount('beam',base,beam),lower=mount('wheel carrier',joint,wheel);
  const forwardSkin=find(beam[0])?.children.find(part=>part.material?.name==='fuzcamo');
  const coverOrigin=point([.817,-1.931,1.458]),coverEnd=point([.83,-.818,1.534]);
  const coverOffset=coverOrigin.clone().sub(base),coverTurn=rotation([0,0,1],90);
  const forwardCover=mount('forward cover',coverOrigin,[]);
  if(forwardSkin)forwardCover.attach(forwardSkin);
  const head=point([.548,-.429,1.62]),tail=point([.447,-1.355,1.575]);
  const actuatorBase=tail.clone().sub(head),actuatorDirection=actuatorBase.clone().normalize();
  const ramMount=tail.clone().sub(base),stroke=new T.Vector3();
  const shell=mount('actuator cylinder',head,[cylinder]),piston=mount('actuator rod',head,[rod]);
  return gear=>{
   const stow=1-gear,travel=T.MathUtils.smoothstep(stow,0,.83);
   upper.quaternion.identity().slerp(beamEnd,travel);
   // Roll the offset linkage into the bay while keeping the wheel joint fixed.
   upper.quaternion.multiply(twist.setFromAxisAngle(beamAxis,T.MathUtils.degToRad(-170*side)*travel));
   lower.position.copy(startArm).applyQuaternion(upper.quaternion).add(base);
   lower.quaternion.identity().slerp(wheelEnd,travel);
   stroke.copy(ramMount).applyQuaternion(upper.quaternion).add(base).sub(head);
   const length=stroke.length();
   stroke.normalize();
   shell.quaternion.setFromUnitVectors(actuatorDirection,stroke);
   piston.quaternion.copy(shell.quaternion);
   piston.position.copy(head).addScaledVector(stroke,length-actuatorBase.length());
   const latch=T.MathUtils.smoothstep(stow,.72,1);
   forwardCover.position.copy(coverOffset).applyQuaternion(upper.quaternion).add(base).lerp(coverEnd,latch);
   forwardCover.quaternion.copy(upper.quaternion).slerp(coverTurn,latch);
   closeLower(T.MathUtils.smoothstep(stow,.79,1));
   closeUpper(T.MathUtils.smoothstep(stow,.85,1));
  };
 });
 return gear=>{for(const pose of rig)pose(gear);};
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
 let sweep=()=>{},setVentralFin=()=>{},setNoseGear=()=>{},setMainGear=()=>{},setTailControls=()=>{},exhaust=null,loaded=false,failed=false,lastAngle=16,lastGear=1;
 const lastControls={leftTail:0,rightTail:0,leftRudder:0};
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
   setNoseGear=rigNoseGear(normalized.root);
   setMainGear=rigMainGear(normalized.root);
   setTailControls=rigTailControls(normalized.root);
   alignGroundContact(normalized.root);
   exhaust=rigExhaust(normalized.root,plume);
   sweep=rig;
   base.group.add(normalized.root);
   sweep(lastAngle);
   setVentralFin(lastGear);
   setNoseGear(lastGear);
   setMainGear(lastGear);
   setTailControls(lastControls);
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
  for(const field of ['leftTail','rightTail','leftRudder'])
   if(Number.isFinite(state[field]))lastControls[field]=state[field];
  lastControls.enabled=state.enabled;
  if(loaded){
   sweep(angle);
   setVentralFin(lastGear);
   setNoseGear(lastGear);
   setMainGear(lastGear);
   setTailControls(lastControls);
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
