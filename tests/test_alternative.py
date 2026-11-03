"""Regression tests for opt-in Invidious fallback (no external network calls)."""
import shutil
import subprocess
import time

import pytest
from fastapi.testclient import TestClient

import alternative
import server


VIDEO_ID = "AbC123_xY-z"
TEST_URL = f"https://www.youtube.com/shorts/{VIDEO_ID}"


def sample_info():
    def media(typ, itag, bitrate, label=None):
        result = {
            "url": f"https://yt.chocolatemoo53.com/latest_version?id={VIDEO_ID}&itag={itag}&local=true",
            "type": typ, "bitrate": str(bitrate), "itag": str(itag)
        }
        if label:
            result["qualityLabel"] = label
        return result
    return {
        "videoId": VIDEO_ID, "title": "테스트 쇼츠", "author": "테스트 채널",
        "lengthSeconds": 30, "liveNow": False, "paid": False,
        "adaptiveFormats": [
            media("video/mp4; codecs=\"avc1\"", 133, 150000, "240p"),
            media("video/mp4; codecs=\"avc1\"", 136, 1400000, "720p"),
            media("video/mp4; codecs=\"avc1\"", 137, 2600000, "1080p"),
            media("video/webm; codecs=\"vp9\"", 247, 1100000, "720p"),
            media("audio/mp4; codecs=\"mp4a\"", 140, 120000),
            media("audio/webm; codecs=\"opus\"", 251, 140000)
        ],
    }


@pytest.mark.parametrize("url", [
    "http://yt.chocolatemoo53.com/latest_version",
    "https://yt.chocolatemoo53.com.evil.test/latest_version",
    "https://localhost/private",
    "file:///etc/passwd",
    "https://yt-comp2.chocolatemoo53.com@127.0.0.1/private",
])
def test_unsafe_redirect_rejected(url):
    with pytest.raises(alternative.AlternativeError):
        alternative._validate_media_url(url)


def test_metadata_and_quality_selection(monkeypatch):
    monkeypatch.setattr(alternative, "_read_info", lambda _: sample_info())
    info = alternative.inspect(VIDEO_ID)
    assert info["provider"] == "invidious"
    assert info["qualities"] == [240, 720, 1080]
    assert set(info["audio_modes"]) == {"mp3", "m4a", "opus"}
    assert info["duration"] == 30
    video, audio = alternative._choose_sources(sample_info(), "mp4", 720)
    assert video["itag"] == "136"
    assert audio["itag"] == "140"
    video, audio = alternative._choose_sources(sample_info(), "mp4", 1080)
    assert video["itag"] == "137"
    video, audio = alternative._choose_sources(sample_info(), "mp3", 320)
    assert video is None and audio["itag"] == "251"
    video, audio = alternative._choose_sources(sample_info(), "m4a", 0)
    assert video is None and audio["itag"] == "140"
    video, audio = alternative._choose_sources(sample_info(), "opus", 0)
    assert video is None and audio["itag"] == "251"


def test_third_party_inspection_requires_user_action(monkeypatch):
    captured = []
    def fake_inspection(video_id):
        captured.append(video_id)
        result = alternative.inspect(video_id)
        return result
    monkeypatch.setattr(alternative, "_read_info", lambda _: sample_info())
    monkeypatch.setattr(server, "inspect_alternative", fake_inspection)
    client = TestClient(server.app)
    assert not captured
    result = client.post("/api/inspect-alt", json={"url":TEST_URL})
    assert result.status_code == 200, result.text
    assert result.json()["provider"] == "invidious"
    assert captured == [VIDEO_ID]
    assert client.post("/api/inspect-alt", json={"url":"https://example.com"}).status_code == 400
    assert client.post("/api/jobs", json={"url":TEST_URL, "provider":"invalid"}).status_code == 400


def test_alternative_mp4_and_mp3_job_api_without_network(monkeypatch, tmp_path):
    """Exercise the actual background job and FFmpeg export using synthetic media."""
    synthetic = tmp_path / "fixture.mkv"
    ffmpeg = subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "color=c=black:s=320x180:r=10",
        "-f", "lavfi", "-i", "sine=frequency=600:duration=2",
        "-t", "2", "-c:v", "libx264", "-preset", "ultrafast",
        "-pix_fmt", "yuv420p", "-c:a", "aac", str(synthetic)
    ], capture_output=True, text=True)
    assert ffmpeg.returncode == 0, ffmpeg.stderr

    def fake_inspection(video_id):
        return {
            "id": video_id, "title": "테스트 영상", "channel": "테스트",
            "duration": 2, "qualities": [360], "max_height": 360,
            "provider": "invidious",
        }
    def fake_source(video_id, mode, quality, folder, update):
        update(12, "테스트 원본 생성 중...")
        source = folder / "source.mkv"
        shutil.copyfile(synthetic, source)
        return source
    monkeypatch.setattr(server, "inspect_alternative", fake_inspection)
    monkeypatch.setattr(server, "obtain_alternative_source", fake_source)
    client = TestClient(server.app)
    for mode, quality in [("mp4", 360), ("mp3", 192)]:
        result = client.post("/api/jobs", json={
            "url": TEST_URL, "provider": "invidious", "mode": mode,
            "quality": quality, "start": "0.2", "end": "1.3",
        })
        assert result.status_code == 202, result.text
        job_id = result.json()["id"]
        status = {}
        for _ in range(80):
            status = client.get(f"/api/jobs/{job_id}").json()
            if status.get("state") in ("ready", "error"):
                break
            time.sleep(.1)
        assert status.get("state") == "ready", status
        export = client.get(f"/api/jobs/{job_id}/file")
        assert export.status_code == 200
        assert len(export.content) > 1000
        assert mode in export.headers.get("content-disposition", "")
        shutil.rmtree(server.WORKDIR / job_id, ignore_errors=True)
        with server._lock:
            server._jobs.pop(job_id, None)


