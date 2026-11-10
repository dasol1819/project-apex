import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get('APEX_TEST_URL','http://127.0.0.1:8765').rstrip('/')
output = Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/mig23-flight-browser'))
hook = r"""
window.__weaponQA = {run(){
 setPaused(true);
 const target=combat.roster.find(a=>a.team===1);
 combat.setActorType(target,1);
 const enemy=target.sim;
 target.active=true;
 const get=(s,n,l)=>new Float64Array(s.memory.buffer,s[n](),l);
 for(const [s,type,z,speed] of [[sim,0,0,250],[enemy,1,-2000,215]]){
  s.set_aircraft_type(type);s.reset_spawn(1);
  s.debug_set_state(0,5000,z,0,0,-speed,0,0,0,1);
  s.set_controls(0,0,0,.75,0,0,0,1);s.set_invincible(0);
 }
 combat.bridge.reset();
 sim.set_missile_enabled(1);sim.set_radar_power(1);
 let requested=false,selected=false,flying=false;
 for(let i=0;i<600;i++){
  combat.bridge.step(1/120);
  if(!selected&&get(sim,'get_radar_state',32)[5]){
   sim.select_sensor_target(target.id);sim.request_radar_lock();selected=true;
  }
  if(!requested&&get(sim,'get_missile_state',40)[2]===4) requested=sim.request_missile_fire()===1;
  if(get(sim,'get_missiles',26)[0]){flying=true;break;}
 }
 if(!flying)throw Error('No launched missile');
 const t=get(enemy,'get_state',104),m=new Float64Array(sim.memory.buffer,1110160,22);
 m.set([t[0]-5.5,t[1]+3,t[2]+24]);m.set([0,0,-950],6);m.set([0,0,-1],9);m[12]=5;m[17]=600;
 let point=null;
 for(let i=0;i<40;i++){
  combat.bridge.step(1/120);
  const event=get(sim,'get_missile_events',50);
  if(event[0]&&event[6]===5){point=[...event.subarray(2,5)];break;}
 }
 if(!point)throw Error('No proximity event');
 camera.position.set(point[0]-10,point[1]+5,point[2]+14);
 camera.lookAt(new T.Vector3(...point));
 combat.update(0.025,camera,true);
 const flash=scene.children.find(o=>o.visible&&o.name==='missile impact flash and smoke');
 if(!flash||flash.material.uniforms.proximity.value!==1)throw Error('Proximity flash not visible');
 const delta=flash.position.distanceTo(new T.Vector3(...point));
 if(delta>.10)throw Error('Burst rendered away from native position');
 renderer.render(scene,camera);
 return {delta,gl:renderer.getContext().getError(),image:renderer.domElement.toDataURL()};
}};
"""
errors = []
with sync_playwright() as p:
 browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), headless=True,
  args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page = browser.new_page(viewport={'width':1080,'height':720})
 page.on('pageerror', lambda error: errors.append(str(error)))
 page.on('console', lambda message: errors.append(message.text) if message.type=='error' and 'THREE.' in message.text else None)
 def route_module(route):
  response = route.fetch()
  route.fulfill(response=response, body=response.text()+hook)
 page.route('**/app.js?*',route_module)
 page.goto(base+'/',wait_until='domcontentloaded')
 page.wait_for_selector('html[data-raptor-ready=true]',timeout=120000)
 result=page.evaluate('__weaponQA.run()')
 data=result.pop('image').split(',',1)[1]
 assert result['gl']==0 and not errors, (result,errors)
 output.mkdir(parents=True,exist_ok=True)
 (output/'proximity-burst.png').write_bytes(base64.b64decode(data))
 print(json.dumps(result))
 browser.close()
