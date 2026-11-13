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
 [5,100,5002.55,8.7,Math.PI/2]
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
  assert.equal(result.actualPart,part,'projectile must collide with the source-fitted native fixed fin');
  assert.ok(result.healthAfter<before,'fleet delivery must inflict native damage on that component');
 }
}
console.log(JSON.stringify({result:'PASS',expectSourceBounds:expected,wasmSha256:crypto.createHash('sha256').update(bytes).digest('hex'),fixtures:results}));
// Confirm this fixture crosses actual fin skin, not only empty box space.
// Exporter checks the original GLB hash and uses gameplay normalization.
const {execFileSync}=await import('node:child_process');
const T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const partition=JSON.parse(fs.readFileSync('assets/mig23mld/fin-damage-partition.json'));
const selected=new Map(partition.primitives.map(p=>[p.primitive,new Set(p.triangles)]));
const rows=execFileSync(process.execPath,['scripts/export-mig23-fin.mjs',path.join(root,'assets/mig23mld/Mig-23.glb')],{encoding:'utf8',maxBuffer:8*1024*1024}).trim().split('\n').slice(1).map(l=>l.split(',').map(Number));
// Gun contact coordinates are native simulation output, including mount offsets.
const contact=results[0].contact??[0,5002.799716971985,7.208915333393145];
const ray=new T.Raycaster(new T.Vector3(100,contact[1]-5000,contact[2]),new T.Vector3(-1,0,0)).ray,metal=[];
for(const row of rows){if(!selected.get(row[0])?.has(row[1]))continue;const p=[0,1,2].map(i=>new T.Vector3(...row.slice(4+i*3,7+i*3)));const hit=ray.intersectTriangle(...p,false,new T.Vector3());if(hit)metal.push(hit.toArray());}
assert.ok(metal.length,'gun fixture must cross actual source fin skin');
console.log(JSON.stringify({sourceMetalRayContacts:metal,scope:'static native gun/fleet delivery fixture; conservative box, not triangle-exact collision'}));
