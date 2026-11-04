"""TikWM fallback: strict host controls, provider opt-in and working MP4 API."""
import io
import json
import shutil
import subprocess
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import social_tikwm
import server

URL="https://www.tiktok.com/@matatogames/video/7179163174057364742"


@pytest.mark.parametrize("unsafe",[
    "http://www.tikwm.com/a.mp4",
    "https://www.tikwm.com.evil.net/video.mp4",
    "https://127.0.0.1/admin",
    "https://localhost/private",
    "file:///etc/passwd",
    "https://v16m.tiktokcdn-us.com:444/clip.mp4",
    "https://v16m.tiktokcdn-us.com@127.0.0.1/admin",
])
def test_media_sources_are_strictly_allowlisted(unsafe):
    with pytest.raises(social_tikwm.TikWMError):
        social_tikwm._safe_media_url(unsafe)


def test_approved_tiktok_cdn_names():
    for hostname in ("v16m.tiktokcdn-us.com", "v16-notes.tiktokcdn-us.com",
                     "www.tikwm.com"):
        url="https://"+hostname+"/stream.mp4?token=123"
        assert social_tikwm._safe_media_url(url)==url


def fake_api_response():
    return {"code":0,"data":{
        "id":"7179163174057364742","duration":14,
        "title":"공개 영상 테스트","cover":"https://example.org/image.jpg",
        "author":{"unique_id":"matatogames"},
        "hdplay":"https://v16-notes.tiktokcdn-us.com/hd.mp4",
        "play":"https://v16m.tiktokcdn-us.com/standard.mp4",
    }}


class BytesResponse(io.BytesIO):
    def __init__(self,data,content_type="application/json"):
        super().__init__(data)
        self.status=200
        self.headers={"content-type":content_type,"content-length":str(len(data))}


def test_tikwm_metadata_only_sends_clean_tiktok_url(monkeypatch):
    requests=[]
    def open_req(request,timeout):
        requests.append(request)
        return BytesResponse(json.dumps(fake_api_response()).encode())
    monkeypatch.setattr(social_tikwm.OPENER,"open",open_req)
    result=social_tikwm.inspect(URL+"?share=tracking")
    assert result["provider"]=="tikwm"
    assert result["duration"]==14
    assert result["qualities"]==[0]
    assert len(requests)==1
    assert requests[0].full_url=="https://www.tikwm.com/api/"
    assert b"share" not in requests[0].data


def test_tikwm_stream_download_is_bounded(monkeypatch,tmp_path):
    def open_media(request,timeout):
        assert request.full_url.startswith("https://v16m.tiktokcdn-us.com/")
        return BytesResponse(b"\x00\x00\x00\x18ftypmp42"+b"a"*9000,"video/mp4")
    monkeypatch.setattr(social_tikwm.OPENER,"open",open_media)
    dest=tmp_path/"test.mp4"
    percents=[]
    social_tikwm._download_one("https://v16m.tiktokcdn-us.com/standard.mp4",
                               dest,lambda pct:percents.append(pct),20000)
    assert dest.stat().st_size>9000
    assert percents and percents[-1]>=90
    with pytest.raises(social_tikwm.TikWMError):
        social_tikwm._download_one("https://v16m.tiktokcdn-us.com/standard.mp4",
                                   tmp_path/"too_large.mp4",lambda pct:None,200)


def test_tikwm_job_produces_mp4(tmp_path,monkeypatch):
    def fake_inspect(url):
        return {"id":"7179163174057364742","provider":"tikwm","site":"tiktok",
            "content_type":"video","title":"테스트","duration":2,"qualities":[0]}
    movie=tmp_path/"movie.mp4"
    subprocess.run([
        "ffmpeg","-hide_banner","-loglevel","error","-y",
        "-f","lavfi","-i","color=c=black:s=320x180:r=10",
        "-f","lavfi","-i","sine=frequency=400:duration=2",
        "-t","2","-c:v","libx264","-preset","ultrafast",
        "-c:a","aac",str(movie)
    ],check=True,capture_output=True)
    def fake_source(url,folder,limit,update):
        output=folder/"social_source.mp4"
        shutil.copyfile(movie,output)
        update(40,"test copy")
        return output
    monkeypatch.setattr(server,"inspect_tikwm",fake_inspect)
    monkeypatch.setattr(server,"obtain_tikwm_source",fake_source)
    client=TestClient(server.app)
    result=client.post("/api/inspect-tikwm",json={"url":URL})
    assert result.status_code==200
    assert result.json()["qualities"]==[0]
    created=client.post("/api/jobs",json={
        "provider":"tikwm","url":URL,"mode":"mp4","quality":0
    })
    assert created.status_code==202,created.text
    job_id=created.json()["id"]
    status={}
    for _ in range(80):
        status=client.get("/api/jobs/"+job_id).json()
        if status.get("state") in ("ready","error"):
            break
        time.sleep(.05)
    assert status.get("state")=="ready",status
    response=client.get("/api/jobs/"+job_id+"/file")
    assert response.status_code==200 and len(response.content)>1000
    shutil.rmtree(server.WORKDIR/job_id,ignore_errors=True)
    with server._lock:
        server._jobs.pop(job_id,None)
