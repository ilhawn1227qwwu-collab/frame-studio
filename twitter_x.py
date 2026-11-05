"""Public X/Twitter video resolver for FRAME STUDIO.

Only a single, explicitly supplied public post is accepted. FxTwitter receives
the numeric post ID, not cookies or login details. Media is fetched from the
pinned X video CDN; redirects are blocked to prevent SSRF.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from typing import Callable

from social import SocialError, normalize_url

FX_API = "https://api.fxtwitter.com/2/status/"
MAX_JSON_BYTES = 2 * 1024 * 1024
MAX_DOWNLOAD_SECONDS = 20 * 60


class TwitterError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def _post_id(raw_url: str) -> str:
    try:
        site, _, post_id = normalize_url(raw_url)
    except SocialError:
        raise TwitterError("X(트위터) 개별 게시물 주소를 입력해 주세요.") from None
    if site != "twitter":
        raise TwitterError("X(트위터) 개별 게시물 주소를 입력해 주세요.")
    return post_id


def _read_post(post_id: str) -> dict:
    if not post_id.isascii() or not post_id.isdecimal() or not 2 <= len(post_id) <= 20:
        raise TwitterError("올바른 X 게시물 번호가 아니에요.")
    request = urllib.request.Request(
        FX_API + post_id,
        headers={"Accept": "application/json", "User-Agent": "FrameStudio/1.8 (+personal-media-exporter)"},
    )
    try:
        with OPENER.open(request, timeout=16) as response:
            if response.status != 200:
                raise TwitterError("X 공개 게시물 정보를 가져오지 못했어요.")
            data = response.read(MAX_JSON_BYTES + 1)
            if len(data) > MAX_JSON_BYTES:
                raise TwitterError("게시물 정보가 서버 허용 크기를 초과했어요.")
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        raise TwitterError("X 게시물을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.") from exc
    try:
        payload = json.loads(data)
    except (UnicodeDecodeError, ValueError, TypeError):
        raise TwitterError("X 게시물 정보의 형식이 올바르지 않아요.") from None
    if not isinstance(payload, dict) or payload.get("code") != 200:
        raise TwitterError("게시물이 비공개이거나 삭제됐거나 공개 미리보기 서버에서 읽을 수 없어요.")
    post = payload.get("status") or payload.get("tweet")
    if not isinstance(post, dict) or post.get("type") == "tombstone":
        raise TwitterError("공개 게시물을 찾지 못했어요.")
    return post


def _videos(post: dict) -> list[dict]:
    media = post.get("media")
    if not isinstance(media, dict):
        return []
    videos = media.get("videos")
    if not isinstance(videos, list) or not videos:
        videos = [m for m in media.get("all", [])
                  if isinstance(m, dict) and m.get("type") in ("video", "gif")]
    return [v for v in videos if isinstance(v, dict)]


def _video_url(raw: object) -> str | None:
    if not isinstance(raw, str) or len(raw) > 2048:
        return None
    try:
        parsed = urlsplit(raw)
        if (parsed.scheme != "https" or parsed.hostname != "video.twimg.com"
                or parsed.username or parsed.password or parsed.port
                or not parsed.path.lower().endswith(".mp4")):
            return None
    except ValueError:
        return None
    return raw


def _best_source(video: dict) -> str:
    candidates = []
    for item in video.get("formats") or []:
        if not isinstance(item, dict):
            continue
        url = _video_url(item.get("url"))
        if url:
            try:
                bitrate = max(0, int(item.get("bitrate") or 0))
            except (ValueError, TypeError):
                bitrate = 0
            candidates.append((bitrate, url))
    direct = _video_url(video.get("url"))
    if direct:
        candidates.append((0, direct))
    if not candidates:
        raise TwitterError("X에서 다운로드 가능한 MP4 원본을 찾지 못했어요.")
    return max(candidates, key=lambda item: item[0])[1]


def _duration(video: dict) -> int:
    try:
        if video.get("duration") is not None:
            return max(0, int(float(video["duration"])))
        details = video.get("video_info") or {}
        if isinstance(details, dict) and details.get("duration_millis") is not None:
            return max(0, int(float(details["duration_millis"]) / 1000))
    except (TypeError, ValueError, OverflowError):
        pass
    return 0


def inspect(raw_url: str, max_duration: int = 7200) -> dict:
    post_id = _post_id(raw_url)
    post = _read_post(post_id)
    videos = _videos(post)
    if not videos:
        raise TwitterError("이 게시물에는 다운로드할 동영상이나 GIF가 없어요.")
    video = videos[0]
    _best_source(video)
    duration = _duration(video)
    if duration > max_duration:
        raise TwitterError(f"최대 {max_duration // 60}분 길이의 영상만 지원해요.")
    width = int(video.get("width") or 0)
    height = int(video.get("height") or 0)
    max_height = min(width, height) if width and height else 720
    max_height = min(max_height, 2160)
    thumb = video.get("thumbnail_url") or ""
    if not isinstance(thumb, str) or not thumb.startswith("https://"):
        thumb = ""
    author = post.get("author") if isinstance(post.get("author"), dict) else {}
    title = str(post.get("text") or "X 영상").strip().replace("\n", " ")
    note = ("공개 게시물의 영상 정보를 FxTwitter 서버에서 확인했어요. "
            "파일은 FRAME STUDIO에서 저장해요. 비공개·로그인 필요 게시물은 지원하지 않아요.")
    if len(videos) > 1:
        note += " 이 게시물에는 영상이 여러 개 있어 첫 번째 영상만 저장해요."
    return {
        "provider": "twitter_fx", "site": "twitter", "content_type": "video",
        "id": post_id, "title": title[:250], "channel": str(author.get("name") or
        author.get("screen_name") or "")[:180], "thumbnail": thumb,
        "duration": duration, "duration_unknown": duration == 0,
        "qualities": [max_height], "max_height": max_height, "note": note,
    }


def obtain_source(raw_url: str, folder: Path, max_bytes: int,
                  progress: Callable[[int, str], None]) -> Path:
    post_id = _post_id(raw_url)
    post = _read_post(post_id)
    videos = _videos(post)
    if not videos:
        raise TwitterError("이 게시물에서 영상 파일을 찾지 못했어요.")
    media_url = _best_source(videos[0])
    target = folder / "twitter-source.mp4"
    request = urllib.request.Request(
        media_url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; FrameStudio/1.8)",
                 "Accept": "video/mp4,*/*"},
    )
    total = 0
    began = time.monotonic()
    try:
        with OPENER.open(request, timeout=35) as response:
            if response.status != 200:
                raise TwitterError("X 영상 원본 서버에 연결할 수 없어요.")
            length_header = response.headers.get("Content-Length", "")
            if length_header.isdecimal() and int(length_header) > max_bytes:
                raise TwitterError("영상 크기가 서버의 다운로드 제한을 초과했어요.")
            expected = int(length_header) if length_header.isdecimal() else 0
            with target.open("wb") as output:
                while True:
                    if time.monotonic() - began > MAX_DOWNLOAD_SECONDS:
                        raise TwitterError("영상 다운로드 시간이 초과됐어요.")
                    chunk = response.read(256 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_bytes:
                        raise TwitterError("영상 크기가 서버의 다운로드 제한을 초과했어요.")
                    output.write(chunk)
                    if expected:
                        progress(min(78, 5 + int(72 * total / expected)), "X 원본 영상을 다운로드하는 중...")
    except TwitterError:
        raise
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        raise TwitterError("X 원본 영상에 연결하지 못했어요. 다른 공개 게시물로 시도해 주세요.") from exc
    if total == 0:
        raise TwitterError("X 영상 원본 파일이 비어 있어요.")
    progress(78, "영상 다운로드 완료. 파일을 확인하고 있어요...")
    return target
