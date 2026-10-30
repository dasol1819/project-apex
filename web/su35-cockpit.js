// SPDX-License-Identifier: GPL-2.0-only
import * as T from './vendor/three.module.js';
import {geometry} from './fighter-exterior-tools.js';

function seat(k){
  const frame=new T.MeshStandardMaterial({color:0x242d2e,roughness:.68,metalness:.38});
  const cloth=new T.MeshStandardMaterial({color:0x4a5140,roughness:.96,metalness:0});
  const webbing=new T.MeshStandardMaterial({color:0x93917b,roughness:.98,metalness:0,side:T.DoubleSide});
  const hardware=new T.MeshStandardMaterial({color:0x737d7b,roughness:.42,metalness:.78});
  const stitch=new T.MeshStandardMaterial({color:0x30392f,roughness:.95,metalness:0});
  const part=11;
  function pad(size,r,pos,mat,tilt=0){
    const g=new T.BoxGeometry(...size,6,6,6),p=g.attributes.position,n=g.attributes.normal;
    const inner=new T.Vector3(...size).multiplyScalar(.5).addScalar(-r),v=new T.Vector3(),q=new T.Vector3(),normal=new T.Vector3();
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i);q.copy(v).clamp(inner.clone().negate(),inner);normal.copy(v).sub(q).normalize();
      v.copy(q).addScaledVector(normal,r);p.setXYZ(i,...v.toArray());n.setXYZ(i,...normal.toArray());
    }
    g.rotateX(tilt);g.translate(...pos);return k.mesh(g,mat,part);
  }
  pad([.38,.10,.43],.025,[0,.78,-5.31],frame);
  pad([.32,.067,.35],.018,[0,.842,-5.34],cloth,-.07);
  pad([.34,.66,.105],.024,[0,1.17,-5.015],frame,.10);
  pad([.285,.46,.055],.017,[0,1.16,-5.092],cloth,.10);
  pad([.34,.235,.17],.026,[0,1.59,-4.973],frame);
  pad([.265,.17,.058],.020,[0,1.59,-5.085],cloth);
  for(const side of [-1,1]){
    k.line([[side*.183,.73,-4.92],[side*.183,1.64,-4.88]],part,hardware,.012);
    pad([.055,.040,.28],.012,[side*.20,1.015,-5.18],frame);
    k.line([[side*.086,.98,-5.13],[side*.086,1.15,-5.13],[side*.086,1.36,-5.105]],part,stitch,.0025);
    const curve=new T.CatmullRomCurve3([[side*.115,1.48,-5.105],[side*.095,1.30,-5.17],
      [side*.076,1.04,-5.19],[side*.095,.89,-5.36]].map(p=>new T.Vector3(...p)));
    const p=[],ix=[];for(let i=0;i<=24;i++){const c=curve.getPoint(i/24);p.push(c.x-.019,c.y,c.z,c.x+.019,c.y,c.z);if(i<24){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}}
    k.mesh(geometry(p,ix),webbing,part);
    k.box([.055,.038,.013],[side*.076,1.015,-5.207],part,hardware);
    k.box([.032,.018,.014],[side*.076,1.015,-5.215],part,frame);
    k.line([[side*.17,.87,-5.25],[side*.12,.88,-5.45],[side*.035,.88,-5.48]],part,webbing,.018);
  }
  const handle=[[ -.043,.86,-5.51],[-.043,.93,-5.57],[0,.948,-5.585],[.043,.93,-5.57],[.043,.86,-5.51]];
  const yellow=new T.MeshStandardMaterial({color:0xc2a34f,roughness:.78,metalness:.06});
  k.line(handle,part,yellow,.010);
  for(const side of [-1,1])k.line([[side*.043,.881,-5.527],[side*.043,.902,-5.545]],part,frame,.011);
}

