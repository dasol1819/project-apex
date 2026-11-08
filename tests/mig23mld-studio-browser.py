"""Real MiG-23MLD GLB viewer regression under the shipped compact Three.js bundle.
This catches constructor/export failures which JS syntax tests cannot detect."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8766').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-studio-browser'))
out.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=[
        '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
        '--enable-unsafe-swiftshader'])
    outcomes=[]
    for label,viewport,mobile in [
        ('desktop',{'width':1366,'height':900},False),
        ('mobile',{'width':390,'height':844},True),
    ]:
        context=browser.new_context(
            viewport=viewport,is_mobile=mobile,has_touch=mobile,
            device_scale_factor=1,reduced_motion='reduce')
        page=context.new_page()
        page.set_default_timeout(120000)
        errors=[]
        page.on('pageerror',lambda e:errors.append(e.stack or str(e)))
        page.on('console',lambda m:errors.append('CONSOLE '+m.text) if m.type=='error' else None)
        page.goto(base+'/mig23mld.html',wait_until='domcontentloaded')
        page.wait_for_function("""() => {
            const status=document.getElementById('status');
            const metrics=document.getElementById('metrics');
            if(status?.dataset.error==='true')throw Error(status.textContent);
            return status?.textContent.includes('로딩 완료') && metrics?.textContent.includes('meshes');
        }""",timeout=150000)
        metrics=page.locator('#metrics').inner_text()
        assert 'surfaces' in metrics and 'nodes' in metrics,metrics
        assert page.locator('#download-progress').is_hidden()
        assert page.locator('#upload').is_hidden()
        size=page.locator('#viewer').evaluate(
            '(el)=>({w:el.width,h:el.height})')
        assert size['w']>=300 and size['h']>=300,size
        page.locator('#sweep').fill('16')
        page.locator('#sweep').dispatch_event('input')
        assert page.locator('#sweep-angle').inner_text()=='16°'
        page.locator('[data-view="top"]').click()
        page.screenshot(path=str(out/('mig23-studio-'+label+'.png')))
        if mobile:
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),'mobile horizontal overflow'
        assert not errors,errors
        outcomes.append({'device':label,'sweep':16,'metrics':metrics,'canvas':size,'errors':errors})
        context.close()
    browser.close()
    print(json.dumps({'result':'PASS','loadedGLB':True,'gridHelperCrash':False,'devices':outcomes},ensure_ascii=False),flush=True)
