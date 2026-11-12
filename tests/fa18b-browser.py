"""Real F/A-18B browser smoke: loading, selected slot, hidden fallback and native weapons."""
import os,json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
url=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8779').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/fa18b-browser'))
out.mkdir(parents=True,exist_ok=True)
hook="""
window.__fa18QA={
  choose: chooseAircraft,
  get aircraft(){return aircraft;},
  get sim(){return sim;},
  get ready(){return ready;}
};
"""
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for label,viewport,mobile in [('desktop',{'width':1366,'height':900},False),('mobile',{'width':390,'height':844},True)]:
  ctx=browser.new_context(viewport=viewport,is_mobile=mobile,has_touch=mobile,device_scale_factor=1,reduced_motion='reduce')
  ctx.route('**/api/account/session',lambda route:route.fulfill(json={'user':None}))
  page=ctx.new_page();page.set_default_timeout(120000)
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def patch(route):
   response=route.fetch()
   route.fulfill(response=response,body=response.text()+hook)
  page.route('**/app.js*',patch)
  page.goto(url+'/?screen=tree',wait_until='domcontentloaded')
  page.wait_for_selector('html[data-raptor-ready=true]',timeout=180000)
  ok=page.evaluate('__fa18QA.choose(12)')
  assert ok,'F/A-18B slot 12 could not be selected'
  page.wait_for_function('__fa18QA.aircraft.sourceLoaded || __fa18QA.aircraft.sourceFailed',timeout=150000)
  state=page.evaluate("""()=>{
   const a=__fa18QA.aircraft,g=a.group,source=g.getObjectByName('F/A-18B authored exterior');
   let modelMeshes=0,visibleModelMeshes=0,storeCount=0,visibleStoreCount=0,visibleFallback=0;
   source?.traverse(n=>{if(n.isMesh){modelMeshes++;if(n.visible)visibleModelMeshes++;}});
   g.traverse(n=>{if(n.userData?.weaponStore){storeCount++;if(n.visible)visibleStoreCount++;}});
   return {loaded:a.sourceLoaded,failed:a.sourceFailed,selected:__fa18QA.sim.get_aircraft_type(),
    name:a.definition?.name,modelMeshes,visibleModelMeshes,storeCount,visibleStoreCount,sourceFound:!!source};
  }""")
  assert state['loaded'] and not state['failed'],state
  assert state['selected']==12 and state['name']=='F/A-18B',state
  assert state['sourceFound'] and state['visibleModelMeshes']>=35,state
  assert state['storeCount']>0 and state['visibleStoreCount']>0,'Source model should preserve native-equipped weapons: '+str(state)
  assert not errors,errors
  page.screenshot(path=str(out/('fa18b-'+label+'.png')))
  print('FA18B_BROWSER',json.dumps({'device':label,**state},ensure_ascii=False),flush=True)
  ctx.close()
 browser.close()
