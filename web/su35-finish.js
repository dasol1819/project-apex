import * as T from './vendor/three.module.js';

// Muted paint, metre-scale panels, fine fasteners and heat-treated titanium.
// Frozen positions keep the finish attached to every moving component.
export const SU35_PALETTE=[0x9fb4c1,0x657f91,0x839eae,0xb9cbd4];
const rgb=h=>'vec3('+new T.Color(h).toArray().map(v=>v.toFixed(6)).join(',')+')';
const functions=`
 varying vec3 vFlanker;
 float flHash(vec3 p){p=fract(p*.3183099+vec3(.1,.3,.7));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float flNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(flHash(i),flHash(i+vec3(1,0,0)),f.x),mix(flHash(i+vec3(0,1,0)),flHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(flHash(i+vec3(0,0,1)),flHash(i+vec3(1,0,1)),f.x),mix(flHash(i+vec3(0,1,1)),flHash(i+vec3(1)),f.x),f.y),f.z);}
 float flLine(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
 float flBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
 float flEllipse(vec2 p,vec2 c,vec2 r,float a){float cs=cos(a),sn=sin(a);return length(mat2(cs,-sn,sn,cs)*(p-c)/r);}
 vec3 flBump(vec3 n,vec3 p,float height){vec3 x=dFdx(p),y=dFdy(p),rx=cross(y,n),ry=cross(n,x);float det=dot(x,rx);if(abs(det)<1.e-12)return n;return normalize(abs(det)*n-sign(det)*(dFdx(height)*rx+dFdy(height)*ry));}
 float flPanel(vec3 p){
  vec2 q=vec2(abs(p.x),p.z);float d=10.;
  if(q.x<1.03&&p.z< -3.){
   d=min(d,abs(p.z+7.35));
   d=min(d,abs(flBox(p.zy-vec2(-5.18,.03),vec2(.33,.20),.07)));
   d=min(d,abs(flBox(p.zy-vec2(-3.75,.12),vec2(.26,.17),.05)));
   d=min(d,flLine(p.zy,vec2(-7.30,-.20),vec2(-3.10,-.20)));
  }
  if(q.x<2.30&&p.z> -3.5&&p.z<5.5){
   d=min(d,abs(flBox(p.xz-vec2(0.,-.50),vec2(.40,1.05),.13)));
   d=min(d,abs(flBox(p.xz-vec2(0.,2.70),vec2(.36,.70),.12)));
   d=min(d,flLine(q,vec2(.80,-2.20),vec2(1.04,4.90)));
   d=min(d,flLine(q,vec2(1.02,-1.80),vec2(2.10,-.74)));
   d=min(d,flLine(q,vec2(1.05,1.25),vec2(2.36,1.32)));
   d=min(d,flLine(q,vec2(1.02,3.80),vec2(2.20,3.80)));
  }
  if(q.x>2.25&&p.y<1.){
   d=min(d,flLine(q,vec2(2.18,-.97),vec2(7.20,3.52)));
   d=min(d,flLine(q,vec2(2.20,3.76),vec2(7.25,4.75)));
   d=min(d,flLine(q,vec2(3.55,-.28),vec2(3.55,4.91)));
   d=min(d,flLine(q,vec2(5.35,1.30),vec2(5.35,5.10)));
   d=min(d,abs(flBox(q-vec2(4.26,2.78),vec2(.30,.40),.055)));
  }
  if(p.y>1.&&p.z>4.){
   d=min(d,flLine(p.zy,vec2(5.6,1.01),vec2(9.7,1.01)));
   d=min(d,flLine(p.zy,vec2(7.14,3.13),vec2(9.00,3.13)));
   d=min(d,abs(flBox(p.zy-vec2(7.6,1.74),vec2(.25,.29),.04)));
  }
  return d;
 }
`;
export function su35Material(kind='skin'){
 const metal=kind==='metal'||kind==='nozzle',nozzle=kind==='nozzle',radome=kind==='radome';
 const m=new T.MeshStandardMaterial({color:radome?0xa4afb1:0xffffff,
   roughness:metal?.58:radome?.70:.61,metalness:metal?.74:.06,envMapIntensity:metal?.65:.48});
 m.name='Su-35S / '+kind;m.userData.airframeSurface=true;
 m.onBeforeCompile=s=>{
  s.vertexShader='attribute vec3 skinPosition;varying vec3 vFlanker;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFlanker=skinPosition;');
  s.fragmentShader=functions+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec3 flP=vFlanker;float flFoot=max(length(dFdx(flP)),length(dFdy(flP)));
   float flFine=1.-smoothstep(.008,.035,flFoot);
   float flGrain=(flHash(floor(flP*230.))-.5)*flFine;
   float flVariation=flNoise(flP*vec3(4.,3.,7.))-.5;
   float flSeam=0.,flFastener=0.,flPatina=0.;
   ${metal?`
    float a=atan(flP.y+.36,abs(flP.x)-1.65);
    float blade=floor((a+3.141593)*3.8197186);
    float bladeShade=flHash(vec3(blade,7.,3.));
    float axial=flNoise(vec3(a*18.,flP.z*1.6,3.));
    float brush=flNoise(vec3(a*210.,flP.z*4.,9.));
    float heat=smoothstep(5.85,9.7,flP.z);
    vec3 titanium=mix(vec3(.22,.245,.255),vec3(.19,.15,.112),heat*.58);
    titanium=mix(titanium,vec3(.105,.145,.19),smoothstep(.39,.72,axial)*.35);
    titanium*=.78+bladeShade*.27+brush*.10;
    float panelBand=abs(fract((flP.z-5.75)/.69+.5)-.5)*.69;
    float seam=1.-smoothstep(.002,.006+flFoot*.4,panelBand);
    titanium*=1.-seam*.35;
    float heatEdge=pow(.5+.5*sin(flP.z*19.5+axial*4.),8.);
    titanium=mix(titanium,vec3(.13,.145,.19),heatEdge*.23);
    ${nozzle?`titanium*=.76;float tips=smoothstep(9.84,10.08,flP.z);titanium=mix(titanium,vec3(.32,.30,.235),tips*.58);`:''}
    diffuseColor.rgb*=titanium+flGrain*.008;flPatina=brush;
   `:radome?`diffuseColor.rgb*=.98+flVariation*.018+flGrain*.005;`:`
    vec2 uv=flP.xz+vec2(.32*sin(flP.z*.71)+.09*sin(flP.z*2.4),.26*sin(flP.x*1.4));
    float paint=min(flEllipse(uv,vec2(-1.05,-1.2),vec2(.92,3.8),-.24),flEllipse(uv,vec2(3.50,2.70),vec2(2.65,.80),.42));
    paint=min(paint,flEllipse(uv,vec2(-4.6,3.2),vec2(2.7,.81),-.47));
    paint=min(paint,flEllipse(uv,vec2(1.15,5.0),vec2(.88,2.20),.21));
    vec3 finish=mix(${rgb(SU35_PALETTE[0])},${rgb(SU35_PALETTE[1])},(1.-smoothstep(.92,1.12,paint))*.64);
    float middle=flEllipse(uv,vec2(1.30,-1.1),vec2(.77,3.8),.19);
    finish=mix(finish,${rgb(SU35_PALETTE[2])},(1.-smoothstep(.88,1.12,middle))*.56);
    if(flP.y>1.&&flP.z>4.){
     float f=flEllipse(flP.zy,vec2(7.90,2.05),vec2(.72,1.9),-.40);
     finish=mix(${rgb(SU35_PALETTE[0])},${rgb(SU35_PALETTE[1])},(1.-smoothstep(.91,1.13,f))*.68);
     finish=mix(finish,${rgb(SU35_PALETTE[1])},smoothstep(3.18,3.26,flP.y)*.62);
    }
    vec3 cp=cross(dFdx(flP),dFdy(flP)),sn=cp/max(length(cp),1.e-9)*(gl_FrontFacing?1.:-1.);
    finish=mix(finish,${rgb(SU35_PALETTE[3])},(1.-smoothstep(-.6,-.17,sn.y))*.86);
    float panel=flPanel(flP);flSeam=1.-smoothstep(.001,.0025+flFoot*.50,panel);
    float row=abs(panel-.018),along=abs(fract((flP.z+flP.x*.3)*18.5)-.5)/18.5;
    float rivet=sqrt(row*row+along*along);flFastener=(1.-smoothstep(.002,.004+flFoot*.4,rivet))*flFine;
    float wash=(flNoise(flP*vec3(8.,1.6,1.9))-.5)*.022;
    diffuseColor.rgb*=finish*(1.-flSeam*.26-flFastener*.17)+wash+flGrain*.003;
   `}
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+flVariation*.055${metal?'+(flPatina-.5)*.16':''},.30,.92);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=flBump(normal,-vViewPosition,-flSeam*.00055-flFastener*.0003+flGrain*.000045);`);
 };
 m.customProgramCacheKey=()=> 'su35-photo-study-'+kind+'-2';return m;
}
