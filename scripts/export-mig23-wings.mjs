// Original Tim Samedov model: CC BY 4.0. Export unmodified source triangles
// in the same normalized/ground-aligned aircraft metres as gameplay.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),T=await import(pathToFileURL(root+'/public/vendor/three.module.js'));
const {inspectMig23Glb,normalizeMig23,rigMig23Sweep}=await import(pathToFileURL(root+'/public/mig23mld-glb.js'));
const b=fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))||'public/assets/mig23mld/Mig-23.glb');if(createHash('sha256').update(b).digest('hex')!=='eb1d5b3ea7a370e157b89061ade52eaa4e7536ce927852124e40bde94679d4b8')throw Error('Original GLB changed; review wing source before regenerating');
const {json:j,bin}=inspectMig23Glb(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
function accessor(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],r=new DataView(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0));const data=[];for(let k=0;k<a.count;k++)for(let q=0;q<n;q++)data.push(r[{5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType]](k*(v.byteStride||n*size)+q*size,true));return data;}
const scene=new T.Group(),nodes=j.nodes.map(n=>{const g=new T.Group();g.name=n.name;if(n.translation)g.position.fromArray(n.translation);if(n.rotation)g.quaternion.fromArray(n.rotation);if(n.scale)g.scale.fromArray(n.scale);if(n.mesh!==undefined)for(const p of j.meshes[n.mesh].primitives){const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(accessor(p.attributes.POSITION),3));geom.setIndex(accessor(p.indices));const mesh=new T.Mesh(geom,new T.MeshBasicMaterial());mesh.userData.material=j.materials[p.material].name;g.add(mesh);}return g;});j.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>nodes[i].add(nodes[c])));for(const i of j.scenes[0].nodes)scene.add(nodes[i]);
const {root:aircraft}=normalizeMig23(scene);aircraft.updateWorldMatrix(true,true);const wheels=new T.Box3();for(const n of ['OBJ0109','OBJ0131'])wheels.expandByObject(aircraft.getObjectByName(n),true);aircraft.position.y+=-1.42-wheels.min.y;aircraft.updateWorldMatrix(true,true);


const sweep=rigMig23Sweep(scene,nodes);sweep(72);aircraft.updateWorldMatrix(true,true);
const triangles=process.argv.includes('--triangles');
console.log(triangles?'part,ax,ay,az,bx,by,bz,cx,cy,cz':'part,kind,x,y,z');
for(const [part,name] of [[1,'OBJ0257'],[2,'OBJ0264']]){
 const group=aircraft.getObjectByName(name).parent;
 const hinge=group.getWorldPosition(new T.Vector3());if(!triangles)console.log([part,1,...hinge.toArray()].join(','));
 group.traverseVisible(mesh=>{const g=mesh.geometry,p=g?.attributes.position;if(!p)return;const point=i=>new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray();if(triangles){for(let i=0;i<g.index.count;i+=3)console.log([part,...[0,1,2].flatMap(j=>point(g.index.getX(i+j)))].join(','));}else for(let i=0;i<p.count;i++)console.log([part,0,...point(i)].join(','));});
}
