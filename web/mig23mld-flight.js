// MiG-23MLD game-assist wing scheduler (real aircraft used a manual selector).
// State indices belong to native flight.wasm: TAS[13], IAS[14], Mach[15],
// AoA[16], G[18], gear[21], density[24].
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const MIG23_SWEEP_STOPS=Object.freeze([16,33,45,72]);
export const MIG23_SWEEP_MIN=16,MIG23_SWEEP_MAX=72;
export function mig23AutomaticSweep(state,previousTarget=16){
 const mach=clamp(Number(state?.[15])||0,0,3);
 const iasKmh=(Number(state?.[14])||0)*3.6;
 // User-selected game assistance: discrete targets with separate entry/exit
 // thresholds. Remember the target, not the slowly moving hydraulic angle.
 if(previousTarget===72)return mach<1?45:72;
 if(mach>1.1)return 72;
 if(previousTarget>=45)return iasKmh<400?16:45;
 return iasKmh>500?45:16;
}
export function createMig23SweepController(sim){
 let mode='AUTO',target=16,commanded=NaN;
 const read=()=>{
  if(!sim?.get_aircraft_configuration||!sim?.memory)return [1,16,0,target];
  return new Float64Array(sim.memory.buffer,sim.get_aircraft_configuration(),8);
 };
 const issue=value=>{
  const angle=clamp(Number(value)||16,16,72);
  if(!Number.isFinite(commanded)||Math.abs(commanded-angle)>.05){
   sim?.set_wing_sweep?.(angle);commanded=angle;
  }
 };
 function reset(){mode='AUTO';target=16;commanded=NaN;issue(16);}
 function automatic(){mode='AUTO';commanded=NaN;}
 function manual(angle){mode='MANUAL';target=clamp(Number(angle)||16,16,72);issue(target);}
 function cycle(){
  if(mode==='AUTO'){manual(16);return '16°';}
  const index=MIG23_SWEEP_STOPS.findIndex(x=>x>target+1);
  if(index<0){automatic();return 'AUTO';}
  manual(MIG23_SWEEP_STOPS[index]);return target+'°';
 }
 function update(dt,state){
  if(mode==='AUTO'&&dt>0)target=mig23AutomaticSweep(state,target);
  // The native WASM performs hydraulic-rate limiting. Repeated set commands
  // only update the desired detent and do not teleport the current sweep.
  if(dt>0&&Number.isFinite(target))issue(target);
  return snapshot();
 }
 function snapshot(){const c=read();return {mode,target,angle:Number(c[1]),nativeTarget:Number(c[3]),automatic:mode==='AUTO'};}
 reset();
 return {reset,automatic,manual,cycle,update,snapshot,get mode(){return mode},get target(){return target}};
}
