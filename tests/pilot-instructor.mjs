import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PilotAuthority} from '../web/pilot-authority.js';
import {PilotAxisInput,shapeAxis,axisSettings,loadAxisSettings} from '../web/pilot-axis-input.js';
import {AimCursor} from '../public/aim-input.js';
import * as T from '../public/vendor/three.module.js';
const s=axisSettings();
for(const x of [-.07,0,.07])assert.equal(shapeAxis(x,s),0,'stick drift ignored');
assert.equal(shapeAxis(1,s),1);assert.equal(shapeAxis(-1,s),-1);
assert.ok(shapeAxis(.4,s)>.05&&shapeAxis(.4,s)<.4,'fine central response');
assert.equal(shapeAxis(NaN,s),0);assert.equal(loadAxisSettings({getItem:()=>'{bad'}).handoff,'heading');
const input=new PilotAxisInput(),a=new PilotAuthority();
assert.deepEqual(input.sample({pad:[.05,-.04,.03]}),{pitch:0,roll:0,yaw:0,mask:0});
let v=input.sample({digital:[[false,false],[true,false],[false,false]],pad:[0,-1,0]});
assert.equal(v.roll,1,'explicit keyboard input owns its axis');assert.equal(v.mask,2);
v=input.sample({digital:[[false,false],[true,true],[false,false]]});
assert.equal(v.roll,0);assert.equal(v.mask,2,'opposing keys command neutral instead of yielding to the instructor');
v=input.sample();assert.equal(v.roll,0);assert.equal(v.mask,0,'keys release immediately');
input.configure({response:.3,nonlinearity:1});
assert.ok(input.sample({pad:[1,0,0]}).pitch<.1,'optional analog time response');
assert.equal(input.sample({digital:[[true,false]]}).pitch,1,'keyboard has no analog smoothing');
input.reset();assert.equal(input.sample().pitch,0,'pause/respawn clears filter');
a.axes(0,.3,0);assert.equal(a.axisMask,2);assert.equal(a.rebaseOnRelease,false);
a.axes(0,0,0);assert.equal(a.rebaseOnRelease,true);assert.equal(a.direct,false);
a.axes(0,0,0);assert.equal(a.rebaseOnRelease,false,'rebase only once');
a.axes(.2,0,0);assert.ok(a.pointerMoved(4,3),'mouse and direct axes can coexist');
a.axes(0,0,0);assert.equal(a.rebaseOnRelease,false,'deliberate new mouse target survives handoff');
a.axes(0,0,0,'axes',2);assert.equal(a.axisMask,2);a.reset('manual');assert.equal(a.pointerMoved(4,3),false);
// Screen-space pointer motion must work through the vertical and inverted.
const cursor=new AimCursor(),q=new T.Quaternion();
cursor.reset(q);cursor.turn(0,100*Math.PI/180,q);
assert.ok(cursor.direction.z>0&&cursor.direction.y>.9,'no 85-degree ceiling');
assert.ok(Math.abs(cursor.direction.length()-1)<1e-12);
q.setFromAxisAngle(new T.Vector3(0,0,1),Math.PI);cursor.reset(q);
cursor.turn(.1,0,q);assert.ok(cursor.direction.x<0,'inverted screen-right stays screen-right');
for(let i=0;i<1000;i++)cursor.turn(.01,.01,q);
assert.ok(cursor.direction.toArray().every(Number.isFinite));
const imports={env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}};
const wasm=fs.readFileSync('public/flight.wasm'),module=new WebAssembly.Module(wasm);
const make=type=>{const s=new WebAssembly.Instance(module,imports).exports;s.set_aircraft_type(type);s.reset_spawn(1);s.debug_set_state(0,4500,0,0,0,-220,0,0,0,1);s.set_pilot_override(0);s.set_aim_direction(.25,.18,-1,1);return s;};
const read=(s,name,n)=>Array.from(new Float64Array(s.memory.buffer,s[name](),n));
let scenarios=0;
for(const type of [0,1,4,7,13,14,15,16])for(const mask of [0,1,2,4,3,5,6,7]){
 const s=make(type),raw=[.2,.3,-.15].map((x,i)=>mask&(1<<i)?x:0);
 s.set_controls(...raw,.75,0,0,0,1);s.set_pilot_axis_override(mask);
 let assistSeen=false;
 for(let i=0;i<120;i++){s.step(1/120);assistSeen ||= read(s,'get_aim_state',16).slice(5,8).some((v,k)=>!(mask&(1<<k))&&Math.abs(v)>.001);}
 const aim=read(s,'get_aim_state',16);
 assert.ok(read(s,'get_state',104).every(Number.isFinite),'finite native flight');
 for(let i=0;i<3;i++)if(mask&(1<<i)){
  assert.equal(aim[8+i],raw[i],'sample-exact manual command before native FBW');
  assert.equal(aim[5+i],0,'manual axis controller state does not wind up');
 }
 if(mask!==7)assert.ok(assistSeen,`other axes retain direction assistance type=${type} mask=${mask} commands=${aim.slice(5,11)}`);
 s.set_pilot_axis_override(7);s.reset_spawn(1);assert.equal(s.get_pilot_axis_override(),0);
 s.set_pilot_axis_override(7);s.set_aircraft_type(type);assert.equal(s.get_pilot_axis_override(),0);
 scenarios++;
}
// Without the new API the native trajectories must remain bit-identical.
const before=new WebAssembly.Module(fs.readFileSync('.native-build/pre-instructor.wasm'));
let legacyTicks=0;
for(let type=0;type<17;type++){
 const sims=[before,module].map(m=>new WebAssembly.Instance(m,imports).exports);
 for(const s of sims){s.set_aircraft_type(type);s.reset_spawn(1);s.debug_set_state(0,4500,0,0,0,-220,0,0,0,1);s.set_pilot_override(0);s.set_aim_direction(.2,.1,-1,1);}
 for(let i=0;i<240;i++){
  for(const s of sims){s.set_controls(0,0,0,.75,0,0,0,1);s.step(1/120);}
  if(i%60===0)assert.deepEqual(read(sims[0],'get_state',104),read(sims[1],'get_state',104),'unchanged legacy/AI native path '+type);
  legacyTicks++;
 }
}
console.log(JSON.stringify({result:'PASS',nativeAxisScenarios:scenarios,legacyAircraft:17,legacyTicks,inputCurves:true,opposingKeys:true,releaseHandoff:true,verticalPointer:true}));
