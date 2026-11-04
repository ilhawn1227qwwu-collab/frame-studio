"""One-shot anonymous, read-only Instagram public proxy/embed diagnostics.
Never print resolved media URLs, credentials, or personal identifiers.
No media downloads; only bounded HTML meta inspections.
"""
import html
import json
import re
import time
import urllib.parse
import urllib.request
import urllib.error

CASES = [
    ("video", "p", "DTktHNTCIDf"),
    ("reel", "reel", "DZntaBKS0AR"),
    ("photo", "p", "DCkNonioVx2"),
]
SERVICES = [
    ("ddinstagram", "https://www.ddinstagram.com/{type}/{code}/"),
    ("ddinstagram_no_www", "https://ddinstagram.com/{type}/{code}/"),
    ("vxinstagram", "https://www.vxinstagram.com/{type}/{code}/"),
    ("instagram_embed", "https://www.instagram.com/{type}/{code}/embed/captioned/"),
]
META_PATTERN = re.compile(r'<meta\b[^>]*(?:property|name)\s*=\s*["\'](?:og:video|og:image|twitter:player:stream|twitter:image)["\'][^>]*>',re.I)
CONTENT_PATTERN = re.compile(r'\bcontent\s*=\s*["\']([^"\']+)',re.I)
MEDIA_PATTERN = re.compile(r'https?[^"\\ ]{5,500}\.(?:mp4|jpg|jpeg|webp)',re.I)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,request,fp,code,msg,headers,newurl):return None
opener=urllib.request.build_opener(NoRedirect())

for kind,typ,code in CASES:
    for service,template in SERVICES:
        start=time.monotonic()
        url=template.format(type=typ,code=code)
        req=urllib.request.Request(url,headers={
            "User-Agent":"Twitterbot/1.0",
            "Accept":"text/html,application/xhtml+xml",
        })
        try:
            with opener.open(req,timeout=12) as response:
                data=response.read(290001)
                ctype=response.headers.get("content-type","")[:45]
                status=response.status
            fragment=data.decode("utf-8","replace")
            tags=META_PATTERN.findall(fragment)
            parsed=[]
            for tag in tags:
                c=CONTENT_PATTERN.search(tag)
                if c:
                    val=html.unescape(c.group(1))
                    parsed.append({"kind":"video" if ("og:video" in tag.lower() or "stream" in tag.lower()) else "image",
                        "host":urllib.parse.urlsplit(val).hostname})
            print("FRAME_INSTAPROBE: "+json.dumps({
                "case":kind,"service":service,"status":status,
                "bytes":len(data),"ctype":ctype,"metadata":parsed[:8],
                "html_media_refs":len(MEDIA_PATTERN.findall(fragment)),
                "seconds":round(time.monotonic()-start,2),
            }),flush=True)
        except urllib.error.HTTPError as e:
            print("FRAME_INSTAPROBE: "+json.dumps({"case":kind,"service":service,"status":e.code}),flush=True)
        except Exception as e:
            print("FRAME_INSTAPROBE: "+json.dumps({"case":kind,"service":service,
                "error":type(e).__name__}),flush=True)
print("FRAME_INSTAPROBE: finished",flush=True)
