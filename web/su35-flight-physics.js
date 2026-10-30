// SPDX-License-Identifier: GPL-2.0-only
// Public specifications plus estimated aerodynamic derivatives for a game FDM.
import * as T from './vendor/three.module.js';
const G=9.80665,DEG=Math.PI/180,clamp=T.MathUtils.clamp;
const V=(...a)=>new T.Vector3(...a);
export const SU35_FLIGHT=Object.freeze({emptyMass:19000,maxFuel:11500,maxMass:34500,area:62,span:15.3,chord:4.2,
  dryThrust:2*86400,wetThrust:2*142200,maxG:9,minG:-3,maxAlpha:28*DEG,vectorLimit:15*DEG,
  maxMach:2.25,maxDynamicPressure:92000,
  inertia:[180000,270000,40000],cg:[0,.12,1.2],thrustArm:6.35,source:'UAC Su-35 public specifications; aerodynamic derivatives and inertia estimated'});

export function standardAtmosphere(altitude){
  const h=clamp(altitude,0,32000),temperature=h<11000?288.15-.0065*h:h<20000?216.65:216.65+.001*(h-20000);
  const pressure=h<11000?101325*Math.pow(temperature/288.15,5.25588):h<20000?22632.06*Math.exp(-G*(h-11000)/(287.05287*temperature)):5474.889*Math.pow(216.65/temperature,G/(.001*287.05287));
  return {temperature,pressure,density:pressure/(287.05287*temperature),sound:Math.sqrt(1.4*287.05287*temperature)};
}
export function liftCoefficient(alpha,gear=0){
  const attached=.12+4.6*alpha+.20*gear,blend=clamp((Math.abs(alpha)-24*DEG)/(20*DEG),0,1);
  return T.MathUtils.lerp(clamp(attached,-1.65,2.10),1.05*Math.sin(2*alpha),blend*blend*(3-2*blend));
}
export function evaluateSu35({speed=200,alpha=0,beta=0,altitude=1500,mass=25000,throttle=.65,gear=0,airbrake=0}={}){
  const air=standardAtmosphere(altitude),q=.5*air.density*speed*speed,mach=speed/air.sound,CL=liftCoefficient(alpha,gear);
  const aspect=SU35_FLIGHT.span**2/SU35_FLIGHT.area,k=1/(Math.PI*aspect*.78);
  const wave=.025*Math.exp(-(((mach-1.12)/.27)**2));
  const CD=.023+k*CL*CL+.65*Math.sin(alpha)**4+.23*beta*beta+.035*gear+.11*airbrake+wave;
  const command=clamp(throttle,0,1),dry=Math.min(command/.85,1),ab=clamp((command-.85)/.15,0,1);
  const seaThrust=SU35_FLIGHT.dryThrust*dry+(SU35_FLIGHT.wetThrust-SU35_FLIGHT.dryThrust)*ab;
  const thrust=seaThrust*Math.pow(air.density/1.225,.70)*(1+.20*Math.min(mach,1.5));
  const lift=q*SU35_FLIGHT.area*CL,drag=q*SU35_FLIGHT.area*CD,weight=mass*G;
  return {air,q,mach,CL,CD,lift,drag,weight,thrust,loadFactor:lift/weight,wingLoading:mass/SU35_FLIGHT.area,
    specificExcessPower:(thrust-drag)*speed/weight,afterburner:ab};
}

