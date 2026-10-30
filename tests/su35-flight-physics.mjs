import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'public');
const {Su35Flight,evaluateSu35,standardAtmosphere,liftCoefficient,SU35_FLIGHT}=await import(pathToFileURL(path.join(root,'su35-flight-physics.js')));
const DEG=Math.PI/180;
assert.ok(Math.abs(standardAtmosphere(0).density-1.225)<.001,'ISA sea-level density');
assert.ok(Math.abs(standardAtmosphere(11000).density-.3639)<.001,'ISA tropopause density');
assert.ok(Math.abs(evaluateSu35({speed:0,altitude:0,throttle:1}).thrust-284400)<10,'two AL-41F1S engines at sea-level static maximum');
const low=evaluateSu35({speed:100,alpha:5*DEG,altitude:0}),high=evaluateSu35({speed:200,alpha:5*DEG,altitude:0});
assert.ok(Math.abs(high.lift/low.lift-4)<.001,'lift follows dynamic pressure');
assert.ok(liftCoefficient(65*DEG)<liftCoefficient(20*DEG)*.6,'post-stall lift loss');
assert.ok(evaluateSu35({alpha:35*DEG}).CD>evaluateSu35({alpha:5*DEG}).CD*3,'high alpha drag rise');
assert.ok(evaluateSu35({gear:1}).drag>evaluateSu35({gear:0}).drag,'gear drag');
assert.ok(evaluateSu35({altitude:10000}).thrust<evaluateSu35({altitude:0}).thrust,'thrust lapse with altitude');
const maximum=new Su35Flight({fuel:SU35_FLIGHT.maxFuel,payload:8000});assert.ok(maximum.mass<=SU35_FLIGHT.maxMass,'maximum takeoff mass');
function run(dt,seconds,options={},controls={}){const f=new Su35Flight(options);for(let n=0;n<seconds/dt;n++)f.step(dt,controls);return f;}
const cruise=run(1/120,20);assert.equal(cruise.crashed,false);assert.ok(Math.abs(cruise.position.y-1500)<40,'trimmed level flight remains near its initial altitude');assert.ok(Math.abs(cruise.telemetry.normalG-1)<.1,'one-G trim');
const pull=run(1/120,3,{}, {pitch:.5}),coarse=run(1/30,3,{}, {pitch:.5});
assert.ok(pull.position.y>1560&&pull.telemetry.normalG>3.5,'positive pitch command produces a physical pull-up');
assert.ok(pull.position.distanceTo(coarse.position)<.01,'fixed substeps give the same trajectory at 30 and 120Hz');
const roll=run(1/120,1,{}, {roll:.5});assert.ok(roll.angularVelocity.z<-.1,'right roll command lowers the right wing');
const yaw=run(1/120,1,{}, {yaw:.5});assert.ok(yaw.angularVelocity.y<0,'right yaw command turns the nose to starboard');
const vector=new Su35Flight({speed:90,altitude:5000});vector.controls.pitch=1;const on=vector.forces();vector.controls.tvc=false;const off=vector.forces();
assert.ok(on.vectorPitch<0&&on.moment.x>off.moment.x,'upward exhaust deflection creates a nose-up reaction moment');
const burn=run(1/120,5,{}, {throttle:1});assert.ok(burn.fuel<6000&&burn.engine<1&&burn.engine>.9,'engine spool and fuel burn');
const extending=run(1/120,2,{}, {gear:1});assert.ok(Math.abs(extending.gear-.5)<.01,'landing gear takes four seconds to extend');
const fast=new Su35Flight({speed:650,altitude:500});fast.step(1/120,{throttle:1});assert.ok(fast.powerLimit<.5,'flight controller reduces power outside the dynamic-pressure envelope');
const fastFine=run(1/120,3,{speed:650,altitude:500},{throttle:1}),fastCoarse=run(1/30,3,{speed:650,altitude:500},{throttle:1});
assert.ok(fastFine.position.distanceTo(fastCoarse.position)<.01,'speed protection remains independent of render frequency');
const coast=run(1/120,5,{}, {throttle:0});assert.ok(burn.telemetry.speed>coast.telemetry.speed,'engine power affects acceleration');
let scenarios=0;
for(const speed of [90,150,300,600])for(const pitch of [-.5,0,1]){
  const f=run(1/60,10,{speed,altitude:5000},{pitch,throttle:.85});
  assert.ok([...f.position,...f.velocity,...f.orientation,...f.angularVelocity].every(Number.isFinite),'finite state across flight envelope');
  assert.ok(Math.abs(f.orientation.length()-1)<1e-9,'unit attitude quaternion');scenarios++;
}
console.log(JSON.stringify({result:'PASS',scenarios,levelAltitude:cruise.position.y,pullUpG:pull.telemetry.normalG,substepTrajectoryError:pull.position.distanceTo(coarse.position)}));
