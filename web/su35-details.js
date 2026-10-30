// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';
import {geometry} from './fighter-exterior-tools.js';
const V=(...v)=>new T.Vector3(...v),lerp=T.MathUtils.lerp;

function rod(k,a,b,r,part,mat,parent,sides=12){
  const delta=V(...b).sub(V(...a)),g=new T.CylinderGeometry(r,r,delta.length(),sides);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),delta.clone().normalize()));
  g.translate(...V(...a).add(V(...b)).multiplyScalar(.5).toArray());return k.mesh(g,mat,part,parent);
}
function openingMorph(g,closed,opened,indices){
  g.morphTargetsRelative=true;
  g.morphAttributes.position=[new T.Float32BufferAttribute(opened.map((v,i)=>v-closed[i]),3)];
  const openGeometry=geometry(opened,indices),normal=g.attributes.normal.array,openNormal=openGeometry.attributes.normal.array;
  g.morphAttributes.normal=[new T.Float32BufferAttribute(Array.from(openNormal,(v,i)=>v-normal[i]),3)];
  openGeometry.dispose();
}

export function flankerNozzle(k,side){
  const cx=side*1.65,cy=-.36,part=side<0?22:23,M=k.materials;
  const root=new T.Group();root.position.set(cx,cy,8.55);root.userData.pivot=[cx,cy,8.55];root.userData.keepGroup=true;
  root.name='Su-35 gimballed AL-41F1S nozzle';k.parts[part].add(root);
  // The forward cassette and retaining bands stay rigid while the aft leaves
  // change diameter. This avoids making the complete engine exit one long cone.
  const cp=[],ci=[],cc=[],cu=[];
  for(let panel=0;panel<24;panel++){
    const base=cp.length/3;
    for(let j=0;j<=8;j++)for(let i=0;i<=4;i++){
      const u=j/8,v=i/4,z=8.55+u*.70,a=(panel+v)/24*Math.PI*2,r=lerp(.698,.658,u)+.002*Math.sin(v*Math.PI);
      cp.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z);cu.push((panel+v)/24,u);
      const heat=Math.exp(-Math.pow((u-.33)/.19,2)),edge=i===0||i===4?.75:1,variation=.94+.06*Math.sin(panel*5.8);
      cc.push((.40-.14*heat)*edge*variation,(.41-.07*heat)*edge*variation,(.39+.025*heat)*edge*variation);
      if(j<8&&i<4){const q=base+j*5+i;ci.push(q,q+1,q+5,q+1,q+6,q+5);}
    }
  }
  const cassette=geometry(cp,ci);cassette.setAttribute('color',new T.Float32BufferAttribute(cc,3));cassette.setAttribute('uv',new T.Float32BufferAttribute(cu,2));
  k.mesh(cassette,M.nozzle,part,root).name='Su-35 rigid exhaust cassette';
  const band=new T.MeshStandardMaterial({color:0x939a99,roughness:.64,metalness:.74,envMapIntensity:.45});
  for(const [z,r,length]of [[8.62,.704,.11],[9.035,.689,.14]]){
    k.loft([[z-length*.5,r-.009,r-.009,cy,cx],[z-length*.42,r,r,cy,cx],
      [z+length*.42,r-.004,r-.004,cy,cx],[z+length*.5,r-.013,r-.013,cy,cx]],part,band,{segments:96,samples:2,parent:root});
  }
  const p=[],opened=[],ix=[],nozzleUV=[],nozzleColors=[],N=24,R=18,C=8;
  for(let blade=0;blade<N;blade++){
    const base=p.length/3;
    for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){
      const u=j/R,v=i/C,a=(blade+(v*1.02-.01))/N*Math.PI*2;
      const z=8.69+u*1.39;
      const r=lerp(.672,.505,Math.pow(u,1.7))+.006*Math.sin(v*Math.PI)+.007*Math.sin(u*Math.PI)+v*.010;
      p.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z);nozzleUV.push(.843+(blade+v)/N*.153,.995-u*.185);
      const seam=.68+.32*Math.pow(Math.sin(v*Math.PI),.18),grain=.96+.04*Math.sin(blade*11.7),band=Math.exp(-Math.pow((u-.34)/.12,2));
      const edge=seam*grain*(1-.12*Math.pow(Math.cos(u*Math.PI*9),12));
      nozzleColors.push((.39-.065*band-.05*u)*edge,(.43-.045*band-.07*u)*edge,(.46+.025*band-.10*u)*edge);
      const ro=r+.132*Math.pow(u,1.45);opened.push(cx+Math.cos(a)*ro,cy+Math.sin(a)*ro,z);
    }
    for(let j=0;j<R;j++)for(let i=0;i<C;i++){
      const a=base+j*(C+1)+i,b=a+C+1;ix.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const g=geometry(p,ix);g.setAttribute('uv',new T.Float32BufferAttribute(nozzleUV,2));g.setAttribute('color',new T.Float32BufferAttribute(nozzleColors,3));openingMorph(g,p,opened,ix);
  const feathers=k.mesh(g,M.nozzle,part,root);feathers.name='Su-35 24 overlapping profiled nozzle feathers';feathers.material.side=T.DoubleSide;feathers.userData.keepDynamic=true;
  const ceramic=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.92,metalness:.08,side:T.DoubleSide});
  const ip=[],op=[],ii=[],innerColors=[];
  for(let blade=0;blade<N;blade++){
    const base=ip.length/3;
    for(let j=0;j<=8;j++)for(let i=0;i<=3;i++){
      const u=j/8,a=(blade+i/3*1.015)/N*Math.PI*2,r=lerp(.49,.485,u)+i/3*.002,z=8.30+u*1.78;
      ip.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z);
      const shade=(.0035+.040*Math.pow(u,2))*(.94+.06*Math.sin(blade*7.1));innerColors.push(shade,shade*.98,shade*.87);
      const ro=r+.132*Math.pow(u,2);op.push(cx+Math.cos(a)*ro,cy+Math.sin(a)*ro,z);
    }
    for(let j=0;j<8;j++)for(let i=0;i<3;i++){const a=base+j*4+i,b=a+4;ii.push(a,b,a+1,a+1,b,b+1);}
  }
  const innerG=geometry(ip,ii);innerG.setAttribute('color',new T.Float32BufferAttribute(innerColors,3));openingMorph(innerG,ip,op,ii);
  const inner=k.mesh(innerG,ceramic,part,root);inner.name='Su-35 overlapping ceramic inner feathers';inner.userData.keepDynamic=true;
  for(const [z,r] of [[8.60,.68],[8.78,.68],[9.07,.651]]){
    const arc=Array.from({length:145},(_,i)=>{const a=i/144*Math.PI*2;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r,z];});
    k.line(arc,part,M.titanium,.012,root);
  }
  const steel=new T.MeshStandardMaterial({color:0x676c6a,roughness:.34,metalness:.83,envMapIntensity:.65});
  for(let i=0;i<N;i++){
    const a=(i+.5)/N*Math.PI*2;
    const point=(r,z)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r,z];
    rod(k,point(.69,8.59),point(.69,8.90),.012,part,steel,root);
    rod(k,point(.69,8.79),point(.665,9.10),.007,part,steel,root);
    for(const z of [8.63,8.81]){
      const g=new T.CylinderGeometry(.009,.009,.008,8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),V(Math.cos(a),Math.sin(a),0)));
      g.translate(...point(.690,z));k.mesh(g,steel,part,root);
    }
  }
  const darkness=new T.MeshStandardMaterial({color:0x080909,roughness:.98,metalness:0});
  k.tube(.47,.47,.04,[cx,cy,8.20],part,darkness,{parent:root});
  const ring=Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return[cx+Math.cos(a)*.35,cy+Math.sin(a)*.35,8.23];});
  const holder=new T.MeshStandardMaterial({color:0x292c29,roughness:.88,metalness:.25});
  k.line(ring,part,holder,.012,root);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;rod(k,[cx,cy,8.225],[cx+Math.cos(a)*.43,cy+Math.sin(a)*.43,8.225],.008,part,holder,root);}
  const frame=new T.Group();frame.name='Su-35 physical exhaust exit';frame.position.set(0,0,10.08-8.55);frame.userData.keepGroup=true;root.add(frame);
  k.animations.push(s=>{const angle=s[side<0?'leftNozzle':'rightNozzle'];
    if(angle!==undefined)root.quaternion.setFromAxisAngle(V(Math.cos(32*Math.PI/180),side*Math.sin(32*Math.PI/180),0),T.MathUtils.clamp(angle,-Math.PI/12,Math.PI/12));
    else root.rotation.set(s.vectorPitch||0,side*(s.vectorYaw||0),0);
    feathers.morphTargetInfluences[0]=s.afterburner??.3;inner.morphTargetInfluences[0]=s.afterburner??.3;});
  k.batch(root);return frame;
}
