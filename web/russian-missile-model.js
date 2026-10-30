import * as T from './vendor/three.module.js';

// Original exterior meshes. Public approximate overall dimensions; small
// fittings and folded-carriage detail are authored, not engineering CAD.
export function createRussianMissileModel(kind='r77'){
 if(kind==='r771'||kind==='r73')return externalRussianMissile(kind);
 const rf=kind==='r77',L=rf?4.06:2.92,R=rf?.10:.085,root=new T.Group();
 root.name=rf?'R-77M · folded-fin internal carriage':'R-74M2 · internal short-range missile';
 root.userData.dimensions={length:L,diameter:R*2};
 const paint=new T.MeshStandardMaterial({color:0xc7cecf,roughness:.60,metalness:.19}),nose=new T.MeshStandardMaterial({color:rf?0xe1e1d5:0x152d33,roughness:rf?.70:.13,metalness:rf?.05:.4}),metal=new T.MeshStandardMaterial({color:0x505c63,roughness:.52,metalness:.66});
 const add=(g,m=paint)=>{const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const profile=[[.001,-L*.5],[R*.42,-L*.47],[R*.83,-L*.41],[R,-L*.34],[R,L*.45],[R*.8,L*.50]].map(p=>new T.Vector2(...p));
 const body=new T.LatheGeometry(profile,32);body.rotateX(Math.PI/2);add(body);
 const radome=new T.LatheGeometry(profile.slice(0,4),32);radome.rotateX(Math.PI/2);add(radome,nose);
 function fin(z,chord,span){for(let j=0;j<4;j++){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([R*.95,0,z-chord*.5,span,0,z+chord*.04,span,0,z+chord*.5,R*.95,0,z+chord*.5],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const o=add(g,paint);o.material.side=T.DoubleSide;o.rotation.z=Math.PI/4+j*Math.PI/2;
 }}
 // R-77M has clipped conventional surfaces: do not reuse R-77 lattice fins.
 fin(L*.34,rf?.54:.40,rf?.22:.23);fin(rf?-.38:-.78,rf?.56:.24,rf?.16:.19);
 if(!rf)fin(-.95,.09,.11);
 for(const z of [-L*.25,L*.18]){const g=new T.CylinderGeometry(R*1.008,R*1.008,.014,32);g.rotateX(Math.PI/2);g.translate(0,0,z);add(g,metal);}
 const nozzle=new T.CylinderGeometry(R*.72,R*.75,.055,32,1,true);nozzle.rotateX(Math.PI/2);nozzle.translate(0,0,L*.48);add(nozzle,metal);
 return root;
}

function externalRussianMissile(kind){
 const rf=kind==='r771',L=rf?3.71:2.90,R=rf?.10:.085,root=new T.Group();
 root.name=rf?'R-77-1 · lattice control fins':'R-73 · external short-range missile';root.userData.dimensions={length:L,diameter:R*2};
 const paint=new T.MeshStandardMaterial({color:0xcbd1cf,roughness:.63,metalness:.12,side:T.DoubleSide}),steel=new T.MeshStandardMaterial({color:0x5c6665,roughness:.55,metalness:.65}),nose=new T.MeshStandardMaterial({color:rf?0xe1dfd1:0x203b3f,roughness:rf?.7:.13,metalness:rf?.05:.45});
 const add=(g,m=paint)=>{const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const profile=[[.001,-L/2],[R*.42,-L*.46],[R*.85,-L*.39],[R,-L*.32],[R,L*.46],[R*.8,L/2]].map(p=>new T.Vector2(...p));
 for(const [points,m]of [[profile,paint],[profile.slice(0,4),nose]]){const g=new T.LatheGeometry(points,40);g.rotateX(Math.PI/2);add(g,m);}
 function fins(z,chord,span){for(let i=0;i<4;i++){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([R,0,z-chord/2,span,0,z+chord*.15,span,0,z+chord/2,R,0,z+chord/2],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();add(g).rotation.z=Math.PI/4+i*Math.PI/2;}}
 fins(rf?-.30:-.90,rf?.66:.26,rf?.20:.22);
 if(rf){for(let side=0;side<4;side++){
   const grid=new T.Group();grid.rotation.z=Math.PI/4+side*Math.PI/2;root.add(grid);
   for(let j=0;j<=5;j++){const g=new T.BoxGeometry(.011,.018,.30),o=new T.Mesh(g,steel);o.position.set(R+j*.045,0,1.35);grid.add(o);}
   for(let j=0;j<=6;j++){const g=new T.BoxGeometry(.236,.018,.011),o=new T.Mesh(g,steel);o.position.set(R+.1125,0,1.20+j*.05);grid.add(o);}
 }}else{fins(.98,.40,.255);fins(-1.10,.09,.12);}
 const throat=new T.CylinderGeometry(R*.70,R*.78,.065,32,1,true);throat.rotateX(Math.PI/2);throat.translate(0,0,L*.49);add(throat,steel);
 for(const z of [-L*.22,L*.18]){const band=new T.CylinderGeometry(R*1.01,R*1.01,.018,32);band.rotateX(Math.PI/2);band.translate(0,0,z);add(band,steel);}
 return root;
}
