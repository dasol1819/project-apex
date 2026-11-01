import * as T from './vendor/three.module.js';
import {createAircraft} from './aircraft.js?v=inspector-3';
import {disposeObject} from './aircraft-catalog.js';
import {heightAt} from './terrain.js';
import {STALINGRAD} from './stalingrad-data.js';
import {basesForMap,mapCode} from './map-data.js';

// Temporary actors use independent native memories. The player's pose, stores,
// chosen map, mission, scores and saved progress are never reset by this test.
export async function createGraphicsWorkload({scene,renderer,camera,world,aircraft,module,imports,map,renderScene}){
 const landmark=map==='stalingrad'?(STALINGRAD.landmarks.find(p=>p.kind==='factory')??STALINGRAD.landmarks[0]):basesForMap(map)[0];
 const anchor=new T.Vector3(landmark.x,heightAt(landmark.x,landmark.z)+400,landmark.z),models=[],actors=[];
 const priorVisible=aircraft.group.visible,priorCamera=camera.clone();let first=null,last=null,acc=0,disposed=false;
 const instances=await Promise.all(Array.from({length:5},()=>WebAssembly.instantiate(module,imports)));
 try{
  for(let i=0;i<5;i++){
   const type=[3,6,8,3,5][i],sim=instances[i].exports;sim.set_map(mapCode(map));sim.set_aircraft_type(type);sim.reset_spawn(2);sim.set_invincible(1);
   const offset=new T.Vector3((i-1)*100,i===2?70:0,i*55);actors.push({sim,offset});
   if(i<3){const model=createAircraft(type);models.push(model);scene.add(model.group);}
  }
  aircraft.group.visible=false;camera.clearViewOffset();camera.fov=52;camera.updateProjectionMatrix();world.terrain.update(anchor,true);
 }catch(error){for(const m of models)disposeObject(m.group);camera.copy(priorCamera);aircraft.group.visible=priorVisible;throw error;}
 function reset(){first=last=null;acc=0;}
 function render(now){
  if(disposed)return;if(first===null)first=now;const dt=Math.min(last===null?1/60:(now-last)/1000,.15);last=now;acc+=dt;
  for(let i=0;i<actors.length;i++){
   const {sim,offset}=actors[i];sim.debug_set_state(anchor.x+offset.x,anchor.y+offset.y,anchor.z+offset.z,0,0,-200,0,0,0,1);
   sim.set_controls(.06,.08,.02,1,0,0,1,1);
   for(let step=0;step<Math.min(18,Math.floor(acc*120));step++)sim.step(1/120);
   if(models[i]){const state=new Float64Array(sim.memory.buffer,sim.get_state(),104);models[i].group.position.set(...state.subarray(0,3));models[i].group.quaternion.set(...state.subarray(6,10));models[i].update({gear:0,engine:state[20],afterburner:0,leftTail:state[49],rightTail:state[50],leftAileron:state[53],rightAileron:state[54],time:(now-first)/1000},dt);}
  }
  acc%=1/120;
  const angle=(now-first)/1000*.55+.5;
  camera.position.set(anchor.x+Math.sin(angle)*520,anchor.y+160,anchor.z+Math.cos(angle)*520);camera.up.set(0,1,0);camera.lookAt(anchor);camera.updateMatrixWorld();world.update((now-first)/1000,anchor,camera);renderScene(renderer,scene,camera);
 }
 function dispose(){if(disposed)return;disposed=true;for(const model of models)disposeObject(model.group);models.length=actors.length=0;aircraft.group.visible=priorVisible;camera.copy(priorCamera);}
 return{reset,render,dispose};
}
