"""X/Twitter public-video integration tests; all remote network calls are mocked."""
from __future__ import annotations

import json
import shutil
import subprocess
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import server
import social
import twitter_x


POST_ID = "1951234567890123456"
POST_URL = f"https://x.com/demo_user/status/{POST_ID}"


@pytest.mark.parametrize("raw", [
    POST_URL,
    f"https://twitter.com/demo_user/status/{POST_ID}?s=20&t=abc",
    f"https://mobile.twitter.com/demo_user/status/{POST_ID}",
    f"https://www.x.com/demo_user/status/{POST_ID}/video/1",
    f"https://x.com/i/status/{POST_ID}",
    f"https://x.com/i/web/status/{POST_ID}",
])
def test_x_links_normalize_to_single_post(raw):
    platform, canonical, identifier = social.normalize_url(raw)
    assert platform == "twitter"
    assert identifier == POST_ID
    assert canonical == f"https://x.com/i/status/{POST_ID}"


@pytest.mark.parametrize("raw", [
    "https://x.com/demo_user",
    "https://x.com/demo_user/media",
    "https://x.com/demo_user/status/not-a-number",
    "https://x.com/demo_user/status/123/status/456",
    f"https://x.com.evil.org/demo/status/{POST_ID}",
    f"https://x.com:8080/demo/status/{POST_ID}",
    f"https://evil.org@x.com/demo/status/{POST_ID}",
    f"file:///etc/passwd",
    f"http://127.0.0.1/status/{POST_ID}",
])
def test_x_link_rejects_invalid_path_and_unsafe_hosts(raw):
    with pytest.raises(social.SocialError):
        social.normalize_url(raw)


def fake_post():
    return {
        "type": "status", "text": "직접 만든 동영상 #test",
        "author": {"name": "테스트 작성자", "screen_name": "creator"},
        "media": {"videos": [{
            "type": "video", "width": 1920, "height": 1080, "duration": 2,
            "thumbnail_url": "https://pbs.twimg.com/ext_tw_video_thumb/123/pu/img/demo.jpg",
            "url": "https://video.twimg.com/ext_tw_video/123/pu/vid/320x180/low.mp4?tag=12",
            "formats": [
                {"url": "https://video.twimg.com/ext_tw_video/123/pu/vid/320x180/low.mp4", "bitrate": 256000},
                {"url": "https://video.twimg.com/ext_tw_video/123/pu/vid/1920x1080/high.mp4?tag=12", "bitrate": 2176000},
                {"url": "https://video.twimg.com/ext_tw_video/123/pu/pl/master.m3u8", "bitrate": 9999999},
            ],
        }]},
    }


def test_fx_api_metadata_inspection(monkeypatch):
    class FakeResponse:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def read(self, _): return json.dumps({"code": 200, "status": fake_post()}).encode()

    class FakeOpener:
        def open(self, req, timeout):
            assert req.full_url == f"https://api.fxtwitter.com/2/status/{POST_ID}"
            assert timeout <= 20
            return FakeResponse()

    monkeypatch.setattr(twitter_x, "OPENER", FakeOpener())
    info = twitter_x.inspect(POST_URL)
    assert info["provider"] == "twitter_fx"
    assert info["site"] == "twitter"
    assert info["title"] == "직접 만든 동영상 #test"
    assert info["duration"] == 2
    assert info["qualities"] == [1080]
    assert info["channel"] == "테스트 작성자"
    assert not info["duration_unknown"]
    assert "FxTwitter" in info["note"]
    selected = twitter_x._best_source(fake_post()["media"]["videos"][0])
    assert "high.mp4" in selected


def test_fx_rejects_non_public_or_empty_media(monkeypatch):
    monkeypatch.setattr(twitter_x, "_read_post", lambda _: {"text": "hello", "media": {"photos": []}})
    with pytest.raises(twitter_x.TwitterError, match="동영상"):
        twitter_x.inspect(POST_URL)


@pytest.mark.parametrize("url", [
    "https://video.twimg.com.evil.org/video.mp4",
    "http://video.twimg.com/video.mp4",
    "https://localhost/video.mp4",
    "https://video.twimg.com:8443/video.mp4",
    "https://video.twimg.com/video.m3u8",
    "file:///tmp/evil.mp4",
])
def test_x_media_urls_cannot_escape_fixed_cdn(url):
    assert twitter_x._video_url(url) is None
    with pytest.raises(twitter_x.TwitterError, match="MP4"):
        twitter_x._best_source({"url": url, "formats": []})


