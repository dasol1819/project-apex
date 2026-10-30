// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';
import {geometry} from './fighter-exterior-tools.js';

export function paintSu35Markings(k,surfaces){
  k.group.updateMatrixWorld(true);
  const red=new T.MeshStandardMaterial({color:0x9b332b,roughness:.77,metalness:.03,side:T.DoubleSide});
  const white=new T.MeshStandardMaterial({color:0xd5dedc,roughness:.77,metalness:.03,side:T.DoubleSide});
  function cast(point,direction,offset){
    const ray=new T.Raycaster(new T.Vector3(...point),new T.Vector3(...direction),0,12);
    const hit=ray.intersectObjects(surfaces,false)[0];
    return hit?hit.point.addScaledVector(ray.ray.direction,-offset).toArray():null;
  }
  function star(cx,cy,cz,r,plane,side){
    const outline=scale=>Array.from({length:10},(_,i)=>{
      const a=i*Math.PI/5,rr=r*(i%2?.40:1)*scale,u=Math.sin(a)*rr,v=Math.cos(a)*rr;
      return plane==='wing'?[cx+u,cy,cz-v]:[cx,cy+v,cz+u];
    });
    for(const [scale,material,lift]of [[1,white,.003],[.85,red,.006]]){
      const flat=outline(scale),points=flat.map(p=>plane==='wing'?cast([p[0],6,p[2]],[0,-1,0],lift):cast([side*6,p[1],p[2]],[-side,0,0],lift));
      if(points.some(p=>!p))return;
      const uv=flat.map(p=>new T.Vector2(plane==='wing'?p[0]:p[2],plane==='wing'?p[2]:p[1]));
      const indices=T.ShapeUtils.triangulateShape(uv,[]).flat();k.mesh(geometry(points.flat(),indices),material,0).name='Su-35 projected national marking';
    }
  }
  for(const side of [-1,1]){star(side*5.5,.6,3.8,.43,'wing',side);star(side*2.20,2.28,6.25,.31,'fin',side);}
  if(typeof document==='undefined')return;
  const texture=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;};
  const bort=texture(512,256,(p,w,h)=>{p.font='700 224px Arial';p.textAlign='center';p.textBaseline='middle';p.lineJoin='round';p.strokeStyle='#dce0d5';p.lineWidth=12;p.strokeText('01',w/2,h/2+12);p.fillStyle='#94372e';p.fillText('01',w/2,h/2+12);});
  const flag=texture(384,192,(p,w,h)=>{for(const[color,i]of [['#dadfdc',0],['#284c7c',1],['#a13931',2]]){p.fillStyle=color;p.fillRect(0,h/3*i,w,h/3);}});
  const label=texture(1024,256,(p,w,h)=>{p.font='500 112px Arial';p.fillStyle='#1f2d35';p.textAlign='center';p.fillText('ВКС РОССИИ',w/2,148);});
  function decal(map,side,z0,z1,y0,y1){
    const p=[],uv=[],ix=[],N=24,M=8;
    for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){
      const u=i/N,v=j/M,z=T.MathUtils.lerp(z0,z1,u),y=T.MathUtils.lerp(y0,y1,v);
      const point=cast([side*6,y,z],[-side,0,0],.004);
      if(!point)return; // Do not create a floating patch if the surface is absent.
      p.push(...point);uv.push(u,v);
      if(j<M&&i<N){const a=j*(N+1)+i,b=a+N+1;ix.push(a,a+1,b,a+1,b+1,b);}
    }
    const g=geometry(p,ix);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    k.mesh(g,new T.MeshStandardMaterial({map,transparent:true,roughness:.77,metalness:.02,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}),0).name='Su-35 projected identification';
  }
  for(const side of [-1,1]){
    const flip=(a,b)=>side>0?[b,a]:[a,b];
    decal(bort,side,...flip(-6.85,-5.85),.68,1.04);
    decal(flag,side,...flip(6.5,6.9),2.90,3.06);
    decal(label,side,...flip(5.35,6.35),1.45,1.70);
  }
}
