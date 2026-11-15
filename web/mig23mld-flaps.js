import * as T from './vendor/three.module.js';
import {FLAP_RIG} from './mig23mld-flap-data.js?v=1';

// The two authored inboard sections and outer section share a straight pin.
// Eight welded source vertices establish each pin; no skin/UV is recut.
export function rigMig23Flaps(root){
 root.updateWorldMatrix(true,true);
 const rigs=FLAP_RIG.map(data=>{
  const nodes=data.nodes.map(name=>root.getObjectByName(name));
  if(nodes.some(n=>!n)||nodes.some(n=>n.parent!==nodes[0].parent))throw Error('MiG23 flap source hierarchy changed');
  const parent=nodes[0].parent,hinge=new T.Group();
  hinge.name='MiG-23MLD '+(data.part===16?'port':'starboard')+' trailing-edge flap';
  hinge.userData.damageIndex=data.part;
  hinge.position.copy(parent.worldToLocal(new T.Vector3(...data.point)));
  const axis=new T.Vector3(...data.axis).applyQuaternion(parent.getWorldQuaternion(new T.Quaternion()).invert()).normalize();
  parent.add(hinge);for(const node of nodes)hinge.attach(node);
  return {...data,hinge,axis,initialized:false};
 });
 return {parts:rigs.map(r=>({part:r.part,node:r.hinge})),update(state){
  for(const rig of rigs){
   const field=rig.part===16?'leftFlap':'rightFlap',angle=state[field];
   if(!Number.isFinite(angle))continue;
   // A late original must first replay the native frozen impact position,
   // even when that native part is already disabled. Later updates freeze.
   if(rig.initialized&&((state.health?.[rig.part]??1)<.08||state.enabled?.[rig.part]===0||state.enabled?.[rig.part]===false))continue;
   rig.hinge.quaternion.setFromAxisAngle(rig.axis,rig.sign*T.MathUtils.clamp(angle,0,25*Math.PI/180));
   rig.initialized=true;
  }
 }};
}
