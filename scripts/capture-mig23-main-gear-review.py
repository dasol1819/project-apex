"""Capture actual game cameras/landmarks for private reference registration.

No reference photograph is downloaded or redistributed by this script. The
source shader/material/geometry and native type remain those of the real game.
"""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-main-gear-reference'));out.mkdir(parents=True,exist_ok=True)
hook='''
window.__mainGearReference={get loaded(){return aircraft?.sourceLoaded},get started(){return started},capture(spec){
 setPaused(true);sim.set_aircraft_type(16);sim.reset_spawn(1);
 const a=aircraft;a.group.position.set(0,5000,0);a.group.quaternion.identity();a.update({gear:1,wingSweep:72,leftTail:0,rightTail:0,leftRudder:0,airbrake:0,afterburner:0,health:PARTS.map(()=>1)});a.group.updateWorldMatrix(true,true);
 const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(...spec.offset)));cam.up.set(0,1,0);cam.lookAt(a.group.localToWorld(new T.Vector3(...spec.target)));cam.fov=spec.fov;cam.aspect=spec.width/spec.height;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.setSize(spec.width,spec.height,false);renderer.render(scene,cam);
 const project=p=>{const v=a.group.localToWorld(new T.Vector3(...p)).project(cam);return [(v.x+1)*spec.width/2,(1-v.y)*spec.height/2];};
 const wheelProjections=['OBJ0109','OBJ0131'].map(name=>{const c=new T.Box3().setFromObject(a.group.getObjectByName(name),true).getCenter(new T.Vector3()).project(cam);return {name,pixel:[(c.x+1)*spec.width/2,(1-c.y)*spec.height/2]};});const png=renderer.domElement.toDataURL().split(',')[1];const points=spec.landmarks.map(project),submittedTriangles=renderer.info.render.triangles;a.group.visible=false;renderer.render(scene,cam);const background=renderer.domElement.toDataURL().split(',')[1];a.group.visible=true;
 return {png,background,wheelProjections,projectedLandmarks:points,renderTriangles:submittedTriangles,backgroundTriangles:renderer.info.render.triangles};
}};
'''
specs=[dict(name='main-gear-museum',offset=[-14,1.4,-7],target=[0,.1,2.5],fov=35,width=1000,height=750,landmarks=[])]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce');context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}))
 page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 page.route('**/app.js*',instrument);page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__mainGearReference.loaded');page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__mainGearReference.started&&__mainGearReference.loaded')
 report=[]
 for spec in specs:
  data=page.evaluate('(spec)=>__mainGearReference.capture(spec)',spec)
  for key in ['png','background']:(out/(spec['name']+('-background' if key=='background' else '')+'.png')).write_bytes(base64.b64decode(data.pop(key)))
  report.append(dict(spec,**data))
 assert not errors,errors
 (out/'cameras.json').write_text(json.dumps(dict(cameras=report,pageErrors=errors,environment='Chromium141 / SwiftShader / actual game renderer; all controls neutral, gear1, sweep72, no afterburner'),indent=2)+'\n');print(json.dumps(report));browser.close()
