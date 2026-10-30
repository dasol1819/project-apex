import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public');
const {createFleetBridge}=await import(pathToFileURL(path.join(root,'fleet-bridge.js')));
const module=new WebAssembly.Module(fs.readFileSync(path.join(root,'flight.wasm')));
const imports={env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>18}};
const read=(s,n,l)=>Array.from(new Float64Array(s.memory.buffer,s[n](),l)),state=s=>read(s,'get_state',104);
const make=(type=13,z=0,speed=250)=>{const s=new WebAssembly.Instance(module,imports).exports;s.set_aircraft_type(type);s.reset_spawn(1);s.debug_set_state(0,5000,z,0,0,-speed,0,0,0,1);s.set_controls(0,0,0,.75,0,0,0,1);s.set_invincible(0);return s;};
function engagement(kind,targetType=1){
 const player=make(),target=make(targetType,-4000,210),bridge=createFleetBridge([{id:1,team:0,active:true,sim:player},{id:101,team:1,active:true,sim:target}]);
 player.set_radar_power(1);player[kind==='rf'?'set_amraam_enabled':'set_missile_enabled'](1);
 let locked=false,launched=false,trajectory=false;
 for(let i=0;i<3600;i++){
  bridge.step(1/120);
  if(!locked&&read(player,'get_radar_state',32)[5]){player.select_sensor_target(101);player.request_radar_lock();locked=true;}
  const weapon=read(player,kind==='rf'?'get_amraam_state':'get_missile_state',40);
  if(!launched&&weapon[2]===4){assert.equal(player[kind==='rf'?'request_amraam_fire':'request_missile_fire'](),1);launched=true;}
  if(launched&&read(player,kind==='rf'?'get_amraams':'get_missiles',2)[0]>0)trajectory=true;
 }
 assert.ok(locked&&launched&&trajectory,kind+' acquires, launches and flies');
 const health=read(target,'get_systems',256);assert.ok(health[16]<.999,kind+' inflicts native damage through the fleet bridge');
 return{kind,targetType,remaining:read(player,kind==='rf'?'get_amraam_state':'get_missile_state',32)[1],targetBody:health[16]};
}
const engagements=[engagement('rf'),engagement('ir'),engagement('rf',13)];
const gun=make();gun.set_trigger(1);for(let i=0;i<720;i++)gun.step(1/120);gun.set_trigger(0);
assert.equal(read(gun,'get_combat',12)[0],0,'150 rounds can be expended');
assert.equal(read(gun,'get_combat',12)[4],150,'150 native gun projectiles fired');
assert.ok(read(gun,'get_reload_state',8)[2]>0,'empty gun starts the game reload timer');
for(let i=0;i<120*21;i++)gun.step(1/120);
assert.equal(read(gun,'get_combat',12)[0],150,'game reload restores 150 rounds');
const bomb=make();bomb.reset_spawn(1);assert.equal(bomb.set_loadout(39),1);assert.equal(bomb.set_laser(1),1,'native targeting pod is functional');bomb.set_bombs_enabled(1);bomb.step(1/120);assert.equal(bomb.request_bomb_release(),1);for(let i=0;i<240;i++)bomb.step(1/120);
const released=read(bomb,'get_bombs',26);assert.equal(released[0],1);assert.equal(released[13],6,'released object is a KAB-250LG-E');assert.ok(released.slice(3,13).every(Number.isFinite));
const cm=make();assert.equal(cm.request_countermeasure(0),1);for(let i=0;i<240;i++)cm.step(1/120);const count=read(cm,'get_countermeasure_state',16);assert.ok(count[0]<60&&count[1]<60,'flare and chaff programs dispense native decoys');
const aircraft=make();aircraft.set_map(2);aircraft.reset_sortie_spawn(0,0,0);let takeoffTime;
for(let i=0;i<120*80;i++){const s=state(aircraft);aircraft.set_controls(s[13]>80?.5:0,0,0,1.1,s[1]>50?0:1,0,0,1);aircraft.step(1/120);if(s[1]>80){takeoffTime=i/120;break;}}
assert.ok(takeoffTime&&takeoffTime<50,'takeoff from the existing runway');assert.equal(state(aircraft)[33],0,'takeoff remains intact');
console.log(JSON.stringify({result:'PASS',engagements,gunRounds:150,reload:true,laserPod:true,bombRelease:true,countermeasures:true,takeoffSeconds:takeoffTime}));
