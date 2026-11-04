"""One-time media-byte probe of alternate public Instagram reel previews.
Tests only fixed public examples; no signed URL logging or downloads.
"""
import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

SAMPLES=[
 ("verified","reel","DZntaBKS0AR"),
 ("reel_issue","reel","DZdOSuOyu2E"),
 ("example_2026","reel","DUnxGL8Et7s"),
]
HOSTS=["instagramfix.com","kirkstagram.com","oginstagram.com","hhinstagram.com"]
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl): return None
opener=urllib.request.build_opener(NoRedirect())
def get(req,timeout=12):
 with opener.open(req,timeout=timeout) as r:
  return r.status,r.headers,r.read(160001)
def media_from_ht(content):
 for tag in re.findall(r'<meta\b[^>]*>',content,re.I):
  p=re.search(r'(?:property|name)=["\']([^"\']+)',tag,re.I)
  c=re.search(r'content=["\']([^"\']+)',tag,re.I)
  if p and c and p.group(1).lower() in ('og:video','twitter:player:stream'):
   return html.unescape(c.group(1))
 return None
def check(sample):
 label,route,code,host=sample
 url=f"https://{host}/{route}/{code}/"
 report={"sample":label,"host":host}
 try:
  request=urllib.request.Request(url,headers={"User-Agent":"Twitterbot/1.0"})
  _,_,body=get(request)
  content=body.decode("utf-8","replace")
  resource=media_from_ht(content)
  if not resource:
   return {**report,"step":"metadata","result":"missing"}
  path=urllib.parse.urljoin(url,resource)
  parsed=urllib.parse.urlsplit(path)
  if parsed.scheme!="https" or parsed.hostname!=host:
   return {**report,"step":"metadata","result":"untrusted","media_host":parsed.hostname}
  request=urllib.request.Request(path,headers={
   "Range":"bytes=0-4095","User-Agent":"Twitterbot/1.0",
   "Accept":"video/*,*/*"})
  try:
   with opener.open(request,timeout=13) as r:
    chunk=r.read(4096)
    return {**report,"step":"media","status":r.status,"type":r.headers.get("content-type","")[:40],
        "bytes":len(chunk),"sample_magic":chunk[:8].hex()}
  except urllib.error.HTTPError as e:
   target=urllib.parse.urljoin(path,e.headers.get("location",""))
   t=urllib.parse.urlsplit(target)
   out={**report,"step":"media_redirect","status":e.code,"target_host":t.hostname}
   if e.code not in (301,302,303,307,308):return out
   if t.scheme!="https" or not t.hostname or not (
     t.hostname.endswith(".cdninstagram.com") or
     t.hostname.endswith(".fbcdn.net")):return out
   try:
    with opener.open(urllib.request.Request(target,headers={
        "Range":"bytes=0-4095","User-Agent":"Mozilla/5.0"}),timeout=13) as r:
     chunk=r.read(4096)
     return {**out,"cdn_status":r.status,"type":r.headers.get("content-type","")[:40],
             "bytes":len(chunk),"sample_magic":chunk[:8].hex()}
   except urllib.error.HTTPError as e2:
    return {**out,"cdn_status":e2.code}
   except Exception as e2:
    return {**out,"cdn_error":type(e2).__name__}
 except urllib.error.HTTPError as e:
  return {**report,"error":"http","status":e.code}
 except Exception as e:
  return {**report,"error":type(e).__name__}
outcomes=[(*a,host) for a in SAMPLES for host in HOSTS]
with ThreadPoolExecutor(max_workers=4) as executor:
 for future in as_completed([executor.submit(check,v) for v in outcomes]):
  print("FRAME_IGMEDIAPROBE: "+json.dumps(future.result()),flush=True)
print("FRAME_IGMEDIAPROBE: finished",flush=True)
