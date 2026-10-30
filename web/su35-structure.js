// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';

// Neutral airframe coordinates: +X starboard, +Y up, +Z aft.
// Every original triangle belongs to exactly one physical damage region.
function hullPart(x,y,z){
  const a=Math.abs(x),right=x>=0;
  if(a>1.78&&a<2.65&&y>1.03&&z>3.9)return right?6:5;
  if(z<-6.35)return 10;
  if(a>2.04&&y<1.03&&y>-.46&&z>-.35&&z<6.7){
    const leading=-.55+(a-2)*.82;
    if(z<leading+.44)return right?19:18;
    return a>4.7?(right?13:12):(right?2:1);
  }
  if(a>.65&&a<1.94&&y<.55&&z>-.95&&z<7.65)return z<2.25?(right?28:27):(right?8:7);
  if(z>4.65)return 29;
  return 0;
}

export function su35StructuralMeshes(asset){
  const output=[];
  for(const mesh of asset.meshes){
    const hull=mesh.name==='HULL_Hull_Upper.001'||mesh.name==='HULL_Hull_Upper';
    const flaperon=mesh.motion.startsWith('flaperon-');
    if(!hull&&!flaperon){output.push({...mesh,sourceName:mesh.name});continue;}
    const buckets=new Map(),p=mesh.attributes.position;
    for(let i=0;i<p.count;i+=3){
      const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,y=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
      const part=hull?hullPart(x,y,z):Math.abs(x)<3.7?(x<0?16:17):mesh.part;
      if(!buckets.has(part))buckets.set(part,[]);buckets.get(part).push(i,i+1,i+2);
    }
    for(const [part,indices]of buckets){
      const attributes={};
      for(const [name,attribute]of Object.entries(mesh.attributes)){
        const values=new Float32Array(indices.length*attribute.itemSize);
        indices.forEach((vertex,i)=>{for(let k=0;k<attribute.itemSize;k++)values[i*attribute.itemSize+k]=attribute.array[vertex*attribute.itemSize+k];});
        attributes[name]=new T.BufferAttribute(values,attribute.itemSize);
      }
      output.push({...mesh,name:mesh.name+' / region '+part,sourceName:mesh.name,part,attributes,
        motion:part===18?'lef-left':part===19?'lef-right':mesh.motion});
    }
  }
  return output;
}
