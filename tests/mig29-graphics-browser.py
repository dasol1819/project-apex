"""Render the MiG close-ups and the actual in-game inspector on desktop/mobile."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8000').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig29-graphics'));out.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 def watch(page):
  page.set_default_timeout(120000)
  page.on('response',lambda r:errors.append(str(r.status)+': '+r.url) if r.status>=400 else None)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 desktop=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 page=desktop.new_page();watch(page);page.goto(base+'/mig29.html',wait_until='domcontentloaded');page.wait_for_selector('html[data-mig29-ready=true]')
 for view in ['overview','top','bottom','intake','nozzle','cockpit']:
  page.locator(f'[data-view={view}]').click()
  if view=='intake':
   page.locator('#ramp').fill('0');page.locator('#ramp').dispatch_event('input');page.wait_for_function('mig29Studio.pose.fod===0')
  if view=='cockpit':
   page.locator('#canopy').check();page.wait_for_function('mig29Studio.pose.canopy>.9')
  # Ensure the requested pose has actually reached the renderer before capture.
  page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  page.screenshot(path=str(out/(view+'.png')))
  print('rendered',view,flush=True)
 # Close-up framing legitimately culls most of the aircraft.
 assert page.evaluate('mig29Studio.renderer.info.render.triangles')>1000
 assert not errors,errors
 page.close()
 for mobile in [False,True]:
  context=browser.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1000},is_mobile=mobile,has_touch=mobile,reduced_motion='reduce')
  page=context.new_page();watch(page);page.goto(base+'/?screen=tree&aircraft=14',wait_until='domcontentloaded');page.wait_for_selector('html[data-raptor-ready=true]')
  page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig29-912]').click();page.locator('#tree-inspect-model').click();page.wait_for_selector('#aircraft-inspector[data-ready=true]')
  assert 'MiG-29' in page.locator('#inspector-title').inner_text()
  for view in ['intake','nozzle','cockpit','bottom','overview']:
   page.locator(f'[data-inspector-view={view}]').click()
   if view=='cockpit':page.locator('#inspector-canopy').check()
   page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
   page.screenshot(path=str(out/('ingame-'+('mobile' if mobile else 'desktop')+'-'+view+'.png')))
  assert page.locator('#aircraft-inspector').evaluate('(e)=>e.scrollWidth<=innerWidth')
  page.locator('#inspector-close').click();assert not errors,errors
  context.close();print('in-game', 'mobile' if mobile else 'desktop','PASS',flush=True)
 desktop.close();browser.close()
print(json.dumps({'result':'PASS','studioCloseUps':6,'inGameDesktopAndMobile':True,'pageAndShaderErrors':errors}))
