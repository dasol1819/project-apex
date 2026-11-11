const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const DEFAULT_AXIS_SETTINGS=Object.freeze({deadZone:.08,nonlinearity:1.5,response:1,handoff:'heading'});
export function axisSettings(value={}){
 return {deadZone:clamp(finite(value.deadZone,.08),0,.3),nonlinearity:clamp(finite(value.nonlinearity,1.5),1,3),response:clamp(finite(value.response,1),.1,1),handoff:value.handoff==='target'?'target':'heading'};
}
export function loadAxisSettings(storage){try{return axisSettings(JSON.parse(storage?.getItem('raptor.axes.v1')||'{}'));}catch{return axisSettings();}}
export function shapeAxis(value,settings=DEFAULT_AXIS_SETTINGS){
 const x=clamp(finite(value),-1,1),a=Math.abs(x),d=settings.deadZone;
 return a<=d?0:Math.sign(x)*Math.pow((a-d)/(1-d),settings.nonlinearity);
}
// Input shaping only. Native C++/WASM owns rates, aerodynamic protection,
// actuator travel and forces. Keyboard commands remain immediate and linear.
export class PilotAxisInput{
 constructor(settings){this.configure(settings);this.reset();}
 configure(settings){this.settings=axisSettings(settings);return this.settings;}
 reset(){this.filtered=[0,0,0];}
 sample({digital=[[false,false],[false,false],[false,false]],touch=[0,0,0],pad=[0,0,0],dt=1/120}={}){
  const values=[],s=this.settings,tau=(1-s.response)*.22;
  const alpha=tau<1e-6?1:1-Math.exp(-clamp(finite(dt),0,.1)/tau);
  let mask=0;
  for(let i=0;i<3;i++){
   const target=clamp(shapeAxis(touch[i],s)+shapeAxis(pad[i],s),-1,1);
   this.filtered[i]+=(target-this.filtered[i])*alpha;
   if(Math.abs(this.filtered[i])<1e-4)this.filtered[i]=0;
   const [positive,negative]=digital[i]||[];
   const held=!!(positive||negative);
   values[i]=held?Number(!!positive)-Number(!!negative):this.filtered[i];
   if(held||Math.abs(values[i])>1e-4)mask|=1<<i;
  }
  return {pitch:values[0],roll:values[1],yaw:values[2],mask};
 }
}
