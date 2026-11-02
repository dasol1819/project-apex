import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public'),load=n=>import(pathToFileURL(path.join(root,n)));
const T=await load('vendor/three.module.js'),{createAircraft}=await load('aircraft.js'),{roundExhaustPlume}=await load('round-exhaust-plume.js'),{disposeObject}=await load('aircraft-catalog.js'),{fleetSurfaceState}=await load('fleet-surface.js');
const {createWreckageFactory}=await load('wreckage-mesh.js');
let surfaces=0,movingChecks=0;
for(let id=0;id<13;id++){
 const model=createAircraft(id),before=[];let covered=0;
 model.group.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m?.userData.fleetSurface){
  const a=o.geometry.attributes.fleetPosition;assert.equal(a.count,o.geometry.attributes.position.count);assert.ok(a.array.every(Number.isFinite));covered++;surfaces++;
  before.push([a,crypto.createHash('sha256').update(Buffer.from(a.array.buffer)).digest('hex')]);
 }});
 assert.ok(covered>0,'all thirteen procedural aircraft receive actual surface mapping: '+id);
 model.update({gear:1,leftAileron:.3,rightAileron:-.2,leftTail:.2,rightTail:.2,leftRudder:.2,rightRudder:.2,afterburner:1,wingSweep:68,wingFold:1,time:2});
 for(const [a,hash]of before){assert.equal(crypto.createHash('sha256').update(Buffer.from(a.array.buffer)).digest('hex'),hash,'paint stays frozen when controls move');movingChecks++;}
 if([7,8,9].includes(id))model.group.traverse(o=>assert.notEqual(o.name,'round tapered afterburner volume','non-afterburning aircraft has no AB flame'));
 else if(id!==0){const plumes=[];model.group.traverse(o=>{if(o.name==='round tapered afterburner volume')plumes.push(o);});assert.equal(plumes.length,model.definition.engines,'one round plume per jet engine');
  model.update({afterburner:1,leftEngineFactor:0,rightEngineFactor:0});for(const p of plumes)assert.equal(p.visible,false,'failed engine does not produce AB flame');}
 const state=fleetSurfaceState(id);assert.equal(state.refs,1);
 const factory=createWreckageFactory(model),bounds=model.group.userData.damagePartBounds[1];
 const wreck=factory.create(1,4,bounds.center,bounds.half);
 wreck.traverse(o=>{if(!o.isMesh||!o.material.userData.fleetSurface)return;const a=o.geometry.attributes.fleetPosition;assert.ok(a,'fractured skin retains surface coordinates');assert.equal(a.count,o.geometry.attributes.position.count);assert.ok(a.array.every(Number.isFinite));});
 assert.equal(state.refs,2,'wreckage retains its shared texture');factory.release(wreck);assert.equal(state.refs,1);
 disposeObject(model.group);assert.equal(state.refs,0,'disposal releases the texture lease');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,`assets/fleet-surface/${id}/surface.json`)));
 assert.equal(manifest.size,4096);for(const [name,info]of Object.entries(manifest.files)){
  const bytes=fs.readFileSync(path.join(root,`assets/fleet-surface/${id}/`,name));assert.equal(bytes.length,info.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),info.sha256);
 }
}
const volume=roundExhaustPlume(.5,4),mesh=volume.root.children[0],a=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
assert.ok(mesh.geometry.index.count/3<=4000,'plume geometry budget');
for(let i=0;i<a.count;i++)assert.ok(a.getX(i)*n.getX(i)+a.getY(i)*n.getY(i)>-.001,'consistent outward envelope normals');
const ranges=new Map();for(let i=0;i<a.count;i++){const z=a.getZ(i);if(!ranges.has(z))ranges.set(z,[]);ranges.get(z).push(Math.hypot(a.getX(i),a.getY(i)));}
for(const radii of ranges.values())assert.ok(Math.max(...radii)-Math.min(...radii)<1.e-6,'every cross-section is circular, never crossed sheets');
assert.ok(Math.max(...ranges.get(4))<Math.max(...ranges.get(0))*.3,'plume tapers downstream');
console.log(JSON.stringify({result:'PASS',aircraft:13,surfaces,movingChecks,plumeTriangles:mesh.geometry.index.count/3}));