function displayTexture(kind){
  if(typeof document==='undefined')return null;
  const c=document.createElement('canvas');c.width=1024;c.height=768;const p=c.getContext('2d');
  p.fillStyle='#07120f';p.fillRect(0,0,1024,768);p.strokeStyle='#609766';p.fillStyle='#91b17b';p.lineWidth=3;p.font='25px monospace';
  p.fillText(kind==='attitude'?'NAV  /  FLIGHT':'NAV  /  TACTICAL',30,38);p.fillText('035    12:48:20',700,38);
  if(kind==='attitude'){
    p.save();p.translate(510,357);p.fillStyle='#294d57';p.fillRect(-230,-230,460,230);p.fillStyle='#51402b';p.fillRect(-230,0,460,230);
    p.strokeStyle='#a8c292';p.beginPath();p.moveTo(-245,0);p.lineTo(245,0);p.stroke();
    for(let n=-4;n<=4;n++){const y=n*44;p.beginPath();p.moveTo(-55,y);p.lineTo(55,y);p.stroke();if(n)p.fillText(String(Math.abs(n)*10),78,y+8);}
    p.strokeStyle='#dfcf80';p.lineWidth=5;p.beginPath();p.moveTo(-100,0);p.lineTo(-28,0);p.lineTo(0,20);p.lineTo(28,0);p.lineTo(100,0);p.stroke();p.restore();
    for(let i=0;i<7;i++){p.fillText(String(500-i*50),75,160+i*70);p.fillText(String(6000-i*500),840,160+i*70);}
    p.strokeStyle='#819c74';p.strokeRect(55,316,105,56);p.strokeRect(817,316,160,56);p.fillText('325',76,354);p.fillText('3500',839,354);
  }else{
    p.save();p.translate(510,365);p.strokeStyle='#46664a';
    for(const r of [80,155,230]){p.beginPath();p.arc(0,0,r,0,Math.PI*2);p.stroke();}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;p.beginPath();p.moveTo(Math.sin(a)*70,Math.cos(a)*70);p.lineTo(Math.sin(a)*245,Math.cos(a)*245);p.stroke();}
    p.strokeStyle='#8fb57f';p.lineWidth=3;p.beginPath();p.moveTo(-130,200);p.lineTo(-85,70);p.lineTo(25,-10);p.lineTo(70,-160);p.stroke();
    p.fillStyle='#98bd85';for(const[x,y]of [[-85,70],[25,-10],[70,-160]]){p.fillRect(x-7,y-7,14,14);}p.restore();p.fillText('RNG  080',60,100);p.fillText('MODE NAV',795,100);
  }
  p.fillStyle='#7e9f74';p.font='23px monospace';for(let i=0;i<8;i++)p.fillText(['SYS','NAV','MAP','FUEL','ENG','COMM','TEST','MENU'][i],30+i*125,738);
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}

function updateDisplay(texture,kind,s){
  if(!texture)return;
  const p=texture.image.getContext('2d'),w=1024,h=768;
  p.fillStyle='#07120f';p.fillRect(0,0,w,h);p.fillStyle='#98ba86';p.strokeStyle='#6d966d';p.lineWidth=3;p.font='25px monospace';
  const elapsed=Math.max(0,Math.floor(s.time||0)),timer=[Math.floor(elapsed/3600),Math.floor(elapsed/60)%60,elapsed%60].map(n=>String(n).padStart(2,'0')).join(':');
  p.fillText(kind==='attitude'?'FLIGHT / LIVE':'N035 / TACTICAL',30,40);p.fillText(timer,820,40);
  if(kind==='attitude'){
    p.save();p.beginPath();p.rect(260,120,500,480);p.clip();p.translate(510,355);p.rotate(-(s.bank||0));p.translate(0,(s.pitchAngle||0)*300);
    p.fillStyle='#294d57';p.fillRect(-600,-1200,1200,1200);p.fillStyle='#51402b';p.fillRect(-600,0,1200,1200);p.strokeStyle='#a8c292';p.beginPath();p.moveTo(-550,0);p.lineTo(550,0);p.stroke();
    p.fillStyle='#a8c292';for(let n=-8;n<=8;n++){if(!n)continue;p.beginPath();p.moveTo(-65,-n*52);p.lineTo(65,-n*52);p.stroke();p.fillText(String(n*10),85,-n*52+8);}p.restore();
    p.strokeStyle='#dfcf80';p.lineWidth=5;p.beginPath();p.moveTo(400,355);p.lineTo(480,355);p.lineTo(510,375);p.lineTo(540,355);p.lineTo(620,355);p.stroke();
    p.fillStyle='#b7cf9c';p.font='36px monospace';p.fillText(Math.round((s.tas||0)*3.6)+' km/h',25,350);p.fillText(Math.round(s.altitude||0)+' m',785,350);
    p.font='27px monospace';p.fillText('G '+(s.g??1).toFixed(1),40,630);p.fillText('AOA '+((s.alpha||0)*180/Math.PI).toFixed(1)+'°',40,674);p.fillText('FUEL '+Math.round(s.fuel??0)+' kg',610,650);
  }else{
    p.save();p.translate(510,355);p.strokeStyle='#46664a';for(const r of [80,155,230]){p.beginPath();p.arc(0,0,r,0,Math.PI*2);p.stroke();}
    p.beginPath();p.moveTo(-230,0);p.lineTo(230,0);p.moveTo(0,-230);p.lineTo(0,230);p.stroke();
    const radar=s.radar,range=radar?.[11]||40000;
    if(radar?.[0]&&radar[5]){const a=radar[9]||0,r=Math.min(230,radar[8]/range*230),x=Math.sin(a)*r,y=-Math.cos(a)*r;p.strokeStyle='#b7d992';p.strokeRect(x-9,y-9,18,18);}
    p.restore();p.fillStyle='#98ba86';p.fillText('RNG '+Math.round(range/1000)+' km',45,90);p.fillText(radar?.[0]?(radar[1]===3?'STT':'SEARCH / TWS'):'RADAR OFF',710,90);
    p.fillText('R-73  '+(s.missiles?.[1]??0),50,650);p.fillText('R-77-1  '+(s.amraam?.[1]??0),570,650);p.fillText('HDG '+String(Math.round(((s.heading||0)*180/Math.PI+360)%360)).padStart(3,'0'),45,690);
  }
  p.fillStyle='#7e9f74';p.font='23px monospace';for(let i=0;i<8;i++)p.fillText(['SYS','NAV','MAP','FUEL','ENG','COMM','TEST','MENU'][i],30+i*125,738);
  texture.needsUpdate=true;
}

