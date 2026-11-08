/* Model delivery and progress are deliberately independent of Three.js/WebGL.
 * A broken renderer import must never leave the page saying "download preparing" forever. */
(() => {
 'use strict';
 window.__apexMig23BootAlive=true;
 const $=id=>document.getElementById(id);
 const status=$('status'),panel=$('download-progress'),label=$('download-label');
 const percent=$('download-percent'),track=$('download-track'),fill=$('download-fill'),detail=$('download-detail');
 const upload=$('upload'),retry=$('retry-load'),input=$('file');
 const expectedBytes=22593404,mb=n=>(n/1048576).toFixed(1)+' MB';
 const primary='./assets/mig23mld/Mig-23.glb?v=3';
 const backup='https://raw.githubusercontent.com/dasol1819/project-apex/main/web/assets/mig23mld/Mig-23.glb';
 let generation=0,activeController=null,activeReader=null;

 function state(message,error=false){
  status.textContent=message;
  status.dataset.error=String(error);
 }
 function showProgress(loaded,total,phase){
  panel.hidden=false;
  label.textContent=phase;
  if(total){
   const p=Math.min(100,Math.floor(loaded/total*100));
   percent.textContent=p+'%';
   fill.style.width=p+'%';
   track.setAttribute('aria-valuenow',String(p));
   detail.textContent=mb(loaded)+' / '+mb(total);
  }else{
   percent.textContent=mb(loaded);
   fill.style.width='0%';
   track.removeAttribute('aria-valuenow');
   detail.textContent='받은 데이터: '+mb(loaded)+' (전체 크기 확인 중)';
  }
 }
 function reportError(error){
  panel.hidden=true;
  upload.hidden=false;
  retry.hidden=false;
  const message=(error&&error.message)||String(error);
  state('불러오기 실패: '+message,true);
  console.error('MiG-23MLD load error',error);
 }
 function cancel(){
  activeController?.abort();
  activeController=null;
  activeReader?.cancel().catch(()=>{});
  activeReader=null;
 }
 function verifyGlb(buffer){
  if(buffer.byteLength<28)throw Error('모델 파일이 비어 있거나 잘렸습니다.');
  const d=new DataView(buffer);
  if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==buffer.byteLength)
   throw Error('전송된 모델 파일이 유효한 GLB 2.0이 아닙니다.');
 }
 async function download(url,sourceName,run){
  const controller=new AbortController();activeController=controller;
  let idleTimer;
  const arm=()=>{clearTimeout(idleTimer);idleTimer=setTimeout(()=>controller.abort('idle'),12000);};
  let loaded=0;
  try{
   state(sourceName+'에 연결 중…');
   showProgress(0,expectedBytes,sourceName+' · 서버 연결 중…');
   arm();
   const response=await fetch(url,{cache:'default',signal:controller.signal,mode:'cors'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const length=Number(response.headers.get('content-length'));
   const total=Number.isFinite(length)&&length>0?length:expectedBytes;
   const chunks=[];
   if(response.body){
    const reader=response.body.getReader();activeReader=reader;
    while(true){
     arm();
     const {done,value}=await reader.read();
     if(done)break;
     if(run!==generation)throw Error('이전 요청 취소됨');
     if(!value||!value.byteLength)continue;
     chunks.push(value);loaded+=value.byteLength;
     showProgress(loaded,total,sourceName+' · 다운로드 중…');
    }
    const bytes=new Uint8Array(loaded);let at=0;
    for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
    verifyGlb(bytes.buffer);
    showProgress(loaded,loaded,sourceName+' · 다운로드 완료');
    return bytes.buffer;
   }
   arm();
   const buffer=await response.arrayBuffer();loaded=buffer.byteLength;
   verifyGlb(buffer);
   showProgress(loaded,loaded,sourceName+' · 다운로드 완료');
   return buffer;
  }catch(e){
   if(controller.signal.aborted&&run===generation)throw Error(sourceName+'에서 12초 동안 응답이 없습니다.');
   throw e;
  }finally{
   clearTimeout(idleTimer);
   if(activeController===controller)activeController=null;
   activeReader=null;
  }
 }
 async function loadModel(run){
  try{return await download(primary,'Project Apex 서버',run);}
  catch(first){
   if(run!==generation)throw first;
   console.warn('Project Apex model endpoint failed; trying GitHub source',first);
   state('사이트 파일 서버 오류. GitHub 원본 경로로 재시도 중…');
   return download(backup,'GitHub 원본 서버',run);
  }
 }
 function timeout(promise,ms){
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('3D 엔진 모듈을 '+Math.round(ms/1000)+'초 안에 불러오지 못했습니다.')),ms);})])
   .finally(()=>clearTimeout(timer));
 }
 async function mount(buffer,filename,run){
  state('3D 렌더러 불러오는 중…');
  showProgress(buffer.byteLength,buffer.byteLength,'다운로드 완료 · 3D 엔진 준비 중…');
  // Import errors are caught here, rather than silently preventing the loader from starting.
  const viewer=await timeout(import('./mig23mld-viewer.js?v=6'),20000);
  if(run!==generation)return;
  label.textContent='다운로드 완료 · 메시 및 텍스처 구성 중…';
  detail.textContent=mb(buffer.byteLength)+' 수신 완료 · GPU 구성 중';
  await viewer.mountMig23(buffer,filename);
  if(run!==generation)return;
  panel.hidden=true;
  upload.hidden=true;
  state(filename+' · 3D 모델 로딩 완료');
 }
 async function start(){
  const run=++generation;
  cancel();retry.hidden=true;upload.hidden=true;
  try{
   const buffer=await loadModel(run);
   if(run!==generation)return;
   await mount(buffer,'MiG-23MLD',run);
  }catch(e){if(run===generation)reportError(e);}
 }
 retry.addEventListener('click',start);
 input.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  const run=++generation;cancel();
  retry.hidden=true;upload.hidden=true;
  try{
   const reader=new FileReader();
   const result=await new Promise((resolve,reject)=>{
    reader.onerror=()=>reject(reader.error||Error('파일 읽기 실패'));
    reader.onload=()=>resolve(reader.result);
    reader.onprogress=ev=>showProgress(ev.loaded,ev.total||file.size,'로컬 GLB 읽는 중…');
    showProgress(0,file.size,'로컬 GLB 읽는 중…');
    reader.readAsArrayBuffer(file);
   });
   verifyGlb(result);
   if(run!==generation)return;
   await mount(result,file.name,run);
  }catch(err){if(run===generation)reportError(err);}
 });
 // This downloader runs even if the Three.js imports or WebGL context fail.
 start();
})();
