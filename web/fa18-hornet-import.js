// User-provided ChrisKuhn "High Poly Hornet" exterior (BlendSwap, CC BY).
// This is the legacy two-seat F/A-18B, NOT the Super Hornet F/A-18F.
// Native F/A-18F flight, damage and weapon simulation remains unchanged.
import * as THREE from './vendor/three.module.js';
import {createClassicAircraft} from './classic-aircraft.js';
import {parseMig23Glb} from './mig23mld-glb.js?v=2';

const SOURCE='./assets/fa18/F18_Hornet_optimized.glb?v=1';
let modelPromise;
function loadSource(){
 if(!modelPromise)modelPromise=fetch(SOURCE).then(r=>{
  if(!r.ok)throw Error('F/A-18 model HTTP '+r.status);
  return r.arrayBuffer();
 }).then(parseMig23Glb).catch(e=>{modelPromise=null;throw e;});
 return modelPromise;
}
function fitExterior(scene){
 const object=scene.clone(true);
 const hidden=/^(?:Plane(?:\.\d+)?|2K_Bomb(?:\.\d+)?|AIM-9_Missile(?:\.\d+)?|AIM-9_Launcher(?:\.\d+)?|Missile(?:\.\d+)?|MultipleEjectorRack(?:\.\d+)?|Pylon(?:\.\d+)?|Fuel_Tank_External)$/;
 object.traverse(n=>{if(hidden.test(n.name))n.visible=false;});
 const body=object.getObjectByName('Fuselage');
 if(!body)throw Error('F/A-18B body node missing');
 object.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(body);
 const size=box.getSize(new THREE.Vector3());
 if(!(size.x>3&&size.x<100))throw Error('F/A-18B geometry extent invalid');
 object.position.sub(box.getCenter(new THREE.Vector3()));
 const root=new THREE.Group();
 root.name='F/A-18B authored exterior (F/A-18F visual reference only)';
 root.rotation.y=-Math.PI/2;
 root.scale.setScalar(18.38/size.x);
 root.add(object);
 const gear=[];
 object.traverse(n=>{if(/^(?:Forward_Landing_Gear|Rear_Landing_Gear|Forward_Gear_Doors|Rear_Main_Gear_Doors|Rear_Secondary_Gear_Doors|Main_Forward_Gear_Door|Secondary_Forward_Gear_Door|Rear_Tires)/.test(n.name))gear.push(n);});
 return {root,gear};
}
export function createFa18fSourceAircraft(options={}){
 const base=createClassicAircraft(12,options),shell=base.group;
 const fallback=[];
 shell.traverse(n=>{if(n.isMesh||n.isLineSegments)fallback.push(n);});
 let visual=null,loaded=false,failed=false,stowed=false,disposed=false;
 loadSource().then(data=>{
  if(disposed)return;
  visual=fitExterior(data.scene);
  shell.add(visual.root);
  loaded=true;
  for(const n of fallback)n.visible=false;
 }).catch(error=>{
  if(!disposed){failed=true;console.warn('F/A-18B GLB missing or invalid; retaining native F/A-18F model',error);}
 });
 const originalUpdate=base.update.bind(base);
 function update(state={},dt=0){
  originalUpdate(state,dt);
  if(!loaded)return;
  for(const n of fallback)n.visible=false;
  if(Number.isFinite(state.gear))stowed=state.gear<.10;
  for(const n of visual.gear)n.visible=!stowed;
 }
 const originalDispose=base.dispose?.bind(base);
 function dispose(){disposed=true;originalDispose?.();}
 return {...base,update,dispose,get sourceLoaded(){return loaded;},get sourceFailed(){return failed;}};
}
