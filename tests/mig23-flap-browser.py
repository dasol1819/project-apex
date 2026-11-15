"""Actual native gear-linked flap outputs, source articulation and leaf damage.

Reference0..25deg is the existing game controller, not a certified MLD limit.
"""
import base64,csv,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-flap-browser'));out.mkdir(parents=True,exist_ok=True)
expected=os.environ.get('APEX_EXPECT_FLAP_SOURCE','1')!='0'
if os.environ.get('APEX_TEST_GAME_SOURCE'):
 import hashlib
 b=Path(os.environ['APEX_TEST_GAME_SOURCE']).read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='4571caae8e8288967059db4afc036a7ec2a08dfa','published pre-flap source fixture changed'
profile=json.loads(Path('assets/mig23mld/flap-source-shapes.json').read_text())['parts']
points={}
for row in csv.DictReader(open('docs/aircraft-review/mig23mld/flap-source-vertices.csv')):
 if row['kind']=='1':points.setdefault(row['node'],[]).append([float(row[k]) for k in ['x','y','z']])
hook='''
window.__flapQA={get loaded(){return aircraft?.sourceLoaded},get started(){return started},run(){
 setPaused(true);const a=aircraft,report={poses:[],damage:[],captures:{}},profile=__PROFILE__,original=__POINTS__;
 const read=(name,n)=>new Float64Array(sim.memory.buffer,sim[name](),n),systems=()=>readSystems(sim),health=()=>PARTS.map(p=>partValue(systems(),p.id)),enabled=()=>PARTS.map(p=>partValue(systems(),p.id,1));
 function visible(n){for(;n;n=n.parent)if(!n.visible)return false;return true;}
 function sync(){const s=read('get_state',104);a.group.position.fromArray(s);a.group.quaternion.fromArray(s,6);a.update({gear:s[21],wingSweep:read('get_aircraft_configuration',8)[1],leftFlap:s[51],rightFlap:s[52],leftTail:0,rightTail:0,leftRudder:0,afterburner:0,health:health(),enabled:enabled()});a.group.updateWorldMatrix(true,true);}
 function step(gear,n){sim.set_controls(0,0,0,.75,gear,0,0,1);sim.set_wing_sweep(16);for(let i=0;i<n;i++){sim.debug_set_state(0,5000,0,0,0,-90,0,0,0,1);sim.step(1/120);}sync();}
 function reset(){damageEffects.reset();sim.set_aircraft_type(16);sim.reset_spawn(2);step(0,1200);}
 function points(part){const inv=a.group.matrixWorld.clone().invert(),result=[];for(const name of profile[part].nodes)a.group.getObjectByName(name).traverse(m=>{const p=m.geometry?.attributes.position;if(!p)return;const matrix=new T.Matrix4().multiplyMatrices(inv,m.matrixWorld);for(let i=0;i<p.count;i++)result.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(matrix).toArray());});return result;}
 function measure(){const s=read('get_state',104),sweep=read('get_aircraft_configuration',8)[1],items=[];
  for(const part of [16,17]){const p=profile[part],angle=s[part===16?51:52],pin=new T.Vector3(...p.hingePoint),wing=new T.Vector3(...p.hinge),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(...p.hingeAxis),p.flapSign*angle),yaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.sign*(sweep-72)*Math.PI/180),actual=points(part),expected=[];let maxError=0,maxDown=0;
   for(const name of p.nodes)for(const point of original[name]){const v=new T.Vector3(...point),neutral=v.clone().sub(wing).applyQuaternion(yaw).add(wing);v.sub(pin).applyQuaternion(q).add(pin).sub(wing).applyQuaternion(yaw).add(wing);expected.push(v);maxDown=Math.max(maxDown,neutral.y-v.y);}
   if(actual.length!==expected.length)throw Error('Source flap vertex count changed');for(let i=0;i<actual.length;i++)maxError=Math.max(maxError,new T.Vector3(...actual[i]).distanceTo(expected[i]));items.push({part,nativeRadians:angle,sourceVertices:actual.length,maxError,maxDown,registered:a.damageParts[part]?.userData.damageIndex===part});
  }return {gear:s[21],sweep,items};
 }
 function capture(name,part=0,piece=null){const cam=camera.clone();if(piece){cam.position.copy(piece.position).add(new T.Vector3(4,3,5).applyQuaternion(piece.quaternion));cam.lookAt(piece.position);cam.fov=34;}else{cam.position.copy(a.group.localToWorld(new T.Vector3(part===16?-9:9,3,8)));cam.up.copy(new T.Vector3(0,1,0).applyQuaternion(a.group.quaternion));cam.lookAt(a.group.localToWorld(new T.Vector3(part===16?-3.5:3.5,.5,2.1)));cam.fov=37;}cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.render(scene,cam);report.captures[name]=renderer.domElement.toDataURL().split(',')[1];}
 reset();report.poses.push(measure());capture('neutral',17);step(1,120);report.poses.push(measure());capture('transit',17);step(1,1200);report.poses.push(measure());capture('deployed',17);
 for(const part of [16,17]){
  reset();step(1,1200);const before=points(part),nativeAngle=read('get_state',104)[part===16?51:52];capture('flap-'+part+'-before',part);sim.damage_part(part,1);sim.step(1/120);sync();damageEffects.update(read('get_state',104),0,camera,sim,systems());
  const data=read('get_wreckage',2+64*40);let body=null;for(let i=0;i<data[0];i++){const d=data.slice(2+i*40,42+i*40);if(d[1]===part&&d[2]===0)body=Array.from(d);}if(!body)throw Error('Missing native flap body');
  const piece=scene.getObjectByName('detached '+part+':0'),actual=[];let triangles=0,mapped=0;
  piece.traverse(m=>{const p=m.geometry?.attributes.position;if(!p)return;triangles+=(m.geometry.index?.count??p.count)/3;if(m.material.map)mapped++;for(let i=0;i<p.count;i++)actual.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrix).add(new T.Vector3(...body.slice(22,25))).toArray());});
  let maxPoseError=before.length===actual.length?0:null,maxOverflow=-Infinity;
  for(let i=0;i<before.length;i++)for(let k=0;k<3;k++){if(maxPoseError!==null)maxPoseError=Math.max(maxPoseError,Math.abs(before[i][k]-actual[i][k]));maxOverflow=Math.max(maxOverflow,Math.abs(before[i][k]-body[22+k])-body[25+k]);}
  capture('flap-'+part+'-lost',part);capture('flap-'+part+'-piece',part,piece);
  const pose=a.damageParts[part].quaternion.toArray(),matrices=[];piece.traverse(m=>{if(m.isMesh)matrices.push(m.matrix.toArray());});a.update({leftFlap:0,rightFlap:0,health:health(),enabled:enabled()});const frozen=JSON.stringify(pose)===JSON.stringify(a.damageParts[part].quaternion.toArray()),after=[];piece.traverse(m=>{if(m.isMesh)after.push(m.matrix.toArray());});
  report.damage.push({part,nativeAngle,sourceHidden:!visible(a.damageParts[part]),oppositeVisible:visible(a.damageParts[part===16?17:16]),fixedWingVisible:visible(a.group.getObjectByName(part===16?'OBJ0257':'OBJ0264')),actorCount:data[0],triangles,mapped,maxPoseError,maxOverflow,disabledSourceFrozen:frozen,detachedSnapshotFrozen:JSON.stringify(matrices)===JSON.stringify(after)});
 }
 reset();report.reset=[16,17].every(p=>visible(a.damageParts[p]));capture('reset',17);return report;
}};
'''.replace('__PROFILE__',json.dumps(profile)).replace('__POINTS__',json.dumps(points))
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);context=browser.new_context(viewport={'width':1366,'height':900});context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}));page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 if os.environ.get('APEX_TEST_GAME_SOURCE'):
  page.route('**/mig23mld-game.js*',lambda route:route.fulfill(status=200,content_type='text/javascript',body=Path(os.environ['APEX_TEST_GAME_SOURCE']).read_text()))
 if os.environ.get('APEX_TEST_WASM'):
  page.route('**/flight.wasm*',lambda route:route.fulfill(status=200,content_type='application/wasm',body=Path(os.environ['APEX_TEST_WASM']).read_bytes()))
 page.route('**/app.js*',instrument);page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__flapQA.loaded');page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__flapQA.started')
 r=page.evaluate('()=>__flapQA.run()')
 for name,data in r.pop('captures').items():(out/(name+'.png')).write_bytes(base64.b64decode(data))
 r.update(pageErrors=errors,environment='Chromium141 / SwiftShader / actual native type16 and game renderer; hardware FPS unmeasured');(out/'flaps.json').write_text(json.dumps(r,indent=2)+'\n')
 assert not errors and r['reset'],r
 if expected:
  for pose in r['poses']:
   for item in pose['items']:assert item['registered'] and item['maxError']<2e-9,item
  assert all(item['maxDown']>.2 for item in r['poses'][-1]['items']),r
  for case in r['damage']:assert case['sourceHidden'] and case['oppositeVisible'] and case['fixedWingVisible'] and case['triangles']==112 and case['mapped']==6 and case['maxPoseError'] is not None and case['maxPoseError']<2e-9 and case['maxOverflow']<0 and case['disabledSourceFrozen'] and case['detachedSnapshotFrozen'] and case['actorCount']==1,case
 else:
  assert all(not item['registered'] and item['nativeRadians']>.43 and item['maxError']>.2 for item in r['poses'][-1]['items']),r
  assert all(case['triangles']==0 and case['mapped']==0 and case['actorCount']==1 for case in r['damage']),r
 print(json.dumps(r),flush=True);browser.close()
