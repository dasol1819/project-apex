import * as T from './vendor/three.module.js';
// Original procedural P-26A, based on public dimensions / museum photographs.
export const P26_REFERENCES=Object.freeze(['https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/198089/boeing-p-26a/','https://airandspace.si.edu/collection-objects/boeing-p-26a-peashooter/nasm_A19730273000']);
export function buildP26Exterior(k){
 const {group,parts,loft,airfoil,ellipsoid,tube,line,box,solid,hinge}=k;
 const mat=(color,roughness=.62,metalness=.18)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const blue=mat(0x234b73),yellow=mat(0xf0bc32),metal=mat(0xb6b2a3,.4,.65),dark=mat(0x20262a,.82,.12),red=mat(0xa43229),white=mat(0xe5e1cd),rubber=mat(0x171b1e,.94,.02),leather=mat(0x49362d,.9,.03);
 for(const m of [blue,yellow,red,white])m.userData.fleetCoating=true;
 group.userData.modelRevision=1;group.userData.fixedGear=true;
 loft([[-2.83,.56,.57,0],[-2.40,.55,.55,0],[-1.65,.49,.51,0],[-.9,.43,.47,0],[0,.37,.43,0],[.9,.27,.34,.03],[1.8,.19,.26,.05],[2.7,.12,.18,.08],[3.45,.03,.06,.10]],0,blue);
 ellipsoid([.18,.34,.56],[0,.49,.27],0,blue);
 ellipsoid([.275,.04,.41],[0,.468,-.48],11,dark).name='open cockpit well';
 ellipsoid([.235,.07,.35],[0,.49,-.48],11,leather);box([.31,.28,.11],[0,.53,-.20],11,leather);box([.32,.15,.08],[0,.58,-.81],11,dark);
 const glass=new T.MeshPhysicalMaterial({color:0xaec9cd,transparent:true,opacity:.45,roughness:.08,side:T.DoubleSide,depthWrite:false});
 solid([[-.25,.47,-.86],[.25,.47,-.86],[.17,.78,-.94],[-.17,.78,-.94]],11,glass,.012);
 line([[-.25,.47,-.86],[-.17,.78,-.94],[.17,.78,-.94],[.25,.47,-.86]],11,metal,.014);
 tube(.605,.605,.36,[0,0,-2.87],7,blue,{open:true,sides:64});tube(.57,.57,.035,[0,0,-3.06],7,metal,{open:true,sides:64});tube(.25,.26,.35,[0,0,-2.9],7,dark);ellipsoid([.23,.23,.17],[0,0,-3.12],7,metal);
 for(let i=0;i<9;i++){
  const a=i/9*Math.PI*2,x=Math.cos(a),y=Math.sin(a),c=new T.Mesh(new T.CylinderGeometry(.11,.135,.31,12),metal);
  c.position.set(x*.36,y*.36,-2.94);c.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(x,y,0));parts[7].add(c);
  for(let j=0;j<4;j++)line([[x*(.30+j*.045)-y*.10,y*(.30+j*.045)+x*.10,-3.045],[x*(.30+j*.045)+y*.10,y*(.30+j*.045)-x*.10,-3.045]],7,dark,.009);
 }
 const prop=new T.Group();prop.position.z=-3.33;prop.userData.keepGroup=true;prop.name='P-26 animated two blade propeller';parts[7].add(prop);
 for(const sign of [-1,1]){
  const blade=new T.Mesh(new T.SphereGeometry(1,16,12),metal);blade.scale.set(.105,.62,.035);blade.position.y=sign*.66;blade.rotation.z=sign*.06;prop.add(blade);
  const tip=new T.Mesh(new T.SphereGeometry(1,12,8),yellow);tip.scale.set(.09,.13,.038);tip.position.y=sign*1.20;prop.add(tip);
 }
 tube(.10,.10,.17,[0,0,-3.45],7,metal);
 for(const sign of [-1,1]){
  const p=sign<0?1:2,outer=sign<0?12:13,ail=sign<0?14:15;
  airfoil([[sign*.32,-.19,-1.2,.88,.22],[sign*1.8,-.17,-1.13,.83,.20],[sign*2.6,-.12,-1.02,.79,.17]],p,yellow);
  airfoil([[sign*2.6,-.12,-1.02,.79,.17],[sign*3.7,-.04,-.86,.68,.12],[sign*4.15,0,-.56,.43,.07],[sign*4.25,.01,-.17,.13,.012]],outer,yellow,{chordRange:[0,.78]});
  const h=hinge(ail,[sign*3.1,-.06,.44],sign<0?'leftAileron':'rightAileron',[1,0,0],1);
  airfoil([[sign*2.6,-.12,-1.02,.79,.17],[sign*3.7,-.04,-.86,.68,.12],[sign*4.15,0,-.56,.43,.07]],ail,yellow,{chordRange:[.78,1],parent:h});
  for(const z of [-.88,.45])line([[0,.39,-.20],[sign*3.05,-.08,z]],p,metal,.009);
  line([[sign*.22,-.38,-1.1],[sign*2.9,-.10,.12]],p,metal,.009);
  const leg=sign<0?25:26;line([[sign*.50,-.23,-.80],[sign*1.04,-1.10,-.20]],leg,blue,.07);line([[sign*.38,-.23,.42],[sign*1.04,-1.1,-.20]],leg,metal,.03);
  ellipsoid([.22,.44,.53],[sign*1.04,-1.03,-.20],leg,blue);tube(.29,.29,.20,[sign*1.04,-1.18,-.20],leg,rubber,{axis:'x',sides:32});tube(.12,.12,.215,[sign*1.04,-1.18,-.20],leg,metal,{axis:'x',sides:24});
  airfoil([[sign*.10,.08,2.05,3.30,.09],[sign*1.1,.11,2.23,3.17,.07],[sign*1.48,.12,2.55,2.95,.018]],sign<0?3:4,yellow);
  const roundel=new T.Mesh(new T.CircleGeometry(.34,32),blue);roundel.rotation.x=-Math.PI/2;roundel.position.set(sign*3.2,.035,-.04);parts[outer].add(roundel);
  const star=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.12:.28;star.push([sign*3.2+Math.cos(a)*r,.04,-.04+Math.sin(a)*r]);}solid(star,outer,white,.002);
  const dot=new T.Mesh(new T.CircleGeometry(.075,20),red);dot.rotation.x=-Math.PI/2;dot.position.set(sign*3.2,.045,-.04);parts[outer].add(dot);
 }
 solid([[0,.08,1.97],[0,.79,2.10],[0,1.30,2.60],[0,1.20,3.13],[0,.16,3.43]],5,blue,.09);
 const rudder=hinge(20,[0,.60,3.05],'leftRudder',[0,1,0],1);solid([[0,.18,3.05],[0,1.21,3.05],[0,1.12,3.30],[0,.19,3.48]],20,white,.07,rudder);
 for(let i=0;i<3;i++)box([.075,.13,.33],[0,.28+i*.26,3.25],20,red,rudder);
 line([[0,.05,2.62],[0,-.73,2.65]],24,metal,.035);tube(.17,.17,.11,[0,-.73,2.65],24,rubber,{axis:'x',sides:20});
 for(const sign of [-1,1]){tube(.025,.025,.45,[sign*.18,.36,-2.65],10,dark);line([[sign*.45,-.26,-2.65],[sign*.49,-.45,-2.25]],22,metal,.035);}
 return{gunMount:[-.18,.36,-2.65],gunPart:10,wingTips:[[-4.25,.01,.10],[4.25,.01,.10]],exhaustFrames:[],update(s,dt){prop.rotation.z+=Math.max(0,dt)*(s.engine??0)*155;}};
}
