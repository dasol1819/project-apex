"""Preserve original source poses outside the new flap articulation.

Both source versions use the current renderer and identical explicit controls;
this is a visual compatibility fixture, not a historical mixed native release.
"""
import base64,hashlib,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
fixture=Path('tests/fixtures/mig23-flaps/before-source-flaps.js').read_bytes()
assert hashlib.sha1(b'blob '+str(len(fixture)).encode()+b'\0'+fixture).hexdigest()=='4571caae8e8288967059db4afc036a7ec2a08dfa'
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-flap-preservation'));out.mkdir(parents=True,exist_ok=True)
hook='''
window.__flapPreservation={get loaded(){return aircraft?.sourceLoaded},async run(){
 setPaused(true);const {createMig23mldAircraft}=await import('./mig23mld-game-before.js?flap-preservation');
 const prior=createMig23mldAircraft(),current=aircraft;scene.add(prior.group);prior.group.visible=false;
 for(let i=0;i<1200&&!prior.sourceLoaded;i++)await new Promise(r=>requestAnimationFrame(r));if(!prior.sourceLoaded)throw Error('Missing source fixture');
 const names=['OBJ0037','OBJ0057','OBJ0040','OBJ0060','stab','stab2','rudder','OBJ0024','stoykanos','nos','OBJ0109','OBJ0131','soplo','OBJ0260','OBJ0270','OBJ0267','OBJ0271'];
 const health=PARTS.map(()=>1),enabled=PARTS.map(()=>1),poses=[];let observations=0,maxError=0;
 function vertices(a,name){const node=a.group.getObjectByName(name);if(!node)throw Error('Missing authored source '+name);const inv=a.group.matrixWorld.clone().invert(),v=[];node.traverse(m=>{if(!m.isMesh)return;const matrix=new T.Matrix4().multiplyMatrices(inv,m.matrixWorld),p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)v.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(matrix));});return v;}
 for(const wingSweep of [16,44,72])for(const gear of [0,.5,1])for(const airbrake of [0,.5,1]){
  const state={wingSweep,gear,airbrake,leftTail:.2,rightTail:-.15,leftRudder:.1,leftFlap:0,rightFlap:0,afterburner:.5,health,enabled};
  for(const a of [prior,current]){a.group.position.set(0,5000,0);a.group.quaternion.identity();a.update(state);a.group.updateWorldMatrix(true,true);}
  let poseError=0,worst=null;for(const name of names){const a=vertices(prior,name),b=vertices(current,name);if(a.length!==b.length)throw Error('Source vertices changed '+name);for(let i=0;i<a.length;i++){const error=a[i].distanceTo(b[i]);if(error>poseError){poseError=error;worst=name;}observations++;}}
  maxError=Math.max(maxError,poseError);poses.push({wingSweep,gear,airbrake,maxError:poseError,worst});
 }
 prior.dispose();scene.remove(prior.group);return {poses,observations,maxError,sourceNodes:names};
}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1366,'height':900});context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}));page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/mig23mld-game-before.js*',lambda r:r.fulfill(status=200,content_type='text/javascript',body=fixture))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 if os.environ.get('APEX_TEST_GAME_SOURCE'):
  page.route('**/mig23mld-game.js*',lambda r:r.fulfill(status=200,content_type='text/javascript',body=Path(os.environ['APEX_TEST_GAME_SOURCE']).read_text()))
 page.route('**/app.js*',instrument);page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__flapPreservation.loaded');page.locator('#tree-prepare').click();page.locator('#launch').click()
 report=page.evaluate('()=>__flapPreservation.run()');report.update(pageErrors=errors,environment='Chromium141 / SwiftShader / actual game factory source;27 explicit pose combinations. Neutral new flaps preserve prior source, all existing rig controls unchanged. Not an aircraft-limit certification.')
 (out/'preservation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True);assert not errors,report
 if os.environ.get('APEX_EXPECT_PRESERVED_POSES','1')=='0':assert report['maxError']>.05,report
 else:assert report['maxError']<2e-9,report
 browser.close()
