import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'public'),imports={env:{pow:Math.pow,atan2:Math.atan2,asin:Math.asin,external_terrain:()=>0}};
const current=new WebAssembly.Module(fs.readFileSync(path.join(root,'flight.wasm'))),previous=new WebAssembly.Module(fs.readFileSync('.native-build/mig29-baseline.wasm'));
const make=(type=15,module=current)=>{const s=new WebAssembly.Instance(module,imports).exports;s.set_aircraft_type(type);s.reset_spawn(1);return s;};
const read=(s,n,l)=>Array.from(new Float64Array(s.memory.buffer,s[n](),l)),state=s=>read(s,'get_state',104);
let legacyTicks=0;
for(let type=0;type<15;type++){
 const a=make(type,previous),b=make(type);
 for(const[n,l]of [['get_aircraft_specs',28],['get_radar_profile',10],['get_loadout_state',16],['get_aircraft_gear_contacts',9]])assert.deepEqual(read(b,n,l),read(a,n,l),'legacy '+type+' '+n);
 for(let i=0;i<1200;i++){for(const s of[a,b]){s.set_controls(i<300?.2:0,i>=300&&i<600?.2:0,i>=600&&i<900?.15:0,.72,0,0,0,1);s.step(1/120);}if(i%120===0)assert.deepEqual(state(b),state(a),'legacy trajectory '+type+' tick '+i);legacyTicks++;}
}
const s=make(),spec=read(s,'get_aircraft_specs',28);assert.equal(s.get_aircraft_type(),15);assert.equal(spec[1],1);assert.equal(spec[6],20.6);assert.equal(spec[7],10.085);assert.equal(spec[8],3580);assert.equal(spec[16],200);assert.equal(spec[2],spec[3]);assert.ok(Math.abs(spec[4]-26.483)<.01);assert.equal(spec[12],0);assert.equal(spec[18],0);assert.equal(spec[27],0);
assert.equal(s.set_loadout(45),1);assert.equal(s.set_loadout(42),0);assert.equal(read(s,'get_loadout_state',16)[8],0);
assert.deepEqual(read(s,'get_aircraft_gear_contacts',9),[0,-1.4,-3.03,-1.63,-1.4,.25,1.63,-1.4,.25]);
assert.equal(read(s,'get_radar_profile',10)[8],0);s.set_radar_power(1);assert.equal(read(s,'get_radar_state',32)[0],0);
assert.deepEqual(read(s,'get_countermeasure_state',16).slice(0,2),[0,0]);assert.equal(s.request_countermeasure(3),0);assert.ok(s.request_missile_fire()<=0);assert.ok(s.request_amraam_fire()<=0);
let scenarios=0;
for(const speed of[80,150,250,320])for(const pitch of[-.4,0,.8]){
 s.reset_spawn(1);s.debug_set_state(0,6000,0,0,0,-speed,0,0,0,1);s.set_tvc(1);
 for(let i=0;i<720;i++){s.set_controls(pitch,.2,.12,1.2,0,0,0,1);s.step(1/120);if(i%120===0){const st=state(s);assert.ok(st.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...st.slice(6,10))-1)<1.e-9);assert.equal(st[62],0,'no AB state');assert.equal(st[86],0);assert.equal(st[87],0);assert.ok(st[42]<=1,'dry throttle clamp');}}scenarios++;
}
s.reset_spawn(1);s.debug_set_state(0,5000,0,0,0,-180,0,0,0,1);s.set_controls(0,0,0,.7,1,0,0,1);for(let i=0;i<600;i++)s.step(1/120);assert.ok(Math.abs(state(s)[51]-Math.PI/6)<1e-5,'30 degree flaps');assert.ok(Math.abs(state(s)[55])<1e-8,'no airbrake rudder toe');
// One complete magazine must emit 200 physical native projectiles. Every fifth
// projectile is the separate 37mm impact class, retaining per-shot identity.
s.reset_spawn(1);s.debug_set_state(0,5000,0,0,0,-200,0,0,0,1);s.set_controls(0,0,0,.85,0,0,0,1);s.set_trigger(1);for(let i=0;i<900;i++)s.step(1/120);
const gun=read(s,'get_combat',12);assert.equal(gun[0],0);assert.equal(gun[4],200);
const raw=new DataView(s.memory.buffer);let nr=0,n37=0;for(let i=0;i<200;i++){const tracer=raw.getInt32(14258880+i*88,true);tracer?n37++:nr++;}
assert.equal(nr,160);assert.equal(n37,40);
s.reset_spawn(1);s.damage_part(10,1);s.set_trigger(1);for(let i=0;i<120;i++)s.step(1/120);assert.equal(read(s,'get_combat',12)[4],0,'detached nose cannot shoot');
s.reset_spawn(1);assert.equal(read(s,'get_combat',12)[0],200,'respawn restores ammunition');
// Match the new player with a real native target through the existing combat
// bridge. This catches visual-only guns and projectile/damage integration bugs.
const {createFleetBridge}=await import(pathToFileURL(path.join(root,'fleet-bridge.js')));
const shooter=make(),target=make(15);shooter.debug_set_state(0,5000,0,0,0,-200,0,0,0,1);target.debug_set_state(0,5000,-250,0,0,-200,0,0,0,1);
for(const a of[shooter,target])a.set_controls(0,0,0,.7,0,0,0,1);
const bridge=createFleetBridge([{id:1,team:0,active:true,sim:shooter},{id:101,team:1,active:true,sim:target}]);shooter.set_trigger(1);for(let i=0;i<480;i++)bridge.step(1/120);assert.ok(read(target,'get_systems',256).some((v,i)=>i>=16&&(i-16)%8===0&&v<.99),'native cannon damage');
const ai=make();ai.set_combat_ai(1,.8,0);const aiTarget=make(2);aiTarget.debug_set_state(0,5000,-900,0,0,-160,0,0,0,1);ai.debug_set_state(0,5000,0,0,0,-200,0,0,0,1);const fleet=createFleetBridge([{id:1,team:0,active:true,sim:ai},{id:101,team:1,active:true,sim:aiTarget}]);for(let i=0;i<1200;i++)fleet.step(1/120);assert.ok(state(ai).every(Number.isFinite));assert.equal(ai.get_aircraft_type(),15);
console.log(JSON.stringify({result:'PASS',nativeAircraft:15,legacyAircraft:15,legacyTicks,flightEnvelopeScenarios:scenarios,projectiles:200,nr23:160,n37d:40,radar:false,afterburner:false,nativeGunHits:true,aiFlight:true}));
