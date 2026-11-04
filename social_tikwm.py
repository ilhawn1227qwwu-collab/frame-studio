"""Explicit opt-in TikWM fallback for public TikTok videos.

A video URL is only sent to the independent TikWM service after the user
chooses '외부 처리 서버로 불러오기'. No site credentials or cookies are sent.
Only allowlisted HTTPS video-CDN hosts are opened. Personal, low-volume use.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable

from social import normalize_url, SocialError

API = "https://www.tikwm.com/api/"
MAX_MEDIA_BYTES = 180 * 1024 * 1024
TIME_LIMIT = 210


class TikWMError(Exception):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(_NoRedirect())
MEDIA_HOST_SUFFIXES = (
    "tikwm.com",
    "tiktokcdn-us.com",
    "tiktokcdn.com",
    "tiktokv.com",
    "byteoversea.com",
)


def _safe_media_url(raw: str) -> str:
    url = urllib.parse.urljoin("https://www.tikwm.com/", raw)
    parsed = urllib.parse.urlsplit(url)
    host = (parsed.hostname or "").lower()
    if (parsed.scheme != "https" or parsed.username or parsed.password
            or parsed.port not in (None,443)
            or not any(host == suffix or host.endswith("." + suffix)
                       for suffix in MEDIA_HOST_SUFFIXES)):
        raise TikWMError("외부 영상 서버가 신뢰할 수 없는 주소를 반환했어요.")
    return url


def _request_info(raw_url: str) -> dict:
    site,url,identifier=normalize_url(raw_url)
    if site != "tiktok":
        raise TikWMError("틱톡 영상 주소만 지원해요.")
    form=urllib.parse.urlencode({"url":url,"hd":"1"}).encode("utf-8")
    request=urllib.request.Request(API,data=form,method="POST",headers={
        "Content-Type":"application/x-www-form-urlencoded",
        "Accept":"application/json",
        "User-Agent":"Mozilla/5.0 (compatible; FrameStudio/1.0)",
    })
    try:
        with OPENER.open(request,timeout=20) as response:
            if response.status != 200:
                raise TikWMError("외부 영상 서버가 응답하지 않아요.")
            blob=response.read(180_001)
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,OSError):
        raise TikWMError("외부 틱톡 처리 서버가 응답하지 않아요. 잠시 후 다시 시도해 주세요.") from None
    if len(blob)>180000:
        raise TikWMError("영상 정보 응답이 허용 크기를 초과했어요.")
    try:
        info=json.loads(blob)
    except (ValueError,UnicodeDecodeError):
        raise TikWMError("영상 정보 응답을 해석할 수 없어요.") from None
    data=info.get("data") if isinstance(info,dict) and info.get("code")==0 else None
    if not isinstance(data,dict):
        raise TikWMError("영상 정보를 찾을 수 없어요. 영상이 공개되어 있는지 확인해 주세요.")
    urls=[]
    for field in ("hdplay","play"):
        candidate=data.get(field)
        if isinstance(candidate,str) and candidate:
            try:
                resolved=_safe_media_url(candidate)
                if resolved not in urls:
                    urls.append(resolved)
            except TikWMError:
                pass
    if not urls:
        raise TikWMError("외부 서비스에서 접근 가능한 영상 파일을 찾지 못했어요.")
    duration=int(data.get("duration") or 0)
    if not 0<duration<=7200:
        raise TikWMError("영상 길이를 확인할 수 없거나 최대 2시간 제한을 초과했어요.")
    return data


def inspect(raw_url: str) -> dict:
    data=_request_info(raw_url)
    site,_,identifier=normalize_url(raw_url)
    author=data.get("author") if isinstance(data.get("author"),dict) else {}
    cover=str(data.get("cover") or "")
    if not cover.startswith("https://"):
        cover=""
    return {
        "id":str(data.get("id") or identifier)[:32],
        "title":str(data.get("title") or "TikTok 공개 영상")[:250],
        "channel":str(author.get("unique_id") or author.get("nickname") or "")[:150],
        "thumbnail":cover,
        "duration":int(data["duration"]),
        "site":"tiktok","provider":"tikwm","content_type":"video",
        "qualities":[0],"max_height":0,
        "note":"TikWM 외부 서버를 통해 불러왔어요. 실제 스트림 화질로 저장하며 원본보다 높일 수 없어요.",
    }


def _download_one(url: str, output: Path, progress: Callable[[int],None], limit: int):
    start=time.monotonic()
    current=url
    for hop in range(5):
        current=_safe_media_url(current)
        request=urllib.request.Request(current,headers={
            "User-Agent":"Mozilla/5.0 (compatible; FrameStudio/1.0)",
            "Accept":"video/*,*/*",
        })
        try:
            response=OPENER.open(request,timeout=24)
        except urllib.error.HTTPError as exc:
            if exc.code in (301,302,303,307,308) and exc.headers.get("location") and hop<4:
                current=urllib.parse.urljoin(current,exc.headers["location"])
                continue
            raise TikWMError(f"외부 서버가 영상 요청을 거부했어요 (HTTP {exc.code}).") from None
        except (urllib.error.URLError,TimeoutError,OSError):
            raise TikWMError("외부 영상 서버에 연결하지 못했어요.") from None
        with response:
            if response.status not in (200,206):
                raise TikWMError("외부 서버가 영상을 반환하지 않았어요.")
            ct=response.headers.get("content-type","").lower()
            if ct.startswith(("text/","application/json")):
                raise TikWMError("외부 서비스가 영상 대신 오류 페이지를 반환했어요.")
            total_size=response.headers.get("content-length","")
            if total_size.isdigit() and int(total_size)>limit:
                raise TikWMError("영상 파일이 무료 서버의 용량 제한을 초과했어요.")
            got=0
            with output.open("wb") as stream:
                while True:
                    if time.monotonic()-start>TIME_LIMIT:
                        raise TikWMError("영상 파일을 가져오는 시간이 너무 오래 걸렸어요.")
                    try:
                        chunk=response.read(64*1024)
                    except (TimeoutError,OSError):
                        raise TikWMError("외부 서버의 영상 전송이 중단됐어요.") from None
                    if not chunk:
                        break
                    got+=len(chunk)
                    if got>limit:
                        raise TikWMError("영상 파일 크기 제한을 초과했어요.")
                    stream.write(chunk)
                    if total_size.isdigit() and int(total_size)>0:
                        progress(min(99,int(got/int(total_size)*100)))
        if not got:
            raise TikWMError("외부 서버가 빈 영상 파일을 반환했어요.")
        return
    raise TikWMError("외부 영상 서버의 연결 경로가 너무 복잡해요.")


def obtain_source(raw_url: str, folder: Path, limit_bytes: int,
                  progress: Callable[[int,str],None]) -> Path:
    data=_request_info(raw_url)
    candidates=[]
    for key in ("hdplay","play"):
        raw=data.get(key)
        if isinstance(raw,str) and raw:
            try:
                url=_safe_media_url(raw)
                if url not in candidates:
                    candidates.append(url)
            except TikWMError:
                pass
    for i,url in enumerate(candidates):
        output=folder/"social_source.mp4"
        output.unlink(missing_ok=True)
        try:
            progress(12,"외부 틱톡 서버에서 영상 가져오는 중...")
            _download_one(url,output,lambda pct: progress(12+int(pct*.6),"영상 다운로드 중..."),
                          min(MAX_MEDIA_BYTES,limit_bytes))
            if output.is_file() and output.stat().st_size>5000:
                return output
        except TikWMError:
            if i+1==len(candidates):
                raise
    raise TikWMError("외부 틱톡 서버에서 영상 데이터를 받을 수 없어요.")
