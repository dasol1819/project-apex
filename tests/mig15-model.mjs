import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public'),load=n=>import(pathToFileURL(path.join(root,n))),T=await load('vendor/three.module.js'),{createAircraft}=await load('aircraft.js'),{AIRCRAFT_TREE}=await load('aircraft-tree-data.js'),{AIRCRAFT,partInstalled}=await load('aircraft-catalog.js');
const m=createAircraft(15),v=new T.Vector3(),bounds=new T.Box3();m.update({gear:1});m.group.updateMatrixWorld(true);
let triangles=0,meshes=0,textureBytes=0;const materials=new Set(),geometries=new Set();
function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
m.group.traverse(o=>{if(!o.isMesh||!visible(o)||o.userData.visualEffect)return;meshes++;materials.add(o.material);geometries.add(o.geometry);for(const a of Object.values(o.geometry.attributes))assert.ok(Array.from(a.array).every(Number.isFinite),o.name+' finite attributes');const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)bounds.expandByPoint(o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld));triangles+=(o.geometry.index?.count||p.count)/3;if(o.material.userData.airframeSurface){assert.ok(o.geometry.attributes.skinPosition,'frozen surface coordinates');const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};o.material.onBeforeCompile(shader);assert.ok(shader.fragmentShader.includes('roughnessFactor=clamp'));assert.ok(shader.fragmentShader.includes('migBump'));}});
const size=bounds.getSize(new T.Vector3());assert.ok(Math.abs(size.x-10.085)<.08,'span including nav lights');assert.ok(Math.abs(size.z-10.10)<.15,'length including muzzle protrusions');assert.ok(Math.abs(size.y-3.70)<.02,'height on native contact plane');assert.ok(triangles<70000,'mobile triangle budget');
const entry=AIRCRAFT_TREE.find(a=>a.id==='ru-mig15-bis');assert.ok(entry.implemented&&entry.simId===15);assert.equal(AIRCRAFT.length,16);assert.ok(AIRCRAFT[15].noAfterburner&&AIRCRAFT[15].gunOnly);
for(const id of[6,8,18,19,21,23])assert.equal(partInstalled(15,id),false,'absent hardware '+id);
// The single nose intake must be open on BOTH sides of the splitter; the first
// surface is the recessed duct/back wall, never an intake face/cap.
m.update({gear:0});m.group.updateMatrixWorld(true);let inletRays=0;
for(const x of[-.30,-.18,.18,.30])for(const y of[-.15,0,.15]){const hits=new T.Raycaster(new T.Vector3(x,y,-5.25),new T.Vector3(0,0,1),0,3.5).intersectObject(m.group,true).filter(h=>visible(h.object)&&!h.object.userData.visualEffect);assert.ok(hits.length,'duct interior exists');assert.ok(hits[0].distance>1.0,'recessed inlet ray '+x+','+y+' distance '+hits[0]?.distance);inletRays++;}
const controls=m.damageParts.flatMap(p=>p.children).filter(p=>p.name.includes('physical hinge')),neutral=controls.map(p=>p.quaternion.clone()),skins=[];
m.group.traverse(o=>{if(o.isMesh&&o.geometry.attributes.skinPosition)skins.push([o.geometry,Array.from(o.geometry.attributes.skinPosition.array)]);});
m.update({gear:1,leftFlap:.4,rightFlap:.4,leftAileron:.2,rightAileron:-.2,leftTail:.15,rightTail:.15,leftRudder:.25,airbrake:1,canopy:1,afterburner:1,engine:1,time:2});
assert.ok(controls.some((p,i)=>p.quaternion.angleTo(neutral[i])>.1),'animated flight controls');for(const[g,a]of skins)assert.deepEqual(Array.from(g.attributes.skinPosition.array),a,'paint follows moving surfaces');
assert.equal(m.exhaustFrames.length,1,'single engine');assert.ok(!m.group.getObjectByName('18 articulated convergent-divergent nozzle feathers'),'fixed exit lacks AB nozzle animation');
const health=Array(30).fill(1);health[1]=0;m.update({health,gear:0});assert.equal(m.damageParts[1].visible,false);for(const id of[12,14,16])assert.equal(m.damageParts[id].visible,false,'damage descendant '+id);
health.fill(1);health[29]=0;m.update({health});for(const id of[3,4,5,7,20,22])assert.equal(m.damageParts[id].visible,false,'aft breakup descendant '+id);
m.update({gear:1});assert.equal(m.damageParts[1].visible,true,'model respawn restores');
let attributeBytes=0;for(const g of geometries){for(const a of Object.values(g.attributes))attributeBytes+=a.array.byteLength;attributeBytes+=g.index?.array.byteLength||0;}
const report={result:'PASS',dimensions:size.toArray(),triangles,meshes,materials:materials.size,geometryBytes:attributeBytes,gpuTextureBytes:textureBytes,inletRays,frozenSurfaceCoordinates:true,flightControlAnimation:true,damageInheritance:true,engines:1};
fs.mkdirSync('docs/reviews/mig15bis',{recursive:true});fs.writeFileSync('docs/reviews/mig15bis/model-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