def test_fx_download_follows_no_untrusted_redirects(tmp_path, monkeypatch):
    monkeypatch.setattr(twitter_x, "_read_post", lambda _: fake_post())
    content = b"\x00\x00\x00\x18ftypmp42" + b"test" * 100
    class FakeResponse:
        status = 200
        headers = {"Content-Length": str(len(content))}
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def __init__(self): self.offset=0
        def read(self, n):
            part = content[self.offset:self.offset + n]
            self.offset += len(part)
            return part
    class FakeOpener:
        def open(self, req, timeout):
            assert req.full_url.startswith("https://video.twimg.com/")
            return FakeResponse()
    monkeypatch.setattr(twitter_x, "OPENER", FakeOpener())
    calls=[]
    path = twitter_x.obtain_source(POST_URL, tmp_path, 10000, lambda *args: calls.append(args))
    assert path.read_bytes() == content
    assert calls[-1][0] == 78


def test_x_inspect_route_and_provider_validation(monkeypatch):
    info = {"provider": "twitter_fx", "site": "twitter", "content_type": "video",
            "id": POST_ID, "title": "X 샘플", "channel": "demo", "thumbnail": "",
            "duration": 0, "duration_unknown": True, "qualities": [720], "max_height": 720}
    monkeypatch.setattr(server, "inspect_twitter", lambda *_: info)
    client = TestClient(server.app)
    result = client.post("/api/inspect-social", json={"url": POST_URL})
    assert result.status_code == 200 and result.json()["provider"] == "twitter_fx"
    assert client.post("/api/jobs", json={"url": POST_URL, "provider": "instagram",
                       "mode": "mp4", "quality": 720}).status_code == 422
    assert client.post("/api/jobs", json={"url": POST_URL, "provider": "twitter_fx",
                       "mode": "mp4", "quality": 720, "start": "00:02", "end": "00:05"}).status_code == 400
    assert client.post("/api/jobs", json={"url": POST_URL, "provider": "twitter_fx",
                       "mode": "photos", "quality": 0}).status_code == 400


def test_x_video_and_mp3_download_end_to_end_mocked(tmp_path, monkeypatch):
    """Use real FFmpeg and local fixture, but never call X or FxTwitter."""
    sample = tmp_path / "sample.mp4"
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
               "-f", "lavfi", "-i", "color=c=green:s=320x180:r=10",
               "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
               "-t", "2", "-c:v", "libx264", "-preset", "ultrafast",
               "-pix_fmt", "yuv420p", "-c:a", "aac", str(sample)]
    finished = subprocess.run(command, capture_output=True, text=True)
    assert finished.returncode == 0, finished.stderr
    info = {"provider": "twitter_fx", "site": "twitter", "content_type": "video",
            "id": POST_ID, "title": "직접 만든 X 테스트", "channel": "tester",
            "thumbnail": "", "duration": 2, "qualities": [360], "max_height": 360}
    monkeypatch.setattr(server, "inspect_twitter", lambda *_: info)
    def download(_, folder, limit, progress):
        target = folder / "twitter-source.mp4"
        shutil.copyfile(sample, target)
        progress(78, "완료")
        return target
    monkeypatch.setattr(server, "obtain_twitter_source", download)
    client = TestClient(server.app)
    for mode, quality in (("mp4", 360), ("mp3", 192)):
        created = client.post("/api/jobs", json={
            "url": POST_URL, "provider": "twitter_fx", "mode": mode, "quality": quality})
        assert created.status_code == 202, created.text
        job_id = created.json()["id"]
        state = {}
        for _ in range(100):
            state = client.get(f"/api/jobs/{job_id}").json()
            if state["state"] in ("ready", "error"):
                break
            time.sleep(.1)
        assert state["state"] == "ready", state
        response = client.get(f"/api/jobs/{job_id}/file")
        assert response.status_code == 200
        assert len(response.content) > 1000
        assert mode in response.headers["content-disposition"]
        shutil.rmtree(server.WORKDIR / job_id, ignore_errors=True)
        with server._lock:
            server._jobs.pop(job_id, None)
