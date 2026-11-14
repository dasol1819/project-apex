"""A cached original arrives after native detachment: refresh only its visual body."""
import os,json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-async-wreckage-browser'));out.mkdir(parents=True,exist_ok=True)
expected=os.environ.get('APEX_EXPECT_ASYNC_WRECKAGE','1')!='0'
part=int(os.environ.get('APEX_TEST_PART','22'));assert part in [1,2,5,22]
hook='''
window.__asyncDebris={get loaded(){return aircraft?.sourceLoaded},async run(){
 const part=__QA_PART__;setPaused(true);damageEffects.reset();sim.set_aircraft_type(16);sim.reset_spawn(1);sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);
 const read=(name,n)=>new Float64Array(sim.memory.buffer,sim[name](),n);
 if(part===1||part===2){sim.set_wing_sweep(72);sim.set_controls(0,0,0,.75,0,0,0,1);for(let i=0;i<6000;i++){sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);sim.step(1/120);if(Math.abs(read('get_aircraft_configuration',8)[1]-72)<1e-6)break;}}
 const s=read('get_state',104);
 const beforeNodes=new Set(scene.children),a=createAircraft(16);a.group.position.fromArray(s);scene.add(a.group);
 const health=new Float32Array(30).fill(1),enabled=new Float32Array(30).fill(1);a.update({gear:0,wingSweep:72,afterburner:.5,health,enabled});
 const oldRoot=a.damageParts[part];sim.damage_part(part,1);sim.step(1/120);health[part]=0;enabled[part]=0;a.update({gear:0,afterburner:.5,health,enabled});
 const fx=createDamageEffects(scene,a);fx.update(read('get_state',104),0,camera,sim,readSystems(sim));
 const before=[...fx.__qaActors.values()].find(actor=>actor.part===part).mesh,nativeBefore=Array.from(read('get_wreckage',2+64*40));
 function describe(mesh){let triangles=0,mapped=0;const weights=[];mesh.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;if(m.material.map)mapped++;if(m.morphTargetInfluences)weights.push(m.morphTargetInfluences.slice());});return {triangles,mapped,weights,position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray()};}
 function capture(mesh){const cam=camera.clone();cam.position.copy(mesh.position).add(new T.Vector3(...([1,2,5].includes(part)?[8,4,8]:[2,1,4])).applyQuaternion(mesh.quaternion));cam.lookAt(mesh.position);cam.fov=32;cam.updateProjectionMatrix();cam.updateMatrixWorld();const hidden=[...scene.children].filter(n=>(n.name.startsWith('detached ')&&n!==mesh)||n===a.group||n===aircraft.group).map(n=>[n,n.visible]);for(const [n] of hidden)n.visible=false;renderer.render(scene,cam);const data=renderer.domElement.toDataURL().split(',')[1];for(const [n,v] of hidden)n.visible=v;return data;}
 const beforeReport=describe(before),beforeCapture=capture(before);
 for(let i=0;i<60&&!a.sourceLoaded;i++)await new Promise(resolve=>requestAnimationFrame(resolve));
 a.update({gear:0,afterburner:.5,health,enabled});fx.update(read('get_state',104),0,camera,sim,readSystems(sim));
 const after=[...fx.__qaActors.values()].find(actor=>actor.part===part).mesh,afterReport=describe(after),afterCapture=capture(after);
 for(let i=0;i<10;i++)fx.update(read('get_state',104),0,camera,sim,readSystems(sim));
 const stable=[...fx.__qaActors.values()].find(actor=>actor.part===part).mesh===after;
 // Changing the live instance after arrival must not change the detached pose.
 a.update({afterburner:1,health:new Float32Array(30).fill(1),enabled:new Float32Array(30).fill(1)});
 let pendingChildTriangles=0;if(part===1||part===2)for(const actor of fx.__qaActors.values())if(actor.part!==part)actor.mesh.traverse(m=>{if(m.isMesh)pendingChildTriangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
 const result={pendingChildTriangles,loaded:a.sourceLoaded,sourceRootChanged:oldRoot!==a.damageParts[part],bodyReplaced:before!==after,before:beforeReport,after:afterReport,oldBodyRemoved:before!==after&&!before.parent,stableAfterTenUpdates:stable,snapshotFrozen:JSON.stringify(describe(after).weights)===JSON.stringify(afterReport.weights),nativeUnchanged:JSON.stringify(nativeBefore)===JSON.stringify(Array.from(read('get_wreckage',2+64*40))),actorCount:fx.stats.parts,expectedNativeActorCount:nativeBefore[0],captures:{before:beforeCapture,after:afterCapture}};
 fx.reset();result.afterReset=fx.stats.parts;a.dispose();for(const n of [...scene.children])if(!beforeNodes.has(n)){disposeObject(n);scene.remove(n);}
 return result;
}};
'''
hook=hook.replace('__QA_PART__',str(part))
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);c=b.new_context(viewport={'width':1366,'height':900});c.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}));page=c.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(r):
  res=r.fetch();r.fulfill(response=res,body=res.text()+hook)
 page.route('**/app.js*',instrument)
 def effects(route):
  res=route.fetch();source=Path(os.environ['APEX_TEST_EFFECTS_SOURCE']).read_text() if os.environ.get('APEX_TEST_EFFECTS_SOURCE') else res.text();text=source.replace('return {reset,get focus(){','return {get __qaActors(){return actors},reset,get focus(){')
  route.fulfill(response=res,body=text)
 page.route('**/damage-effects.js*',effects)
 page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__asyncDebris.loaded')
 r=page.evaluate('()=>__asyncDebris.run()')
 for name,data in r.pop('captures').items():(out/(name+'.png')).write_bytes(base64.b64decode(data))
 r.update(part=part,pageErrors=errors,environment='Chromium 141 / SwiftShader, actual native type16, cached source arrival; hardware FPS unmeasured');(out/'async-wreckage.json').write_text(json.dumps(r,indent=2)+'\n')
 assert not errors,errors
 if expected:
  assert r['loaded'] and r['sourceRootChanged'] and r['bodyReplaced'] and r['oldBodyRemoved'] and r['stableAfterTenUpdates'] and r['snapshotFrozen'] and r['nativeUnchanged'],r
  if part==22:assert r['after']['triangles']==288 and r['after']['mapped']==1 and r['after']['weights']==[[.5]],r
  elif part in [1,2]:assert r['pendingChildTriangles']==0 and r['after']['triangles']==(636 if part==1 else 665) and r['after']['mapped']==(20 if part==1 else 19) and r['after']['weights']==[],r
  else:assert r['after']['triangles']==972 and r['after']['mapped']==5 and r['after']['weights']==[],r
  assert r['before']['position']==r['after']['position'] and r['before']['quaternion']==r['after']['quaternion'],r
  assert r['actorCount']==r['expectedNativeActorCount'] and r['afterReset']==0,r
 print(json.dumps(r),flush=True);b.close()
