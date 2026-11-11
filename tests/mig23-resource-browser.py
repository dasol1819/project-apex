"""Real game renderer multi-instance texture/pose/lifetime audit."""
import base64, json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-resource-browser'));out.mkdir(parents=True,exist_ok=True)
expect_shared=os.environ.get('APEX_EXPECT_SHARED_SOURCE','1')!='0'
hook='''
let resourceFixture=null;
window.__mig23Resources={
 get loaded(){return aircraft?.sourceLoaded},get fixtureLoaded(){return resourceFixture?.sourceLoaded},get started(){return started},
 addFixture(){resourceFixture=createAircraft(16);scene.add(resourceFixture.group);},
 removeFixture(){resourceFixture?.dispose?.();if(resourceFixture)disposeObject(resourceFixture.group);resourceFixture=null;},
 sample(includeFixture=false){
  const a=aircraft;a.group.position.set(0,5000,0);a.group.quaternion.identity();
  a.update({gear:0,wingSweep:45,leftTail:0,rightTail:0,leftRudder:0,airbrake:0,afterburner:0});
  if(includeFixture){resourceFixture.group.position.set(9,5000,0);resourceFixture.group.quaternion.identity();
   resourceFixture.update({gear:0,wingSweep:45,leftTail:0,rightTail:0,leftRudder:0,airbrake:0,afterburner:0});}
  const cam=camera.clone();cam.position.set(31,5013,35);cam.up.set(0,1,0);cam.lookAt(4.5,5000,0);cam.fov=35;cam.updateProjectionMatrix();cam.updateMatrixWorld();
  renderer.render(scene,cam);
  const stats={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,rendererTextures:renderer.info.memory.textures};
  const handles=new Map(),objects=new Set();
  for(const group of (includeFixture?[a.group,resourceFixture.group]:[a.group]))group.traverseVisible(obj=>{
   for(const material of (Array.isArray(obj.material)?obj.material:[obj.material])){
    if(!material)continue;
    for(const name of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']){
     const texture=material[name];if(!texture?.isTexture)continue;objects.add(texture);
     const handle=renderer.properties.get(texture).__webglTexture;if(!handle||handles.has(handle))continue;
     let w=texture.image?.width||0,h=texture.image?.height||0,bytes=0;
     if(w&&h){for(;;){bytes+=w*h*4;if(!texture.generateMipmaps||(w===1&&h===1))break;w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));}}
     handles.set(handle,bytes);
    }
   }
  });
  return {...stats,textureObjects:objects.size,handles:handles.size,estimatedRGBA8Bytes:[...handles.values()].reduce((a,b)=>a+b,0),png:renderer.domElement.toDataURL().split(',')[1]};
 },
 poses(){
  const a=aircraft,b=resourceFixture;
  a.update({gear:0,wingSweep:16,leftTail:.25,rightTail:.25,leftRudder:0,afterburner:1});
  b.update({gear:1,wingSweep:72,leftTail:-.25,rightTail:.1,leftRudder:.2,afterburner:0});
  const tail=o=>o.group.getObjectByName('MiG-23MLD port stabilator');
  const nozzle=o=>o.group.getObjectByName('soplo').children.find(n=>n.isMesh);
  const skin=o=>o.group.getObjectByName('stab').children.find(n=>n.material?.map);
  const before=tail(a).quaternion.toArray(),wet=nozzle(a).morphTargetInfluences[0],dry=nozzle(b).morphTargetInfluences[0];
  const distinctPoses=!tail(a).quaternion.equals(tail(b).quaternion);
  b.update({leftTail:.1,afterburner:.5});
  return {distinctPoses,primaryUnchanged:tail(a).quaternion.toArray().every((v,i)=>v===before[i])&&nozzle(a).morphTargetInfluences[0]===wet,
   wet,dry,fixtureHalf:nozzle(b).morphTargetInfluences[0],geometryIndependent:nozzle(a).geometry!==nozzle(b).geometry,
   materialsIndependent:skin(a).material!==skin(b).material,sharedTextures:skin(a).material.map===skin(b).material.map};
 }
};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 errors=[];requests=[]
 context=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce')
 context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}))
 page=context.new_page();page.set_default_timeout(120000)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.on('request',lambda r:requests.append(r.url) if '/assets/mig23mld/Mig-23.glb' in r.url else None)
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 page.route('**/app.js*',instrument)
 page.goto(base+'/?screen=tree',wait_until='domcontentloaded')
 page.wait_for_selector('html[data-raptor-ready=true]',timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click()
 page.wait_for_function('__mig23Resources.loaded')
 if page.locator('#tree-prepare').is_visible():page.locator('#tree-prepare').click()
 else:
  page.locator('#tree-back').click();page.locator('#hangar-open').click();page.locator('#hangar-sortie-start').click()
 page.locator('#launch').click();page.wait_for_function('__mig23Resources.started && __mig23Resources.loaded')
 def sample(name,both=False):
  result=page.evaluate('__mig23Resources.sample',both)
  (out/(name+'.png')).write_bytes(base64.b64decode(result.pop('png')))
  return result
 one=sample('one')
 before=len(requests);page.evaluate('__mig23Resources.addFixture()');page.wait_for_function('__mig23Resources.fixtureLoaded')
 fixture_requests=len(requests)-before
 two=sample('two',True);poses=page.evaluate('__mig23Resources.poses()')
 page.evaluate('__mig23Resources.removeFixture()');remaining=sample('remaining')
 assert poses['distinctPoses'] and poses['primaryUnchanged'] and poses['geometryIndependent'] and poses['materialsIndependent'],poses
 assert poses['wet']==0 and poses['dry']==1 and abs(poses['fixtureHalf']-.5)<1e-10,poses
 assert one['handles']>0 and remaining['handles']==one['handles'],[one,remaining]
 if expect_shared:
  assert poses['sharedTextures'] and fixture_requests==0,[poses,fixture_requests]
  assert two['handles']==one['handles'] and two['estimatedRGBA8Bytes']==one['estimatedRGBA8Bytes'],[one,two]
  assert remaining['rendererTextures']<=one['rendererTextures'],[one,remaining]
 assert not errors,errors
 report={'result':'PASS','expectSharedSource':expect_shared,'one':one,'two':two,'remaining':remaining,'additionalFixtureRequests':fixture_requests,'poses':poses,
  'environment':'Chromium 141 / SwiftShader, actual game renderer, 1366x900. Second visual factory instance; not AI combat/flight certification.',
  'memoryNote':'Texture handles observed; RGBA8 full-mipmap storage estimated. Driver allocation and hardware FPS unmeasured.'}
 (out/'resources.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
 browser.close()
