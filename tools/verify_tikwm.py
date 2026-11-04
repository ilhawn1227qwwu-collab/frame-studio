"""One-shot smoke test of opt-in TikWM media transfer and MP4 export on Render."""
import json
import subprocess
import tempfile
from pathlib import Path
from social_tikwm import inspect, obtain_source
from server import Job, _encode

URL="https://www.tiktok.com/@matatogames/video/7179163174057364742"

def log(**kw):
    print("FRAME_TIKWM_VERIFY: "+json.dumps(kw),flush=True)

log(step="begin")
try:
    info=inspect(URL)
    log(step="metadata",ok=True,duration=info["duration"])
    with tempfile.TemporaryDirectory(prefix="frame-tiktok-check-") as tmp:
        folder=Path(tmp)
        source=obtain_source(URL,folder,70*1024*1024,
                             lambda pct,msg:None)
        info_bytes=source.stat().st_size
        media=json.loads(subprocess.check_output([
            "ffprobe","-v","error","-show_entries",
            "stream=codec_type,codec_name,width,height",
            "-of","json",str(source)
        ],timeout=18))
        vids=[x for x in media["streams"] if x.get("codec_type")=="video"]
        log(step="source",ok=bool(vids),bytes=info_bytes,
            codec=vids[0].get("codec_name") if vids else None,
            width=vids[0].get("width") if vids else None,
            height=vids[0].get("height") if vids else None)
        output=folder/"test.mp4"
        _encode(Job(id="tikwm-test",video_id=info["id"]),source,output,
            mode="mp4",start=0,end=min(3.0,info["duration"]),
            duration=float(info["duration"]),bitrate=192)
        log(step="mp4",ok=output.is_file() and output.stat().st_size>1000,
            bytes=output.stat().st_size)
    log(step="finished",ok=True)
except Exception as exc:
    log(step="failed",kind=type(exc).__name__,
        message=str(exc)[:130] if type(exc).__name__=="TikWMError" else "internal media test failure")
