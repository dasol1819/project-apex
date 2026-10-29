import * as T from './vendor/three.module.js';
import {PART_NAMES,PARTS} from './airframe-parts.js';
import {partInstalled,partParentFor,storeMount,irStoreAvailable} from './aircraft-catalog.js';
import {createAirframeDamageOverlay} from './airframe-damage-overlay.js';
import {bakeAirframeSurfaceCoordinates} from './airframe-surface.js';
import {createSidewinderModel} from './sidewinder-model.js';
import {createAmraamModel} from './amraam-model.js';
import {setBombModel,createTargetingPod} from './bomb-model.js';
import {PRESETS,bombAvailable,bombMount} from './loadout-catalog.js';
import {enableWorldDepthIn} from './world-depth.js';
import {exhaustActuators} from './exhaust-hardware.js';
import {SU57_PALETTE,su57FinishGLSL,su57PaintField,su57MetalFinish} from './su57-finish.js';

const V=(...p)=>new T.Vector3(...p),clamp=T.MathUtils.clamp;
const palettes={
 1:[0x596148,0x373f2c,0x938366,0xadb2a6],
 2:[0x8c9da5,0x546c7e,0x637a89,0xa4afb4],
 3:[0x89969e,0x586771,0x76858e,0xa4aeb4],
 4:[0x87969f,0x6f818d,0x9ba8ae,0xabb4b8],
 5:[0x8a939a,0x626d78,0x7d8991,0xa5adb1],
 6:[0x505b64,0x444f59,0x626b73,0x7c858a],
 7:[0x343a40,0x2c3239,0x42484e,0x596068],
 8:[0x626b70,0x545f66,0x7b858a,0x7f898d],
 11:[0x89939a,0x1b242c,0x9ba4a9,0xa4adb1],
 12:[0x89939a,0x1b242c,0x9ba4a9,0xa4adb1],
 10:SU57_PALETTE
};
const rgb=hex=>'vec3('+new T.Color(hex).toArray().map(v=>v.toFixed(5)).join(',')+')';
const surfaceGLSL=`
 varying vec3 vSkinP;uniform float skinIntegrity;uniform float classicPart;
 float coatHash(vec3 p){p=fract(p*.3183099+vec3(.1,.3,.7));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float coatNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(coatHash(i),coatHash(i+vec3(1,0,0)),f.x),mix(coatHash(i+vec3(0,1,0)),coatHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(coatHash(i+vec3(0,0,1)),coatHash(i+vec3(1,0,1)),f.x),mix(coatHash(i+vec3(0,1,1)),coatHash(i+vec3(1)),f.x),f.y),f.z);}
 float coatLobe(vec2 p,vec2 c,vec2 r,float a){float cs=cos(a),sn=sin(a);return length((mat2(cs,-sn,sn,cs)*(p-c))/r);}
 float coatBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
 float coatSegment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
 float coatField(vec2 p,vec2 a,vec2 b,vec2 c,vec2 d,float feather){
  vec2 ab=b-a,bc=c-b,cd=d-c,da=a-d;float turn=sign(ab.x*bc.y-ab.y*bc.x);
  float edge=min(min(turn*(ab.x*(p.y-a.y)-ab.y*(p.x-a.x))/length(ab),turn*(bc.x*(p.y-b.y)-bc.y*(p.x-b.x))/length(bc)),min(turn*(cd.x*(p.y-c.y)-cd.y*(p.x-c.x))/length(cd),turn*(da.x*(p.y-d.y)-da.y*(p.x-d.x))/length(da)));
  return smoothstep(-feather,feather,edge);
 }
 vec3 coatBump(vec3 n,vec3 p,float h){vec3 dx=dFdx(p),dy=dFdy(p),rx=cross(dy,n),ry=cross(n,dx);float d=dot(dx,rx);if(abs(d)<1.e-12)return n;return normalize(abs(d)*n-sign(d)*(dFdx(h)*rx+dFdy(h)*ry));}
`;

