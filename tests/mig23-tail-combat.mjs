import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';

const root=path.resolve(process.argv[2]??'public');
const {createFleetBridge}=await import(pathToFileURL(path.join(root,'fleet-bridge.js')));
const bytes=fs.readFileSync(process.env.APEX_TEST_WASM??path.join(root,'flight.wasm'));
const module=new WebAssembly.Module(bytes),expected=process.env.APEX_EXPECT_SOURCE_BOUNDS!=='0';
const make=type=>{
 const s=new WebAssembly.Instance(module,{env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}}).exports;
 s.set_aircraft_type(type);s.reset_spawn(1);return s;
};
const read=(s,name,n)=>new Float64Array(s.memory.buffer,s[name](),n);
const results=[];
// Static firing fixtures isolate the native projectile/shape/fleet-delivery
// path. This does not certify AI aim, manoeuvring combat or aircraft accuracy.
for(const [part,x,y,z,yaw] of [
 [3,-100,5000.2,5.34,-Math.PI/2],
 [4,100,5000.2,8.32,Math.PI/2],
 [20,100,5001.2,9,Math.PI/2]
]){
 const shooter=make(0),target=make(16),hits=[];
 target.debug_set_state(0,5000,0,0,0,0,0,0,0,1);target.set_invincible(0);
 shooter.set_trigger(1);
 const health=()=>read(target,'get_systems',256)[16+part*8],before=health();
 const bridge=createFleetBridge([
  {id:1,team:0,active:true,sim:shooter},
  {id:101,team:1,active:true,sim:target,scriptedStep(){}}
 ],undefined,{onEvents(actor){
  if(actor.id!==1)return;const h=read(shooter,'get_fleet_hits',450);
  for(let i=0;i<h[0];i++)hits.push(Array.from(h.slice(2+i*7,9+i*7)));
 }});
 let ticks=0;
 for(;ticks<180&&!hits.length;ticks++){
  shooter.debug_set_state(x,y,z,0,0,0,0,Math.sin(yaw/2),0,Math.cos(yaw/2));
  shooter.set_controls(0,0,0,0,0,0,0,0);bridge.step(1/120);
 }
 const result={expectedPart:part,shotOrigin:[x,y,z],actualPart:hits[0]?.[1]??null,
  contact:hits[0]?.slice(3,6)??null,healthBefore:before,healthAfter:health(),ticks};
 results.push(result);
 if(expected){
  assert.equal(result.actualPart,part,'projectile must collide with the source-fitted native tail component');
  assert.ok(result.healthAfter<before,'fleet delivery must inflict native damage on that component');
 }
}
console.log(JSON.stringify({result:'PASS',expectSourceBounds:expected,wasmSha256:crypto.createHash('sha256').update(bytes).digest('hex'),fixtures:results}));
