"""Temporary, metadata-only, one-shot production-network diagnostics.

Opt-in with FRAME_RUNTIME_DIAG=1. No files, downloaded media, user cookies,
IP addresses or original URLs are logged. The single test ID comes from the
operator-provided environment variable.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

VIDEO_ID = os.environ.get("FRAME_PROBE_VIDEO_ID", "jNQXAC9IVRw")


def report(**data):
    print("FRAME_RUNTIME_DIAG: " + json.dumps(data, ensure_ascii=False), flush=True)


def check_instances():
    import alternative
    opener = urllib.request.build_opener(alternative.NoRedirect)
    for origin in alternative.INVIDIOUS_ORIGINS:
        host = origin.split("//", 1)[1]
        req = urllib.request.Request(
            origin + "/api/v1/videos/" + VIDEO_ID + "?local=true",
            headers={"User-Agent": "FrameStudio/diagnostic", "Accept": "application/json"},
        )
        try:
            with opener.open(req, timeout=7) as resp:
                content_type = resp.headers.get("content-type", "").lower()
                data = resp.read(200_001)
                report(kind="instance", host=host, status=resp.status,
                       json=("json" in content_type), bytes=min(len(data), 200001))
        except urllib.error.HTTPError as exc:
            report(kind="instance", host=host, status=exc.code)
        except (OSError, TimeoutError, urllib.error.URLError) as exc:
            report(kind="instance", host=host, status=type(exc).__name__)


def check_nightly():
    # Isolated /tmp installation, does not mutate the running service's yt-dlp.
    with tempfile.TemporaryDirectory(prefix="frame-diagnostic-") as temp:
        proc = subprocess.run([
            sys.executable, "-m", "pip", "install", "-q", "--pre",
            "--disable-pip-version-check", "--target", temp, "yt-dlp[default]"
        ], capture_output=True, text=True, timeout=110)
        if proc.returncode:
            report(kind="nightly", status="install-failed", exitcode=proc.returncode)
            return
        payload = """
import json,os,time,yt_dlp
from yt_dlp.version import __version__ as version
class Quiet:
 def debug(self,msg):pass
 def warning(self,msg):pass
 def error(self,msg):pass
url = 'https://www.youtube.com/watch?v=' + os.environ['FRAME_PROBE_VIDEO_ID']
print('FRAME_RUNTIME_DIAG: ' + json.dumps({'kind':'nightly','version':version}),flush=True)
for profile,args in (
 ('default', {}),
 ('mweb', {'youtube': {'player_client': ['mweb']}}),
):
 st=time.monotonic()
 try:
  with yt_dlp.YoutubeDL({'quiet':True,'no_warnings':True,'noplaylist':True,
      'skip_download':True,'socket_timeout':12,'retries':0,
      'js_runtimes':{'node':{}},'extractor_args':args,'logger':Quiet()}) as dl:
   info=dl.extract_info(url,download=False)
  f=[item for item in (info.get('formats') or []) if item.get('url')]
  result={'kind':'nightly','profile':profile,'status':'ok',
          'formats':len(f),'duration':int(info.get('duration') or 0)}
 except Exception as exc:
  msg=str(exc).lower()
  result={'kind':'nightly','profile':profile,'status':'error',
          'category':'player-response' if 'player response' in msg
          else 'http403' if '403' in msg
          else 'bot-check' if 'bot' in msg else type(exc).__name__}
 print('FRAME_RUNTIME_DIAG: '+json.dumps(result),flush=True)
"""
        env = dict(os.environ)
        env["PYTHONPATH"] = temp + os.pathsep + env.get("PYTHONPATH", "")
        try:
            run = subprocess.run([sys.executable, "-c", payload],
                env=env, capture_output=True, text=True, timeout=85)
            for line in run.stdout.splitlines():
                if line.startswith("FRAME_RUNTIME_DIAG: "):
                    print(line, flush=True)
            if run.returncode:
                report(kind="nightly", status="probe-failed", code=run.returncode)
        except subprocess.TimeoutExpired:
            report(kind="nightly", status="probe-timeout")


def main():
    report(kind="begin", metadata_only=True)
    check_instances()
    try:
        check_nightly()
    except Exception as exc:
        report(kind="nightly", status="unexpected", exception=type(exc).__name__)
    report(kind="finished")


if __name__ == "__main__":
    main()
