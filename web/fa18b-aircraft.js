// ChrisKuhn "High Poly Hornet" (BlendSwap, CC BY); original legacy F/A-18B.
// This visual replacement occupies existing simulator slot 12 (formerly F/A-18F).
// Flight/combat WASM in slot 12 remains the Super Hornet baseline for now.
import * as THREE from './vendor/three.module.js';
import {createClassicAircraft} from './classic-aircraft.js';
import {parseMig23Glb} from './mig23mld-glb.js?v=4';

const SOURCE='./assets/fa18/F18_Hornet_optimized.glb';
const LENGTH_M=16.8, SPAN_M=12.3;
const HIDDEN_STORES=/^(?:Plane(?:\\.\\d+)?|2K_Bomb(?:\\.\\d+)?|AIM-9_Missile(?:\\.\\d+)?|AIM-9_Launcher(?:\\.\\d+)?|Missile(?:\\.\\d+)?|MultipleEjectorRack(?:\\.\\d+)?|Pylon(?:\\.\\d+)?|Fuel_Tank_External)$/;
const GEAR_PART=/^(?:Forward_Landing_Gear|Rear_Landing_Gear|Rear_Tires|Forward_Gear_Doors|Rear_Main_Gear_Doors|Rear_Secondary_Gear_Doors|Main_Forward_Gear_Door|Secondary_Forward_Gear_Door)/;
let sourceBuffer;
function loadSource(){
 if(!sourceBuffer)sourceBuffer=fetch(SOURCE).then(response=>{
  if(!response.ok)throw Error('F/A-18B GLB HTTP '+response.status);
  return response.arrayBuffer();
 }).catch(error=>{sourceBuffer=null;throw error;});
 return sourceBuffer;
}
function fitExterior(scene){
 // Keep the source geometry and material hierarchy intact, but do not render
 // weapons baked into the model: the simulator adds the actual equipped stores.
 const object=scene;
 object.traverse(node=>{if(HIDDEN_STORES.test(node.name))node.visible=false;});
 object.updateMatrixWorld(true);
 const bounds=new THREE.Box3();
 object.traverse(node=>{
  if(!node.isMesh)return;
  for(let p=node;p&&p!==object;p=p.parent)if(!p.visible)return;
  bounds.expandByObject(node,true);
 });
 if(bounds.isEmpty())throw Error('F/A-18B contains no visible airframe');
 const size=bounds.getSize(new THREE.Vector3());
 if(!(size.x>3&&size.x<100&&size.z>2))throw Error('F/A-18B geometry extent invalid');
 const center=bounds.getCenter(new THREE.Vector3());
 object.position.sub(center);
 const root=new THREE.Group();
 root.name='F/A-18B authored exterior';
 // The source uses -X for the nose and Z for the span.
 // Game coordinates use -Z forward and X for the wings.
 root.rotation.y=-Math.PI/2;
 const foreAft=LENGTH_M/size.x;
 root.scale.set(foreAft,foreAft,SPAN_M/size.z);
 // With gear down, align the source wheel plane to the existing game's
 // nominal rendered landing-gear plane. Native contacts are unchanged.
 root.position.y=-1.60-(bounds.min.y-center.y)*foreAft;
 root.add(object);
 const landingGear=[];
 object.traverse(node=>{if(GEAR_PART.test(node.name))landingGear.push(node);});
 return {root,landingGear};
}
export function createFa18bAircraft(options={}){
 const base=createClassicAircraft(12,options);
 const shell=base.group;
 shell.name='F/A-18B Hornet | F404-GE-400';
 shell.userData.aircraftType=12;
 const standIns=[];
 shell.traverse(node=>{if(node.isMesh||node.isLineSegments)standIns.push(node);});
 let visual=null,loaded=false,failed=false,disposed=false,lastGear=1;
 loadSource().then(parseMig23Glb).then(asset=>{
  if(disposed)return;
  visual=fitExterior(asset.scene);
  shell.add(visual.root);
  for(const node of standIns)node.visible=false;
  for(const node of visual.landingGear)node.visible=lastGear>=.10;
  loaded=true;
 }).catch(error=>{
  if(!disposed){failed=true;console.error('F/A-18B exterior load failed; original type 12 fallback remains:',error);}
 });
 const baseUpdate=base.update.bind(base);
 function update(state={},dt=0){
  baseUpdate(state,dt);
  if(Number.isFinite(state.gear))lastGear=Math.max(0,Math.min(1,state.gear));
  if(!loaded)return;
  for(const node of standIns)node.visible=false;
  for(const node of visual.landingGear)node.visible=lastGear>=.10;
 }
 const originalDispose=base.dispose?.bind(base);
 function dispose(){disposed=true;originalDispose?.();}
 return {...base,group:shell,update,dispose,
  get sourceLoaded(){return loaded;},get sourceFailed(){return failed;}};
}
