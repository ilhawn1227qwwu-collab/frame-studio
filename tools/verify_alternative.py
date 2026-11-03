"""One-shot end-to-end test of a short user-selected media export.
No content is shared or persisted: temporary files are deleted when complete.
Runs only when FRAME_VERIFY_ALT=1, separately from the HTTP server.
"""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from alternative import AlternativeError, inspect as inspect_alt, obtain_source
from server import Job, _encode

ID = os.environ.get("FRAME_PROBE_VIDEO_ID", "XDbJL-OZW1A")

def log(**data):
    print("FRAME_VERIFY: " + json.dumps(data, ensure_ascii=False), flush=True)

def verify():
    log(step="begin")
    try:
        info = inspect_alt(ID)
        quality = max(info["qualities"]) if os.getenv("FRAME_VERIFY_QUALITY") == "best" else min(info["qualities"])
        log(step="metadata", ok=True, quality=quality,
            duration=info["duration"], options=len(info["qualities"]),
            audio_modes=info.get("audio_modes", []))
        with tempfile.TemporaryDirectory(prefix="frame-verify-") as tmp:
            folder = Path(tmp)
            def update(progress, message):
                if progress in (5, 32, 76):
                    log(step="progress", progress=progress)
            source = obtain_source(ID, "mp4", quality, folder, update)
            log(step="download", ok=True, source_bytes=source.stat().st_size)
            probe = subprocess.check_output([
                "ffprobe", "-v", "error", "-show_entries",
                "stream=codec_name,codec_type,width,height", "-of", "json",
                str(source)], timeout=16)
            streams = json.loads(probe).get("streams", [])
            video_details = next((x for x in streams if x.get("codec_type") == "video"), {})
            audio_details = next((x for x in streams if x.get("codec_type") == "audio"), {})
            log(step="source_quality", height=video_details.get("height"),
                video_codec=video_details.get("codec_name"),
                audio_codec=audio_details.get("codec_name"))
            if os.getenv("FRAME_VERIFY_QUALITY") == "best" and video_details.get("height") != quality:
                raise RuntimeError("Selected source video resolution did not match quality")
            export_end = float(info["duration"]) if os.getenv("FRAME_VERIFY_FULL") == "1" else min(3.0, info["duration"])
            def file_duration(path):
                output = subprocess.check_output([
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=nw=1:nk=1", str(path)
                ], timeout=15)
                return float(output.decode("utf-8").strip())
            target_mp4 = folder / "clip.mp4"
            _encode(Job(id="verify", video_id=ID), source, target_mp4,
                    mode="mp4", start=0, end=export_end,
                    duration=float(info["duration"]), bitrate=192)
            mp4_duration = file_duration(target_mp4)
            mp4_ok = target_mp4.is_file() and target_mp4.stat().st_size > 1000 and abs(mp4_duration-export_end)<5
            log(step="mp4", ok=mp4_ok, bytes=target_mp4.stat().st_size,
                duration=round(mp4_duration, 2), expected_duration=export_end)
            if not mp4_ok:
                raise RuntimeError("MP4 file duration validation failed")
            audio_source = (source if os.getenv("FRAME_VERIFY_REUSE_AUDIO") == "1"
                            else obtain_source(ID, "mp3", 192, folder, update))
            target_mp3 = folder / "clip.mp3"
            _encode(Job(id="verify-audio", video_id=ID), audio_source, target_mp3,
                    mode="mp3", start=0, end=export_end,
                    duration=float(info["duration"]), bitrate=192)
            mp3_duration = file_duration(target_mp3)
            mp3_ok = target_mp3.is_file() and target_mp3.stat().st_size > 1000 and abs(mp3_duration-export_end)<5
            log(step="mp3", ok=mp3_ok, bytes=target_mp3.stat().st_size,
                duration=round(mp3_duration, 2), expected_duration=export_end)
            if not mp3_ok:
                raise RuntimeError("MP3 file duration validation failed")
            if os.getenv("FRAME_VERIFY_ORIGINAL_AUDIO") == "1":
                for original_mode, expected_codec in (("m4a", "aac"), ("opus", "opus")):
                    if original_mode not in info.get("audio_modes", []):
                        log(step=original_mode, available=False)
                        continue
                    original_source = obtain_source(ID, original_mode, 0, folder, update)
                    target = folder / ("original." + original_mode)
                    _encode(Job(id="verify-"+original_mode, video_id=ID),
                            original_source, target, mode=original_mode,
                            start=0, end=min(3.0, info["duration"]),
                            duration=float(info["duration"]), bitrate=0)
                    original_streams = json.loads(subprocess.check_output([
                        "ffprobe", "-v", "error", "-show_entries", "stream=codec_name",
                        "-of", "json", str(target)], timeout=16)).get("streams", [])
                    is_ok = bool(original_streams and original_streams[0].get("codec_name") == expected_codec
                        and target.stat().st_size > 1000)
                    log(step=original_mode, ok=is_ok, bytes=target.stat().st_size,
                        codec=original_streams[0].get("codec_name") if original_streams else "")
                    if not is_ok:
                        raise RuntimeError("Original audio format validation failed")
        log(step="finished", ok=True)
    except Exception as e:
        log(step="failed", kind=type(e).__name__,
            message=str(e)[:120] if isinstance(e,AlternativeError) else "Unexpected processing error")

if __name__ == "__main__":
    verify()
