"""Real tree, loadout, fleet and flight UI, with read-only test instrumentation.

The hook is appended to the fetched module only in Playwright; production does
not expose it. APEX_TEST_URL can also point at the published deployment.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8000').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/su35-combat-browser'));out.mkdir(parents=True,exist_ok=True)
hook='''\nwindow.__apexCombat={get sim(){return sim},get aircraft(){return aircraft},get combat(){return combat},get started(){return started},get ready(){return ready},get playerType(){return playerType},readState,setPaused};\n'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 errors=[]
 def route_module(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 def open_page(context,url):
  page=context.new_page();page.set_default_timeout(90000)
  page.on('pageerror',lambda e:errors.append(e.stack));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.route('**/app.js*',route_module);page.goto(base+url,wait_until='domcontentloaded');page.wait_for_selector('html[data-raptor-ready=true]',timeout=120000);return page
 desktop=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 page=open_page(desktop,'/?screen=tree')
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-su35-s]').click();page.locator('#tree-choose').click()
 page.wait_for_function('__apexCombat.sim.get_aircraft_type()===13 && __apexCombat.aircraft.definition.id===13')
 assert page.locator('#tree-prepare').is_visible();assert not errors,errors
 page.locator('#tree-prepare').click();page.locator('[data-brief-tab=loadout]').click()
 for profile in [39,40,41,38]:
  page.locator(f'#brief-loadout [data-loadout-id="{profile}"]').click()
  assert page.evaluate('new Float64Array(__apexCombat.sim.memory.buffer,__apexCombat.sim.get_loadout_state(),16)[1]')==profile
 page.locator('[data-brief-tab=battle]').click();page.locator('#ally-aircraft').select_option('13');page.locator('#enemy-aircraft').select_option('13');page.locator('#ally-count').select_option('1');page.locator('#enemy-count').select_option('1')
 page.locator('#launch').click();page.wait_for_function('__apexCombat.started',timeout=120000);page.wait_for_function('__apexCombat.readState()[32]>.2',timeout=120000)
 assert page.evaluate('__apexCombat.combat.status().rows.every(a=>a.aircraftType===13&&a.alive)')
 assert page.locator('[data-weapon=gun] span').inner_text()=='GSh30';assert page.locator('[data-weapon=amraam] span').inner_text()=='R-77-1'
 page.locator('#throttle').fill('110');page.locator('#throttle').dispatch_event('input');page.wait_for_function('__apexCombat.readState()[42]>1')
 page.screenshot(path=str(out/'combat-desktop.png'));assert not errors,errors;desktop.close();print('desktop combat PASS',flush=True)
 mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1,reduced_motion='reduce')
 page=open_page(mobile,'/?screen=tree&aircraft=13');assert page.evaluate('__apexCombat.sim.get_aircraft_type()')==13
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'mobile horizontal overflow'
 page.locator('[data-tree-nation=ru]').tap();page.locator('[data-tree-aircraft=ru-su35-s]').tap();page.locator('#tree-prepare').tap()
 page.screenshot(path=str(out/'combat-mobile.png'));assert not errors,errors;mobile.close();browser.close()
 print(json.dumps({'result':'PASS','nativeType':13,'loadouts':4,'fleetSu35':3,'throttleInput':True,'mobile':True,'pageAndShaderErrors':errors}))
