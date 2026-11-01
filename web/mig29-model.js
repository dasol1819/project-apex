// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';
import {createAirframeKit} from './classic-airframe-kit.js';
const V=(...p)=>new T.Vector3(...p),D=Math.PI/180;
export const MIG29={id:14,key:'mig29',name:'MiG-29 9.12',nickname:'Fulcrum-A',length:17.32,span:11.36,engines:2,previewOnly:true,palette:[0x9aa79a,0x536453,0x828f7e,0xa2b1b1]};
function partition(asset){
 const out=[];for(const m of asset.meshes){if(!['fuselage','Vstabs','WingL','WingR'].includes(m.name)){out.push(m);continue;}const buckets=new Map(),p=m.attributes.position;
 for(let i=0;i<p.count;i+=3){let x=0,y=0,z=0;for(let j=0;j<3;j++){x+=p.getX(i+j)/3;y+=p.getY(i+j)/3;z+=p.getZ(i+j)/3;}const side=x>0?1:0,a=Math.abs(x);let part=m.part;
 if(m.name==='Vstabs')part=5+side;else if(m.name.startsWith('Wing'))part=(a>3.75?12:1)+side;else part=z<-5.4?10:z>4?29:y<.15&&a>.33&&a<1.65&&z>-2.65?(z<.7?27:7)+side:0;
 if(!buckets.has(part))buckets.set(part,[]);buckets.get(part).push(i,i+1,i+2);}
 for(const[part,indices]of buckets){const attributes={};for(const[name,a]of Object.entries(m.attributes)){const values=new Float32Array(indices.length*a.itemSize);indices.forEach((v,i)=>{for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.array[v*a.itemSize+k];});attributes[name]=new T.BufferAttribute(values,a.itemSize);}out.push({...m,part,attributes});}}
 return out;
}
function paint(m,health){m.userData.airframeSurface=true;m.onBeforeCompile=s=>{s.uniforms.migIntegrity=health;s.vertexShader='attribute vec3 liveryPosition; varying vec3 migP;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmigP=liveryPosition;');s.fragmentShader='varying vec3 migP;uniform float migIntegrity;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 p=migP;float field=min(length((p.xz-vec2(-1.4,-1.3))/vec2(1.5,2.8)),length((p.xz-vec2(2.7,1.6))/vec2(2.3,1.5)));field=min(field,length((p.xz-vec2(-3.5,2.2))/vec2(2.0,1.5)));field=min(field,length((p.xz-vec2(.3,5.2))/vec2(1.3,1.6)));
 vec3 coat=mix(vec3(.32,.37,.32),vec3(.13,.19,.14),1.-smoothstep(.94,1.03,field));coat=mix(vec3(.34,.41,.43),coat,smoothstep(-.25,.2,p.y));if(p.z<-6.5)coat=vec3(.13,.19,.16);diffuseColor.rgb=mix(coat*.46,coat,clamp(migIntegrity,0.,1.));`);};m.customProgramCacheKey=()=> 'mig29-grey-green-v1';return m;}
export function createMig29Model(asset,{combat=false}={}){
 const k=createAirframeKit(MIG29),textures=asset.textures||{},motions=new Map(),integrity=Array.from({length:30},()=>({value:1}));
 const skin=new T.MeshStandardMaterial({color:0xffffff,roughness:.75,metalness:.07,aoMap:textures.ao??null,aoMapIntensity:.35,side:T.DoubleSide});
 const skins=integrity.map(h=>paint(skin.clone(),h)),materials={metal:new T.MeshStandardMaterial({color:0x73817c,roughness:.5,metalness:.65,side:T.DoubleSide}),dark:new T.MeshStandardMaterial({color:0x12201c,roughness:.85,side:T.DoubleSide}),rubber:new T.MeshStandardMaterial({color:0x111715,roughness:.95}),glass:new T.MeshPhysicalMaterial({color:0x91b0b5,roughness:.07,metalness:.06,transparent:true,opacity:.38,depthWrite:false,clearcoat:1,side:T.DoubleSide})};
 const pivots={canopy:[0,1.04,-2.91],'tail-left':[-2.5,.08,4.92],'tail-right':[2.5,.08,4.92],'flap-left':[-2.55,.20,2.36],'flap-right':[2.55,.20,2.36],'aileron-left':[-4.2,.14,3.05],'aileron-right':[4.2,.14,3.05],'slat-left':[-3.3,.18,.35],'slat-right':[3.3,.18,.35],'rudder-left':[-1.8,.8,5.30],'rudder-right':[1.8,.8,5.30],'nose-gear':[0,-.12,-2.72],'main-left':[-1.3,.08,1.08],'main-right':[1.3,.08,1.08],'airbrake-upper':[0,0,4.45],'airbrake-lower':[0,0,4.45],'screen-left':[-.654,-.1153,-2.548],'screen-right':[.654,-.1153,-2.548]};
 const parent=(motion,part)=>{if(!pivots[motion])return k.parts[part];if(!motions.has(motion)){const g=new T.Group();g.name='MiG-29 '+motion;g.position.set(...pivots[motion]);g.userData.pivot=pivots[motion];g.userData.keepGroup=true;k.parts[part].add(g);motions.set(motion,g);}return motions.get(motion);};
 for(const mesh of partition(asset)){const g=new T.BufferGeometry();for(const[n,a]of Object.entries(mesh.attributes))g.setAttribute(n,a.clone());g.setAttribute('liveryPosition',mesh.attributes.position.clone());g.setAttribute('uv1',mesh.attributes.uv.clone());const m=k.mesh(g,mesh.material==='skin'?skins[mesh.part]:(materials[mesh.material]||materials.metal),mesh.part,parent(mesh.motion,mesh.part));m.name='MiG-29 '+mesh.name;}
 // Recessed intake passages retain real depth and terminate at compressor disks.
 const inlets=[];for(const side of[-1,1]){const x=side*.73,y=-.33,z=-2.1,part=side<0?27:28;const rows=16,N=48,p=[],ix=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<N;i++){const t=j/rows,a=i/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a),pow=.5+t*.5;p.push(x+Math.sign(c)*Math.abs(c)**pow*.30,y+Math.sign(s)*Math.abs(s)**pow*.31,z+t*2.8);}
 for(let j=0;j<rows;j++)for(let i=0;i<N;i++){const a=j*N+i,b=j*N+(i+1)%N;ix.push(a,a+N,b,b,a+N,b+N);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();k.mesh(g,materials.dark,part).name='MiG-29 recessed inlet duct';
 k.tube(.30,.30,.03,[x,y,z+2.8],part,materials.dark);for(let i=0;i<24;i++){const a=i/N*Math.PI*4;k.solid([[x,y,z+2.73],[x+.28*Math.cos(a),y+.28*Math.sin(a),z+2.75],[x+.28*Math.cos(a+.14),y+.28*Math.sin(a+.14),z+2.72]],part,materials.metal,.003);}inlets.push({center:[x,y,z],part});
 k.nozzle({x:side*.949,y:-.188,z:4.23,radius:.42,length:.85,enginePart:side<0?7:8,nozzlePart:side<0?22:23,darkInterior:true});}
 cockpit(k,materials);markings(k);
 k.animations.push(s=>{const gear=T.MathUtils.clamp(s.gear??1,0,1),fod=s.fod??(gear>.95&&(s.tas??0)<55?1:0);integrity.forEach((h,i)=>h.value=s.health?.[i]??1);
 for(const[key,g]of motions){const side=key.endsWith('right')?1:-1,word=side<0?'left':'right';if(key==='canopy')g.rotation.x=s.canopy||0;
 else if(key.startsWith('tail-'))g.rotation.x=-(s[word+'Tail']??.3*(s.pitchInput||0));else if(key.startsWith('flap-'))g.rotation.x=s[word+'Flap']??gear*25*D;else if(key.startsWith('aileron-'))g.rotation.x=-(s[word+'Aileron']??side*.25*(s.rollInput||0));else if(key.startsWith('slat-'))g.rotation.x=-(s[word+'LEF']??Math.max(0,(s.alpha||0)*.45));else if(key.startsWith('rudder-'))g.rotation.y=s[word+'Rudder']??.35*(s.yawInput||0);else if(key.startsWith('main-')){g.rotation.z=side*(1-gear)*1.5;g.visible=gear>.01;}else if(key==='nose-gear'){g.rotation.x=(1-gear)*1.5;g.visible=gear>.01;}else if(key.startsWith('airbrake-'))g.rotation.x=(key.endsWith('upper')?-.977:1.047)*(s.airbrake||0);else if(key.startsWith('screen-'))g.quaternion.setFromAxisAngle(V(1,side*.2,0).normalize(),-(1-fod)*.823);}
 for(const p of k.parts)p.traverse(o=>{if(o.name?.startsWith('MiG-29 Louvers'))o.rotation.x=-fod*.70;});
 });
 for(const g of motions.values())k.batch(g);const model=k.finish({gunMount:[-.65,.6,-4.3],gunPart:0,wingTips:[[-5.68,.15,2.8],[5.68,.15,2.8]]});model.group.userData.intakes=inlets;model.group.userData.gearContacts=[[0,-1.86,-2.45],[-1.6,-1.86,1.1],[1.6,-1.86,1.1]];const update=model.update;model.update=(s={},dt=1/60)=>update({gear:1,...s,afterburner:combat?s.afterburner:0},dt);model.update();return model;
}
function cockpit(k,m){
 const panel=new T.MeshStandardMaterial({color:0x163c38,roughness:.8}),black=m.dark,seat=new T.MeshStandardMaterial({color:0x394139,roughness:.95});k.box([.63,.55,.12],[0,.65,-4.63],11,panel);k.box([.48,.78,.18],[0,.76,-3.44],11,seat);k.box([.37,.25,.24],[0,1.21,-3.44],11,black);k.box([.48,.12,.48],[0,.41,-3.72],11,seat);
 const needles=[];for(let i=0;i<6;i++){const x=(i%3-1)*.19,y=.79-Math.floor(i/3)*.20;const face=new T.Mesh(new T.CircleGeometry(.078,32),black);face.position.set(x,y,-4.55);k.parts[11].add(face);const bezel=new T.Mesh(new T.TorusGeometry(.081,.007,8,32),m.metal);bezel.position.copy(face.position);k.parts[11].add(bezel);const needle=new T.Mesh(new T.BoxGeometry(.005,.058,.002),new T.MeshBasicMaterial({color:0xe2dec3}));needle.geometry.translate(0,.025,0);needle.position.set(x,y,-4.543);k.parts[11].add(needle);needles.push(needle);}
 const hud=new T.Mesh(new T.PlaneGeometry(.22,.19),new T.MeshPhysicalMaterial({color:0x6ca49a,transparent:true,opacity:.27,side:T.DoubleSide,depthWrite:false}));hud.position.set(0,.98,-4.91);hud.rotation.x=-.2;hud.name='MiG-29 HUD combiner';k.parts[11].add(hud);
 for(const side of[-1,1])k.box([.13,.11,.86],[side*.32,.54,-3.95],11,panel);
 k.animations.push(s=>{const values=[(s.tas??0)/340,(s.altitude??0)/10000,(s.verticalSpeed??0)/50,(s.fuel??1),(s.loadFactor??1)/9,(s.rpm??.7)];needles.forEach((n,i)=>n.rotation.z=.75-values[i]*4.6);});
}
function markings(k){const red=new T.MeshStandardMaterial({color:0x9b2320,roughness:.8,side:T.DoubleSide});for(const side of[-1,1]){const pts=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.12:.30;pts.push([side*4.6+Math.cos(a)*r,.22,2.0+Math.sin(a)*r]);}k.solid(pts,side<0?12:13,red,.002);}}
