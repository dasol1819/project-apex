import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(process.argv[2]??'public'),T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const {createFleetBridge}=await import(pathToFileURL(path.join(root,'fleet-bridge.js')));
const module=new WebAssembly.Module(fs.readFileSync(process.env.APEX_TEST_WASM??path.join(root,'flight.wasm'))),profile=JSON.parse(fs.readFileSync('assets/mig23mld/flap-source-shapes.json')).parts;
const source=execFileSync(process.execPath,['scripts/export-mig23-flaps.mjs','--triangles'],{encoding:'utf8'}).trim().split('\n').slice(1).map(r=>r.split(','));
const make=type=>{const s=new WebAssembly.Instance(module,{env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}}).exports;s.set_aircraft_type(type);s.reset_spawn(2);return s;};
const read=(s,name,n)=>new Float64Array(s.memory.buffer,s[name](),n),results=[];
for(const travel of [0,120,1200])for(const part of [16,17]){
 const target=make(16),shooter=make(0);shooter.reset_spawn(1);target.set_wing_sweep(16);target.set_invincible(0);
 function warm(gear,n){target.set_controls(0,0,0,.75,gear,0,0,1);for(let i=0;i<n;i++){target.debug_set_state(0,5000,0,0,0,-90,0,0,0,1);target.step(1/120);}}
 warm(0,1200);if(travel)warm(1,travel);
 const state=read(target,'get_state',104),angle=state[part===16?51:52],sweep=read(target,'get_aircraft_configuration',8)[1],p=profile[part],pin=new T.Vector3(...p.hingePoint),wing=new T.Vector3(...p.hinge),rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(...p.hingeAxis),p.flapSign*angle),yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.sign*(sweep-72)*Math.PI/180);
 const transform=v=>new T.Vector3(...v).sub(pin).applyQuaternion(rotation).add(pin).sub(wing).applyQuaternion(yaw).add(wing);
 const triangles=source.filter(r=>+r[0]===part).map(r=>new T.Triangle(...[0,1,2].map(i=>transform(r.slice(2+i*3,5+i*3).map(Number)))));
 const aim=triangles.filter(t=>t.getArea()>.008&&Math.abs(t.getNormal(new T.Vector3()).y)>.2).flatMap(t=>[.1,.3,.5,.7].flatMap(a=>[.1,.3,.5,.7].filter(b=>a+b<1).map(b=>t.a.clone().multiplyScalar(a).addScaledVector(t.b,b).addScaledVector(t.c,1-a-b)))).filter(v=>Math.abs(v.x)>3&&Math.abs(v.x)<3.6).sort((a,b)=>Math.abs(Math.abs(a.x)-3.2)-Math.abs(Math.abs(b.x)-3.2))[0];assert(aim,'source flap aim point '+part+' travel '+travel);
 // Upward100m fixed gun pass. Existing M61 station offsets are held constant
 // for old/new modules. Collision remains conservative AABB, not triangles.
 const origin=[aim.x-1.4184,4900,aim.z-.4387],hits=[];target.debug_set_state(0,5000,0,0,0,0,0,0,0,1);shooter.set_trigger(1);
 const health=()=>read(target,'get_systems',256)[16+part*8],before=health();
 const bridge=createFleetBridge([{id:1,team:0,active:true,sim:shooter},{id:101,team:1,active:true,sim:target,scriptedStep(){}}],undefined,{onEvents(actor){if(actor.id!==1)return;const h=read(shooter,'get_fleet_hits',450);for(let i=0;i<h[0];i++)hits.push(Array.from(h.slice(2+i*7,9+i*7)));}});
 let ticks=0;for(;ticks<180&&!hits.length;ticks++){shooter.debug_set_state(...origin,0,0,0,Math.SQRT1_2,0,0,Math.SQRT1_2);shooter.set_controls(0,0,0,0,0,0,0,0);bridge.step(1/120);}
 const contact=hits[0]?.slice(3,6),ray=new T.Raycaster(new T.Vector3(contact?.[0]??aim.x,-100,contact?.[2]??aim.z),new T.Vector3(0,1,0)).ray,metal=triangles.flatMap(t=>{const v=ray.intersectTriangle(t.a,t.b,t.c,false,new T.Vector3());return v?[v.toArray()]:[];});
 const result={part,travelTicks:travel,nativeFlapRadians:angle,nativeSweep:sweep,origin,aim:aim.toArray(),actualPart:hits[0]?.[1]??null,contact,healthBefore:before,healthAfter:health(),ticks,sourceMetalRayContacts:metal};results.push(result);
 if(process.env.APEX_EXPECT_SOURCE_BOUNDS!=='0'){assert.equal(result.actualPart,part,JSON.stringify(result));assert(health()<before);assert(metal.length,'native gun ray crosses source flap skin');}
}
console.log(JSON.stringify({result:'PASS',fixtures:results,scope:'Static upward native M61/fleet delivery at existing game flap0/transit/25 outputs. Conservative envelope, not triangle-exact impact, surveyed aircraft dimensions or AI engagement certification'}));
