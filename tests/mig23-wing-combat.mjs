import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(process.argv[2]??'public');
const T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const {createFleetBridge}=await import(pathToFileURL(path.join(root,'fleet-bridge.js')));
const module=new WebAssembly.Module(fs.readFileSync(process.env.APEX_TEST_WASM??path.join(root,'flight.wasm')));
const source=JSON.parse(fs.readFileSync('assets/mig23mld/wing-support-hulls.json'));
const triangles=execFileSync(process.execPath,['scripts/export-mig23-wings.mjs','--triangles'],{encoding:'utf8'}).trim().split('\n').slice(1).map(r=>r.split(',').map(Number));
const make=type=>{const s=new WebAssembly.Instance(module,{env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}}).exports;s.set_aircraft_type(type);s.reset_spawn(2);return s};
const read=(s,name,n)=>new Float64Array(s.memory.buffer,s[name](),n),results=[];
for(const sweep of [16,44,72])for(const part of [1,2]){
 const target=make(16),shooter=make(0);shooter.reset_spawn(1);target.set_invincible(0);target.set_wing_sweep(sweep);target.set_controls(0,0,0,.75,0,0,0,1);
 for(let i=0;i<6000;i++){target.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);target.step(1/120);if(Math.abs(read(target,'get_aircraft_configuration',8)[1]-sweep)<1e-6)break;}
 const angle=read(target,'get_aircraft_configuration',8)[1],w=source.parts[part],theta=w.sign*(angle-72)*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta);
 function rotate(p){const x=p[0]-w.hinge[0],z=p[2]-w.hinge[2];return new T.Vector3(x*c+z*s+w.hinge[0],p[1],z*c-x*s+w.hinge[2]);}
 const metal=triangles.filter(t=>t[0]===part).map(t=>new T.Triangle(...[0,1,2].map(i=>rotate(t.slice(1+i*3,4+i*3)))));
 const candidates=metal.filter(t=>t.getArea()>.01&&Math.abs(t.getNormal(new T.Vector3()).y)>.2).map(t=>t.getMidpoint(new T.Vector3())).filter(p=>Math.abs(p.x)>(sweep===72?2.0:2.6)&&(sweep!==72||p.z<5));
 const station=sweep===72?2.4:3.2;
 candidates.sort((a,b)=>Math.abs(Math.abs(a.x)-station)-Math.abs(Math.abs(b.x)-station));assert(candidates.length,'source wing aiming triangle');
 const aim=candidates[0],side=part===1?-1:1,yaw=side*Math.PI/2;
 // Static 100m aiming fixture, calibrated to the native projectile trace.
 // Hold these same body positions for baseline/candidate; do not move targets.
 const origin=[side*100,5000+aim.y-.4387,aim.z+side*1.4184],hits=[];
 target.debug_set_state(0,5000,0,0,0,0,0,0,0,1);shooter.set_trigger(1);
 const health=()=>read(target,'get_systems',256)[16+part*8],before=health();
 const bridge=createFleetBridge([{id:1,team:0,active:true,sim:shooter},{id:101,team:1,active:true,sim:target,scriptedStep(){}}],undefined,{onEvents(actor){if(actor.id!==1)return;const h=read(shooter,'get_fleet_hits',450);for(let i=0;i<h[0];i++)hits.push(Array.from(h.slice(2+i*7,9+i*7)));}});
 let ticks=0;for(;ticks<180&&!hits.length;ticks++){shooter.debug_set_state(...origin,0,0,0,0,Math.sin(yaw/2),0,Math.cos(yaw/2));shooter.set_controls(0,0,0,0,0,0,0,0);bridge.step(1/120);}
 const contact=hits[0]?.slice(3,6),actualPart=hits[0]?.[1]??null;
 // The actual native projectile ray must cross original source metal.
 // This does not turn the conservative native AABB into triangle collision.
 const lineY=contact?contact[1]-5000:aim.y,lineZ=contact?contact[2]:aim.z;
 const ray=new T.Raycaster(new T.Vector3(side*100,lineY,lineZ),new T.Vector3(-side,0,0)).ray;
 const contacts=metal.flatMap(t=>{const p=ray.intersectTriangle(t.a,t.b,t.c,false,new T.Vector3());return p?[p.toArray()]:[]});
 const result={sweep:angle,part,origin,aim:aim.toArray(),actualPart,contact,healthBefore:before,healthAfter:health(),ticks,sourceMetalRayContacts:contacts};results.push(result);
 if(process.env.APEX_EXPECT_SOURCE_BOUNDS!=='0'){
  assert(contacts.length,'native firing fixture crosses actual wing skin: '+JSON.stringify(result));
  assert.equal(actualPart,part,'native projectile identifies source wing root: '+JSON.stringify(result));assert(health()<before,'fleet delivery reduces correct root health');
 }else{assert.notEqual(actualPart,part,'baseline misses correct root');assert.equal(health(),before,'baseline root health remains intact');}
}
console.log(JSON.stringify({result:'PASS',fixtures:results,scope:'Static native gun/fleet delivery and source-metal ray; not triangle-exact native collision or manoeuvring AI certification'}));
