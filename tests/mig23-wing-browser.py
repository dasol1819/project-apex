"""Actual native moving-wing root loss at three hydraulic sweep settings.

This covers root parts 1/2. Independent spoiler/flap/outer-wing partitions are
still unfinished and are not certified by removing the whole wing root.
"""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-wing-browser'));out.mkdir(parents=True,exist_ok=True)
expected=os.environ.get('APEX_EXPECT_SOURCE_WINGS','1')!='0'
hook='''
window.__wing={get loaded(){return aircraft?.sourceLoaded},get started(){return started},run(){
 setPaused(true);const a=aircraft,report={cases:[],captures:{}};
 const read=(name,n)=>new Float64Array(sim.memory.buffer,sim[name](),n);
 const health=()=>PARTS.map(p=>partValue(readSystems(sim),p.id));
 const root=part=>a.group.getObjectByName(part===1?'OBJ0257':'OBJ0264').parent;
 function visible(n){for(;n;n=n.parent)if(!n.visible)return false;return true;}
 function sync(){const s=read('get_state',104);a.group.position.fromArray(s);a.group.quaternion.fromArray(s,6);a.update({gear:0,wingSweep:read('get_aircraft_configuration',8)[1],leftTail:0,rightTail:0,leftRudder:0,afterburner:0,health:health(),enabled:PARTS.map(p=>partValue(readSystems(sim),p.id,1))});a.group.updateWorldMatrix(true,true);}
 function prepare(angle){damageEffects.reset();sim.set_aircraft_type(16);sim.reset_spawn(2);sim.set_wing_sweep(angle);sim.set_controls(0,0,0,.75,0,0,0,1);
  let i=0;for(;i<6000;i++){sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);sim.step(1/120);if(Math.abs(read('get_aircraft_configuration',8)[1]-angle)<1e-6)break;}if(i===6000)throw Error('wing servo timeout');sync();}
 function points(node){const inverse=a.group.matrixWorld.clone().invert(),result=[];node.traverseVisible(m=>{const p=m.geometry?.attributes.position;if(!p)return;const mat=new T.Matrix4().multiplyMatrices(inverse,m.matrixWorld);for(let i=0;i<p.count;i++)result.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(mat).toArray());});return result;}
 function capture(name){const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(12,12,15)));cam.up.copy(new T.Vector3(0,1,0).applyQuaternion(a.group.quaternion));cam.lookAt(a.group.localToWorld(new T.Vector3(0,.6,2.5)));cam.fov=42;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.render(scene,cam);report.captures[name]=renderer.domElement.toDataURL().split(',')[1];}
 for(const angle of [16,44,72])for(const part of [1,2]){
  prepare(angle);const source=root(part),before=points(source),other=root(3-part);capture('wing-'+part+'-'+angle+'-intact');
  sim.damage_part(part,1);sim.step(1/120);sync();
  const native=read('get_wreckage',2+64*40);let body=null;for(let i=0;i<native[0];i++){const d=native.slice(2+i*40,2+(i+1)*40);if(d[1]===part&&d[2]===0)body=d;}
  if(!body)throw Error('no native wing root body');damageEffects.update(read('get_state',104),0,camera,sim,readSystems(sim));
  const piece=scene.getObjectByName('detached '+part+':'+body[2]);if(!piece)throw Error('no wing debris actor');
  const actual=[];let triangles=0,mapped=0;piece.traverse(m=>{const p=m.geometry?.attributes.position;if(!p)return;triangles+=(m.geometry.index?.count??p.count)/3;if(m.material.map)mapped++;for(let i=0;i<p.count;i++)actual.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrix).add(new T.Vector3(...body.slice(22,25))).toArray());});
  let maxPoseError=before.length===actual.length?0:null,overflow=-Infinity;
  for(let i=0;i<before.length;i++)for(let k=0;k<3;k++){overflow=Math.max(overflow,Math.abs(before[i][k]-body[22+k])-body[25+k]);if(maxPoseError!==null)maxPoseError=Math.max(maxPoseError,Math.abs(before[i][k]-actual[i][k]));}
  let pendingChildTriangles=0;for(const p of [12,13,14,15,16,17,18,19])a.damageParts[p].traverse(m=>{if(m.isMesh)pendingChildTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
  const item={pendingChildTriangles,part,requestedSweep:angle,nativeSweep:read('get_aircraft_configuration',8)[1],registered:a.damageParts[part]===source,sourceHidden:!visible(source),otherWingVisible:visible(other),finVisible:visible(a.damageParts[5]),health:health()[part],triangles,mapped,maxPoseError,sourceOverflow:overflow,nativePivot:Array.from(body.slice(22,25)),nativeHalf:Array.from(body.slice(25,28))};
  for(let i=0;i<240;i++)sim.step(1/120);sync();damageEffects.update(read('get_state',104),0,camera,sim,readSystems(sim));capture('wing-'+part+'-'+angle+'-lost');
  const current=read('get_wreckage',2+64*40);let followed=null;for(let i=0;i<current[0];i++){const d=current.slice(2+i*40,2+(i+1)*40);if(d[1]===part&&d[2]===body[2])followed=d;}if(!followed)throw Error('wing body expired');item.nativeBodyFollowError=piece.position.distanceTo(new T.Vector3(...followed.slice(5,8)));
  const cam=camera.clone();cam.position.copy(piece.position).add(new T.Vector3(7,7,9).applyQuaternion(piece.quaternion));cam.lookAt(piece.position);cam.fov=38;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.render(scene,cam);const lit=renderer.domElement.toDataURL(),submitted=renderer.info.render.triangles;piece.visible=false;renderer.render(scene,cam);const dark=renderer.domElement.toDataURL(),without=renderer.info.render.triangles;piece.visible=true;item.framebufferChanged=lit!==dark;item.submittedTriangles=submitted-without;report.captures['wing-'+part+'-'+angle+'-piece']=lit.split(',')[1];
  const matrices=[];piece.traverse(m=>{if(m.isMesh)matrices.push(m.matrix.toArray())});a.update({wingSweep:angle===16?72:16,health:health()});const after=[];piece.traverse(m=>{if(m.isMesh)after.push(m.matrix.toArray())});item.snapshotFrozen=JSON.stringify(matrices)===JSON.stringify(after);report.cases.push(item);
 }
 prepare(44);sim.damage_part(0,1);sim.step(1/120);sync();report.parentLoss=[1,2].map(p=>!visible(root(p)));
 prepare(16);report.reset=[1,2].every(p=>visible(root(p)));capture('wing-reset');return report;
}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce');context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}))
 page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 page.route('**/app.js*',instrument);page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__wing.loaded');page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__wing.started')
 report=page.evaluate('()=>__wing.run()')
 for name,data in report.pop('captures').items():(out/(name+'.png')).write_bytes(base64.b64decode(data))
 report.update(pageErrors=errors,environment='Chromium141 / SwiftShader / real native type16 and game renderer; root parts1/2 only; hardware FPS unmeasured')
 (out/'wings.json').write_text(json.dumps(report,indent=2)+'\n');assert not errors,errors
 if expected:
  assert report['reset'] and all(report['parentLoss']),report
  for c in report['cases']:
   assert c['pendingChildTriangles']==0 and c['registered'] and c['sourceHidden'] and c['otherWingVisible'] and c['finVisible'] and c['health']==0,c
   assert c['mapped']>0 and c['triangles']>500 and c['maxPoseError'] is not None and c['maxPoseError']<1e-9 and c['sourceOverflow']<0,c
   assert c['nativeBodyFollowError']<1e-8 and c['framebufferChanged'] and c['submittedTriangles']==c['triangles'] and c['snapshotFrozen'],c
 else:assert all(not c['registered'] and not c['sourceHidden'] and c['triangles']==0 for c in report['cases']),report
 print(json.dumps(report),flush=True);browser.close()
