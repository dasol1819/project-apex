"""MiG-23MLD real Chromium/WebGL game-flight smoke on the restored Pages build.
Instrumentation is injected by Playwright and never shipped to end users."""
import base64, json, math, os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-flight-browser'))
out.mkdir(parents=True,exist_ok=True)
hook='''\nwindow.__mig23QA={get sim(){return sim},get aircraft(){return aircraft},get wing(){return mig23Wing},get started(){return started},get ready(){return ready},readState,capture(offset, comparePlume=false, target=[0,0,0]){
 const group=aircraft.group;
 const testCamera=camera.clone();
 testCamera.position.copy(group.localToWorld(new T.Vector3(...offset)));
 testCamera.up.copy(new T.Vector3(0,1,0).applyQuaternion(group.quaternion));
 testCamera.lookAt(group.localToWorld(new T.Vector3(...target)));
 testCamera.fov=30;
 testCamera.updateProjectionMatrix();
 testCamera.updateMatrixWorld();
 renderer.render(scene,testCamera);
 const lit=renderer.domElement.toDataURL();
 if(!comparePlume)return lit.split(',')[1];
 if(comparePlume==='aircraft'){
  const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
  group.visible=false;
  renderer.render(scene,testCamera);
  const background=renderer.domElement.toDataURL();
  group.visible=true;
  return {png:lit.split(',')[1],background:background.split(',')[1],
   calls,triangles,aircraftCalls:calls-renderer.info.render.calls,
   aircraftTriangles:triangles-renderer.info.render.triangles};
 }
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
 capture_nose='__mig23QA.capture([3.5,-2.1,-6.9],false,[0,-.15,-3.55])'
 capture_main='__mig23QA.capture([4.9,-2.0,.7],false,[.5,-.55,1.9])'
 main_pose="""()=>{
  const group=__mig23QA.aircraft.group;
  return ['port','starboard'].map(side=>{
   const part=name=>group.getObjectByName('MiG-23MLD main gear '+side+' '+name);
   return {wheel:group.worldToLocal(part('wheel carrier').getWorldPosition(group.position.clone())).toArray(),
    lower:part('lower door').quaternion.w,upper:part('upper door').quaternion.w};
  });
 }"""
 main_down=page.evaluate(main_pose)
 assert all(abs(abs(p['wheel'][0])-.938)<.002 and p['lower']>.999 and p['upper']>.999 for p in main_down),main_down
 (out/'mig23-main-extended.png').write_bytes(base64.b64decode(page.evaluate(capture_main)))
 nose_pose="""()=>['nose strut hinge','nose door port','nose door starboard'].map(name=>
  __mig23QA.aircraft.group.getObjectByName('MiG-23MLD '+name).quaternion.w)"""
 assert min(page.evaluate(nose_pose))>.999
 (out/'mig23-nose-extended.png').write_bytes(base64.b64decode(page.evaluate(capture_nose)))
 (out/'mig23-fin-folded.png').write_bytes(base64.b64decode(page.evaluate(capture_fin)))
 page.evaluate('document.getElementById("gear").click()')
 page.wait_for_function('__mig23QA.readState()[21]>.30 && __mig23QA.readState()[21]<.68')
 intermediate=page.evaluate(f'({{travel:__mig23QA.readState()[21],w:{fin}.quaternion.w}})')
 assert abs(intermediate['w']-math.cos(math.pi/4*(1-intermediate['travel'])))<.04,intermediate
 mid=page.evaluate(nose_pose)
 assert mid[0]<.98 and min(mid[1:])>.999,mid
 main_mid=page.evaluate(main_pose)
 assert all(p['wheel'][1]>d['wheel'][1]+.03 and p['lower']>.999 and p['upper']>.999 for p,d in zip(main_mid,main_down)),main_mid
 (out/'mig23-main-moving.png').write_bytes(base64.b64decode(page.evaluate(capture_main)))
 (out/'mig23-nose-moving.png').write_bytes(base64.b64decode(page.evaluate(capture_nose)))
 page.wait_for_function('__mig23QA.readState()[21]<.005')
 assert abs(page.evaluate(f'{fin}.quaternion.w')-math.sqrt(.5))<.004,'Ventral fin must deploy with gear stowed'
 (out/'mig23-fin-deployed.png').write_bytes(base64.b64decode(page.evaluate(capture_fin)))
 print('MI23_VENTRAL_FIN',json.dumps(intermediate),flush=True)
 stowed=page.evaluate(nose_pose)
 assert abs(stowed[0]-math.cos(math.radians(46)))<.004,stowed
 assert all(abs(w-math.sqrt(.5))<.004 for w in stowed[1:]),stowed
 (out/'mig23-nose-stowed.png').write_bytes(base64.b64decode(page.evaluate(capture_nose)))
 main_up=page.evaluate(main_pose)
 assert all(p['wheel'][1]>d['wheel'][1]+.8 and abs(p['wheel'][0])<.65 for p,d in zip(main_up,main_down)),main_up
 assert all(abs(p['lower']-math.sqrt(.5))<.004 and abs(p['upper']-math.cos(math.pi/12))<.004 for p in main_up),main_up
 assert abs(main_up[0]['wheel'][0]+main_up[1]['wheel'][0])<.002,main_up
 (out/'mig23-main-stowed.png').write_bytes(base64.b64decode(page.evaluate(capture_main)))
 page.evaluate('document.getElementById("gear").click()')
 page.wait_for_function('__mig23QA.readState()[21]>.995')
 assert min(page.evaluate(nose_pose))>.999
 print('MI23_NOSE_GEAR',json.dumps({'moving':mid,'stowed':stowed}),flush=True)
 main_return=page.evaluate(main_pose)
 assert all(math.dist(p['wheel'],d['wheel'])<.002 and p['lower']>.999 and p['upper']>.999 for p,d in zip(main_return,main_down)),main_return
 print('MI23_MAIN_GEAR',json.dumps({'extended':main_down,'transit':main_mid,'stowed':main_up}),flush=True)

 # Native actuator outputs must move the original GLB tails, including
 # differential roll and the single rudder. Sample and render in one task so
 # the normal frame loop cannot replace the commanded state mid-capture.
 tail=page.evaluate("""()=>{
  const {sim,aircraft:a}=__mig23QA,group=a.group;
  const names=['stab2','stab','rudder'];
  const hinges=['port stabilator','starboard stabilator','rudder'].map(n=>group.getObjectByName('MiG-23MLD '+n));
  if(hinges.some(n=>!n))throw Error('Original tail control hinges missing');
  const probes=names.map(name=>{
   let result,max=-Infinity;
   group.updateWorldMatrix(true,true);
   group.getObjectByName(name).traverse(mesh=>{
    const p=mesh.geometry?.attributes.position;if(!p)return;
    for(let i=0;i<p.count;i++){
     const v=group.position.clone().fromBufferAttribute(p,i);
     group.worldToLocal(mesh.localToWorld(v));
     if(name!=='rudder'&&Math.abs(v.x)>.8)continue;
     if(v.z>max){max=v.z;result={mesh,index:i};}
    }
   });
   return result;
  });
  const positions=()=>{
   group.updateWorldMatrix(true,true);
   return probes.map(({mesh,index})=>group.worldToLocal(mesh.localToWorld(
    group.position.clone().fromBufferAttribute(mesh.geometry.attributes.position,index))).toArray());
  };
  const samples={};
  for(const [name,pitch,roll,yaw] of [['neutral',0,0,0],['pitch-up',.65,0,0],['pitch-down',-.65,0,0],
   ['roll-right',0,.65,0],['yaw-right',0,0,.65],['yaw-left',0,0,-.65]]){
   sim.reset_spawn(2);sim.debug_set_state(0,5000,0,0,0,-235,0,0,0,1);
   sim.set_controls(pitch,roll,yaw,.7,0,0,0,0);
   for(let i=0;i<120;i++)sim.step(1/120);
   const s=__mig23QA.readState();
   group.position.set(s[0],s[1],s[2]);group.quaternion.set(s[6],s[7],s[8],s[9]);
   a.update({leftTail:s[49],rightTail:s[50],leftRudder:s[55],gear:0,wingSweep:72,afterburner:0});
   samples[name]={native:[s[49],s[50],s[55]],positions:positions(),
    png:__mig23QA.capture([8,3.5,16],false,[0,.7,6.6])};
  }
  const enabled=new Float32Array(30).fill(1);enabled[3]=enabled[4]=enabled[20]=0;
  const before=hinges.map(n=>n.quaternion.toArray());
  a.update({leftTail:.5,rightTail:.5,leftRudder:.5,enabled});
  const frozen=hinges.every((n,i)=>n.quaternion.toArray().every((v,k)=>v===before[i][k]));
  a.update({leftTail:0,rightTail:0,leftRudder:0,enabled:new Float32Array(30).fill(1)});
  const overlay=__mig23QA.capture([23,-4,4.4],'aircraft',[0,.95,0]);
  return {samples,frozen,overlay};
 }""")
 for name,sample in tail['samples'].items():
  (out/('mig23-tail-'+name+'.png')).write_bytes(base64.b64decode(sample.pop('png')))
 for key in ('png','background'):
  (out/('mig23-tail-overlay-'+key+'.png')).write_bytes(base64.b64decode(tail['overlay'].pop(key)))
 print('MI23_TAIL_CONTROLS',json.dumps(tail),flush=True)
 assert tail['frozen'],'Disabled native control parts must retain their last pose'
 neutral=tail['samples']['neutral']['positions']
 for i in (0,1):
  assert tail['samples']['pitch-up']['positions'][i][1]>neutral[i][1]+.1,tail['samples']['pitch-up']['native']
  assert tail['samples']['pitch-down']['positions'][i][1]<neutral[i][1]-.1
 roll=tail['samples']['roll-right']['positions']
 assert roll[0][1]<neutral[0][1]-.02 and roll[1][1]>neutral[1][1]+.02,roll
 assert tail['samples']['yaw-right']['positions'][2][0]>neutral[2][0]+.07
 assert tail['samples']['yaw-left']['positions'][2][0]<neutral[2][0]-.07

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
