import * as T from './vendor/three.module.js';
import {createSu35Model} from './su35-model.js?v=2';
import {disposeObject} from './aircraft-catalog.js';

const $=id=>document.getElementById(id),canvas=$('model-canvas'),status=$('model-status');
const DEG=Math.PI/180,clamp=T.MathUtils.clamp,V=(...a)=>new T.Vector3(...a);
const PRESETS={
  overview:{name:'전체 형상',eye:[17,9,-21],at:[0,.3,.5],number:'01 / AIRFRAME',title:'Flanker의 선을 따라.',copy:'긴 앞동체와 날개 뿌리의 연결, 떨어져 배치된 엔진과 쌍미익. 카나드가 없는 Su-35S의 실루엣을 표현했습니다.'},
  front:{name:'정면',eye:[0,1.2,-33],at:[0,.4,-.2],number:'02 / FRONT',title:'좌우 대칭, 서로 다른 깊이.',copy:'중앙 동체 아래 두 흡입구가 열려 있습니다. 얇은 분리판과 입구의 경사, 오른쪽으로 치우친 IRST 센서를 살펴보세요.'},
  top:{name:'상면',eye:[0,34,.3],at:[0,0,.3],number:'03 / PLANFORM',title:'날개와 동체가 만나는 방식.',copy:'길게 이어지는 날개 뿌리와 후퇴익, 전동 수평미익을 표현했습니다. 청회색 위장과 패널 선은 기체 표면을 따라 이어집니다.'},
  rear:{name:'후면',eye:[21,9,29],at:[0,.7,1.0],number:'04 / AFT',title:'쌍발 Flanker의 뒷모습.',copy:'서로 떨어진 엔진과 가운데 테일 붐, 쌍미익을 확인하세요. 금속 배기부에는 열변색과 정비 패널의 경계를 표현했습니다.'},
  intake:{name:'흡입구 상세',eye:[2.2,-.4,-8.6],at:[1.65,-.53,-3.8],number:'05 / INTAKE',title:'입구 뒤로, 약 4미터.',copy:'얇게 말린 입구 테두리에서 어두운 내부 덕트와 압축기까지 이어집니다. 램프를 움직이거나 회전해 내부 깊이와 분리판을 확인하세요.'},
  nozzle:{name:'노즐 상세',eye:[2.4,.25,13.4],at:[1.65,-.36,9.25],number:'06 / EXHAUST',title:'열을 견디는 금속의 표정.',copy:'겹쳐진 24개 노즐 페탈과 안쪽 배기 통로를 표현했습니다. 개방과 편향 슬라이더로 노즐 형상이 바뀌는 모습을 확인하세요.'},
  cockpit:{name:'조종석 상세',eye:[3.5,2.5,-7.5],at:[0,.72,-5.4],number:'07 / COCKPIT',title:'단좌 캐노피 아래의 디테일.',copy:'고정 앞유리와 열리는 후드, 좌석·계기판·HUD를 구성했습니다. 앞유리 우측의 IRST 구체와 기수의 연결선도 살펴보세요.'}
};

