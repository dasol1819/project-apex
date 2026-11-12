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
for(const [part,x,y,z,yaw] of [[22,-.94,4999.58,100,0]]){ const shooter=make(0),target=make(16),hits=[];
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
  assert.equal(result.actualPart,part,'projectile must collide with the source-fitted native nozzle');
  assert.ok(result.healthAfter<before,'fleet delivery must inflict native damage on that component');
 }
}
// The off-axis fixture crosses actual source petals, rather than probing the
// empty centre of the hollow ring. Native collision itself remains box-based.
const T=await import(pathToFileURL(path.join(root,'vendor/three.module.js')));
const {inspectMig23Glb}=await import(pathToFileURL(path.join(root,'mig23mld-glb.js')));
const glb=fs.readFileSync(path.join(root,'assets/mig23mld/Mig-23.glb'));
const {json:j,bin}=inspectMig23Glb(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength));
const node=j.nodes.find(n=>n.name==='soplo'),primitive=j.meshes[node.mesh].primitives[0];
const index=j.accessors[primitive.indices],view=j.bufferViews[index.bufferView];
const bytesPerIndex=({5121:1,5123:2,5125:4})[index.componentType];
const dv=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
const offset=(view.byteOffset||0)+(index.byteOffset||0),stride=view.byteStride||bytesPerIndex;
const get=i=>dv[({5121:'getUint8',5123:'getUint16',5125:'getUint32'})[index.componentType]](offset+i*stride,true);
const vertices=fs.readFileSync('docs/aircraft-review/mig23mld/nozzle-damage-vertices.csv','utf8').trim().split('\n').slice(1).map(l=>l.split(',').map(Number)).filter(v=>v[0]===1).map(v=>new T.Vector3(...v.slice(1)));
assert.equal(vertices.length,j.accessors[primitive.attributes.POSITION].count);
const ray=new T.Raycaster(new T.Vector3(.4791062357451572,.019045368137,100),new T.Vector3(0,0,-1)).ray,metalContacts=[];
for(let i=0;i<index.count;i+=3){const hit=ray.intersectTriangle(vertices[get(i)],vertices[get(i+1)],vertices[get(i+2)],false,new T.Vector3());if(hit)metalContacts.push(hit.toArray());}
assert.ok(metalContacts.length,'rear shot must cross actual original nozzle petals');
console.log(JSON.stringify({result:'PASS',expectSourceBounds:expected,wasmSha256:crypto.createHash('sha256').update(bytes).digest('hex'),fixtures:results,sourceMetalRayContacts:metalContacts}));
