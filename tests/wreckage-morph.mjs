import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public');
const T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const {createWreckageFactory}=await import(pathToFileURL(path.join(root,'wreckage-mesh.js')));
for(const relative of [true,false]){
 const g=new T.PlaneGeometry(2,2,1,1),p=g.attributes.position;
 const target=p.clone();for(let i=0;i<p.count;i++)target.setXYZ(i,relative?0:p.getX(i),relative?2:p.getY(i)+2,relative?0:p.getZ(i));
 g.morphAttributes.position=[target];g.morphTargetsRelative=relative;
 const mesh=new T.Mesh(g,new T.MeshStandardMaterial());mesh.morphTargetInfluences[0]=.5;
 const group=new T.Group();group.add(mesh);const aircraft={group,damageParts:[mesh],definition:{id:16}};
 const factory=createWreckageFactory(aircraft),whole=factory.create(0,0,[0,0,0],[1,1,1]);
 const snap=whole.children[0];assert.equal(snap.geometry,g);assert.equal(snap.morphTargetInfluences[0],.5,'snapshot the impact aperture');
 mesh.morphTargetInfluences[0]=0;assert.equal(snap.morphTargetInfluences[0],.5,'weights independent after live pose changes');
 assert.equal(snap.getVertexPosition(0,new T.Vector3()).y,p.getY(0)+1);
 mesh.morphTargetInfluences[0]=.5;const clipped=factory.create(0,4,[0,0,0],[0,2,2]);
 const skins=clipped.children.filter(m=>m.name!=='exposed fracture cross section');assert.ok(skins.length);
 const ys=skins.flatMap(m=>Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.geometry.attributes.position.getY(i)));
 assert.equal(Math.min(...ys),0,'clipped geometry includes impact morph');assert.equal(Math.max(...ys),2);
 let disposed=false;g.addEventListener('dispose',()=>disposed=true);factory.release(whole);assert.equal(disposed,false,'shared source not disposed');factory.release(clipped);
}
console.log(JSON.stringify({result:'PASS',relativeAndAbsoluteMorphs:true,snapshotIndependent:true,clippedImpactPose:true,sharedSourcePreserved:true}));
