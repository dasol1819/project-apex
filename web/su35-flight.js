// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';
import {loadSu35Asset} from './su35-asset.js?v=4';
import {createSu35Model} from './su35-model.js?v=4';
import {Su35Flight,SU35_FLIGHT} from './su35-flight-physics.js?v=4';
import {disposeObject} from './aircraft-catalog.js';
const $=id=>document.getElementById(id),V=(...p)=>new T.Vector3(...p),DEG=180/Math.PI;
const canvas=$('flight-canvas'),status=$('flight-status'),flight=new Su35Flight(),keys=new Set(),touch=new Map();
let renderer,scene,camera,model,root,light,environment,observer,frameId,last=0,accumulator=0,paused=true,ready=false,disposed=false,uiAge=0;
const target=V(),goal=V(),forward=V(),offset=V(),lastCraftPosition=V();
function phase(){
  $('flight-phase').textContent=flight.crashed?'지면 접촉':paused?'시험 준비 / 일시정지':'비행 중';
  $('flight-toggle').textContent=flight.crashed?'초기화하고 다시 시작 ↺':paused?'시험 비행 시작 ▶':'일시정지 Ⅱ';
}
function reset(){flight.reset();paused=true;accumulator=0;keys.clear();touch.clear();$('flight-throttle').value='62';$('flight-gear').checked=false;$('flight-brake').checked=false;$('flight-tvc').checked=true;status.hidden=true;phase();}
function toggle(){if(!ready)return;if(flight.crashed)reset();paused=!paused;accumulator=0;phase();canvas.focus({preventScroll:true});}
function input(){
  const active=(...names)=>names.some(n=>keys.has(n))?1:0;
  const c={pitch:active('ArrowUp','KeyS')-active('ArrowDown','KeyW'),roll:active('ArrowRight')-active('ArrowLeft'),yaw:active('KeyD')-active('KeyA')};
  for(const [field,value]of touch.values())c[field]=T.MathUtils.clamp(c[field]+value,-1,1);
  return {...c,throttle:Number($('flight-throttle').value)/100,gear:$('flight-gear').checked?1:0,airbrake:$('flight-brake').checked?1:0,tvc:$('flight-tvc').checked};
}
function bind(){
  $('flight-toggle').onclick=toggle;$('flight-reset').onclick=()=>{reset();cameraFrame(1);};
  const codes=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','Space','KeyR','Equal','Minus','NumpadAdd','NumpadSubtract'];
  window.addEventListener('keydown',e=>{if(!ready||e.target.tagName==='INPUT'||!codes.includes(e.code))return;e.preventDefault();
    if(e.code==='Space'){if(!e.repeat)toggle();return;}if(e.code==='KeyR'){reset();return;}
    if(['Equal','Minus','NumpadAdd','NumpadSubtract'].includes(e.code)){const sign=['Equal','NumpadAdd'].includes(e.code)?1:-1;$('flight-throttle').value=String(T.MathUtils.clamp(Number($('flight-throttle').value)+sign*2,0,100));return;}
    keys.add(e.code);
  });window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();touch.clear();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){paused=true;accumulator=0;keys.clear();touch.clear();phase();}});
  for(const button of document.querySelectorAll('[data-control]')){
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);const[field,value]=button.dataset.control.split(':');touch.set(e.pointerId,[field,Number(value)]);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>touch.delete(e.pointerId));
  }
}
function resize(){const r=canvas.parentElement.getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
function cameraFrame(alpha){
  camera.position.add(flight.position.clone().sub(lastCraftPosition));lastCraftPosition.copy(flight.position);
  root.position.copy(flight.position);root.quaternion.copy(flight.orientation);
  forward.set(0,0,-1).applyQuaternion(flight.orientation);const yaw=Math.atan2(-forward.x,-forward.z);
  offset.set(15,7,29).multiplyScalar(Math.max(1,.95/camera.aspect)).applyAxisAngle(V(0,1,0),yaw);goal.copy(flight.position).add(offset);camera.position.lerp(goal,alpha);
  target.copy(flight.position).addScaledVector(forward,3);camera.lookAt(target);
  light.position.copy(flight.position).add(V(-40,70,-40));light.target.position.copy(flight.position);light.target.updateMatrixWorld();
}
function telemetry(){
  const t=flight.telemetry,set=(id,text)=>$(id).textContent=text;
  set('tas',Math.round(t.speed*3.6));set('altitude',Math.round(t.altitude).toLocaleString('ko-KR'));set('load',t.normalG.toFixed(2));set('alpha',(t.alpha*DEG).toFixed(1));
  for(const name of ['lift','drag','thrust'])set(name,(t[name]/1000).toFixed(1)+' kN');
  set('mass',Math.round(flight.mass).toLocaleString('ko-KR')+' kg');set('fuel',Math.round(flight.fuel).toLocaleString('ko-KR')+' kg');set('mach',t.mach.toFixed(2));
  set('throttle-value',$('flight-throttle').value+'%');
  if(!paused&&!flight.crashed)$('flight-phase').textContent=flight.powerLimit<.98?'비행 중 · 속도 보호':'비행 중';
}
function render(now){
  if(disposed)return;frameId=requestAnimationFrame(render);const dt=Math.min((now-last)/1000||1/60,.10);last=now;if(document.hidden)return;
  if(!paused&&!flight.crashed){accumulator+=dt;const c=input();while(accumulator>=1/120){flight.step(1/120,c);accumulator-=1/120;if(flight.crashed)break;}}
  const t=flight.telemetry,c=flight.controls;
  model.update({gear:flight.gear,pitchInput:t.pitchSurface,rollInput:t.rollSurface,yawInput:c.yaw,airbrake:c.airbrake,
    vectorPitch:t.vectorPitch,afterburner:t.afterburner,canopy:0},dt);
  cameraFrame(1-Math.exp(-dt*5));renderer.render(scene,camera);uiAge+=dt;if(uiAge>.1){telemetry();uiAge=0;}
  if(flight.crashed&&!status.classList.contains('crash')){status.classList.add('crash');status.hidden=false;status.textContent='지면에 접촉했습니다. 초기화하고 다시 비행할 수 있습니다.';phase();}
  if(!flight.crashed)status.classList.remove('crash');
}
async function boot(){try{
  renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene=new T.Scene();scene.background=new T.Color(0x97b9ce);scene.fog=new T.FogExp2(0xa6c0cf,.000035);camera=new T.PerspectiveCamera(42,1,.15,60000);
  scene.add(new T.HemisphereLight(0xdaeaf3,0x67858f,2.0));light=new T.DirectionalLight(0xfff5e6,2.5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:1,far:160});light.shadow.normalBias=.025;scene.add(light,light.target);
  const room=new T.Scene();room.background=new T.Color(0x9baab1);const pmrem=new T.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.04,.1,100);pmrem.dispose();scene.environment=environment.texture;
  const ocean=new T.Mesh(new T.PlaneGeometry(100000,100000,1,1),new T.MeshStandardMaterial({color:0x355967,roughness:.70,metalness:.12}));ocean.rotation.x=-Math.PI/2;scene.add(ocean);
  const points=[];for(let i=-20;i<=20;i++){points.push(V(i*1000,.2,-20000),V(i*1000,.2,20000),V(-20000,.2,i*1000),V(20000,.2,i*1000));}
  scene.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xb5d3dc,transparent:true,opacity:.12})));
  const asset=await loadSu35Asset(message=>status.textContent=message);model=createSu35Model(asset);model.group.position.sub(V(...SU35_FLIGHT.cg));root=new T.Group();root.add(model.group);scene.add(root);
  resize();cameraFrame(1);telemetry();renderer.render(scene,camera);ready=true;status.hidden=true;$('flight-toggle').disabled=$('flight-reset').disabled=false;phase();bind();
  observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;status.hidden=false;status.textContent='그래픽 연결이 끊겼습니다. 페이지를 새로고침해 주세요.';});
  Object.defineProperty(window,'su35FlightTest',{value:{flight,model,renderer,camera,scene,get paused(){return paused}},configurable:true});
  document.documentElement.dataset.su35FlightReady='true';frameId=requestAnimationFrame(render);
}catch(error){console.error(error);status.hidden=false;status.classList.add('error');status.textContent='시험 비행을 준비하지 못했습니다. 모델 다운로드와 WebGL 연결을 확인해 주세요.';}}
window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;cancelAnimationFrame(frameId);observer?.disconnect();if(scene)disposeObject(scene);environment?.dispose();renderer?.dispose();});
boot();
