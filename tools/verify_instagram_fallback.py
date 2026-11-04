"""One-shot actual Render Reel failover download check with a published bug example."""
import json
import subprocess
import tempfile
from pathlib import Path

from instagram_reel_fallback import inspect, obtain_source
from server import Job, _encode

URL="https://www.instagram.com/reel/DZdOSuOyu2E/"
def log(**kw):
    print("FRAME_IGREELCHECK: "+json.dumps(kw),flush=True)

try:
    item=inspect(URL)
    log(step="inspect",ok=True,provider=item["provider"])
    with tempfile.TemporaryDirectory(prefix="frame-reel-failover-") as dirname:
        folder=Path(dirname)
        source=obtain_source(URL,folder,100*1024*1024,lambda p,msg:None)
        probe=json.loads(subprocess.check_output([
            "ffprobe","-v","error","-show_entries",
            "format=duration:stream=codec_type,codec_name,width,height",
            "-of","json",str(source)],timeout=16))
        dur=float(probe["format"].get("duration",0))
        videos=[x for x in probe["streams"] if x.get("codec_type")=="video"]
        audios=[x for x in probe["streams"] if x.get("codec_type")=="audio"]
        log(step="source",ok=bool(videos and dur>0),bytes=source.stat().st_size,
            duration=round(dur,2),video_codec=videos[0].get("codec_name") if videos else None,
            audio_count=len(audios))
        if not videos or dur<=0:
            raise RuntimeError("Invalid video source")
        out=folder/"clip.mp4"
        _encode(Job(id="reel-verification",video_id=item["id"]),source,out,
                mode="mp4",start=0.0,end=min(2.0,dur),duration=dur,bitrate=192)
        log(step="mp4",ok=out.is_file() and out.stat().st_size>1000,
            bytes=out.stat().st_size if out.is_file() else 0)
    log(step="finished",ok=True)
except Exception as exc:
    log(step="failed",error_type=type(exc).__name__,
        message=str(exc)[:160])
