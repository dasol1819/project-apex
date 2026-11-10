"""MiG-23MLD real Chromium/WebGL game-flight smoke on the restored Pages build.
Instrumentation is injected by Playwright and never shipped to end users."""
import base64, json, math, os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-flight-browser'))
out.mkdir(parents=True,exist_ok=True)
hook='''\nwindow.__mig23QA={get sim(){return sim},get aircraft(){return aircraft},get wing(){return mig23Wing},get started(){return started},get ready(){return ready},readState,capture(offset, comparePlume=false){
 const group=aircraft.group;
 const testCamera=camera.clone();
 testCamera.position.copy(group.localToWorld(new T.Vector3(...offset)));
 testCamera.up.copy(new T.Vector3(0,1,0).applyQuaternion(group.quaternion));
 testCamera.lookAt(group.position);
 testCamera.fov=30;
 testCamera.updateProjectionMatrix();
 testCamera.updateMatrixWorld();
 renderer.render(scene,testCamera);
 const lit=renderer.domElement.toDataURL();
 if(!comparePlume)return lit.split(',')[1];
 const plume=group.getObjectByName('R-35-300 exhaust visual');
 plume.visible=false;
 renderer.render(scene,testCamera);
 const dark=renderer.domElement.toDataURL();
 plume.visible=true;
 return {visiblePixels:lit!==dark,png:lit.split(',')[1]};
}};\n'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 errors=[]
 ctx=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce')
 # The flight smoke uses an anonymous session and has no account dependency.
 ctx.route("**/api/account/session",lambda route:route.fulfill(json={"user":None}))
 page=ctx.new_page()
 page.set_default_timeout(120000)
 page.on('pageerror',lambda e:errors.append('DESKTOP PAGE ERROR: '+(e.stack or str(e))))
 page.on('console',lambda m:errors.append('DESKTOP CONSOLE ERROR: '+m.text) if m.type=='error' else None)
 def hook_module(route):
  response=route.fetch()
  route.fulfill(response=response,body=response.text()+hook)
 page.route('**/app.js*',hook_module)
 page.goto(base+'/?screen=tree',wait_until='domcontentloaded')
 page.wait_for_selector('html[data-raptor-ready=true]',timeout=180000)
 page.locator('[data-tree-nation=ru]').click()
 page.locator('[data-tree-aircraft=ru-mig23-mld]').click()
 assert page.locator('#tree-choose').is_enabled(),'MiG-23MLD not unlocked in tech tree'
 page.locator('#tree-choose').click()
 page.wait_for_function('__mig23QA.sim.get_aircraft_type()===16 && __mig23QA.aircraft?.definition?.id===16',timeout=120000)
 assert page.evaluate("document.getElementById('hangar-aircraft-role').textContent")=='가변익 요격 전투기','MiG23 performance metadata missing'
 assert 'janes.migavia.com' in page.evaluate("document.getElementById('performance-source').href")
 assert page.evaluate('__mig23QA.wing.mode')=='AUTO'
 page.evaluate('document.getElementById("wing-sweep").click()')
 assert page.evaluate('__mig23QA.wing.mode')=='MANUAL'
 assert page.evaluate('__mig23QA.wing.target')==16
 page.evaluate('__mig23QA.wing.automatic()')
 assert page.evaluate('__mig23QA.wing.mode')=='AUTO'
 page.wait_for_function('__mig23QA.aircraft.sourceLoaded || __mig23QA.aircraft.sourceFailed',timeout=120000)
 assert page.evaluate('__mig23QA.aircraft.sourceLoaded'),'Original licensed GLB did not render'
 page.screenshot(path=str(out/'mig23-hangar-desktop.png'))
 # The choose callback can rebuild the tree detail; the preparation action
 # is optional, whereas the Hangar -> Sortie route is always exposed.
 if page.locator('#tree-prepare').is_visible():
  page.locator('#tree-prepare').click()
 else:
  page.locator('#tree-back').click()
  page.locator('#hangar-open').click()
  page.locator('#hangar-sortie-start').click()
 page.locator('#launch').click()
 page.wait_for_function('__mig23QA.started',timeout=120000)
 page.wait_for_function('__mig23QA.readState()[32]>.2',timeout=120000)
 page.locator('#throttle').fill('120')
 page.locator('#throttle').dispatch_event('input')
 page.wait_for_function('__mig23QA.readState()[42]>1.01',timeout=120000)
 page.wait_for_function('__mig23QA.readState()[62]>.03',timeout=120000)
 s=page.evaluate('Array.from(__mig23QA.readState())')
 assert all(x is not None and abs(x)<1e15 for x in s[:63]),'nonfinite or exploding flight state'
 page.screenshot(path=str(out/'mig23-flight-ab.png'))
 (out/'mig23-runway-gear.png').write_bytes(base64.b64decode(
  page.evaluate('__mig23QA.capture([24,3,8])')))
 gear=page.evaluate('''()=>{
  const {aircraft:a,sim}=__mig23QA;
  const contact=new Float64Array(sim.memory.buffer,sim.get_aircraft_gear_contacts(),9);
  const group=a.group;
  group.updateWorldMatrix(true,true);
  const inverse=group.matrixWorld.clone().invert();
  const minY=name=>{
   let bottom=Infinity;
   group.getObjectByName(name).traverse(mesh=>{
    const p=mesh.geometry?.getAttribute('position');
    if(!p)return;
    const transform=inverse.clone().multiply(mesh.matrixWorld), v=group.position.clone();
    for(let i=0;i<p.count;i++)
     bottom=Math.min(bottom,v.fromBufferAttribute(p,i).applyMatrix4(transform).y);
   });
   return bottom;
  };
  return {native:[contact[1],contact[4],contact[7]],visible:['OBJ0041','OBJ0109','OBJ0131'].map(minY)};
 }''')
 assert abs(gear['visible'][0]-gear['native'][0])<.06,gear
 assert all(abs(gear['visible'][i]-gear['native'][i])<.002 for i in (1,2)),gear
 print('MI23_GROUND_CONTACT',json.dumps(gear),flush=True)
 fin='__mig23QA.aircraft.group.getObjectByName("MiG-23MLD ventral fin hinge")'
 assert page.evaluate(f'{fin}.quaternion.w')>.999,'Ventral fin must fold with gear extended'
 # Use the real renderer with logarithmic depth and an unobstructed aft camera.
 # Toggling only the plume must change rendered pixels at native afterburner.
 page.evaluate('__mig23QA.sim.reset_spawn(2)')
 page.wait_for_function('__mig23QA.readState()[1]>1000 && __mig23QA.readState()[62]>.65 && __mig23QA.aircraft.group.getObjectByName("R-35-300 exhaust visual").visible',timeout=120000)
 plume_render=page.evaluate('__mig23QA.capture([8,2,24],true)')
 assert plume_render['visiblePixels'],'Afterburner is active but missing from the game framebuffer'
 (out/'mig23-airborne-plume.png').write_bytes(base64.b64decode(plume_render['png']))

 # Drive the normal gear control while airborne and compare the real game.
 page.wait_for_function('__mig23QA.readState()[21]>.99')
 capture_fin='__mig23QA.capture([20,-5,11])'
 (out/'mig23-fin-folded.png').write_bytes(base64.b64decode(page.evaluate(capture_fin)))
 page.evaluate('document.getElementById("gear").click()')
 page.wait_for_function('__mig23QA.readState()[21]>.15 && __mig23QA.readState()[21]<.85')
 intermediate=page.evaluate(f'({{travel:__mig23QA.readState()[21],w:{fin}.quaternion.w}})')
 assert abs(intermediate['w']-math.cos(math.pi/4*(1-intermediate['travel'])))<.04,intermediate
 page.wait_for_function('__mig23QA.readState()[21]<.005')
 assert abs(page.evaluate(f'{fin}.quaternion.w')-math.sqrt(.5))<.004,'Ventral fin must deploy with gear stowed'
 (out/'mig23-fin-deployed.png').write_bytes(base64.b64decode(page.evaluate(capture_fin)))
 print('MI23_VENTRAL_FIN',json.dumps(intermediate),flush=True)

 # Exercise the rendered exhaust with native part indices and typed health buffers.
 exhaust=page.evaluate("""()=>{
  const a=__mig23QA.aircraft;
  const plume=a.group.getObjectByName('R-35-300 exhaust visual');
  const petals=a.group.getObjectByName('soplo').children.find(mesh=>mesh.isMesh);
  const health=new Float32Array(30).fill(1), enabled=new Float32Array(30).fill(1);
  const sample=afterburner=>{
   a.update({afterburner,engine:1,health,enabled});
   return [plume.visible,petals.morphTargetInfluences[0]];
  };
  const dry=sample(0), wet=sample(1);
  enabled[7]=0;
  const engineOff=sample(1);
  enabled[7]=1;
  health[22]=0;
  const nozzleLost=sample(1);
  return {position:plume.position.toArray(),dry,wet,engineOff,nozzleLost};
 }""")
 assert abs(exhaust['position'][1]-.011)<.005,exhaust
 assert abs(exhaust['position'][2]-7.7548)<.005,exhaust
 assert exhaust['wet']==[True,0],exhaust
 assert all(exhaust[state]==[False,1] for state in ('dry','engineOff','nozzleLost')),exhaust

 if errors: print('MI23_DIAGNOSTIC_ERRORS',json.dumps(errors,ensure_ascii=False),flush=True)
 assert not errors,errors
 ctx.close()
 # Mobile selector and shader smoke: no forced full GLB loading on the
 # second device to avoid needless GPU texture duplication in SwiftShader.
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,reduced_motion='reduce')
 # The flight smoke uses an anonymous session and has no account dependency.
 ctx.route("**/api/account/session",lambda route:route.fulfill(json={"user":None}))
 mobile=ctx.new_page()
 mobile.route('**/app.js*',hook_module)
 mobile.on('pageerror',lambda e:errors.append('MOBILE PAGE ERROR: '+(e.stack or str(e))))
 mobile.goto(base+'/?screen=tree',wait_until='domcontentloaded')
 mobile.wait_for_selector('html[data-raptor-ready=true]',timeout=180000)
 mobile.locator('[data-tree-nation=ru]').tap()
 mobile.locator('[data-tree-aircraft=ru-mig23-mld]').tap()
 assert mobile.locator('#tree-choose').is_enabled()
 assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'),'mobile horizontal overflow'
 mobile.screenshot(path=str(out/'mig23-mobile.png'))
 assert not errors,errors
 ctx.close();browser.close()
 print(json.dumps({'result':'PASS','nativeType':16,'realGLB':True,'autoManualSweep':True,'afterburner':True,'mobileSelection':True,'pageErrors':errors}),flush=True)
