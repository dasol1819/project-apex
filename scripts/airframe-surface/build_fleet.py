"""Original metre-space panel/cavity/roughness bake for procedural aircraft.

The editable layout is JSON, separate from paint and from geometry. No colour
boundary becomes a dent. Four views share an atlas; normal XY / roughness / cavity
use the existing compressed surface loader. Requires numpy/Pillow/scipy, BASISU.
"""
from pathlib import Path
import hashlib, gzip, json, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT=Path(__file__).resolve().parents[2]
LAYOUT=ROOT/'assets/fleet-surface/layout.json'
profiles=json.loads(LAYOUT.read_text())
encoder=os.environ.get('BASISU','basisu')
tile=int(os.environ.get('FLEET_TILE','2048'))
build=ROOT/'.native-build/fleet-surface';build.mkdir(parents=True,exist_ok=True)

def bake(p,plane):
    span,height,length=p['extent']
    extent=(span,length) if plane in ['top','bottom'] else (length,height)
    origin=(-span/2,-length/2) if plane in ['top','bottom'] else (-length/2,-height*.25)
    sx,sy=extent[0]/tile,extent[1]/tile
    h=np.zeros((tile,tile),np.float32);cavity=np.zeros_like(h)
    def segment(a,b,rivets=False,width=.0035):
        margin=max(sx,sy)*3+.02
        x0=max(0,int((min(a[0],b[0])-margin-origin[0])/sx));x1=min(tile,int((max(a[0],b[0])+margin-origin[0])/sx)+1)
        y0=max(0,int((min(a[1],b[1])-margin-origin[1])/sy));y1=min(tile,int((max(a[1],b[1])+margin-origin[1])/sy)+1)
        if x1<=x0 or y1<=y0:return
        x=origin[0]+(np.arange(x0,x1,dtype=np.float32)+.5)*sx
        y=origin[1]+(np.arange(y0,y1,dtype=np.float32)+.5)*sy
        xx,yy=np.meshgrid(x,y);d=np.array(b)-a;dd=max(float(d@d),1.e-12)
        t=np.clip(((xx-a[0])*d[0]+(yy-a[1])*d[1])/dd,0,1)
        distance=np.hypot(xx-a[0]-d[0]*t,yy-a[1]-d[1]*t)
        sigma=max(width,(sx+sy)*.30)
        seam=np.exp(-.5*(distance/sigma)**2)*min(1,width/sigma)
        h[y0:y1,x0:x1]-=seam*.00032
        cavity[y0:y1,x0:x1]=np.maximum(cavity[y0:y1,x0:x1],seam*.21)
        if rivets:
            along=t*np.sqrt(dd);pitch=.065
            along=(along+pitch/2)%pitch-pitch/2
            radial=np.hypot(along,distance-.017)
            rr=max(.0016,(sx+sy)*.25)
            dots=np.exp(-.5*(radial/rr)**2)*min(1,.0016/rr)**2
            h[y0:y1,x0:x1]-=dots*.00016
            cavity[y0:y1,x0:x1]=np.maximum(cavity[y0:y1,x0:x1],dots*.15)
    for a,b in p['planes'][plane]['segments']:segment(a,b,not p['stealth'])
    for hatch in p['planes'][plane]['hatches']:
        cx,cy,rx,ry=hatch
        if p['stealth']:
            # Authored sawtooth RAM perimeter, separate from camouflage.
            points=[]
            for side in range(4):
                a=[[-rx,-ry],[rx,-ry],[rx,ry],[-rx,ry]][side];b=[[rx,-ry],[rx,ry],[-rx,ry],[-rx,-ry]][side]
                for j in range(8):
                    t=j/8;normal=np.array([-(b[1]-a[1]),b[0]-a[0]],float);normal/=max(np.linalg.norm(normal),1.e-9)
                    q=np.array(a)+(np.array(b)-a)*t+normal*(.018 if j%2 else 0)
                    points.append([cx+q[0],cy+q[1]])
        else:
            points=[]
            for j in range(32):
                a=j/32*2*np.pi;c=np.cos(a);s=np.sin(a)
                points.append([cx+np.sign(c)*abs(c)**.28*rx,cy+np.sign(s)*abs(s)**.28*ry])
        for a,b in zip(points,points[1:]+points[:1]):segment(a,b,False,.0045)
    rng=np.random.default_rng(p['id']*19+['top','bottom','side','fin'].index(plane)+971)
    broad=gaussian_filter(rng.normal(0,1,(tile//32,tile//32)).astype(np.float32),1.1)
    broad=Image.fromarray(broad,mode='F').resize((tile,tile),Image.Resampling.BICUBIC)
    broad=np.array(broad,dtype=np.float32);broad/=max(broad.std(),.01)
    dhy,dhx=np.gradient(h,sy,sx)
    normal=np.stack([-dhx,-dhy,np.ones_like(h)],axis=-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    rough=np.clip(.72+broad*.018+cavity*.30,.62,.88)
    packed=np.dstack([normal[...,:2]*.5+.5,rough,1-cavity])
    # PNG origin is upper-left, whereas the authored atlas uses positive-up UVs.
    return Image.fromarray(np.rint(np.clip(packed[::-1],0,1)*255).astype(np.uint8),'RGBA')

manifest=[]
for p in profiles:
    if len(sys.argv)>1 and str(p['id']) not in sys.argv[1:]:continue
    out=ROOT/'web/assets/fleet-surface'/str(p['id']);out.mkdir(parents=True,exist_ok=True)
    atlas=Image.new('RGBA',(tile*2,tile*2),(128,128,184,255))
    for plane,xy in [('top',(0,tile)),('bottom',(tile,tile)),('side',(0,0)),('fin',(tile,0))]:atlas.paste(bake(p,plane),xy)
    work=build/str(p['id']);work.mkdir(parents=True,exist_ok=True)
    png=work/'surface.png';ktx=work/'surface.ktx2'
    # Keep a verified intermediate in an aircraft-specific directory. Delivered
    # assets remain UASTC + gzip and lossless WebP.
    atlas.save(png,compress_level=0)
    with Image.open(png) as check:check.verify()
    fallback=atlas.resize((2048,2048),Image.Resampling.LANCZOS);fallback.save(out/'surface-fallback.webp',lossless=True,method=6)
    encoded=subprocess.run([encoder,'-file',str(png),'-output_file',str(ktx),'-ktx2','-uastc','-uastc_level','2','-uastc_rdo_l','1.0','-uastc_rdo_m','-ktx2_no_zstandard','-mipmap','-linear','-mip_linear','-y_flip','-no_multithreading'],capture_output=True,text=True)
    (work/'encoder.log').write_text(encoded.stdout+encoded.stderr)
    if encoded.returncode:raise RuntimeError(encoded.stdout[-1600:]+encoded.stderr[-800:])
    (out/'surface.ktx2.gz').write_bytes(gzip.compress(ktx.read_bytes(),compresslevel=9,mtime=0))
    entry={'id':p['id'],'name':p['name'],'extent':p['extent'],'size':tile*2,'channels':'RG tangent normal XY; B roughness; A shallow cavity','layoutSHA256':hashlib.sha256(LAYOUT.read_bytes()).hexdigest(),'files':{}}
    for file in sorted(out.iterdir()):
        if file.name=='surface.json':continue
        entry['files'][file.name]={'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    (out/'surface.json').write_text(json.dumps(entry,indent=2)+'\n');manifest.append(entry)
    print(p['name'],sum(a['bytes'] for a in entry['files'].values()),flush=True)
print('Baked',len(manifest),'aircraft')
