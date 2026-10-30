"""Exercise the independent Su-35 flight test through real browser controls."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8000').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/su35-flight-browser'));out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 errors=[]
 def watch(page):
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto(base+'/su35-flight.html?v=4',wait_until='domcontentloaded');page.wait_for_selector('html[data-su35-flight-ready=true]',timeout=90000)
 context=b.new_context(viewport={'width':1440,'height':1000});page=context.new_page();watch(page)
 assert page.evaluate('su35FlightTest.paused')
 page.locator('#flight-toggle').click();page.wait_for_function('su35FlightTest.flight.time > .5',timeout=60000)
 before=page.evaluate('su35FlightTest.flight.telemetry.alpha')
 page.keyboard.down('ArrowUp');page.wait_for_function('su35FlightTest.flight.controls.pitch === 1');page.wait_for_function('(a)=>su35FlightTest.flight.telemetry.alpha > a+.015',arg=before,timeout=60000);page.keyboard.up('ArrowUp')
 page.wait_for_function('su35FlightTest.flight.controls.pitch === 0')
 assert page.evaluate('su35FlightTest.camera.position.distanceTo(su35FlightTest.flight.position)')<45,'camera follows translation without falling behind'
 page.locator('#flight-throttle').fill('100');page.locator('#flight-gear').check();page.locator('#flight-tvc').uncheck()
 page.wait_for_function('su35FlightTest.flight.controls.throttle === 1 && su35FlightTest.flight.gear > .01 && !su35FlightTest.flight.controls.tvc')
 page.locator('#flight-toggle').click();time=page.evaluate('su35FlightTest.flight.time');page.wait_for_timeout(800);assert page.evaluate('su35FlightTest.flight.time')==time,'pause freezes physics'
 page.screenshot(path=str(out/'flight-desktop.png'))
 page.locator('#flight-reset').click();assert page.evaluate('su35FlightTest.flight.time')==0;assert page.evaluate('su35FlightTest.flight.fuel')==6000
 assert not errors,errors;context.close();print('desktop PASS',flush=True)
 mobile=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 page=mobile.new_page();watch(page);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'mobile overflow'
 page.locator('#flight-toggle').tap();page.locator('[data-control="roll:1"]').scroll_into_view_if_needed();box=page.locator('[data-control="roll:1"]').bounding_box()
 cdp=mobile.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}]})
 page.wait_for_function('su35FlightTest.flight.controls.roll === 1',timeout=60000)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_function('su35FlightTest.flight.controls.roll === 0',timeout=60000)
 page.locator('#flight-toggle').tap();page.locator('#flight-canvas').scroll_into_view_if_needed();page.screenshot(path=str(out/'flight-mobile.png'),full_page=True)
 assert not errors,errors;mobile.close();b.close()
 print(json.dumps({'result':'PASS','keyboardPitch':True,'throttleGearTvc':True,'pauseAndReset':True,'cameraTracking':True,'mobileTouchRoll':True,'mobileWidth':390,'pageAndShaderErrors':errors}))
