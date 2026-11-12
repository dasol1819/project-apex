"""Actual gameplay/native tail damage and original-GLB wreckage audit.
Inspection hooks are injected into HTTP responses, never shipped.
"""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get('APEX_TEST_URL', 'http://127.0.0.1:8765').rstrip('/')
out = Path(os.environ.get('APEX_TEST_OUTPUT', '/tmp/mig23-damage-browser'))
out.mkdir(parents=True, exist_ok=True)
expected = os.environ.get('APEX_EXPECT_SOURCE_DAMAGE', '1') != '0'
hook = '''
window.__tailDamage={get loaded(){return aircraft?.sourceLoaded},get started(){return started},
 async run(bounds){
  setPaused(true);
  const {createWreckageFactory}=await import('./wreckage-mesh.js');
  const a=aircraft, report={cases:[],captures:{}};
  const names={3:'stab2',4:'stab',20:'rudder'};
  const read=(name,n)=>new Float64Array(sim.memory.buffer,sim[name](),n);
  function sync(){
   const s=read('get_state',104),sys=readSystems(sim);
   a.group.position.fromArray(s);a.group.quaternion.fromArray(s,6);
   a.update({gear:0,wingSweep:72,leftTail:s[49],rightTail:s[50],leftRudder:s[55],afterburner:0,
    health:PARTS.map(p=>partValue(sys,p.id)),enabled:PARTS.map(p=>partValue(sys,p.id,1))});
   a.group.updateWorldMatrix(true,true);
  }
  function prepare(){
   sim.set_aircraft_type(16);sim.reset_spawn(1);
   sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);
   sim.set_controls(.5,.2,.4,.7,0,0,0,0);
   for(let i=0;i<120;i++)sim.step(1/120);
   sync();
  }
  function capture(offset,target,aircraftOnly=false){
   const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(...offset)));
   cam.up.copy(new T.Vector3(0,1,0).applyQuaternion(a.group.quaternion));
   cam.lookAt(a.group.localToWorld(new T.Vector3(...target)));cam.fov=30;cam.updateProjectionMatrix();cam.updateMatrixWorld();
   renderer.render(scene,cam);const png=renderer.domElement.toDataURL().split(',')[1];
   if(!aircraftOnly)return png;
   a.group.visible=false;renderer.render(scene,cam);const background=renderer.domElement.toDataURL().split(',')[1];a.group.visible=true;
   return {png,background};
  }
  function visible(node){for(let n=node;n;n=n.parent)if(!n.visible)return false;return true;}
  prepare();
  report.sourceSamples=[];
  for(const angle of [-.6,0,.6]){
   a.group.position.set(0,5000,0);a.group.quaternion.identity();
   a.update({gear:0,wingSweep:72,leftTail:angle,rightTail:angle,leftRudder:angle});
   a.group.updateWorldMatrix(true,true);const inv=a.group.matrixWorld.clone().invert();
   for(const [part,name] of Object.entries(names))a.group.getObjectByName(name).traverse(m=>{
    const p=m.geometry?.attributes.position;if(!p)return;
    const mat=new T.Matrix4().multiplyMatrices(inv,m.matrixWorld);
    for(let i=0;i<p.count;i++)report.sourceSamples.push([Number(part),angle,...new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mat).toArray()]);
   });
  }
  prepare();
  report.captures.intact=capture([6,2.5,14],[0,.5,6.4]);
  report.profileMaxOverflowMetres=-Infinity;
  for(let step=0;step<=40;step++){
   const angle=-.6+step*.03;
   a.group.position.set(0,5000,0);a.group.quaternion.identity();
   a.update({gear:0,wingSweep:72,leftTail:angle,rightTail:angle,leftRudder:angle});
   a.group.updateWorldMatrix(true,true);const inv=a.group.matrixWorld.clone().invert();
   for(const [part,name] of Object.entries(names))a.group.getObjectByName(name).traverse(m=>{
    const p=m.geometry?.attributes.position;if(!p)return;
    const mat=new T.Matrix4().multiplyMatrices(inv,m.matrixWorld),box=bounds.parts[part];
    for(let i=0;i<p.count;i++){
     const point=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mat).toArray();
     for(let k=0;k<3;k++)report.profileMaxOverflowMetres=Math.max(report.profileMaxOverflowMetres,Math.abs(point[k]-box.pivot[k])-box.half[k]);
    }
   });
  }
  for(const [part,name] of Object.entries(names).map(([p,n])=>[Number(p),n])){
   prepare();const skin=a.group.getObjectByName(name);
   const before=skin.getWorldPosition(new T.Vector3()).toArray();
   sim.damage_part(part,1);sim.step(1/120);sync();
   const native=read('get_wreckage',2+64*40);let body=null;
   for(let i=0;i<native[0];i++){const d=native.slice(2+i*40,2+(i+1)*40);if(d[1]===part){body=d;break;}}
   if(!body)throw Error('No native detached body for '+part);
   const factory=createWreckageFactory(a),debris=factory.create(part,body[2],Array.from(body.slice(22,25)),Array.from(body.slice(25,28)));
   let triangles=0,maps=0;debris.traverse(n=>{if(n.isMesh){triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;if(n.material.map)maps++;}});
   report.cases.push({part,sourceNode:name,health:partValue(readSystems(sim),part),sourceVisible:visible(skin),
    registered:!!a.damageParts[part].getObjectByName(name),nativeVariant:body[2],triangles,mappedMeshes:maps,before,nativePivot:Array.from(body.slice(22,25)),nativeHalf:Array.from(body.slice(25,28)),sourceBounds:new T.Box3().setFromObject(skin).getSize(new T.Vector3()).toArray()});
   report.captures['lost-'+part]=capture([6,2.5,14],[0,.5,6.4]);
   factory.release(debris);
   // Use the real player's damage-effect path and native free-body transforms.
   damageEffects.reset();
   for(let i=0;i<60;i++)sim.step(1/120);
   sync();damageEffects.update(read('get_state',104),.05,camera,sim,readSystems(sim));
   report.cases.at(-1).nativeRenderedBodies=damageEffects.stats.parts;
   report.captures['wreck-'+part]=capture([10,4,17],[0,.5,4]);
   damageEffects.reset();
  }
  prepare();sim.damage_part(29,1);sim.step(1/120);sync();
  report.parentLoss=[3,4,20].map(part=>({part,visible:visible(a.group.getObjectByName(names[part]))}));
  prepare();sim.damage_part(0,1);sim.step(1/120);sync();
  report.fuselageLoss=Object.keys(names).map(Number).map(part=>({part,visible:visible(a.group.getObjectByName(names[part]))}));
  prepare();report.reset=Object.values(names).every(name=>visible(a.group.getObjectByName(name)));
  // Exercise an emitter that was created on the synchronous fallback before
  // the cached original source finishes its next microtask.
  prepare();sim.damage_part(3,.55);sim.step(1/120);
  const sys=readSystems(sim),s=read('get_state',104),health=PARTS.map(p=>partValue(sys,p.id));
  const fixture=createAircraft(16);fixture.group.position.fromArray(s);scene.add(fixture.group);
  const beforeRoot=fixture.damageParts[3],beforeNodes=new Set(scene.children);
  const fx=createDamageEffects(scene,fixture);
  fixture.update({health});fx.update(s,0,camera,sim,sys);
  const fallbackSample=globalThis.__partEmitterCalls.some(c=>c.uuid===beforeRoot.uuid);
  for(let i=0;i<60&&!fixture.sourceLoaded;i++)await new Promise(resolve=>requestAnimationFrame(resolve));
  fixture.update({health});fx.update(s,0,camera,sim,sys);
  const sourceRoot=fixture.damageParts[3];
  const sourceCalls=globalThis.__partEmitterCalls.filter(c=>c.uuid===sourceRoot.uuid).length;
  for(let i=0;i<10;i++)fx.update(s,0,camera,sim,sys);
  report.emitterRefresh={loaded:fixture.sourceLoaded,replaced:sourceRoot!==beforeRoot,fallbackSample,
   sourceSample:globalThis.__partEmitterCalls.some(c=>c.uuid===sourceRoot.uuid&&c.uuid!==beforeRoot.uuid),
   stableSourceSample:globalThis.__partEmitterCalls.filter(c=>c.uuid===sourceRoot.uuid).length===sourceCalls};
  fx.reset();for(const node of [...scene.children])if(!beforeNodes.has(node)){disposeObject(node);scene.remove(node);}
  fixture.dispose();disposeObject(fixture.group);scene.remove(fixture.group);
  // Same neutral pose/camera as the published US Navy registration recipe.
  a.group.position.set(0,5000,0);a.group.quaternion.identity();
  a.update({gear:0,wingSweep:72,leftTail:0,rightTail:0,leftRudder:0,afterburner:0,health:new Float32Array(30).fill(1)});
  const photo=capture([23,-4,4.4],[0,.95,0],true);
  report.captures['tail-overlay-png']=photo.png;report.captures['tail-overlay-background']=photo.background;
  report.captures['intake-starboard']=capture([6,0,-8],[1.2,0,-3]);
  report.captures['intake-port']=capture([-6,0,-8],[-1.2,0,-3]);
  report.captures['root-starboard']=capture([5,1.2,10],[.65,.6,6.2]);
  return report;
 }
};
'''

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 1366, 'height': 900}, reduced_motion='reduce')
    context.route('**/api/account/session', lambda r: r.fulfill(json={'user': None}))
    page = context.new_page()
    page.set_default_timeout(120000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script('globalThis.__partEmitterCalls=[]')
    def instrument_emitter(route):
        response = route.fetch()
        text = response.text().replace('export function createPartEmitter(root){', 'export function createPartEmitter(root){globalThis.__partEmitterCalls.push({uuid:root.uuid,name:root.name});')
        route.fulfill(response=response, body=text)
    page.route('**/part-emitter.js*', instrument_emitter)
    def instrument(route):
        response = route.fetch()
        route.fulfill(response=response, body=response.text() + hook)
    page.route('**/app.js*', instrument)
    page.goto(base + '/?screen=tree', wait_until='domcontentloaded')
    page.wait_for_function("document.documentElement.dataset.raptorReady==='true'||document.getElementById('load-status')?.textContent.includes('실행 준비 실패')", timeout=180000)
    assert page.evaluate("document.documentElement.dataset.raptorReady==='true'"), page.locator('#load-status').inner_text()
    page.locator('[data-tree-nation=ru]').click()
    page.locator('[data-tree-aircraft=ru-mig23-mld]').click()
    page.locator('#tree-choose').click()
    page.wait_for_function('__tailDamage.loaded')
    page.locator('#tree-prepare').click()
    page.locator('#launch').click()
    page.wait_for_function('__tailDamage.started && __tailDamage.loaded')
    bounds = json.loads(Path('assets/mig23mld/tail-damage-shapes.json').read_text())
    report = page.evaluate('(bounds)=>__tailDamage.run(bounds)', bounds)
    samples=report.pop('sourceSamples')
    (out / 'tail-vertices.csv').write_text('part,angle,x,y,z\n' + ''.join(','.join(format(v,'.17g') for v in row)+'\n' for row in samples))
    for name, data in report.pop('captures').items():
        (out / ('mig23-' + name + '.png')).write_bytes(base64.b64decode(data))
    report.update(environment='Chromium 141 / SwiftShader / actual native type-16 gameplay; hardware FPS unmeasured', pageErrors=errors, expectSourceDamage=expected)
    (out / 'damage.json').write_text(json.dumps(report, indent=2) + '\n')
    assert not errors, errors
    if expected:
        assert all(c['health'] < .08 and not c['sourceVisible'] and c['registered'] and c['triangles'] > 10 and c['mappedMeshes'] > 0 for c in report['cases']), report
        assert not any(c['visible'] for c in report['parentLoss']), report
        assert not any(c['visible'] for c in report['fuselageLoss']), report
        assert all(report['emitterRefresh'].values()), report
        assert report['reset'], report
        assert report['profileMaxOverflowMetres'] <= 1e-7, report
        for case in report['cases']:
            shape = bounds['parts'][str(case['part'])]
            for actual, key in [(case['nativePivot'], 'pivot'), (case['nativeHalf'], 'half')]:
                assert max(abs(a-b) for a, b in zip(actual, shape[key])) < 1e-9, case
    print(json.dumps(report), flush=True)
    browser.close()
