import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from server import app, canonical_url, parse_time, _safe_filename, _media_codecs, _safe_error

@pytest.mark.parametrize('input_url', [
    'https://www.youtube.com/watch?v=AbC123_xY-z',
    'https://youtu.be/AbC123_xY-z?t=20',
    'https://m.youtube.com/shorts/AbC123_xY-z',
    'https://music.youtube.com/watch?v=AbC123_xY-z&list=PL123',
    'https://www.youtube.com/live/AbC123_xY-z',
])
def test_supported_urls(input_url):
    video_id, canonical = canonical_url(input_url)
    assert video_id == 'AbC123_xY-z'
    assert canonical == 'https://www.youtube.com/watch?v=AbC123_xY-z'

@pytest.mark.parametrize('input_url', [
    'https://www.youtube.com.evil.com/watch?v=AbC123_xY-z',
    'https://example.com/watch?v=AbC123_xY-z',
    'file:///etc/passwd',
    'https://www.youtube.com/playlist?list=PL123',
    'http://127.0.0.1/watch?v=AbC123_xY-z',
    'https://www.youtube.com/watch?v=AbC123_xY-',
    'https://www.youtube.com/watch?v=AbC123_xY-z%0a',
])
def test_rejected_urls(input_url):
    with pytest.raises(HTTPException) as exc:
        canonical_url(input_url)
    assert exc.value.status_code == 400

@pytest.mark.parametrize(('raw', 'expected'), [
    ('', 10), ('95', 95), ('01:35', 95), ('1:02:03', 3723), ('00:01.5', 1.5),
])
def test_parse_time(raw, expected):
    assert parse_time(raw, default=10) == expected

@pytest.mark.parametrize('raw', ['not time', '-1', '12:ab', '99:99:99:99', '999999999', '02:30-3'])
def test_invalid_time(raw):
    with pytest.raises(HTTPException):
        parse_time(raw, default=10)

def test_filename_sanitization():
    name = _safe_filename('한글 :?*/\\ 테스트', 'mp4')
    assert name.endswith('.mp4')
    assert not any(c in name for c in ':?*/\\')

def test_health_endpoint():
    client = TestClient(app)
    assert client.get('/').status_code == 200
    response = client.get('/api/health')
    assert response.status_code == 200
    assert 'js_runtime' in response.json()

def test_bad_request_no_remote_call():
    client = TestClient(app)
    r = client.post('/api/inspect', json={'url': 'https://invalid.example/video'})
    assert r.status_code == 400
    r = client.get('/api/jobs/no-such-job')
    assert r.status_code == 404

def test_full_api_with_simulated_media(monkeypatch, tmp_path):
    """End-to-end test without accessing YouTube: real FFmpeg, simulated yt-dlp."""
    import shutil
    import subprocess
    import time
    import server
    sample = tmp_path / 'synthetic.mkv'
    completed = subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=blue:s=320x180:r=10',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
        '-t', '2', '-c:v', 'libx264', '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(sample)
    ], capture_output=True, text=True)
    assert completed.returncode == 0, completed.stderr

    class FakeYDL:
        def __init__(self, opts):
            self.opts = opts
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def extract_info(self, url, download=False):
            return {
                'title': '직접 제작한 테스트 영상', 'channel': '테스트 채널',
                'duration': 2, 'formats': [{'height': 720, 'vcodec': 'h264'}]
            }
        def download(self, urls):
            target = self.opts['outtmpl'].replace('%(ext)s', 'mkv')
            shutil.copyfile(sample, target)
            for hook in self.opts['progress_hooks']:
                hook({'status': 'finished'})
            return 0

    monkeypatch.setattr(server, 'yt_dlp', type('Fake', (), {'YoutubeDL': FakeYDL}))
    client = TestClient(server.app)
    url = 'https://youtu.be/ZfG123_xY-z'
    inspect_result = client.post('/api/inspect', json={'url': url})
    assert inspect_result.status_code == 200, inspect_result.text
    assert inspect_result.json()['qualities'] == [720]
    for mode, quality in [('mp4', 720), ('mp3', 192)]:
        created = client.post('/api/jobs', json={'url': url, 'mode': mode, 'quality': quality,
                                                 'start': '00:00.2', 'end': '00:01.2'})
        assert created.status_code == 202, created.text
        job_id = created.json()['id']
        result = {}
        for _ in range(100):
            result = client.get(f'/api/jobs/{job_id}').json()
            if result['state'] in ('ready', 'error'):
                break
            time.sleep(0.1)
        assert result['state'] == 'ready', result
        assert result['progress'] == 100
        response = client.get(f'/api/jobs/{job_id}/file')
        assert response.status_code == 200
        assert len(response.content) > 1000
        assert mode in response.headers['content-disposition']
        shutil.rmtree(server.WORKDIR / job_id, ignore_errors=True)
        with server._lock:
            server._jobs.pop(job_id, None)


def test_public_mode_requires_password(tmp_path):
    """A public deployment without access control must fail closed."""
    import os
    import subprocess
    import sys
    env = dict(os.environ, FRAME_PUBLIC_MODE='1', FRAME_SITE_PASSWORD='short')
    result = subprocess.run([sys.executable, '-c', 'import server'],
                            cwd=str(__import__('pathlib').Path(__file__).resolve().parents[1]),
                            env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert 'at least 12 characters' in result.stderr


def test_public_access_control_and_request_limits():
    """Public mode requires Basic auth and throttles costly API requests."""
    import os
    import subprocess
    import sys
    snippet = r'''
import base64
from fastapi.testclient import TestClient
from server import app
client = TestClient(app)
assert client.get('/').status_code == 401
assert client.get('/static/style.css').status_code == 401
assert client.post('/api/inspect', json={'url': 'junk'}).status_code == 401
assert client.get('/api/health').status_code == 200
header = {'Authorization': 'Basic ' + base64.b64encode(b'frame:correct-horse-battery-staple').decode('ascii')}
assert client.get('/', headers=header).status_code == 200
assert client.get('/static/style.css', headers=header).status_code == 200
for x in range(30):
    assert client.post('/api/inspect', headers=header, json={'url': 'junk'}).status_code == 400
assert client.post('/api/inspect', headers=header, json={'url': 'junk'}).status_code == 429
'''
    env = dict(os.environ, FRAME_PUBLIC_MODE='1', FRAME_SITE_PASSWORD='correct-horse-battery-staple')
    result = subprocess.run([sys.executable, '-c', snippet],
                            cwd=str(__import__('pathlib').Path(__file__).resolve().parents[1]),
                            env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr

def test_youtube_bot_check_does_not_claim_private_video():
    """A public Shorts link can fail because a cloud IP is blocked."""
    message = "ERROR: [youtube] XDbJL-OZW1A: Sign in to confirm you’re not a bot. Use --cookies for authentication."
    result = _safe_error(RuntimeError(message))
    assert '서버' in result and '봇' in result
    assert '접근 권한이 필요한 영상' not in result
    assert '공개 쇼츠' in result


def test_real_private_video_keeps_distinct_message():
    result = _safe_error(RuntimeError('ERROR: This is a private video. Sign in to watch.'))
    assert '접근 권한이 필요한 영상' in result
