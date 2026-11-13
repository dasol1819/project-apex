"""Same renderer/tick/camera comparison against the unpartitioned original skin.

Old buffers and transforms are retained only by HTTP response instrumentation;
no rollback/debug API or duplicate source geometry is shipped to the game.
"""
import base64,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-fin-preservation-browser'));out.mkdir(parents=True,exist_ok=True)
hook='''
window.__finPreservation={get loaded(){return aircraft?.sourceLoaded},get started(){return started},run(){
 setPaused(true);const a=aircraft;a.group.position.set(0,5000,0);a.group.quaternion.identity();a.update({gear:0,wingSweep:72,leftTail:0,rightTail:0,leftRudder:0,airbrake:0,afterburner:0,health:PARTS.map(()=>1)});a.group.updateWorldMatrix(true,true);
 const fixture=globalThis.__finSourcePlans.find(p=>p.fin===a.damageParts[5]);if(!fixture)throw Error('Missing instance-specific original snapshot');
 const live=fixture.fittings.map(({node})=>({node,parent:node.parent,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()}));
 function mode(original){for(const plan of fixture.plans)plan.mesh.geometry=original?plan.geometry:plan.skin;fixture.fin.visible=!original;for(const f of original?fixture.fittings:live){f.parent.add(f.node);f.node.position.copy(f.p);f.node.quaternion.copy(f.q);f.node.scale.copy(f.s);}a.group.updateWorldMatrix(true,true);}
 function storage(original){const arrays=new Set(),geometries=new Set();let vertices=0,triangles=0,bytes=0;fixture.root.traverse(m=>{if(!m.isMesh||original&&m.name==='MiG-23MLD original fixed fin skin')return;const g=m.geometry;if(geometries.has(g))return;geometries.add(g);vertices+=g.attributes.position.count;triangles+=(g.index?.count??g.attributes.position.count)/3;for(const a of [g.index,...Object.values(g.attributes),...Object.values(g.morphAttributes).flat()])if(a&&!arrays.has(a.array)){arrays.add(a.array);bytes+=a.array.byteLength;}});return {geometries:geometries.size,vertices,triangles,attributeIndexMorphBytes:bytes,scope:'active source geometry buffers including hidden authored surfaces/morphs; excludes test-retained inactive buffers, textures, temporary JS/driver allocations'};}
 const cases=[['overall',[23,-4,4.4],[0,.95,0],30],['rear',[6,2.5,14],[0,.5,6.4],30],['fin-port',[-4,2.2,7.7],[0,2.4,7.7],25],['fin-starboard',[4,2.2,7.7],[0,2.4,7.7],25],['intake-port',[-6,0,-8],[-1.2,0,-3],30],['intake-starboard',[6,0,-8],[1.2,0,-3],30],['root',[5,1.2,10],[.65,.6,6.2],30],['overhead',[0,20,0],[0,0,0],50]];
 return cases.map(([name,offset,target,fov])=>{const cam=camera.clone();cam.position.copy(a.group.localToWorld(new T.Vector3(...offset)));cam.up.set(0,1,0);if(name==='overhead')cam.up.set(0,0,-1);cam.lookAt(a.group.localToWorld(new T.Vector3(...target)));cam.fov=fov;cam.updateProjectionMatrix();cam.updateMatrixWorld();
 const gl=renderer.getContext(),width=renderer.domElement.width,height=renderer.domElement.height,read=()=>{const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
 mode(true);renderer.render(scene,cam);const original=renderer.domElement.toDataURL().split(',')[1],before=read(),originalStorage=name==='overall'?storage(true):null;mode(false);renderer.render(scene,cam);const current=renderer.domElement.toDataURL().split(',')[1],after=read();let changedPixels=0,maxChannelDelta=0;const changed=[];for(let i=0;i<before.length;i+=4){if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2]){changedPixels++;if(changed.length<4){const x=i/4%width,y=Math.floor(i/4/width),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x+.5)/width*2-1,(y+.5)/height*2-1),cam);const meshes=[];a.group.traverseVisible(m=>{if(m.isMesh)meshes.push(m)});const hits=ray.intersectObjects(meshes,false).slice(0,3).map(h=>({name:h.object.name,parent:h.object.parent.name,distance:h.distance}));changed.push({x,y:height-1-y,before:Array.from(before.slice(i,i+3)),after:Array.from(after.slice(i,i+3)),hits});}}for(let k=0;k<3;k++)maxChannelDelta=Math.max(maxChannelDelta,Math.abs(before[i+k]-after[i+k]));}return {name,original,current,...(name==='overall'?{originalStorage,currentStorage:storage(false)}:{}),changedPixels,maxChannelDelta,changed,camera:{offset,target,fov}};});
}};
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);context=browser.new_context(viewport={'width':1366,'height':900});context.route('**/api/account/session',lambda r:r.fulfill(json={'user':None}));page=context.new_page();page.set_default_timeout(120000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def instrument(route):
  response=route.fetch();route.fulfill(response=response,body=response.text()+hook)
 def partition(route):
  response=route.fetch();source=response.text();marker=' root.updateWorldMatrix(true,true);';assert source.count(marker)==1
  source=source.replace(marker," globalThis.__finSourcePlans??=[];globalThis.__finSourcePlans.push({root,fin,plans,fittings:fittings.map(node=>({node,parent:node.parent,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()}))});\n"+marker);route.fulfill(response=response,body=source)
 page.route('**/app.js*',instrument);page.route('**/mig23mld-fin.js*',partition);page.goto(base+'/?screen=tree',wait_until='domcontentloaded');page.wait_for_function("document.documentElement.dataset.raptorReady==='true'",timeout=180000)
 page.locator('[data-tree-nation=ru]').click();page.locator('[data-tree-aircraft=ru-mig23-mld]').click();page.locator('#tree-choose').click();page.wait_for_function('__finPreservation.loaded');page.locator('#tree-prepare').click();page.locator('#launch').click();page.wait_for_function('__finPreservation.started&&__finPreservation.loaded')
 cases=page.evaluate('()=>__finPreservation.run()')
 for case in cases:
  for name in ['original','current']:
   path=out/(case['name']+'-'+name+'.png');path.write_bytes(base64.b64decode(case.pop(name)))
 report=dict(cases=cases,pageErrors=errors,environment='Chromium141 / SwiftShader /1366x900; same actual game renderer, same tick/camera/materials; only original partition toggled by test-response instrumentation')
 (out/'preservation.json').write_text(json.dumps(report,indent=2)+'\n');assert not errors,errors
 # One measured seam pixel can change depth ownership when a disjoint mesh
 # changes opaque draw ordering. It must ray-hit BOTH original fin and rudder
 # within 10 micrometres; a silhouette/UV/material difference fails this test.
 assert sum(case['changedPixels'] for case in cases)<=1,report
 first=cases[0];assert all(first['originalStorage'][k]==first['currentStorage'][k] for k in ['vertices','triangles','attributeIndexMorphBytes']),report
 for case in cases:
  for pixel in case['changed']:
   hits=pixel['hits'];assert len(hits)>=2 and {hits[0]['parent'],hits[1]['parent']}=={'rudder','MiG-23MLD fixed fin'} and abs(hits[0]['distance']-hits[1]['distance'])<1e-5,report
 print(json.dumps(report),flush=True);browser.close()
