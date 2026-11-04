"""One-shot byte-range media verification from vxinstagram public embed API.

Log only media types, redirect hostnames, content-types and byte counts.
No media URL tokens, post descriptions or user handles are logged.
"""
import base64
import json
import urllib.parse
import urllib.request
import urllib.error
import time

POSTS=(
    ("video","p","DTktHNTCIDf"),
    ("photo","p","DCkNonioVx2"),
    ("reel","reel","DZntaBKS0AR"),
)
ORIGIN="https://www.vxinstagram.com"
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):return None
opener=urllib.request.build_opener(NoRedirect())

def probe(path):
    request=urllib.request.Request(path,headers={"Accept":"application/json", "User-Agent":"FrameStudio/1.0"})
    with opener.open(request,timeout=16) as resp:
        blob=resp.read(190001)
        return resp.status,resp.headers.get("content-type",""),blob

for case,kind,ident in POSTS:
    try:
        url=f"https://www.instagram.com/{kind}/{ident}/"
        payload=(f"{ident}&0&"+url).encode()
        enc=base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
        status,ctype,raw=probe(f"{ORIGIN}/api/v1/statuses/{enc}")
        data=json.loads(raw)
        media=data.get("media_attachments") or []
        print("FRAME_INSTAVX: "+json.dumps({
            "case":case,"step":"metadata","status":status,
            "count":len(media),"types":[x.get("type") for x in media],
            "id_present":bool(data.get("id"))
        }),flush=True)
        if not media: continue
        for index,m in enumerate(media[:2]):
            offload=m.get("url")
            if not isinstance(offload,str):continue
            parsed=urllib.parse.urlsplit(offload)
            if parsed.hostname not in ("www.vxinstagram.com","vxinstagram.com"):continue
            request=urllib.request.Request(offload,headers={
               "Range":"bytes=0-4095", "User-Agent":"FrameStudio/1.0"
            })
            try:
                with opener.open(request,timeout=18) as resp:
                    bytes_received=resp.read(4096)
                    print("FRAME_INSTAVX: "+json.dumps({
                        "case":case,"step":"offload","index":index,
                        "status":resp.status,"bytes":len(bytes_received),
                        "type":resp.headers.get("content-type","")[:55],
                    }),flush=True)
            except urllib.error.HTTPError as e:
                redirect=e.headers.get("location","")
                target=urllib.parse.urlsplit(redirect)
                print("FRAME_INSTAVX: "+json.dumps({
                    "case":case,"step":"redirect","index":index,
                    "status":e.code,"target_host":target.hostname,
                    "path_extension":target.path.rsplit(".",1)[-1][-6:],
                }),flush=True)
                if e.code not in (301,302,303,307,308):continue
                if not target.hostname or not (target.hostname.endswith(".cdninstagram.com") or target.hostname.endswith(".fbcdn.net")):
                    continue
                try:
                    with opener.open(urllib.request.Request(redirect,headers={
                        "Range":"bytes=0-4095", "User-Agent":"Mozilla/5.0"
                    }),timeout=17) as resp:
                        block=resp.read(4096)
                        print("FRAME_INSTAVX: "+json.dumps({
                            "case":case,"step":"media","index":index,
                            "status":resp.status,"bytes":len(block),
                            "content_type":resp.headers.get("content-type","")[:65]
                        }),flush=True)
                except urllib.error.HTTPError as err:
                    print("FRAME_INSTAVX: "+json.dumps({
                        "case":case,"step":"media","index":index,"status":err.code
                    }),flush=True)
                except Exception as err:
                    print("FRAME_INSTAVX: "+json.dumps({
                        "case":case,"step":"media","index":index,"error":type(err).__name__
                    }),flush=True)
    except urllib.error.HTTPError as e:
        print("FRAME_INSTAVX: "+json.dumps({"case":case,"error":"http","status":e.code}),flush=True)
    except Exception as e:
        print("FRAME_INSTAVX: "+json.dumps({"case":case,"error":type(e).__name__}),flush=True)
print("FRAME_INSTAVX: finished",flush=True)
