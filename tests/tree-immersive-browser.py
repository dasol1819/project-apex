"""Browser-level layout regression for nation-only, full-height Project Apex tree."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright

base=os.getenv('APEX_TEST_URL','http://127.0.0.1:8770').rstrip('/')
captures=Path('/tmp/aircraft-tree-immersive')
captures.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 results=[]
 for label,size,mobile in [
  ('desktop',{'width':1366,'height':900},False),
  ('mobile',{'width':390,'height':844},True),
  ('landscape',{'width':844,'height':390},True)
 ]:
  context=browser.new_context(viewport=size,is_mobile=mobile,has_touch=mobile,device_scale_factor=1,reduced_motion='reduce')
  page=context.new_page();page.set_default_timeout(120000)
  errors=[]
  page.on('pageerror',lambda e:errors.append(e.stack or str(e)))
  page.goto(base+'/?screen=tree',wait_until='domcontentloaded')
  page.wait_for_selector('html[data-raptor-ready=true]',timeout=180000)
  page.wait_for_function("document.body.dataset.menuStage==='tree'",timeout=60000)
  page.wait_for_selector('#tree-board [data-tree-aircraft]')
  metric=page.evaluate("""() => {
    const r=id=>{const a=document.querySelector(id),box=a.getBoundingClientRect();return {x:box.x,y:box.y,w:box.width,h:box.height,hidden:getComputedStyle(a).display==='none'}};
    return {screen:r('#aircraft-tree-screen'),board:r('#tree-board-viewport'),nations:r('#tree-nations'),
      search:r('.tree-filters'),branches:r('.tree-branch-bar'),status:r('.tree-info-row'),
      toolbar:r('.tree-footer'),current:r('.tree-current'),
      pageWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,
      zoom:document.querySelector('#tree-zoom-value').textContent,
      rendered:document.querySelectorAll('#tree-board [data-tree-aircraft]').length};
  }""")
  print('TREE_LAYOUT',label,json.dumps(metric,ensure_ascii=False),flush=True)
  assert abs(metric['screen']['x'])<12 and metric['screen']['w']>=size['width']-14, 'tree not fullscreen'
  assert metric['screen']['h']>=size['height']*.96,'tree not full viewport height'
  assert metric['board']['h']>=size['height']*.68,'usable tree height too small'
  for item in ['search','branches','status','toolbar','current']:
   assert metric[item]['hidden'],'old UI still visible: '+item
  assert metric['rendered']>45,'filtered tree or missing aircraft'
  assert int(metric['zoom'].replace('%',''))>=90,'cards remain too tiny'
  assert metric['pageWidth']<=metric['viewportWidth']+3,'page horizontal overflow'
  page.screenshot(path=str(captures/('tree-'+label+'-usa.png')))
  ru=page.locator('[data-tree-nation=ru]');ru.click()
  assert ru.get_attribute('aria-selected')=='true'
  assert page.locator('#tree-board [data-tree-aircraft]').count()>35
  page.screenshot(path=str(captures/('tree-'+label+'-russia.png')))
  # Long rows must be freely pannable without scrolling the whole document.
  box=page.locator('#tree-board-viewport')
  width=box.evaluate('(el)=>({visible:el.clientWidth,content:el.scrollWidth})')
  assert width['content']>width['visible']*1.3,'tech tree missing horizontal lanes'
  box.evaluate('(el)=>{el.scrollLeft=el.scrollWidth;}')
  assert box.evaluate('(el)=>el.scrollLeft')>0
  page.locator('#tree-board [data-tree-aircraft]').first.click()
  assert page.locator('#tree-detail').is_visible(),'tree detail panel broken'
  page.locator('#tree-detail-close').click()
  assert page.locator('#tree-detail').is_hidden(),'tree detail does not close'
  assert not errors,errors
  results.append({'device':label,'size':size,'treeHeight':round(metric['board']['h']),
                  'screenHeight':round(metric['screen']['h']),'zoom':metric['zoom'],
                  'renderedUSA':metric['rendered'],'horizontalScroll':width})
  context.close()
 browser.close()
 print(json.dumps({'result':'PASS','nationOnly':True,'devices':results},ensure_ascii=False),flush=True)
