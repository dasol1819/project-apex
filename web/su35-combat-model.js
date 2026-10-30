// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';
import {cachedSu35Asset} from './su35-asset.js?v=5';
import {createSu35Model} from './su35-model.js?v=5';
import {aircraftDefinition,storeMount,irStoreAvailable} from './aircraft-catalog.js';
import {PRESETS,bombMount,bombAvailable} from './loadout-catalog.js';
import {createRussianMissileModel} from './russian-missile-model.js';
import {createBombModel} from './bomb-model.js';
import {enableWorldDepthIn} from './world-depth.js';
import {createSu35Plumes} from './su35-combat-effects.js?v=5';

const V=(...p)=>new T.Vector3(...p);
export function createSu35CombatAircraft({asset=cachedSu35Asset()}={}){
  if(!asset)throw new Error('Su-35S assets must finish loading before aircraft selection');
  const model=createSu35Model(asset,{combat:true}),shell=model.group,group=new T.Group();
  group.name='Su-35S · 52 / RF-81719';group.add(shell);shell.position.z-=1.2;
  group.userData={...shell.userData,aircraftType:13,previewOnly:false,modelRevision:'su35-combat-5'};
  group.updateMatrixWorld(true);
  const storeRoot=new T.Group();storeRoot.name='Su-35S external weapon stations';group.add(storeRoot);
  const stores=[],pylonMaterial=new T.MeshStandardMaterial({color:0x9bbac8,roughness:.72,metalness:.13});
  function station(kind,slot,object,position,part){
    // Stations use the same CG-relative coordinates as the native launch code.
    const root=new T.Group();root.name=`Su-35S ${kind} station ${slot+1}`;root.position.set(...position);
    root.userData.weaponStore={kind,slot};root.add(object);storeRoot.add(root);
    const length=kind==='ir'?1.35:.95,top=kind==='ir'?.58:Math.abs(position[0])>2?.52:-.57;
    const height=Math.max(.10,top-position[1]-.10),pylon=new T.Mesh(new T.BoxGeometry(.075,height,length),pylonMaterial);
    pylon.name='Su-35S launch rail and pylon';pylon.position.y=.10+height/2;root.add(pylon);
    stores.push({root,kind,slot,part,object});
  }
  for(let i=0;i<2;i++)station('ir',i,createRussianMissileModel('r73'),storeMount(13,'ir',i),12+i);
  for(let i=0;i<6;i++)station('rf',i,createRussianMissileModel('r771'),storeMount(13,'rf',i),(i<4?1:27)+i%2);
  for(let i=0;i<2;i++)station('bomb',i,createBombModel(6),bombMount({aircraft:13},i),1+i);
  const pod=createT220();station('pod',0,pod,[.72,-.92,-.85],28);
  group.updateMatrixWorld(true);
  const anchors=shell.userData.effectsAnchors;
  group.userData.effectsAnchors=Object.fromEntries(Object.entries(anchors).map(([key,points])=>[key,points.map(p=>shell.localToWorld(V(...p)).toArray())]));
  group.userData.damagePartBounds=model.damageParts.map((part,i)=>{
    const b=new T.Box3();part.traverse(node=>{if(!node.isMesh||node.userData.visualEffect||node.material.isShaderMaterial)return;
      node.geometry.computeBoundingBox();b.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));});
    if(b.isEmpty())b.setFromCenterAndSize(V(),V(.1,.1,.1));
    return{min:b.min.toArray(),max:b.max.toArray(),center:b.getCenter(V()).toArray(),half:b.getSize(V()).multiplyScalar(.5).toArray()};
  });
  group.userData.gearContacts=[[0,-2.1,-4.07],[-2.20,-2.1,1.72],[2.20,-2.1,1.72]];
  // Preserve world coordinates while making unspent stores part of wreckage.
  for(const item of stores){model.damageParts[item.part].attach(item.root);enableWorldDepthIn(item.root);}
  const plumes=createSu35Plumes(model.exhaustFrames);
  const innerUpdate=model.update;
  function update(s={},dt=1/60){
    const attitude=new T.Euler().setFromQuaternion(group.quaternion,'YXZ');
    innerUpdate({...s,altitude:group.position.y,heading:-attitude.y,bank:attitude.z,pitchAngle:attitude.x},dt);
    const preset=PRESETS[s.bombs?.[22]]||PRESETS[38];
    for(const item of stores){
      const installed=item.kind==='ir'?item.slot<preset.ir:item.kind==='rf'?!!(preset.rfMask&(1<<item.slot)):item.kind==='bomb'?item.slot<preset.bombs:!!preset.pod;
      const available=item.kind==='ir'?irStoreAvailable(s.missiles,item.slot):item.kind==='rf'?(s.amraam?.[16+item.slot]??1):item.kind==='bomb'?bombAvailable(s.bombs,item.slot):true;
      item.root.visible=!!installed&&model.damageParts[item.part].visible&&(s.health?.[0]??1)>=.08;
      item.object.visible=!!available;
    }
    plumes.forEach(({root,material},i)=>{const power=(s.afterburner??0)*(s[i?'rightEngineFactor':'leftEngineFactor']??1);
      root.visible=power>.01&&model.damageParts[7+i].visible&&model.damageParts[22+i].visible&&s.enabled?.[7+i]!==0;
      material.uniforms.power.value=Math.min(1,power);material.uniforms.time.value=s.time??0;root.scale.z=.65+.5*Math.min(1,power);});
    group.updateMatrixWorld(true);
  }
  update();
  return {...model,group,update,definition:aircraftDefinition(13),gun:{...model.gun,mount:shell.localToWorld(model.gun.mount.clone())}};
}

function createT220(){
  const root=new T.Group();root.name='T220/E optical targeting pod · approximate exterior';
  const metal=new T.MeshStandardMaterial({color:0x9aa8a9,roughness:.63,metalness:.3}),glass=new T.MeshStandardMaterial({color:0x102f38,roughness:.12,metalness:.5});
  const body=new T.Mesh(new T.CylinderGeometry(.16,.17,2.0,32),metal);body.rotation.x=Math.PI/2;root.add(body);
  const head=new T.Mesh(new T.SphereGeometry(.195,32,20),metal);head.position.z=-1.0;root.add(head);
  for(const [x,y,r]of [[-.07,-.03,.065],[.07,.035,.052]]){const lens=new T.Mesh(new T.CircleGeometry(r,24),glass);lens.rotation.y=Math.PI;lens.position.set(x,y,-1.171);root.add(lens);}
  return root;
}
