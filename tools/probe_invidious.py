"""One-shot safe diagnostics for public Invidious instances.
Requests metadata for a known public YouTube video. No cookies or tokens are used.
We do not scrape sites or bypass access controls.
"""
import concurrent.futures
import json
import os
import time
import urllib.error
import urllib.request

VIDEO_ID = os.environ.get("FRAME_PROBE_VIDEO_ID", "XDbJL-OZW1A")
HOSTS = (
    "inv.nadeko.net",
    "invidious.nerdvpn.de",
    "yt.chocolatemoo53.com",
    "invidious.tiekoetter.com",
)

def check(host: str):
    url = f"https://{host}/api/v1/videos/{VIDEO_ID}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent":"FrameStudio/1.0 (personal diagnostic)"})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            status = resp.status
            body = resp.read(400_000)
        if status != 200:
            return {"host": host, "status": status, "result": "http"}
        data = json.loads(body)
        if not isinstance(data, dict):
            return {"host": host, "result": "invalid-json"}
        formats = data.get("formatStreams") or []
        adaptive = data.get("adaptiveFormats") or []
        return {"host":host, "result":"ok", "videoId_matches":data.get("videoId")==VIDEO_ID,
          "has_title":bool(data.get("title")), "formats":len(formats),
          "adaptive":len(adaptive), "has_hls":bool(data.get("hlsUrl")),
          "has_proxy_uri":any(str(f.get("url", "")).startswith("/") for f in formats if isinstance(f, dict)),
          "seconds":round(time.monotonic()-started,2)}
    except urllib.error.HTTPError as e:
        return {"host":host, "result":"http-error","status":e.code}
    except Exception as e:
        return {"host":host, "result":"network-error","type":type(e).__name__}

def main():
    print("FRAME_ALT: begin, publicly listed instances, metadata only", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(check,HOSTS):
            print("FRAME_ALT: "+json.dumps(result, ensure_ascii=False), flush=True)
    print("FRAME_ALT: finished", flush=True)

if __name__ == "__main__":
    main()
