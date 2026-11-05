// Read the actual moving-mesh cut edge: its centreline must stay on the
// fixed hinge while the control rotates. A rotation alone is insufficient.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public');
const T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const {createAircraft}=await import(pathToFileURL(path.join(root,'aircraft.js')));
const m=createAircraft(15);m.update({gear:1});m.group.updateMatrixWorld(true);
const records=[];
for(const field of ['leftFlap','rightFlap','leftAileron','rightAileron']){
 const h=m.group.getObjectByName(field+' physical hinge');assert.ok(h,field);
 const samples=[];
 if(field.includes('Aileron')){let paint=0;h.traverse(o=>{if(o.isMesh&&['Soviet red insignia','insignia border'].includes(o.material.name))paint++;});assert.ok(paint>=2,'Aileron owns both border and red paint crossing its cut');}
 h.traverse(o=>{if(!o.isMesh||['Soviet red insignia','insignia border'].includes(o.material.name))return;const a=o.geometry.attributes.position;
  for(let i=0;i<a.count;i++){const local=new T.Vector3().fromBufferAttribute(a,i),world=local.clone().applyMatrix4(o.matrixWorld);samples.push({o,local,world});}});
 const xs=samples.map(p=>p.world.x),ends=[Math.min(...xs),Math.max(...xs)];
 for(const x of ends){const row=samples.filter(p=>Math.abs(p.world.x-x)<1e-5),z=Math.min(...row.map(p=>p.world.z)),edge=row.filter(p=>Math.abs(p.world.z-z)<1e-5);
  assert.ok(edge.length>=2,field+' upper/lower edge vertices');
  const centre=points=>points.reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(1/points.length);
  const neutral=centre(edge.map(p=>p.world));records.push({field,edge,neutral,centre});
 }
}
const measurements=[];
for(const angle of [-.4,.4]){
 m.update({gear:1,leftFlap:angle,rightFlap:angle,leftAileron:angle,rightAileron:angle});m.group.updateMatrixWorld(true);
 for(const r of records){const moved=r.centre(r.edge.map(p=>p.local.clone().applyMatrix4(p.o.matrixWorld))),drift=moved.distanceTo(r.neutral);measurements.push({field:r.field,span:r.neutral.x,angle,driftMetres:drift});}
}
const anhedralDegrees=[];
for(const field of ['leftFlap','rightFlap','leftAileron','rightAileron']){
 const [a,b]=records.filter(r=>r.field===field).map(r=>r.neutral);
 const angle=Math.atan(Math.abs((b.y-a.y)/(b.x-a.x)))*180/Math.PI;
 anhedralDegrees.push({field,degrees:angle});assert.ok(Math.abs(angle-2)<.001,'Two-degree anhedral measured on mesh cut edges');
}
const maxDrift=Math.max(...measurements.map(p=>p.driftMetres));
const report={result:maxDrift<1e-5?'PASS':'FAIL',maxHingeDriftMetres:maxDrift,anhedralDegrees,measurements};
if(process.env.APEX_HINGE_REPORT)fs.writeFileSync(process.env.APEX_HINGE_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));assert.ok(maxDrift<1e-5,'Control cut-edge centreline separates from fixed wing under deflection');
