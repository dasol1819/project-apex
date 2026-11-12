"""Actual native nozzle removal, posed UV wreckage and source envelope audit."""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-nozzle-browser'));out.mkdir(parents=True,exist_ok=True)
expected=os.environ.get('APEX_EXPECT_SOURCE_NOZZLE','1')!='0'
hook='''
window.__nozzle={get loaded(){return aircraft?.sourceLoaded},get started(){return started},
 run(bounds){
 setPaused(true);const a=aircraft,report={states:[],loss:[],samples:[],captures:{}};
 const read=(name,n)=>new Float64Array(sim.memory.buffer,sim[name](),n);
 const health=()=>PARTS.map(p=>partValue(readSystems(sim),p.id));
 function sync(ab){const s=read('get_state',104);a.group.position.fromArray(s);a.group.quaternion.fromArray(s,6);
 a.update({gear:0,wingSweep:72,leftTail:0,rightTail:0,leftRudder:0,afterburner:ab,health:health(),enabled:PARTS.map(p=>partValue(readSystems(sim),p.id,1))});a.group.updateWorldMatrix(true,true);}
 function prepare(ab=1){sim.set_aircraft_type(16);sim.reset_spawn(1);sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);sync(ab);}
 function visible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;}
 function capture(name,offset=[2,1,12],target=[0,.2,7]){const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(...offset)));cam.up.copy(new T.Vector3(0,1,0).applyQuaternion(a.group.quaternion));cam.lookAt(a.group.localToWorld(new T.Vector3(...target)));cam.fov=32;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.render(scene,cam);report.captures[name]=renderer.domElement.toDataURL().split(',')[1];}
 function points(root){const inv=a.group.matrixWorld.clone().invert(),list=[];root.traverse(m=>{const p=m.geometry?.attributes.position;if(!p)return;const mat=new T.Matrix4().multiplyMatrices(inv,m.matrixWorld);for(let i=0;i<p.count;i++)list.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(mat).toArray());});return list;}
 prepare();const nozzle=a.group.getObjectByName('soplo');
 for(const opening of [0,.5,1]){prepare(opening);const pts=points(nozzle),box=new T.Box3().setFromPoints(pts.map(p=>new T.Vector3(...p)));report.states.push({opening,visible:visible(nozzle),box:{min:box.min.toArray(),max:box.max.toArray()},influences:nozzle.children.map(m=>m.morphTargetInfluences?.slice())});report.samples.push(...pts.map(p=>[opening,...p]));capture('nozzle-'+opening);}
 report.maxEnvelopeExcess=-Infinity;
 for(let i=0;i<=40;i++){prepare(i/40);for(const p of points(nozzle))for(let k=0;k<3;k++)report.maxEnvelopeExcess=Math.max(report.maxEnvelopeExcess,Math.abs(p[k]-bounds.pivot[k])-bounds.half[k]);}
 for(const opening of [0,.5,1]){
  prepare(opening);const before=points(nozzle);sim.damage_part(22,1);sim.step(1/120);sync(opening);
  const native=read('get_wreckage',2+64*40);let body=null;for(let i=0;i<native[0];i++){const d=native.slice(2+i*40,2+(i+1)*40);if(d[1]===22){body=d;break;}}
  if(!body)throw Error('No native nozzle body');
  damageEffects.reset();damageEffects.update(read('get_state',104),.01,camera,sim,readSystems(sim));
  const piece=scene.getObjectByName('detached 22:'+body[2]);if(!piece)throw Error('No nozzle visual body');
  const actual=[];piece.traverse(m=>{const p=m.geometry?.attributes.position;if(!p)return;for(let i=0;i<p.count;i++)actual.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrix).add(new T.Vector3(...body.slice(22,25))).toArray());});
  let maxPoseError=before.length===actual.length?0:Infinity;for(let i=0;i<Math.min(before.length,actual.length);i++)for(let k=0;k<3;k++)maxPoseError=Math.max(maxPoseError,Math.abs(before[i][k]-actual[i][k]));
  let triangles=0,mapped=0;piece.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;if(m.material.map)mapped++;});
  // Follow actual native motion for half a second; do not relocate debris.
  for(let i=0;i<60;i++)sim.step(1/120);sync(opening);damageEffects.update(read('get_state',104),.01,camera,sim,readSystems(sim));
  capture('nozzle-lost-'+opening);
  const cam=camera.clone();cam.position.copy(piece.position).add(new T.Vector3(2,1,4).applyQuaternion(piece.quaternion));cam.lookAt(piece.position);cam.fov=32;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.render(scene,cam);const lit=renderer.domElement.toDataURL(),submitted=renderer.info.render.triangles;piece.visible=false;renderer.render(scene,cam);const dark=renderer.domElement.toDataURL(),without=renderer.info.render.triangles;piece.visible=true;report.captures['nozzle-piece-'+opening]=lit.split(',')[1];
  // A later live pose must not alter the already detached body's morph.
  const lostVisible=visible(nozzle),lostHealth=health()[22];
  const frozen=[];piece.traverse(m=>{if(m.morphTargetInfluences)frozen.push(m.morphTargetInfluences.slice());});
  prepare(1-opening);const after=[];piece.traverse(m=>{if(m.morphTargetInfluences)after.push(m.morphTargetInfluences.slice());});
  report.loss.push({opening,health:lostHealth,sourceVisibleAfterLoss:lostVisible,removedCapture:report.captures['nozzle-lost-'+opening]!==report.captures['nozzle-'+opening],registered:a.damageParts[22]===nozzle,triangles,mapped,maxPoseError,nativePivot:Array.from(body.slice(22,25)),nativeHalf:Array.from(body.slice(25,28)),framebufferChanged:lit!==dark,submittedTriangles:submitted-without,frozen:JSON.stringify(frozen)===JSON.stringify(after)});
  damageEffects.reset();
 }
 prepare(1);sim.damage_part(22,1);sim.step(1/120);sync(1);report.hiddenAfterLoss=!visible(nozzle);report.plumeAfterLoss=a.group.getObjectByName('R-35-300 exhaust visual').visible;
 report.parents=[];for(const part of [7,29,0]){prepare(1);sim.damage_part(part,1);sim.step(1/120);sync(1);report.parents.push({part,hidden:!visible(nozzle),plume:a.group.getObjectByName('R-35-300 exhaust visual').visible});}
 prepare(1);report.reset=visible(nozzle);capture('nozzle-reset');
 return report;
 }};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 context=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce')
 context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}))
 page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 page.route('**/app.js*',instrument)
 page.goto(base+'/?screen=tree',wait_until='domcontentloaded')
 page.wait_for_function("document.documentElement.dataset.raptorReady==='true'||document.getElementById('load-status')?.textContent.includes('실행 준비 실패')",timeout=180000)
 assert page.evaluate("document.documentElement.dataset.raptorReady==='true'"),page.locator('#load-status').inner_text()
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__nozzle.loaded')
 page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__nozzle.started&&__nozzle.loaded')
 shape=json.loads(Path('assets/mig23mld/nozzle-damage-shape.json').read_text())
 report=page.evaluate('(bounds)=>__nozzle.run(bounds)',shape)
 samples=report.pop('samples');(out/'nozzle-vertices.csv').write_text('opening,x,y,z\n'+''.join(','.join(format(v,'.17g') for v in row)+'\n' for row in samples))
 for name,data in report.pop('captures').items():(out/(name+'.png')).write_bytes(base64.b64decode(data))
 report.update(pageErrors=errors,environment='Chromium 141 / SwiftShader; actual native type 16 gameplay; hardware FPS unmeasured')
 (out/'nozzle.json').write_text(json.dumps(report,indent=2)+'\n')
 assert not errors,errors
 if expected:
  assert report['maxEnvelopeExcess']<=1e-7,report
  for case in report['loss']:
   for actual,key in [(case['nativePivot'],'pivot'),(case['nativeHalf'],'half')]:
    assert max(abs(a-b) for a,b in zip(actual,shape[key]))<1e-9,case
  assert report['hiddenAfterLoss'] and not report['plumeAfterLoss'] and report['reset'],report
  assert all(c['hidden'] and not c['plume'] for c in report['parents']),report
  assert all(c['registered'] and c['triangles']>20 and c['mapped'] and c['maxPoseError']<1e-6 and c['framebufferChanged'] and c['submittedTriangles']>=c['triangles'] and c['frozen'] for c in report['loss']),report
 print(json.dumps(report),flush=True);browser.close()
