import assert from 'node:assert/strict';
import {createMig23SweepController,mig23AutomaticSweep,MIG23_SWEEP_STOPS} from '../web/mig23mld-flight.js';
// Native IAS is m/s; schedule thresholds are km/h.
const sample=(mach,kmh)=>{const s=new Float64Array(104);s[15]=mach;s[14]=kmh/3.6;return s;};
let target=16;
const schedule=[
 [.3,0,16],[.4,400,16],[.45,450,16],[.5,500,16],[.5,501,45],
 [.45,480,45],[.4,400,45],[.4,399,16],[.45,480,16],[.5,501,45],
 [1.1,1100,45],[1.101,1101,72],[1.05,1050,72],[1,1000,72],
 [.999,999,45],[1.05,1050,45],[1.101,1101,72],[.9,900,45],[.3,399,16]
];
for(const [mach,kmh,expected] of schedule){
 target=mig23AutomaticSweep(sample(mach,kmh),target);
 assert.equal(target,expected,`AUTO transition at Mach ${mach}, IAS ${kmh} km/h`);
}
const cmds=[],memory=new WebAssembly.Memory({initial:1});
const a=new Float64Array(memory.buffer,0,8);a[1]=16;a[3]=16;
const sim={memory,get_aircraft_configuration:()=>0,set_wing_sweep:x=>{cmds.push(x);a[3]=x;}};
const sweep=createMig23SweepController(sim);
assert.equal(sweep.mode,'AUTO');
assert.equal(sweep.update(1/120,sample(.3,300)).target,16);
assert.equal(sweep.update(1/120,sample(.5,501)).target,45);
const beforeHold=cmds.length;
for(let i=0;i<100;i++)sweep.update(1/120,sample(.5,i%2?499:501));
assert.equal(sweep.target,45,'hysteresis prevents hunting around 500 km/h');
assert.equal(cmds.length,beforeHold,'held targets do not repeat native commands');
assert.equal(a[1],16,'native hydraulic position is not teleported to target');
assert.equal(sweep.update(0,sample(1.2,1200)).target,45,'paused frames retain the target');
assert.equal(sweep.update(1/120,sample(1.75,1500)).target,72);
assert.equal(cmds.at(-1),72);
assert.deepEqual(MIG23_SWEEP_STOPS,[16,33,45,72]);
for(const expected of ['16°','33°','45°','72°','AUTO'])assert.equal(sweep.cycle(),expected);
sweep.manual(45);assert.equal(sweep.mode,'MANUAL');
sweep.update(1/120,sample(.3,399));
assert.equal(sweep.target,45,'manual sweep holds across airspeed');
sweep.automatic();assert.equal(sweep.update(1/120,sample(.3,399)).target,16,'AUTO resumes');
sweep.reset();assert.equal(sweep.target,16);assert.equal(sweep.mode,'AUTO');
assert.equal(cmds.at(-1),16,'respawn resets to takeoff sweep');
console.log(JSON.stringify({result:'PASS',auto:true,manual:true,hysteresis:true,transitions:schedule.length,sweepStops:MIG23_SWEEP_STOPS}));
