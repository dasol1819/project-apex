import * as T from './vendor/three.module.js';
import {createAirframeKit} from './classic-airframe-kit.js';
import {wingPanel,verticalFin,cockpit,stencil,geometry} from './fighter-exterior-tools.js';
import {su35Material,SU35_PALETTE} from './su35-finish.js';

export const SU35 = Object.freeze({id:13,key:'su35',name:'Su-35S',nickname:'Flanker-E',
  length:21.9,span:15.3,engines:2,palette:SU35_PALETTE,previewOnly:true});
const V = (...p) => new T.Vector3(...p), mix = T.MathUtils.lerp;
const WING = [[2.10,.17,-1.80,5.12,.22],[3.55,.17,-.55,5.17,.18],
  [5.35,.12,1.13,5.22,.11],[7.35,.035,3.10,5.19,.035]];
const FIN = [[.35,4.78,10.06,.16,1.90],[1.18,5.36,9.93,.14,1.94],
  [3.45,7.12,9.08,.07,2.03],[3.80,7.45,8.91,.022,2.05]];

function ring([z,cx,cy,w,h,power=2,rake=0],n=64) {
  return Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    const y=Math.sign(s)*Math.pow(Math.abs(s),2/power)*h;
    return [cx+Math.sign(c)*Math.pow(Math.abs(c),2/power)*w,cy+y,z-rake*y/h];});
}
function shell(k,rows,part,mat,name,reverse=false) {
  const n=rows[0].length,p=rows.flat(2),ix=[];
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){
    const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;
    ix.push(...(reverse?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
  }
  const m=k.mesh(geometry(p,ix),mat,part);m.name=name;return m;
}
function star(k,origin,r,part,plane='top',side=1) {
  const shape=(scale,lift)=>Array.from({length:10},(_,i)=>{
    const a=i*Math.PI/5,rr=r*(i%2?.4:1)*scale,u=Math.sin(a)*rr,v=Math.cos(a)*rr;
    return plane==='top'?[origin[0]+u,origin[1]+lift,origin[2]+v]:[origin[0]+side*lift,origin[1]+v,origin[2]+u];
  });
  k.solid(shape(1,0),part,k.materials.white,.003);
  k.solid(shape(.86,.006),part,k.materials.red,.003);
}

function inlet(k,side) {
  const part=side<0?27:28,cx=side*1.65,cy=-.53,z=-4.43,M=k.materials;
  const wall=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.93,metalness:.07,side:T.DoubleSide});
  const exterior=[[-4.43,cx,cy,.77,.68,5.8,.21],[-4.03,cx,cy,.79,.69,5.7,.08],
    [-3.35,side*1.67,-.48,.85,.71,4.5],[-2.1,side*1.70,-.42,.89,.76,3.2],
    [-.2,side*1.73,-.36,.90,.78,2.4],[2.6,side*1.72,-.32,.85,.77,2.1],
    [5.1,side*1.67,-.34,.74,.70,2],[6.20,side*1.65,-.36,.70,.67,2]];
  // The mouth is the first open ring of the nacelle, not a painted end cap.
  shell(k,exterior.map(r=>ring(r)),part,M.skin,'Su-35 open nacelle shell');
  const lip=[ring([z+.18,cx,cy,.77,.68,5.8,.21]),ring([z+.015,cx,cy,.77,.68,5.8,.21]),
    ring([z-.016,cx,cy,.755,.665,5.8,.21]),ring([z+.012,cx,cy,.731,.641,5.8,.21]),
    ring([z+.12,cx,cy,.730,.640,5.7,.21])];
  const lipMat=new T.MeshStandardMaterial({color:0x7f939e,roughness:.60,metalness:.30,side:T.DoubleSide});
  shell(k,lip,part,lipMat,'Su-35 continuous rolled intake lip');
  const ductRows=[];
  for(let j=0;j<=22;j++){
    const t=j/22;
    ductRows.push(ring([z+.115+t*3.9,cx-side*.10*t*t,cy+.10*t*t,
      mix(.730,.535,t),mix(.640,.535,t),mix(5.7,2,t*t),.21*(1-t)*(1-t)]));
  }
  const duct=shell(k,ductRows,part,wall,'Su-35 uninterrupted recessed intake duct',true);
  const colors=[];
  for(let j=0;j<ductRows.length;j++){
    const shade=mix(.17,.012,Math.pow(j/(ductRows.length-1),.45));
    for(let i=0;i<64;i++)colors.push(shade*.86,shade*.95,shade);
  }
  duct.geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const end=ductRows.at(-1),fanZ=z+4.04,fanX=cx-side*.10,fanY=cy+.10;
  const fanMat=new T.MeshStandardMaterial({color:0x10191c,roughness:.86,metalness:.22,side:T.DoubleSide});
  const indices=[];for(let j=1;j<63;j++)indices.push(0,j,j+1);
  const fan=k.mesh(geometry(end.map(p=>[p[0],p[1],fanZ]).flat(),indices),M.dark,part);
  fan.name='Su-35 compressor termination 4 metres behind inlet';
  for(let i=0;i<28;i++){
    const a=i/28*Math.PI*2,b=a+.14;
    k.solid([[fanX+Math.cos(a)*.15,fanY+Math.sin(a)*.15,fanZ-.016],
      [fanX+Math.cos(a+.08)*.49,fanY+Math.sin(a+.08)*.49,fanZ-.03],
      [fanX+Math.cos(b+.08)*.49,fanY+Math.sin(b+.08)*.49,fanZ-.06],
      [fanX+Math.cos(b)*.15,fanY+Math.sin(b)*.15,fanZ-.025]],part,fanMat,.005);
  }
  k.ellipsoid([.13,.13,.16],[fanX,fanY,fanZ-.07],part,fanMat,undefined,24);
  const ramp=k.hinge(part,[cx,cy+.48,z+.26],'intakeRamp',[1,0,0],1);
  const rampMat=new T.MeshStandardMaterial({color:0x3c484c,roughness:.86,metalness:.18,side:T.DoubleSide});
  k.solid([[cx-.66,cy+.48,z+.26],[cx+.66,cy+.48,z+.26],
    [cx+.57,cy+.25,z+1.65],[cx-.57,cy+.25,z+1.65]],part,rampMat,.025,ramp);
  k.line([[cx-.64,cy+.465,z+.30],[cx+.64,cy+.465,z+.30]],part,M.metal,.012,ramp);
  // Boundary-layer splitter is separated from the forebody by a real gap.
  k.solid([[side*.83,.30,-5.14],[side*.84,-1.16,-4.20],
    [side*.89,-1.10,-2.95],[side*.92,.22,-3.30]],part,M.skin,.032);
  k.line([[side*.79,.27,-4.98],[side*.82,.25,-3.5]],part,M.dark,.025);
  for(let j=0;j<9;j++){
    const zz=-2.65+j*.155;
    k.solid([[cx-.37,.291,zz],[cx+.37,.291,zz],[cx+.37,.293,zz+.045],[cx-.37,.293,zz+.045]],part,M.dark,.005);
  }
  return {side,center:[cx,cy,z],part,opening:{half:[.705,.615],depth:4.04}};
}

