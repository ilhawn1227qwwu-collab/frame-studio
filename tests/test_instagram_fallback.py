"""Automatic Instagram Reel failover and app share-link regression tests."""
import io
import json
import shutil
import subprocess
import time
import urllib.error
from email.message import Message
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import instagram_vx as vx
import instagram_reel_fallback as mirror
import social
import server

SAMPLE="https://www.instagram.com/reel/DZdOSuOyu2E/"
SHARE="https://www.instagram.com/share/reel/_o22CKDyw"


class _BytesResponse(io.BytesIO):
    def __init__(self, body, content_type):
        super().__init__(body)
        self.status=200
        self.headers={"content-type":content_type,"content-length":str(len(body))}


def test_share_links_accepted_and_profile_routes_normalized():
    checks = [
        (SHARE, "instagram", "_o22CKDyw"),
        ("https://www.instagram.com/share/_o22CKDyw", "instagram", "_o22CKDyw"),
        ("https://www.instagram.com/some_creator/reel/DZdOSuOyu2E/?igsh=x",
         "instagram", "DZdOSuOyu2E"),
    ]
    for url, site, code in checks:
        actual, normalized, ident=social.normalize_url(url)
        assert actual==site and ident==code and normalized.startswith("https://")


def test_share_url_resolves_strict_instagram_redirect(monkeypatch):
    class _RedirectHeader(dict):
        pass
    def fake_open(request,timeout):
        raise urllib.error.HTTPError(request.full_url,302,"Found",
            {"location":"https://www.instagram.com/reel/DB0YWyzPdcX/?igsh=copy"},None)
    monkeypatch.setattr(vx.OPENER,"open",fake_open)
    canonical,ident=vx._parse_post(SHARE)
    assert canonical=="https://www.instagram.com/reel/DB0YWyzPdcX/"
    assert ident=="DB0YWyzPdcX"


def test_share_link_rejects_redirect_outside_instagram(monkeypatch):
    def fake_open(request,timeout):
        raise urllib.error.HTTPError(request.full_url,302,"Found",
            {"location":"https://127.0.0.1/admin"},None)
    monkeypatch.setattr(vx.OPENER,"open",fake_open)
    with pytest.raises(vx.InstagramVXError):
        vx._parse_post(SHARE)


def test_mirror_extracts_explicit_reel_meta(monkeypatch):
    canonical,code=mirror._post_identity(SAMPLE)
    assert code=="DZdOSuOyu2E"
    body=(f'<html><meta property="og:video" content="/videos/{code}"></html>').encode()
    def fake_open(req,timeout):
        assert req.full_url=="https://instagramfix.com/reel/"+code+"/"
        return _BytesResponse(body,"text/html")
    monkeypatch.setattr(mirror.OPENER,"open",fake_open)
    source=mirror._resolve_source(canonical,code,"instagramfix.com")
    assert source=="https://instagramfix.com/videos/"+code


@pytest.mark.parametrize("bad",[
    "http://instagramfix.com/videos/DZdOSuOyu2E",
    "https://instagramfix.com.attacker.net/videos/DZdOSuOyu2E",
    "https://127.0.0.1/videos/DZdOSuOyu2E",
    "/videos/NOT_THE_REQUESTED_POST",
    "https://evil.org/videos/DZdOSuOyu2E",
    "file:///etc/passwd",
])
def test_mirror_rejects_untrusted_media(bad):
    with pytest.raises(mirror.ReelFallbackError):
        mirror._validate_mirror_media_url(bad,"instagramfix.com","DZdOSuOyu2E")


def test_mirror_video_cdn_302_and_bytes(tmp_path,monkeypatch):
    code="DZdOSuOyu2E"
    def fake_open(req,timeout):
        if req.full_url.startswith("https://instagramfix.com/videos/"):
            raise urllib.error.HTTPError(req.full_url,302,"Found",{
                "location":"https://scontent-1.cdninstagram.com/v.mp4?token=123"},None)
        if req.full_url.startswith("https://scontent-1.cdninstagram.com/"):
            return _BytesResponse(b"\x00\x00\x00\x20ftypisom"+b"x"*5000,"video/mp4")
        raise AssertionError("Unexpected request URL")
    monkeypatch.setattr(mirror.OPENER,"open",fake_open)
    out=tmp_path/"source.mp4"
    mirror._receive_video("https://instagramfix.com/videos/"+code,
             "instagramfix.com",out,100_000,time.monotonic()+30,lambda *a:None)
    assert out.stat().st_size>5000


def test_failed_primary_inspect_uses_fallback(monkeypatch):
    def reject(url):
        raise vx.InstagramVXError("first provider could not fetch this Reel")
    def mirror_inspect(url):
        return {"provider":"instagram_mirror","site":"instagram",
                "content_type":"video","id":"DZdOSuOyu2E",
                "duration":0,"duration_unknown":True,
                "qualities":[0],"title":"공개 릴스"}
    monkeypatch.setattr(server,"inspect_instagram_vx",reject)
    monkeypatch.setattr(server,"inspect_reel_fallback",mirror_inspect)
    client=TestClient(server.app)
    resp=client.post("/api/inspect-social",json={"url":SAMPLE})
    assert resp.status_code==200,resp.text
    assert resp.json()["provider"]=="instagram_mirror"


def test_fallback_downloads_reel_through_app(tmp_path,monkeypatch):
    movie=tmp_path/"fixture.mp4"
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y",
        "-f","lavfi","-i","color=c=black:s=320x180:r=10",
        "-f","lavfi","-i","sine=frequency=600:duration=2",
        "-t","2","-c:v","libx264","-preset","ultrafast",
        "-c:a","aac",str(movie)],check=True,capture_output=True)
    def fake_inspect(url):
        return {"provider":"instagram_mirror","site":"instagram",
                "content_type":"video","id":"DZdOSuOyu2E",
                "duration":0,"duration_unknown":True,
                "qualities":[0],"title":"공개 릴스"}
    def fake_get(url,folder,max_bytes,progress):
        target=folder/"instagram_mirror_source.mp4"
        shutil.copyfile(movie,target)
        return target
    monkeypatch.setattr(server,"inspect_reel_fallback",fake_inspect)
    monkeypatch.setattr(server,"obtain_reel_fallback",fake_get)
    client=TestClient(server.app)
    created=client.post("/api/jobs",json={
        "url":SAMPLE,"provider":"instagram_mirror","mode":"mp4",
        "quality":0})
    assert created.status_code==202,created.text
    job_id=created.json()["id"]
    state={}
    for _ in range(65):
        state=client.get("/api/jobs/"+job_id).json()
        if state["state"] in ("ready","error"):break
        time.sleep(.05)
    assert state["state"]=="ready",state
    file=client.get("/api/jobs/"+job_id+"/file")
    assert file.status_code==200 and len(file.content)>1000
    shutil.rmtree(server.WORKDIR/job_id,ignore_errors=True)
    with server._lock:server._jobs.pop(job_id,None)
