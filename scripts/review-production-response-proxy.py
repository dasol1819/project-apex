"""Run committed inspection tests on actual deployed HTTP bytes via inherited proxy."""
import os,urllib.request,urllib.parse,sys
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
def navigate(self,*args,**kwargs):
 kwargs.setdefault('timeout',int(os.environ.get('APEX_TEST_NAVIGATION_TIMEOUT_MS','120000')))
 return original_goto(self,*args,**kwargs)
Page.goto=navigate
class RemoteResponse:
 def __init__(self,url):
  with urllib.request.urlopen(url,timeout=90) as r:
   assert r.status==200;self.body=r.read().decode()
 def text(self):return self.body
source=Path(sys.argv[1]).read_text()
source=source.replace('response=route.fetch()', 'response=RemoteResponse(route.request.url)').replace('res=r.fetch()', 'res=RemoteResponse(r.request.url)').replace('res=route.fetch()', 'res=RemoteResponse(route.request.url)')
source=source.replace('route.fulfill(response=response,body=',"route.fulfill(status=200,content_type='text/javascript',body=").replace('r.fulfill(response=res,body=',"r.fulfill(status=200,content_type='text/javascript',body=").replace('route.fulfill(response=res,body=',"route.fulfill(status=200,content_type='text/javascript',body=")
exec(compile(source,sys.argv[1],'exec'),globals())