export class Su35Flight {
  constructor(options={}){this.reset(options);}
  reset({speed=210,altitude=1500,fuel=6000,payload=0}={}){
    this.position=V(0,altitude,0);this.velocity=V(0,0,-speed);this.angularVelocity=V();this.orientation=new T.Quaternion();
    this.fuel=clamp(fuel,0,SU35_FLIGHT.maxFuel);this.payload=clamp(payload,0,Math.min(8000,SU35_FLIGHT.maxMass-SU35_FLIGHT.emptyMass-this.fuel));this.engine=.62;this.time=0;this.crashed=false;
    this.gear=0;this.controls={pitch:0,roll:0,yaw:0,throttle:.62,gear:0,airbrake:0,tvc:true};
    const mass=SU35_FLIGHT.emptyMass+this.fuel+this.payload,q=.5*standardAtmosphere(altitude).density*speed*speed;
    this.orientation.setFromAxisAngle(V(1,0,0),clamp((mass*G/(q*SU35_FLIGHT.area)-.12)/4.6,-.05,.35));
    this.telemetry=this.forces();return this;
  }
  get mass(){return SU35_FLIGHT.emptyMass+this.fuel+this.payload;}
  forces(){
    const inverse=this.orientation.clone().invert(),local=this.velocity.clone().applyQuaternion(inverse),speed=local.length();
    const alpha=Math.atan2(-local.y,Math.max(.01,-local.z)),beta=Math.asin(clamp(local.x/Math.max(1,speed),-1,1));
    const c=this.controls,pitch=clamp(c.pitch,-1,1),roll=clamp(c.roll,-1,1),yaw=clamp(c.yaw,-1,1);
    const result=evaluateSu35({speed,alpha,beta,altitude:this.position.y,mass:this.mass,throttle:this.fuel>0?this.engine:0,gear:this.gear,airbrake:c.airbrake});
    const {q,lift,drag,thrust}=result,S=SU35_FLIGHT.area,b=SU35_FLIGHT.span,chord=SU35_FLIGHT.chord;
    const direction=local.clone().normalize(),liftDirection=V(0,Math.cos(alpha),-Math.sin(alpha));
    const aero=direction.multiplyScalar(-drag).addScaledVector(liftDirection,lift);aero.x-=q*S*.65*beta;
    const targetG=pitch>=0?1+pitch*8:1+pitch*4;
    const targetLift=targetG*this.mass*G-thrust*Math.sin(alpha);
    const targetAlpha=clamp((targetLift/Math.max(500,q*S)-.12-.20*this.gear)/4.6,-12*DEG,SU35_FLIGHT.maxAlpha);
    const authority=clamp(1-q/28000,.12,1),vectorPitch=c.tvc?clamp(-(targetAlpha-alpha)*.65-pitch*.12,-SU35_FLIGHT.vectorLimit,SU35_FLIGHT.vectorLimit)*authority:0;
    const thrustForce=V(0,thrust*Math.sin(vectorPitch),-thrust*Math.cos(vectorPitch));
    const rate=this.angularVelocity,invSpeed=1/Math.max(speed,30);
    const rollCoefficient=clamp((-roll*4.2-rate.z)*.36*b*.5*invSpeed,-.052,.052);
    const moment=V(q*S*chord*(.48*(targetAlpha-alpha)-12*rate.x*chord*.5*invSpeed),
      q*S*b*(-.13*beta-.06*yaw-.40*rate.y*b*.5*invSpeed),
      q*S*b*rollCoefficient);
    moment.x-=SU35_FLIGHT.thrustArm*thrustForce.y;
    // The body origin is the estimated CG; engine force is applied aft of it.
    const force=aero.clone().add(thrustForce).applyQuaternion(this.orientation);force.y-=this.mass*G;
    return {...result,speed,alpha,beta,targetAlpha,vectorPitch,force,moment,aero,thrustForce,altitude:this.position.y,mass:this.mass,
      pitch,roll,yaw,pitchSurface:clamp((targetAlpha-alpha)*4,-1,1),rollSurface:clamp(-rollCoefficient/.052,-1,1),normalG:(aero.y+thrustForce.y)/(this.mass*G)};
  }
  step(dt=1/120,controls={}){
    Object.assign(this.controls,controls);if(this.crashed)return this.telemetry;
    const steps=Math.max(1,Math.ceil(dt/(1/120))),h=Math.min(dt/steps,1/120);
    for(let n=0;n<steps;n++){
      const air=standardAtmosphere(this.position.y),speed=this.velocity.length(),q=.5*air.density*speed*speed,mach=speed/air.sound;
      const protection=Math.min(1,Math.pow(SU35_FLIGHT.maxDynamicPressure/Math.max(1,q),3),Math.pow(SU35_FLIGHT.maxMach/Math.max(.1,mach),6));
      this.powerLimit=clamp(protection,.05,1);
      this.engine+=((this.fuel>0?clamp(this.controls.throttle,0,1)*this.powerLimit:0)-this.engine)*(1-Math.exp(-h/1.25));
      this.gear+=clamp((this.controls.gear?1:0)-this.gear,-h/4,h/4);
      const t=this.forces(),inertia=SU35_FLIGHT.inertia.map(i=>i*this.mass/25000),omega=this.angularVelocity;
      const momentum=V(omega.x*inertia[0],omega.y*inertia[1],omega.z*inertia[2]);
      const angular=t.moment.clone().sub(omega.clone().cross(momentum));
      omega.x+=angular.x/inertia[0]*h;omega.y+=angular.y/inertia[1]*h;omega.z+=angular.z/inertia[2]*h;
      const spin=omega.length();if(spin>0)this.orientation.multiply(new T.Quaternion().setFromAxisAngle(omega.clone().divideScalar(spin),spin*h)).normalize();
      this.velocity.addScaledVector(t.force,h/this.mass);this.position.addScaledVector(this.velocity,h);
      this.fuel=Math.max(0,this.fuel-t.thrust*T.MathUtils.lerp(.000022,.000053,t.afterburner)*h);this.time+=h;
      if(this.position.y<(this.gear>.9?2.22:1.1)){this.crashed=true;break;}
    }
    this.telemetry=this.forces();return this.telemetry;
  }
}
