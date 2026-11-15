import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]??'public');
const T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const profile=JSON.parse(fs.readFileSync('assets/mig23mld/flap-source-shapes.json'));
const points=new Map([[16,[]],[17,[]]]);
for(const row of fs.readFileSync('docs/aircraft-review/mig23mld/flap-source-vertices.csv','utf8').trim().split('\n').slice(1)){
 const [part,kind,,...p]=row.split(',');if(+kind===1)points.get(+part).push(new T.Vector3(...p.map(Number)));
}
const make=file=>new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file)),{env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}}).exports;
const s=make(process.env.APEX_TEST_WASM??path.join(root,'flight.wasm')),read=(s,name,n)=>new Float64Array(s.memory.buffer,s[name](),n);
function bodies(s,part){s.damage_part(part,1);s.step(1/120);const data=read(s,'get_wreckage',2+64*40),out=[];for(let i=0;i<data[0];i++){const d=Array.from(data.slice(2+i*40,42+i*40));out.push({part:d[1],variant:d[2],pivot:d.slice(22,25),half:d.slice(25,28)});}return out;}
let observations=0,maxOverflow=-Infinity;const poses=[];
for(const sweep of [...Array.from({length:57},(_,i)=>16+i),16.37,27.125,43.5,58.91,71.99])for(const part of [16,17]){
 s.set_aircraft_type(16);s.reset_spawn(2);s.set_wing_sweep(sweep);s.set_controls(0,0,0,.75,0,0,0,1);
 let tick=0;for(;tick<6000;tick++){s.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);s.step(1/120);if(Math.abs(read(s,'get_aircraft_configuration',8)[1]-sweep)<1e-6)break;}assert(tick<6000);
 const actualSweep=read(s,'get_aircraft_configuration',8)[1],p=profile.parts[part],body=bodies(s,part).find(b=>b.part===part);assert(body);
 const pin=new T.Vector3(...p.hingePoint),axis=new T.Vector3(...p.hingeAxis),wing=new T.Vector3(...p.hinge);
 const yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.sign*(actualSweep-72)*Math.PI/180);
 for(let step=0;step<=100;step++){
  const q=new T.Quaternion().setFromAxisAngle(axis,p.flapSign*step*.25*Math.PI/180);
  for(const point of points.get(part)){const v=point.clone().sub(pin).applyQuaternion(q).add(pin).sub(wing).applyQuaternion(yaw).add(wing).toArray();for(let k=0;k<3;k++)maxOverflow=Math.max(maxOverflow,Math.abs(v[k]-body.pivot[k])-body.half[k]);observations++;}
 }
 if([16,44,72].includes(sweep))poses.push({part,sweep:actualSweep,pivot:body.pivot,half:body.half});
}
if(process.env.APEX_EXPECT_SOURCE_BOUNDS==='0')assert(maxOverflow>.1,'published baseline profile misses source flap vertices');
else assert(maxOverflow<-.0018,'all continuous-arc samples fit with remaining numeric margin');
// Existing native gear-linked game flap channels, not a new aircraft controller.
s.set_aircraft_type(16);s.reset_spawn(2);s.set_controls(0,0,0,.75,1,0,0,1);
for(let i=0;i<1200;i++){s.debug_set_state(0,5000,0,0,0,-90,0,0,0,1);s.step(1/120);}
const deployed=Array.from(read(s,'get_state',104).slice(51,53));assert(deployed.every(a=>Math.abs(a-25*Math.PI/180)<1e-6));
s.damage_part(16,1);s.step(1/120);const frozen=read(s,'get_state',104)[51];s.set_controls(0,0,0,.75,0,0,0,1);
for(let i=0;i<1200;i++){s.debug_set_state(0,5000,0,0,0,-90,0,0,0,1);s.step(1/120);}
const after=Array.from(read(s,'get_state',104).slice(51,53));assert.equal(after[0],frozen);assert(Math.abs(after[1])<1e-6);
let unchangedFixtures=0;
if(process.env.APEX_BASELINE_WASM){const baseline=make(process.env.APEX_BASELINE_WASM);
 for(let type=0;type<17;type++)for(let part=0;part<30;part++){
  for(const sim of [baseline,s]){sim.set_aircraft_type(type);sim.reset_spawn(1);}
  const keep=b=>type!==16||![16,17].includes(b.part);assert.deepEqual(bodies(s,part).filter(keep),bodies(baseline,part).filter(keep));unchangedFixtures++;
 }
}
console.log(JSON.stringify({result:'PASS',sweeps:62,flapAnglesPerSweep:101,observations,maxOverflow,unchangedFixtures,deployedNativeRadians:deployed,disabledNativeRadians:after,poses,scope:'Conservative authored flap0..25deg game-actuator envelope at actual wing sweep; not surveyed MLD limits, mass centre, triangle collision or hardware FPS'}));
