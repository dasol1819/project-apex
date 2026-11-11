// Input ownership only. Attitude, rates, FBW and surfaces remain native C++.
// Physical axes override direction assistance only for the current sample.
// Releasing a key/stick never latches a different control mode.
export class PilotAuthority {
 constructor(){this.reset('aim')}
 reset(mode='aim'){this.manual=mode==='manual';this.direct=this.manual;this.axisMask=0;this.axesActive=false;this.pointerIntent=false;this.pointerDuringAxes=false;this.rebaseOnRelease=false;this.source=this.manual?'manual':'aim'}
 axes(pitch,roll,yaw,source='axes',heldMask=0){
  const previous=this.axisMask;
  this.axisMask=[pitch,roll,yaw].reduce((m,v,i)=>m|(Number.isFinite(v)&&Math.abs(v)>1e-4?1<<i:0),heldMask&7);
  this.axesActive=this.axisMask!==0;
  if(!previous&&this.axesActive)this.pointerDuringAxes=this.pointerIntent;
  this.rebaseOnRelease=previous!==0&&!this.axesActive&&!this.pointerDuringAxes;
  if(!this.axesActive)this.pointerDuringAxes=false;
  this.direct=this.manual||this.axesActive;this.source=this.manual?'manual':this.axesActive?source:'aim';
  return this.direct;
 }
 pointerMoved(dx,dy){if(this.manual||!Number.isFinite(dx+dy)||Math.hypot(dx,dy)<1e-4)return false;this.pointerIntent=true;if(this.axesActive)this.pointerDuringAxes=true;return true}
 resumeAim(){this.reset('aim');this.pointerIntent=true}
 consumePointerIntent(){const value=this.pointerIntent;this.pointerIntent=false;return value}
}
