"""One-shot, low-volume real Instagram reel/photo export verification.

Creates small temporary MP4 and image ZIP artifacts and deletes them.
Does not log signed CDN links or account/session details.
"""
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from instagram_vx import inspect, download, InstagramVXError
from server import Job, _encode

CASES = (
    ("reel", "https://www.instagram.com/reel/DZntaBKS0AR/"),
    ("photos", "https://www.instagram.com/p/DCkNonioVx2/"),
    ("post_video", "https://www.instagram.com/p/DTktHNTCIDf/"),
)

def log(**kw):
    print("FRAME_IGVERIFY: "+json.dumps(kw,ensure_ascii=False),flush=True)

for label,url in CASES:
    try:
        d=inspect(url)
        log(case=label,step="inspect",content_type=d["content_type"],
            count=d.get("photo_count",0),provider=d["provider"])
        with tempfile.TemporaryDirectory(prefix="frame-igcheck-") as tmp:
            folder=Path(tmp)
            path,filename,is_video=download(url,folder,100*1024*1024,lambda pct,msg:None)
            log(case=label,step="download",bytes=path.stat().st_size,
                is_video=is_video,extension=path.suffix)
            if is_video:
                probe=json.loads(subprocess.check_output([
                    "ffprobe","-v","error","-show_entries",
                    "format=duration:stream=codec_type,codec_name,width,height",
                    "-of","json",str(path)
                ],timeout=16))
                duration=float(probe.get("format",{}).get("duration") or 0)
                videos=[s for s in probe["streams"] if s.get("codec_type")=="video"]
                audios=[s for s in probe["streams"] if s.get("codec_type")=="audio"]
                log(case=label,step="probe",duration=round(duration,2),
                    video_codec=videos[0].get("codec_name") if videos else None,
                    width=videos[0].get("width") if videos else None,
                    height=videos[0].get("height") if videos else None,
                    audio_streams=len(audios))
                if not videos or duration <= 0:
                    raise RuntimeError("source missing video or duration")
                output=folder/"test.mp4"
                _encode(Job(id="test",video_id=d["id"]),path,output,
                    mode="mp4",start=0,end=min(2.5,duration),
                    duration=duration,bitrate=192)
                log(case=label,step="mp4",ok=output.is_file() and output.stat().st_size>2048,
                    bytes=output.stat().st_size)
            else:
                import zipfile
                if path.suffix==".zip":
                    with zipfile.ZipFile(path) as archive:
                        extensions=[Path(n).suffix for n in archive.namelist()]
                    log(case=label,step="zip",items=len(extensions),
                        extensions=extensions[:12])
                else:
                    log(case=label,step="photo",extension=path.suffix,
                        bytes=path.stat().st_size)
        log(case=label,step="finished",ok=True)
    except Exception as exc:
        log(case=label,step="failed",kind=type(exc).__name__,
            message=str(exc)[:170] if isinstance(exc,InstagramVXError) else "internal check failure")
print("FRAME_IGVERIFY: finished",flush=True)