// Frozen neutral-space paint follows hinges, and is also copied into wreckage.
// Camouflage is an authored set of broad painted fields, never moving noise.
function paintMaterial(d,material,part,integrity){
 const m=material.clone(),palette=d.missionLivery==='dagger-black'?[0x30373e,0x20262d,0x414a52,0x2c333a]:(palettes[d.id]||d.palette),kind=material.userData.coatKind||'skin';
 m.userData.airframeSurface=true;m.userData.coatKind=kind;m.userData.damageIndex=part;
 m.onBeforeCompile=shader=>{
  shader.uniforms.skinIntegrity=integrity;shader.uniforms.classicPart={value:part};
  shader.vertexShader='attribute vec3 skinPosition;varying vec3 vSkinP;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSkinP=skinPosition;');
  shader.fragmentShader=surfaceGLSL+(d.id===10?su57FinishGLSL:'')+shader.fragmentShader;
  let field=d.id===1?`
   vec2 paintP=p.xz+vec2(.28*sin(p.z*.82+p.x*.61),.34*sin(p.x*.73-p.z*.37));
   float darkField=min(coatLobe(paintP,vec2(-1.45,-1.35),vec2(1.7,3.2),-.44),coatLobe(paintP,vec2(2.15,2.0),vec2(2.05,3.1),.54));
   darkField=min(darkField,coatLobe(paintP,vec2(-.35,5.3),vec2(.95,2.1),.35));
   float tanField=min(coatLobe(paintP,vec2(-4.1,2.6),vec2(2.8,2.15),-.64),coatLobe(paintP,vec2(.75,-3.7),vec2(.72,2.6),.32));
   tanField=min(tanField,coatLobe(paintP,vec2(-1.45,2.25),vec2(1.10,1.38),-.15));
   tanField=min(tanField,coatLobe(paintP,vec2(4.25,3.8),vec2(2.45,1.75),.3));
   vec3 coat=mix(${rgb(palette[0])},${rgb(palette[1])},1.-smoothstep(.96,1.04,darkField));
   coat=mix(coat,${rgb(palette[2])},1.-smoothstep(.96,1.04,tanField));
   if(classicPart==5.||classicPart==20.)coat=mix(${rgb(palette[0])},${rgb(palette[1])},1.-smoothstep(.90,1.04,coatLobe(p.zy,vec2(5.9,1.7),vec2(1.0,1.0),-.45)));
  `:d.id===2?`
   vec2 paintP=p.xz+vec2(.21*sin(p.z*.84+p.x*.75),.28*sin(p.x*.85-p.z*.38));
   float darkField=min(coatLobe(paintP,vec2(-1.1,-.9),vec2(1.4,2.4),-.50),coatLobe(paintP,vec2(3.3,2.3),vec2(2.1,1.7),.38));
   darkField=min(darkField,coatLobe(paintP,vec2(.2,4.6),vec2(.9,1.8),-.45));
   float blueField=min(coatLobe(paintP,vec2(1.1,-2.4),vec2(1.15,2.1),.46),coatLobe(paintP,vec2(-3.4,1.8),vec2(1.9,1.6),-.36));
   vec3 coat=mix(${rgb(palette[0])},${rgb(palette[1])},1.-smoothstep(.96,1.05,darkField));
   coat=mix(coat,${rgb(palette[2])},1.-smoothstep(.96,1.05,blueField));
   if(classicPart==5.||classicPart==20.)coat=mix(${rgb(palette[0])},${rgb(palette[1])},smoothstep(1.15,1.4,p.y));
  `:d.id===4?`
   float top=smoothstep(-.20,.65,p.y);vec3 coat=mix(${rgb(palette[2])},${rgb(palette[0])},top);
   float spine=smoothstep(.4,.8,p.y)*(1.-smoothstep(.55,1.45,abs(p.x)));
   coat=mix(coat,${rgb(palette[1])},spine*.56);
   coat=mix(coat,${rgb(palette[2])},smoothstep(1.1,2.5,abs(p.x))*.22);
  `:d.id===5?`
   vec2 q=vec2(abs(p.x),p.z);float dark=coatField(q,vec2(.0,-4.8),vec2(.82,-3.1),vec2(1.10,3.8),vec2(.0,5.4),.13);
   dark=max(dark,coatField(q,vec2(1.65,-1.25),vec2(4.55,.4),vec2(5.77,2.75),vec2(2.30,1.63),.14));
   dark=max(dark,coatField(q,vec2(1.70,2.47),vec2(3.4,2.75),vec2(2.95,4.16),vec2(1.35,4.76),.12));
   vec3 coat=mix(${rgb(palette[0])},${rgb(palette[1])},dark*.86);
   if(classicPart==5.||classicPart==6.||classicPart==20.||classicPart==21.)coat=mix(${rgb(palette[0])},${rgb(palette[1])},smoothstep(1.8,2.6,p.y)*.62);
  `:d.id===6?`
   vec3 coat=mix(${rgb(palette[0])},${rgb(palette[1])},smoothstep(.4,1.0,p.y)*.22);
   coat=mix(coat,${rgb(palette[2])},(1.-smoothstep(.25,.9,abs(p.y+.25)))*.06);
  `:d.superHornet?`
   vec3 coat=mix(${rgb(palette[2])},${rgb(palette[0])},smoothstep(-.20,.6,p.y));
   float spine=(1.-smoothstep(.40,.62,abs(p.x)))*smoothstep(.56,.72,p.y)*smoothstep(-6.8,-5.9,p.z);
   coat=mix(coat,${rgb(palette[1])},spine*.94);
   if(classicPart==5.||classicPart==6.||classicPart==20.||classicPart==21.){
    coat=${rgb(palette[1])};float stripe=abs(p.z-(4.70+.57*p.y));
    float cyan=1.-smoothstep(.10,.13,stripe);float edge=1.-smoothstep(.17,.19,stripe);
    coat=mix(coat,vec3(.24,.38,.44),edge);coat=mix(coat,vec3(.13,.28,.36),cyan);
   }
  `:d.id===10?(d.missionLivery==='dagger-black'?`vec3 coat=mix(${rgb(palette[0])},${rgb(palette[2])},smoothstep(-.3,.8,p.y)*.30);coat=mix(coat,${rgb(palette[1])},smoothstep(.8,2.8,abs(p.x))*.22);`:su57PaintField):d.id===7?`
   vec3 coat=${rgb(palette[0])};
   float ram=1.-smoothstep(.018,.060,abs(fract(abs(p.x)*.135+p.z*.018)-.5));
   coat=mix(coat,${rgb(palette[1])},ram*.12);
  `:`
   float upper=smoothstep(-.15,.30,p.y)*smoothstep(-3.9,-2.8,p.z);
   float shoulder=1.-smoothstep(.9,1.25,abs(p.x));
   vec3 coat=mix(${rgb(palette[0])},${rgb(palette[1])},upper*shoulder);
   if(classicPart==1.||classicPart==2.||classicPart>=12.&&classicPart<=19.)coat=${rgb(palette[0])};
   if(classicPart==5.||classicPart==20.)coat=mix(${rgb(palette[0])},${rgb(palette[1])},smoothstep(.9,1.25,p.y));
  `;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec3 p=vSkinP;float foot=max(length(dFdx(p)),length(dFdy(p)));float fine=1.-smoothstep(.008,.05,foot);
   float grain=mix(.5,coatNoise(p*75.),fine),variation=coatNoise(p*vec3(2.,.7,3.4))-.5;
   ${field}
   // Drooped F-4 tails and low-set wings still carry camouflage on top.
   // Frozen surface derivatives distinguish their upper/lower faces even
   // after hinge motion or breakup, independently of their height in the body.
   vec3 coatCross=cross(dFdx(p),dFdy(p));vec3 coatNormal=coatCross/max(length(coatCross),1.e-9)*(gl_FrontFacing?1.:-1.);
   bool liftingSkin=classicPart==1.||classicPart==2.||classicPart==3.||classicPart==4.||classicPart>=12.&&classicPart<=19.;
   float underside=liftingSkin?1.-smoothstep(-.55,-.20,coatNormal.y):1.-smoothstep(-.25,.0,p.y);coat=mix(coat,${rgb(palette[3])},underside*.93);
   float panel=10.;
   if(classicPart==0.||classicPart==29.){
    panel=min(abs(coatBox(p.xz-vec2(0.,.15),vec2(.39,1.0))),abs(coatBox(p.xz-vec2(0.,2.45),vec2(.39,.58))));
    panel=min(panel,abs(coatBox(p.xz-vec2(0.,-1.35),vec2(.30,.32))));
    panel=min(panel,abs(p.z-3.6)*smoothstep(.68,.87,abs(p.x))+10.*(1.-smoothstep(.68,.87,abs(p.x))));
   }else if(classicPart==1.||classicPart==2.||classicPart>=12.&&classicPart<=19.){
    vec2 q=vec2(abs(p.x),p.z);panel=min(coatSegment(q,vec2(1.25,.3),vec2(${(d.span*.43).toFixed(3)},2.4)),coatSegment(q,vec2(1.7,.4),vec2(1.7,2.4)));
    panel=min(panel,abs(coatBox(q-vec2(2.1,1.4),vec2(.21,.27))));
   }
   ${d.id===10?'panel=felonPanels(p);':''}
   float seam=(1.-smoothstep(max(.002,foot*.3),max(.006,foot*.9),panel))*.12;
   float rivets=(1.-smoothstep(.015,.027,abs(fract(p.z*7.)-.5)))*(1.-smoothstep(.007,.015,abs(abs(p.x)-.53)))*fine*.13;
   float chips=(1.-skinIntegrity)*smoothstep(.48,.77,coatNoise(p*3.1));
   ${kind==='skin'?`diffuseColor.rgb*=coat*(1.-seam-rivets)+variation*.002+(grain-.5)*.002;`:kind==='metal'&&d.id===10?su57MetalFinish:kind==='metal'?`float heat=smoothstep(${(d.id===1?4.1:d.id===2?4.4:4.1).toFixed(2)},${(d.id===1?7.5:d.id===2?6.2:6.4).toFixed(2)},p.z);vec3 tint=mix(vec3(.95,.99,1.04),vec3(.71,.65,.56),heat*(.45+.3*coatNoise(p*vec3(14.,14.,.8))));diffuseColor.rgb*=tint*(.95+grain*.06);`:'diffuseColor.rgb*=.97+grain*.035;'}
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.033,.035,.034),chips*.78);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(grain-.5)*.035+variation*.03+chips*.24,.26,.97);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>\nnormal=coatBump(normal,-vViewPosition,(grain-.5)*.00008*fine+seam*.00012+chips*.006);`);
 };
 m.customProgramCacheKey=()=>`classic-detailed-${d.id}-${d.missionLivery||'standard'}-${kind}-v4`;return m;
}

export function createAirframeKit(d){
 const group=new T.Group();group.name=d.name+' '+d.nickname;group.userData.aircraftType=d.id;group.userData.livery=d.missionLivery||'standard';group.userData.modelRevision=d.id>=4?4:2;
 const parts=PART_NAMES.map((name,i)=>{const p=new T.Group();p.name=name;p.userData.damageIndex=i;group.add(p);return p;});
 const standard=(color,roughness=.68,metalness=.18)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const materials={skin:standard(0xffffff,.73,.19),skinLight:standard(0xa5b0b7,.72,.18),skinDark:standard(0x687783,.72,.18),radome:standard(d.id===1?0x333b32:d.id===2?0x66757c:0x77848a,.78,.08),metal:standard(0x8a8d88,.48,.72),nozzle:standard(0x69716e,.57,.73),titanium:standard(0x777a72,.57,.66),dark:standard(0x111a1f,.92,.12),glass:new T.MeshPhysicalMaterial({color:d.id===3?0xc4b486:0x8ea9b4,roughness:.08,metalness:.12,transparent:true,opacity:.42,depthWrite:false,clearcoat:1,clearcoatRoughness:.06,side:T.DoubleSide}),rubber:standard(0x171d20,.96,.04),seat:standard(0x363e35,.91,.05),frame:standard(0x54616a,.66,.32),seam:standard(0x3b474b,.82,.13),white:standard(0xb9c2c6,.76,.1),yellow:standard(0xbb9e3f,.76,.1),red:standard(0x7c3026,.75,.1)};
 materials.skin.userData.coatKind='skin';for(const name of ['metal','nozzle','titanium'])materials[name].userData.coatKind='metal';
 if(d.id>=4){materials.glass.color.set(d.id===4?0x526b76:0x7e8474);materials.glass.opacity=d.id===4?.62:.57;materials.glass.roughness=.10;}
 if(d.id>=6){materials.skin.roughness=d.id===7?.88:.75;materials.skin.metalness=d.id===7?.04:.16;materials.skinLight.color.set(d.id===7?0x4a5055:0x5e6971);materials.skinDark.color.set(d.id===7?0x252b32:0x414c55);materials.radome.color.set(d.id===7?0x30363d:0x434d56);materials.frame.color.set(d.id===7?0x2e363e:0x46525b);materials.white.color.set(d.id===7?0x747b7e:0xa3adb2);}
 const integrity=parts.map(()=>({value:1})),coated=new Map(),controls=[],nozzles=[],gears=[],animations=[];
 function matFor(m,part){if(!m?.userData.coatKind)return m;const key=m.uuid+':'+part;if(!coated.has(key))coated.set(key,paintMaterial(d,m,part,integrity[part]));return coated.get(key);}
 function mesh(g,m=materials.skin,part=0,parent=parts[part],name=''){
  if(parent?.userData.pivot)g.translate(...parent.userData.pivot.map(x=>-x));
  const out=new T.Mesh(g,matFor(m,part));out.castShadow=out.receiveShadow=true;out.name=name;parent.add(out);return out;
 }
 function box(size,pos,part=0,mat=materials.skin,parent){const g=new T.BoxGeometry(...size);g.translate(...pos);return mesh(g,mat,part,parent);}
 function tube(r0,r1,length,pos,part=0,mat=materials.metal,opts={}){const g=new T.CylinderGeometry(r0,r1,length,opts.sides||32,1,!!opts.open);if((opts.axis||'z')==='z')g.rotateX(Math.PI/2);if(opts.axis==='x')g.rotateZ(Math.PI/2);g.translate(...pos);const out=mesh(g,mat,part,opts.parent);if(opts.open)out.material.side=T.DoubleSide;return out;}
 function ellipsoid(radii,pos,part=0,mat=materials.skin,parent,segments=48){const g=new T.SphereGeometry(1,segments,Math.max(16,segments/2));g.scale(...radii);g.translate(...pos);return mesh(g,mat,part,parent);}
 function line(points,part=0,mat=materials.seam,radius=.006,parent){if(points.length<2)return;const curve=points.length===2?new T.LineCurve3(V(...points[0]),V(...points[1])):new T.CatmullRomCurve3(points.map(p=>V(...p)),false,'centripetal');return mesh(new T.TubeGeometry(curve,points.length===2?1:Math.min(96,Math.max(8,Math.ceil(points.length*1.5))),radius,5,false),mat,part,parent);}
 function loft(stations,part=0,mat=materials.skin,opts={}){
  const N=opts.segments||64,steps=opts.samples||4,rings=[];
  // Shape-preserving cubic Hermite interpolation: smooth cross sections with
  // monotone radii and no repeated bulges at the original authoring stations.
  const value=(i,k)=>stations[i][k]??(k===5?2:0),slope=(i,k)=>{const n=stations.length;if(i===0)return(value(1,k)-value(0,k))/(value(1,0)-value(0,0));if(i===n-1)return(value(n-1,k)-value(n-2,k))/(value(n-1,0)-value(n-2,0));const a=(value(i,k)-value(i-1,k))/(value(i,0)-value(i-1,0)),b=(value(i+1,k)-value(i,k))/(value(i+1,0)-value(i,0));return a*b<=0?0:2*a*b/(a+b);};
  for(let i=0;i<stations.length-1;i++)for(let j=0;j<steps;j++){const u=j/steps,u2=u*u,u3=u2*u,dz=value(i+1,0)-value(i,0);rings.push(Array.from({length:6},(_,k)=>k===0?value(i,0)+u*dz:(2*u3-3*u2+1)*value(i,k)+(u3-2*u2+u)*dz*slope(i,k)+(-2*u3+3*u2)*value(i+1,k)+(u3-u2)*dz*slope(i+1,k)));}rings.push(stations.at(-1));
  const p=[],uv=[],ix=[];
  for(let i=0;i<rings.length;i++){const [z,rx,ry,cy=0,cx=0,power=2]=rings[i];for(let j=0;j<=N;j++){const a=j/N*Math.PI*2,c=Math.cos(a),s=Math.sin(a),pow=2/Math.max(1.1,power);p.push(cx+Math.sign(c)*Math.pow(Math.abs(c),pow)*Math.max(.001,rx),cy+Math.sign(s)*Math.pow(Math.abs(s),pow)*Math.max(.001,ry),z);uv.push(j/N,i/(rings.length-1));}}
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;ix.push(a,a+1,b,a+1,b+1,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return mesh(g,mat,part,opts.parent);
 }
 function solid(points,part=0,mat=materials.skin,thickness=.06,parent){
  const normal=V(...points[1]).sub(V(...points[0])).cross(V(...points[2]).sub(V(...points[0]))).normalize(),axis=Math.abs(normal.y)>.65?1:Math.abs(normal.x)>.65?0:2,axes=[0,1,2].filter(x=>x!==axis),n=points.length,positions=[],ix=[];
  for(const side of [-1,1])for(const p of points)positions.push(...p.map((v,k)=>v+normal.getComponent(k)*thickness*.5*side));
  const tris=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(p[axes[0]],p[axes[1]])),[]);
  for(const t of tris){const a=V(...points[t[0]]),b=V(...points[t[1]]),c=V(...points[t[2]]);if(b.sub(a).cross(c.sub(a)).dot(normal)<0)t.reverse();ix.push(t[2],t[1],t[0],n+t[0],n+t[1],n+t[2]);}
  for(let i=0;i<n;i++){const j=(i+1)%n;ix.push(i,j,n+j,i,n+j,n+i);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(ix);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return mesh(flat,mat,part,parent);
 }
 function airfoil(stations,part=0,mat=materials.skin,opts={}){
  const spanSteps=Math.min(8,opts.samples||8),C=Math.min(18,opts.chordSegments||18),range=opts.chordRange||[0,1],rows=[];
  for(let i=0;i<stations.length-1;i++)for(let j=0;j<spanSteps;j++)rows.push(stations[i].map((v,k)=>T.MathUtils.lerp(v,stations[i+1][k],j/spanSteps)));rows.push(stations.at(-1));
  const p=[],uv=[],ix=[],R=rows.length;
  for(const side of [-1,1])for(let i=0;i<R;i++){const [x,y,le,te,t=.10]=rows[i];for(let j=0;j<=C;j++){const u=T.MathUtils.lerp(range[0],range[1],(1-Math.cos(j/C*Math.PI))*.5),profile=(.2969*Math.sqrt(u)-.1260*u-.3516*u*u+.2843*u*u*u-.1036*u*u*u*u)/.1;p.push(x,y+side*t*profile/2,le+(te-le)*u);uv.push(i/(R-1),u);}}
  const row=C+1,layer=R*row,reverse=rows.at(-1)[0]<rows[0][0];
  function face(a,b,c,flip){if(flip)ix.push(a,c,b);else ix.push(a,b,c);}
  for(let side=0;side<2;side++)for(let i=0;i<R-1;i++)for(let j=0;j<C;j++){const a=side*layer+i*row+j,b=a+row,flip=!!side!==reverse;face(a,b,a+1,flip);face(a+1,b,b+1,flip);}
  for(let j=0;j<C;j++)for(const i of [0,R-1]){const a=i*row+j,b=layer+a,flip=(i!==0)!==reverse;face(a,a+1,b,flip);face(a+1,b+1,b,flip);}
  for(let i=0;i<R-1;i++)for(const j of [0,C]){const a=i*row+j,b=a+row,flip=(j!==0)!==reverse;face(a,a+layer,b,flip);face(b,a+layer,b+layer,flip);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return mesh(g,mat,part,opts.parent);
 }
 function hinge(part,pivot,field,axis=[1,0,0],sign=-1){const h=new T.Group();h.position.set(...pivot);if(parts[part].userData.pivot)h.position.sub(V(...parts[part].userData.pivot));h.userData.pivot=pivot;h.userData.keepGroup=true;h.name=field+' physical hinge';parts[part].add(h);controls.push({h,part,field,axis:V(...axis).normalize(),sign});return h;}
 function canopy(stations,part=11,opts={}){
  const N=40,p=[],uv=[],ix=[],interpolated=[],steps=opts.longitudinalSamples??4;for(let i=0;i<stations.length-1;i++)for(let j=0;j<steps;j++)interpolated.push(stations[i].map((v,k)=>T.MathUtils.lerp(v,stations[i+1][k],j/steps)));interpolated.push(stations.at(-1));
  const rimR=[],rimL=[];for(let i=0;i<interpolated.length;i++){const [z,w,base,height]=interpolated[i];rimR.push([w,base,z]);rimL.push([-w,base,z]);for(let j=0;j<=N;j++){const a=j/N*Math.PI;p.push(w*Math.cos(a),base+height*Math.sin(a),z);uv.push(j/N,i/(interpolated.length-1));}}
  for(let i=0;i<interpolated.length-1;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;ix.push(a,a+1,b,a+1,b+1,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();const result=mesh(g,materials.glass,part);result.name='continuous canopy glazing';
  line(rimR,part,materials.frame,.025);line(rimL,part,materials.frame,.025);
  for(const z of opts.frameStations||[stations[0][0],stations.at(-1)[0]]){const r=interpolated.reduce((best,a)=>Math.abs(a[0]-z)<Math.abs(best[0]-z)?a:best,interpolated[0]),arc=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI;arc.push([r[1]*Math.cos(a),r[2]+r[3]*Math.sin(a),r[0]]);}line(arc,part,materials.frame,.025);}
  return result;
 }
 function nozzle({x=0,y=-.04,z,radius:R,enginePart=7,nozzlePart=22,length=.9,featherless=false,darkInterior=false}){
  loft([[z-length,R*1.10,R*1.10,y,x],[z-.34,R*1.04,R*1.04,y,x],[z-.13,R,R,y,x]],enginePart,materials.titanium,{segments:64,samples:3});
  tube(R*.79,R*.82,length*.76,[x,y,z-.13],enginePart,materials.dark,{open:true});
  tube(R*.78,R*.78,.04,[x,y,z-.50],enginePart,darkInterior?materials.dark:materials.nozzle);
  for(let j=0;j<20;j++){const a=j/20*Math.PI*2,r=R*.52;const g=new T.BoxGeometry(R*.40,R*.038,.06);g.rotateZ(a+.45);g.translate(x+Math.cos(a)*r,y+Math.sin(a)*r,z-.47);mesh(g,darkInterior?materials.dark:materials.metal,enginePart);}
  const pos=[],open=[],normal=[],uv=[],ix=[];
  for(let blade=0;blade<18;blade++){const a0=blade/18*2*Math.PI+.009,a1=(blade+1)/18*2*Math.PI-.009,base=pos.length/3;for(let row=0;row<3;row++)for(let j=0;j<5;j++){const a=T.MathUtils.lerp(a0,a1,j/4),f=row/2,r=R*T.MathUtils.lerp(1.035,.91,f),zz=z-.22+f*.59;pos.push(x+Math.cos(a)*r,y+Math.sin(a)*r,zz);open.push(x+Math.cos(a)*(r+R*.16*f),y+Math.sin(a)*(r+R*.16*f),zz);uv.push(j/4,f);}for(let row=0;row<2;row++)for(let j=0;j<4;j++){const a=base+row*5+j;ix.push(a,a+1,a+5,a+1,a+6,a+5);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.morphAttributes.position=[new T.Float32BufferAttribute(open,3)];const petals=mesh(g,materials.nozzle,nozzlePart);petals.material.side=T.DoubleSide;petals.userData.keepDynamic=true;petals.name='18 articulated convergent-divergent nozzle feathers';
  const hardware=featherless?exhaustActuators({mesh,materials},{x,y,z,radius:R,part:nozzlePart}):null;
  if(featherless)petals.name='F100 inner convergent-divergent nozzle segments';
  const throat=tube(R*.82,R*.84,.035,[x,y,z+.22],nozzlePart,materials.dark,{open:true});throat.material.side=T.DoubleSide;
  const frame=new T.Group();frame.position.set(x,y,z+.37);frame.name='real exhaust exit';frame.userData.keepGroup=true;parts[nozzlePart].add(frame);
  const plumeMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0},power:{value:0}},vertexShader:'varying vec2 tex;void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 tex;uniform float time,power;void main(){float edge=pow(max(0.,1.-abs(tex.x*2.-1.)),2.);float lengthFade=smoothstep(0.,.035,tex.y)*(1.-smoothstep(.30,1.,tex.y));float shock=.55+.45*pow(.5+.5*cos(tex.y*51.-time*2.),4.);float alpha=edge*lengthFade*power*(.4+.6*shock);if(alpha<.004)discard;gl_FragColor=vec4(mix(vec3(.18,.32,1.),vec3(1.,.43,.12),smoothstep(.06,.65,tex.y)),alpha*.65);}' });
  const flameRoot=new T.Group();frame.add(flameRoot);for(let i=0;i<3;i++){const geo=new T.PlaneGeometry(R*1.64,4.8,2,20);geo.rotateX(Math.PI/2);geo.translate(0,0,2.4);const m=new T.Mesh(geo,plumeMaterial);m.rotation.z=i*Math.PI/3;flameRoot.add(m);}
  nozzles.push({part:enginePart,nozzlePart,petals,hardware,frame,flameRoot,plumeMaterial});return frame;
 }
 function gear({x=0,z,part=24,main=false,topY=-.55,radius=main?.31:.23}){
  const h=new T.Group(),bottom=-2.1+radius,side=Math.sign(x)||1;h.position.set(x,topY,z);h.userData.keepGroup=true;parts[part].add(h);h.name=main?'retractable main undercarriage':'retractable nose undercarriage';
  const absolute=(g)=>{g.translate(-x,-topY,-z);const m=new T.Mesh(g,materials.metal);m.castShadow=true;h.add(m);return m;};
  const addLeg=(a,b,r,mat=materials.metal)=>{const delta=V(...b).sub(V(...a)),g=new T.CylinderGeometry(r,r*.91,delta.length(),12);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),delta.clone().normalize()));g.translate(...V(...a).add(V(...b)).multiplyScalar(.5).toArray());const m=absolute(g);m.material=mat;return m;};
  addLeg([x,topY,z],[x+side*(main?.14:0),bottom+.20,z],main?.068:.052);addLeg([x,topY-.35,z],[x+side*(main?.14:0),bottom+.15,z],.036,materials.metal);
  addLeg([x,topY-.10,z+.36],[x,bottom+.36,z],.027);addLeg([x,topY-.22,z-.15],[x,bottom+.52,z+.20],.020);
  for(const s of [-1,1])addLeg([x+s*.09,bottom+.65,z-.12],[x+s*.09,bottom+.39,z+.03],.015);
  const tyre=new T.TorusGeometry(radius*.76,radius*.24,12,40);tyre.rotateY(Math.PI/2);tyre.translate(x+side*(main?.13:0),bottom,z);const wheel=absolute(tyre);wheel.material=materials.rubber;
  const hub=new T.CylinderGeometry(radius*.53,radius*.53,main?.22:.17,24);hub.rotateZ(Math.PI/2);hub.translate(x+side*(main?.13:0),bottom,z);absolute(hub);
  for(let j=0;j<7;j++){const a=j/7*Math.PI*2;const bolt=new T.CylinderGeometry(.012,.012,.012,6);bolt.rotateZ(Math.PI/2);bolt.translate(x+side*(main?.255:.10),bottom+Math.sin(a)*radius*.32,z+Math.cos(a)*radius*.32);absolute(bolt);}
  const well=box([main?.45:.28,.04,main?.89:.70],[x,topY+.04,z],9,materials.dark);well.name='recessed landing gear well';
  const door=new T.Group();door.position.set(x-side*(main?.22:.15),topY,z);door.userData.keepGroup=true;parts[part].add(door);const doorGeo=new T.BoxGeometry(main?.42:.28,.025,main?.92:.74);doorGeo.translate(side*(main?.21:.14),0,0);const dm=new T.Mesh(doorGeo,matFor(materials.skin,part));dm.castShadow=true;door.add(dm);
  gears.push({h,door,part,main,side});return h;
 }
 function navLight(pos,color,part=0){const material=new T.MeshBasicMaterial({color,toneMapped:false});return ellipsoid([.035,.026,.055],pos,part,material,undefined,16);}
 function batch(parent){
  // Retain smooth vertex normals and every attribute. Recomputing normals after
  // non-indexing was the old model's flat-faceted fuselage regression.
  const buckets=new Map();for(const child of [...parent.children]){if(!child.isMesh||child.userData.keepDynamic||child.geometry.morphAttributes.position||child.material.isShaderMaterial||child.material.transparent)continue;const key=child.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(child);}
  for(const list of buckets.values()){
   if(list.length<2)continue;
   const sizes=new Map([['position',3],['normal',3],['uv',2]]),attributes={},indices=[];
   for(const m of list)for(const [name,a]of Object.entries(m.geometry.attributes))sizes.set(name,a.itemSize);
   for(const name of sizes.keys())attributes[name]=[];
   let offset=0;
   for(const m of list){
    m.updateMatrix();const g=m.geometry.clone();g.applyMatrix4(m.matrix);const n=g.attributes.position.count;
    for(const [name,size]of sizes){const a=g.attributes[name];for(let i=0;i<n*size;i++)attributes[name].push(a?a.array[i]:name==='color'?1:0);}
    if(g.index)for(const i of g.index.array)indices.push(offset+i);else for(let i=0;i<n;i++)indices.push(offset+i);
    offset+=n;g.dispose();m.removeFromParent();m.geometry.dispose();
   }
   const g=new T.BufferGeometry();for(const [name,size]of sizes)g.setAttribute(name,new T.Float32BufferAttribute(attributes[name],size));g.setIndex(indices);g.computeBoundingSphere();
   const m=new T.Mesh(g,list[0].material);m.castShadow=m.receiveShadow=true;m.name='batched exterior / preserved smooth normals';parent.add(m);
  }

 }
 function attachStores(){
  const stores=[],f4=d.id===1,f5=d.id===2;
  if(d.previewOnly||d.bomber||d.propeller||d.internalWeapons)return stores;
  function wingPylon(pos,part,length=.95){
   group.updateMatrixWorld(true);
   const skin=[];for(const id of [1,2,12,13,16,17,18,19])parts[id].traverse(o=>{if(o.isMesh&&o.material.userData.coatKind==='skin')skin.push(o);});
   const top=z=>{const ray=new T.Raycaster(V(pos[0],-1.8,z),V(0,1,0),0,3),hit=ray.intersectObjects(skin,false)[0];if(!hit)throw new Error(d.name+' weapon pylon has no wing attachment');return hit.point.y+.018;};
   const front=pos[2]-length*.5,back=pos[2]+length*.5,bottom=pos[1]+.105;
   const p=solid([[pos[0],top(front),front],[pos[0],top(back),back],[pos[0],bottom,back-.10],[pos[0],bottom,front+.10]],part,materials.skin,.11);
   p.name=d.name+' fitted wing weapon pylon';
  }
  for(let i=0;i<(d.irCount??2);i++){const pos=storeMount(d.id,'ir',i),part=(d.id===4?27:f5||d.id===3||d.superHornet?12:1)+i%2,m=createSidewinderModel(f4||f5?'p':d.superHornet?'x':'m');m.position.set(...pos);if(d.superHornet&&parts[part].userData.pivot)m.position.sub(V(...parts[part].userData.pivot));parts[part].add(m);box([.07,.115,1.65],[pos[0],pos[1]+.09,pos[2]],part,materials.metal);if(f4)wingPylon(pos,part,.65);if(f5||d.id===3){const side=i%2?1:-1,edge=f5?4.015:4.70,rail=Math.abs(pos[0]);const adapter=solid([[side*edge,-.025,1.62],[side*(rail+.025),.015,1.62],[side*(rail+.025),.125,1.62],[side*(edge+.025),.055,1.62]],part,materials.frame,.52);adapter.name=d.name+' continuous wingtip launcher adapter';}stores.push({m,kind:'ir',slot:i});}
  for(let i=0;i<d.rfCount;i++){const m=createAmraamModel(f4?'sparrow':d.id===4?'phoenix':'amraam'),part=d.superHornet?(i<2?27+i%2:1+i%2):d.id===4?(i>=4?27+i%2:0):f4||d.id===5||d.id===6&&i>=2?0:(d.id===3&&i<2?12:1)+i%2;m.position.set(...storeMount(d.id,'rf',i));parts[part].add(m);stores.push({m,kind:'rf',slot:i});if(d.id===3||d.superHornet&&i>=2&&i<4)wingPylon(m.position.toArray(),part,.90);}
  for(let i=0;i<(d.id===6?6:2);i++){const m=new T.Group(),part=d.id===4||d.id===6?0:1+i;setBombModel(m,0);m.position.set(...storeMount(d.id,'bomb',i));parts[part].add(m);stores.push({m,kind:'bomb',slot:i});}if(d.id===3||d.id===4||d.id===6||d.superHornet){const m=createTargetingPod(d.superHornet?'atflir':'generic');m.position.set(...(d.superHornet?[-1.27,-1.03,-1.85]:d.id===3?[.75,-.98,-1.35]:d.id===6?[.88,-1.10,-2.0]:[3.02,-.92,-.4]));parts[d.id===3||d.superHornet?27:28].add(m);stores.push({m,kind:'pod',slot:0});}return stores;
 }
 function finish(extra={}){
  const gunMount=V(...(extra.gunMount||(d.id===1?[0,-.43,-8.9]:d.id===2?[-.32,.22,-5.4]:[-.64,.48,-2.65]))),gunPart=extra.gunPart??(d.id===5?2:d.id===3?27:10);
  const flash=mesh(new T.ConeGeometry(.11,.65,12),new T.MeshBasicMaterial({color:0xffc77d,transparent:true,opacity:.8,depthWrite:false}),gunPart);flash.geometry.rotateX(-Math.PI/2);flash.position.copy(gunMount).add(V(0,0,-.32));flash.visible=false;flash.userData.visualEffect=true;
  const flashes=[flash];if(d.id===2){const second=flash.clone();second.position.x=.32;parts[gunPart].add(second);flashes.push(second);}
  const stores=attachStores();for(const item of stores){item.m.userData.weaponStore={kind:item.kind,slot:item.slot};batch(item.m);}for(const h of controls.map(c=>c.h))batch(h);for(const g of gears){batch(g.h);batch(g.door);}for(const part of parts)batch(part);
  bakeAirframeSurfaceCoordinates(group);group.updateMatrixWorld(true);
  group.userData.effectsAnchors={wingTips:extra.wingTips||[[-d.span*.5,.13,2.5],[d.span*.5,.13,2.5]],exhaust:(extra.exhaustFrames||nozzles.map(n=>n.frame)).map(f=>group.worldToLocal(f.getWorldPosition(V())).toArray())};
  group.userData.damagePartBounds=parts.map(part=>{const b=new T.Box3();part.traverse(node=>{if(!node.isMesh||node.userData.visualEffect||node.material.isShaderMaterial)return;node.geometry.computeBoundingBox();b.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));});if(b.isEmpty())b.setFromCenterAndSize(V(),V(.1,.1,.1));return{min:b.min.toArray(),max:b.max.toArray(),center:b.getCenter(V()).toArray(),half:b.getSize(V()).multiplyScalar(.5).toArray()};});
  const overlay=createAirframeDamageOverlay(group,parts);enableWorldDepthIn(group);const health=new Float32Array(30).fill(1),q=new T.Quaternion();
  function update(s={},dt=1/60){
   for(let i=0;i<30;i++){health[i]=s.health?.[i]??1;integrity[i].value=health[i];parts[i].visible=(d.previewOnly||partInstalled(d.id,i))&&health[i]>=.08;}
   for(let i=1;i<30;i++)for(let p=partParentFor(d.id,i,PARTS);p>=0;p=partParentFor(d.id,p,PARTS))if(health[p]<.08){parts[i].visible=false;break;}
   for(const c of controls)if(s.enabled?.[c.part]!==0&&s.enabled?.[c.part]!==false){q.setFromAxisAngle(c.axis,(s[c.field]??(c.field==='intakeRamp'?clamp(((s.tas??0)/340-.5)*.1,0,.12):0))*c.sign);c.h.quaternion.copy(q);}
   const deployed=clamp(s.gear??0,0,1);for(const g of gears){g.h.visible=deployed>.01;g.h.rotation[g.main?'z':'x']=(1-deployed)*(g.main?g.side*1.44:1.48);g.door.rotation.z=g.side*deployed*1.5;if(!g.main)g.h.rotation.y=-(s.yawInput??0)*.21*deployed;}
   const preset=PRESETS[s.bombs?.[22]];for(const item of stores){if(item.kind==='bomb'){item.m.visible=bombAvailable(s.bombs,item.slot);if(preset&&preset.bombs){const changed=item.m.userData.weaponId!==preset.bomb;setBombModel(item.m,preset.bomb);if(changed)batch(item.m);item.m.position.set(...bombMount(preset,item.slot));}}else if(item.kind==='pod')item.m.visible=!!preset?.pod;else item.m.visible=item.kind==='ir'?irStoreAvailable(s.missiles,item.slot):(s.amraam?.[16+item.slot]??1)>0;}
   const ab=clamp(s.afterburner??0,0,1);for(const n of nozzles){n.petals.morphTargetInfluences[0]=ab;if(n.hardware)n.hardware.morphTargetInfluences[0]=ab;n.plumeMaterial.uniforms.time.value=s.time??0;n.plumeMaterial.uniforms.power.value=ab;n.flameRoot.visible=ab>.01&&health[n.part]>=.08&&health[n.nozzlePart]>=.08&&s.enabled?.[n.part]!==0;}
   for(const f of flashes)f.visible=!!s.gunFiring&&health[gunPart]>=.08;extra.update?.(s,dt);for(const fn of animations)fn(s,dt);group.updateMatrixWorld(true);overlay.update(health);
  }
  update();return{group,update,damageParts:parts,exhaustFrames:extra.exhaustFrames||nozzles.map(n=>n.frame),gun:{mount:gunMount,flash},definition:d,damageOverlay:overlay.root,setDamageOverlay:value=>overlay.setEnabled(value)};
 }
 return{d,group,parts,materials,mesh,loft,solid,airfoil,ellipsoid,box,tube,line,hinge,canopy,nozzle,gear,navLight,animations,batch,finish};
}
