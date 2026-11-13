import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ManeuverStick} from '../web/maneuver-stick.js';
import {PilotAxisInput} from '../web/pilot-axis-input.js';

const module=new WebAssembly.Module(fs.readFileSync('public/flight.wasm'));
const imports={env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}};
const dt=1/120,D=Math.PI/180,wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
const state=s=>new Float64Array(s.memory.buffer,s.get_state(),104);
function make(type,speed=220){
 const s=new WebAssembly.Instance(module,imports).exports;s.set_aircraft_type(type);s.reset_spawn(1);
 s.debug_set_state(0,4500,0,0,0,-speed,0,0,0,1);s.set_invincible(1);return s;
}
function turn(type,side,assisted,speed=220){
 const s=make(type,speed),input=new PilotAxisInput(),stick=new ManeuverStick(),specs=new Float64Array(s.memory.buffer,s.get_aircraft_specs(),28);
 let heading=0,prior=0,maxBank=0,heightLoss=0,maxBeta=0,peakG=0;
 for(let i=0;i<1200;i++){
  // One sustained half-stick touch, no corrective pitch or rudder input.
  const sample=input.sample({touch:[0,side*.5,0],dt}),command=assisted?stick.sample(sample,state(s),specs):sample;
  s.set_pilot_override(assisted?1:0);s.set_pilot_axis_override(assisted?0:sample.mask);s.set_instructor_response(assisted?0:1);
  s.set_pilot_g_command(assisted&&command.gCommand?1:0);s.set_aim_direction(0,0,-1,1);
  s.set_controls(command.pitch,command.roll,command.yaw,.85,0,0,0,1);s.step(dt);
  const v=state(s);assert.ok(v.every(Number.isFinite));heading+=wrap(v[28]-prior);prior=v[28];
  maxBank=Math.max(maxBank,Math.abs(v[29]/D));heightLoss=Math.max(heightLoss,4500-v[1]);
  maxBeta=Math.max(maxBeta,Math.abs(v[17]/D));peakG=Math.max(peakG,v[18]);
 }
 return {heading:heading/D,maxBank,heightLoss,maxBeta,peakG,speed:state(s)[13]};
}

const comparison=[];let cases=0;
for(const type of [0,1,2,3,4,5,6,10,11,12,13,14,15,16])for(const side of [-1,1]){
 const before=turn(type,side,false),after=turn(type,side,true);comparison.push({type,side,before,after});cases++;
 assert.ok(after.heading*side>15,`a held sideways stick must turn the aircraft: ${type}/${side}`);
 assert.ok(after.maxBank<75,'hold a bank instead of continuously rolling');
 assert.ok(after.heightLoss<25,'coordinate lift instead of falling through the turn');
 assert.ok(after.maxBeta<3,'avoid a rudder-driven sideslip');
 assert.ok(after.heightLoss<before.heightLoss*.3,'less wasted vertical motion');
}
let energyCases=0;
for(const type of [0,4,13,14,15,16])for(const speed of [120,320]){
 const result=turn(type,1,true,speed);energyCases++;
 assert.ok(result.heading>0&&result.maxBank<85&&result.peakG<11,JSON.stringify({type,speed,result}));
}
const otherProfiles=[];
for(const [type,speed] of [[7,180],[8,160],[9,65]]){
 const result=turn(type,1,true,speed);otherProfiles.push({type,speed,result});
 assert.ok(result.heading>1&&result.maxBank<65&&result.heightLoss<100,JSON.stringify({type,speed,result}));
}

// Explicit load commands select the existing C++ load controller only while
// physical pilot authority and FBW are enabled; lifecycle changes clear them.
const s=make(16,100);s.set_pilot_override(1);s.set_pilot_g_command(1);s.set_aim_direction(0,0,-1,0);s.set_controls(0,0,0,.85,0,0,0,1);
// Low-speed FBW normally selects its pitch-rate loop. The explicit load
// channel must select load control while owned, then restore that native blend.
s.step(dt);
assert.ok(state(s)[97]<1e-6,'native G-command loop selected');
s.set_pilot_override(0);s.step(dt);assert.ok(state(s)[97]>.95,'G override cannot replace direction-aim rate control');
s.reset_spawn(1);assert.equal(s.get_pilot_g_command(),0);
s.set_pilot_g_command(1);s.set_aircraft_type(0);assert.equal(s.get_pilot_g_command(),0);

const stick=new ManeuverStick(),v=Array(104).fill(0),specs=Array(28).fill(0);v[13]=v[14]=220;v[31]=4500;specs[10]=7.5;specs[11]=-3;
assert.equal(stick.sample({pitch:1,roll:0,yaw:0,mask:1},v,specs).pitch,1,'full elevator authority');
assert.equal(stick.sample({pitch:-1,roll:0,yaw:0,mask:1},v,specs).pitch,-1);
v[29]=Math.PI;v[30]=Math.PI/2;
assert.equal(stick.sample({pitch:1,roll:0,yaw:0,mask:1},v,specs).roll,0,'no imposed half roll during a loop');
v[29]=v[30]=0;
v[34]=1;v[31]=1.5;
const taxi=stick.sample({pitch:.3,roll:.5,yaw:0,mask:3},v,specs);
assert.equal(taxi.pitch,.3);assert.ok(taxi.yaw>0);assert.equal(taxi.gCommand,false,'ground steering remains native ground FBW');
stick.reset();assert.equal(stick.active,false,'pause/reset releases helper state');
console.log(JSON.stringify({result:'PASS',cases,energyCases,otherProfiles,comparison,conditions:{seconds:10,physicsHz:120,rawTouchRoll:.5,initialTAS:220,altitude:4500,throttle:.85}}));
