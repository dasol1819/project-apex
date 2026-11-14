"""Legacy versioned-response fixture: old URLs retain pre-fin code.

This represents an HTTP cache that still holds those immutable URLs, not a
complete certification of Chromium's disk-cache eviction behavior. The real
native game and original GLB render in the existing fin gameplay suite.
"""
import functools,hashlib,http.server,json,os,re,runpy,sys,threading,urllib.parse
from pathlib import Path
root=Path.cwd();out=Path(os.environ.get('APEX_TEST_OUTPUT','/tmp/aircraft-cache-browser'));out.mkdir(parents=True,exist_ok=True)
baseline=os.environ.get('APEX_EXPECT_LEGACY_FACTORY','0')=='1';requests=[]
fixtures=root/'tests/fixtures/aircraft-cache'
for name,sha in [('legacy-aircraft.js','a7d7c4e8b534b0cae80ad517d7ebef18ee799442'),('legacy-mig23mld-game.js','50de478a6d73de022997e76c8de1c587e60b54b4')]:
 data=(fixtures/name).read_bytes();assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==sha,'historical fixture changed: '+name
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  u=urllib.parse.urlsplit(self.path);version=urllib.parse.parse_qs(u.query).get('v',[''])[0];file=None
  if u.path=='/aircraft.js' and version in ['fa18b-1','mig23mld-13','inspector-5']:file=fixtures/'legacy-aircraft.js'
  if u.path=='/mig23mld-game.js' and version=='13':file=fixtures/'legacy-mig23mld-game.js'
  # Reconstruct only the four pre-fix factory specifiers in baseline mode.
  # Other current application/native bytes stay identical to the candidate.
  oldConsumers={'/app.js':'fa18b-1','/aircraft-inspector.js':'mig23mld-13','/combat-scene.js':'mig23mld-13','/graphics-workload.js':'inspector-5'}
  if baseline and u.path in oldConsumers:
   text=(root/'public'/u.path.lstrip('/')).read_text();text=re.sub(r"(\./aircraft\.js\?v=)[^'\"]+",lambda m:m[1]+oldConsumers[u.path],text)
   data=text.encode();self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  if u.path=='/aircraft.js':requests.append({'url':self.path,'legacy':bool(file),'bytes':len(file.read_bytes() if file else (root/'public/aircraft.js').read_bytes())})
  if file:
   data=file.read_bytes();self.send_response(200);self.send_header('Content-Type','text/javascript');self.send_header('Cache-Control','public,max-age=31536000,immutable');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
  else:super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root/'public')))
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();os.environ['APEX_TEST_URL']='http://127.0.0.1:'+str(server.server_address[1]);os.environ['APEX_TEST_OUTPUT']=str(out)
failed=False
try:
 try:runpy.run_path(str(root/'tests/mig23-fin-browser.py'),run_name='__main__')
 except AssertionError:
  failed=True
  if not baseline:raise
 finally:server.shutdown();thread.join()
 report=json.loads((out/'fin.json').read_text());assert not report['pageErrors'] and report['loss']['health']==0,report
 if baseline:
  assert failed and report['registration']['name']!='MiG-23MLD fixed fin' and report['loss']['triangles']==0 and report['loss']['mapped']==0 and not report['loss']['fittingHidden'] and not report['loss']['rootFairingsHidden'],report
 else:
  assert not failed and report['loss']['triangles']==972 and report['loss']['rootFairingsHidden'],report
 versions=sorted(set(r['url'] for r in requests));summary={'result':'PASS','expectedLegacy':baseline,'factoryUrls':versions,'factoryResponses':requests,'factoryTransferBytes':sum(r['bytes'] for r in requests),'sourceFinName':report['registration']['name'],'nativeFinTriangles':report['loss']['triangles'],'mappedMeshes':report['loss']['mapped'],'scope':'Actual native gameplay under old versioned-response fixture; not browser disk-cache eviction certification'}
 if not baseline:assert len(versions)==1 and len(requests)==1 and not any(r['legacy'] for r in requests),summary
 (out/'cache.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary),flush=True)
finally:server.server_close()
