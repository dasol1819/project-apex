"""Native rebuild determinism plus the affected aircraft regressions."""
from pathlib import Path
import subprocess,hashlib,json,gzip,platform,time
ROOT=Path(__file__).resolve().parents[2];out=ROOT/'docs/reviews/mig15bis';out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
before=sha('web/flight.wasm');shapes=sha('assets/mig15bis/shapes.json')
commands=[['python3','scripts/update-web-manifest.py'],['python3','.deployment/restore.py'],['node','scripts/native/export-mig15-shapes.mjs','public'],['npm','run','build:combat'],['python3','scripts/update-web-manifest.py'],['python3','.deployment/restore.py']]
commands += [['node',p,'public'] for p in ['tests/su35-combat-native.mjs','tests/su35-combat-systems.mjs','tests/su35-geometry.mjs','tests/su35-combat-model.mjs','tests/su35-flight-physics.mjs','tests/mig29-native.mjs','tests/mig29-combat.mjs','tests/mig29-model.mjs','tests/mig29-surface-data.mjs','tests/mig15-native.mjs','tests/mig15-model.mjs']]
commands.append(['node','scripts/aircraft-progress.mjs']);results=[]
for cmd in commands:
 start=time.monotonic();r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True)
 results.append({'command':cmd,'exitCode':r.returncode,'seconds':round(time.monotonic()-start,3),'stdout':r.stdout.strip(),'stderr':r.stderr.strip()})
 if r.returncode:
  (out/'checks.json').write_text(json.dumps({'result':'FAIL','checks':results},indent=2)+'\n');print(r.stdout,r.stderr);raise SystemExit(r.returncode)
assert sha('web/flight.wasm')==before,'Native WASM rebuild must be byte-identical'
assert sha('assets/mig15bis/shapes.json')==shapes,'Collision source must match the visible model'
runtime={}
for p in ['web/mig15bis-model.js','web/mig15bis-finish.js','web/flight.wasm']:
 b=(ROOT/p).read_bytes();runtime[p]={'bytes':len(b),'gzipBytes':len(gzip.compress(b,mtime=0)),'sha256':hashlib.sha256(b).hexdigest()}
report={'result':'PASS','node':subprocess.check_output(['node','--version'],text=True).strip(),'python':platform.python_version(),'wasmRebuildByteIdentical':True,'collisionExportByteIdentical':True,'runtimeFiles':runtime,'checks':results,'browserQA':{'result':'BLOCKED','reason':'Error creating WebGL context in the managed cloud browser, both before and after environment recovery'},'renderer':'EGL llvmpipe (LLVM 20.1.2, 256 bits); expanded game shader hooks; no hardware FPS claim'}
(out/'checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'result':'PASS','commands':len(results),'wasmRebuildByteIdentical':True,'collisionExportByteIdentical':True,'browserQA':'BLOCKED'}))
