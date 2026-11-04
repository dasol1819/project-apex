"""Reproducible mechanism, power and damage views of the actual game model."""
from pathlib import Path
import json,os,subprocess
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/reviews/mig15bis/states';OUT.mkdir(parents=True,exist_ok=True)
health=[1]*30;health[1]=0;health[29]=.45
states={
 'idle':{'gear':1,'canopy':1,'engine':.2},
 'military':{'gear':0,'engine':1,'afterburner':1},
 'controls':{'gear':1,'leftFlap':.52,'rightFlap':.52,'leftAileron':.22,'rightAileron':-.22,'leftTail':.18,'rightTail':.18,'leftRudder':.25,'airbrake':1},
 'damaged':{'gear':0,'engine':1,'afterburner':1,'health':health}
}
camera={'size':[1200,800],'views':[{'angle':'quarter','direction':[-.85,.5,-1],'distance':19},
 {'angle':'intake','direction':[.12,.05,-1],'focus':[0,0,-4.1],'distance':3.0,'fov':38},
 {'angle':'nozzle','direction':[.15,.10,1],'focus':[0,-.06,3.1],'distance':3.2,'fov':39}]}
cp=OUT/'cameras.json';cp.write_text(json.dumps(camera,indent=2)+'\n')
for name,state in states.items():
 data='.native-build/mig15-states-'+name;out=OUT/name
 env={**os.environ,'REVIEW_STATE':json.dumps(state),'REVIEW_EFFECTS':'1','REVIEW_DATA':data,'REVIEW_OUTPUT':str(out.relative_to(ROOT)),'REVIEW_CAMERAS':str(cp)}
 subprocess.run(['node','scripts/mig15bis/export-review.mjs','public',data,'15'],cwd=ROOT,env=env,check=True)
 subprocess.run(['python3','scripts/mig15bis/render-review.py','15'],cwd=ROOT,env=env,check=True)
sheet=Image.new('RGB',(2400,1672),'#1f2933');d=ImageDraw.Draw(sheet)
for i,name in enumerate(states):
 im=Image.open(OUT/name/'15-quarter.png').convert('RGBA');bg=Image.new('RGBA',im.size,'#202b35');bg.alpha_composite(im);x=i%2*1200;y=i//2*836
 sheet.paste(bg.convert('RGB'),(x,y+36));d.text((x+18,y+12),name.upper()+' | actual model + material hooks | EGL llvmpipe',fill='white')
sheet.save(OUT/'state-comparison.jpg',quality=91)
(OUT/'states.json').write_text(json.dumps(states,indent=2)+'\n')
