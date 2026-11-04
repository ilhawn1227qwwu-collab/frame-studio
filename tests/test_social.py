"""TikTok/Instagram public content support without live external requests."""
from __future__ import annotations

import shutil
import time
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import social
import server


@pytest.mark.parametrize("url,site,kind", [
    ("https://www.tiktok.com/@demo_creator/video/7412345678901234567?share=1", "tiktok", "7412345678901234567"),
    ("https://vm.tiktok.com/ZMeABCDE12/?share=1", "tiktok", "ZMeABCDE12"),
    ("https://vt.tiktok.com/ZMeABCDE12/", "tiktok", "ZMeABCDE12"),
    ("https://www.instagram.com/p/AbCdE12345/?igsh=xyz", "instagram", "AbCdE12345"),
    ("https://instagram.com/reel/AbCdE12345/", "instagram", "AbCdE12345"),
    ("https://m.instagram.com/tv/AbCdE12345/", "instagram", "AbCdE12345"),
])
def test_supported_single_post_urls(url,site,kind):
    actual_site, canonical, identifier = social.normalize_url(url)
    assert actual_site == site and identifier == kind
    assert "?" not in canonical
    assert canonical.startswith("https://")


@pytest.mark.parametrize("url", [
    "https://www.instagram.com/@demo/",
    "https://www.instagram.com/stories/user/123/",
    "https://instagram.com/privateuser/",
    "https://instagram.com.evil.org/p/AbCdE12345/",
    "https://www.instagram.com/p/../../../../etc/passwd",
    "https://www.tiktok.com/@demo",
    "https://www.tiktok.com/@demo/video/abc",
    "https://tiktok.com.evil.org/@demo/video/7412345678901234567",
    "http://127.0.0.1/@demo/video/7412345678901234567",
    "file:///etc/passwd",
    "https://www.instagram.com:8000/p/AbCdE12345",
])
def test_private_feeds_and_unsafe_hosts_rejected(url):
    with pytest.raises(social.SocialError):
        social.normalize_url(url)


def test_instagram_photo_inspection(monkeypatch):
    def gallery(url):
        assert url == "https://www.instagram.com/p/AbCdE12345/"
        return 5
    monkeypatch.setattr(social, "_gallery_probe", gallery)
    data = social.inspect("https://www.instagram.com/p/AbCdE12345/?igsh=tracking")
    assert data["provider"] == "instagram_photo"
    assert data["photo_count"] == 5
    assert data["content_type"] == "photo"
    assert not data["qualities"]


def test_instagram_video_fallback_when_no_photos(monkeypatch):
    monkeypatch.setattr(social, "_gallery_probe", lambda url: 0)
    monkeypatch.setattr(social, "_video_info", lambda url,site,identifier,limit: {
        "provider":site, "content_type":"video", "id":identifier,
        "duration":20, "qualities":[720]})
    result = social.inspect("https://www.instagram.com/p/AbCdE12345/")
    assert result["content_type"] == "video" and result["provider"] == "instagram"


def test_tiktok_video_information_extractor(monkeypatch):
    class FakeYDL:
        def __init__(self, opts): self.opts=opts
        def __enter__(self): return self
        def __exit__(self, *_): return False
        def extract_info(self, url, download=False):
            assert "tiktok.com" in url and download is False
            return {"title":"영상 제목","uploader":"계정", "duration":26,
                    "thumbnail":"https://example.org/poster.jpg",
                    "formats":[{"width":1080,"height":1920,"vcodec":"h264"},
                               {"width":720,"height":1280,"vcodec":"h264"}]}
    monkeypatch.setattr(social.yt_dlp,"YoutubeDL",FakeYDL)
    d=social.inspect("https://www.tiktok.com/@demo/video/7412345678901234567")
    assert d["provider"]=="tiktok" and d["content_type"]=="video"
    assert d["duration"]==26
    assert 1080 in d["qualities"]


