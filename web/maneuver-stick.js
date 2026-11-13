const G=9.80665,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const finite=(x,fallback=0)=>Number.isFinite(x)?x:fallback;
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));

// Pilot commands only. The native C++ FBW computes surface motion, achievable
// load, AoA protection and aerodynamic forces; no pose or velocity is replaced.
export class ManeuverStick{
 constructor(){this.reset();}
 reset(){this.active=false;this.flightPath=0;}
 sample(input,state,specs){
  const pitch=clamp(finite(input.pitch),-1,1),roll=clamp(finite(input.roll),-1,1),yaw=clamp(finite(input.yaw),-1,1);
  const speed=Math.max(50,finite(state[13],50)),bank=finite(state[29]),gamma=Math.atan2(finite(state[4]),Math.hypot(finite(state[3]),finite(state[5])));
  if(!this.active){this.flightPath=gamma;this.active=true;}
  const ground=state[34]>.5&&state[31]<5;
  if(ground){
   this.flightPath=gamma;
   return {pitch,roll,yaw:clamp(yaw+roll*.75,-1,1),gCommand:false,bankTarget:0,load:1};
  }
  if(input.mask&1)this.flightPath=gamma;
  const maxG=Math.max(1.1,finite(specs[10],7.5)),minG=Math.min(0,finite(specs[11],-3));
  const profileLoad=clamp(maxG*.75,1.25,5.5);
  const availableLoad=clamp(profileLoad*(Math.max(0,finite(state[14],speed))/140)**2,1.1,profileLoad);
  const bankTarget=Math.atan(roll*Math.sqrt(availableLoad*availableLoad-1));
  let rollCommand=clamp(.65*wrap(bankTarget-bank)+.15*finite(state[12]),-.75,.75);
  // A strong elevator pull retains body-axis roll authority through a loop.
  // Fade the bank servo before the Euler-bank singularity, not after crossing
  // the pole when a level-wing demand would impose an unwanted half roll.
  const vertical=clamp((.35-Math.abs(Math.cos(finite(state[30]))))/.15,0,1);
  const elevator=clamp((Math.abs(pitch)-.65)/.2,0,1),freeRoll=Math.max(vertical,elevator);
  rollCommand+=(roll-rollCommand)*freeRoll;
  const cosine=Math.cos(bank),correction=clamp((this.flightPath-gamma)*speed/G,-1.5,1.5);
  const base=cosine>0?Math.cos(gamma)/Math.max(.15,cosine)+correction:0;
  const trim=clamp(base,minG,maxG);
  const load=pitch>=0?trim+pitch*(maxG-trim):trim+pitch*(trim-minG);
  const pitchCommand=clamp((load-1)/(load>=1?maxG-1:1-minG),-1,1);
  const coordination=clamp(G/speed*Math.sin(bank)/.5+finite(state[17])*2,-.6,.6);
  const yawCommand=clamp(yaw+coordination*(1-Math.abs(yaw)),-1,1);
  return {pitch:pitchCommand,roll:rollCommand,yaw:yawCommand,gCommand:true,bankTarget,load};
 }
}
