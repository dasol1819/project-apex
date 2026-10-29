import * as T from './vendor/three.module.js';
import {fair,geometry} from './fighter-exterior-tools.js';
const V=(...v)=>new T.Vector3(...v),lerp=T.MathUtils.lerp;

function softBox(k,size,r,pos,part,mat,parent,angle=0){
  const g=new T.BoxGeometry(...size,6,6,6),p=g.attributes.position,n=g.attributes.normal;
  const inner=V(...size).multiplyScalar(.5).addScalar(-r),v=V(),q=V(),normal=V();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);q.copy(v).clamp(inner.clone().negate(),inner);normal.copy(v).sub(q).normalize();
    v.copy(q).addScaledVector(normal,r);p.setXYZ(i,...v.toArray());n.setXYZ(i,...normal.toArray());
  }
  g.rotateX(angle);g.translate(...pos);return k.mesh(g,mat,part,parent);
}
function rod(k,a,b,r,part,mat,parent,sides=12){
  const delta=V(...b).sub(V(...a)),g=new T.CylinderGeometry(r,r,delta.length(),sides);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),delta.clone().normalize()));
  g.translate(...V(...a).add(V(...b)).multiplyScalar(.5).toArray());return k.mesh(g,mat,part,parent);
}
function webbing(k,points,width,part,material,normal){
  const curve=new T.CatmullRomCurve3(points.map(p=>V(...p)),false,'centripetal'),p=[],ix=[];
  for(let i=0;i<=24;i++){
    const t=i/24,center=curve.getPointAt(t),edge=V(...normal).cross(curve.getTangentAt(t)).normalize().multiplyScalar(width*.5);
    p.push(...center.clone().sub(edge).toArray(),...center.clone().add(edge).toArray());
    if(i<24){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  return k.mesh(geometry(p,ix),material,part);
}

export function blendedSkin(k){
  // The Flanker's broad lifting centrebody is a continuous double-curved skin.
  // Its shoulders meet the airfoil; they are not flat plates on a narrow tube.
  const source=[[-7.35,.59,.465,-.035],[-6.65,.74,.71,.03],[-6.36,.79,.73,.05],[-6.34,.80,.73,.05],[-5.5,.94,.76,.10],
    [-4.12,1.42,.77,.15],[-4.0,1.46,.77,.15],[-3.3,1.74,.76,.16],[-1.8,2.12,.73,.17],[.5,2.48,.70,.17],
    [3.15,2.56,.63,.17],[5.15,2.40,.55,.17],[6.1,2.12,.46,.14],[7.3,1.72,.37,.08],[8.25,.71,.26,.015]];
  const rows=fair(source,8),N=48,p=[],ix=[];
  const smooth=(a,b,v)=>{const t=T.MathUtils.clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
  const hood=[[-6.36,0,.57],[-6.34,.49,.57],[-5.92,.52,.58],[-5.36,.50,.59],[-4.75,.39,.60],[-4.12,.095,.62],[-4.00,0,.62]];
  const hoodValue=(z,component=1)=>{if(z<=hood[0][0]||z>=hood.at(-1)[0])return component===1?0:.60;const i=hood.findIndex((r,i)=>i<hood.length-1&&z>=r[0]&&z<=hood[i+1][0]);return lerp(hood[i][component],hood[i+1][component],(z-hood[i][0])/(hood[i+1][0]-hood[i][0]));};
  // Each bank terminates at the exact curved aperture, avoiding staircase cuts.
  for(const side of [-1,1]){
    const base=p.length/3;
    for(const [z,w,crown,edge] of rows)for(let i=0;i<=N;i++){
      const x=side*lerp(hoodValue(z),w,i/N),u=Math.abs(x)/w;
      const exponent=lerp(.5,2.5,smooth(-5.5,-2,z));
      let y=edge+(crown-edge)*Math.pow(Math.max(0,1-u*u),exponent);
      y+=.14*Math.exp(-Math.pow((Math.abs(x)-1.63)/.55,2))*smooth(-3.5,-.8,z)*(1-smooth(5.8,8.3,z))*Math.pow(Math.max(0,1-u*u),.5);
      const sealInfluence=smooth(-6.42,-6.34,z)*(1-smooth(-4.0,-3.8,z));
      if(sealInfluence>0)y=lerp(y,hoodValue(z,2)-.025,Math.exp(-Math.pow((Math.abs(x)-hoodValue(z))/.16,2))*sealInfluence);
      p.push(x,y,z);
    }
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<N;i++){
      const a=base+j*(N+1)+i,b=a+N+1;
      ix.push(...(side>0?[a,b,a+1,a+1,b,b+1]:[a,a+1,b,a+1,b+1,b]));
    }
  }
  const mesh=k.mesh(geometry(p,ix),k.materials.skin,0);mesh.name='Su-35 sculpted lifting centrebody / continuous LERX';
  return mesh;
}

export function detailedCockpit(k){
  const M=k.materials,part=11;
  const painted=new T.MeshStandardMaterial({color:0x567e84,roughness:.72,metalness:.13});
  const black=new T.MeshStandardMaterial({color:0x111719,roughness:.80,metalness:.1});
  const fabric=new T.MeshStandardMaterial({color:0x333c35,roughness:.97,metalness:0});
  const straps=new T.MeshStandardMaterial({color:0x8e8c73,roughness:.95,metalness:0,side:T.DoubleSide});
  const screen=new T.MeshStandardMaterial({color:0x101a15,roughness:.28,emissive:0x14301c,emissiveIntensity:.20});
  softBox(k,[.95,.30,2.15],.10,[0,.21,-5.24],part,black);
  for(const side of [-1,1]){
    softBox(k,[.16,.18,1.65],.025,[side*.43,.46,-5.27],part,painted);
    softBox(k,[.12,.025,1.47],.012,[side*.43,.565,-5.30],part,black);
    for(let j=0;j<13;j++){
      const z=-5.96+j*.105;
      k.box([.035,.014,.018],[side*.43,.588,z],part,j%4===0?M.red:M.frame);
      rod(k,[side*.46,.584,z],[side*.46,.617,z-.005],.006,part,M.metal);
    }
  }
  softBox(k,[.47,.16,.56],.055,[0,.45,-5.32],part,fabric);
  softBox(k,[.48,.59,.19],.06,[0,.82,-5.02],part,fabric,undefined,.12);
  softBox(k,[.32,.23,.22],.05,[0,1.09,-4.98],part,black);
  for(const side of [-1,1]){
    softBox(k,[.10,.42,.14],.025,[side*.28,.73,-5.02],part,black);
    webbing(k,[[side*.14,1.03,-5.14],[side*.17,.80,-5.19],[side*.11,.55,-5.55]],.045,part,straps,[0,0,-1]);
    webbing(k,[[side*.20,.56,-5.17],[side*.18,.52,-5.42],[side*.05,.51,-5.54]],.048,part,straps,[0,1,0]);
    rod(k,[side*.25,.44,-5.14],[side*.25,1.07,-4.93],.018,part,M.metal);
  }
  softBox(k,[.065,.033,.053],.009,[0,.52,-5.54],part,M.metal);
  const handle=Array.from({length:25},(_,i)=>{const a=i/24*Math.PI;return[Math.cos(a)*.075,.47+Math.sin(a)*.07,-5.69];});
  k.line(handle,part,M.yellow,.010);
  // Two large MFDs, front coaming, keypad and a separate HUD combiner.
  softBox(k,[.91,.40,.13],.035,[0,.59,-6.10],part,painted);
  for(const side of [-1,1]){
    softBox(k,[.39,.30,.055],.018,[side*.215,.62,-6.024],part,black);
    k.box([.335,.239,.007],[side*.215,.62,-5.991],part,screen);
    for(let i=0;i<7;i++)for(const dy of [-.142,.142])k.box([.022,.012,.012],[side*.215+(i-3)*.048,.62+dy,-5.986],part,M.frame);
  }
  softBox(k,[.93,.10,.34],.045,[0,.82,-6.12],part,black);
  softBox(k,[.20,.13,.09],.014,[0,.94,-6.18],part,black);
  const combiner=new T.MeshPhysicalMaterial({color:0x94b7a7,roughness:.035,transparent:true,opacity:.26,depthWrite:false,side:T.DoubleSide});
  k.solid([[-.18,.94,-6.19],[.18,.94,-6.19],[.15,1.19,-6.28],[-.15,1.19,-6.28]],part,combiner,.003);
  for(const side of [-1,1])k.line([[side*.18,.91,-6.11],[side*.18,.96,-6.20],[side*.15,1.19,-6.28]],part,black,.012);
  rod(k,[.09,.43,-5.78],[.09,.66,-5.84],.025,part,black);
  softBox(k,[.075,.10,.07],.025,[.09,.69,-5.84],part,black);
  k.ellipsoid([.016,.016,.013],[.09,.73,-5.80],part,M.red,undefined,12);
  rod(k,[-.40,.57,-5.51],[-.40,.65,-5.56],.018,part,black);
  // Paint-coloured aperture lip and the black pressure seal follow the canopy.
  const sill=[[-6.34,.51,.57],[-5.92,.54,.58],[-5.36,.52,.59],[-4.75,.41,.60],[-4.12,.12,.62]];
  for(const side of [-1,1]){
    k.line(sill.map(([z,w,y])=>[side*w,y-.025,z]),part,M.skin,.040);
    k.line(sill.map(([z,w,y])=>[side*w,y+.009,z]),part,black,.012);
  }
}

export function flankerNozzle(k,side){
  const cx=side*1.65,cy=-.36,part=side<0?22:23,M=k.materials;
  const root=new T.Group();root.position.set(cx,cy,8.55);root.userData.pivot=[cx,cy,8.55];root.userData.keepGroup=true;
  root.name='Su-35 gimballed AL-41F1S nozzle';k.parts[part].add(root);
  const p=[],opened=[],ix=[],N=24,R=11,C=5;
  for(let blade=0;blade<N;blade++){
    const base=p.length/3;
    for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){
      const u=j/R,v=i/C,a=(blade+(v*1.02-.01))/N*Math.PI*2;
      const z=8.69+u*1.39;
      const r=lerp(.672,.505,Math.pow(u,1.7))+.008*Math.sin(v*Math.PI)+.007*Math.sin(u*Math.PI)+v*.003;
      p.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z);
      const ro=r+.132*Math.pow(u,1.45);opened.push(cx+Math.cos(a)*ro,cy+Math.sin(a)*ro,z);
    }
    for(let j=0;j<R;j++)for(let i=0;i<C;i++){
      const a=base+j*(C+1)+i,b=a+C+1;ix.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const g=geometry(p,ix);g.morphTargetsRelative=true;g.morphAttributes.position=[new T.Float32BufferAttribute(opened.map((v,i)=>v-p[i]),3)];
  const feathers=k.mesh(g,M.nozzle,part,root);feathers.name='Su-35 24 overlapping profiled nozzle feathers';feathers.material.side=T.DoubleSide;feathers.userData.keepDynamic=true;
  const ceramic=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.92,metalness:.08,side:T.DoubleSide});
  const ip=[],op=[],ii=[],innerColors=[];
  for(let blade=0;blade<N;blade++){
    const base=ip.length/3;
    for(let j=0;j<=8;j++)for(let i=0;i<=3;i++){
      const u=j/8,a=(blade+i/3*1.015)/N*Math.PI*2,r=lerp(.49,.485,u)+i/3*.002,z=8.30+u*1.78;
      ip.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z);
      const shade=(.0035+.040*Math.pow(u,2))*(.94+.06*Math.sin(blade*7.1));innerColors.push(shade,shade*.98,shade*.87);
      const ro=r+.132*Math.pow(u,2);op.push(cx+Math.cos(a)*ro,cy+Math.sin(a)*ro,z);
    }
    for(let j=0;j<8;j++)for(let i=0;i<3;i++){const a=base+j*4+i,b=a+4;ii.push(a,b,a+1,a+1,b,b+1);}
  }
  const innerG=geometry(ip,ii);innerG.setAttribute('color',new T.Float32BufferAttribute(innerColors,3));innerG.morphTargetsRelative=true;innerG.morphAttributes.position=[new T.Float32BufferAttribute(op.map((v,i)=>v-ip[i]),3)];
  const inner=k.mesh(innerG,ceramic,part,root);inner.name='Su-35 overlapping ceramic inner feathers';inner.userData.keepDynamic=true;
  for(const [z,r] of [[8.60,.68],[8.78,.68],[9.07,.651]]){
    const arc=Array.from({length:145},(_,i)=>{const a=i/144*Math.PI*2;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r,z];});
    k.line(arc,part,M.titanium,.012,root);
  }
  const steel=new T.MeshStandardMaterial({color:0x676c6a,roughness:.34,metalness:.83,envMapIntensity:.65});
  for(let i=0;i<N;i++){
    const a=(i+.5)/N*Math.PI*2;
    const point=(r,z)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r,z];
    rod(k,point(.69,8.59),point(.69,8.90),.012,part,steel,root);
    rod(k,point(.69,8.79),point(.665,9.10),.007,part,steel,root);
    for(const z of [8.63,8.81]){
      const g=new T.CylinderGeometry(.009,.009,.008,8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),V(Math.cos(a),Math.sin(a),0)));
      g.translate(...point(.690,z));k.mesh(g,steel,part,root);
    }
  }
  const darkness=new T.MeshStandardMaterial({color:0x080909,roughness:.98,metalness:0});
  k.tube(.47,.47,.04,[cx,cy,8.20],part,darkness,{parent:root});
  const ring=Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return[cx+Math.cos(a)*.35,cy+Math.sin(a)*.35,8.23];});
  const holder=new T.MeshStandardMaterial({color:0x292c29,roughness:.88,metalness:.25});
  k.line(ring,part,holder,.012,root);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;rod(k,[cx,cy,8.225],[cx+Math.cos(a)*.43,cy+Math.sin(a)*.43,8.225],.008,part,holder,root);}
  const frame=new T.Group();frame.name='Su-35 physical exhaust exit';frame.position.set(0,0,10.08-8.55);frame.userData.keepGroup=true;root.add(frame);
  k.animations.push(s=>{root.rotation.set(s.vectorPitch||0,side*(s.vectorYaw||0),0);feathers.morphTargetInfluences[0]=s.afterburner??.3;inner.morphTargetInfluences[0]=s.afterburner??.3;});
  k.batch(root);return frame;
}

