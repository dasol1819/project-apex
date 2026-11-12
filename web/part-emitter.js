import * as T from './vendor/three.module.js';
// One central exterior point per part, stored on a real triangle so it follows
// hinges, nozzle deformation, aircraft pose and detached bodies.
export function createPartEmitter(root){
 root.updateWorldMatrix(true,true);
 const meshes=[];root.traverse(m=>{if(m.isMesh&&!Array.isArray(m.material)&&!m.material.isShaderMaterial&&!m.userData.damageOverlay&&!m.userData.surfaceEffect)meshes.push(m);});
 const inverse=root.matrixWorld.clone().invert(),box=new T.Box3(),matrix=new T.Matrix4();
 for(const m of meshes){m.geometry.computeBoundingBox();matrix.multiplyMatrices(inverse,m.matrixWorld);box.union(m.geometry.boundingBox.clone().applyMatrix4(matrix));}
 const size=box.isEmpty()?new T.Vector3(1,1,1):box.getSize(new T.Vector3()),center=box.isEmpty()?new T.Vector3():box.getCenter(new T.Vector3()),ray=new T.Raycaster(),anchors=[];
 const worldScale=root.getWorldScale(new T.Vector3());
 // Ray distances and plume radius are world metres, including imported roots.
 size.multiply(worldScale.set(Math.abs(worldScale.x),Math.abs(worldScale.y),Math.abs(worldScale.z)));
 const bary=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),point=new T.Vector3(),normal=new T.Vector3();
 const centreWorld=center.clone().applyMatrix4(root.matrixWorld),normalMatrix=new T.Matrix3();
 function faceNormal(m,hit){const p=m.geometry.attributes.position,ix=m.geometry.index,k=hit.faceIndex*3,ids=[0,1,2].map(i=>ix?ix.getX(k+i):k+i);a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);normal.subVectors(b,a).cross(c.clone().sub(a)).normalize();normalMatrix.getNormalMatrix(m.matrixWorld);normal.applyMatrix3(normalMatrix).normalize();const dot=normal.dot(hit.point.clone().sub(centreWorld));const sign=Math.abs(dot)>1e-6?(dot<0?-1:1):(normal.dot(direction)>0?-1:1);normal.multiplyScalar(sign);return sign;}
 const direction=new T.Vector3(0,-1,0).transformDirection(root.matrixWorld);
 function visible(m){if(!root.visible)return false;for(let n=m;n&&n!==root;n=n.parent)if(!n.visible)return false;return true;}
 const candidates=meshes.filter(visible);
 for(const target of [center]){
  const origin=target.clone().setY(box.max.y+Math.max(1,size.y)).applyMatrix4(root.matrixWorld);ray.set(origin,direction);
  let hit=ray.intersectObjects(candidates,false)[0];
  if(!hit){
   // Open/vertical panels can miss a downward ray. Project the centre onto the
   // nearest real triangle instead of choosing a scattered triangle centroid.
   let best=Infinity;
   for(const m of candidates){const p=m.geometry.attributes.position,ix=m.geometry.index,local=target.clone().applyMatrix4(root.matrixWorld).applyMatrix4(m.matrixWorld.clone().invert());
    for(let k=0;k<(ix?.count??p.count);k+=3){const ids=[0,1,2].map(i=>ix?ix.getX(k+i):k+i);a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-12)continue;new T.Triangle(a,b,c).closestPointToPoint(local,point);const score=point.distanceToSquared(local);if(score<best){best=score;hit={object:m,faceIndex:k/3,point:point.clone().applyMatrix4(m.matrixWorld)};}}
   }
  }
  if(!hit)continue;
  // Engine hardware sits under the common aft skin. Let smoke escape through
  // that covering surface, instead of spawning invisible particles underneath it.
  if(root.parent?.userData.dimensions){
   faceNormal(hit.object,hit);
   const exterior=[];root.parent.traverse(n=>{if(n.isMesh&&!Array.isArray(n.material)&&!n.material.isShaderMaterial&&!n.userData.damageOverlay&&!n.userData.fractureFace){for(let q=n;q&&q!==root.parent;q=q.parent)if(!q.visible)return;exterior.push(n);}});
   ray.set(hit.point.clone().addScaledVector(normal,.42),normal.clone().negate());ray.far=.45;const cover=ray.intersectObjects(exterior,false)[0];ray.far=Infinity;
   if(cover&&cover.point.clone().sub(hit.point).dot(normal)>.002)hit=cover;
  }
  const m=hit.object,p=m.geometry.attributes.position,ix=m.geometry.index,k=hit.faceIndex*3,ids=[0,1,2].map(i=>ix?ix.getX(k+i):k+i);
  a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);const local=hit.point.clone().applyMatrix4(m.matrixWorld.clone().invert());T.Triangle.getBarycoord(local,a,b,c,bary);
  const sign=faceNormal(m,hit);anchors.push({mesh:m,indices:ids,bary:bary.clone(),sign});
 }
 // Sampling is read-only: no duplicate skin, glow or material is added to
 // the aircraft. Continuous fire and smoke share this single origin.
 function update(){root.updateWorldMatrix(true,true);}
 function sample(index,out,outNormal){
  const anchor=anchors[index%anchors.length];if(!anchor||!visible(anchor.mesh))return false;
  const m=anchor.mesh,p=m.geometry.attributes.position,[i,j,k]=anchor.indices;a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,j);c.fromBufferAttribute(p,k);
  point.copy(a).multiplyScalar(anchor.bary.x).addScaledVector(b,anchor.bary.y).addScaledVector(c,anchor.bary.z);
  normal.subVectors(b,a).cross(c.clone().sub(a)).normalize().multiplyScalar(anchor.sign);normalMatrix.getNormalMatrix(m.matrixWorld);normal.applyMatrix3(normalMatrix).normalize();
  out.copy(point).applyMatrix4(m.matrixWorld).addScaledVector(normal,.018);outNormal?.copy(normal);return true;
 }
 return {anchors,radius:T.MathUtils.clamp(Math.min(size.y*.23,Math.max(size.x,size.z)*.08),.055,.24),update,sample,dispose(){}};
}
