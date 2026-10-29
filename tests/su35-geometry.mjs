import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'public');
const load=name=>import(pathToFileURL(path.join(root,name)));
const T=await load('vendor/three.module.js');
const {createSu35Model}=await load('su35-model.js');
const {createAircraft}=await load('aircraft.js');
const {treeAircraft}=await load('aircraft-tree-data.js');
const aircraft=createSu35Model(),bounds=new T.Box3(),vertices=new T.Vector3();
let triangles=0;
function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
aircraft.group.updateMatrixWorld(true);
aircraft.group.traverse(o=>{
  if(!o.isMesh||!visible(o))return;
  const p=o.geometry.attributes.position;
  assert.ok([...p.array].every(Number.isFinite),o.name+' has non-finite vertices');
  if(o.material.userData.airframeSurface)assert.equal(o.geometry.attributes.skinPosition?.count,p.count,'neutral paint coordinates');
  for(let i=0;i<p.count;i++)bounds.expandByPoint(o.getVertexPosition(i,vertices).applyMatrix4(o.matrixWorld));
  triangles+=(o.geometry.index?.count||p.count)/3;
});
const size=bounds.getSize(new T.Vector3());
assert.ok(Math.abs(size.x-15.3)<.03,'15.3m wingspan');
assert.ok(Math.abs(size.z-21.9)<.03,'21.9m length');
assert.ok(Math.abs(size.y-5.9)<.05,'5.9m ground-to-fin height');
assert.ok(triangles<160000,'bounded preview geometry');
for(const side of [-1,1]){
  const cx=side*1.65;
  for(const x of [-.30,0,.30])for(const y of [-.25,0,.25]){
    const ray=new T.Raycaster(new T.Vector3(cx+x,-.53+y,-12),new T.Vector3(0,0,1),0,16);
    const hits=ray.intersectObject(aircraft.group,true).filter(h=>visible(h.object));
    assert.ok(hits.length,'recessed duct has an interior');
    assert.ok(hits[0].point.z>-3.40,'no skin cap across the inlet opening');
    if(x===0&&y===0)assert.ok(hits[0].point.z>-.6&&hits[0].point.z<.1,'compressor is about 4m recessed');
  }
}
const nozzle=aircraft.exhaustFrames[1],before=nozzle.getWorldPosition(new T.Vector3());
const canopy=aircraft.group.getObjectByName('Su-35 hinged single-seat canopy');
const closedCrown=new T.Box3().setFromObject(canopy).max.y;
aircraft.update({gear:0,canopy:.7,intakeRamp:.2,vectorPitch:.22,afterburner:1});
assert.ok(nozzle.getWorldPosition(new T.Vector3()).distanceTo(before)>.1,'exhaust exit follows vectoring nozzle');
assert.ok(new T.Box3().setFromObject(canopy).max.y>closedCrown+.5,'canopy lifts up above the cockpit');
for(const aperture of [0,.3,1]){
  aircraft.update({gear:1,afterburner:aperture,vectorPitch:0});
  const nozzle=aircraft.group.getObjectByName('Su-35 24 overlapping profiled nozzle feathers');
  for(let i=0;i<nozzle.geometry.attributes.position.count;i+=13){
    nozzle.getVertexPosition(i,vertices).applyMatrix4(nozzle.matrixWorld);
    assert.ok(vertices.z>=8.68&&vertices.z<=10.09,'opening feathers stay connected to the engine');
    assert.ok(Math.hypot(vertices.x+1.65,vertices.y+.36)<.81,'opening feathers stay centred on the nozzle axis');
  }
}
assert.equal(aircraft.definition.previewOnly,true);
assert.equal(treeAircraft('ru-su35-s').simId,null,'preview does not claim a native Su-35 flight model');
assert.equal(treeAircraft('ru-su35-s').previewUrl.split('?')[0],'su35.html');

// Shared-kit changes must preserve every existing aircraft and its fin visibility.
for(let type=0;type<=12;type++){
  const a=createAircraft(type);a.update({gear:1});
  assert.ok(a.group.children.length>0,'existing aircraft '+type);
  if([4,5,6,10,11,12].includes(type))assert.equal(a.damageParts[6].visible,true,'right fin '+type);
  const {disposeObject}=await load('aircraft-catalog.js');disposeObject(a.group);
}
console.log(JSON.stringify({result:'PASS',visibleDimensions:size.toArray(),triangles,intakeRaySamples:18,existingAircraft:13}));
