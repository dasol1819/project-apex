import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(process.argv[2]??'public');
const T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const {createPartEmitter}=await import(pathToFileURL(path.join(root,'part-emitter.js')));

// The same world-space surface, represented once with node scale and once
// with that scale baked into the vertices, must produce equivalent emitters.
for(const ancestor of [false,true])for(const scales of [[4,4,4],[.5,2,4]]){
 const parentA=new T.Group(),parentB=new T.Group(),a=new T.Group(),b=new T.Group();
 parentA.position.set(13,50,-27);parentB.position.copy(parentA.position);
 parentA.rotation.set(.15,.4,-.2);parentB.rotation.copy(parentA.rotation);
 parentA.add(a);parentB.add(b);
 if(ancestor)parentA.scale.fromArray(scales);else a.scale.fromArray(scales);
 const ga=new T.BoxGeometry(.5,.2,1),gb=ga.clone();gb.scale(...scales);
 a.add(new T.Mesh(ga,new T.MeshStandardMaterial()));b.add(new T.Mesh(gb,new T.MeshStandardMaterial()));
 const ea=createPartEmitter(a),eb=createPartEmitter(b);
 assert.ok(Math.abs(ea.radius-eb.radius)<1e-10,JSON.stringify({ancestor,scales,scaledRadius:ea.radius,bakedRadius:eb.radius}));
 const pointA=new T.Vector3(),pointB=new T.Vector3();
 for(let i=0;i<6;i++){
  assert.ok(ea.sample(i,pointA)&&eb.sample(i,pointB));
  assert.ok(pointA.distanceTo(pointB)<1e-6,'equivalent surface anchors must stay in world metres');
 }
 ea.dispose();eb.dispose();ga.dispose();gb.dispose();
}
console.log(JSON.stringify({result:'PASS',equivalentTransforms:4,surfaceSamples:24}));
