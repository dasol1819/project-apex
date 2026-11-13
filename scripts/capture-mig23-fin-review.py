"""Capture actual game cameras/landmarks for private reference registration.

No reference photograph is downloaded or redistributed by this script. The
source shader/material/geometry and native type remain those of the real game.
"""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-fin-reference'));out.mkdir(parents=True,exist_ok=True)
hook='''
window.__finReference={get loaded(){return aircraft?.sourceLoaded},get started(){return started},capture(spec){
 setPaused(true);sim.set_aircraft_type(16);sim.reset_spawn(1);
 const a=aircraft;a.group.position.set(0,5000,0);a.group.quaternion.identity();a.update({gear:0,wingSweep:72,leftTail:0,rightTail:0,leftRudder:0,airbrake:0,afterburner:0,health:PARTS.map(()=>1)});a.group.updateWorldMatrix(true,true);
 const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(...spec.offset)));cam.up.set(0,1,0);cam.lookAt(a.group.localToWorld(new T.Vector3(...spec.target)));cam.fov=spec.fov;cam.aspect=spec.width/spec.height;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.setSize(spec.width,spec.height,false);renderer.render(scene,cam);
 const project=p=>{const v=a.group.localToWorld(new T.Vector3(...p)).project(cam);return [(v.x+1)*spec.width/2,(1-v.y)*spec.height/2];};
 const png=renderer.domElement.toDataURL().split(',')[1];const points=spec.landmarks.map(project);a.group.visible=false;renderer.render(scene,cam);const background=renderer.domElement.toDataURL().split(',')[1];a.group.visible=true;
 return {png,background,projectedLandmarks:points,renderTriangles:renderer.info.render.triangles};
}};
'''
specs=[
 dict(name='fin-port-tip',offset=[-4,2.2,7.7],target=[0,2.4,7.7],fov=25,width=640,height=480,landmarks=[[0,2.8933056889,7.3555699392],[0,2.6859924704,8.0923036243]]),
 dict(name='fin-starboard-tip',offset=[4,2.2,7.7],target=[0,2.4,7.7],fov=25,width=640,height=480,landmarks=[[0,2.8933056889,7.3555699392],[0,2.6859924704,8.0923036243]]),
 dict(name='intake-splitter',offset=[1.3,.2,-5.5],target=[1.1,.4,-3],fov=45,width=480,height=640,landmarks=[]),
 dict(name='fin-root',offset=[5,1.2,10],target=[.65,.6,6.2],fov=30,width=1366,height=900,landmarks=[]),
]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce');context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}))
 page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 page.route('**/app.js*',instrument);page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__finReference.loaded');page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__finReference.started&&__finReference.loaded')
 report=[]
 for spec in specs:
  data=page.evaluate('(spec)=>__finReference.capture(spec)',spec)
  for key in ['png','background']:(out/(spec['name']+('-background' if key=='background' else '')+'.png')).write_bytes(base64.b64decode(data.pop(key)))
  report.append(dict(spec,**data))
 assert not errors,errors
 (out/'cameras.json').write_text(json.dumps(dict(cameras=report,pageErrors=errors,environment='Chromium141 / SwiftShader / actual game renderer; all controls neutral, gear0, sweep72, no afterburner'),indent=2)+'\n');print(json.dumps(report));browser.close()
