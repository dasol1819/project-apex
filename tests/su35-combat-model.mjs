import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public'),load=name=>import(pathToFileURL(path.join(root,name)));
const T=await load('vendor/three.module.js'),{decodeSu35Asset}=await load('su35-asset.js'),{createSu35CombatAircraft}=await load('su35-combat-model.js'),{su35StructuralMeshes}=await load('su35-structure.js'),{createWreckageFactory}=await load('wreckage-mesh.js');
const metadata=JSON.parse(fs.readFileSync(path.join(root,'assets/su35/airframe.json'))),b=fs.readFileSync(path.join(root,'assets/su35/airframe.bin'));
const asset={metadata,meshes:decodeSu35Asset(metadata,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
assert.equal(su35StructuralMeshes(asset).reduce((n,m)=>n+m.attributes.position.count,0),asset.meshes.reduce((n,m)=>n+m.attributes.position.count,0),'partition preserves every source triangle');
const model=createSu35CombatAircraft({asset}),shapes=JSON.parse(fs.readFileSync('assets/su35-combat/shapes.json'));
assert.equal(model.definition.id,13);assert.equal(model.group.userData.previewOnly,false);
for(const part of shapes.parts){if(part.id===9)continue;const actual=model.group.userData.damagePartBounds[part.id];for(let axis=0;axis<3;axis++){assert.ok(Math.abs(actual.center[axis]-part.pivot[axis])<1e-6,'collision pivot '+part.id);assert.ok(Math.abs(Math.max(actual.half[axis],.055)-part.half[axis])<1e-6,'collision half extent '+part.id);}}
const rf=Array(32).fill(0);for(let i=0;i<6;i++)rf[16+i]=1;const ir=Array(40).fill(0);ir[12]=ir[13]=1;
const bomb=Array(40).fill(0);bomb[22]=38;const health=Array(30).fill(1),enabled=Array(30).fill(1);
model.update({gear:0,health,enabled,missiles:ir,amraam:rf,bombs:bomb,afterburner:1,leftNozzle:.20,rightNozzle:-.15});
const station=model.group.getObjectByName('Su-35S rf station 1');assert.equal(station.parent,model.damageParts[1]);
assert.ok(station.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(-4.4,-.02,1.85))<1e-6,'store and native launch coordinates agree');
assert.ok(model.group.getObjectByName('AL-41F1S afterburner plume').visible,'afterburner plume linked to native engine state');
health[1]=0;model.update({gear:0,health,enabled,missiles:ir,amraam:rf,bombs:bomb});assert.equal(model.damageParts[1].visible,false);assert.equal(station.visible,false);assert.equal(model.damageParts[12].visible,false,'outer wing follows detached root');
health[1]=1;model.update({gear:1,health,enabled,missiles:ir,amraam:rf,bombs:bomb});
const factory=createWreckageFactory(model);let pieces=0;
for(const [id,variant]of [[1,0],[5,4],[0,1]]){
 const bounds=model.group.userData.damagePartBounds[id],wreck=factory.create(id,variant,bounds.center,bounds.half);
 wreck.traverse(node=>{if(!node.isMesh)return;pieces++;for(const attr of Object.values(node.geometry.attributes))assert.ok(Array.from(attr.array).every(Number.isFinite));if(node.geometry.attributes.liveryPosition)assert.equal(node.geometry.attributes.liveryPosition.count,node.geometry.attributes.position.count);});factory.release(wreck);
}
console.log(JSON.stringify({result:'PASS',collisionRegions:30,preservedTriangles:true,externalStoreCoordinates:true,damageInheritance:true,wreckageMeshes:pieces}));
