import * as T from './vendor/three.module.js';

export function bodyCenter(position,quaternion,target=new T.Vector3()){
 return target.set(0,.18,-.55).applyQuaternion(quaternion).add(position);
}
// Pilot-eye forward view: attitude is exact, including roll and inverted flight.
// The app hides the own-aircraft exterior; no cockpit mesh is required.
export class PilotCamera{
 update(camera,position,quaternion,type=0){
  camera.position.set(0,[1.12,1.25,1.03,1.22,1.46,1.53,1.53,1.70,2.15,.83,1.20,1.20,1.20,1.38][type]??1.12,[-5.1,-5.1,-3.85,-3.85,-5.45,-5.55,-5.55,-7.15,-19.8,-.50,-5.15,-4.8,-4.8,-6.15][type]??-5.1).applyQuaternion(quaternion).add(position);
  camera.quaternion.copy(quaternion);
  camera.up.set(0,1,0).applyQuaternion(quaternion);
  camera.updateMatrixWorld();
 }
}
export class BodyChaseCamera{
 constructor(){this.orientation=new T.Quaternion();this.offset=new T.Vector3();this.up=new T.Vector3();this.initialized=false;}
 reset(){this.initialized=false;}
 update(camera,center,quaternion,dt,distance,heightAt){
  if(!this.initialized){this.orientation.copy(quaternion);this.initialized=true;}
  else this.orientation.slerp(quaternion,1-Math.exp(-Math.max(dt,0)*8));
  // Smooth attitude only. World translation is applied equally to the camera
  // and its target, so airspeed never shifts the anchor toward the tail.
  this.offset.set(0,distance*.17,distance).applyQuaternion(this.orientation);
  camera.position.copy(center).add(this.offset);
  camera.position.y=Math.max(camera.position.y,heightAt(camera.position.x,camera.position.z)+2);
  this.up.set(0,1,0).applyQuaternion(this.orientation).multiplyScalar(.20).add(new T.Vector3(0,.80,0)).normalize();
  camera.up.copy(this.up);camera.lookAt(center);camera.updateMatrixWorld();return center;
 }
}

// After a fatal impact, linger over the contact area so the departing pieces
// stay visible. The look target still follows the actual central body section.
export class WreckageCamera{
 constructor(){this.anchor=new T.Vector3();this.offset=new T.Vector3();this.desired=new T.Vector3();this.age=0;this.initialized=false;}
 reset(){this.initialized=false;}
 update(camera,center,quaternion,dt,distance,heightAt){
  if(!this.initialized){this.anchor.copy(center);this.age=0;this.initialized=true;}
  this.age+=Math.max(dt,0);
  this.anchor.lerp(center,1-Math.exp(-Math.max(dt,0)*(this.age<1.2?.08:1.6)));
  this.offset.set(0,0,1).applyQuaternion(quaternion);this.offset.y=0;
  if(this.offset.lengthSq()<.001)this.offset.set(0,0,1);
  this.offset.normalize().multiplyScalar(distance*1.8);this.offset.y=Math.max(18,distance*.65);
  this.desired.copy(this.anchor).add(this.offset);
  camera.position.lerp(this.desired,1-Math.exp(-Math.max(dt,0)*6));
  camera.position.y=Math.max(camera.position.y,heightAt(camera.position.x,camera.position.z)+2);
  camera.up.set(0,1,0);camera.lookAt(center);camera.updateMatrixWorld();return center;
 }
}
