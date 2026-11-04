"""Fit a rigid camera to recorded photo landmarks, then render the game model.

No photograph or mesh stretching/warping. Retain every correspondence and its
pixel residual; registration is comparison evidence, not a CAD accuracy claim.
"""
from pathlib import Path
import json, os, sys, subprocess
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation
from scipy.ndimage import binary_erosion
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
spec=json.loads(Path(sys.argv[1]).read_text());out=ROOT/'docs/reviews/mig15bis'/spec['name'];out.mkdir(parents=True,exist_ok=True)
photo=Image.open(ROOT/spec['photo']).convert('RGB');w,h=photo.size
xyz=np.array([p['model'] for p in spec['points']],dtype=float);pixels=np.array([p['photo'] for p in spec['points']],dtype=float)
fitmask=np.array([p.get('fit',True) for p in spec['points']]);weights=np.array([p.get('weight',1.) for p in spec['points']])
def cv_camera(eye):
 eye=np.array(eye,dtype=float);at=np.array([0,.3,0]);forward=at-eye;forward/=np.linalg.norm(forward)
 right=np.cross(forward,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,forward)
 R=np.array([right,-up,forward]);return Rotation.from_matrix(R).as_rotvec(),-R@eye
def project(a):
 R=Rotation.from_rotvec(a[:3]).as_matrix();q=xyz@R.T+a[3:6];f=np.exp(a[6]);p=q[:,:2]/q[:,2,None]*f+[w/2,h/2]
 return p,q,R,f
best=None
for eye in spec['initialEyes']:
 r,t=cv_camera(eye)
 for focal in [w*.8,w*1.5,w*3]:
  def residual(a):
   p,q,_,_=project(a);penalty=np.minimum(q[:,2]-.1,0)*100
   R=Rotation.from_rotvec(a[:3]).as_matrix();orientation=np.array([R[0,1]*140,R[1,0]*100,R[1,2]*100])
   return np.r_[((p-pixels)*weights[:,None])[fitmask].ravel(),penalty[fitmask],orientation]
  a=np.r_[r,t,np.log(focal)];fit=least_squares(residual,a,loss='soft_l1',f_scale=6,max_nfev=3000,bounds=(np.r_[[-10]*3,[-1000]*3,np.log(w*.70)],np.r_[[10]*3,[1000]*3,np.log(w*3)]))
  p,q,R,f=project(fit.x);error=np.linalg.norm(p-pixels,axis=1)
  if min(q[:,2])<=0:continue
  score=np.mean(error[fitmask]**2)
  if best is None or score<best[0]:best=(score,fit.x,p,q,R,f,error)
if best is None:raise RuntimeError('No valid registration')
score,a,p,q,R,f,error=best
view=np.eye(4);view[:3,:3]=R;view[:3,3]=a[3:6];view=np.diag([1,-1,-1,1])@view
near,far=.05,2000;projection=np.array([[2*f/w,0,0,0],[0,2*f/h,0,0],[0,0,(far+near)/(near-far),2*far*near/(near-far)],[0,0,-1,0]])
camera={'size':[w,h],'views':[{'angle':'registered','view':view.tolist(),'projection':projection.tolist()}]};cp=out/'camera.json';cp.write_text(json.dumps(camera,indent=2)+'\n')
data='.native-build/mig15-'+spec['name'];state=spec.get('state',{'gear':1});subprocess.run(['node',str(ROOT/'scripts/mig15bis/export-review.mjs'),'public',data,'15'],env={**os.environ,'REVIEW_STATE':json.dumps(state)},check=True)
env={**os.environ,'REVIEW_CAMERAS':str(cp),'REVIEW_DATA':data,'REVIEW_OUTPUT':str(out.relative_to(ROOT))}
subprocess.run(['python3',str(ROOT/'scripts/mig15bis/render-review.py'),'15'],env=env,check=True)
render=Image.open(out/'15-registered.png').convert('RGBA');raw=np.array(render);mask=raw[:,:,3]>128;edge=mask^binary_erosion(mask)
outline=np.array(photo);outline[edge]=[255,38,70]
render.putalpha(render.getchannel('A').point(lambda a:round(a*.45)));overlay=Image.alpha_composite(photo.convert('RGBA'),render).convert('RGB')
sheet=Image.new('RGB',(w*3,h+80),'#17212b')
for i,(im,label) in enumerate([(photo,'REFERENCE PHOTO'),(overlay,'45% GAME RENDER OVERLAY'),(Image.fromarray(outline),'GAME SILHOUETTE IN RED')]):sheet.paste(im,(i*w,36));ImageDraw.Draw(sheet).text((i*w+12,12),label,fill='white')
ImageDraw.Draw(sheet).text((12,h+48),spec['credit']+' | rigid camera only | EGL mesh + game shader hooks',fill='white')
sheet.save(out/'comparison.jpg',quality=90);overlay.save(out/'overlay.jpg',quality=92)
res={**spec,'focalPixels':f,'fitRmsPixels':float(np.sqrt(score)),'landmarks':[{**s,'projected':pp.tolist(),'errorPixels':float(e)} for s,pp,e in zip(spec['points'],p,error)],'limitation':'Hand-picked landmarks, lens distortion and occlusion limit accuracy. No mesh/photo warping; offscreen renderer, not browser QA.'}
(out/'registration.json').write_text(json.dumps(res,indent=2)+'\n');print(json.dumps({'name':spec['name'],'fitRmsPixels':np.sqrt(score),'residuals':[(s['label'],round(float(e),1)) for s,e in zip(spec['points'],error)]}))
