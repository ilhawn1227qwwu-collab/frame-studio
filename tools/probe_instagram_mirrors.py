"""One-shot bounded public Instagram preview alternatives: metadata only.
Never print signed URLs or private data. Test only public documented post IDs.
"""
import json
import re
import html
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor,as_completed

SAMPLES=[
 ("known_reel","reel","DZntaBKS0AR"),
 ("reel_issue","reel","DZdOSuOyu2E"),
 ("reel_2026","reel","DUnxGL8Et7s"),
]
PROVIDERS=[
 ("instagramfix","instagramfix.com"),
 ("kirkstagram","kirkstagram.com"),
 ("instagram7","www.instagram7.com"),
 ("instafix_ir","ddinsta.ir"),
 ("mbdinstagram","mbdinstagram.com"),
 ("uuinstagram","www.uuinstagram.com"),
 ("zzinstagram","zzinstagram.com"),
 ("oginstagram","oginstagram.com"),
 ("hhinstagram","hhinstagram.com"),
]
PATTERN=re.compile(r'<meta\b[^>]+>',re.I)
PROPERTIES=("og:video","twitter:player:stream","og:image","twitter:image")
def extract_meta(ht):
  found=[]
  for tag in PATTERN.findall(ht):
    if any(x in tag.lower() for x in PROPERTIES):
      p=re.search(r'(?:property|name)=["\']([^"\']+)',tag,re.I)
      c=re.search(r'content=["\']([^"\']+)',tag,re.I)
      if p and c and p.group(1).lower() in PROPERTIES:
        url=html.unescape(c.group(1))
        host=urllib.parse.urlsplit(url).hostname
        found.append({"kind":p.group(1),"host":host,
                      "extension":urllib.parse.urlsplit(url).path.rsplit(".",1)[-1][:10]})
  return found
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):return None
opener=urllib.request.build_opener(NoRedirect())

def check(a):
 sample,route,shortcode,provider,hostname=a
 url=f"https://{hostname}/{route}/{shortcode}/"
 req=urllib.request.Request(url,headers={
  "User-Agent":"Twitterbot/1.0","Accept":"text/html,*/*"
 })
 try:
  with opener.open(req,timeout=10) as response:
   data=response.read(200001)
   info={"status":response.status,"ctype":response.headers.get("content-type","")[:30],
         "meta":extract_meta(data.decode("utf-8","replace"))[:5],"bytes":len(data)}
 except urllib.error.HTTPError as exc:
  info={"status":exc.code,"redirect_host":urllib.parse.urlsplit(exc.headers.get("location","")).hostname}
 except Exception as exc:
  info={"error":type(exc).__name__}
 return {"sample":sample,"provider":provider,**info}

calls=[(n,route,sc,alias,host) for n,route,sc in SAMPLES for alias,host in PROVIDERS]
with ThreadPoolExecutor(max_workers=5) as pool:
  future=[pool.submit(check,x) for x in calls]
  for f in as_completed(future):
   print("FRAME_IGMIRRORS: "+json.dumps(f.result()),flush=True)
print("FRAME_IGMIRRORS: finished",flush=True)
