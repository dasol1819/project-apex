// Original neutral-coordinate surface layer for the thirteen procedural airframes.
// RG = tangent normal XY, B = roughness, A = shallow cavity occlusion.
import * as T from './vendor/three.module.js';
import {aircraftDefinition} from './aircraft-catalog.js';
import {loadGpuSurface} from './gpu-surface-texture.js?v=2';

let renderer;
const cache=new Map();
const neutral=new T.DataTexture(new Uint8Array([128,128,184,255]),1,1);
neutral.needsUpdate=true;neutral.colorSpace=T.NoColorSpace;
export function configureFleetSurface(value){renderer=value;}
export function fleetSurfaceState(id){return cache.get(Number(id));}
function trimIdle(){
  const idle=[...cache.entries()].filter(([,s])=>s.refs===0&&s.status!=='loading');
  while(idle.length>2){const [id,s]=idle.shift();if(s.surface.value!==neutral)s.surface.value.dispose();cache.delete(id);}
}
function maps(id){
  if(cache.has(id))return cache.get(id);
  const state={surface:{value:neutral},status:'neutral',error:null,refs:0};cache.set(id,state);
  if(typeof document!=='undefined'){
    const base=new URL(`./assets/fleet-surface/${id}/`,import.meta.url);
    state.status='loading';
    state.ready=loadGpuSurface({renderer,label:aircraftDefinition(id).name,url:new URL('surface.ktx2.gz?v=1',base),fallbackUrl:new URL('surface-fallback.webp?v=1',base).href})
      .then(t=>{state.surface.value=t;state.status='ready';trimIdle();return t;})
      .catch(e=>{state.error=e.message;state.status='failed';console.warn('Aircraft surface unavailable',id,e);return null;});
  }
  return state;
}
export const fleetSurfaceGLSL=`
varying vec3 vFleetP;
uniform sampler2D fleetSurfaceMap;
uniform vec3 fleetExtent;
uniform float fleetFin;
uniform float fleetMetal;
vec2 fleetUV(vec3 p,vec3 n){
  vec2 uv;vec2 tile;
  if(fleetFin>.5){uv=vec2(p.z/fleetExtent.z+.5,p.y/fleetExtent.y+.25);tile=vec2(1.,1.);}
  else if(abs(n.y)>=max(abs(n.x),abs(n.z))){uv=vec2(p.x/fleetExtent.x+.5,p.z/fleetExtent.z+.5);tile=n.y>0.?vec2(0.,0.):vec2(1.,0.);}
  else {uv=vec2(p.z/fleetExtent.z+.5,p.y/fleetExtent.y+.25);tile=vec2(0.,1.);}
  // Half a tile texel of neutral padding prevents bleeding into another view.
  return (clamp(uv,vec2(.001),vec2(.999))+tile)*.5;
}
vec3 fleetPerturb(vec3 n,vec3 mapN,vec2 uv,vec3 viewP){
  vec3 q0=dFdx(viewP),q1=dFdy(viewP);
  vec2 st0=dFdx(uv),st1=dFdy(uv);
  vec3 p1=cross(q1,n),p0=cross(n,q0);
  vec3 t=p1*st0.x+p0*st1.x,b=p1*st0.y+p0*st1.y;
  float inv=inversesqrt(max(max(dot(t,t),dot(b,b)),1.e-14));
  return normalize(t*inv*mapN.x+b*inv*mapN.y+n*mapN.z);
}
`;

export function addFleetSurface(model,id){
  if(id>12)return model;
  const d=aircraftDefinition(id),state=maps(id),extent=new T.Vector3(d.span,d.id===8?13.5:d.id===9?2.6:d.id===7?6.5:6.3,d.length),materials=new Map();
  const retain=()=>{state.refs++;let released=false;return()=>{if(released)return;released=true;state.refs--;trimIdle();};};
  model.group.userData.retainFleetSurface=retain;
  model.group.userData.releaseFleetSurface=retain();
  model.group.updateMatrixWorld(true);const inv=model.group.matrixWorld.clone().invert(),v=new T.Vector3();
  model.group.traverse(node=>{
    if(!node.isMesh||node.userData.visualEffect)return;
    for(let p=node;p&&p!==model.group;p=p.parent)if(p.userData.weaponStore)return;
    let part=node.userData.damageIndex;
    for(let p=node;part===undefined&&p;p=p.parent)part=p.userData.damageIndex;
    const process=material=>{
      if(!material?.isMeshStandardMaterial||material.transparent||material.userData.fleetSurface)return material;
      const coated=material.userData.airframeSurface||material.userData.fleetCoating;
      if(!coated)return material;
      const key=material.uuid+':'+part;
      if(materials.has(key))return materials.get(key);
      const m=material.clone(),compile=material.onBeforeCompile.bind(material),oldKey=material.customProgramCacheKey.bind(material);
      m.userData={...material.userData,fleetSurface:true,surfaceAircraft:id};
      m.onBeforeCompile=shader=>{
        compile(shader);
        shader.uniforms.fleetSurfaceMap=state.surface;
        shader.uniforms.fleetExtent={value:extent};
        shader.uniforms.fleetFin={value:[5,6,20,21].includes(part)?1:0};
        shader.uniforms.fleetMetal={value:material.userData.coatKind==='metal'||material.userData.surfaceBase==='metal'?1:0};
        shader.vertexShader='attribute vec3 fleetPosition;varying vec3 vFleetP;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFleetP=fleetPosition;');
        shader.fragmentShader=fleetSurfaceGLSL+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec3 fleetCross=cross(dFdx(vFleetP),dFdy(vFleetP));
          vec3 fleetN=normalize(fleetCross+vec3(1.e-16))*(gl_FrontFacing?1.:-1.);
          vec2 fleetCoord=fleetUV(vFleetP,fleetN);
          vec4 fleetSample=texture2D(fleetSurfaceMap,fleetCoord);
          diffuseColor.rgb*=mix(1.,fleetSample.a,.35*(1.-fleetMetal));`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          roughnessFactor=clamp(roughnessFactor+(fleetSample.b-.72)*mix(.65,.16,fleetMetal),.23,.96);`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec2 fleetXY=(fleetSample.rg*2.-1.)*mix(.65,.22,fleetMetal);
          normal=fleetPerturb(normal,vec3(fleetXY,sqrt(max(.02,1.-dot(fleetXY,fleetXY)))),fleetCoord,-vViewPosition);`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=mix(1.,fleetSample.a,.65);');
      };
      m.customProgramCacheKey=()=>oldKey()+':fleet-surface-1';materials.set(key,m);return m;
    };
    node.material=Array.isArray(node.material)?node.material.map(process):process(node.material);
    if(!(Array.isArray(node.material)?node.material:[node.material]).some(m=>m.userData.fleetSurface))return;
    const g=node.geometry,rest=new Float32Array(g.attributes.position.count*3),matrix=new T.Matrix4().multiplyMatrices(inv,node.matrixWorld);
    for(let i=0;i<g.attributes.position.count;i++)v.fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix).toArray(rest,i*3);
    g.setAttribute('fleetPosition',new T.BufferAttribute(rest,3));
  });
  model.group.userData.surfaceRevision='fleet-packed-1';return model;
}
