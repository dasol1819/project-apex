"""Capture actual game cameras/landmarks for private reference registration.

No reference photograph is downloaded or redistributed by this script. The
source shader/material/geometry and native type remain those of the real game.
"""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-wing-components'));out.mkdir(parents=True,exist_ok=True)
hook='''
window.__wingSourceComponents={get loaded(){return aircraft?.sourceLoaded},get started(){return started},capture(spec){
 setPaused(true);sim.set_aircraft_type(16);sim.reset_spawn(1);
 const a=aircraft;a.group.position.set(0,5000,0);a.group.quaternion.identity();a.update({gear:0,wingSweep:spec.sweep,leftTail:0,rightTail:0,leftRudder:0,airbrake:0,afterburner:0,health:PARTS.map(()=>1)});a.group.updateWorldMatrix(true,true);
 const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(...spec.offset)));cam.up.set(0,0,-1);cam.lookAt(a.group.localToWorld(new T.Vector3(...spec.target)));cam.fov=spec.fov;cam.aspect=spec.width/spec.height;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.setSize(spec.width,spec.height,false);renderer.render(scene,cam);
 const project=p=>{const v=a.group.localToWorld(new T.Vector3(...p)).project(cam);return [(v.x+1)*spec.width/2,(1-v.y)*spec.height/2];};
 const baselineSubmittedTriangles=renderer.info.render.triangles;const png=renderer.domElement.toDataURL().split(',')[1];
 const nodeNames=['OBJ0256','OBJ0257','OBJ0258','OBJ0259','OBJ0260','OBJ0261','OBJ0262','OBJ0270','OBJ0272','OBJ0273','OBJ0100','OBJ0263','OBJ0264','OBJ0265','OBJ0266','OBJ0267','OBJ0268','OBJ0269','OBJ0271','OBJ0274','OBJ0275'];const restore=[],diagnosticMaterials=[],nodes=[];
 for(let i=0;i<nodeNames.length;i++){const n=a.group.getObjectByName(nodeNames[i]);if(!n)throw Error('Missing source '+nodeNames[i]);const color=new T.Color().setHSL(i/nodeNames.length,.8,.55),c=new T.Box3().setFromObject(n,true).getCenter(new T.Vector3()).project(cam);nodes.push({name:n.name,color:'#'+color.getHexString(),pixel:[(c.x+1)*spec.width/2,(1-c.y)*spec.height/2]});n.traverse(m=>{if(!m.isMesh)return;restore.push([m,m.material]);const mat=new T.MeshBasicMaterial({color,side:T.DoubleSide});diagnosticMaterials.push(mat);m.material=mat;});}
 renderer.render(scene,cam);const diagnostic=renderer.domElement.toDataURL().split(',')[1];for(const [m,mat] of restore)m.material=mat;for(const m of diagnosticMaterials)m.dispose();
const points=spec.landmarks.map(project),submittedTriangles=renderer.info.render.triangles;a.group.visible=false;renderer.render(scene,cam);const background=renderer.domElement.toDataURL().split(',')[1];a.group.visible=true;
 return {png,background,diagnostic,nodes,projectedLandmarks:points,renderTriangles:baselineSubmittedTriangles,diagnosticRenderTriangles:submittedTriangles,backgroundTriangles:renderer.info.render.triangles};
}};
'''
specs=[dict(name='wing-source-'+str(sweep),sweep=sweep,offset=[0,23,1.5],target=[0,.65,1.5],fov=45,width=1366,height=1000,landmarks=[]) for sweep in [16,72]]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce');context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}))
 page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 page.route('**/app.js*',instrument);page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__wingSourceComponents.loaded');page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__wingSourceComponents.started&&__wingSourceComponents.loaded')
 report=[]
 for spec in specs:
  data=page.evaluate('(spec)=>__wingSourceComponents.capture(spec)',spec)
  for key in ['png','background','diagnostic']:(out/(spec['name']+('' if key=='png' else '-'+key)+'.png')).write_bytes(base64.b64decode(data.pop(key)))
  report.append(dict(spec,**data))
 assert not errors,errors
 (out/'cameras.json').write_text(json.dumps(dict(cameras=report,pageErrors=errors,environment='Chromium141 / SwiftShader / actual game renderer; all controls neutral, gear0, sweep16/72, no afterburner; secondary image uses diagnostic material colors only'),indent=2)+'\n');print(json.dumps(report));browser.close()
