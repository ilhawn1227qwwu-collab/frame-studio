"""One-shot, read-only Instagram alternate metadata diagnostic.

Only public post codes from published technical samples; no user URL logging.
Tests GraphQL and public embed/Relay HTML. No CDN media is downloaded.
"""
import json
import re
import urllib.error
import urllib.parse
import urllib.request
import http.cookiejar
from concurrent.futures import ThreadPoolExecutor, as_completed

CASES=[
    ("verified", "reel", "DZntaBKS0AR"),
    ("github_issue", "reel", "DZdOSuOyu2E"),
    ("reel_example", "reels", "DUnxGL8Et7s"),
    ("repo_sample","reel","DreNydTjnL"),
]
DOC_ID="27128499623469141"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
jar=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def get_base():
    request=urllib.request.Request("https://www.instagram.com/",headers={
        "User-Agent":UA,"Accept":"text/html"})
    try:
        with opener.open(request,timeout=12) as response:
            chunk=response.read(12800)
            return response.status, response.headers.get("content-type","")[:50]
    except Exception as exc:
        return type(exc).__name__, ""

status,ctype=get_base()
print("FRAME_IGFALLBACK: "+json.dumps({
    "case":"bootstrap","status":status,"cookie_names":[c.name for c in jar],
}),flush=True)
csrf=next((c.value for c in jar if c.name=="csrftoken"),"")

def test(case):
    label,route,ident=case
    output=[]
    url=f"https://www.instagram.com/{route}/{ident}/embed/captioned/"
    try:
        req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"text/html"})
        with opener.open(req,timeout=14) as response:
            blob=response.read(360001)
            html=blob.decode("utf-8","replace")
            output.append({
                "mode":"embed","status":response.status,"bytes":len(blob),
                "video_versions":html.count('"video_versions"')+html.count('\\"video_versions\\"'),
                "mp4_mentions":html.lower().count(".mp4"),"video_url":html.count('"video_url"'),
                "image_versions":html.count("image_versions2"),
                "has_shortcode":ident in html,
            })
    except urllib.error.HTTPError as exc:
        output.append({"mode":"embed","status":exc.code})
    except Exception as exc:
        output.append({"mode":"embed","error":type(exc).__name__})
    body=urllib.parse.urlencode({
        "doc_id":DOC_ID,
        "variables":json.dumps({
            "shortcode":ident,
            "__relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider":False
        },separators=(",",":"))
    }).encode()
    req=urllib.request.Request("https://www.instagram.com/graphql/query",
        data=body,method="POST",headers={
            "User-Agent":UA,"X-IG-App-ID":"936619743392459",
            "X-CSRFToken":csrf,"Content-Type":"application/x-www-form-urlencoded",
            "Referer":url,"Origin":"https://www.instagram.com",
            "Accept":"application/json",
        })
    try:
        with opener.open(req,timeout=16) as response:
            raw=response.read(250001)
            obj=json.loads(raw)
            data=obj.get("data") or {}
            med=data.get("xdt_api__v1__media__shortcode__web_info") or {}
            items=med.get("items") if isinstance(med,dict) else None
            item=items[0] if isinstance(items,list) and items else {}
            output.append({"mode":"graphql","status":response.status,
                "items":len(items) if isinstance(items,list) else None,
                "fields":sorted(k for k in item if k in (
                    "video_versions","image_versions2","carousel_media","video_duration",
                    "media_type","code","is_video")),
                "errors":[x.get("code") or x.get("message","")[:35] for x in obj.get("errors",[])[:2]],
                "bytes":len(raw)})
    except urllib.error.HTTPError as exc:
        output.append({"mode":"graphql","status":exc.code})
    except Exception as exc:
        output.append({"mode":"graphql","error":type(exc).__name__})
    return label,output

with ThreadPoolExecutor(max_workers=3) as pool:
    future=[pool.submit(test,item) for item in CASES]
    for t in as_completed(future):
        name,outputs=t.result()
        for result in outputs:
            print("FRAME_IGFALLBACK: "+json.dumps({"case":name,**result}),flush=True)
print("FRAME_IGFALLBACK: finished",flush=True)
