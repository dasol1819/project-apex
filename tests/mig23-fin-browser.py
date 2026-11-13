"""Actual native fixed-fin removal, compact source UV debris and ancestry."""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-fin-browser'));out.mkdir(parents=True,exist_ok=True)
hook='''
window.__fin={get loaded(){return aircraft?.sourceLoaded},get started(){return started},run(bounds){
 setPaused(true);const a=aircraft,report={captures:{},cases:[]};
 const read=(name,n)=>new Float64Array(sim.memory.buffer,sim[name](),n);
 const health=()=>PARTS.map(p=>partValue(readSystems(sim),p.id));
 function sync(){const s=read('get_state',104);a.group.position.fromArray(s);a.group.quaternion.fromArray(s,6);a.update({gear:0,wingSweep:72,leftTail:0,rightTail:0,leftRudder:.3,afterburner:1,health:health(),enabled:PARTS.map(p=>partValue(readSystems(sim),p.id,1))});a.group.updateWorldMatrix(true,true);}
 function prepare(){damageEffects.reset();sim.set_aircraft_type(16);sim.reset_spawn(1);sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);sync();}
 function visible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;}
 function capture(name){const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(6,3,11)));cam.up.copy(new T.Vector3(0,1,0).applyQuaternion(a.group.quaternion));cam.lookAt(a.group.localToWorld(new T.Vector3(0,1.4,6)));cam.fov=32;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.render(scene,cam);report.captures[name]=renderer.domElement.toDataURL().split(',')[1];}
 function points(root){const inv=a.group.matrixWorld.clone().invert(),list=[];root.traverse(m=>{const p=m.geometry?.attributes.position;if(!p)return;const mat=new T.Matrix4().multiplyMatrices(inv,m.matrixWorld);for(let i=0;i<p.count;i++)list.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(mat).toArray());});return list;}
 prepare();const fin=a.damageParts[5],rudder=a.damageParts[20],fitting=a.group.getObjectByName('OBJ0017'),fuz=a.group.getObjectByName('mig23mld_fuz');
 const before=points(fin);let overflow=-Infinity;for(const p of before)for(let k=0;k<3;k++)overflow=Math.max(overflow,Math.abs(p[k]-bounds.pivot[k])-bounds.half[k]);
 report.registration={name:fin.name,fittingInFin:!!fin.getObjectByName('OBJ0017'),rudderExcluded:!fin.getObjectByName('rudder'),overflow,vertices:before.length};capture('fin-intact');
 sim.damage_part(5,1);sim.step(1/120);sync();
 const native=read('get_wreckage',2+64*40);let body=null;for(let i=0;i<native[0];i++){const d=native.slice(2+i*40,2+(i+1)*40);if(d[1]===5){body=d;break;}}
 if(!body)throw Error('No native fixed fin body');
 damageEffects.update(read('get_state',104),.01,camera,sim,readSystems(sim));
 const piece=scene.getObjectByName('detached 5:'+body[2]);if(!piece)throw Error('No original fin debris');
 const actual=[];let triangles=0,mapped=0;piece.traverse(m=>{const p=m.geometry?.attributes.position;if(!p)return;triangles+=(m.geometry.index?.count??p.count)/3;if(m.material.map)mapped++;for(let i=0;i<p.count;i++)actual.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrix).add(new T.Vector3(...body.slice(22,25))).toArray());});
 let maxPoseError=before.length===actual.length?0:Infinity;for(let i=0;i<Math.min(before.length,actual.length);i++)for(let k=0;k<3;k++)maxPoseError=Math.max(maxPoseError,Math.abs(before[i][k]-actual[i][k]));
 report.loss={finHidden:!visible(fin),rudderHidden:!visible(rudder),fittingHidden:!visible(fitting),rootFairingsHidden:['OBJ0010','OBJ0011','OBJ0012'].every(n=>!visible(a.group.getObjectByName(n))),fuselageVisible:visible(fuz),nozzleVisible:visible(a.damageParts[22]),health:health()[5],triangles,mapped,maxPoseError,nativePivot:Array.from(body.slice(22,25)),nativeHalf:Array.from(body.slice(25,28))};
 for(let i=0;i<60;i++)sim.step(1/120);sync();damageEffects.update(read('get_state',104),.01,camera,sim,readSystems(sim));capture('fin-lost');
 const cam=camera.clone();cam.position.copy(piece.position).add(new T.Vector3(8,4,8).applyQuaternion(piece.quaternion));cam.lookAt(piece.position);cam.fov=35;cam.updateProjectionMatrix();cam.updateMatrixWorld();renderer.render(scene,cam);const lit=renderer.domElement.toDataURL(),submitted=renderer.info.render.triangles;piece.visible=false;renderer.render(scene,cam);const dark=renderer.domElement.toDataURL(),without=renderer.info.render.triangles;piece.visible=true;
 report.captures['fin-piece']=lit.split(',')[1];report.loss.framebufferChanged=lit!==dark;report.loss.submittedTriangles=submitted-without;const current=read('get_wreckage',2+64*40);let followed=null;for(let i=0;i<current[0];i++){const d=current.slice(2+i*40,2+(i+1)*40);if(d[1]===5&&d[2]===body[2])followed=d;}if(!followed)throw Error('Native fin body expired too soon');report.loss.nativeBodyFollowError=piece.position.distanceTo(new T.Vector3(...followed.slice(5,8)));
 for(const part of [20,29,0]){prepare();sim.damage_part(part,1);sim.step(1/120);sync();report.cases.push({part,fin:visible(fin),rudder:visible(rudder),fitting:visible(fitting),fuselage:visible(fuz)});capture('damage-'+part);}
 prepare();report.reset=visible(fin)&&visible(rudder)&&visible(fitting);capture('fin-reset');return report;
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
 page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__fin.loaded')
 page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__fin.started&&__fin.loaded')
 shape=json.loads(Path('assets/mig23mld/fin-damage-partition.json').read_text())['nativeShape']
 report=page.evaluate('(bounds)=>__fin.run(bounds)',shape)
 for name,data in report.pop('captures').items():(out/(name+'.png')).write_bytes(base64.b64decode(data))
 report.update(pageErrors=errors,environment='Chromium 141 / SwiftShader / actual native type 16; hardware FPS unmeasured')
 (out/'fin.json').write_text(json.dumps(report,indent=2)+'\n')
 assert not errors,errors
 assert report['registration']['name']=='MiG-23MLD fixed fin' and report['registration']['fittingInFin'] and report['registration']['rudderExcluded'] and report['registration']['overflow']<=1e-7,report
 loss=report['loss'];assert all(loss[k] for k in ['finHidden','rudderHidden','fittingHidden','rootFairingsHidden','fuselageVisible','nozzleVisible','framebufferChanged']),report
 assert loss['triangles']==972 and loss['mapped']>=2 and loss['maxPoseError']<1e-6 and loss['submittedTriangles']==972 and loss['health']==0 and loss['nativeBodyFollowError']<1e-6,report
 for actual,key in [(loss['nativePivot'],'pivot'),(loss['nativeHalf'],'half')]:assert max(abs(a-b) for a,b in zip(actual,shape[key]))<1e-9,report
 assert report['cases'][0]['fin'] and report['cases'][0]['fitting'] and not report['cases'][0]['rudder'],report
 assert all(not c['fin'] and not c['rudder'] and not c['fitting'] for c in report['cases'][1:]) and report['reset'],report
 print(json.dumps(report),flush=True);browser.close()