export function createSu35Model() {
  const k=createAirframeKit(SU35),M=k.materials;
  M.skin=su35Material();M.radome=su35Material('radome');
  for(const name of ['metal','titanium','nozzle'])M[name]=su35Material('metal');
  M.skinLight.color.set(0xa8bbc5);M.skinDark.color.set(0x657e8e);
  M.frame.color.set(0x455c69);M.glass.color.set(0x8eacb0);M.glass.opacity=.48;M.glass.roughness=.075;
  M.red.color.set(0xa33c35);M.white.color.set(0xd6dcdb);
  const body=[[-7.35,.59,.50,-.035],[-6.6,.72,.57,.015],[-5.5,.83,.63,.035],
    [-4.3,.87,.65,.065],[-2.6,.82,.60,.10],[0,.80,.53,.11],[2.5,.72,.45,.09],
    [5.0,.64,.36,.10],[7.5,.49,.27,.08],[9.1,.32,.19,.04],[10.6,.20,.14,0],[11.30,.025,.035,0]];
  k.loft(body,0,M.skin,{segments:80,samples:6}).name='Su-35 smoothly lofted central fuselage and tail sting';
  k.loft([[-10.60,.008,.010,-.12],[-10.2,.115,.13,-.10],[-9.5,.27,.29,-.08],
    [-8.6,.43,.41,-.06],[-7.7,.55,.48,-.04],[-7.35,.59,.50,-.035]],10,M.radome,{segments:80,samples:6});
  for(const side of [-1,1]){
    // Continuous upper shoulders and long LERX leave the lower inlet open.
    wingPanel(k,[[side*.62,.31,-5.95,5.05,.13],[side*1.05,.28,-4.58,5.07,.17],
      [side*1.58,.23,-3.05,5.10,.20],[side*2.10,.17,-1.80,5.12,.22]],side<0?1:2);
    const rows=WING.map(r=>[side*r[0],...r.slice(1)]),root=side<0?1:2,outer=side<0?12:13;
    wingPanel(k,rows.slice(0,3),root,{c0:.14,c1:.76});
    wingPanel(k,rows.slice(2),outer,{c0:.14,c1:.76});
    const lePart=side<0?18:19,le=k.hinge(lePart,[side*3.7,.17,.55],'lef',[1,0,0],1);
    wingPanel(k,rows,lePart,{c0:0,c1:.139,parent:le});
    const flapPart=side<0?16:17,flap=k.hinge(flapPart,[side*2.9,.17,3.73],'flap',[1,0,0],-1);
    wingPanel(k,rows.slice(0,2),flapPart,{c0:.762,c1:1,parent:flap});
    const ailPart=side<0?14:15,ail=k.hinge(ailPart,[side*5.4,.10,4.3],'aileron',[1,0,0],-side);
    wingPanel(k,rows.slice(1),ailPart,{c0:.762,c1:1,parent:ail});
    const tailPart=side<0?3:4,tail=k.hinge(tailPart,[side*2.5,.02,8.30],'elevator',[1,0,0],-1);
    wingPanel(k,[[side*2.35,.045,5.94,10.28,.13],[side*3.0,.015,6.66,10.58,.105],
      [side*4.85,-.10,8.35,10.58,.025]],tailPart,{parent:tail});
    const finPart=side<0?5:6,rudPart=side<0?20:21;
    verticalFin(k,FIN,side,finPart,0,.72);
    const rudder=k.hinge(rudPart,[side*1.98,1.5,9.14],'rudder',[0,1,0],-1);
    verticalFin(k,FIN,side,rudPart,.725,1,rudder);
    // Wingtip electronic-warfare pods, with slender ogive ends.
    k.loft([[2.48,.018,.02,.035,side*7.51],[2.75,.12,.13,.035,side*7.51],
      [3.30,.14,.15,.035,side*7.51],[5.17,.14,.15,.035,side*7.51],
      [5.68,.055,.075,.035,side*7.51],[5.83,.005,.008,.035,side*7.51]],outer,M.skin,{segments:32,samples:4});
    k.navLight([side*7.61,.075,3.50],side<0?0xe64335:0x6cae88,outer);
    star(k,[side*5.3,.215,3.7],.51,outer);
    star(k,[side*2.13,2.23,8.33],.39,finPart,'side',side);
    stencil(k,'01',[side*.78,.18,-6.65],.04,0,'side',side);
    k.loft([[5.70,.69,.65,-.36,side*1.65],[6.35,.68,.64,-.36,side*1.65],
      [7.5,.65,.63,-.36,side*1.65],[8.65,.64,.62,-.36,side*1.65]],side<0?7:8,M.metal,{segments:72,samples:5});
    const frame=k.nozzle({x:side*1.65,y:-.36,z:9.60,radius:.62,enginePart:side<0?7:8,
      nozzlePart:side<0?22:23,length:1.04,darkInterior:true});
    frame.children.forEach(c=>c.userData.previewFlame=true);
    const nozzles=k.parts[side<0?22:23],pivot=new T.Group();pivot.position.set(side*1.65,-.36,8.75);
    pivot.name='Su-35 gimballed AL-41F1S nozzle';nozzles.add(pivot);k.group.updateMatrixWorld(true);
    for(const child of [...nozzles.children])if(child!==pivot)pivot.attach(child);
    k.animations.push(s=>{pivot.rotation.set(s.vectorPitch||0,side*(s.vectorYaw||0),0);for(const c of frame.children)c.visible=false;});
    // Small engine maintenance fasteners and metal panel bands.
    for(const zz of [6.15,6.9,7.7,8.40]){
      const arc=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return[side*1.65+Math.cos(a)*.66,-.36+Math.sin(a)*.64,zz];});
      k.line(arc,side<0?7:8,M.nozzle,.007);
    }
  }
  const inlets=[inlet(k,-1),inlet(k,1)];
  // Single-seat cockpit: fixed windscreen, opening hood, K-36-like seat/HUD.
  cockpit(k,{front:-6.28,rear:-4.10,base:.25,hudRise:.75,hudBase:.45,hudOffset:-.02,crew:false});
  k.canopy([[-7.02,.10,.48,.025],[-6.73,.40,.54,.37],[-6.35,.53,.57,.71]],11,{frameStations:[-6.35]});
  const hood=new T.Group();hood.position.set(0,.62,-4.00);hood.userData.pivot=[0,.62,-4.00];
  hood.name='Su-35 hinged single-seat canopy';k.parts[11].add(hood);
  const before=new Set(k.parts[11].children);
  k.canopy([[-6.34,.53,.57,.71],[-5.92,.56,.58,.80],[-5.36,.54,.59,.78],
    [-4.75,.43,.60,.59],[-4.12,.13,.62,.14],[-4.00,.025,.62,.025]],11,{frameStations:[-6.34,-4.12],longitudinalSamples:6});
  k.group.updateMatrixWorld(true);
  for(const c of [...k.parts[11].children])if(!before.has(c))hood.attach(c);
  k.animations.push(s=>{hood.rotation.x=s.canopy||0;});
  // Offset IRST ball distinguishes the Su-35S front quarter.
  k.ellipsoid([.22,.19,.23],[.41,.63,-6.95],0,M.skinDark,undefined,32);
  const sensor=new T.MeshPhysicalMaterial({color:0x243c39,roughness:.045,metalness:.36,clearcoat:1});
  k.ellipsoid([.153,.137,.10],[.41,.69,-7.11],0,sensor,undefined,32);
  k.line([[0,.61,-7.08],[0,.99,-6.61],[0,1.29,-6.35]],11,M.frame,.020);
  for(const side of [-1,1])k.line([[side*.12,.48,-7.0],[side*.40,.54,-6.73],[side*.53,.57,-6.35]],11,M.frame,.020);
  // Gun fairing, vents, antennae and static discharge wicks.
  k.loft([[-4.70,.02,.025,.24,1.06],[-4.37,.15,.12,.25,1.11],[-3.23,.15,.11,.25,1.21],[-2.94,.03,.03,.24,1.28]],2,M.skin,{segments:28,samples:4});
  k.tube(.037,.045,.13,[1.10,.27,-4.53],2,M.dark,{open:true});
  for(let i=0;i<7;i++)k.line([[1.10,.377,-4.15+i*.115],[1.30,.36,-4.15+i*.115]],2,M.dark,.010);
  k.solid([[0,.51,-2.9],[0,.98,-2.50],[0,.92,-2.25],[0,.5,-2.1]],0,M.skinDark,.035);
  k.solid([[0,.37,3.9],[0,.69,4.19],[0,.60,4.45],[0,.34,4.6]],0,M.skinDark,.028);
  for(const side of [-1,1])for(const x of [3.3,4.5,5.8,6.8])k.line([[side*x,.02,5.17],[side*x,.015,5.40]],side<0?14:15,M.dark,.009);
  k.gear({x:0,z:-5.05,topY:-.50,radius:.29});
  for(const side of [-1,1])k.gear({x:side*1.47,z:2.30,part:side<0?25:26,main:true,topY:-.78,radius:.39});
  const aircraft=k.finish({gunMount:[1.10,.27,-4.6],gunPart:2,wingTips:[[-7.65,.035,3.5],[7.65,.035,3.5]]});
  aircraft.group.userData.modelRevision='su35-original-1';aircraft.group.userData.intakes=inlets;
  aircraft.group.userData.previewOnly=true;
  const update=aircraft.update;
  aircraft.update=(state={},dt=1/60)=>update({gear:1,...state},dt);
  aircraft.update();return aircraft;
}