def test_gallery_probe_counts_image_extensions(monkeypatch):
    monkeypatch.setattr(social.shutil,"which",lambda app: "/usr/bin/gallery-dl")
    def run(argv,**kwargs):
        assert argv[0]=="gallery-dl" and "--config-ignore" in argv
        assert "--print" in argv and "--no-download" in argv
        return SimpleNamespace(returncode=0,stdout="jpg\nmp4\nwebp\njpg\n",
                               stderr="")
    monkeypatch.setattr(social.subprocess,"run",run)
    assert social._gallery_probe("https://www.instagram.com/p/AbCdE12345/")==3


def test_instagram_photo_export_image_and_zip(tmp_path,monkeypatch):
    monkeypatch.setattr(social.shutil,"which",lambda name:"/usr/bin/gallery-dl")
    count=[1]
    def run(argv,**kwargs):
        assert "--config-ignore" in argv and "--filesize-max" in argv
        folder=Path(argv[argv.index("--directory")+1])
        folder.mkdir(parents=True,exist_ok=True)
        for i in range(count[0]):
            (folder/f"test_{i}.jpg").write_bytes(b"\xff\xd8\xff" + bytes([i])*4096)
        (folder/"evil.py").write_text("ignored")
        return SimpleNamespace(returncode=0,stdout="",stderr="")
    monkeypatch.setattr(social.subprocess,"run",run)
    one=tmp_path/"single";one.mkdir()
    output,name=social.download_photos("https://www.instagram.com/p/AbCdE12345/",one,100000)
    assert name.endswith(".jpg") and output.read_bytes().startswith(b"\xff\xd8")
    count[0]=3
    multiple=tmp_path/"multiple";multiple.mkdir()
    output,name=social.download_photos("https://www.instagram.com/p/AbCdE12345/",multiple,100000)
    assert output.suffix==".zip" and "3photos" in name
    with zipfile.ZipFile(output) as z:
        files=z.namelist()
        assert len(files)==3 and all(n.endswith(".jpg") for n in files)
        assert all(".." not in n for n in files)


def test_social_inspect_and_photo_job_end_to_end_mocked(tmp_path,monkeypatch):
    def fake_inspect(raw, duration_limit=7200):
        site,url,identifier=social.normalize_url(raw)
        return {"id":identifier,"provider":"instagram_photo","site":"instagram",
                "content_type":"photo","title":"사진 게시물","channel":"",
                "duration":0,"qualities":[],"photo_count":2}
    def fake_download(url,folder,limit):
        target=folder/"export.zip"
        with zipfile.ZipFile(target,"w") as archive:
            archive.writestr("photo_1.jpg",b"jpeg sample")
        return target,"Instagram_pictures.zip"
    monkeypatch.setattr(server,"inspect_social",fake_inspect)
    monkeypatch.setattr(server,"download_social_photos",fake_download)
    client=TestClient(server.app)
    photo_url="https://www.instagram.com/p/AbCdE12345/"
    inspect=client.post("/api/inspect-social",json={"url":photo_url})
    assert inspect.status_code==200
    response=client.post("/api/jobs",json={"url":photo_url,"provider":"instagram_photo",
                    "mode":"photos","quality":0})
    assert response.status_code==202,response.text
    job_id=response.json()["id"]
    for _ in range(50):
        state=client.get(f"/api/jobs/{job_id}").json()
        if state["state"] in ("error","ready"):
            break
        time.sleep(.05)
    assert state["state"]=="ready",state
    file=client.get(f"/api/jobs/{job_id}/file")
    assert file.status_code==200
    assert file.content.startswith(b"PK")
    shutil.rmtree(server.WORKDIR/job_id,ignore_errors=True)
    with server._lock:
        server._jobs.pop(job_id,None)


def test_photo_mode_rejects_video_and_platform_mismatch(monkeypatch):
    def fake_inspect(raw, duration_limit=7200):
        return {"id":"AbCdE12345","provider":"instagram_photo","content_type":"photo",
                "title":"사진", "duration":0,"qualities":[],"photo_count":1}
    monkeypatch.setattr(server,"inspect_social",fake_inspect)
    client=TestClient(server.app)
    url="https://www.instagram.com/p/AbCdE12345/"
    assert client.post("/api/jobs",json={"url":url,"provider":"instagram_photo",
                   "mode":"mp4","quality":720}).status_code==400
    assert client.post("/api/jobs",json={"url":url,"provider":"tiktok",
                   "mode":"mp4","quality":720}).status_code==422
