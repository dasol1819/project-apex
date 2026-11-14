import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]??'public');
const imports={env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}};
const make=file=>new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file)),imports).exports;
const sim=make(path.join(root,'flight.wasm'));
const source=JSON.parse(fs.readFileSync('assets/mig23mld/wing-support-hulls.json'));
const vertices=new Map([[1,[]],[2,[]]]);
for(const row of fs.readFileSync('docs/aircraft-review/mig23mld/wing-source-vertices.csv','utf8').trim().split('\n').slice(1)){
 const [part,kind,...point]=row.split(',').map(Number);if(kind===0)vertices.get(part).push(point);
}
const read=(s,name,n)=>new Float64Array(s.memory.buffer,s[name](),n);
function wreck(s,part){s.damage_part(part,1);s.step(1/120);const data=read(s,'get_wreckage',2+64*40);const bodies=[];for(let i=0;i<data[0];i++){const d=Array.from(data.slice(2+i*40,2+(i+1)*40));bodies.push({part:d[1],variant:d[2],pivot:d.slice(22,25),half:d.slice(25,28)});}return bodies;}
let maxOverflow=-Infinity,checkedVertices=0;
const cases=[];
// Normal native hydraulic commands reach every integer sweep and several
// fractional angles; no test-only state/memory patch selects the profile.
for(const target of [...Array.from({length:57},(_,i)=>16+i),16.37,27.125,43.5,58.91,71.99])for(const part of [1,2]){
 sim.set_aircraft_type(16);sim.reset_spawn(2);sim.set_wing_sweep(target);sim.set_controls(0,0,0,.75,0,0,0,1);
 let ticks=0;for(;ticks<6000;ticks++){
  sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);sim.step(1/120);
  if(Math.abs(read(sim,'get_aircraft_configuration',8)[1]-target)<1e-6)break;
 }
 assert(ticks<6000,'native wing servo reaches '+target);
 const angle=read(sim,'get_aircraft_configuration',8)[1];
 const body=wreck(sim,part).find(b=>b.part===part);assert(body,'native wing body');
 const w=source.parts[part],theta=w.sign*(angle-72)*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta);
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(const p of vertices.get(part)){
  const dx=p[0]-w.hinge[0],dz=p[2]-w.hinge[2],v=[dx*c+dz*s+w.hinge[0],p[1],dz*c-dx*s+w.hinge[2]];
  for(let k=0;k<3;k++){low[k]=Math.min(low[k],v[k]);high[k]=Math.max(high[k],v[k]);maxOverflow=Math.max(maxOverflow,Math.abs(v[k]-body.pivot[k])-body.half[k]);}
  checkedVertices++;
 }
 for(let k=0;k<3;k++){
  assert(Math.abs(body.pivot[k]-(low[k]+high[k])/2)<1e-9,'live source wing centre '+part+' angle '+angle);
  assert(Math.abs(body.half[k]-(high[k]-low[k])/2-source.paddingMetres)<1e-9,'tight live source wing box '+part+' angle '+angle);
 }
 if([16,44,72,43.5].includes(target))cases.push({part,angle,pivot:body.pivot,half:body.half});
}
assert(maxOverflow<0,'all actual source vertices enclosed');
let otherNativeFixtures=0;
if(process.env.APEX_BASELINE_WASM){
 const before=make(process.env.APEX_BASELINE_WASM);
 for(let type=0;type<17;type++)for(let part=0;part<30;part++){
  for(const s of [before,sim]){s.set_aircraft_type(type);s.reset_spawn(1);}
  const keep=b=>type!==16||![1,2].includes(b.part);
  assert.deepEqual(wreck(sim,part).filter(keep),wreck(before,part).filter(keep),'other native body vectors type '+type+' part '+part);
  otherNativeFixtures++;
 }
}
console.log(JSON.stringify({result:'PASS',angles:62,checkedVertices,maxOverflow,otherNativeFixtures,cases,scope:'Original visible moving-wing AABB at live native sweep, 2 mm numeric pad; conservative box, not measured mass centre or triangle-exact collision'}));
