// MiG-23MLD Blender glTF 2.0 GLB importer; no external CDN dependencies.
// Original aircraft: Tim Samedov (citizensnip), CC BY 4.0.
import * as T from './vendor/three.module.js';

const TYPES={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const COMPONENTS={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
export function inspectMig23Glb(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<28)throw Error('GLB 파일 오류');
 const d=new DataView(buffer);
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength)throw Error('GLB 2.0 헤더 오류');
 let at=12,parts=[];
 while(at<buffer.byteLength){
  if(at+8>buffer.byteLength)throw Error('GLB 청크 헤더가 잘렸습니다.');
  const size=d.getUint32(at,true),kind=d.getUint32(at+4,true);at+=8;
  if(at+size>buffer.byteLength)throw Error('GLB 청크 길이가 잘못되었습니다.');
  parts.push({size,kind,at});at+=size;
 }
 if(parts[0]?.kind!==0x4e4f534a||parts[1]?.kind!==0x004e4942)throw Error('GLB JSON/BIN 청크 누락');
 const j=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,parts[0].at,parts[0].size)).trim());
 if(j.asset?.version!=='2.0'||j.buffers?.length!==1||j.extensionsRequired?.length)throw Error('지원하지 않는 GLB 기능');
 if(j.buffers[0].byteLength>parts[1].size)throw Error('잘못된 BIN 길이');
 return {json:j,bin:new Uint8Array(buffer,parts[1].at,parts[1].size)};
}
function attribute(j,bin,index){
 const a=j.accessors[index],v=j.bufferViews[a.bufferView],Type=TYPES[a.componentType],n=COMPONENTS[a.type];
 if(!v||!Type||!n||a.sparse)throw Error('지원하지 않는 메시 접근자');
 const stride=v.byteStride??n*Type.BYTES_PER_ELEMENT,offset=(v.byteOffset??0)+(a.byteOffset??0);
 if(offset+stride*(a.count-1)+n*Type.BYTES_PER_ELEMENT>bin.byteLength)throw Error('메시 범위 오류');
 const data=new Type(a.count*n),r=new DataView(bin.buffer,bin.byteOffset+offset);
 const method=a.componentType===5126?'getFloat32':a.componentType===5125?'getUint32':a.componentType===5123?'getUint16':'getUint8';
 for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)data[i*n+k]=r[method](i*stride+k*Type.BYTES_PER_ELEMENT,true);
 return new T.BufferAttribute(data,n,!!a.normalized);
}
export async function parseMig23Glb(buffer){
 const {json:j,bin}=inspectMig23Glb(buffer),urls=[];
 try{
  const images=await Promise.all((j.images??[]).map(async im=>{
   const v=j.bufferViews[im.bufferView],start=v?.byteOffset??0;
   if(!v||start+v.byteLength>bin.byteLength)throw Error('이미지 영역 오류');
   const url=URL.createObjectURL(new Blob([bin.slice(start,start+v.byteLength)],{type:im.mimeType??'image/png'}));urls.push(url);
   return new T.TextureLoader().loadAsync(url);
  }));
  // glTF textures may share an image but require different color spaces:
  // albedo/emission are sRGB, while normal/occlusion/metal-roughness are linear.
  const textures=(j.textures??[]).map(t=>{
   const image=images[t.source];if(!image)throw Error('텍스처 참조 오류');
   const sampler=j.samplers?.[t.sampler]??{};
   const wrap=v=>v===33071?T.ClampToEdgeWrapping:v===33648?T.MirroredRepeatWrapping:T.RepeatWrapping;
   const filter=v=>({
    9728:T.NearestFilter,9729:T.LinearFilter,9984:T.NearestMipmapNearestFilter,
    9985:T.LinearMipmapNearestFilter,9986:T.NearestMipmapLinearFilter,9987:T.LinearMipmapLinearFilter
   })[v];
   const source=image.clone();source.flipY=false;source.anisotropy=4;
   source.wrapS=wrap(sampler.wrapS);source.wrapT=wrap(sampler.wrapT);
   if(filter(sampler.magFilter))source.magFilter=filter(sampler.magFilter);
   if(filter(sampler.minFilter))source.minFilter=filter(sampler.minFilter);
   source.needsUpdate=true;
   return source;
  });
  const textureVariants=new Map();
  function texture(info,color=false){
   if(info===undefined)return null;
   const id=info.index;
   if(!Number.isInteger(id)||!textures[id])throw Error('잘못된 텍스처 인덱스');
   if((info.texCoord??0)!==0)throw Error('TEXCOORD_1 UV는 아직 지원하지 않습니다');
   const key=id+':'+(color?'srgb':'linear');
   if(!textureVariants.has(key)){
    const t=textures[id].clone();
    t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
    t.needsUpdate=true;
    textureVariants.set(key,t);
   }
   return textureVariants.get(key);
  }
  const mats=(j.materials??[]).map(m=>{
   const p=m.pbrMetallicRoughness??{},c=p.baseColorFactor??[1,1,1,1];
   const orm=texture(p.metallicRoughnessTexture),em=m.emissiveFactor??[0,0,0],mode=m.alphaMode??'OPAQUE';
   return new T.MeshStandardMaterial({name:m.name??'MiG-23 material',
    color:new T.Color().setRGB(c[0],c[1],c[2]),map:texture(p.baseColorTexture,true),
    metalness:p.metallicFactor??1,roughness:p.roughnessFactor??1,
    metalnessMap:orm,roughnessMap:orm,aoMap:texture(m.occlusionTexture),
    aoMapIntensity:m.occlusionTexture?.strength??1,
    normalMap:texture(m.normalTexture),normalScale:new T.Vector2(m.normalTexture?.scale??1,m.normalTexture?.scale??1),
    emissive:new T.Color().setRGB(...em),emissiveMap:texture(m.emissiveTexture,true),
    side:m.doubleSided?T.DoubleSide:T.FrontSide,transparent:mode==='BLEND',
    opacity:mode==='OPAQUE'?1:c[3],alphaTest:mode==='MASK'?(m.alphaCutoff??.5):0,depthWrite:mode!=='BLEND'});
  });
  const geometries=(j.meshes??[]).map(m=>m.primitives.map(p=>{
   if((p.mode??4)!==4)throw Error('삼각형이 아닌 메시');
   const g=new T.BufferGeometry();
   for(const [src,dst] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])
    if(p.attributes[src]!==undefined)g.setAttribute(dst,attribute(j,bin,p.attributes[src]));
   if(p.indices!==undefined)g.setIndex(attribute(j,bin,p.indices));
   if(!g.getAttribute('normal'))g.computeVertexNormals();
   // Three.js MeshStandardMaterial's aoMap expects uv2 even when glTF reuses TEXCOORD_0.
   if(g.getAttribute('uv')&&!g.getAttribute('uv2'))g.setAttribute('uv2',g.getAttribute('uv'));
   return {g,mat:mats[p.material]??new T.MeshStandardMaterial({color:0x929a96})};
  }));
  const nodes=(j.nodes??[]).map((n,i)=>{
   const g=new T.Group();g.name=n.name??'node-'+i;
   if(n.matrix){g.matrix.fromArray(n.matrix);g.matrix.decompose(g.position,g.quaternion,g.scale);}
   else{if(n.translation)g.position.fromArray(n.translation);if(n.rotation)g.quaternion.fromArray(n.rotation);if(n.scale)g.scale.fromArray(n.scale);}
   if(n.mesh!==undefined)for(const {g:geometry,mat} of geometries[n.mesh]){
    const mesh=new T.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);
   }
   return g;
  });
  j.nodes.forEach((n,i)=>(n.children??[]).forEach(id=>nodes[i].add(nodes[id])));
  const scene=new T.Group();scene.name='MiG-23MLD GLB source';
  for(const id of j.scenes?.[j.scene??0]?.nodes??[])scene.add(nodes[id]);
  return {scene,nodes,metadata:{meshes:j.meshes.length,primitives:geometries.reduce((n,a)=>n+a.length,0),nodes:nodes.length}};
 }finally{for(const u of urls)URL.revokeObjectURL(u);}
}
export function normalizeMig23(scene){
 const box=new T.Box3().setFromObject(scene),size=box.getSize(new T.Vector3());
 if(!Number.isFinite(size.z)||size.z<=0)throw Error('비정상 기체 크기');
 scene.position.sub(box.getCenter(new T.Vector3()));
 const root=new T.Group();root.name='MiG-23MLD / 16.7 m';root.add(scene);
 root.rotation.y=Math.PI;root.scale.setScalar(16.7/size.z);
 return {root,originalLength:size.z};
}
// Keep source-mesh auxiliaries on their authored wing: OBJ0277 is the
// one-sided lower wing skin/fairing; OBJ0100 is the tiny port-tip duplicate
// adjacent to OBJ0265. Without these registrations both stay behind as the
// 16-72 degree swing wing moves, showing detached floating geometry.
export function rigMig23Sweep(scene,nodes){
 const parts=[
  {pivot:[-3.772,.55,-1.141],sign:1,names:['OBJ0256','OBJ0257','OBJ0258','OBJ0259','OBJ0260','OBJ0261','OBJ0262','OBJ0270','OBJ0272','OBJ0273','OBJ0277']},
  {pivot:[-4.531,.55,-1.141],sign:-1,names:['OBJ0263','OBJ0264','OBJ0265','OBJ0266','OBJ0267','OBJ0268','OBJ0269','OBJ0271','OBJ0274','OBJ0275','OBJ0100']}
 ];
 const groups=parts.map(d=>{
  const pivot=new T.Group();pivot.position.set(...d.pivot);scene.add(pivot);
  for(const n of nodes)if(d.names.includes(n.name)&&n.parent===scene){n.position.sub(pivot.position);pivot.add(n);}
  return {pivot,sign:d.sign};
 });
 return degrees=>{
  const angle=T.MathUtils.degToRad(Math.max(16,Math.min(72,Number(degrees)||72))-72);
  for(const {pivot,sign} of groups)pivot.rotation.y=sign*angle;
 };
}
