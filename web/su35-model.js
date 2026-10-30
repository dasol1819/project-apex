// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';
import {createAirframeKit} from './classic-airframe-kit.js';
import {geometry} from './fighter-exterior-tools.js';
import {paintSu35Markings} from './su35-markings.js?v=5';
import {modernSu35Cockpit} from './su35-cockpit.js?v=5';
import {flankerNozzle} from './su35-details.js?v=5';
import {applySu35Livery} from './su35-livery.js?v=5';
import {su35StructuralMeshes} from './su35-structure.js?v=5';

export const SU35=Object.freeze({id:13,key:'su35',name:'Su-35S',nickname:'Flanker-E',length:21.9,span:15.3,engines:2,
  palette:[0x9fb4c1,0x657f91,0x839eae,0xb9cbd4],previewOnly:true});
const V=(...p)=>new T.Vector3(...p),mix=T.MathUtils.lerp;

function surfaceMaterials(textures={}){
  const skin=new T.MeshStandardMaterial({color:0xe4ebee,map:textures.albedo??null,roughness:.72,metalness:.08,envMapIntensity:.65,
    aoMap:textures.ao??null,aoMapIntensity:.32,bumpMap:textures.albedo??null,bumpScale:.00035,side:T.DoubleSide});
  applySu35Livery(skin);
  return {
    skin,glass:new T.MeshPhysicalMaterial({color:0x748a8e,roughness:.055,metalness:.08,transparent:true,opacity:.48,depthWrite:false,
      clearcoat:1,clearcoatRoughness:.035,side:T.DoubleSide,envMapIntensity:1.1}),
    metal:new T.MeshStandardMaterial({color:0x8b9390,roughness:.46,metalness:.72,envMapIntensity:.55}),
    rubber:new T.MeshStandardMaterial({color:0x14191a,roughness:.96,metalness:0}),
    seat:new T.MeshStandardMaterial({color:0xffffff,map:textures.seat??null,roughness:.94,metalness:0}),
    wheel:new T.MeshStandardMaterial({color:0x909990,roughness:.52,metalness:.45}),
    nozzle:new T.MeshStandardMaterial({color:0xd4dce0,vertexColors:true,roughness:.63,metalness:.68,envMapIntensity:.45,side:T.DoubleSide})
  };
}

function duct(k,side){
  const part=side<0?27:28,cx=side*1.25,cy=-.067,front=-1.08,N=64,rows=18,p=[],colors=[],ix=[];
  const wall=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.96,metalness:.04,side:T.DoubleSide});
  for(let j=0;j<=rows;j++)for(let i=0;i<N;i++){
    const t=j/rows,a=i/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a),power=mix(.40,1,t);
    const x=Math.sign(c)*Math.pow(Math.abs(c),power)*mix(.405,.425,t),y=Math.sign(s)*Math.pow(Math.abs(s),power)*mix(.43,.425,t);
    p.push(cx+x,cy+y,front+1.05+t*3.10);const shade=mix(.025,.002,t);colors.push(shade*.88,shade*.94,shade);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N,c=a+N,d=b+N;ix.push(a,c,b,b,c,d);}
  const g=geometry(p,ix);g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  k.mesh(g,wall,part).name='Su-35 recessed inlet duct';
  const end=front+4.20,fanMat=new T.MeshStandardMaterial({color:0x242c2e,roughness:.85,metalness:.3,side:T.DoubleSide});
  k.tube(.425,.425,.025,[cx,cy,end],part,k.materials.dark);
  for(let i=0;i<32;i++){
    const a=i/32*Math.PI*2,b=a+.12;
    const pos=(r,angle,z)=>[cx+Math.cos(angle)*r,cy+Math.sin(angle)*r,z];
    k.solid([pos(.11,a,end-.018),pos(.405,a+.13,end-.035),pos(.405,b+.13,end-.055),pos(.11,b,end-.035)],part,fanMat,.004);
  }
  k.ellipsoid([.10,.10,.12],[cx,cy,end-.07],part,fanMat,undefined,24);
  const hinge=k.hinge(part,[cx,cy+.36,front+.20],'intakeRamp',[1,0,0],1);
  const ramp=new T.MeshStandardMaterial({color:0x293336,roughness:.86,metalness:.15});
  k.solid([[cx-.34,cy+.36,front+.20],[cx+.34,cy+.36,front+.20],
    [cx+.32,cy+.17,front+1.45],[cx-.32,cy+.17,front+1.45]],part,ramp,.018,hinge);
  return {side,center:[cx,cy,front],part,opening:{half:[.36,.36],depth:4.20}};
}

