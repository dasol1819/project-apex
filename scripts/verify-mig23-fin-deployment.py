"""Compare published fin release bytes against a fresh restored/native build.

Use the same cache versions imported by the game. TLS remains enabled; the
HTTPS result is recorded separately from successful HTTP byte verification.
"""
import argparse,concurrent.futures,hashlib,json,re,time,urllib.request,urllib.error
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--public',type=Path,default=Path('public'));p.add_argument('--output',type=Path,required=True);p.add_argument('--commit',required=True);p.add_argument('--base',default='http://project-apex.kro.kr')
a=p.parse_args()
# Derive cache versions from the validated build instead of probing an
# unrelated query string that a returning player's module graph never uses.
def specifier(file,target):
 text=(a.public/file).read_text();matches=re.findall(r"['\"](\./"+re.escape(target)+r"(?:\?[^'\"]*)?)['\"]",text)
 assert len(set(matches))==1,(file,target,matches)
 return matches[0][1:]
index=(a.public/'index.html').read_text()
appUrls=re.findall(r"src=['\"]([^'\"]*app\.js(?:\?[^'\"]*)?)['\"]",index);assert len(set(appUrls))==1,appUrls
appUrl='/'+appUrls[0].removeprefix('./').lstrip('/')
factoryUrls={specifier(file,'aircraft.js') for file in ['app.js','aircraft-inspector.js','combat-scene.js','graphics-workload.js']}
assert len(factoryUrls)==1,('inconsistent aircraft factory URLs',factoryUrls)
app=(a.public/'app.js').read_text();wasm=re.findall(r"['\"](\./flight\.wasm(?:\?[^'\"]*)?)['\"]",app);assert len(set(wasm))==1,wasm
paths=[('index.html','/?screen=tree'),('app.js',appUrl),('aircraft.js',next(iter(factoryUrls))),
 *[(name,specifier('app.js',name)) for name in ['aircraft-inspector.js','combat-scene.js','graphics-workload.js']],
 ('mig23mld-game.js',specifier('aircraft.js','mig23mld-game.js')),('mig23mld-fin.js','/mig23mld-fin.js'),('mig23mld-fin-data.js','/mig23mld-fin-data.js'),
 ('mig23mld-glb.js',specifier('mig23mld-game.js','mig23mld-glb.js')),('damage-effects.js',specifier('app.js','damage-effects.js')),
 ('wreckage-mesh.js',specifier('damage-effects.js','wreckage-mesh.js')),('part-emitter.js',specifier('damage-effects.js','part-emitter.js')),
 ('aircraft-catalog.js','/aircraft-catalog.js'),('flight.wasm',wasm[0][1:]),('assets/mig23mld/Mig-23.glb','/assets/mig23mld/Mig-23.glb?v=3')]

def check(pair):
 file,suffix=pair;url=a.base.rstrip('/')+suffix;start=time.monotonic()
 with urllib.request.urlopen(url,timeout=120) as response:data=response.read();status=response.status
 expected=(a.public/file).read_bytes()
 return dict(file=file,url=url,status=status,bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),expectedSha256=hashlib.sha256(expected).hexdigest(),matches=data==expected,seconds=round(time.monotonic()-start,3))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:files=list(pool.map(check,paths))
try:
 with urllib.request.urlopen('https://project-apex.kro.kr',timeout=30) as response:https=dict(status=response.status,bytes=len(response.read()))
except (urllib.error.URLError,TimeoutError) as error:
 https=dict(status=getattr(error,'code',None),error=str(error),scope='observed through inherited environment proxy; HTTPS unverified, not a global-outage diagnosis')
report=dict(checkedAt=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),commit=a.commit,files=files,allFilesMatch=all(f['matches'] for f in files),https=https,transport='Normal inherited proxy and CA. Certificate checks enabled; no local asset replacement or alternate network path.')
a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(dict(allFilesMatch=report['allFilesMatch'],matchedFiles=sum(f['matches'] for f in files),totalBytes=sum(f['bytes'] for f in files),wasm=next(f for f in files if f['file']=='flight.wasm'),https=https)),flush=True)
assert report['allFilesMatch'],report