let renderer,scene,camera,model,env,floor,observer,raf=0,disposed=false,contextLost=false;
class Orbit {
  constructor(){this.radius=1;this.theta=0;this.phi=Math.PI/2;}
  copy(s){this.radius=s.radius;this.theta=s.theta;this.phi=s.phi;return this;}
  setFromVector3(v){this.radius=v.length();this.theta=Math.atan2(v.x,v.z);this.phi=Math.acos(clamp(v.y/Math.max(this.radius,1.e-9),-1,1));return this;}
}
const target=V(),targetGoal=V(),offset=V(),spherical=new Orbit(),goal=new Orbit();
let current='overview',dirty=true,last=0,width=1,height=1,drag=null,pinch=null;
const pointers=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const pose={gear:1,canopy:0,intakeRamp:0,vectorPitch:0,vectorYaw:0,afterburner:.3};
const desired={...pose};
function fail(message){status.hidden=false;status.classList.add('error');status.textContent=message;$('save-view').disabled=true;}
function setView(name,instant=false){
  const p=PRESETS[name];if(!p)return;current=name;targetGoal.set(...p.at);
  offset.set(...p.eye).sub(targetGoal);goal.setFromVector3(offset);
  // Portrait stages frame the complete airframe, rather than cropping the wings.
  if(['overview','front','top','rear'].includes(name))goal.radius*=Math.max(1,.95/(width/height));
  if(instant||reduced.matches){spherical.copy(goal);target.copy(targetGoal);camera.position.setFromSpherical(spherical).add(target);camera.lookAt(target);}
  for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));
  $('view-name').textContent=p.name;$('detail-number').textContent=p.number;$('detail-title').textContent=p.title;$('detail-copy').textContent=p.copy;
  dirty=true;
}
function studioEnvironment(){
  const room=new T.Scene();room.background=new T.Color(0x7c8185);
  const panel=(color,intensity,size,pos,look)=>{
    const mesh=new T.Mesh(new T.PlaneGeometry(...size),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide}));
    mesh.position.set(...pos);mesh.lookAt(...look);room.add(mesh);
  };
  panel(0xe1edff,2.5,[35,14],[-16,18,-7],[0,0,0]);
  panel(0xb5dbe1,1.5,[30,6],[12,14,12],[0,0,0]);
  panel(0xf5e4cc,.9,[20,6],[5,4,-25],[0,0,0]);
  const pmrem=new T.PMREMGenerator(renderer);const result=pmrem.fromScene(room,.04,.1,100);pmrem.dispose();disposeObject(room);return result;
}
function resize(){
  const rect=canvas.parentElement.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<700?1.65:2));renderer.setSize(width,height,false);
  camera.aspect=width/height;camera.updateProjectionMatrix();dirty=true;
}
function bindControls(){
  for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>setView(b.dataset.view));
  $('reset-view').addEventListener('click',()=>{
    $('gear').checked=true;$('canopy').checked=false;$('ramp').value='0';$('vector').value='0';$('aperture').value='30';
    for(const id of ['gear','canopy','ramp','vector','aperture'])$(id).dispatchEvent(new Event('input'));
    setView('overview');
  });
  $('gear').addEventListener('input',()=>{desired.gear=$('gear').checked?1:0;dirty=true;});
  $('canopy').addEventListener('input',()=>{desired.canopy=$('canopy').checked?55*DEG:0;dirty=true;});
  for(const [id,key,scale,unit] of [['ramp','intakeRamp',DEG,'°'],['vector','vectorPitch',DEG,'°'],['aperture','afterburner',.01,'%']]){
    $(id).addEventListener('input',()=>{desired[key]=Number($(id).value)*scale;$(id+'-value').textContent=$(id).value+unit;dirty=true;});
  }
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2};pinch=null;
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  });
  function pan(dx,dy){
    const right=V(1,0,0).applyQuaternion(camera.quaternion),up=V(0,1,0).applyQuaternion(camera.quaternion),scale=goal.radius*.0018;
    targetGoal.addScaledVector(right,-dx*scale).addScaledVector(up,dy*scale);
    // Panning is bounded to keep the model recoverable with ordinary gestures.
    targetGoal.x=clamp(targetGoal.x,-12,12);targetGoal.y=clamp(targetGoal.y,-4,9);targetGoal.z=clamp(targetGoal.z,-14,14);
  }
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    const previous=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){
      const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      if(pinch){goal.radius=clamp(goal.radius*pinch.distance/Math.max(1,d),2.4,90);pan(x-pinch.x,y-pinch.y);}pinch={distance:d,x,y};
    }else if(drag?.id===e.pointerId){
      if(drag.pan||e.shiftKey)pan(e.clientX-previous.x,e.clientY-previous.y);
      else{goal.theta-=(e.clientX-previous.x)*.006;goal.phi=clamp(goal.phi-(e.clientY-previous.y)*.006,.025,Math.PI-.06);}
    }
    dirty=true;
  });
  function release(e){pointers.delete(e.pointerId);pinch=null;const remaining=[...pointers.entries()][0];drag=remaining?{id:remaining[0],...remaining[1],pan:false}:null;}
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,release);
  canvas.addEventListener('wheel',e=>{e.preventDefault();goal.radius=clamp(goal.radius*Math.exp(e.deltaY*.001),2.4,90);dirty=true;},{passive:false});
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();
    if(e.key==='Home'){setView('overview');return;}
    if(e.key==='ArrowLeft')goal.theta+=.10;if(e.key==='ArrowRight')goal.theta-=.10;
    if(e.key==='ArrowUp')goal.phi=clamp(goal.phi-.08,.025,Math.PI-.06);
    if(e.key==='ArrowDown')goal.phi=clamp(goal.phi+.08,.025,Math.PI-.06);
    if(e.key==='+'||e.key==='=')goal.radius=Math.max(2.4,goal.radius*.9);if(e.key==='-')goal.radius=Math.min(90,goal.radius/ .9);dirty=true;
  });
  window.addEventListener('blur',()=>{drag=null;pinch=null;pointers.clear();});
  $('save-view').addEventListener('click',()=>{
    renderer.render(scene,camera);
    canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Project-Apex-Su35S-'+current+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);},'image/png');
  });
}
function render(time){
  if(disposed)return;raf=requestAnimationFrame(render);if(document.hidden||contextLost)return;
  const dt=Math.min(.25,(time-last)/1000||1/60);last=time;
  const alpha=reduced.matches?1:1-Math.exp(-dt*9);
  let moving=Math.abs(spherical.theta-goal.theta)+Math.abs(spherical.phi-goal.phi)+Math.abs(spherical.radius-goal.radius)+target.distanceTo(targetGoal)>.0001;
  spherical.theta=mix(spherical.theta,goal.theta,alpha);spherical.phi=mix(spherical.phi,goal.phi,alpha);spherical.radius=mix(spherical.radius,goal.radius,alpha);target.lerp(targetGoal,alpha);
  for(const key of Object.keys(pose)){moving||=Math.abs(pose[key]-desired[key])>.0001;pose[key]=mix(pose[key],desired[key],alpha);}
  if(moving||dirty){
    camera.position.setFromSpherical(spherical).add(target);camera.lookAt(target);model.update(pose,dt);renderer.render(scene,camera);dirty=false;
  }
}
const mix=T.MathUtils.lerp;
async function boot(){
  try{
    renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    scene=new T.Scene();scene.background=new T.Color(0x1c2227);scene.fog=new T.FogExp2(0x1c2227,.009);
    camera=new T.PerspectiveCamera(38,1,.08,250);env=studioEnvironment();scene.environment=env.texture;
    const key=new T.DirectionalLight(0xf2f1ea,2.8);key.position.set(-12,21,-12);key.castShadow=true;
    key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:75});
    key.shadow.normalBias=.035;key.shadow.bias=-.00015;key.shadow.radius=3;scene.add(key);
    const rim=new T.DirectionalLight(0xc8dee8,1.4);rim.position.set(12,7,15);scene.add(rim);
    const front=new T.DirectionalLight(0xf5e6d5,.8);front.position.set(3,4,-20);scene.add(front);
    scene.add(new T.HemisphereLight(0xc8d1d7,0x26282a,.55));
    floor=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshStandardMaterial({color:0x282c2e,roughness:.88,metalness:.15}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-2.115;floor.receiveShadow=true;scene.add(floor);
    const marks=new T.Group();marks.name='metre-scale studio ground markings';scene.add(marks);
    for(const radius of [11.5,15.0,19.0]){
      const points=Array.from({length:181},(_,i)=>V(Math.cos(i/180*Math.PI*2)*radius,-2.103,Math.sin(i/180*Math.PI*2)*radius));
      marks.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x47616e,transparent:true,opacity:radius===11.5?.28:.14})));
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));model=createSu35Model();scene.add(model.group);
    resize();setView(new URLSearchParams(location.search).get('view')||'overview',true);
    // Compile the actual paint, glass and morph variants before dismissing loading.
    model.update(pose);renderer.render(scene,camera);status.hidden=true;$('save-view').disabled=false;
    observer=new ResizeObserver(()=>{const oldAspect=width/height;resize();if(Math.abs(oldAspect-width/height)>.15)setView(current);});observer.observe(canvas.parentElement);
    bindControls();canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;fail('그래픽 연결이 중단되었습니다. 페이지를 새로고침해 주세요.');});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
    // Read-only diagnostics for the geometry and browser regression checks.
    Object.defineProperty(window,'su35Studio',{value:{get model(){return model},get camera(){return camera},get renderer(){return renderer},get scene(){return scene},get pose(){return {...pose}},setView,get view(){return current}},configurable:true});
    document.documentElement.dataset.su35Ready='true';raf=requestAnimationFrame(render);
  }catch(error){console.error(error);fail('3D 외형을 준비하지 못했습니다. WebGL 2를 지원하는 최신 브라우저에서 하드웨어 가속을 켜고 다시 시도해 주세요.');}
}
window.addEventListener('pagehide',e=>{
  if(e.persisted)return;disposed=true;cancelAnimationFrame(raf);observer?.disconnect();if(scene)disposeObject(scene);env?.dispose();renderer?.dispose();
});
boot();