def test_long_form_video_metadata(monkeypatch):
    """A normal 10-minute video and a two-hour video are both valid."""
    import io
    import json

    def mocked_fetch(duration):
        info = sample_info()
        info["lengthSeconds"] = duration
        data = json.dumps(info).encode("utf-8")
        response = io.BytesIO(data)
        response.status = 200
        response.headers = {"content-type": "application/json"}
        return response

    for duration in [600, 1800, 3600, 7200]:
        monkeypatch.setattr(alternative.OPENER, "open",
                            lambda request, timeout: mocked_fetch(duration))
        result = alternative.inspect(VIDEO_ID)
        assert result["duration"] == duration
        assert result["provider"] == "invidious"

    monkeypatch.setattr(alternative.OPENER, "open",
                        lambda request, timeout: mocked_fetch(7201))
    with pytest.raises(alternative.AlternativeError):
        alternative.inspect(VIDEO_ID)


def test_long_video_download_limits_are_bounded():
    """Removing the 3-minute cap must not remove safety/resource bounds."""
    assert alternative.ALT_MAX_SECONDS == 7200
    assert 0 < alternative.ALT_AUDIO_BYTES <= alternative.ALT_MAX_MEDIA_BYTES
    assert 20 * 1024 * 1024 <= alternative.ALT_MAX_MEDIA_BYTES <= 220 * 1024 * 1024
    assert alternative.MAX_TRANSFER_SECONDS >= 600


def test_alternate_companion_hosts_are_strictly_limited():
    for host in ["yt.chocolatemoo53.com", "yt-comp1.chocolatemoo53.com",
                 "yt-comp2.chocolatemoo53.com", "yt-comp15.chocolatemoo53.com"]:
        url = f"https://{host}/latest_version"
        assert alternative._validate_media_url(url) == url
    for host in ["yt-comp1.chocolatemoo53.com.attacker.example",
                 "evil.chocolatemoo53.com", "yt-comp1.chocolatemoo53Xcom",
                 "yt-comp1.example.com"]:
        with pytest.raises(alternative.AlternativeError):
            alternative._validate_media_url(f"https://{host}/latest_version")


def test_true_original_audio_export_and_codec_copy(tmp_path):
    """AAC to M4A and Opus to .opus must retain codecs without new lossy encode."""
    import json
    from pathlib import Path
    client_audio = tmp_path / "test_aac.m4a"
    opus_audio = tmp_path / "test_opus.webm"
    original_pcm = tmp_path / "original.wav"
    wav = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                          "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
                          "-c:a", "pcm_s16le", str(original_pcm)], capture_output=True)
    assert wav.returncode == 0
    aac = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                          "-i", str(original_pcm), "-c:a", "aac", "-b:a", "128k",
                          str(client_audio)], capture_output=True)
    opus = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                           "-i", str(original_pcm), "-c:a", "libopus", "-b:a", "160k",
                           str(opus_audio)], capture_output=True)
    assert aac.returncode == 0 and opus.returncode == 0
    for mode, source, expected_codec in [
        ("m4a", client_audio, "aac"), ("opus", opus_audio, "opus")
    ]:
        target = tmp_path / f"export.{mode}"
        job = server.Job(id="test", video_id=VIDEO_ID)
        server._encode(job, source, target, mode=mode,
                       start=0.0, end=3, duration=3, bitrate=0)
        actual = subprocess.run([
            "ffprobe", "-v", "error", "-show_entries", "stream=codec_name",
            "-of", "json", str(target)
        ], capture_output=True, text=True, check=True)
        codecs = json.loads(actual.stdout)["streams"]
        assert codecs[0]["codec_name"] == expected_codec
        assert target.stat().st_size > 1000


def test_mp4_full_video_streamcopy_and_high_quality_trim(tmp_path):
    import json
    source = tmp_path / "source.mp4"
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "color=c=black:s=320x180:r=10",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
        "-t", "3", "-c:v", "libx264", "-preset", "ultrafast",
        "-c:a", "aac", str(source)], capture_output=True, text=True)
    assert result.returncode == 0
    job = server.Job(id="copy", video_id=VIDEO_ID)
    target = tmp_path / "copy.mp4"
    server._encode(job, source, target, mode="mp4",
                   start=0.0, end=3, duration=3, bitrate=192)
    assert target.is_file() and target.stat().st_size > 1000
    clip = tmp_path / "clip.mp4"
    server._encode(job, source, clip, mode="mp4",
                   start=0.5, end=1.8, duration=3, bitrate=192)
    assert clip.is_file() and clip.stat().st_size > 1000


