"""One-shot test of the publicly reachable TikWM service API.
No media download; logs only status and trusted host names.
"""
import json
import time
import urllib.parse
import urllib.request

video="https://www.tiktok.com/@matatogames/video/7179163174057364742"
try:
    body=urllib.parse.urlencode({"url":video,"hd":"1"}).encode()
    req=urllib.request.Request("https://www.tikwm.com/api/",data=body,
        headers={"Content-Type":"application/x-www-form-urlencoded",
                 "User-Agent":"Mozilla/5.0 (compatible; FrameStudio/1.0)"},
        method="POST")
    start=time.monotonic()
    with urllib.request.urlopen(req,timeout=17) as response:
        text=response.read(180_000)
        status=response.status
    data=json.loads(text)
    media=data.get("data") if isinstance(data,dict) else {}
    def hostname(key):
        url=media.get(key) if isinstance(media,dict) else None
        if isinstance(url,str):
            return urllib.parse.urlsplit(urllib.parse.urljoin("https://www.tikwm.com/",url)).hostname
        return None
    print("FRAME_TIKWM: "+json.dumps({
        "status":status,"code":data.get("code") if isinstance(data,dict) else None,
        "has_media":bool(media and media.get("play")),
        "duration":media.get("duration") if isinstance(media,dict) else None,
        "play_host":hostname("play"),"hdplay_host":hostname("hdplay"),
        "seconds":round(time.monotonic()-start,2)
    }),flush=True)
except Exception as exc:
    print("FRAME_TIKWM: "+json.dumps({
        "error":type(exc).__name__, "code":getattr(exc,"code",None)
    }),flush=True)
