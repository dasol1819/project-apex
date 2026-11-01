// SPDX-License-Identifier: GPL-2.0-only
// All finish coordinates are frozen in the neutral airframe frame, including wreckage.
const panels = [
  [
    [0.43, -0.85],
    [0.43, 3.8],
  ],
  [
    [0.95, 0.25],
    [0.95, 3.55],
  ],
  [
    [0.43, 0.25],
    [0.95, 0.25],
  ],
  [
    [0.43, 1.82],
    [0.95, 1.82],
  ],
  [
    [0.43, 3.55],
    [0.95, 3.55],
  ],
  [
    [1.25, -0.7],
    [1.72, 2.25],
  ],
  [
    [1.72, 2.25],
    [4.95, 3.16],
  ],
  [
    [1.9, -0.02],
    [4.6, 2.1],
  ],
  [
    [2.8, 1.05],
    [2.8, 2.55],
  ],
  [
    [3.75, 1.84],
    [3.75, 2.84],
  ],
  [
    [1.72, 2.25],
    [1.9, -0.02],
  ],
];
const panelCode = panels
  .map(
    ([a, b]) => `
 seam=min(seam,migSegment(q,vec2(${a.map((n) => n.toFixed(3))}),vec2(${b.map((n) => n.toFixed(3))})));
 rivet=min(rivet,migRivets(q,vec2(${a.map((n) => n.toFixed(3))}),vec2(${b.map((n) => n.toFixed(3))})));`,
  )
  .join("");
export function paint(m, health) {
  m.userData.airframeSurface = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.migIntegrity = health;
    s.vertexShader =
      "attribute vec3 liveryPosition; varying vec3 migP; varying vec3 migN;\n" +
      s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nmigP=liveryPosition;migN=normal;",
    );
    s.fragmentShader =
      `varying vec3 migP;varying vec3 migN;uniform float migIntegrity;
float migSegment(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
float migRivets(vec2 p,vec2 a,vec2 b){vec2 d=b-a;float len=length(d);float t=clamp(dot(p-a,d)/len,0.,len);return length(p-a-d/len*clamp(floor(t/.085+.5)*.085,0.,len));}
float migBox(vec2 p,vec2 b){vec2 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,q.y),0.);}
` + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
 vec3 p=migP;vec2 q=vec2(abs(p.x),p.z);vec3 nn=normalize(migN);
 float field=min(length((p.xz-vec2(-1.4,-1.3))/vec2(1.5,2.8)),length((p.xz-vec2(2.7,1.6))/vec2(2.3,1.5)));
 field=min(field,length((p.xz-vec2(-3.5,2.2))/vec2(2.,1.5)));field=min(field,length((p.xz-vec2(.3,5.2))/vec2(1.3,1.6)));
 field+=.028*sin(p.z*3.+p.x*2.7)+.016*sin(p.x*6.3-p.z*2.);
 vec3 coat=mix(vec3(.34,.395,.375),vec3(.16,.235,.185),1.-smoothstep(.98,1.025,field));
 coat=mix(vec3(.34,.405,.425),coat,smoothstep(-.18,.15,p.y));if(p.z<-6.5)coat=vec3(.115,.165,.137);
 float seam=10.,rivet=10.;
 if(p.z>-.9&&p.z<3.85&&abs(nn.y)>.35){${panelCode}}
 if(abs(p.x)<1.65&&p.z>-.25&&p.z<4.35&&p.y<-.28){
  seam=min(seam,abs(migBox(vec2(abs(p.x)-.95,p.z-2.1),vec2(.31,1.12))));
  rivet=min(rivet,migRivets(q,vec2(.67,.98),vec2(.67,3.22)));
  rivet=min(rivet,migRivets(q,vec2(1.23,.98),vec2(1.23,3.22)));
 }
 if(p.z<-3.&&p.z>-6.4&&abs(nn.x)>.45){
  seam=min(seam,abs(migBox(vec2(p.z+5.,p.y-.22),vec2(.34,.20))));
  rivet=min(rivet,migRivets(p.zy,vec2(-5.3,.39),vec2(-4.7,.39)));
 }
 if(p.y>.8&&abs(p.x)>1.15&&p.z>3.4){
  seam=min(seam,migSegment(p.zy,vec2(4.35,1.12),vec2(5.78,1.12)));
  seam=min(seam,migSegment(p.zy,vec2(4.9,1.12),vec2(5.75,2.66)));
 }
 seam=min(seam,abs(p.z+6.5));
 float aa=max(fwidth(seam),.00035),line=1.-smoothstep(.0012,.0028+aa,seam);
 float fastener=1.-smoothstep(.0017,.0032+max(fwidth(rivet),.0003),rivet);
 float patina=.5+.5*sin(p.z*8.1+sin(p.x*5.))*sin(p.x*13.2+p.y*2.);
 if(!gl_FrontFacing)coat=vec3(.055,.067,.063);
 coat*=1.-line*.19-fastener*.16;coat*=.975+.045*patina;
 float detail=mix(.79,1.04,clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)),0.,1.));
 diffuseColor.rgb=mix(coat*.46,coat,clamp(migIntegrity,0.,1.))*detail;
 float migRelief=-.00008*line-.00005*fastener;
`,
    );
    s.fragmentShader = s.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+patina*.07+line*.06,.48,.86);",
    );
    s.fragmentShader = s.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
 vec3 migDx=dFdx(-vViewPosition),migDy=dFdy(-vViewPosition);
 vec3 migR1=cross(migDy,normal),migR2=cross(normal,migDx);
 float migDet=dot(migDx,migR1);
 normal=normalize(abs(migDet)*normal-sign(migDet)*(dFdx(migRelief)*migR1+dFdy(migRelief)*migR2));`,
    );
  };
  m.customProgramCacheKey = () => "mig29-surface-v2";
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
