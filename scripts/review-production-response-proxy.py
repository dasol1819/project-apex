"""Run committed inspection tests on actual deployed HTTP bytes via inherited proxy."""
import hashlib,json,os,re,urllib.request,urllib.parse,sys
from pathlib import Path
from playwright.sync_api import BrowserType,Page
u=urllib.parse.urlsplit(os.environ['HTTP_PROXY']);original=BrowserType.launch
def launch(self,*args,**kwargs):
 proxy={'server':u.scheme+'://'+u.hostname+(':'+str(u.port) if u.port else '')}
 if u.username:proxy['username']=urllib.parse.unquote(u.username)
 if u.password:proxy['password']=urllib.parse.unquote(u.password)
 kwargs['proxy']=proxy
 return original(self,*args,**kwargs)
BrowserType.launch=launch
# Some managed proxies take several seconds for each module request. A test
# navigation budget may be extended without changing the connection path,
# certificate checks, site bytes or the production application itself.
original_goto=Page.goto
factory_requests=[]
def navigate(self,*args,**kwargs):
 if not getattr(self,'_apex_factory_observer',False):
  self.on('request',lambda r:factory_requests.append(r.url) if urllib.parse.urlsplit(r.url).path.endswith('/aircraft.js') else None)
  self._apex_factory_observer=True
 kwargs.setdefault('timeout',int(os.environ.get('APEX_TEST_NAVIGATION_TIMEOUT_MS','120000')))
 return original_goto(self,*args,**kwargs)
Page.goto=navigate
class RemoteResponse:
 def __init__(self,url):
  with urllib.request.urlopen(url,timeout=90) as r:
   assert r.status==200;self.body=r.read().decode()
 def text(self):return self.body
binary_fetches=[]
def fulfill_remote_binary(route):
 # Keep the held first-source response on the same inherited proxy/CA path.
 # Only the test's timing is controlled; no candidate/local bytes are injected.
 with urllib.request.urlopen(route.request.url,timeout=120) as response:
  assert response.status==200
  data=response.read();content_type=response.headers.get('Content-Type','application/octet-stream')
 binary_fetches.append(dict(url=route.request.url,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
 route.fulfill(status=200,content_type=content_type,body=data)
source=Path(sys.argv[1]).read_text()
# Inspection suites use both compact and spaced Python assignments. Match
# whitespace explicitly so every text-response hook uses the same approved
# inherited-proxy client, rather than silently leaving Route.fetch behind.
source,count=re.subn(r'\b(response|res)\s*=\s*(route|r)\.fetch\(\)',lambda m:m[1]+'=RemoteResponse('+m[2]+'.request.url)',source)
if not count:raise ValueError('No supported text-response hook in inspection suite')
source=re.sub(r'(?<=\.fulfill\()response\s*=\s*(?:response|res)\s*,\s*body\s*=',"status=200,content_type='text/javascript',body=",source)
source=re.sub(r'\b(route|r)\.fulfill\(response=\1\.fetch\(timeout=120000\)\)',lambda m:'fulfill_remote_binary('+m[1]+')',source)
exec(compile(source,sys.argv[1],'exec'),globals())
print(json.dumps(dict(observedAircraftFactoryUrls=sorted(set(factory_requests)),observedFactoryRequests=len(factory_requests))),flush=True)
if binary_fetches:print(json.dumps(dict(actualRemoteBinaryResponses=binary_fetches)),flush=True)
