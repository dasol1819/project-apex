import * as T from './vendor/three.module.js';

// Snapshot the real exterior geometry, including current control-surface
// transforms. Clipping operates on triangles, not a substitute debris box.
export function createWreckageFactory(aircraft){
 const materials=new Map(),fractureMaterial=new T.MeshStandardMaterial({color:0x454642,roughness:.9,metalness:.36,side:T.DoubleSide});
 function materialFor(original){
  if(materials.has(original))return materials.get(original);
  const material=original.clone();material.name=original.name+' / wreckage';
  if(material.color)material.color.multiplyScalar(.70);
  if(material.roughness!==undefined)material.roughness=Math.max(.65,material.roughness);
  if(material.emissive)material.emissive.set(0);
  const hook=original.onBeforeCompile,key=original.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{hook.call(original,shader,renderer);if(shader.uniforms.skinIntegrity)shader.uniforms.skinIntegrity={value:.23};if(shader.uniforms.su35Integrity)shader.uniforms.su35Integrity={value:.23};};
  material.customProgramCacheKey=()=>key+'-detached-v4';material.side=T.DoubleSide;
  materials.set(original,material);return material;
 }
 function clip(polygon,axis,value,less,intersections){
  const result=[];if(!polygon.length)return result;
  const distance=v=>(v.p[axis]-value)*(less?1:-1);
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b);
   if(da<=1e-7)result.push(a);
   if((da<0&&db>0)||(da>0&&db<0)){
    const t=da/(da-db),v={p:a.p.map((x,k)=>x+(b.p[k]-x)*t),n:a.n.map((x,k)=>x+(b.n[k]-x)*t),c:a.c.map((x,k)=>x+(b.c[k]-x)*t),s:a.s.map((x,k)=>x+(b.s[k]-x)*t),l:a.l.map((x,k)=>x+(b.l[k]-x)*t),u:a.u.map((x,k)=>x+(b.u[k]-x)*t),u1:a.u1.map((x,k)=>x+(b.u1[k]-x)*t)};
    result.push(v);intersections.push(v.p);
   }
  }
  return result;
 }
 function cap(points,axis,value,less,pivot){
  const axes=[0,1,2].filter(i=>i!==axis),unique=new Map();
  for(const p of points)unique.set(p.map(v=>Math.round(v*10000)).join(','),p);
  const list=[...unique.values()].sort((a,b)=>a[axes[0]]-b[axes[0]]||a[axes[1]]-b[axes[1]]);
  if(list.length<3)return null;
  const cross=(a,b,c)=>(b[axes[0]]-a[axes[0]])*(c[axes[1]]-a[axes[1]])-(b[axes[1]]-a[axes[1]])*(c[axes[0]]-a[axes[0]]);
  const lower=[],upper=[];
  for(const p of list){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(const p of list.toReversed()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  const hull=[...lower.slice(0,-1),...upper.slice(0,-1)],positions=[],normal=new T.Vector3();normal.setComponent(axis,less?1:-1);
  for(let i=1;i<hull.length-1;i++)for(const p of [hull[0],hull[i],hull[i+1]])positions.push(...p.map((x,k)=>x-pivot[k]));
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  const mesh=new T.Mesh(g,fractureMaterial);mesh.name='exposed fracture cross section';mesh.castShadow=mesh.receiveShadow=true;return mesh;
 }
 function create(part,variant,pivot,half){
  const root=new T.Group();root.name=`detached ${part}:${variant}`;
  const source=aircraft.damageParts[part];if(!source)return root;
  aircraft.group.updateWorldMatrix(true,true);
  const inverse=aircraft.group.matrixWorld.clone().invert(),buckets=new Map(),cuts=[];
  if(part===0&&(variant===1||variant===2)){
   const modern=aircraft.definition?.id>=6;
   cuts.push({axis:2,value:modern?pivot[2]+(variant===1?half[2]:-half[2]):-2,less:variant===1,points:[]});
   // Exposed wing-root caps can span the adjacent aft section. Crop those
   // along with the skin so each detached body owns only its real station.
   cuts.push({axis:2,value:modern?pivot[2]+(variant===1?-half[2]:half[2]):variant===1?-6.4:2.3,less:variant===2,points:[]});
  }
  if(variant===4||variant===5){const axis=aircraft.definition?.id!==7&&[5,6,20,21].includes(part)?1:0;cuts.push({axis,value:pivot[axis]+(variant===4?half[axis]:-half[axis]),less:variant===4,points:[]});}
  source.traverse(node=>{
   if(!node.isMesh||node.userData.damageOverlay||Array.isArray(node.material)||node.material.isShaderMaterial)return;
   for(let ancestor=node;ancestor&&ancestor!==source;ancestor=ancestor.parent)if(!ancestor.visible)return;
   const matrix=new T.Matrix4().multiplyMatrices(inverse,node.matrixWorld),normalMatrix=new T.Matrix3().getNormalMatrix(matrix);
   const g=node.geometry,position=g.attributes.position,normals=g.attributes.normal,colors=g.attributes.color,skin=g.attributes.skinPosition,livery=g.attributes.liveryPosition,uv=g.attributes.uv,uv1=g.attributes.uv1;
   if(!position)return;const material=materialFor(node.material);
   // Components are already disjoint. Reuse their immutable vertex buffers
   // and snapshot only the transform; triangle clipping is needed solely for
   // newly fractured halves. Avoid rebuilding 29 intact components on impact.
   if(cuts.length===0){
    const mesh=new T.Mesh(g,material);mesh.name=node.name;mesh.matrixAutoUpdate=false;
    mesh.matrix.makeTranslation(-pivot[0],-pivot[1],-pivot[2]).multiply(matrix);
    mesh.userData.sharedAirframeGeometry=true;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return;
   }
   if(!buckets.has(material))buckets.set(material,{p:[],n:[],c:[],s:[],l:[],u:[],u1:[]});const bucket=buckets.get(material);
   const count=g.index?g.index.count:position.count;
   for(let i=0;i<count;i+=3){
    let polygon=[];
    for(let j=0;j<3;j++){
     const index=g.index?g.index.getX(i+j):i+j,p=new T.Vector3().fromBufferAttribute(position,index).applyMatrix4(matrix),n=normals?new T.Vector3().fromBufferAttribute(normals,index).applyMatrix3(normalMatrix).normalize():new T.Vector3(0,1,0);
     polygon.push({p:p.toArray(),n:n.toArray(),c:colors?[colors.getX(index),colors.getY(index),colors.getZ(index)]:[1,1,1],s:skin?[skin.getX(index),skin.getY(index),skin.getZ(index)]:p.toArray(),l:livery?[livery.getX(index),livery.getY(index),livery.getZ(index)]:p.toArray(),u:uv?[uv.getX(index),uv.getY(index)]:[0,0],u1:uv1?[uv1.getX(index),uv1.getY(index)]:[0,0]});
    }
    for(const cut of cuts)polygon=clip(polygon,cut.axis,cut.value,cut.less,cut.points);
    for(let j=1;j<polygon.length-1;j++)for(const v of [polygon[0],polygon[j],polygon[j+1]]){
     bucket.p.push(...v.p.map((x,k)=>x-pivot[k]));bucket.n.push(...new T.Vector3(...v.n).normalize().toArray());bucket.c.push(...v.c);bucket.s.push(...v.s);bucket.l.push(...v.l);bucket.u.push(...v.u);bucket.u1.push(...v.u1);
    }
   }
  });
  for(const [material,b]of buckets){
   if(!b.p.length)continue;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('color',new T.Float32BufferAttribute(b.c,3));g.setAttribute('skinPosition',new T.Float32BufferAttribute(b.s,3));g.setAttribute('liveryPosition',new T.Float32BufferAttribute(b.l,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.u,2));g.setAttribute('uv1',new T.Float32BufferAttribute(b.u1,2));g.computeBoundingSphere();
   const mesh=new T.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  }
  for(const cut of cuts){const face=cap(cut.points,cut.axis,cut.value,cut.less,pivot);if(face)root.add(face);}
  return root;
 }
 return {create,release(root){root.traverse(o=>{if(!o.userData.sharedAirframeGeometry)o.geometry?.dispose();});root.removeFromParent();}};
}
