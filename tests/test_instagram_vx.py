"""Public Instagram in-site direct media integration; no external network in tests."""
import io
import json
import shutil
import subprocess
import time
import zipfile
from email.message import Message
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import instagram_vx as vx
import server


VIDEO_POST="https://www.instagram.com/reel/DZntaBKS0AR/"
PHOTO_POST="https://www.instagram.com/p/DCkNonioVx2/"


def sample_items(count=1,kind="video"):
    return [{"index":n,"type":kind} for n in range(count)]


@pytest.mark.parametrize("bad",[
    "http://localhost/",
    "https://instagram.com.evil.org/reel/ABCDE12345/",
    "https://www.instagram.com/stories/u/123",
    "https://www.instagram.com/p/../../etc/passwd",
    "file:///etc/passwd",
    "https://www.instagram.com:8888/p/ABCDE12345",
])
def test_post_input_rejected(bad):
    with pytest.raises(vx.InstagramVXError):
        vx._parse_post(bad)


@pytest.mark.parametrize("bad",[
    "http://scontent-ams.cdninstagram.com/media.mp4",
    "https://cdninstagram.com/media.mp4",
    "https://cdninstagram.com.evil.org/file",
    "https://127.0.0.1/admin",
    "https://localhost/file",
    "file:///etc/passwd",
    "https://scontent.cdninstagram.com:8080/media",
    "https://user:password@scontent.cdninstagram.com/media",
])
def test_untrusted_cdn_urls_rejected(bad):
    assert not vx._cdn_allowed(bad)


def test_valid_cdn_hosts_allowed():
    assert vx._cdn_allowed("https://scontent-cdg4-3.cdninstagram.com/m.mp4?secret=not-logged")
    assert vx._cdn_allowed("https://instagram.ftng3-2.fna.fbcdn.net/m.mp4?token=x")


def test_parse_vx_public_api(monkeypatch):
    url,ident=vx._parse_post(VIDEO_POST)
    payload={"media_attachments":[
        {"type":"video","url":"https://www.vxinstagram.com/offload/"+ident+"?order=0"},
        {"type":"image","url":"https://www.vxinstagram.com/offload/"+ident+"?order=1"},
        {"type":"image","url":"https://127.0.0.1/admin"},
    ]}
    class Response(io.BytesIO):
        status=200
    monkeypatch.setattr(vx.OPENER,"open",lambda request,timeout:Response(json.dumps(payload).encode()))
    data=vx._request_post(url,ident,0)
    assert data==[{"index":0,"type":"video"},{"index":1,"type":"image"}]


def test_many_photo_items_and_single_reel(monkeypatch):
    def fake_page(url,ident,start):
        if start==0:return sample_items(4,"image")
        if start==4:return [{"index":4,"type":"image"},{"index":5,"type":"image"},
                            {"index":0,"type":"image"},{"index":1,"type":"image"}]
        return [{"index":2,"type":"image"},{"index":3,"type":"image"}]
    monkeypatch.setattr(vx,"_request_post",fake_page)
    info=vx.inspect(PHOTO_POST)
    assert info["provider"]=="instagram_vx"
    assert info["photo_count"]==6
    assert info["content_type"]=="photo"
    assert len(vx._post_items(*vx._parse_post(PHOTO_POST)))==6

    monkeypatch.setattr(vx,"_request_post",lambda url,ident,start:sample_items(1,"video"))
    video=vx.inspect(VIDEO_POST)
    assert video["provider"]=="instagram_vx"
    assert video["content_type"]=="video"
    assert video["duration_unknown"] is True
    assert video["qualities"]==[0]


def test_photo_image_zip_with_fake_cdn(tmp_path,monkeypatch):
    monkeypatch.setattr(vx,"_post_items",lambda url,ident:sample_items(3,"image"))
    def transfer(ident,item,output,size_limit,deadline,progress):
        output.write_bytes(b"RIFF"+b"x"*1200)
        progress(99)
        return "image/webp"
    monkeypatch.setattr(vx,"_download_item",transfer)
    output,name,is_video=vx.download(PHOTO_POST,tmp_path,20_000,lambda pct,msg:None)
    assert not is_video and output.suffix==".zip"
    with zipfile.ZipFile(output) as z:
        assert len(z.namelist())==3
        assert all(name.endswith(".webp") for name in z.namelist())
    assert not (tmp_path/"instagram_media").exists()


def test_instagram_reels_and_gallery_api_in_site(tmp_path,monkeypatch):
    movie=tmp_path/"fixture.mp4"
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y",
                    "-f","lavfi","-i","color=c=black:s=320x180:r=10",
                    "-f","lavfi","-i","sine=frequency=600:duration=2",
                    "-t","2","-c:v","libx264","-preset","ultrafast",
                    "-c:a","aac",str(movie)],check=True,capture_output=True)

    def fake_inspect(url):
        if "/reel/" in url:
            return {"provider":"instagram_vx","site":"instagram",
                "content_type":"video","id":"DZntaBKS0AR","duration":0,
                "duration_unknown":True,"qualities":[0],"title":"테스트 릴스",
                "channel":"Instagram","thumbnail":"","note":"test"}
        return {"provider":"instagram_vx","site":"instagram","content_type":"photo",
            "id":"DCkNonioVx2","photo_count":2,"duration":0,
            "qualities":[],"title":"사진 게시물", "channel":"Instagram"}

    def fake_download(url,folder,max_bytes,progress):
        if "/reel/" in url:
            dest=folder/"source.mp4"
            shutil.copyfile(movie,dest)
            return dest,"Instagram_video.mp4",True
        dest=folder/"export.zip"
        with zipfile.ZipFile(dest,"w") as z:z.writestr("photo1.jpg",b"image")
        return dest,"Instagram_photos.zip",False

    monkeypatch.setattr(server,"inspect_instagram_vx",fake_inspect)
    monkeypatch.setattr(server,"download_instagram_vx",fake_download)
    client=TestClient(server.app)

    for url,mode,quality,header_marker in [
        (VIDEO_POST,"mp4",0,"mp4"),(VIDEO_POST,"mp3",192,"mp3"),
        (PHOTO_POST,"photos",0,"zip"),
    ]:
        info=client.post("/api/inspect-social",json={"url":url})
        assert info.status_code==200,info.text
        assert info.json()["provider"]=="instagram_vx"
        created=client.post("/api/jobs",json={
            "url":url,"provider":"instagram_vx","mode":mode,"quality":quality})
        assert created.status_code==202,created.text
        jid=created.json()["id"]
        state=None
        for _ in range(70):
            state=client.get("/api/jobs/"+jid).json()
            if state["state"] in ("ready","error"):break
            time.sleep(.05)
        assert state["state"]=="ready",state
        exported=client.get("/api/jobs/"+jid+"/file")
        assert exported.status_code==200
        assert len(exported.content)>100
        assert header_marker in exported.headers["content-disposition"]
        shutil.rmtree(server.WORKDIR/jid,ignore_errors=True)
        with server._lock:server._jobs.pop(jid,None)

    bad=client.post("/api/jobs",json={"url":VIDEO_POST,
        "provider":"instagram_vx","mode":"mp4","quality":0,
        "start":"00:01","end":"00:02"})
    assert bad.status_code==400
