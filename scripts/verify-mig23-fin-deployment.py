"""Compare published fin release bytes against a fresh restored/native build.

Use the same cache versions imported by the game. TLS remains enabled; the
HTTPS result is recorded separately from successful HTTP byte verification.
"""
import argparse,concurrent.futures,hashlib,json,time,urllib.request,urllib.error
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--public',type=Path,default=Path('public'));p.add_argument('--output',type=Path,required=True);p.add_argument('--commit',required=True);p.add_argument('--base',default='http://project-apex.kro.kr')
a=p.parse_args()
paths=[('index.html','/?screen=tree'),('app.js','/app.js?v=instructor-response-2-fin-damage-1'),('aircraft.js','/aircraft.js?v=mig23mld-14'),('mig23mld-game.js','/mig23mld-game.js?v=14'),('mig23mld-fin.js','/mig23mld-fin.js'),('mig23mld-fin-data.js','/mig23mld-fin-data.js'),('mig23mld-glb.js','/mig23mld-glb.js?v=3'),('damage-effects.js','/damage-effects.js?v=source-parts-2'),('wreckage-mesh.js','/wreckage-mesh.js?v=posed-morph-1'),('part-emitter.js','/part-emitter.js?v=world-scale-1'),('aircraft-catalog.js','/aircraft-catalog.js'),('flight.wasm','/flight.wasm?v=instructor-response-2-fin-damage-1-missiles-1'),('assets/mig23mld/Mig-23.glb','/assets/mig23mld/Mig-23.glb?v=3')]
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
