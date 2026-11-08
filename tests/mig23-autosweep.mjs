import assert from 'node:assert/strict';
import {createMig23SweepController,mig23AutomaticSweep,MIG23_SWEEP_STOPS} from '../web/mig23mld-flight.js';
const sample=(mach,ias,gear=0,g=1)=>{const s=new Float64Array(104);s[15]=mach;s[14]=ias;s[18]=g;s[21]=gear;return s;};
assert.equal(mig23AutomaticSweep(sample(.35,125)),16);
assert.equal(mig23AutomaticSweep(sample(1.7,450)),72);
assert.equal(mig23AutomaticSweep(sample(1.7,450,1)),16);
assert.ok(mig23AutomaticSweep(sample(.88,350))>33);
assert.ok(mig23AutomaticSweep(sample(.88,350,0,5))<=33);
for(let m=.5,previous=16;m<=1.8;m+=.01){
 const angle=mig23AutomaticSweep(sample(m,Math.max(170,m*300)));
 assert.ok(angle>=previous-1e-6,'increasing Mach cannot reduce sweep except G override');
 previous=angle;
}
const cmds=[],memory=new WebAssembly.Memory({initial:1});
const a=new Float64Array(memory.buffer,0,8);a[1]=16;a[3]=16;
const sim={memory,get_aircraft_configuration:()=>0,set_wing_sweep:x=>{cmds.push(x);a[3]=x;}};
const sweep=createMig23SweepController(sim);
assert.equal(sweep.mode,'AUTO');
assert.equal(sweep.update(1/120,sample(.3,130)).target,16);
assert.equal(sweep.update(1/120,sample(1.75,480)).target,72);
assert.equal(cmds.at(-1),72);
assert.deepEqual(MIG23_SWEEP_STOPS,[16,33,45,72]);
for(const expected of ['16°','33°','45°','72°','AUTO'])assert.equal(sweep.cycle(),expected);
sweep.manual(45);assert.equal(sweep.mode,'MANUAL');
sweep.update(1/120,sample(.4,120));
assert.equal(sweep.target,45,'manual sweep holds across airspeed');
sweep.automatic();assert.equal(sweep.update(1/120,sample(.4,120)).target,16,'AUTO resumes');
console.log(JSON.stringify({result:'PASS',auto:true,manual:true,sweepStops:MIG23_SWEEP_STOPS}));
