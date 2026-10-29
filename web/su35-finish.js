import * as T from './vendor/three.module.js';

// Paint is authored in neutral aircraft metres. No downloaded textures or CAD.
export const SU35_PALETTE = [0x9aafba, 0x536e83, 0x7e99ab, 0xc2d0d4];
export function su35Material(kind = 'skin') {
  const metal = kind === 'metal', radome = kind === 'radome';
  const m = new T.MeshStandardMaterial({color: radome ? 0x949d9f : 0xffffff,
    roughness: metal ? .43 : radome ? .77 : .68, metalness: metal ? .78 : .12});
  m.name = 'Su-35S / ' + kind;
  m.userData.airframeSurface = true;
  m.onBeforeCompile = s => {
    s.vertexShader = 'attribute vec3 skinPosition; varying vec3 vFlanker;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlanker = skinPosition;');
    s.fragmentShader = `varying vec3 vFlanker;
      float flHash(vec3 p){p=fract(p*.3183099+vec3(.1,.3,.7));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float flLobe(vec2 p,vec2 c,vec2 r,float a){float cs=cos(a),sn=sin(a);return length(mat2(cs,-sn,sn,cs)*(p-c)/r);}
      float flLine(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
      ` + s.fragmentShader;
    const colors = SU35_PALETTE.map(h => 'vec3(' + new T.Color(h).toArray().map(v => v.toFixed(6)).join(',') + ')');
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 p=vFlanker; vec2 q=vec2(abs(p.x),p.z);
      float footprint=max(length(dFdx(p)),length(dFdy(p)));
      float micro=(flHash(floor(p*180.))-.5)*(1.-smoothstep(.005,.025,footprint));
      ${metal ? `
        float bands=.5+.5*sin(p.z*17.+sin(atan(p.y+.48,abs(p.x)-1.65)*20.)*.20);
        float heat=smoothstep(5.5,9.,p.z);
        vec3 finish=mix(vec3(.43,.47,.49),vec3(.35,.26,.19),heat*.47);
        finish=mix(finish,vec3(.28,.32,.41),pow(.5+.5*sin(p.z*5.2),5.)*.24);
        diffuseColor.rgb*=finish*(.91+.09*bands)+micro*.018;
      ` : radome ? `diffuseColor.rgb*=.98+micro*.025;` : `
        vec2 uv=p.xz+vec2(.14*sin(p.z*1.4),.18*sin(p.x*1.8));
        float dark=min(flLobe(uv,vec2(-1.0,-2.4),vec2(1.1,3.6),-.22),flLobe(uv,vec2(3.5,2.0),vec2(2.4,1.7),.5));
        dark=min(dark,flLobe(uv,vec2(-4.6,2.7),vec2(2.25,1.5),-.45));
        dark=min(dark,flLobe(uv,vec2(.6,5.),vec2(1.0,2.5),.2));
        float mid=min(flLobe(uv,vec2(1.25,-3.7),vec2(1.0,2.25),.42),flLobe(uv,vec2(-2.4,2.0),vec2(1.7,1.85),-.4));
        vec3 finish=mix(${colors[0]},${colors[1]},1.-smoothstep(.97,1.04,dark));
        finish=mix(finish,${colors[2]},(1.-smoothstep(.97,1.04,mid))*.86);
        if(p.y>1.25)finish=mix(${colors[0]},${colors[1]},smoothstep(6.1,8.5,p.z+.45*p.y));
        vec3 cp=cross(dFdx(p),dFdy(p));vec3 n=cp/max(length(cp),1.e-9)*(gl_FrontFacing?1.:-1.);
        float underside=1.-smoothstep(-.6,-.12,n.y);
        finish=mix(finish,${colors[3]},underside*.94);
        float panel=10.;
        if(q.x<.8){panel=min(abs(p.z+7.35),abs(p.z+3.45));
          panel=min(panel,flLine(p.xz,vec2(-.37,-2.),vec2(-.37,4.6)));
          panel=min(panel,flLine(p.xz,vec2(.37,-2.),vec2(.37,4.6)));}
        if(q.x>2.25&&p.z<5.8){
          float le=-1.2+(q.x-2.2)*.87;
          panel=min(panel,abs(p.z-mix(le,5.10,.14)));
          panel=min(panel,flLine(q,vec2(3.7,.4),vec2(3.7,5.1)));
          panel=min(panel,flLine(q,vec2(5.6,2.15),vec2(5.6,5.1)));}
        if(p.z>-.5&&p.z<5.8&&q.x<2.6)panel=min(panel,abs(fract((p.z+.2)/1.35+.5)-.5)*1.35);
        float seam=1.-smoothstep(.004,.013+footprint*.45,panel);
        float wear=sin(p.z*1.1+p.x*2.)*sin(p.x*.9-p.z*.5)*.012;
        diffuseColor.rgb*=finish*(1.-seam*.22)+wear+micro*.008;
      `}`);
  };
  m.customProgramCacheKey = () => 'su35-authored-' + kind + '-1';
  return m;
}
