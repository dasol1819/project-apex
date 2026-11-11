import * as T from './vendor/three.module.js';
const RAD=Math.PI/180;
export function loadControlMode(storage){try{return storage?.getItem('raptor.control.v1')==='manual'?'manual':'aim';}catch{return 'aim';}}
export class AimCursor{
 constructor(){this.direction=new T.Vector3(0,0,-1);this.heading=0;this.elevation=0;}
 reset(quaternion){this.direction.set(0,0,-1).applyQuaternion(quaternion);this.heading=Math.atan2(this.direction.x,-this.direction.z);this.elevation=Math.asin(T.MathUtils.clamp(this.direction.y,-1,1));return this;}
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
 constructor(){this.direction=new T.Vector3(0,0,-1);this.initialized=false;this.look=new T.Vector3();this.heading=0;this.elevation=0;this.headingRate=0;this.elevationRate=0;}
 reset(){this.initialized=false;}
 update(camera,center,direction,dt,distance,heightAt){
  const heading=Math.atan2(direction.x,-direction.z),elevation=Math.asin(T.MathUtils.clamp(direction.y,-1,1));
  if(!this.initialized){this.heading=heading;this.elevation=elevation;this.headingRate=this.elevationRate=0;this.initialized=true;}
  else{
   // Critically damped camera motion has a finite initial response. An abrupt
   // pointer move no longer instantly rotates the entire view at full speed.
   // This changes presentation only: the cursor and physical goal are exact.
   const elapsed=T.MathUtils.clamp(dt,0,.10),frequency=9,decay=Math.exp(-frequency*elapsed);
   const yawError=Math.atan2(Math.sin(this.heading-heading),Math.cos(this.heading-heading));
   const pitchError=this.elevation-elevation;
   const yawTerm=this.headingRate+frequency*yawError,pitchTerm=this.elevationRate+frequency*pitchError;
   this.heading=heading+(yawError+yawTerm*elapsed)*decay;this.elevation=elevation+(pitchError+pitchTerm*elapsed)*decay;
   this.headingRate=(this.headingRate-frequency*yawTerm*elapsed)*decay;this.elevationRate=(this.elevationRate-frequency*pitchTerm*elapsed)*decay;
  }
  this.direction.set(Math.sin(this.heading)*Math.cos(this.elevation),Math.sin(this.elevation),-Math.cos(this.heading)*Math.cos(this.elevation));
  camera.position.copy(center).addScaledVector(this.direction,-distance);camera.position.y+=distance*.16;camera.position.y=Math.max(camera.position.y,heightAt(camera.position.x,camera.position.z)+2);
  this.look.copy(center).addScaledVector(this.direction,distance*2);camera.up.set(0,1,0);camera.lookAt(this.look);camera.updateMatrixWorld();
 }
}
