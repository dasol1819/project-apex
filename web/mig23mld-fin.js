// Tim Samedov's CC BY 4.0 source: split only whole, disjoint fin triangles.
// Offline C++ topology selects the components; runtime retains every vertex
// attribute and the original triangle winding. No new skin/UVs are authored.
import * as T from './vendor/three.module.js';
import {FIN_PARTITION} from './mig23mld-fin-data.js';

function compactGeometry(source,indices){
 const remap=new Map(),vertices=[],mapped=[];
 for(const index of indices){
  if(!remap.has(index)){remap.set(index,vertices.length);vertices.push(index);}
  mapped.push(remap.get(index));
 }
 const geometry=new T.BufferGeometry(),attributes=new Map();
 for(const [name,attribute] of Object.entries(source.attributes)){
  if(attribute.isInterleavedBufferAttribute)throw Error('Unexpected interleaved MiG-23 fin source');
  if(!attributes.has(attribute)){
   const array=new attribute.array.constructor(vertices.length*attribute.itemSize);
   vertices.forEach((index,i)=>array.set(attribute.array.subarray(index*attribute.itemSize,(index+1)*attribute.itemSize),i*attribute.itemSize));
   const copy=new T.BufferAttribute(array,attribute.itemSize,attribute.normalized);
   copy.name=attribute.name;copy.setUsage(attribute.usage);attributes.set(attribute,copy);
  }
  geometry.setAttribute(name,attributes.get(attribute));
 }
 geometry.setIndex(mapped);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}

export function partitionMig23Fin(root){
 const fuselage=root.getObjectByName(FIN_PARTITION.node);
 if(!fuselage)throw Error('Missing MiG-23 fuselage for fin partition');
 const sourceMeshes=fuselage.children.slice(),fittings=FIN_PARTITION.attachments.map(name=>root.getObjectByName(name));
 if(fittings.some(node=>!node))throw Error('Missing MiG-23 fin fitting');
 // Validate all source indices before changing the instance. The shared decoded
 // source and sibling geometries are never changed or disposed here.
 const plans=FIN_PARTITION.primitives.map(plan=>{
  const mesh=sourceMeshes[plan.primitive],geometry=mesh?.geometry;
  if(!mesh?.isMesh||geometry.index?.count!==plan.indexCount||geometry.attributes.position.count!==plan.vertexCount||Object.keys(geometry.morphAttributes).length||geometry.groups.length)
   throw Error('MiG-23 fin topology differs from reviewed partition');
  const selected=new Set(plan.triangles),fin=[],skin=[];
  if(selected.size!==plan.triangles.length||plan.triangles.some(i=>!Number.isInteger(i)||i<0||i>=geometry.index.count/3))throw Error('Invalid MiG-23 fin triangle');
  for(let i=0;i<geometry.index.count;i++)(selected.has(Math.floor(i/3))?fin:skin).push(geometry.index.getX(i));
  return {mesh,geometry,fin:compactGeometry(geometry,fin),skin:compactGeometry(geometry,skin)};
 });
 const fin=new T.Group();fin.name='MiG-23MLD fixed fin';fuselage.add(fin);
 for(const plan of plans){
  const mesh=plan.mesh.clone(false);mesh.geometry=plan.fin;mesh.name='MiG-23MLD original fixed fin skin';
  fin.add(mesh);plan.mesh.geometry=plan.skin;
  // Only this instance owns the now unused original buffer (instanceSource).
  plan.geometry.dispose();
 }
 root.updateWorldMatrix(true,true);
 for(const fitting of fittings)fin.attach(fitting);
 return fin;
}
