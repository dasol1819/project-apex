// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';

export const SU35_LIVERY=Object.freeze({number:'52',registration:'RF-81719',name:'Su-35S · 52 · 청회색 위장',
  pale:0xb0ccd8,blue:0x80a6b9,slate:0x638a9d,radome:0x596970});
const rgb=hex=>'vec3('+new T.Color(hex).toArray().map(n=>n.toFixed(6)).join(',')+')';

// Fixed, airframe-space paint boundaries, shared by the shell and its controls.
// The existing atlas contributes only fine surface detail to the painted areas.
export function applySu35Livery(material,integrity={value:1}){
  material.onBeforeCompile=shader=>{
    shader.uniforms.su35Integrity=integrity;
    shader.vertexShader='attribute vec3 liveryPosition; varying vec3 vSu35Local; varying vec3 vSu35NeutralNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSu35Local=liveryPosition;vSu35NeutralNormal=normal;');
    shader.fragmentShader=`uniform float su35Integrity;varying vec3 vSu35Local;varying vec3 vSu35NeutralNormal;
      float paintOval(vec2 p,vec2 c,vec2 r,float a){float cs=cos(a),sn=sin(a);vec2 q=p-c;q=mat2(cs,-sn,sn,cs)*q/r;float edge=1.+.19*sin(q.x*3.1+q.y*2.5)+.13*cos(q.y*4.6-q.x*1.7)+.055*sin(q.x*7.3-q.y*5.2);return 1.-smoothstep(edge-.015,edge+.015,length(q));}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 original=diffuseColor.rgb;float luma=dot(original,vec3(.2126,.7152,.0722));
      vec3 blurred=texture2D(map,vMapUv,3.5).rgb;float broad=dot(blurred,vec3(.2126,.7152,.0722));
      float surfaceDetail=mix(1.,clamp((luma+.04)/(broad+.04),.68,1.20),.48);
      vec2 p=vSu35Local.xz;float top=smoothstep(.03,.30,vSu35NeutralNormal.y);
      float medium=max(paintOval(p,vec2(-1.0,-3.4),vec2(.68,2.35),-.13),paintOval(p,vec2(1.10,-.1),vec2(.95,2.05),.23));
      medium=max(medium,paintOval(p,vec2(-3.7,3.50),vec2(2.05,.74),-.33));
      medium=max(medium,paintOval(p,vec2(4.40,3.83),vec2(2.30,.76),.20));
      medium=max(medium,paintOval(p,vec2(-3.25,8.10),vec2(1.20,.60),-.43));
      medium=max(medium,paintOval(p,vec2(3.00,8.48),vec2(1.37,.55),.28));
      float dark=max(paintOval(p,vec2(-1.17,.30),vec2(.55,1.85),-.15),paintOval(p,vec2(1.3,3.30),vec2(.58,1.95),.03));
      dark=max(dark,paintOval(p,vec2(-5.35,4.10),vec2(1.07,.46),-.25));
      dark=max(dark,paintOval(p,vec2(3.1,2.80),vec2(1.25,.51),.39));
      vec3 paint=mix(${rgb(SU35_LIVERY.pale)},${rgb(SU35_LIVERY.blue)},medium*top);
      paint=mix(paint,${rgb(SU35_LIVERY.slate)},dark*top*.86);
      float fin=step(1.80,abs(vSu35Local.x))*step(abs(vSu35Local.x),2.65)*smoothstep(.95,1.20,vSu35Local.y)*step(4.0,vSu35Local.z);
      float finPatch=max(paintOval(vSu35Local.zy,vec2(5.95,1.90),vec2(.66,.74),-.36),paintOval(vSu35Local.zy,vec2(6.90,3.12),vec2(.65,.40),.23));
      paint=mix(paint,mix(${rgb(SU35_LIVERY.blue)},${rgb(SU35_LIVERY.slate)},finPatch),fin*.88);
      float radome=1.-smoothstep(-7.74,-7.68,vSu35Local.z);paint=mix(paint,${rgb(SU35_LIVERY.radome)},radome);
      float antiGlare=smoothstep(.90,1.15,vSu35Local.y)*step(-7.67,vSu35Local.z)*(1.-smoothstep(-6.20,-5.98,vSu35Local.z))*(1.-smoothstep(.28,.44,abs(vSu35Local.x)));
      paint=mix(paint,vec3(.026,.037,.043),antiGlare);
      float engineDistance=length(vec2(abs(vSu35Local.x)-1.27,vSu35Local.y-.08));
      float metal=step(5.25,vSu35Local.z)*(1.-smoothstep(.62,.70,engineDistance));
      vec3 steel=mix(vec3(luma),original,.35)*vec3(.96,1.02,1.06);
      diffuseColor.rgb=mix(paint*surfaceDetail,steel,metal);
      float scarring=(1.-su35Integrity)*smoothstep(.25,.72,fract(sin(dot(floor(vSu35Local*4.),vec3(12.98,78.23,37.71)))*43758.54));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025,.029,.030),scarring*.85);
    `);
  };
  material.customProgramCacheKey=()=> 'su35-52-reference-paint-5';
  return material;
}
