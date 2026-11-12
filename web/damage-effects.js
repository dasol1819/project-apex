import {createPartEmitter} from './part-emitter.js?v=world-scale-1';
import {createDamagePlumes,damagePlumeStyle} from './damage-plume.js';
import {createDamageFlames} from './damage-flame.js';
import {enableWorldDepth} from './world-depth.js';
import * as T from './vendor/three.module.js';
import {heightAt} from './terrain.js';
import {createWreckageFactory} from './wreckage-mesh.js?v=posed-morph-1';
import {PARTS,MAX_WRECKAGE,readSystems,partValue} from './airframe-parts.js';

const clamp=T.MathUtils.clamp,STRIDE=40,MAX_BODIES=MAX_WRECKAGE;
const rand=n=>{const x=Math.sin(n*127.1+31.7)*43758.5453;return x-Math.floor(x);};
const noiseGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){return noise(p)*.57+noise(p*2.07+17.)*.28+noise(p*4.13-9.)*.15;}`;
function particleLayer(scene,capacity,fire){
 const quad=new T.PlaneGeometry(1,1),geometry=new T.InstancedBufferGeometry();geometry.index=quad.index;geometry.attributes.position=quad.attributes.position;geometry.attributes.uv=quad.attributes.uv;
 for(const [name,size]of [['aOffset',3],['aAge',1],['aSize',1],['aSeed',1],['aKind',1],['aGround',1]])geometry.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(capacity*size),size));
 geometry.instanceCount=0;
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:fire?T.AdditiveBlending:T.NormalBlending,uniforms:{clock:{value:0}},
 vertexShader:`attribute vec3 aOffset;attribute float aAge,aSize,aSeed,aKind,aGround;varying vec2 vUv;varying float age,seed,kind,nearFade,aboveGround;void main(){vUv=uv;age=aAge;seed=aSeed;kind=aKind;float a=aSeed*6.283;vec2 p=mat2(cos(a),sin(a),-sin(a),cos(a))*position.xy*aSize;vec4 view=viewMatrix*vec4(aOffset,1.);aboveGround=aOffset.y+dot(viewMatrix[1].xy,p)-aGround;nearFade=smoothstep(.6,max(1.5,aSize*.6),-view.z);view.xy+=p;gl_Position=projectionMatrix*view;}`,
 fragmentShader:`varying vec2 vUv;varying float age,seed,kind,nearFade,aboveGround;uniform float clock;${noiseGLSL}
 void main(){vec2 p=vUv*2.-1.;float t=clock*(kind>1.5?1.8:3.8);float n=fbm(p*2.8+vec2(seed*91.,-t));float edge=1.-smoothstep(.15+n*.30,1.,length(p));
 ${fire?`float hot=clamp((1.-length(p))*.9+n*.62-age*.45,0.,1.);float tongues=smoothstep(.20,.66,fbm(p*3.1+vec2(seed*13.,-t*1.7)));float alpha=smoothstep(.04,1.5,aboveGround)*nearFade*edge*(.52+.48*tongues)*pow(1.-age,1.25);vec3 col=mix(vec3(1.8,.075,.002),vec3(4.7,.75,.008),smoothstep(.10,.55,hot));col=mix(col,vec3(6.,3.2,.65),smoothstep(.65,.98,hot));if(alpha<.005)discard;gl_FragColor=vec4(col*(kind>1.5?1.:.62),alpha*(kind>1.5?.72:.58));`:
 `float alpha=smoothstep(.04,1.5,aboveGround)*nearFade*edge*(.47+.53*n)*smoothstep(0.,kind<.5?.025:.07,age)*pow(1.-age,.75);vec3 col=kind<.5?mix(vec3(.025,.023,.021),vec3(.13,.115,.095),n):kind<1.5?mix(vec3(.19,.15,.10),vec3(.34,.29,.21),n):mix(vec3(.52,.59,.61),vec3(.80,.86,.88),n);if(alpha<.004)discard;gl_FragColor=vec4(col,alpha*(kind<.5?.70:kind>2.5?.16:.48));`}
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 enableWorldDepth(material);const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=fire?7:6;mesh.name=fire?'fuel flame billboards':'smoke and impact dust';scene.add(mesh);
 const particles=[];
 function emit(p,v,size,life,kind=0,growth=2,drag=fire?.25:.16,ambient=null){
  if(particles.length>=capacity)particles.shift();particles.push({p:p.clone(),v:v.clone(),size,life,age:.001,fresh:true,seed:rand(p.x+p.z+particles.length*7.31+life),kind,growth,drag,ambient:ambient?.clone(),ground:heightAt(p.x,p.z)});
 }
 function update(dt,camera,time){
  for(let i=particles.length-1;i>=0;i--){const a=particles[i];if(a.fresh){a.fresh=false;continue;}a.age+=dt;if(a.age>=a.life){particles.splice(i,1);continue;}if(a.ambient)a.v.sub(a.ambient).multiplyScalar(Math.exp(-dt*a.drag)).add(a.ambient);else a.v.multiplyScalar(Math.exp(-dt*a.drag));a.p.addScaledVector(a.v,dt);a.p.y+=dt*(fire?1.5:1.0);}
  mesh.visible=particles.length>0;geometry.instanceCount=particles.length;if(!particles.length)return;
  // Alpha smoke is sorted back to front. Flame uses additive blending.
  if(!fire)particles.sort((a,b)=>b.p.distanceToSquared(camera.position)-a.p.distanceToSquared(camera.position));
  particles.forEach((p,i)=>{geometry.attributes.aOffset.setXYZ(i,p.p.x,p.p.y,p.p.z);geometry.attributes.aAge.setX(i,p.age/p.life);geometry.attributes.aSize.setX(i,p.size+p.age*p.growth);geometry.attributes.aSeed.setX(i,p.seed);geometry.attributes.aKind.setX(i,p.kind);geometry.attributes.aGround.setX(i,p.ground);});
  for(const [name,attribute]of Object.entries(geometry.attributes))if(name.startsWith('a'))attribute.needsUpdate=true;
  geometry.instanceCount=particles.length;material.uniforms.clock.value=time;
 }
 return {emit,update,particles,mesh,reset(){particles.length=0;geometry.instanceCount=0;mesh.visible=false;}};
}
export function createDamageEffects(scene,aircraft,{onImpact=()=>{}}={}){
 const factory=createWreckageFactory(aircraft),actors=new Map(),smoke=particleLayer(scene,640,false),flame=particleLayer(scene,320,true),micro=[],sparks=[],flashes=[],scorches=[],plumes=createDamagePlumes(scene),damageFlames=createDamageFlames(scene);
 const attachedEmitters=new Map();
 let serial=0,clock=0,emission=0,fatal=false,fireLevel=0,focus=null;
 const chunkMat=new T.MeshStandardMaterial({color:0x666765,roughness:.68,metalness:.63});
 const chunks=new T.InstancedMesh(new T.BoxGeometry(1,.045,.57),chunkMat,160);chunks.count=0;chunks.frustumCulled=false;chunks.castShadow=true;chunks.name='torn skin fragments';scene.add(chunks);
 const sparkGeo=new T.BufferGeometry();sparkGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(320*6),3));sparkGeo.setAttribute('color',new T.BufferAttribute(new Float32Array(320*6),3));sparkGeo.setDrawRange(0,0);
 const sparkMesh=new T.LineSegments(sparkGeo,new T.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));sparkMesh.frustumCulled=false;sparkMesh.renderOrder=7;sparkMesh.name='impact sparks';scene.add(sparkMesh);
 const lights=[new T.PointLight(0xff923b,0,80,2),new T.PointLight(0xffb55b,0,65,2)];lights.forEach(light=>scene.add(light));
 const object=new T.Object3D(),q=new T.Quaternion(),p=new T.Vector3(),v=new T.Vector3(),wind=new T.Vector3();
 function debrisBurst(point,normal,velocity,energy,water=false){
  const severity=clamp(Math.sqrt(energy)/900,1,16),count=Math.ceil(severity*2+4);
  for(let i=0;i<count;i++){
   const seed=clock*13+i*3.7+serial*17,direction=new T.Vector3(rand(seed)*2-1,rand(seed+1)*1.5,rand(seed+2)*2-1).normalize();
   const velocityOut=direction.multiplyScalar(4+severity*rand(seed+4)).addScaledVector(normal,3).addScaledVector(velocity,.22);
   if(!water){if(micro.length>=160)micro.shift();micro.push({p:point.clone(),v:velocityOut.clone(),rotation:new T.Vector3(),spin:new T.Vector3(rand(seed+8)*8,rand(seed+9)*6,rand(seed+10)*9),age:0,life:12,size:.06+rand(seed+3)*.5});}
   if(i%2===0)smoke.emit(point,velocityOut.clone().multiplyScalar(.35),.6+severity*.13,water?3.5:3,water?2:1,1.4+severity*.12);
   if(!water)for(let k=0;k<2;k++){if(sparks.length>=320)sparks.shift();sparks.push({p:point.clone(),v:velocityOut.clone().multiplyScalar(1.6+k*.9),age:0,life:.25+rand(seed+k+29)*.8});}
  }
 }
 function scorch(point,size){
  if(heightAt(point.x,point.z)<.05)return;
  const geometry=new T.CircleGeometry(size,32);geometry.rotateX(-Math.PI/2);const a=geometry.attributes.position;
  for(let i=0;i<a.count;i++)a.setY(i,heightAt(point.x+a.getX(i),point.z+a.getZ(i))-point.y+.035);
  geometry.computeVertexNormals();
  const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{opacity:{value:.55}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float opacity;${noiseGLSL}void main(){float r=length(vUv*2.-1.);float a=(1.-smoothstep(.30,1.,r))*(.55+.45*noise(vUv*13.))*opacity;gl_FragColor=vec4(.012,.010,.008,a);}`});
  enableWorldDepth(mat);const mark=new T.Mesh(geometry,mat);mark.position.copy(point);mark.renderOrder=1;scene.add(mark);scorches.push(mark);
  if(scorches.length>8){const old=scorches.shift();old.geometry.dispose();old.material.dispose();scene.remove(old);}
 }
 function explosion(point,velocity,energy,fuel){
  const size=clamp(3+Math.pow(energy/1e6,.35)*1.6,3,12)*clamp(Math.sqrt(fuel/80),.35,1);
  for(let i=0;i<38;i++){
   const seed=i*13.27+clock,direction=new T.Vector3(rand(seed)*2-1,rand(seed+1)*1.7-.3,rand(seed+2)*2-1).normalize();
   const out=direction.clone().multiplyScalar(size*(3+rand(seed+3)*4)).addScaledVector(velocity,.08);
   flame.emit(point.clone().addScaledVector(direction,rand(seed+4)*size*.5),out,size*(.35+rand(seed+5)*.65),.25+rand(seed+6)*.85,2,size*2.2);
   smoke.emit(point,out.clone().multiplyScalar(.35),size*(.3+rand(seed+7)*.5),5+rand(seed+8)*5,0,size*.48);
  }
  debrisBurst(point,new T.Vector3(0,1,0),velocity,energy,false);
  flashes.push({p:point.clone(),age:0,power:5000+size*1600});if(flashes.length>2)flashes.shift();
  if(point.y-heightAt(point.x,point.z)<18){scorch(point.clone().setY(heightAt(point.x,point.z)),size*1.2);for(let i=0;i<24;i++){const angle=i*Math.PI/12,dir=new T.Vector3(Math.cos(angle),.14,Math.sin(angle));smoke.emit(point.clone().addScaledVector(dir,2),dir.multiplyScalar(size*3),size*.30,4,1,size*.7);}}
  onImpact(energy,true);
 }
 function syncWreckage(sim){
  if(!sim?.get_wreckage)return;
  const pointer=sim.get_wreckage(),buffer=new Float64Array(sim.memory.buffer,pointer,2+MAX_BODIES*STRIDE),seen=new Set();focus=null;
  for(let i=0;i<buffer[0];i++){
   const d=buffer.subarray(2+i*STRIDE,2+(i+1)*STRIDE),id=d[0];seen.add(id);let actor=actors.get(id);
   if(!actor){
    const mesh=factory.create(d[1],d[2],Array.from(d.slice(22,25)),Array.from(d.slice(25,28)));scene.add(mesh);
    actor={id,mesh,part:d[1],variant:d[2],impacts:0,position:new T.Vector3(),quaternion:new T.Quaternion(),velocity:new T.Vector3(),angular:new T.Vector3(),fire:0,mass:d[36],age:d[3]};actors.set(id,actor);
   }
   actor.position.set(d[5],d[6],d[7]);actor.quaternion.set(d[8],d[9],d[10],d[11]);actor.velocity.set(d[12],d[13],d[14]);actor.angular.set(d[15],d[16],d[17]).applyQuaternion(actor.quaternion);actor.fire=d[18];actor.age=d[3];actor.ground=!!d[19];actor.mesh.position.copy(actor.position);actor.mesh.quaternion.copy(actor.quaternion);
   if(d[20]>actor.impacts){
    actor.impacts=d[20];const point=new T.Vector3(d[30],d[31],d[32]),normal=new T.Vector3(d[33],d[34],d[35]);
    debrisBurst(point,normal,actor.velocity,d[37],heightAt(point.x,point.z)<.05);
    if(d[21]>7)onImpact(d[37],false);
   }
   if(actor.part===0&&actor.variant===2)focus=actor;
  }
  for(const [id,actor]of actors)if(!seen.has(id)){actor.emitter?.dispose();factory.release(actor.mesh);actors.delete(id);}
 }
 function reset(){
  for(const actor of actors.values()){actor.emitter?.dispose();factory.release(actor.mesh);}actors.clear();for(const {emitter} of attachedEmitters.values())emitter.dispose();attachedEmitters.clear();micro.length=sparks.length=flashes.length=0;smoke.reset();flame.reset();plumes.reset();damageFlames.reset();
  for(const mark of scorches){mark.geometry.dispose();mark.material.dispose();scene.remove(mark);}scorches.length=0;
  chunks.count=0;sparkGeo.setDrawRange(0,0);serial=0;emission=0;clock=0;fatal=false;fireLevel=0;focus=null;lights.forEach(l=>l.intensity=0);
 }
 return {reset,get focus(){return focus},get fireLevel(){return fireLevel},get stats(){return {parts:actors.size,fragments:micro.length,sparks:sparks.length,smoke:smoke.particles.length+plumes.stats.points,flame:flame.particles.length+damageFlames.count,explosions:flashes.length}},
 update(s,dt,camera,sim,systems){
  systems??=sim?.get_systems?readSystems(sim):null;
  clock+=dt;wind.set(s[58],s[59],s[60]);q.set(s[6],s[7],s[8],s[9]);
  const newlyFatal=!!s[33]&&!fatal,point=new T.Vector3(s[78],s[79],s[80]),velocity=new T.Vector3(s[3],s[4],s[5]),water=heightAt(point.x,point.z)<.05&&point.y<.2;
  if(s[74]!==serial){serial=s[74];if(serial&&!fatal){debrisBurst(point,new T.Vector3(s[81],s[82],s[83]),velocity,s[77],water);if(!newlyFatal)onImpact(s[77],false);}}
  if(newlyFatal){if(s[19]>2&&s[76]>12&&!water)explosion(point,velocity,s[77],s[19]);else onImpact(s[77],false);}
  fatal=!!s[33];syncWreckage(sim);emission+=dt;fireLevel=0;const surfaceSources=[],plumeSources=[];
  aircraft.group.updateWorldMatrix(true,true);
  const base=new T.Vector3(s[0],s[1],s[2]),angular=new T.Vector3(s[10],s[11],s[12]).applyQuaternion(q);
  function emitFromSurface(id,emitter,velocity,style,centre,spin){
   emitter.update();
   const point=new T.Vector3(),normal=new T.Vector3();if(!emitter.sample(0,point,normal))return;
   const localVelocity=spin.clone().cross(point.clone().sub(centre)).add(velocity),source={id,p:point,normal,v:localVelocity,smoke:style.smoke,fire:style.fire,width:emitter.radius,seed:typeof id==='string'?Array.from(id).reduce((h,c)=>h*1.1+c.charCodeAt(0),0):id};
   surfaceSources.push(source);plumeSources.push(source);
   fireLevel=Math.max(fireLevel,style.fire);
  }
  for(const actor of actors.values()){
   if(actor.fire>.02){actor.emitter??=createPartEmitter(actor.mesh);emitFromSurface('wreck-'+actor.id,actor.emitter,actor.velocity,{smoke:Math.min(1,actor.fire*2),fire:actor.fire},actor.position,actor.angular);}
  }
  if(systems)for(const part of PARTS){
   const health=partValue(systems,part.id),power=partValue(systems,part.id,3);if(health<.08||health>.95)continue;
   const style=damagePlumeStyle(health,power,s[19]>2);if(style.smoke<=.001)continue;
   const root=aircraft.damageParts[part.id];let entry=attachedEmitters.get(part.id);
   // Async exterior imports can replace a fallback part after this effect
   // started. Rebuild its surface anchor against the current original skin.
   if(!entry||entry.root!==root){entry?.emitter.dispose();entry={root,emitter:createPartEmitter(root)};attachedEmitters.set(part.id,entry);}
   const emitter=entry.emitter;
   const point=new T.Vector3();if(!emitter.sample(0,point))continue;
   if(point.y<heightAt(point.x,point.z)+.1&&heightAt(point.x,point.z)<.05)continue;
   emitFromSurface('part-'+part.id,emitter,velocity,style,base,angular);
  }
  const interval=1/45;
  if(dt>0&&emission>=interval){
   emission%=interval;const tick=Math.floor(clock/interval);
   if(systems?.[6]&&s[19]>0&&tick%2===0)for(const side of [-1,1]){
    p.set(side*1.8,-.6,5.5).applyQuaternion(q).add(base);v.copy(wind).addScaledVector(velocity,.12);v.y-=.6;
    smoke.emit(p,v,.25,2.0,3,.8);
   }
  }
  for(let i=micro.length-1;i>=0;i--){const a=micro[i];a.age+=dt;if(a.age>a.life){micro.splice(i,1);continue;}a.v.y-=9.80665*dt;a.v.multiplyScalar(Math.exp(-dt*.16));a.p.addScaledVector(a.v,dt);a.rotation.addScaledVector(a.spin,dt);const h=heightAt(a.p.x,a.p.z)+.06;if(a.p.y<h){a.p.y=h;a.v.y=Math.abs(a.v.y)*.18;a.v.x*=.6;a.v.z*=.6;a.spin.multiplyScalar(.7);}object.position.copy(a.p);object.rotation.set(a.rotation.x,a.rotation.y,a.rotation.z);object.scale.set(a.size,a.size,a.size*(.4+rand(i)*1.4));object.updateMatrix();chunks.setMatrixAt(i,object.matrix);}chunks.count=micro.length;chunks.instanceMatrix.needsUpdate=true;
  for(let i=sparks.length-1;i>=0;i--){const a=sparks[i];a.age+=dt;if(a.age>a.life){sparks.splice(i,1);continue;}a.v.y-=9.80665*dt;a.v.multiplyScalar(Math.exp(-dt*1.8));a.p.addScaledVector(a.v,dt);}
  sparks.forEach((a,i)=>{const fade=1-a.age/a.life;for(let k=0;k<2;k++){p.copy(a.p).addScaledVector(a.v,k?-.023:0);sparkGeo.attributes.position.setXYZ(i*2+k,p.x,p.y,p.z);sparkGeo.attributes.color.setXYZ(i*2+k,5*fade,2.5*fade,.25*fade);}});sparkGeo.attributes.position.needsUpdate=sparkGeo.attributes.color.needsUpdate=true;sparkGeo.setDrawRange(0,sparks.length*2);
  for(let i=flashes.length-1;i>=0;i--){flashes[i].age+=dt;if(flashes[i].age>1.1)flashes.splice(i,1);}
  lights.forEach((light,i)=>{const flash=flashes[i];if(flash){light.position.copy(flash.p).add(new T.Vector3(0,2,0));light.intensity=flash.power*Math.exp(-flash.age*9);}else light.intensity=0;});
  plumes.update(plumeSources,dt,camera,wind,clock);damageFlames.update(surfaceSources,wind,clock,dt);smoke.update(dt,camera,clock);flame.update(dt,camera,clock);
 }};
}
