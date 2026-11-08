import * as T from './vendor/three.module.js';
import {createClassicAircraft} from './classic-aircraft.js';
import {parseMig23Glb,normalizeMig23,rigMig23Sweep} from './mig23mld-glb.js?v=2';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
// The gameplay shell must exist synchronously for camera, damage, gear,
// weapons and fixed-tick effects while the large authored GLB streams.
export function createMig23mldAircraft(options={}){
 const base=createClassicAircraft(4,options);
 base.group.name='MiG-23MLD | R-35-300 / Flogger-K';
 const standIns=[];
 base.group.traverse(n=>{if(n.isMesh||n.isLineSegments)standIns.push(n);});
 let original=null,sweep=()=>{},loaded=false,failed=false,lastAngle=16;
 const nozzle=new T.Group();nozzle.name='R-35-300 exhaust visual';nozzle.position.set(0,-.02,7.75);base.group.add(nozzle);
 const plumeMaterial=new T.MeshBasicMaterial({color:0x83c4ff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide});
 const cone=new T.Mesh(new T.ConeGeometry(.47,3.2,18,1,true),plumeMaterial);
 cone.rotation.x=Math.PI/2;cone.position.z=1.55;nozzle.add(cone);
 const shockMat=new T.MeshBasicMaterial({color:0xffca87,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
 const ring=new T.Mesh(new T.TorusGeometry(.51,.075,8,28),shockMat);
 ring.position.z=.05;nozzle.add(ring);
 const controller=new AbortController();
 (async()=>{
  try{
   const r=await fetch('./assets/mig23mld/Mig-23.glb?v=3',{signal:controller.signal});
   if(!r.ok)throw Error('MiG-23 source GLB HTTP '+r.status);
   const buffer=await r.arrayBuffer(),asset=await parseMig23Glb(buffer);
   const normalized=normalizeMig23(asset.scene);
   const rig=rigMig23Sweep(asset.scene,asset.nodes);
   if(controller.signal.aborted){normalized.root.traverse(n=>{n.geometry?.dispose?.();});return;}
   original=normalized.root;sweep=rig;
   base.group.add(original);sweep(lastAngle);loaded=true;
   for(const node of standIns)node.visible=false;
  }catch(error){if(!controller.signal.aborted){failed=true;console.error('MiG-23MLD original exterior unavailable; using flight geometry fallback:',error);}}
 })();
 const originalUpdate=base.update.bind(base);
 function update(state={},dt=0){
  originalUpdate(state,dt);
  const angle=Number.isFinite(state.wingSweep)?clamp(state.wingSweep,16,72):lastAngle;
  lastAngle=angle;
  if(loaded){
   sweep(angle);
   for(const node of standIns)node.visible=false;
  }
  // Native engine spool and afterburner state drive the single jet plume.
  const ab=clamp(Number(state.afterburner)||0,0,1);
  const power=clamp(Number(state.engine)||0,0,1);
  const health=Array.isArray(state.health)?Number(state.health[7]??1):1;
  const lit=clamp(health,0,1)*ab;
  cone.visible=lit>.03;ring.visible=lit>.03;
  plumeMaterial.opacity=.11+.37*lit;
  shockMat.opacity=.12+.58*lit;
  cone.scale.setScalar(.7+.45*lit);
  cone.scale.z=1;
  nozzle.visible=health>.04;
 }
 function dispose(){controller.abort();plumeMaterial.dispose();shockMat.dispose();cone.geometry.dispose();ring.geometry.dispose();}
 return {...base,group:base.group,update,dispose,get sourceLoaded(){return loaded},get sourceFailed(){return failed}};
}
