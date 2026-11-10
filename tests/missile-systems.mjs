import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(process.argv[2] || 'public');
const {createFleetBridge} = await import(pathToFileURL(path.join(root, 'fleet-bridge.js')));
const {missileFor} = await import(pathToFileURL(path.join(root, 'missile-data.js')));
const wasm = new WebAssembly.Module(fs.readFileSync(path.join(root, 'flight.wasm')));
const imports = {env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>18}};
const dt = 1 / 120;
const view = (s, name, length) => new Float64Array(s.memory.buffer, s[name](), length);
const state = s => view(s, 'get_state', 104);

function createAircraft(type, z, speed, altitude = 5000) {
 const sim = new WebAssembly.Instance(wasm, imports).exports;
 sim.set_aircraft_type(type);
 sim.reset_spawn(1);
 sim.debug_set_state(0, altitude, z, 0, 0, -speed, 0, 0, 0, 1);
 sim.set_controls(0, 0, 0, .75, 0, 0, 0, 1);
 return sim;
}

function encounter({type=0, radar=false, range=2000, altitude=5000, speed=250}={}) {
 const shooter = createAircraft(type, 0, speed, altitude);
 const target = createAircraft(1, -range, 215, altitude);
 const weapon = radar ? 'amraam' : 'missile';
 const projectileGetter = radar ? 'get_amraams' : 'get_missiles';
 const impacts = [], losses = new Map();
 const bridge = createFleetBridge([
  {id:1,team:0,active:true,sim:shooter},
  {id:101,team:1,active:true,sim:target}
 ], undefined, {
  onHit(source, victim, kind, part, loss) {
   if (source.sim===shooter && kind===5) losses.set(part, (losses.get(part) ?? 0) + loss);
  },
  onEvents(source) {
   if (source.sim!==shooter) return;
   const events=view(shooter,'get_missile_events',50);
   for (let i=0;i<events[0];i++) {
    const k=2+i*6;
    impacts.push({kind:events[k+4],point:[...events.subarray(k,k+3)],
     target:[...state(target).subarray(0,3)]});
   }
  }
 });
 shooter.set_radar_power(1);
 shooter.set_radar_range(160000);
 shooter['set_'+weapon+'_enabled'](1);
 const readWeapon = () => view(shooter,'get_'+weapon+'_state',40);
 let selected=false, accepted=false, launchRange=0;
 function step() {
  bridge.step(dt);
  if (!selected && view(shooter,'get_radar_state',32)[5]) {
   shooter.select_sensor_target(101);
   shooter.request_radar_lock();
   selected=true;
  }
  if (!accepted && readWeapon()[2]===4) {
   assert.equal(shooter['request_'+weapon+'_fire'](),1);
   accepted=true;
   launchRange=Math.hypot(...state(target).subarray(0,3).map((v,i)=>v-state(shooter)[i]));
  }
  return view(shooter,projectileGetter,26);
 }
 return {shooter,target,step,impacts,losses,readWeapon,get launchRange(){return launchRange;}};
}

function flyBy({radar=false, x=0, y=0, age=5, direction=-1}={}) {
 const run=encounter({radar});
 let launched=false;
 for(let i=0;i<600 && !launched;i++) launched=run.step()[0]>0;
 assert.ok(launched,'the live weapon locks and leaves its station');
 // Position the first live native missile for a reproducible off-axis pass.
 // Both native record types share this prefix in the checksum-pinned module.
 const missile=new Float64Array(run.shooter.memory.buffer,radar?1112016:1110160,22);
 const target=state(run.target);
 missile.set([target[0]+x,target[1]+y,target[2]+24]);
 missile.set([0,0,direction*950],6);
 missile.set([0,0,direction],9);
 missile[12]=age;
 missile[17]=600; // Travel since launch.
 for(let i=0;i<40 && !run.impacts.length;i++) run.step();
 assert.equal(state(run.target)[33],0,'this isolated tail or wing strike leaves the aircraft flying');
 return {impact:run.impacts[0],losses:run.losses};
}

