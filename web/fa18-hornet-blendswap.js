// User-provided high-poly F/A-18B Hornet reference, visually adapted for the
// existing two-seat F/A-18F slot. NOT a Super Hornet-accurate airframe.
// Source: ChrisKuhn, "High Poly Hornet", BlendSwap, CC BY.
// Original 2013 F/A-18B mesh converted to glTF by ImageToStl.com.
import * as T from './vendor/three.module.js';
import {createClassicAircraft} from './classic-aircraft.js';
import {aircraftDefinition} from './aircraft-catalog.js';
import {parseMig23Glb} from './mig23mld-glb.js';

const SRC='./assets/fa18b/F-18_BlendSwap_Final.glb';
const HASH='92aadb055e8683e03f15a38483c88523cc349b3d90c0adec5103d0b9c9e5075c';
const BYTES=26179284;
const REAL_LENGTH=17.1; // Classic Hornet B; do not use F/A-18F dimensions.
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
let templatePromise=null,reportedMissing=false;

async function loadTemplate(){
 if(!templatePromise)templatePromise=(async()=>{
  const response=await fetch(SRC+'?v='+HASH.slice(0,12));
  if(!response.ok)throw new Error('F/A-18B model HTTP '+response.status);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==BYTES)throw new Error('F/A-18B source asset size mismatch');
  if(!globalThis.crypto?.subtle)throw new Error('WebCrypto unavailable; refusing unverified airframe');
  const digest=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),
   value=>value.toString(16).padStart(2,'0')).join('');
  if(digest!==HASH)throw new Error('F/A-18B source asset checksum mismatch');
  const source=await parseMig23Glb(bytes);
  source.scene.name='F/A-18B High Poly Hornet (ChrisKuhn / CC BY)';
  // The BlendSwap scene also includes three oversized photo-studio planes.
  // They are not airframe geometry and must not affect dimensions or shadows.
  source.scene.traverse(node=>{
   if(/^Plane(?:\.\d+)?$/.test(node.name))node.visible=false;
   if(/^(AIM-9_Missile|AIM-9_Launcher|Missile\.|2K_Bomb|MultipleEjectorRack|Pylon)(?:\.|$)/.test(node.name))
    node.visible=false; // Native loadout draws live stores, never static duplicates.
   if(!node.isMesh)return;
   const m=node.material;
   if(!m)return;
   if(m.name==='CockpitGlass'){
    m.color.set('#879fac');m.metalness=.06;m.roughness=.14;
    m.transparent=true;m.opacity=.47;m.depthWrite=false;
   }else if(/BlackMaterial|Material\.000|Material\.002/.test(m.name)){
    m.color.set('#202a33');m.metalness=.18;m.roughness=.76;
   }else if(m.name==='MainBodyMat'){
    m.color.set('#8795a3');m.metalness=.22;m.roughness=.65;
   }else if(/Wing_Material|Fuselage_Material|StabilerMat/.test(m.name)){
    m.color.set('#9ca6ad');m.metalness=.16;m.roughness=.75;
   }else if(m.name==='Engine_Material'){
    m.color.set('#555f67');m.metalness=.52;m.roughness=.52;
   }
  });
  return source.scene;
 })();
 return templatePromise;
}
function normalizeHornet(scene){
 const body=scene.getObjectByName('Fuselage');
 if(!body)throw new Error('F/A-18B fuselage missing');
 const box=new T.Box3().setFromObject(body),size=box.getSize(new T.Vector3());
 if(!(size.x>4&&size.x<7&&size.z>0.6&&size.z<3))throw new Error('F/A-18B unexpected model scale/orientation');
 const center=box.getCenter(new T.Vector3());
 scene.position.sub(center);
 const root=new T.Group();
 root.name='Hornet B reference exterior on F/A-18F simulation';
 root.rotation.y=-Math.PI/2; // Source -X nose, Apex -Z nose.
 root.scale.setScalar(REAL_LENGTH/size.x);
 root.add(scene);
 return root;
}
function gearRig(scene){
 const members=[];
 scene.traverse(node=>{
  if(!node.name||!/(?:Forward_Landing_Gear|Rear_Landing_Gear|Rear_Tires|Forward_Gear_Doors|Rear_.*Gear_Doors|Main_Forward_Gear_Door|Secondary_Forward_Gear_Door)/.test(node.name))return;
  if(node.parent?.name&&/(?:Landing_Gear|Gear_Doors)/.test(node.parent.name))return;
  members.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),
   isDoor:/Door/.test(node.name),isFront:/Forward/.test(node.name)});
 });
 return value=>{
  const retract=1-clamp(value,0,1);
  for(const entry of members){
   const {node,position,quaternion,isDoor,isFront}=entry;
   node.position.copy(position);
   node.quaternion.copy(quaternion);
   node.position.y+=retract*(isDoor?.06:.31);
   node.rotation.z+=retract*(isDoor?.45:(isFront?-.72:.64));
   node.visible=isDoor||retract<.94;
  }
 };
}
// Keep the existing fully functional flight/weapon/damage model until the
// exact uploaded asset arrives; missing or corrupt files must not blank the jet.
export function createFa18HornetExterior(options={}){
 const base=createClassicAircraft(12,options);
 base.group.name='F/A-18F native flight | F/A-18B optional exterior';
 const standIns=[];
 base.group.traverse(node=>{if(node.isMesh||node.isLineSegments)standIns.push(node);});
 const controller=new AbortController();
 let loaded=false,failed=false,rig=()=>{},root=null,lastGear=1;
 (async()=>{
  try{
   const scene=(await loadTemplate()).clone(true);
   if(controller.signal.aborted)return;
   root=normalizeHornet(scene);
   rig=gearRig(scene);
   rig(lastGear);
   base.group.add(root);
   loaded=true;
   for(const obj of standIns)obj.visible=false;
  }catch(error){
   failed=true;
   if(!reportedMissing){reportedMissing=true;console.warn('F/A-18B exterior not installed; retaining native F/A-18F mesh:',error);}
  }
 })();
 const originalUpdate=base.update.bind(base);
 function update(state={},dt=0){
  originalUpdate(state,dt);
  if(Number.isFinite(state.gear))lastGear=clamp(state.gear,0,1);
  if(loaded){rig(lastGear);for(const obj of standIns)obj.visible=false;}
 }
 function dispose(){controller.abort();base.dispose?.();}
 return {...base,definition:aircraftDefinition(12),update,dispose,
  get sourceLoaded(){return loaded},get sourceFailed(){return failed}};
}
