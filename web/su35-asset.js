// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';

export function decodeSu35Asset(metadata,buffer){
  if(metadata.version!==3||!Array.isArray(metadata.meshes))throw new Error('Unsupported Su-35 model asset');
  return metadata.meshes.map(mesh=>{
    const attributes={};
    for(const [name,itemSize] of [['position',3],['normal',3],['uv',2]]){
      const a=mesh[name];
      if(!Number.isInteger(a?.offset)||!Number.isInteger(a?.count)||a.offset<0||a.count<0||a.offset%4||a.offset+a.count*4>buffer.byteLength||a.count%itemSize)throw new Error('Invalid Su-35 mesh buffer');
      attributes[name]=new T.BufferAttribute(new Float32Array(buffer,a.offset,a.count),itemSize);
    }
    if(attributes.position.count!==attributes.normal.count||attributes.position.count!==attributes.uv.count)throw new Error('Mismatched Su-35 mesh attributes');
    return {...mesh,attributes};
  });
}

export async function loadSu35Asset(onProgress=()=>{}){
  onProgress('곡면 모델을 불러오는 중…');
  const base=new URL('./assets/su35/',import.meta.url);
  const [metadataResponse,binaryResponse]=await Promise.all([fetch(new URL('airframe.json?v=3',base)),fetch(new URL((typeof DecompressionStream==='function'?'airframe.bin.gz':'airframe.bin')+'?v=3',base))]);
  if(!metadataResponse.ok||!binaryResponse.ok)throw new Error('Su-35 geometry download failed');
  const metadata=await metadataResponse.json();let buffer=await binaryResponse.arrayBuffer();
  const signature=new Uint8Array(buffer,0,2);if(signature[0]===31&&signature[1]===139)buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const meshes=decodeSu35Asset(metadata,buffer);
  onProgress('도장과 표면 디테일을 불러오는 중…');
  const loader=new T.TextureLoader();
  const [albedo,seat,ao]=await Promise.all(['albedo.png','seat.png','ao.png'].map(f=>loader.loadAsync(new URL(f+'?v=3',base).href)));
  albedo.colorSpace=seat.colorSpace=T.SRGBColorSpace;ao.colorSpace=T.NoColorSpace;ao.channel=0;
  for(const texture of [albedo,seat,ao])texture.anisotropy=8;
  return {meshes,textures:{albedo,seat,ao},metadata};
}
