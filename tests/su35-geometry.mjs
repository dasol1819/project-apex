import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(process.argv[2]||'public');
const load=name=>import(pathToFileURL(path.join(root,name)));
const T=await load('vendor/three.module.js');
const {createSu35Model}=await load('su35-model.js');
const {decodeSu35Asset}=await load('su35-asset.js');
const {createAircraft}=await load('aircraft.js');
const {treeAircraft}=await load('aircraft-tree-data.js');
const metadata=JSON.parse(await readFile(path.join(root,'assets/su35/airframe.json'),'utf8'));
const binary=await readFile(path.join(root,'assets/su35/airframe.bin'));
const buffer=binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.byteLength);
assert.throws(()=>decodeSu35Asset(metadata,buffer.slice(0,128)),/Invalid Su-35 mesh buffer/,'reject truncated downloads');
const aircraft=createSu35Model({meshes:decodeSu35Asset(metadata,buffer),metadata});
const bounds=new T.Box3(),vertices=new T.Vector3();let triangles=0;
function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
aircraft.group.updateMatrixWorld(true);
aircraft.group.traverse(o=>{
  if(!o.isMesh||!visible(o))return;
  const p=o.geometry.attributes.position;
  for(const a of Object.values(o.geometry.attributes))for(const v of a.array)assert.ok(Number.isFinite(v),o.name+' has non-finite attributes');
  for(let i=0;i<p.count;i++)bounds.expandByPoint(o.getVertexPosition(i,vertices).applyMatrix4(o.matrixWorld));
  triangles+=(o.geometry.index?.count||p.count)/3;
});
const size=bounds.getSize(new T.Vector3());
assert.ok(Math.abs(size.x-15.3)<.03,'15.3m wingspan');
assert.ok(Math.abs(size.z-21.9)<.03,'21.9m length');
assert.ok(Math.abs(size.y-5.9)<.05,'5.9m ground-to-fin height');
assert.ok(triangles<200000,'bounded preview geometry');
const combiner=aircraft.group.getObjectByName('Su-35 HUD combiner');
const windshield=aircraft.group.getObjectByName('Su-35 adapted object.001');
const hudPositions=combiner.geometry.attributes.position;
for(let i=0;i<hudPositions.count;i++){
  vertices.fromBufferAttribute(hudPositions,i).applyMatrix4(combiner.matrixWorld);
  const glassHits=new T.Raycaster(new T.Vector3(vertices.x,4,vertices.z),new T.Vector3(0,-1,0),0,5).intersectObject(windshield);
  assert.ok(glassHits.length&&glassHits[0].point.y>vertices.y+.02,'HUD stays inside the fixed windshield');
}
for(const inlet of aircraft.group.userData.intakes){
  const [cx,cy,z]=inlet.centerWorld;
  for(const x of [-.18,0,.18])for(const y of [-.16,0,.16]){
    const ray=new T.Raycaster(new T.Vector3(cx+x,cy+y,z-.4),new T.Vector3(0,0,1),0,6);
    const hits=ray.intersectObject(aircraft.group,true).filter(h=>visible(h.object));
    assert.ok(hits.length,'recessed duct has an interior');
    assert.ok(hits[0].point.z>z+.03,'no skin cap across the inlet opening');
    if(x===0&&y===0)assert.ok(hits[0].point.z-z>3.8&&hits[0].point.z-z<4.4,'compressor is about 4m recessed');
  }
}
const nozzle=aircraft.exhaustFrames[1],before=nozzle.getWorldPosition(new T.Vector3());
const canopy=aircraft.group.getObjectByName('Su-35 hinged single-seat canopy');
const closedCrown=new T.Box3().setFromObject(canopy).max.y;
aircraft.update({gear:0,canopy:.7,intakeRamp:.2,vectorPitch:.22,afterburner:1});
assert.ok(nozzle.getWorldPosition(new T.Vector3()).distanceTo(before)>.1,'exhaust exit follows vectoring nozzle');
assert.ok(new T.Box3().setFromObject(canopy).max.y>closedCrown+.5,'canopy lifts above the cockpit');
let closedRadius=0,openRadius=0;
for(const aperture of [0,.3,1]){
  aircraft.update({gear:1,afterburner:aperture,vectorPitch:0});
  const feathers=aircraft.group.getObjectByName('Su-35 24 overlapping profiled nozzle feathers');
  let maxRadius=0;
  for(let i=0;i<feathers.geometry.attributes.position.count;i+=13){
    feathers.getVertexPosition(i,vertices);
    assert.ok(vertices.z>=.139&&vertices.z<=1.531,'opening feathers stay attached to their engine');
    assert.ok(Math.hypot(vertices.x,vertices.y)<.83,'opening feathers stay centred on their nozzle axis');
    if(vertices.z>1.4)maxRadius=Math.max(maxRadius,Math.hypot(vertices.x,vertices.y));
  }
  if(aperture===0)closedRadius=maxRadius;if(aperture===1)openRadius=maxRadius;
}
assert.ok(openRadius>closedRadius+.10,'aperture control changes the physical exit diameter');
assert.equal(aircraft.definition.previewOnly,true);
assert.equal(treeAircraft('ru-su35-s').simId,null,'preview does not claim a native Su-35 flight model');
assert.equal(treeAircraft('ru-su35-s').previewUrl.split('?')[0],'su35.html');

// Keep the shared kit compatible with the existing aircraft and both fins.
const {disposeObject}=await load('aircraft-catalog.js');
for(let type=0;type<=12;type++){
  const a=createAircraft(type);a.update({gear:1});
  assert.ok(a.group.children.length>0,'existing aircraft '+type);
  if([4,5,6,10,11,12].includes(type))assert.equal(a.damageParts[6].visible,true,'right fin '+type);
  disposeObject(a.group);
}
console.log(JSON.stringify({result:'PASS',visibleDimensions:size.toArray(),triangles,intakeRaySamples:18,existingAircraft:13}));