export function installStudioMarkings(model){
  // Browser-only high-resolution vector typography, kept out of the geometry.
  if(typeof document==='undefined')return;
  const texture=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;};
  const bort=texture(512,256,(c,w,h)=>{c.font='italic 700 220px Arial';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.strokeStyle='#e2e2d4';c.lineWidth=14;c.strokeText('01',w/2,h/2+10);c.fillStyle='#983c35';c.fillText('01',w/2,h/2+10);});
  const flag=texture(512,384,(c,w,h)=>{c.fillStyle='#d8dbd6';c.fillRect(5,5,w-10,h/3);c.fillStyle='#294969';c.fillRect(5,h/3,w-10,h/3);c.fillStyle='#913b37';c.fillRect(5,h/3*2,w-10,h/3-5);});
  const finLabel=texture(1024,256,(c,w,h)=>{c.font='500 96px Arial';c.textAlign='center';c.fillStyle='#293a42';c.fillText('ВКС РОССИИ',w/2,104);c.font='500 49px Arial';c.fillText('СУ-35С',w/2,190);});
  const add=(tex,points,part)=>{
    const g=geometry(points.flat(),[0,1,2,0,2,3]);g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
    const m=new T.MeshStandardMaterial({map:tex,transparent:true,roughness:.75,metalness:.04,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:T.DoubleSide});
    const mesh=new T.Mesh(g,m);mesh.name='Su-35 painted marking';model.damageParts[part].add(mesh);return mesh;
  };
  function projected(tex,side,z0,z1,y0,y1,part){
    const surfaces=[];model.damageParts[part].traverse(o=>{if(o.isMesh&&o.material.userData.airframeSurface)surfaces.push(o);});
    const p=[],uv=[],ix=[],cols=24,rows=8;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const u=i/cols,v=j/rows,z=lerp(z0,z1,u),y=lerp(y0,y1,v);
      const ray=new T.Raycaster(V(side*5,y,z),V(-side,0,0),0,6),hit=ray.intersectObjects(surfaces,false)[0];
      if(!hit)throw new Error('Su-35 marking lies outside its skin: '+part+' / '+y+' / '+z);
      p.push(hit.point.x+side*.004,y,z);uv.push(u,v);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;ix.push(a,a+1,b,a+1,b+1,b);}
    const g=geometry(p,ix);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    const material=new T.MeshStandardMaterial({map:tex,transparent:true,roughness:.75,metalness:.04,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:T.DoubleSide});
    const mesh=new T.Mesh(g,material);mesh.name='Su-35 conformal painted marking';model.damageParts[part].add(mesh);
  }
  model.group.updateMatrixWorld(true);
  for(const side of [-1,1]){
    projected(bort,side,side>0?-5.51:-6.54,side>0?-6.54:-5.51,-.01,.36,0);
    const part=side<0?5:6;
    projected(flag,side,side>0?8.25:7.80,side>0?7.80:8.25,2.75,2.95,part);
    projected(finLabel,side,side>0?8.20:6.90,side>0?6.90:8.20,1.02,1.35,part);
  }
  const display=texture(1024,768,(c,w,h)=>{
    c.fillStyle='#0a1717';c.fillRect(0,0,w,h);c.lineWidth=5;c.strokeStyle='#577c61';c.fillStyle='#81a77c';c.font='30px monospace';
    for(let j=0;j<8;j++){const y=65+j*82;c.fillText(String(700-j*50),35,y);c.beginPath();c.moveTo(160,y);c.lineTo(202,y);c.stroke();}
    c.save();c.translate(w*.57,h*.49);c.strokeStyle='#7f9c63';c.beginPath();c.arc(0,0,195,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(-240,0);c.lineTo(240,0);c.moveTo(0,-210);c.lineTo(0,210);c.stroke();
    for(let y=-150;y<=150;y+=50){c.beginPath();c.moveTo(-70,y);c.lineTo(70,y);c.stroke();}c.restore();c.font='32px monospace';c.fillText('NAV   035     12:48',240,h-35);
  });
  for(const side of [-1,1])add(display,[[side*.215-.167,.50,-5.986],[side*.215+.167,.50,-5.986],[side*.215+.167,.739,-5.986],[side*.215-.167,.739,-5.986]],11);
}