export function modernSu35Cockpit(k){
  seat(k);
  const black=new T.MeshStandardMaterial({color:0x192022,roughness:.75,metalness:.1});
  const panel=new T.MeshStandardMaterial({color:0x42636a,roughness:.75,metalness:.15});
  const keys=new T.MeshStandardMaterial({color:0x657076,roughness:.58,metalness:.17});
  const red=new T.MeshStandardMaterial({color:0x9e4538,roughness:.6,metalness:.05});
  const part=11;
  k.box([.94,.43,.17],[0,1.055,-5.94],part,panel);
  for(const [side,kind]of [[-1,'tactical'],[1,'attitude']]){
    k.box([.421,.329,.070],[side*.223,1.06,-5.832],part,black);
    const texture=displayTexture(kind),screen=new T.MeshStandardMaterial({color:texture?0xffffff:0x314e37,map:texture,
      emissive:texture?0x6a7562:0x10201b,emissiveMap:texture,emissiveIntensity:.20,roughness:.32,metalness:.02});
    k.box([.368,.274,.008],[side*.223,1.06,-5.792],part,screen);
    let displayAge=1;k.animations.push((s,dt)=>{displayAge+=dt;if(displayAge<.25||s.altitude===undefined)return;displayAge=0;updateDisplay(texture,kind,s);});
    for(let i=0;i<8;i++)for(const y of [-1,1])k.box([.025,.014,.012],[side*.223+(i-3.5)*.049,1.06+y*.151,-5.784],part,keys);
    for(let i=0;i<6;i++)for(const x of [-1,1])k.box([.013,.024,.012],[side*.223+x*.199,.94+i*.048,-5.784],part,keys);
    k.ellipsoid([.024,.024,.015],[side*.223-.175,.925,-5.777],part,black,undefined,16);
  }
  k.ellipsoid([.49,.085,.18],[0,1.315,-5.96],part,black);
  k.box([.23,.14,.08],[0,1.37,-6.12],part,black);
  for(let row=0;row<3;row++)for(let column=0;column<6;column++)k.box([.023,.018,.009],[(column-2.5)*.032,1.325+row*.033,-6.073],part,keys);
  const glass=new T.MeshPhysicalMaterial({color:0xa2c2b1,roughness:.035,metalness:.04,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide});
  const combiner=k.solid([[-.19,1.45,-6.15],[.19,1.45,-6.15],[.16,1.60,-6.25],[-.16,1.60,-6.25]],part,glass,.003);
  combiner.name='Su-35 HUD combiner';
  for(const side of [-1,1]){
    k.line([[side*.20,1.35,-6.08],[side*.19,1.45,-6.15],[side*.16,1.60,-6.25]],part,black,.011);
    k.box([.14,.12,1.20],[side*.45,.98,-5.03],part,panel);
    k.box([.135,.018,1.13],[side*.45,1.048,-5.03],part,black);
    for(let i=0;i<14;i++){
      const z=-5.53+i*.075;k.box([.022,.008,.018],[side*.447,1.064,z],part,i%6===0?red:keys);
      if(i%3===0)k.line([[side*.48,1.065,z],[side*.48,1.095,z-.005]],part,keys,.005);
    }
  }
  k.line([[.10,.87,-5.51],[.10,1.05,-5.56]],part,black,.026);
  k.ellipsoid([.046,.055,.04],[.10,1.085,-5.56],part,black,undefined,20);
  k.ellipsoid([.012,.012,.012],[.12,1.117,-5.54],part,red,undefined,12);
}