export function createSu35Model(asset,{combat=false}={}){
  if(!asset?.meshes)throw new Error('Su-35 model assets are required');
  const k=createAirframeKit(SU35),materials=surfaceMaterials(asset.textures),motions=new Map(),skinSurfaces=[];
  const integrity=Array.from({length:30},()=>({value:1}));
  const skins=integrity.map(value=>applySu35Livery(materials.skin.clone(),value));
  k.materials.metal=materials.metal;k.materials.nozzle=materials.nozzle;k.materials.titanium=materials.metal;
  const pivots={canopy:[0,1.19,-4.0],'main-left':[-2.02,.33,2.90],'main-right':[2.02,.33,2.90],'nose-gear':[0,.60,-2.90],
    'tail-left':[-2.65,.02,6.55],'tail-right':[2.65,.02,6.55],
    'flaperon-left':[-3.85,.53,4.10],'flaperon-right':[3.85,.53,4.10],
    'rudder-left':[-2.16,1.55,6.62],'rudder-right':[2.16,1.55,6.62],
    'lef-left':[-3.8,.57,1.37],'lef-right':[3.8,.57,1.37]};
  const groupFor=(key,part)=>{
    if(!pivots[key])return k.parts[part];
    const id=key+':'+part;
    if(!motions.has(id)){const g=new T.Group();g.position.set(...pivots[key]);g.userData.pivot=pivots[key];g.userData.keepGroup=true;
      g.name=key==='canopy'?'Su-35 hinged single-seat canopy':'Su-35 '+key;k.parts[part].add(g);motions.set(id,g);}
    return motions.get(id);
  };
  for(const mesh of su35StructuralMeshes(asset)){
    if(mesh.material==='seat')continue;
    const g=new T.BufferGeometry();for(const [name,a]of Object.entries(mesh.attributes))g.setAttribute(name,a.clone());
    g.setAttribute('liveryPosition',mesh.attributes.position.clone());
    g.setAttribute('uv1',mesh.attributes.uv.clone());
    const parent=groupFor(mesh.motion,mesh.part),m=k.mesh(g,mesh.material==='skin'?skins[mesh.part]:(materials[mesh.material]||skins[mesh.part]),mesh.part,parent);
    m.name='Su-35 adapted '+mesh.name;if(mesh.sourceName==='HULL_Hull_Upper.001')skinSurfaces.push(m);
  }
  paintSu35Markings(k,skinSurfaces);modernSu35Cockpit(k);
  const inlets=[duct(k,-1),duct(k,1)],exhaustFrames=[];
  for(const side of [-1,1]){
    const frame=flankerNozzle(k,side),root=frame.parent;
    root.position.set(side*1.271,.083,7.55);root.scale.set(.825,.77,1.36);exhaustFrames.push(frame);
    k.loft([[7.48,.55,.515,.083,side*1.271],[7.62,.562,.525,.083,side*1.271],[7.83,.55,.51,.083,side*1.271]],side<0?7:8,materials.metal,{segments:64,samples:4});
    // Shaped wingtip EW fairings replace the source's thin launch rails.
    const x=side*7.50;
    k.loft([[3.22,.008,.009,.62,x],[3.48,.095,.105,.62,x],[3.95,.15,.15,.62,x],
      [5.62,.15,.15,.62,x],[6.0,.075,.085,.62,x],[6.15,.006,.008,.62,x]],side<0?12:13,
      new T.MeshStandardMaterial({color:0xb0ccd8,roughness:.70,metalness:.08}),{segments:48,samples:5});
    k.navLight([side*7.62,.66,3.88],side<0?0xd84d3c:0x65a88d,side<0?12:13);
  }
  // Colour is confined to the wheel faces, leaving the struts metallic.
  const green=new T.MeshStandardMaterial({color:0x456b4d,roughness:.69,metalness:.22});
  for(const side of [-1,1]){
    const main=motions.get(side<0?'main-left:25':'main-right:26');
    k.tube(.245,.245,.018,[side*2.325,-1.605,2.92],side<0?25:26,green,{axis:'x',parent:main});
    k.tube(.115,.115,.012,[side*.251,-1.588,-2.87],24,green,{axis:'x',parent:motions.get('nose-gear:24')});
  }
  k.animations.push(s=>{
    integrity.forEach((value,i)=>value.value=s.health?.[i]??1);
    const gear=T.MathUtils.clamp(s.gear??1,0,1);
    for(const [id,g]of motions){
      const key=id.split(':')[0];
      if(key==='canopy'){g.rotation.x=s.canopy||0;continue;}
      if(key==='nose-gear'){g.rotation.x=(1-gear)*1.55;g.visible=gear>.015;}
      if(key.startsWith('main-')){g.rotation.z=(key==='main-left'?-1:1)*(1-gear)*1.45;g.visible=gear>.015;}
      const side=key.endsWith('left')?-1:1;
      if(key.startsWith('tail-')&&s.enabled?.[side<0?3:4]!==0)g.rotation.x=-(s[side<0?'leftTail':'rightTail']??(.30*(s.pitchInput||0)-side*.07*(s.rollInput||0)));
      if(key.startsWith('flaperon-'))g.rotation.x=s[side<0?'leftAileron':'rightAileron']!==undefined?-(s[side<0?'leftAileron':'rightAileron']*.65+s[side<0?'leftFlap':'rightFlap']*.65):-side*.28*(s.rollInput||0)+.19*gear;
      if(key.startsWith('rudder-')&&s.enabled?.[side<0?20:21]!==0)g.rotation.y=(s[side<0?'leftRudder':'rightRudder']??(.32*(s.yawInput||0)))+side*.35*(s.airbrake||0);
      if(key.startsWith('lef-'))g.quaternion.setFromAxisAngle(V(1,0,side*.82).normalize(),-(s[side<0?'leftLEF':'rightLEF']??Math.max(0,(s.alpha||0)*.45)));
    }
  });
  for(const group of motions.values())k.batch(group);
  const model=k.finish({exhaustFrames,gunMount:[1.05,.73,-4.0],gunPart:0,wingTips:[[-7.65,.62,4.0],[7.65,.62,4.0]]});
  model.group.userData.modelRevision='su35-surface-study-4';model.group.userData.intakes=inlets;
  model.group.userData.previewOnly=true;model.group.userData.source=asset.metadata?.source;
  model.group.userData.combatVariant=combat;
  const update=model.update;model.update=(s={},dt=1/60)=>update({gear:1,...s},dt);model.update();
  const bounds=new T.Box3();model.group.traverse(o=>{let live=true;for(let p=o;p;p=p.parent)if(!p.visible)live=false;if(!live||!o.isMesh||o.userData.visualEffect)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});
  const size=bounds.getSize(V());model.group.scale.set(15.3/size.x,5.9/size.y,21.9/size.z);
  model.group.position.set(-(bounds.min.x+bounds.max.x)*.5*model.group.scale.x,-2.1-bounds.min.y*model.group.scale.y,-10.6-bounds.min.z*model.group.scale.z);
  model.group.updateMatrixWorld(true);for(const inlet of inlets)inlet.centerWorld=model.group.localToWorld(V(...inlet.center)).toArray();
  return model;
}
