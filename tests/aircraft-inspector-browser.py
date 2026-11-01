"""Real tree, loadout, fleet and flight UI, with read-only test instrumentation.

The hook is appended to the fetched module only in Playwright; production does
not expose it. APEX_TEST_URL can also point at the published deployment.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8000').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/aircraft-inspector-browser'));out.mkdir(parents=True,exist_ok=True)
hook='''\nwindow.__apexCombat={get sim(){return sim},get aircraft(){return aircraft},get combat(){return combat},get started(){return started},get ready(){return ready},get playerType(){return playerType},readState,setPaused,get inspector(){return aircraftInspector}};\n'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 errors=[]
 def route_module(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 def open_page(context,url):
  page=context.new_page();page.set_default_timeout(90000)
  page.on('pageerror',lambda e:(errors.append(e.stack),print(e.stack,flush=True)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.route('**/app.js*',route_module);page.goto(base+url,wait_until='domcontentloaded');page.wait_for_selector('html[data-raptor-ready=true]',timeout=120000);return page
 desktop=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 page=open_page(desktop,'/?screen=tree&aircraft=13')
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-su35-s]').click();page.locator('#tree-inspect-model').click()
 page.wait_for_selector('#aircraft-inspector[data-ready=true]',timeout=120000)
 assert page.evaluate('__apexCombat.inspector.active');assert 'Su-35S' in page.locator('#inspector-title').inner_text()
 assert '?screen=tree' in page.url
 for view in ['front','top','bottom','rear','intake','nozzle','cockpit','overview']:
  page.locator(f'[data-inspector-view={view}]').click();assert page.evaluate('__apexCombat.inspector.state.view')==view
  if view=='bottom':assert page.evaluate('__apexCombat.inspector.state.elevation') < -1.5
 page.locator('[data-inspector-view=intake]').click();page.screenshot(path=str(out/'inspector-intake.png'))
 page.locator('#inspector-canopy').check();page.locator('#inspector-gear').uncheck();page.locator('#inspector-vector').fill('15');page.locator('#inspector-vector').dispatch_event('input')
 assert page.locator('#inspector-vector-value').inner_text()=='15°'
 canvas=page.locator('#inspector-canvas');canvas.focus();before=page.evaluate('__apexCombat.inspector.state.radius');page.keyboard.press('+');assert page.evaluate('__apexCombat.inspector.state.radius')<before
 page.keyboard.press('Home');
 with page.expect_download() as download:page.locator('#inspector-save').click()
 export=out/'aircraft-view.png';download.value.save_as(export);assert export.read_bytes().startswith(b'\x89PNG') and export.stat().st_size>10000
 page.screenshot(path=str(out/'inspector-desktop.png'))
 page.locator('#inspector-close').click();assert not page.evaluate('__apexCombat.inspector.active');assert page.locator('#tree-inspect-model').evaluate('(el)=>el===document.activeElement')
 # Inspect another aircraft without changing the selected combat aircraft.
 page.locator('[data-tree-aircraft=ru-mig29-912]').click();page.locator('#tree-inspect-model').click();page.wait_for_selector('#aircraft-inspector[data-ready=true]');assert page.evaluate('__apexCombat.inspector.state.type')==14;assert page.evaluate('__apexCombat.sim.get_aircraft_type()')==13
 assert page.locator('#inspector-fod-row').is_visible();assert page.locator('#inspector-vector-row').is_hidden();page.keyboard.press('Escape');assert not page.evaluate('__apexCombat.inspector.active')
 # The generic viewer also supports the original flight models.
 for aircraft_type in [0,8,9]:
  page.evaluate('(type)=>__apexCombat.inspector.open(type)',aircraft_type);page.wait_for_selector('#aircraft-inspector[data-ready=true]');page.locator('[data-inspector-view=bottom]').click();assert page.evaluate('__apexCombat.inspector.state.elevation') < -1.5;page.locator('#inspector-close').click()
 # Open from the hangar, then inspect a paused sortie and return to the same state.
 page.locator('#tree-back').click();page.locator('#hangar-open').click();page.locator('#hangar-inspect').click();page.wait_for_selector('#aircraft-inspector[data-ready=true]');page.locator('#inspector-close').click();assert page.locator('#hangar-screen').is_visible();page.locator('#hangar-sortie-start').click();page.locator('#launch').click();page.wait_for_function('__apexCombat.started');page.evaluate('__apexCombat.setPaused(true)');page.locator('#pause-inspect').click();page.wait_for_selector('#aircraft-inspector[data-ready=true]');state=page.evaluate('Array.from(__apexCombat.readState())');page.wait_for_timeout(250);assert page.evaluate('Array.from(__apexCombat.readState())')==state
 page.locator('#inspector-close').click();assert page.locator('#paused').is_visible();assert page.evaluate('__apexCombat.sim.get_aircraft_type()')==13
 assert not errors,errors;desktop.close();print('desktop inspector PASS',flush=True)
 mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,reduced_motion='reduce');page=open_page(mobile,'/?screen=tree&aircraft=13');page.locator('[data-tree-nation=ru]').tap();page.locator('[data-tree-aircraft=ru-su35-s]').tap();page.locator('#tree-inspect-model').tap();page.wait_for_selector('#aircraft-inspector[data-ready=true]',timeout=120000)
 assert page.evaluate('document.getElementById("aircraft-inspector").scrollWidth <= innerWidth'),'inspector mobile overflow'
 page.locator('[data-inspector-view=bottom]').tap();assert page.evaluate('__apexCombat.inspector.state.elevation') < -1.5
 canvas=page.locator('#inspector-canvas');box=canvas.bounding_box();cdp=mobile.new_cdp_session(page);x=box['x']+box['width']/2;y=box['y']+box['height']/2;before=page.evaluate('__apexCombat.inspector.state.radius');cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x-30,'y':y},{'id':2,'x':x+30,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'id':1,'x':x-60,'y':y+12},{'id':2,'x':x+60,'y':y+12}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});assert page.evaluate('__apexCombat.inspector.state.radius')<before;assert page.evaluate('__apexCombat.inspector.state.pan.some(v=>Math.abs(v)>.01)');page.screenshot(path=str(out/'inspector-mobile.png'));page.locator('#inspector-close').tap();assert not page.evaluate('__apexCombat.inspector.active');assert not errors,errors;mobile.close();browser.close();print(json.dumps({'result':'PASS','desktop':True,'mobile':True,'views':8,'inGame':True,'pausedStatePreserved':True,'pageAndShaderErrors':errors}))
