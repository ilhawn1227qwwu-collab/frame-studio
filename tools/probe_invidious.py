"""One-shot probe of media transfer via one documented public Invidious instance.
Only tests up to 4 KiB per candidate, no cookies, no content saved.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

VIDEO_ID = os.environ.get("FRAME_PROBE_VIDEO_ID", "XDbJL-OZW1A")
HOST = "yt.chocolatemoo53.com"
BASE = "https://" + HOST

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

opener = urllib.request.build_opener(NoRedirect)

def allow_url(url):
    u=urllib.parse.urlsplit(url)
    if u.scheme!="https": return False
    host=(u.hostname or "").lower()
    return (host == HOST or host == "googlevideo.com" or host.endswith(".googlevideo.com"))

def probe_meta(path):
    started=time.monotonic()
    url=BASE+path
    try:
        req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"FrameStudio/1.0"})
        with opener.open(req,timeout=15) as resp:
            if resp.status!=200: return None
            data=json.loads(resp.read(500000))
        print("FRAME_STREAM:",json.dumps({"step":"metadata","variant":path.split('?')[-1] if '?' in path else "regular",
                "ok":True,"formatStreams":len(data.get("formatStreams") or []),
                "adaptiveFormats":len(data.get("adaptiveFormats") or [])}),flush=True)
        return data
    except Exception as e:
        print("FRAME_STREAM:",json.dumps({"step":"metadata","variant":path,"error":type(e).__name__,"status":getattr(e,"code",None)}),flush=True)
        return None

def check_stream(name,raw):
    if not raw:
        print("FRAME_STREAM:",json.dumps({"stream":name,"result":"missing"}),flush=True); return
    url=urllib.parse.urljoin(BASE,raw)
    parts=urllib.parse.urlsplit(url)
    if not allow_url(url):
        print("FRAME_STREAM:",json.dumps({"stream":name,"result":"rejected-host"}),flush=True);return
    req=urllib.request.Request(url,headers={"Range":"bytes=0-4095","User-Agent":"FrameStudio/1.0","Accept":"*/*"})
    started=time.monotonic()
    try:
        with opener.open(req,timeout=14) as response:
            data=response.read(4096)
            status=response.status
            content_type=response.headers.get("content-type","")[:70]
        print("FRAME_STREAM:",json.dumps({"stream":name,"result":"response","status":status,
            "type":content_type,"bytes":len(data),"seconds":round(time.monotonic()-started,2)}),flush=True)
    except urllib.error.HTTPError as e:
        redirect=e.headers.get("location","") if e.code in (301,302,303,307,308) else ""
        print("FRAME_STREAM:",json.dumps({"stream":name,"result":"http-error","status":e.code,
           "redirect_host":urllib.parse.urlsplit(redirect).hostname}),flush=True)
    except Exception as e:
        print("FRAME_STREAM:",json.dumps({"stream":name,"result":"network-error","error":type(e).__name__}),flush=True)

def main():
    print("FRAME_STREAM: starting limited 4KB media checks",flush=True)
    for name,path in (("regular",f"/api/v1/videos/{VIDEO_ID}"),("local",f"/api/v1/videos/{VIDEO_ID}?local=true")):
        data=probe_meta(path)
        if data is None:continue
        fmts=data.get("adaptiveFormats") or []
        aud=[f for f in fmts if isinstance(f,dict) and "audio/" in str(f.get("type",""))]
        vid=[f for f in fmts if isinstance(f,dict) and "video/" in str(f.get("type",""))]
        if aud:check_stream(name+"_audio", aud[0].get("url"))
        if vid:check_stream(name+"_video", vid[0].get("url"))
        if data.get("hlsUrl"):check_stream(name+"_hls",data["hlsUrl"])
    print("FRAME_STREAM: finished",flush=True)

if __name__=="__main__":main()
