"""Temporary one-shot Youtube extractor diagnostics for deployed hosting.
Run via FRAME_PROBE_ON_STARTUP=1. This does not authenticate or download media.
"""
import json
import os
import socket
import sys
import time
import yt_dlp

URL = 'https://www.youtube.com/watch?v=' + os.environ.get('FRAME_PROBE_VIDEO_ID', 'jNQXAC9IVRw')

class QuietLog:
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass

profiles = [
    ('mweb_pot', {'youtube': {'player_client': ['mweb']}}),
    ('default', {}),
    ('tv_web_safari', {'youtube': {'player_client': ['tv', 'web_safari']}}),
    ('web_embedded', {'youtube': {'player_client': ['web_embedded']}}),
    ('android_vr', {'youtube': {'player_client': ['android_vr']}}),
]

def probe():
    try:
        with socket.create_connection(('127.0.0.1', 4416), timeout=2):
            provider_ready = True
    except OSError:
        provider_ready = False
    print('FRAME_PROBE: begin (one public test video, metadata only); provider_ready=' + str(provider_ready), flush=True)
    for name, eargs in profiles:
        started = time.monotonic()
        options = {
            'quiet': True, 'no_warnings': True, 'noplaylist': True,
            'skip_download': True, 'extract_flat': False,
            'socket_timeout': 12, 'retries': 0, 'fragment_retries': 0,
            'source_address': '0.0.0.0', 'logger': QuietLog(),
            'extractor_args': eargs,
            'js_runtimes': {'node': {}},
        }
        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(URL, download=False)
            formats = info.get('formats') or []
            playable = [f for f in formats if f.get('url') and not f.get('has_drm') and
                        (f.get('vcodec') != 'none' or f.get('acodec') != 'none')]
            print('FRAME_PROBE:', json.dumps({'profile': name, 'result': 'ok',
                'playable_formats': len(playable),
                'has_audio': any(f.get('acodec') != 'none' for f in playable),
                'has_video': any(f.get('vcodec') != 'none' for f in playable),
                'seconds': round(time.monotonic() - started, 2)}), flush=True)
        except Exception as exc:
            msg = str(exc).splitlines()[-1].lower()
            reason = ('bot-check' if 'not a bot' in msg or 'sign in' in msg
                else 'network' if any(k in msg for k in ('timed out', 'network', 'connection'))
                else 'other')
            print('FRAME_PROBE:', json.dumps({'profile': name, 'result': 'error',
                'category': reason, 'seconds': round(time.monotonic() - started, 2)}), flush=True)
    print('FRAME_PROBE: finished', flush=True)

if __name__ == '__main__':
    probe()