const direct=flyBy();
assert.equal(direct.impact?.kind,1,'physical collision stays a direct hit');
assert.ok(Math.max(...direct.losses.values())>.7,'direct contact strongly damages its own part');
const close=flyBy({y:4}),far=flyBy({y:5.7});
assert.equal(close.impact?.kind,5);
assert.equal(far.impact?.kind,5);
assert.ok(Math.max(...close.losses.values())>3*Math.max(...far.losses.values()),'damage falls with standoff');
for(const radar of [false,true]){
 const pass=flyBy({radar,x:-5.5,y:3});
 assert.equal(pass.impact?.kind,5,'IR and radar missiles both use the proximity fuze');
 assert.ok(pass.impact.point[0]-pass.impact.target[0]<-4,'flash originates on the passing missile');
 assert.ok(pass.losses.has(12) && !pass.losses.has(13) && !pass.losses.has(0),
  'left wing is damaged and the opposite wing and fuselage are spared');
}
for(const options of [{x:-5.5,y:4},{x:-5.5,y:3,age:.02},{x:-5.5,y:3,direction:1}]){
 const pass=flyBy(options);
 assert.equal(pass.impact,undefined,'out-of-radius, unarmed and receding passes do not detonate');
 assert.equal(pass.losses.size,0);
}

function longShot(type, range, cutIllumination=false) {
 const altitude=12500,speed=380,targetSpeed=210;
 const run=encounter({type,radar:true,range,altitude,speed});
 const profile=missileFor(type,true);
 let peak=0, lastBurn=0, flown=false;
 for(let i=0;i<120*75;i++){
  // Steady, level head-on conditions isolate missile and radar performance.
  run.shooter.debug_set_state(0,altitude,-speed*i*dt,0,0,-speed,0,0,0,1);
  run.target.debug_set_state(0,altitude,-range+targetSpeed*i*dt,0,0,targetSpeed,0,1,0,0);
  const projectile=run.step();
  if(projectile[0]){
   flown=true;
   peak=Math.max(peak,projectile[12]);
   if(projectile[10])lastBurn=projectile[9];
   if(cutIllumination && projectile[9]>1)run.shooter.set_radar_power(0);
  }else if(flown)break;
 }
 assert.ok(run.launchRange>range-1800,'the actual launch gate allows a long shot');
 assert.ok(Math.abs(lastBurn-(profile.boostTime+profile.sustainTime+.12))<.03,
  'exhaust follows the full motor burn, including sustain where fitted');
 assert.ok(peak>profile.speed*.80,'flight model reaches its rated game speed band');
 if(cutIllumination){
  assert.equal(run.losses.size,0,'R-24R loses the engagement when STT illumination stops');
 }else{
  assert.ok(run.impacts.some(e=>e.kind===1||e.kind===5));
  assert.ok(run.losses.size>0,'the long shot reaches and damages its target');
 }
 return {missile:profile.name,launchKm:Number((run.launchRange/1000).toFixed(1)),peak,illuminated:!cutIllumination};
}

function launchWindow(altitude, closing) {
 const run=encounter({type:13,radar:true,range:12000,altitude,speed:320});
 run.target.debug_set_state(0,altitude,-12000,0,0,closing?210:-210,0,closing?1:0,0,closing?0:1);
 run.step();
 return run.readWeapon()[12];
}
const highHead=launchWindow(12500,true),highTail=launchWindow(12500,false),lowHead=launchWindow(500,true);
assert.ok(highHead>highTail*1.35 && highHead>lowHead*1.35,'altitude and target motion change the native release window');

const checked=new Set();
for(const type of [0,1,2,3,4,10,13,14,16]){
 for(const radar of [false,true]){
  const profile=missileFor(type,radar);
  const key=profile && profile.name+' '+profile.maxRange;
  if(!profile || checked.has(key))continue;
  const run=encounter({type,radar});
  for(let i=0;i<120*18 && !run.impacts.length;i++)run.step();
  assert.ok(run.impacts.some(e=>e.kind===1||e.kind===5) && run.losses.size>0,
   profile.name+' acquires, launches and hits in the shared native path');
  checked.add(key);
 }
}
assert.equal(checked.size,15,'all 14 missile types and both R-73 envelopes are exercised');

const shots=[
 longShot(4,60000),longShot(13,45000),longShot(0,55000),
 longShot(16,23000),longShot(16,23000,true)
];
console.log(JSON.stringify({result:'PASS',fuzes:'IR/RF contact and proximity',profiles:checked.size,highHead,highTail,lowHead,shots}));
