import {AIRCRAFT,simAircraft} from './aircraft-catalog.js';
import * as T from './vendor/three.module.js';
import {createPerformanceCatalog} from './performance-catalog.js';
const clamp=T.MathUtils.clamp;
export function createHangar({document:d,getSim,onClose,onChoose,canChoose=()=>true}){
 const $=id=>d.getElementById(id),viewer=$('hangar-viewer'),pointers=new Map();
 const performanceCatalog=createPerformanceCatalog({document:d,getSim});
 let active=false,azimuth=2.74,elevation=.32,zoom=1,rotating=true,lastPinch=0,previewStrike=false,sweep=20,bayOpen=false,folded=false;
 const offset=new T.Vector3(),target=new T.Vector3();
 const presets={overview:[2.74,.32],front:[Math.PI,.13],side:[Math.PI/2,.16],rear:[0,.17],top:[Math.PI,1.40]};
 function auto(value){rotating=value;$('hangar-rotate').setAttribute('aria-pressed',String(value));}
 function preset(name){const p=presets[name]||presets.overview;[azimuth,elevation]=p;zoom=1;auto(name==='overview');for(const b of d.querySelectorAll('[data-hangar-view]'))b.setAttribute('aria-pressed',String(b.dataset.hangarView===name));}
 function refresh(){const sim=getSim();if(!sim)return;const a=new Float64Array(sim.memory.buffer,sim.get_aircraft_specs(),28),number=v=>v.toLocaleString('en-US',{maximumFractionDigits:2});
  const values={engines:a[1]+' × '+simAircraft(sim).engine,dry:number(a[2])+' lbf',ab:simAircraft(sim).bomber?'후연 없음':number(a[3])+' lbf',total:a[5].toFixed(1)+' kN',area:number(a[6])+' m²',span:number(a[7])+' m',empty:number(a[8])+' kg',fuel:number(a[9])+' kg',limits:'+'+a[10]+' / '+a[11]+' G',tvc:a[12]?'±'+a[12]+'°':'미탑재',strength:a[13]+'× · 고정',mtow:a[24]?number(a[24])+' kg':'—'};
  const af=simAircraft(sim);$('hangar-fold-controls').hidden=!af.superHornet;if(!af.superHornet)folded=false;$('hangar-fold-toggle').setAttribute('aria-pressed',String(folded));$('hangar-spec-mtow').closest('div').hidden=!a[24];$('hangar-spec-fuel').closest('div').querySelector('dt').textContent=af.id===6?'연료 · 내부 + CFT':'최대 내부 연료';$('hangar-bay-controls').hidden=!(af.bomber||af.internalWeapons);$('hangar-bay-toggle').setAttribute('aria-pressed',String(bayOpen));const title=$('hangar-title'),nickname=d.createElement('span');nickname.textContent=af.nickname.toUpperCase();title.replaceChildren(d.createTextNode(af.name+' '),nickname);const identity=d.querySelector('.hangar-spec-identity p');if(identity)identity.textContent=af.notes;
  for(const [name,value]of Object.entries(values))$('hangar-spec-'+name).textContent=value;
  $('hangar-spec-length').textContent=number(af.length)+' m';performanceCatalog.refresh();
  $('hangar-aircraft').value=String(af.id);if(af.id!==4)sweep=20;const wing=$('hangar-wing-controls');if(wing)wing.hidden=af.id!==4;for(const x of d.querySelectorAll('[data-hangar-sweep]'))x.setAttribute('aria-pressed',String(Number(x.dataset.hangarSweep)===sweep));
  for(const id of ['hangar-aircraft','hangar-aircraft-prev','hangar-aircraft-next'])$(id).disabled=!canChoose();
  $('hangar-selection-position').textContent=(AIRCRAFT.findIndex(a=>a.id===af.id)+1)+' / '+AIRCRAFT.length;
  d.querySelector('#hangar-performance .hangar-trait').textContent=af.id===8?'8개 TF33 · 4개 쌍발 포드 · 내부 8발 + 외부 파일런. 후연과 공대공 무장이 없는 B-52H입니다.':af.id===7?'전익기 · 4기의 F118을 좌/우 엔진군으로 제어합니다. 엘리본과 분할 항력 러더로 조종하며, 후연과 추력 편향은 없습니다.':af.id===6?'F100-PW-229 쌍발 · CFT와 폭장 질량을 반영합니다. F-15C와 별도 기체이며 500발 M61A1을 탑재합니다.':af.id===4?'속도에 따라 가변익이 20–68°로 움직입니다. 각도 버튼은 외형 미리보기입니다. 비행 중 Shift+G 수동 각도, Shift+B 자동 복귀.':af.id===13?'AL-41F1S 쌍발 · 좌우 경사축 ±15° TVC · 외부 R-73 / R-77-1 · Irbis PESA/TWS. 공개되지 않은 탐지·유도 성능은 게임 추정값입니다.':af.id===10?'AL-41F1 쌍발 · 경사축 노즐의 공통/차동 편향으로 피치·요·롤에 힘과 모멘트를 적용합니다. N036 전방 AESA만 모델링하며 탐지거리·RCS는 게임 추정값입니다.':af.superHornet?'F414 쌍발 · +7.5 / −3 G · APG-79 AESA. E형은 단좌, F형은 복좌입니다. 날개 접기는 갑판 형상 미리보기이며 출격 시 펼칩니다. 함상 사출·착함 보조를 지원합니다.':af.id===0?'FBW가 피치·롤·요를 함께 조절합니다. 추력 편향은 피치 방향으로 작동합니다.':'FBW가 조종면을 통해 피치·롤·요를 조절합니다. 이 기체에는 추력 편향 장치가 없습니다.';

 }
 $('hangar-fold-toggle').onclick=()=>{folded=!folded;$('hangar-fold-toggle').setAttribute('aria-pressed',String(folded));};
 $('hangar-bay-toggle').onclick=()=>{bayOpen=!bayOpen;$('hangar-bay-toggle').setAttribute('aria-pressed',String(bayOpen));};
 for(const b of d.querySelectorAll('[data-hangar-sweep]'))b.onclick=()=>{sweep=Number(b.dataset.hangarSweep);for(const x of d.querySelectorAll('[data-hangar-sweep]'))x.setAttribute('aria-pressed',String(x===b));};
 function clearPointers(){for(const id of pointers.keys())try{if(viewer.hasPointerCapture?.(id))viewer.releasePointerCapture?.(id);}catch{}pointers.clear();lastPinch=0;}
 function setActive(value){active=value;clearPointers();if(value){preset('overview');sweep=20;bayOpen=false;folded=false;for(const x of d.querySelectorAll('[data-hangar-sweep]'))x.setAttribute('aria-pressed',String(x.dataset.hangarSweep==='20'));previewStrike=$('battle-mode').value==='strike';refresh();}}
 function cycleAircraft(direction){if(!active||!canChoose()||!onChoose)return;clearPointers();const index=AIRCRAFT.findIndex(a=>a.id===simAircraft(getSim()).id);onChoose(AIRCRAFT[(index+direction+AIRCRAFT.length)%AIRCRAFT.length].id);refresh();}
 $('hangar-aircraft-prev').onclick=()=>cycleAircraft(-1);$('hangar-aircraft-next').onclick=()=>cycleAircraft(1);
 for(const b of d.querySelectorAll('[data-hangar-view]'))b.onclick=()=>preset(b.dataset.hangarView);
 $('hangar-rotate').onclick=()=>auto(!rotating);$('hangar-zoom-in').onclick=()=>{zoom=clamp(zoom*.88,.65,1.65);};$('hangar-zoom-out').onclick=()=>{zoom=clamp(zoom/ .88,.65,1.65);};
 const pinch=()=>{const p=[...pointers.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);};
 viewer.addEventListener('pointerdown',e=>{if(!active||e.button!==0&&e.pointerType!=='touch')return;e.preventDefault();auto(false);viewer.focus({preventScroll:true});pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewer.setPointerCapture(e.pointerId);lastPinch=pinch();});
 viewer.addEventListener('pointermove',e=>{const previous=pointers.get(e.pointerId);if(!active||!previous)return;e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1){const distance=pinch();if(lastPinch>0&&distance>0)zoom=clamp(zoom*lastPinch/distance,.65,1.65);lastPinch=distance;}else{azimuth-=(e.clientX-previous.x)*.007;elevation=clamp(elevation+(e.clientY-previous.y)*.007,-.08,1.48);}});
 const release=e=>{pointers.delete(e.pointerId);lastPinch=pinch();};for(const event of ['pointerup','pointercancel','lostpointercapture'])viewer.addEventListener(event,release);
 viewer.addEventListener('wheel',e=>{if(!active)return;e.preventDefault();zoom=clamp(zoom*Math.exp(e.deltaY*.001),.65,1.65);},{passive:false});
 viewer.addEventListener('keydown',e=>{if(!active)return;const key=e.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(key)){e.preventDefault();auto(false);if(key==='ArrowLeft')azimuth+=.12;if(key==='ArrowRight')azimuth-=.12;if(key==='ArrowUp')elevation=clamp(elevation+.1,-.08,1.48);if(key==='ArrowDown')elevation=clamp(elevation-.1,-.08,1.48);if(key==='+')zoom=clamp(zoom*.88,.65,1.65);if(key==='-')zoom=clamp(zoom/.88,.65,1.65);if(key==='Home')preset('overview');}});
 d.addEventListener('keydown',e=>{if(active&&e.key==='Escape'&&!d.querySelector('dialog[open]')){e.preventDefault();onClose();}});
 function update(camera,anchor,pose,width,height,dt,ground){
  if(rotating&&!pointers.size)azimuth+=dt*.055;
  let rect=viewer.getBoundingClientRect();if(rect.width<1||rect.height<1){const portrait=width<=600&&height>width;rect=portrait?{left:12,top:120,width:width-24,height:Math.max(140,height*.35)}:{left:28,top:130,width:Math.max(120,width-Math.min(320,width*.4)-70),height:Math.max(120,height-230)};}
  const fov=43,framing=Math.max(height/rect.width,height/rect.height),distance=(Math.max(simAircraft(getSim()).length,simAircraft(getSim()).span)*.66)/Math.sin(fov*Math.PI/360)*framing*zoom;
  offset.set(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)).multiplyScalar(distance).applyQuaternion(pose);
  target.copy(anchor);camera.position.copy(anchor).add(offset);camera.position.y=Math.max(camera.position.y,ground(camera.position.x,camera.position.z)+1.7);camera.up.set(0,1,0);camera.lookAt(target);camera.fov=fov;
  // Frame the shared 3D aircraft in the available inspection area without a
  // second renderer, a second model or a change to the simulation's pose.
  camera.setViewOffset(width,height,width/2-(rect.left+rect.width/2),height/2-(rect.top+rect.height/2),width,height);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 }
 return{setActive,refresh,update,get folded(){return folded},get bayOpen(){return bayOpen},get sweep(){return sweep},get active(){return active},get state(){return{azimuth,elevation,zoom,rotating,pointers:pointers.size}}};
}
