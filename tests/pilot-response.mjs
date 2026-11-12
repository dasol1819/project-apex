import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {AimCursor,AimChaseCamera} from '../public/aim-input.js';

const D=Math.PI/180,dt=1/120,clamp=T.MathUtils.clamp;
const imports={env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}};
const modules=[new WebAssembly.Module(fs.readFileSync('.native-build/pre-instructor.wasm')),new WebAssembly.Module(fs.readFileSync('public/flight.wasm'))];
function make(type,enabled,speed=220){
 const s=new WebAssembly.Instance(modules[enabled?1:0],imports).exports;
 s.set_aircraft_type(type);s.reset_spawn(1);s.debug_set_state(0,4500,0,0,0,-speed,0,0,0,1);s.set_invincible(1);
 if(enabled)s.set_instructor_response(1);
 return s;
}
const state=s=>new Float64Array(s.memory.buffer,s.get_state(),104);
const forward=new T.Vector3(),pose=new T.Quaternion();
function error(s,target){const v=state(s);pose.fromArray(v,6);return Math.acos(clamp(forward.set(0,0,-1).applyQuaternion(pose).dot(target),-1,1))/D;}
function direction(h,p,out=new T.Vector3()){return out.set(Math.sin(h*D)*Math.cos(p*D),Math.sin(p*D),-Math.cos(h*D)*Math.cos(p*D));}
function staticResponse(type,h,p,enabled){
 const s=make(type,enabled),cursor=new AimCursor(),target=direction(h,p);cursor.direction.copy(target);
 let lastOutside=0,tail=0,peakG=0;
 for(let i=0;i<2400;i++){
  s.set_aim_direction(...(enabled?cursor.sample(dt):target),1);s.set_controls(0,0,0,.85,0,0,0,1);s.step(dt);
  const e=error(s,target),v=state(s);assert.ok(Number.isFinite(e)&&v.every(Number.isFinite));
  if(e>1)lastOutside=i*dt;if(i>=2160)tail+=e/240;peakG=Math.max(peakG,v[18]);
 }
 return {settle:lastOutside,tail,peakG};
}

// Small corrections, both turn directions, large turns and pitch/roll coupling.
// This tests actual forces and attitudes for every jet; it is not a command
// snapshot that could pass while an aircraft never reaches its destination.
let staticCases=0;const comparison=[];
for(const type of [0,1,2,3,4,5,6,10,11,12,13,14,15,16])for(const [h,p] of [[5,0],[20,0],[-20,0],[60,0],[0,20],[30,15]]){
 const after=staticResponse(type,h,p,true);staticCases++;
 assert.ok(after.tail<.25,`static target must remain acquired: ${JSON.stringify({type,h,p,after})}`);
 assert.ok(after.peakG<11,`native envelope still limits load: ${type}`);
 if(h===20&&p===0&&[0,4,13,14,15,16].includes(type)){
  const before=staticResponse(type,h,p,false);comparison.push({type,before,after});
  assert.ok(after.settle<before.settle*.9,`sustained acquisition improves: ${type}`);
 }
}

function tracking(type,hz,enabled){
 const s=make(type,enabled),cursor=new AimCursor(),target=new T.Vector3(0,0,-1);let squares=0,n=0;
 for(let i=0;i<3600;i++){
  const t=i*dt;
  if(i%(120/hz)===0)direction(20*Math.sin(t*.6),6*Math.sin(t*.45),target);
  cursor.direction.copy(target);s.set_aim_direction(...(enabled?cursor.sample(dt):target),1);
  s.set_controls(0,0,0,.85,0,0,0,1);s.step(dt);
  if(i>1200){const e=error(s,target);assert.ok(Number.isFinite(e));squares+=e*e;n++;}
 }
 return Math.sqrt(squares/n);
}
const moving=[];
for(const type of [0,4,13,14,15,16]){
 const rows=[];
 for(const hz of [20,30,60,120]){
  const before=tracking(type,hz,false),after=tracking(type,hz,true);rows.push(after);moving.push({type,hz,before,after});
  assert.ok(after<before+.15,`moving-target regression: ${JSON.stringify({type,hz,before,after})}`);
  if(hz===20)assert.ok(after<before*.65,`low-frequency pointer batches are resampled: ${type}`);
 }
 assert.ok(Math.max(...rows)-Math.min(...rows)<.25,`input frequency must not change handling: ${type}`);
}

// Response tuning never takes authority from a held manual axis.
let manualCases=0;
for(const type of [0,1,4,7,13,14,15,16])for(let mask=0;mask<8;mask++){
 const s=make(type,true);const raw=[.2,.3,-.15].map((x,k)=>mask&(1<<k)?x:0);
 s.set_aim_direction(.25,.18,-1,1);s.set_pilot_axis_override(mask);s.set_controls(...raw,.75,0,0,0,1);
 for(let i=0;i<120;i++)s.step(dt);
 const aim=new Float64Array(s.memory.buffer,s.get_aim_state(),16);
 for(let k=0;k<3;k++)if(mask&(1<<k))assert.equal(aim[8+k],raw[k]);
 s.reset_spawn(1);assert.equal(s.get_instructor_response(),0);manualCases++;
}

// Camera/pointer basis must stay continuous through a complete vertical loop.
const rig=new AimChaseCamera(),camera=new T.PerspectiveCamera(),center=new T.Vector3(0,4500,0),target=new T.Vector3();
let prior=null,peakCameraStep=0;
for(let i=0;i<1800;i++){
 const a=i/1800*Math.PI*2;target.set(0,Math.sin(a),-Math.cos(a));rig.update(camera,center,target,1/60,28,()=>0);
 if(prior)peakCameraStep=Math.max(peakCameraStep,camera.quaternion.angleTo(prior)/D);
 assert.ok(camera.quaternion.toArray().every(Number.isFinite));prior=camera.quaternion.clone();
}
assert.ok(peakCameraStep<2,`no heading/up-vector flip at the pole: ${peakCameraStep}`);
rig.reset();rig.update(camera,center,new T.Vector3(0,0,-1),1/60,28,()=>0);
for(let i=0;i<240;i++)rig.update(camera,center,new T.Vector3(0,0,1),1/60,28,()=>0);
assert.ok(rig.direction.z>.999,'opposite target follows a finite arc');
const cursor=new AimCursor();cursor.direction.set(0,0,1);
for(let i=0;i<24;i++)cursor.sample(dt);
assert.ok(cursor.commandDirection.z>.999,'target resampling is defined for a 180-degree move');
cursor.reset(new T.Quaternion());assert.equal(cursor.commandDirection.z,-1,'respawn/release clears target history');
console.log(JSON.stringify({result:'PASS',staticCases,manualCases,comparison,moving,peakCameraStep}));
