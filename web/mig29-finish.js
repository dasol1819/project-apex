// SPDX-License-Identifier: GPL-2.0-only
import { addPackedAirframeSurface } from "./packed-airframe-surface.js?v=1";
// The 9.12's authored grey/green paint stays in neutral airframe coordinates.
export function paint(m, health, textures = {}) {
  m.userData.airframeSurface = true;
  m.userData.mig29Surface = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.migIntegrity = health;
    s.vertexShader =
      "attribute vec3 liveryPosition;varying vec3 migP;varying vec3 migN;\n" +
      s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nmigP=liveryPosition;migN=normal;",
    );
    s.fragmentShader =
      "varying vec3 migP;varying vec3 migN;uniform float migIntegrity;\n" +
      s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec3 p=migP;
      float field=min(length((p.xz-vec2(-1.4,-1.3))/vec2(1.5,2.8)),length((p.xz-vec2(2.7,1.6))/vec2(2.3,1.5)));
      field=min(field,length((p.xz-vec2(-3.5,2.2))/vec2(2.,1.5)));field=min(field,length((p.xz-vec2(.3,5.2))/vec2(1.3,1.6)));
      field+=.028*sin(p.z*3.+p.x*2.7)+.016*sin(p.x*6.3-p.z*2.);
      vec3 coat=mix(vec3(.34,.395,.375),vec3(.16,.235,.185),1.-smoothstep(.98,1.025,field));
      coat=mix(vec3(.34,.405,.425),coat,smoothstep(-.18,.15,p.y));if(p.z<-6.5)coat=vec3(.115,.165,.137);
      float patina=.5+.5*sin(p.z*8.1+sin(p.x*5.))*sin(p.x*13.2+p.y*2.);
      if(!gl_FrontFacing)coat=vec3(.055,.067,.063);
      coat*=.975+.045*patina;
      float detail=mix(.79,1.04,clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),0.,1.));
      diffuseColor.rgb=mix(coat*.46,coat,clamp(migIntegrity,0.,1.))*detail;
      diffuseColor.rgb*=1.-(1.-afSurface.a)*.24;
      // Fine cavity staining follows the baked recess slopes, not a repeating grid.
      diffuseColor.rgb*=1.-smoothstep(.014,.055,length(afSurface.rg*2.-1.))*.10;
      diffuseColor.rgb*=1.-smoothstep(.70,.80,afSurface.b)*.05;
    `,
    );
    addPackedAirframeSurface(s, textures, {
      position: "migP",
      neutralNormal: "migN",
    });
  };
  m.customProgramCacheKey = () =>
    "mig29-packed-surface-1-" + !!textures.surface + "-" + !!textures.micro;
  return m;
}
export function heatSteel(T, { liner = false } = {}) {
  const m = new T.MeshStandardMaterial({
    color: 0xffffff,
    roughness: liner ? 0.82 : 0.49,
    metalness: liner ? 0.48 : 0.81,
    side: T.DoubleSide,
  });
  m.onBeforeCompile = (s) => {
    s.vertexShader = "varying vec2 migMetalUV;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nmigMetalUV=uv;",
    );
    s.fragmentShader = "varying vec2 migMetalUV;\n" + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
 vec2 u=migMetalUV;float edge=smoothstep(.012,.045,u.x)*smoothstep(.012,.045,1.-u.x);
 float brush=.5+.5*sin(u.x*590.+sin(u.y*75.)*.8);
 float temper=smoothstep(.35,.95,u.y);vec3 steel=mix(vec3(.28,.30,.29),vec3(.18,.145,.106),temper);
 steel=mix(steel,vec3(.13,.145,.19),exp(-pow((u.y-.56)*7.,2.))*.38);
 diffuseColor.rgb=steel*(.80+.20*edge)*(.97+.06*brush)*${liner ? ".37" : "1."};
 `,
    );
  };
  m.customProgramCacheKey = () => "mig29-heat-steel-v2-" + liner;
  return m;
}
