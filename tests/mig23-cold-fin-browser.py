"""Hold the real first GLB response until the native fixed fin has detached."""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-cold-fin-browser'));out.mkdir(parents=True,exist_ok=True)
hook='''
let coldFinBefore=null;
window.__coldFin={get loaded(){return aircraft?.sourceLoaded},get started(){return started},
 begin(){setPaused(true);damageEffects.reset();sim.set_aircraft_type(16);sim.reset_spawn(1);sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);sim.damage_part(5,1);sim.step(1/120);this.sync();damageEffects.update(this.read('get_state',104),0,camera,sim,readSystems(sim));
 coldFinBefore={root:aircraft.damageParts[5],mesh:this.actor(),native:Array.from(this.read('get_wreckage',2+64*40))};return {loaded:aircraft.sourceLoaded,...this.describe(coldFinBefore.mesh),png:this.capture(coldFinBefore.mesh)};},
 read(name,n){return new Float64Array(sim.memory.buffer,sim[name](),n)},
 sync(){const a=aircraft,s=this.read('get_state',104);a.group.position.fromArray(s);a.group.quaternion.fromArray(s,6);a.update({gear:0,wingSweep:72,leftRudder:0,afterburner:0,health:PARTS.map(p=>partValue(readSystems(sim),p.id)),enabled:PARTS.map(p=>partValue(readSystems(sim),p.id,1))});a.group.updateWorldMatrix(true,true)},
 actor(){const actor=[...damageEffects.__qaActors.values()].find(a=>a.part===5);if(!actor)throw Error('Missing cold fin actor');return actor.mesh},
 describe(mesh){let triangles=0,mapped=0;mesh.traverse(m=>{if(!m.isMesh)return;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;if(m.material.map)mapped++});return {triangles,mapped,position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray()}},
 capture(mesh){const cam=camera.clone();cam.position.copy(mesh.position).add(new T.Vector3(8,4,8).applyQuaternion(mesh.quaternion));cam.lookAt(mesh.position);cam.fov=35;cam.updateProjectionMatrix();cam.updateMatrixWorld();const saved=[...scene.children].filter(n=>n===aircraft.group||n.name.startsWith('detached ')&&n!==mesh).map(n=>[n,n.visible]);for(const [n] of saved)n.visible=false;renderer.render(scene,cam);const png=renderer.domElement.toDataURL().split(',')[1];for(const [n,v] of saved)n.visible=v;return png},
 finish(){this.sync();damageEffects.update(this.read('get_state',104),0,camera,sim,readSystems(sim));const mesh=this.actor(),description=this.describe(mesh);for(let i=0;i<10;i++)damageEffects.update(this.read('get_state',104),0,camera,sim,readSystems(sim));const result={loaded:aircraft.sourceLoaded,sourceRootChanged:aircraft.damageParts[5]!==coldFinBefore.root,bodyReplaced:mesh!==coldFinBefore.mesh,oldRemoved:!coldFinBefore.mesh.parent,stableAfterTenUpdates:mesh===this.actor(),nativeUnchanged:JSON.stringify(coldFinBefore.native)===JSON.stringify(Array.from(this.read('get_wreckage',2+64*40))),sourceHidden:!aircraft.damageParts[5].visible,rudderHidden:!aircraft.damageParts[20].visible,actorCount:damageEffects.stats.parts,...description,png:this.capture(mesh)};damageEffects.reset();result.afterReset=damageEffects.stats.parts;return result}
};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);context=browser.new_context(viewport={'width':1366,'height':900});context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}));page=context.new_page();page.set_default_timeout(120000);errors=[];held=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 def effects(route):
  response=route.fetch();route.fulfill(response=response,body=response.text().replace('return {reset,get focus(){','return {get __qaActors(){return actors},reset,get focus(){'))
 def hold(route):held.append(route);requests.append(route.request.url)
 page.route('**/app.js*',instrument);page.route('**/damage-effects.js*',effects);page.route('**/assets/mig23mld/Mig-23.glb*',hold)
 page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__coldFin.started')
 before=page.evaluate('()=>__coldFin.begin()');assert held,'cold GLB request must be intercepted';assert not before['loaded'],before
 for route in held:route.fulfill(response=route.fetch(timeout=120000))
 page.wait_for_function('__coldFin.loaded');after=page.evaluate('()=>__coldFin.finish()')
 for name,case in [('before',before),('after',after)]:(out/(name+'.png')).write_bytes(base64.b64decode(case.pop('png')))
 report=dict(before=before,after=after,sourceRequests=len(requests),pageErrors=errors,environment='Chromium141 / SwiftShader / actual native type16; real first source GLB response held until native fin loss; hardware FPS unmeasured');(out/'cold-fin.json').write_text(json.dumps(report,indent=2)+'\n')
 assert not errors,errors
 assert all(after[k] for k in ['loaded','sourceRootChanged','bodyReplaced','oldRemoved','stableAfterTenUpdates','nativeUnchanged','sourceHidden','rudderHidden']),report
 assert after['triangles']==972 and after['mapped']==5 and after['actorCount']==2 and after['afterReset']==0,report
 assert before['position']==after['position'] and before['quaternion']==after['quaternion'] and len(requests)==1,report
 print(json.dumps(report),flush=True);browser.close()
