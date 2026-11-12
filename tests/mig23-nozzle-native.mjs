import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'public');
const shape=JSON.parse(fs.readFileSync('assets/mig23mld/nozzle-damage-shape.json'));
const instantiate=file=>new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file)),{env:{pow:Math.pow,asin:Math.asin,atan2:Math.atan2,external_terrain:()=>0}}).exports;
const current=instantiate(path.join(root,'flight.wasm'));
const before=process.env.APEX_BASELINE_WASM?instantiate(process.env.APEX_BASELINE_WASM):null;
function bodies(sim,type,part){sim.set_aircraft_type(type);sim.reset_spawn(1);sim.damage_part(part,1);sim.step(1/120);const data=new Float64Array(sim.memory.buffer,sim.get_wreckage(),2+64*40);const out=[];for(let i=0;i<data[0];i++){const body=Array.from(data.slice(2+i*40,2+(i+1)*40));out.push({part:body[1],variant:body[2],pivot:body.slice(22,25),half:body.slice(25,28)});}return out;}
const nozzle=bodies(current,16,22).find(b=>b.part===22);assert.ok(nozzle,'native nozzle detaches');assert.deepEqual(nozzle.pivot,shape.pivot);assert.deepEqual(nozzle.half,shape.half);
let compared=0;
if(before)for(let type=0;type<=16;type++)for(let part=0;part<30;part++){
 const old=bodies(before,type,part).filter(b=>type!==16||b.part!==22),now=bodies(current,type,part).filter(b=>type!==16||b.part!==22);
 assert.deepEqual(now,old,'native other-part vectors preserved type '+type+' damage '+part);compared++;
}
console.log(JSON.stringify({result:'PASS',nozzle,otherNativeDamageFixturesCompared:compared,scope:'source-model box profile only; no certified aircraft mass centre/stop claims'}));
