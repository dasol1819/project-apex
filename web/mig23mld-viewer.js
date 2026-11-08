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
// The game's compact Three.js build does not export GridHelper.
// Draw the reference floor with the same primitives used by combat aircraft;
// never prevent model loading because a decorative helper is unavailable.
function createReferenceGrid(){
 if(![T.BufferGeometry,T.Float32BufferAttribute,T.LineBasicMaterial,T.LineSegments].every(x=>typeof x==='function'))return null;
 const positions=[],half=24,spacing=2;
 for(let x=-half;x<=half;x+=spacing){
  positions.push(-half,0,x, half,0,x, x,0,-half, x,0,half);
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 const material=new T.LineBasicMaterial({color:0x293b4d,transparent:true,opacity:.65,depthWrite:false});
 const lines=new T.LineSegments(geometry,material);
 lines.name='Airframe reference grid';lines.position.y=-3.5;
 return lines;
}
const grid=createReferenceGrid();if(grid)scene.add(grid);

let installed,sweep=()=>{},yaw=.8,pitch=.28,distance=29,drag=null;
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
 say('GLB 메시와 텍스처 불러오는 중…');
 const asset=await parseMig23Glb(buffer);
 const {root,originalLength}=normalizeMig23(asset.scene);
 const move=rigMig23Sweep(asset.scene,asset.nodes);move($('sweep').value);
 if(installed){scene.remove(installed);dispose(installed);}
 installed=root;scene.add(root);sweep=move;
 $('metrics').textContent=`${asset.metadata.meshes} meshes · ${asset.metadata.primitives} surfaces · ${asset.metadata.nodes} nodes · model length ${originalLength.toFixed(3)} → 16.7m`;
 $('upload').hidden=true;say(filename+' · 외형 불러오기 완료');
}
export async function mountMig23(buffer,filename='MiG-23MLD'){return display(buffer,filename);}
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