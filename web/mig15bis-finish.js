// Original finite panel layout in frozen aircraft-local metres. No tiled paint
// atlas, photography, normal-map grid or camouflage-derived bump is used.
export function applyMig15Metal(material, part, health) {
 material.userData.airframeSurface=true;
 material.userData.damageIndex=part;
 material.onBeforeCompile=s=>{
  s.uniforms.migIntegrity=health;
  s.vertexShader='attribute vec3 skinPosition; varying vec3 vMigRest;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMigRest=skinPosition;');
  s.fragmentShader=`varying vec3 vMigRest;uniform float migIntegrity;
   float migSeg(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/max(dot(d,d),1.e-8),0.,1.));}
   float migBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
   float migHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
   vec3 migBump(vec3 n,vec3 p,float h){vec3 a=dFdx(p),b=dFdy(p),r=cross(b,n),q=cross(n,a);float d=dot(a,r);return abs(d)<1.e-10?n:normalize(abs(d)*n-sign(d)*(dFdx(h)*r+dFdy(h)*q));}
  `+s.fragmentShader;
  const wing=[1,2,12,13,14,15,16,17].includes(part),tail=[3,4].includes(part),fin=[5,20].includes(part);
  let panels=wing?`
   vec2 q=vec2(abs(p.x),p.z);float le=-2.08+q.x*.735,te=1.37+q.x*.303;
   float seam=min(migSeg(q,vec2(.78,-.37),vec2(5.00,2.18)),migSeg(q,vec2(1.05,1.01),vec2(4.98,2.64)));
   seam=min(seam,migSeg(q,vec2(2.16,-.48),vec2(2.16,2.03)));
   seam=min(seam,migSeg(q,vec2(3.58,.54),vec2(3.58,2.48)));
   seam=min(seam,abs(migBox(q-vec2(1.34,.35),vec2(.22,.31))));
   float sheet=step(le+(te-le)*.34,p.z)*.022-step(3.58,q.x)*.018;
   float cavity=(1.-smoothstep(.70,1.04,q.x))*.12;
  `:tail?`
   vec2 q=vec2(abs(p.x),p.z);float seam=min(migSeg(q,vec2(.09,3.84),vec2(1.73,4.50)),migSeg(q,vec2(.72,3.02),vec2(.72,4.30)));
   float sheet=step(.72,q.x)*.018;float cavity=(1.-smoothstep(.08,.24,q.x))*.12;
  `:fin?`
   vec2 q=p.zy;float seam=min(migSeg(q,vec2(3.71,.53),vec2(4.20,2.15)),migSeg(q,vec2(2.96,1.30),vec2(4.10,1.30)));
   seam=min(seam,migSeg(q,vec2(3.27,1.82),vec2(4.17,1.82)));
   float sheet=step(1.30,p.y)*.02;float cavity=0.;
  `:`
   float a=atan(p.y,p.x);float ring=min(min(abs(p.z+3.73),abs(p.z+2.83)),min(abs(p.z+1.23),abs(p.z-.47)));
   ring=min(ring,min(min(abs(p.z-1.66),abs(p.z-2.76)),abs(p.z-3.73)));
   float along=min(abs(p.y-.36),abs(p.y+.40));
   float seam=min(ring,along);
   seam=min(seam,abs(migBox(p.zy-vec2(-2.25,.12),vec2(.24,.27))));
   float sheet=step(-2.83,p.z)*.015-step(-1.23,p.z)*.025+step(.47,p.z)*.02-step(2.76,p.z)*.02;
   float cavity=(1.-smoothstep(.018,.11,seam))*.035;
  `;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec3 p=vMigRest;float footprint=max(length(dFdx(p)),length(dFdy(p)));float fine=1.-smoothstep(.003,.018,footprint);
   ${panels}
   float edge=1.-smoothstep(max(.0008,footprint*.35),max(.0027,footprint*.85),seam);
   float rivetAlong=${wing||tail?'p.x':'p.z'};
   float rivet=(1.-smoothstep(.0011,.0026,abs(fract(rivetAlong*24.)-.5)/24.))*
      (1.-smoothstep(.0011,.0030,abs(seam-.011)))*fine;
   float grain=(migHash(floor(p*650.))-.5)*fine;
   float stain=smoothstep(3.65,4.85,p.z)*(1.-smoothstep(.16,.70,abs(p.y+.35)));
   float scar=(1.-migIntegrity)*smoothstep(.45,.78,migHash(floor(p*5.)));
   diffuseColor.rgb*=1.+sheet-edge*.16-rivet*.13+grain*.009;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.19,.16),stain*.20);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025,.029,.031),scar*.85);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+sheet*2.+edge*.09+grain*.018+stain*.10+scar*.32,.27,.93);');
  s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.-cavity;');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=migBump(normal,-vViewPosition,-edge*.00012-rivet*.00007+grain*.000018);');
 };
 material.customProgramCacheKey=()=>`mig15bis-finite-panels-${part}-v1`;
}
