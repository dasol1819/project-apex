import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public');
const original=fs.readFileSync('.native-build/su35-baseline.wasm'),extended=fs.readFileSync(path.join(root,'flight.wasm'));
const imports={env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}};
const oldModule=new WebAssembly.Module(original),newModule=new WebAssembly.Module(extended);
const make=(module=newModule)=>new WebAssembly.Instance(module,imports).exports;
const read=(sim,name,count)=>Array.from(new Float64Array(sim.memory.buffer,sim[name](),count));
const state=sim=>read(sim,'get_state',104),systems=sim=>read(sim,'get_systems',256);
let legacyTicks=0;
for(let type=0;type<14;type++){
  const a=make(oldModule),b=make();
  for(const sim of [a,b]){sim.set_aircraft_type(type);sim.reset_spawn(1);sim.set_tvc(1);}
  for(const [name,n]of [['get_aircraft_specs',28],['get_radar_profile',10],['get_loadout_state',16],['get_aircraft_gear_contacts',9]])assert.deepEqual(read(b,name,n),read(a,name,n),'legacy '+type+' '+name);
  for(let i=0;i<1200;i++){
    for(const sim of [a,b]){sim.set_controls(i<300?.2:0,i>=300&&i<600?.2:0,i>=600&&i<900?.15:0,.72,0,0,0,1);sim.step(1/120);}
    if(i%120===0)assert.deepEqual(state(b),state(a),'unchanged native trajectory '+type+' at '+i);
    legacyTicks++;
  }
}
const sim=make();sim.set_aircraft_type(14);sim.reset_spawn(1);
assert.equal(sim.get_aircraft_type(),14);const spec=read(sim,'get_aircraft_specs',28);
assert.equal(spec[6],38);assert.equal(spec[7],11.36);assert.equal(spec[8],10900);assert.equal(spec[9],3500);assert.equal(spec[12],0);assert.equal(spec[16],150);assert.equal(spec[17],30);assert.equal(spec[24],18480);
const masses=[926,420,0];for(let id=42;id<=44;id++){sim.reset_spawn(0);assert.equal(sim.set_loadout(id),1);assert.equal(read(sim,'get_loadout_state',16)[8],masses[id-42]);}
for(const speed of [90,150,250,550])for(const pitch of [-.5,0,1]){sim.reset_spawn(1);sim.debug_set_state(0,6000,0,0,0,-speed,0,0,0,1);sim.set_tvc(1);for(let i=0;i<1200;i++){sim.set_controls(pitch,.2,.15,1.1,0,0,0,1);sim.step(1/120);if(i%120===0){const s=state(sim);assert.ok(s.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...s.slice(6,10))-1)<1e-10);assert.equal(s[86],0);assert.equal(s[87],0);}}}
sim.reset_spawn(1);sim.damage_part(1,1);sim.step(1/120);assert.equal(read(sim,'get_amraam_state',32)[16],0);sim.reset_spawn(1);assert.equal(systems(sim)[24],1);
console.log(JSON.stringify({result:'PASS',nativeAircraftId:14,legacyAircraft:14,legacyTicks,loadouts:3,flightEnvelopeScenarios:12}));
