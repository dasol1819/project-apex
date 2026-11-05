import * as T from './vendor/three.module.js';
import {createAirframeKit} from './classic-airframe-kit.js';
import {aircraftDefinition} from './aircraft-catalog.js';
import {bakeAirframeSurfaceCoordinates} from './airframe-surface.js';
import {applyMig15Metal} from './mig15bis-finish.js';

// Authored MiG-15bis SD, not an alias of a modern fighter. Editable stations
// are metres: X starboard, Y up, Z aft; geometry and native contacts share CG.
export const MIG15_STATIONS=Object.freeze([
 [-4.68,.556,.546,0],[-4.60,.578,.566,0],[-4.28,.644,.611,.012],
 [-3.39,.735,.695,.025],[-2.49,.786,.747,.015],[-1.10,.808,.780,0],
 [.38,.786,.753,-.012],[1.28,.745,.701,-.008],[2.10,.650,.602,-.012],
 [2.78,.543,.484,-.035],[3.18,.440,.397,-.055],[3.45,.398,.371,-.060]
]);
export function createMig15bisAircraft(){
 const d=aircraftDefinition(15),k=createAirframeKit({...d,previewOnly:false});
 const {group,parts,mesh,loft,airfoil,solid,ellipsoid,line,box,tube,hinge}=k;
 const mat=(name,color,r=.43,m=.77)=>{const a=new T.MeshStandardMaterial({name,color,roughness:r,metalness:m});return a;};
 const aluminium=mat('MiG-15bis aluminium alloy',0xbcc2c5),lip=mat('polished inlet lip',0xc6cacc,.29,.86),
 heat=mat('VK-1 tailpipe heat-resistant steel',0x6e777b,.47,.81),inner=mat('recessed intake duct',0x3b4448,.73,.40),
 dark=mat('cockpit and duct shadow',0x10191c,.86,.08),frame=mat('grey-green cockpit frames',0x657471,.59,.38),
 red=mat('Soviet red insignia',0x962a22,.61,.12),white=mat('insignia border',0xd5d4c5,.57,.19),rubber=mat('wheel rubber',0x1d2224,.95,.02),
 chrome=mat('oleo chrome',0xb2b9ba,.24,.88),seat=mat('ejection seat upholstery',0x35423c,.87,.03);
 const skinSet=new Set([aluminium,lip,heat]);
 k.materials.skin=aluminium;k.materials.metal=chrome;k.materials.dark=dark;k.materials.frame=frame;k.materials.rubber=rubber;
 group.name='MiG-15bis · VK-1';group.userData.modelRevision=2;group.userData.noAfterburner=true;
 group.userData.gearContacts=[[0,-1.10,-3.03],[-1.63,-1.10,.25],[1.63,-1.10,.25]];
 group.userData.intakes=[{center:[-.27,0,-4.68],radius:.22},{center:[.27,0,-4.68],radius:.22}];
 group.userData.modelLandmarks={nose:[0,0,-4.68],tail:[0,-.06,3.45],wingTips:[[-5.0425,-.40109,1.84],[5.0425,-.40109,1.84]],finTop:[0,2.60,4.60],nozzle:[0,-.06,3.45]};
 loft(MIG15_STATIONS.slice(0,4),10,aluminium,{samples:5});
 loft(MIG15_STATIONS.slice(3,8),0,aluminium,{samples:5});
 loft(MIG15_STATIONS.slice(7),29,aluminium,{samples:5});
 // Rounded annular lip, open duct and its full-depth vertical splitter.
 const rim=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;rim.push([Math.cos(a)*.552,Math.sin(a)*.542,-4.682]);}
 line(rim,10,lip,.019);
 const duct=loft([[-4.68,.533,.523,0],[-4.41,.529,.515,0],[-3.81,.56,.53,0],[-3.08,.57,.52,.01]],27,inner,{samples:3});duct.material.side=T.BackSide;
 tube(.544,.544,.025,[0,0,-3.05],27,dark);
 loft([[-4.695,.030,.523,0],[-4.44,.055,.52,0],[-3.46,.085,.52,0]],28,aluminium,{segments:32,samples:3});
 // Properly recessed tailpipe with fixed area: VK-1 has no AB petals/TVC.
 const tailpipe=loft([[2.36,.335,.322,-.06],[3.02,.358,.337,-.06],[3.455,.382,.355,-.06]],22,heat,{samples:3});tailpipe.material.side=T.DoubleSide;
 tube(.31,.31,.025,[0,-.06,2.28],7,dark);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;line([[.17*Math.cos(a),-.06+.17*Math.sin(a),2.31],[.29*Math.cos(a+.27),-.06+.29*Math.sin(a+.27),2.31]],7,heat,.014);}
 const exhaust=new T.Group();exhaust.position.set(0,-.06,3.455);exhaust.name='VK-1 fixed exit';parts[22].add(exhaust);exhaust.userData.keepGroup=true;
 // A subtle hot turbine core is contained inside the pipe, never a long flame.
 const coreMaterial=new T.MeshBasicMaterial({color:0x8b3520,transparent:true,opacity:0,depthWrite:false});
 const core=new T.Mesh(new T.CircleGeometry(.15,32),coreMaterial);core.rotation.y=Math.PI;core.position.set(0,-.06,2.32);core.userData.visualEffect=true;parts[7].add(core);
 // Fixed wing centre, 35-degree swept tips, conventional separate controls.
 // TR-AE-63 (VK-1), section I: approximately two degrees anhedral.
 // The physical control axis follows the swept cut edge, not global X.
 const anhedral=Math.tan(T.MathUtils.degToRad(2)),controlCut=.73;
 const wing=(x)=>[x,-.225-Math.abs(x)*anhedral,-2.46+Math.abs(x)*.735,.443+Math.abs(x)*.394,.31-Math.abs(x)*.041];
 const tip=(s)=>{const row=wing(s*5.0425);row[4]=.025;return row;};
 const cutAt=(x)=>{const [span,y,le,te]=wing(x);return [span,y,T.MathUtils.lerp(le,te,controlCut)];};
 const cutSweep=.735+(.394-.735)*controlCut;
 for(const s of [-1,1]){
  const wi=s<0?1:2,outer=s<0?12:13,ail=s<0?14:15,flap=s<0?16:17,tail=s<0?3:4;
  airfoil([wing(s*.62),wing(s*2.65)],wi,aluminium,{chordRange:[0,.73]});
  airfoil([wing(s*2.65),wing(s*4.90),tip(s)],outer,aluminium,{chordRange:[0,.73]});
  const fh=hinge(flap,cutAt(s*1.65),s<0?'leftFlap':'rightFlap',[1,-s*anhedral,s*cutSweep],1);
  airfoil([wing(s*.81),wing(s*2.64)],flap,aluminium,{chordRange:[.73,1],parent:fh});
  const ah=hinge(ail,cutAt(s*3.77),s<0?'leftAileron':'rightAileron',[1,-s*anhedral,s*cutSweep],1);
  airfoil([wing(s*2.65),wing(s*4.9),tip(s)],ail,aluminium,{chordRange:[.73,1],parent:ah});
  // Exactly two spanwise-flow fences on each wing (MiG-17 has three).
  for(const x of [2.16,3.58]){
   const st=wing(s*x),le=st[2],te=st[3],y=st[1]+st[4]*.55;
   solid([[s*x,y-.015,le+.035],[s*x,y+.115,le+.13],[s*x,y+.125,te-.19],[s*x,y-.01,te-.035]],x<2.65?wi:outer,aluminium,.009);
  }
  // Upper fuselage blend at the wing carry-through.
  ellipsoid([.34,.13,1.20],[s*.74,-.20,-.05],wi,aluminium,undefined,32);
  const tp=x=>[s*x,1.63,3.08+x*.84,4.67+x*.39,.13-x*.052];
  airfoil([tp(.06),tp(.92),tp(1.75)],tail,aluminium,{chordRange:[0,.68]});
  const eh=hinge(tail,[0,1.63,4.24],s<0?'leftTail':'rightTail',[1,0,.39*s],1);
  airfoil([tp(.06),tp(.92),tp(1.75)],tail,aluminium,{chordRange:[.68,1],parent:eh});
  // Rear-fuselage clamshell airbrakes, not rudder toe-out.
  const brake=new T.Group();brake.position.set(s*.607,-.04,1.98);brake.userData.keepGroup=true;brake.name='MiG-15bis rear speed brake';parts[29].add(brake);
  const bg=new T.BoxGeometry(.028,.53,.62);bg.translate(0,0,.31);const bm=new T.Mesh(bg,aluminium);brake.add(bm);
  line([[s*.61,-.305,1.98],[s*.61,.225,1.98]],29,heat,.009);
  k.animations.push(st=>{brake.rotation.y=s*Math.max(0,Math.min(1,st.airbrake??0))*.88;});
  // Flush red stars; original Soviet-style livery, not a claimed serial.
  const star=(center,size,plane,part)=>{for(const [scale,m,layer]of [[1,white,.002],[.87,red,.004]]){
    const p=[];for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,r=size*(j%2?.405:1)*scale;p.push(plane==='top'?[center[0]+Math.cos(a)*r,center[1],center[2]+Math.sin(a)*r]:[center[0]+s*layer,center[1]-Math.sin(a)*r,center[2]+Math.cos(a)*r]);}
    if(plane!=='top'){solid(p,part,m,.001);continue;}
    // Subdivide and drape the marking over the actual airfoil profile. A flat
    // decal through a curved wing produces half-hidden stars and z-fighting.
    const triangles=T.ShapeUtils.triangulateShape(p.map(q=>new T.Vector2(q[0],q[2])),[]),out=[],moving=[];
    const surface=q=>{const st=wing(q[0]),u=T.MathUtils.clamp((q[2]-st[2])/(st[3]-st[2]),0,1),profile=(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u*u*u-.1036*u*u*u*u)/.1;return[q[0],st[1]+st[4]*profile*.5+layer,q[2]];};
    // Split each paint triangle at the physical control cut. Paint aft of
    // the seam belongs to the aileron, so it cannot float above a deflection.
    const clip=(poly,aft)=>{const result=[],distance=q=>(q[2]-cutAt(q[0])[2])*(aft?1:-1);for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)result.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);result.push(surface(a.map((v,j)=>T.MathUtils.lerp(v,b[j],t))));}}return result;};
    const push=(a,b,c)=>{for(const [aft,dst]of [[false,out],[true,moving]]){const poly=clip([a,b,c],aft);for(let i=1;i+1<poly.length;i++){const a=poly[0],b=poly[i],c=poly[i+1],av=new T.Vector3(...a),bv=new T.Vector3(...b),cv=new T.Vector3(...c);if(bv.sub(av).cross(cv.sub(av)).y<0)dst.push(...a,...c,...b);else dst.push(...a,...b,...c);}}};
    for(const ids of triangles){const a=new T.Vector3(...p[ids[0]]),b=new T.Vector3(...p[ids[1]]),c=new T.Vector3(...p[ids[2]]),n=6,at=(i,j)=>surface(a.clone().multiplyScalar(1-(i+j)/n).addScaledVector(b,i/n).addScaledVector(c,j/n).toArray());for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){push(at(i,j),at(i+1,j),at(i,j+1));if(j<n-i-1)push(at(i+1,j),at(i+1,j+1),at(i,j+1));}}
    for(const [vertices,region,parent]of [[out,part,undefined],[moving,ail,ah]]){if(!vertices.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();mesh(g,m,region,parent,'conformal Soviet star');}
   }};
  const st=wing(s*3.64);star([s*3.64,st[1]+st[4]*.505,1.12],.44,'top',outer);
  star([s*.071,1.52,3.70],.29,'side',5);
  k.navLight([s*5.038,wing(s*5.038)[1]+.01,1.84],s<0?0xd72b20:0x28a267,outer);
 }
 // Swept single fin, horizontal stabilizer through it; separate aft rudder.
 const finStations=[[.43,0,1.13,3.75,.17],[1.35,0,2.50,4.50,.13],[2.42,0,4.02,5.30,.08],[2.55,0,4.20,5.25,.045],[2.60,0,4.42,5.08,.015]];
 const ff=airfoil(finStations,5,aluminium,{chordRange:[0,.73]});ff.geometry.rotateZ(Math.PI/2);
 const rudder=hinge(20,[0,1.45,4.08],'leftRudder',[0,1,0],1);
 const rf=airfoil(finStations,20,aluminium,{chordRange:[.73,1]});rf.geometry.rotateZ(Math.PI/2);rf.geometry.translate(0,-1.45,-4.08);parts[20].remove(rf);rudder.add(rf);
 // Raised spine and the framed single-seat cockpit with forward windscreen.
 loft([[-1.95,.35,.13,.73],[-1.30,.29,.18,.75],[-.35,.18,.12,.74],[.75,.08,.055,.73]],0,aluminium,{samples:5,segments:48});
 box([.57,.035,1.45],[0,.72,-2.61],11,dark);
 box([.41,.30,.13],[0,.93,-2.08],11,frame);box([.35,.24,.08],[0,.97,-2.15],11,seat);
 box([.35,.07,.40],[0,.79,-2.38],11,seat);box([.35,.26,.09],[0,.88,-3.03],11,dark);
 for(let i=0;i<7;i++){
  const a=i/7*Math.PI*1.7;const gauge=new T.Mesh(new T.CircleGeometry(.037,16),new T.MeshBasicMaterial({color:0x8faaa0}));gauge.position.set(Math.cos(a)*.12,.92+Math.sin(a)*.06,-2.974);parts[11].add(gauge);
 }
 line([[0,.80,-2.52],[0,1.01,-2.58]],11,dark,.019);
 const glass=new T.MeshPhysicalMaterial({name:'MiG-15bis glazing',color:0xb7d1cf,transparent:true,opacity:.36,roughness:.10,metalness:.08,clearcoat:1,side:T.DoubleSide,depthWrite:false});
 k.materials.glass=glass;
 k.canopy([[-3.60,.17,.74,.02],[-3.13,.33,.78,.40],[-2.88,.36,.79,.48]],11,{frameStations:[-3.13,-2.88]});
 const canopyMeshes=new Set(parts[11].children);
 k.canopy([[-2.88,.36,.79,.48],[-2.20,.37,.80,.51],[-1.85,.34,.80,.43],[-1.43,.16,.78,.14],[-1.35,.03,.76,.02]],11,{frameStations:[-2.88,-1.43]});
 const canopySlide=new T.Group();canopySlide.name='rear-sliding MiG-15bis canopy';canopySlide.userData.keepGroup=true;parts[11].add(canopySlide);
 for(const c of [...parts[11].children])if(c!==canopySlide&&!canopyMeshes.has(c)){parts[11].remove(c);canopySlide.add(c);}
 k.animations.push(st=>{canopySlide.position.z=T.MathUtils.clamp(st.canopy??0,0,1)*.78;});
 line([[-.37,.74,-3.2],[-.38,.75,-1.52]],11,frame,.015);line([[.37,.74,-3.2],[.38,.75,-1.52]],11,frame,.015);
 // Three separate muzzle fairings: NR-23 pair port and N-37D starboard.
 const gunMounts=[[-.28,-.62,-4.60],[-.46,-.53,-4.44],[.34,-.59,-4.60]];
 for(let i=0;i<3;i++){
  const [x,y,z]=gunMounts[i],r=i===2?.054:.038;
  ellipsoid([r*1.9,r*1.6,.50],[x,y,z+.46],10,aluminium,undefined,24);
  tube(r,r,.48,[x,y,z+.06],10,heat,{open:true,sides:24});tube(r*.72,r*.72,.015,[x,y,z+.10],10,dark);
 }
 // Distinct short undercarriage, matched to the native contact plane.
 const gearGroups=[];
 for(const [i,[x,ground,z]] of group.userData.gearContacts.entries()){
  const part=24+i,main=i>0,topY=main?-.30:-.50,r=main?.31:.215,side=Math.sign(x)||1,cy=ground+r;
  const leg=new T.Group();leg.position.set(x,topY,z);leg.userData.keepGroup=true;leg.name=main?'MiG main gear':'MiG nose gear';parts[part].add(leg);leg.userData.pivot=[x,topY,z];
  line([[x,topY,z],[x+side*.09,cy+.09,z-.08]],part,frame,.045,leg);
  line([[x+side*.09,cy+.08,z-.08],[x+side*.07,cy+.35,z-.05]],part,chrome,.029,leg);
  line([[x+(main?side*.26:0),topY,z+.38],[x,cy+.26,z]],part,frame,.021,leg);
  line([[x,cy+.40,z-.10],[x+side*.11,cy+.25,z-.16],[x,cy+.14,z-.10]],part,chrome,.015,leg);
  const tyre=new T.TorusGeometry(r*.77,r*.23,12,36);tyre.rotateY(Math.PI/2);tyre.translate(x+side*.07,cy,z-.08);mesh(tyre,rubber,part,leg,'rubber tyre');
  tube(r*.49,r*.49,main?.19:.13,[x+side*.07,cy,z-.08],part,frame,{axis:'x',parent:leg,sides:24});
  tube(r*.22,r*.22,main?.205:.145,[x+side*.07,cy,z-.08],part,chrome,{axis:'x',parent:leg,sides:16});
  const door=new T.Group();door.position.set(x-side*.17,topY,z);door.userData.keepGroup=true;parts[part].add(door);
  const dg=new T.BoxGeometry(main?.40:.29,.018,main?.67:.54);dg.translate(side*.17,0,0);door.add(new T.Mesh(dg,aluminium));
  box([main?.40:.25,.012,main?.67:.54],[x,topY+.025,z],9,dark);
  gearGroups.push({leg,door,side,main});
 }
 k.animations.push(st=>{const g=T.MathUtils.clamp(st.gear??0,0,1);for(const e of gearGroups){e.leg.visible=g>.01;e.leg.rotation[e.main?'z':'x']=(1-g)*(e.main?e.side*1.48:1.49);e.door.rotation.z=e.side*g*1.45;if(!e.main)e.leg.rotation.y=-(st.yawInput??0)*.2*g;}});
 // Right-wing pitot, antenna mast, gun access panel and small service details.
 line([[4.73,wing(4.73)[1]+.02,1.49],[4.73,wing(4.73)[1]+.02,.51]],13,chrome,.009);
 solid([[.04,.82,-1.69],[.04,1.15,-1.47],[.04,.80,-1.34]],0,frame,.025);
 for(const x of [-.58,.58])line([[x,.35,-3.15],[x,.37,-2.68],[x,.22,-2.50]],10,heat,.004);
 // Original red 23 identity, built from small vector strokes on the compound
 // fuselage curvature. The number does not purport to identify a museum jet.
 for(const side of [-1,1])for(const [digit,offset]of [['2',-.25],['3',.25]]){
  const zc=-3.18-side*offset;
  const strokes={a:[-.16,.25,.16,.25],b:[.16,.25,.16,0],c:[.16,0,.16,-.25],d:[-.16,-.25,.16,-.25],e:[-.16,0,-.16,-.25],f:[-.16,.25,-.16,0],g:[-.16,0,.16,0]},use=digit==='2'?'abged':'abgcd';
  for(const name of use){const [z0,y0,z1,y1]=strokes[name],pts=[];for(let j=0;j<=6;j++){const t=j/6,z=zc-side*T.MathUtils.lerp(z0,z1,t),y=T.MathUtils.lerp(y0,y1,t),r=.735+(z+3.39)*(.786-.735)/.90;pts.push([side*(Math.sqrt(Math.max(.01,r*r-y*y))+.004),y,z]);}line(pts,10,red,.019);}
 }
 const model=k.finish({gunMount:gunMounts[0],gunPart:10,wingTips:group.userData.modelLandmarks.wingTips,exhaustFrames:[exhaust]});
 const otherFlashes=gunMounts.slice(1).map(p=>{const f=model.gun.flash.clone();f.position.set(p[0],p[1],p[2]-.32);parts[10].add(f);return f;});
 const health=parts.map(()=>({value:1}));
 group.traverse(o=>{if(o.isMesh&&skinSet.has(o.material)){
  let part=0;for(let p=o.parent;p;p=p.parent)if(p.userData.damageIndex!==undefined){part=p.userData.damageIndex;break;}
  o.material=o.material.clone();applyMig15Metal(o.material,part,health[part]);
 }});
 bakeAirframeSurfaceCoordinates(group);
 const base=model.update;
 model.update=(st={},dt)=>{for(let i=0;i<30;i++)health[i].value=st.health?.[i]??1;base({...st,afterburner:0},dt);for(const f of otherFlashes)f.visible=model.gun.flash.visible;coreMaterial.opacity=Math.max(0,(st.engine??0)-.65)*.25;core.visible=coreMaterial.opacity>.001&&health[7].value>=.08;};
 model.update();return model;
}
