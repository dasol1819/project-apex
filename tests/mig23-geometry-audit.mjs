import fs from 'node:fs';
const file=process.argv[2]??'web/assets/mig23mld/Mig-23.glb';
const b=fs.readFileSync(file);
if(b.toString('ascii',0,4)!=='glTF')throw Error('Missing GLB');
const length=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+length));
const parents=new Map();
j.nodes.forEach((n,i)=>(n.children??[]).forEach(child=>parents.set(child,i)));
console.log('MODEL',JSON.stringify({nodes:j.nodes.length,meshes:j.meshes.length,materials:j.materials.length,scenes:j.scenes,scene:j.scene}));
for(let i=0;i<j.nodes.length;i++){
 const n=j.nodes[i],m=n.mesh===undefined?null:j.meshes[n.mesh];
 let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const p of m?.primitives??[]){
  const a=j.accessors[p.attributes.POSITION];
  if(a?.min&&a?.max)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],a.min[k]);hi[k]=Math.max(hi[k],a.max[k]);}
 }
 const bounds=m&&lo[0]!==Infinity?{lo:lo.map(x=>+x.toFixed(4)),hi:hi.map(x=>+x.toFixed(4))}:null;
 const f=x=>x?.map(v=>+v.toFixed(5));
 console.log('NODE',JSON.stringify({i,name:n.name??'',parent:parents.get(i)??null,t:f(n.translation),r:f(n.rotation),s:f(n.scale),matrix:f(n.matrix),mesh:n.mesh??null,primitives:m?.primitives?.length??0,materials:m?.primitives?.map(p=>j.materials[p.material]?.name??'?'),bounds}));
}
