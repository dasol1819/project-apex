import * as T from './vendor/three.module.js';
import {parseMig23Glb,normalizeMig23,rigMig23Sweep} from './mig23mld-glb.js?v=1';

const $=id=>document.getElementById(id),canvas=$('viewer');
const renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new T.Scene();scene.background=new T.Color(0x0b1320);
const camera=new T.PerspectiveCamera(40,1,.1,180);
scene.add(new T.HemisphereLight(0xcde6ff,0x263343,2.2));
const sun=new T.DirectionalLight(0xfff4db,3);sun.position.set(-11,18,-12);scene.add(sun);
const fill=new T.DirectionalLight(0x8dc3ff,1.1);fill.position.set(13,5,12);scene.add(fill);
const grid=new T.GridHelper(48,24,0x293b4d,0x1c2939);grid.position.y=-3.5;scene.add(grid);

let installed,sweep=()=>{},yaw=.8,pitch=.28,distance=29,drag=null;
const progress=$('download-progress'),progressLabel=$('download-label'),progressPercent=$('download-percent'),progressTrack=$('download-track'),progressFill=$('download-fill'),progressDetail=$('download-detail');
const mb=n=>(n/1048576).toFixed(1)+' MB';
function setProgress(loaded,total,phase='다운로드 중'){
 progress.hidden=false;progressLabel.textContent=phase;
 if(total>0){const pct=Math.min(100,Math.floor(loaded/total*100));progressPercent.textContent=pct+'%';progressFill.style.width=pct+'%';progressTrack.setAttribute('aria-valuenow',String(pct));progressDetail.textContent=mb(loaded)+' / '+mb(total);}
 else{progressPercent.textContent=mb(loaded);progressFill.style.width='100%';progressTrack.removeAttribute('aria-valuenow');progressDetail.textContent='전체 크기 확인 중 · '+mb(loaded)+' 다운로드됨';}
}
const say=(message,error=false)=>{$('status').textContent=message;$('status').dataset.error=String(error);};
const preset=key=>{[yaw,pitch,distance]=({
 quarter:[.8,.28,29],front:[Math.PI,.06,32],side:[Math.PI/2,.06,29],
 rear:[0,.05,29],top:[0,Math.PI/2-.04,34]
})[key]??[.8,.28,29];};
function resize(){
 const rect=canvas.getBoundingClientRect(),w=Math.max(2,Math.round(rect.width)),h=Math.max(2,Math.round(rect.height));
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);resize();
function frame(){
 const cp=Math.cos(pitch);
 camera.position.set(distance*cp*Math.sin(yaw),distance*Math.sin(pitch),distance*cp*Math.cos(yaw));
 camera.lookAt(0,0,0);renderer.render(scene,camera);
 requestAnimationFrame(frame);
}
frame();
function dispose(root){
 const geo=new Set(),mats=new Set(),maps=new Set();
 root.traverse(node=>{if(!node.isMesh)return;geo.add(node.geometry);for(const m of [].concat(node.material))mats.add(m);});
 for(const m of mats){if(m.map)maps.add(m.map);m.dispose();}
 for(const m of maps)m.dispose();
 for(const g of geo)g.dispose();
}
async function display(buffer,filename){
 setProgress(1,1,'다운로드 완료 · 3D 모델 구성 중…');
 progressDetail.textContent='메시와 텍스처 처리 중';
 say('GLB 메시와 텍스처 불러오는 중…');
 const asset=await parseMig23Glb(buffer);
 const {root,originalLength}=normalizeMig23(asset.scene);
 const move=rigMig23Sweep(asset.scene,asset.nodes);move($('sweep').value);
 if(installed){scene.remove(installed);dispose(installed);}
 installed=root;scene.add(root);sweep=move;
 $('metrics').textContent=`${asset.metadata.meshes} meshes · ${asset.metadata.primitives} surfaces · ${asset.metadata.nodes} nodes · model length ${originalLength.toFixed(3)} → 16.7m`;
 $('upload').hidden=true;progress.hidden=true;say(filename+' · 외형 불러오기 완료');
}
async function loadHosted(){
 const url='./assets/mig23mld/Mig-23.glb?v=3';
 const controller=new AbortController();
 let watchdog=null,loaded=0,stage='서버 응답 대기';
 const arm=()=>{
  clearTimeout(watchdog);
  watchdog=setTimeout(()=>controller.abort(new Error('서버 응답이 15초 동안 없습니다.')),15000);
 };
 try{
  setProgress(0,22593404,'MiG-23MLD 다운로드 준비 중…');
  say('MiG-23MLD 모델 확인 중…');
  arm();
  const response=await fetch(url,{signal:controller.signal,cache:'default'});
  if(!response.ok)throw Error('서버 오류 HTTP '+response.status);
  const total=Number(response.headers.get('content-length'))||0;
  let buffer;
  stage='모델 다운로드';
  if(response.body){
   const reader=response.body.getReader(),chunks=[];
   while(true){
    arm();
    const {done,value}=await reader.read();if(done)break;
    if(!value?.byteLength)continue;
    chunks.push(value);loaded+=value.byteLength;
    setProgress(loaded,total,'MiG-23MLD 다운로드 중…');
   }
   const bytes=new Uint8Array(loaded);let at=0;
   for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
   buffer=bytes.buffer;
  }else{
   arm();buffer=await response.arrayBuffer();
   loaded=buffer.byteLength;
   setProgress(loaded,loaded,'다운로드 완료');
  }
  clearTimeout(watchdog);
  stage='3D 모델 처리';
  await display(buffer,'MiG-23MLD');
 }catch(e){
  clearTimeout(watchdog);
  progress.hidden=true;$('upload').hidden=false;
  const reason=controller.signal.aborted?'서버가 15초 동안 응답하지 않았습니다.':e.message;
  say(stage+' 실패: '+reason+' 새로고침하거나 로컬 GLB 파일을 선택하세요.',true);
  console.error('MiG-23MLD model load failure:',{stage,loaded,error:e});
 }
}
$('file').addEventListener('change',async event=>{
 const file=event.currentTarget.files?.[0];if(!file)return;
 try{setProgress(0,file.size,'로컬 모델 읽는 중…');await display(await file.arrayBuffer(),file.name);}
 catch(e){progress.hidden=true;say('모델 오류: '+e.message,true);console.error(e);}
});
$('sweep').addEventListener('input',event=>{
 $('sweep-angle').textContent=event.currentTarget.value+'°';sweep(event.currentTarget.value);
});
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>preset(button.dataset.view);
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||drag.id!==e.pointerId)return;
 yaw-=(e.clientX-drag.x)*.009;pitch=Math.max(-1.3,Math.min(1.54,pitch+(e.clientY-drag.y)*.007));
 drag.x=e.clientX;drag.y=e.clientY;
});
for(const e of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(e,()=>drag=null);
canvas.addEventListener('wheel',e=>{
 e.preventDefault();distance=Math.max(12,Math.min(68,distance*Math.exp(e.deltaY*.001)));
},{passive:false});
loadHosted();
