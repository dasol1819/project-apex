import * as T from './vendor/three.module.js';
const RAD=Math.PI/180;
export function loadControlMode(storage){try{return storage?.getItem('raptor.control.v1')==='manual'?'manual':'aim';}catch{return 'aim';}}
export class AimCursor{
 constructor(){this.direction=new T.Vector3(0,0,-1);this.commandDirection=this.direction.clone();this.commandRotation=new T.Quaternion();this.commandStep=new T.Quaternion();this.heading=0;this.elevation=0;}
 reset(quaternion){this.direction.set(0,0,-1).applyQuaternion(quaternion);this.commandDirection.copy(this.direction);this.heading=Math.atan2(this.direction.x,-this.direction.z);this.elevation=Math.asin(T.MathUtils.clamp(this.direction.y,-1,1));return this;}
 sample(dt){
  // Pointer events arrive in render-sized batches. Resample their target on
  // the fixed physics clock so native target-velocity estimation does not
  // alternate between a jump and zero motion on catch-up ticks. Only the
  // direction command has this 20ms time constant; the reticle and physical
  // keyboard/stick commands remain immediate. Spherical motion stays defined
  // at vertical and opposite directions.
  const alpha=1-Math.exp(-T.MathUtils.clamp(dt,0,.1)/.02);
  this.commandRotation.setFromUnitVectors(this.commandDirection,this.direction);
  this.commandStep.identity().slerp(this.commandRotation,alpha);
  return this.commandDirection.applyQuaternion(this.commandStep).normalize();
 }
 move(dx,dy,width,height,sensitivity=.7,viewQuaternion){const scale=(.65+sensitivity*.75)*60*RAD/Math.max(240,Math.min(width,height));this.turn(dx*scale,-dy*scale,viewQuaternion);}
 stick(x,y,dt,sensitivity=.7,viewQuaternion){this.turn(x*dt*(35+55*sensitivity)*RAD,-y*dt*(35+55*sensitivity)*RAD,viewQuaternion);}
 turn(yaw,pitch,viewQuaternion){
  if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return;
  if(viewQuaternion){
   // The body-locked pilot camera may be banked or inverted. Keep pointer
   // motion in screen axes rather than reversing it against world up.
   const up=new T.Vector3(0,1,0).applyQuaternion(viewQuaternion),right=new T.Vector3(1,0,0).applyQuaternion(viewQuaternion);
   this.direction.applyAxisAngle(up,-yaw).applyAxisAngle(right,pitch).normalize();this.heading=Math.atan2(this.direction.x,-this.direction.z);this.elevation=Math.asin(T.MathUtils.clamp(this.direction.y,-1,1));
  }else{this.heading=Math.atan2(Math.sin(this.heading+yaw),Math.cos(this.heading+yaw));this.elevation+=pitch;}
  // Keep a unit direction across the zenith/nadir. A world-elevation clamp
  // prevents loops and reverses pointer feel in banked or inverted flight.
  if(!viewQuaternion)this.direction.set(Math.sin(this.heading)*Math.cos(this.elevation),Math.sin(this.elevation),-Math.cos(this.heading)*Math.cos(this.elevation)).normalize();
  if(Math.hypot(this.direction.x,this.direction.z)>1e-7)this.heading=Math.atan2(this.direction.x,-this.direction.z);
  this.elevation=Math.asin(T.MathUtils.clamp(this.direction.y,-1,1));
 }
}
export class AimChaseCamera{
 constructor(){
  this.direction=new T.Vector3(0,0,-1);this.initialized=false;this.look=new T.Vector3();
  this.velocity=new T.Vector3();this.error=new T.Vector3();this.step=new T.Vector3();
  this.previous=new T.Vector3();this.up=new T.Vector3(0,1,0);this.horizon=new T.Vector3();this.cross=new T.Vector3();this.rotation=new T.Quaternion();
 }
 reset(){this.initialized=false;this.velocity.set(0,0,0);}
 update(camera,center,direction,dt,distance,heightAt){
  if(!this.initialized){
   this.direction.copy(direction).normalize();this.velocity.set(0,0,0);
   this.up.set(0,Math.abs(this.direction.y)>.98?0:1,Math.abs(this.direction.y)>.98?1:0);
   this.up.addScaledVector(this.direction,-this.up.dot(this.direction)).normalize();this.initialized=true;
  }else{
   // Dampen a rotation on the unit sphere. Euler heading jumps by 180 degrees
   // at the zenith; independently filtering heading/elevation makes the view
   // swing sideways and changes the pointer's screen basis during a loop.
   const elapsed=T.MathUtils.clamp(dt,0,.1),frequency=12,decay=Math.exp(-frequency*elapsed);
   this.previous.copy(this.direction);this.rotation.setFromUnitVectors(this.direction,direction);
   this.error.set(this.rotation.x,this.rotation.y,this.rotation.z);
   const length=this.error.length(),angle=2*Math.atan2(length,this.rotation.w);
   if(length>1e-10)this.error.multiplyScalar(angle/length);else this.error.set(0,0,0);
   this.step.copy(this.error).multiplyScalar(1-(1+frequency*elapsed)*decay).addScaledVector(this.velocity,elapsed*decay);
   this.velocity.multiplyScalar((1-frequency*elapsed)*decay).addScaledVector(this.error,frequency*frequency*elapsed*decay);
   const turn=this.step.length();
   if(turn>1e-10)this.direction.applyAxisAngle(this.step.multiplyScalar(1/turn),turn).normalize();
   this.velocity.addScaledVector(this.direction,-this.velocity.dot(this.direction));
   // Parallel transport avoids a world-up singularity. Restore a level
   // horizon gradually away from the pole instead of flipping the view.
   this.rotation.setFromUnitVectors(this.previous,this.direction);this.up.applyQuaternion(this.rotation);
   this.horizon.set(0,1,0).addScaledVector(this.direction,-this.direction.y);
   const horizontal=this.horizon.length();
   if(horizontal>.2){
    this.horizon.multiplyScalar(1/horizontal);this.cross.crossVectors(this.up,this.horizon);
    const error=Math.atan2(this.direction.dot(this.cross),this.up.dot(this.horizon));
    const correction=T.MathUtils.clamp(error*5,-Math.PI/2,Math.PI/2)*elapsed*T.MathUtils.clamp((horizontal-.2)/.5,0,1);
    this.up.applyAxisAngle(this.direction,correction);
   }
   this.up.addScaledVector(this.direction,-this.up.dot(this.direction)).normalize();
  }
  camera.position.copy(center).addScaledVector(this.direction,-distance).addScaledVector(this.up,distance*.16);
  camera.position.y=Math.max(camera.position.y,heightAt(camera.position.x,camera.position.z)+2);
  this.look.copy(center).addScaledVector(this.direction,distance*2);camera.up.copy(this.up);camera.lookAt(this.look);camera.updateMatrixWorld();
 }
}
