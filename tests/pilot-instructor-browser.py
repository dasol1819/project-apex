"""Exercise the actual app input -> native controller path in Chromium.
Test-only hooks are appended to the module response, never shipped."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/pilot-instructor-browser'));out.mkdir(parents=True,exist_ok=True)
hook='''
window.__pilotQA={get sim(){return sim},get authority(){return pilotAuthority},get axes(){return pilotAxes},get maneuver(){return maneuverStick},get target(){return aimCursor.direction.toArray()},get started(){return started},get paused(){return paused},
 state:()=>Array.from(readState()),aim:()=>Array.from(new Float64Array(sim.memory.buffer,sim.get_aim_state(),16)),setControlMode,movePilotAim,
 prepare(level=false){sim.reset_spawn(1);sim.debug_set_state(0,4500,0,0,0,-220,0,0,0,1);sim.set_invincible(1);gearTarget=0;throttle=.75;resetPilotAuthority();aimCursor.reset(new T.Quaternion());aimCursor.direction.set(level?0:.25,level?0:.18,-1).normalize();sim.set_aim_direction(...aimCursor.direction,1);},
 alignment(){const f=new T.Vector3(0,0,-1).applyQuaternion(new T.Quaternion(...readState().slice(6,10)));return f.dot(aimCursor.direction);}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 errors=[]
 def open_flight(context):
  context.route('**/api/account/session',lambda route:route.fulfill(json={'user':None}))
  page=context.new_page();page.set_default_timeout(120000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route_module(route):
   response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
  page.route('**/app.js*',route_module)
  page.goto(base+'/?screen=tree&aircraft=0',wait_until='domcontentloaded')
  page.wait_for_selector('html[data-raptor-ready=true]',timeout=180000)
  page.locator('[data-tree-nation=us]').click()
  page.locator('[data-tree-aircraft=us-f22-game]').click()
  page.locator('#tree-prepare').click()
  page.locator('[data-brief-tab=battle]').click()
  page.locator('#ally-count').select_option('0');page.locator('#enemy-count').select_option('0')
  page.locator('#launch').click();page.wait_for_function('__pilotQA.started')
  page.evaluate('__pilotQA.prepare()');page.locator('#scene').focus()
  return page
 ctx=browser.new_context(viewport={'width':1366,'height':900},reduced_motion='reduce')
 page=open_flight(ctx)
 page.wait_for_function('__pilotQA.sim.get_instructor_response()===1')
 page.keyboard.down('d')
 page.wait_for_function('__pilotQA.authority.axisMask===2 && __pilotQA.aim()[9]===1 && __pilotQA.sim.get_pilot_override()===1')
 assert page.evaluate('__pilotQA.sim.get_pilot_g_command()')==0
 assert page.evaluate('Math.abs(__pilotQA.aim()[5])+Math.abs(__pilotQA.aim()[7])')<1e-9,'old aim target must not fight a separate manual correction'
 page.keyboard.down('a')
 page.wait_for_function('__pilotQA.authority.axisMask===2 && __pilotQA.aim()[9]===0')
 page.keyboard.up('a');page.keyboard.up('d')
 page.wait_for_function('__pilotQA.authority.axisMask===0 && __pilotQA.sim.get_pilot_override()===0')
 assert page.evaluate('__pilotQA.alignment()')>.99,'release must not return to an old mouse destination'
 # A simultaneous mouse target must survive manual release.
 page.keyboard.down('d');page.wait_for_function('__pilotQA.authority.axisMask===2')
 page.evaluate('__pilotQA.movePilotAim(55,-20)')
 assert page.evaluate('__pilotQA.alignment()')>.985,'pointer re-entry must start at the nose followed by the camera'
 page.wait_for_function('__pilotQA.sim.get_pilot_override()===0 && __pilotQA.sim.get_pilot_axis_override()===2')
 target=page.evaluate('__pilotQA.target')
 page.keyboard.up('d');page.wait_for_function('__pilotQA.authority.axisMask===0')
 after=page.evaluate('__pilotQA.target')
 assert sum((x-y)**2 for x,y in zip(target,after))<1e-12
 # Earlier mouse movement must not mark every later manual correction as a
 # simultaneous pointer gesture. This ordinary sortie has no mission director.
 page.wait_for_function('!__pilotQA.authority.pointerIntent')
 page.keyboard.down('d');page.wait_for_function('__pilotQA.authority.axisMask===2')
 page.keyboard.up('d');page.wait_for_function('__pilotQA.authority.axisMask===0')
 assert page.evaluate('__pilotQA.alignment()')>.99,'old pointer intent must not resurrect a stale destination'
 # Native response tuning must disengage in direct mode and re-engage when
 # the player returns to direction aim; it must never latch manual input.
 page.evaluate('__pilotQA.setControlMode("manual")')
 page.wait_for_function('__pilotQA.sim.get_instructor_response()===0')
 page.evaluate('__pilotQA.setControlMode("aim")')
 page.wait_for_function('__pilotQA.sim.get_instructor_response()===1')
 page.keyboard.press('F2')
 page.wait_for_selector('#settings-dialog[open]')
 for name,value in [('stick-deadzone','12'),('stick-curve','20'),('stick-response','70')]:
  page.locator('#'+name).fill(value);page.locator('#'+name).dispatch_event('input')
 page.locator('#aim-handoff').select_option('target')
 assert page.evaluate('__pilotQA.axes.settings')=={'deadZone':.12,'nonlinearity':2,'response':.7,'handoff':'target'}
 assert page.evaluate('JSON.parse(localStorage.getItem("raptor.axes.v1")).handoff')=='target'
 page.screenshot(path=str(out/'desktop-control-settings.png'))
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 ctx.close()
 # Real touch events use the production pointer capture/stick path.
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,reduced_motion='reduce')
 page=open_flight(ctx);page.evaluate('__pilotQA.prepare(true)');box=page.locator('#stick').bounding_box();assert box
 page.wait_for_function('__pilotQA.sim.get_instructor_response()===1')
 cdp=ctx.new_cdp_session(page)
 point={'x':box['x']+box['width']*.65,'y':box['y']+box['height']*.5}
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
 page.wait_for_function('__pilotQA.maneuver.active && __pilotQA.sim.get_pilot_g_command()===1')
 start=page.evaluate('__pilotQA.state()')
 page.wait_for_function('(start)=>__pilotQA.state()[32]>start+6',arg=start[32])
 after=page.evaluate('__pilotQA.state()')
 import math
 turn=math.atan2(math.sin(after[28]-start[28]),math.cos(after[28]-start[28]))*180/math.pi
 assert turn>12,turn
 assert 35<after[29]*180/math.pi<75,'one held touch should maintain a bank, not keep rolling'
 page.screenshot(path=str(out/'mobile-proportional-roll.png'))
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.wait_for_function('__pilotQA.authority.axisMask===0 && __pilotQA.sim.get_pilot_g_command()===0')
 assert page.evaluate('__pilotQA.alignment()')>.99
 # The same touch still sends proportional raw axes in explicit direct mode.
 page.evaluate('__pilotQA.setControlMode("manual");__pilotQA.prepare(true)')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]})
 page.wait_for_function('__pilotQA.authority.axisMask===2 && __pilotQA.aim()[9]>.1')
 expected=((.5-.08)/.92)**1.5
 assert abs(page.evaluate('__pilotQA.aim()[9]')-expected)<.03
 assert page.evaluate('__pilotQA.sim.get_pilot_g_command()')==0
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 ctx.close();browser.close()
 print(json.dumps({'result':'PASS','manualAuthority':True,'opposingKeys':True,'mouseAndKeyboard':True,'releaseHandoff':True,'settings':True,'mobileSustainedTurnDegrees':turn,'mobileDirectAxes':True,'pageErrors':errors}),flush=True)
