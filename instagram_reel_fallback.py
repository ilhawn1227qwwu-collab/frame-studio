"""Automatic fallback for public Instagram Reels that vxInstagram cannot resolve.

Uses tightly scoped, known public embed providers and only HTTPS media
origin URLs. Allows no private/login/cookie access. Metadata is used strictly
for video file retrieval; no automatic following of untrusted redirects.
"""
from __future__ import annotations

import re
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable

from social import normalize_url, SocialError

SERVICES = (
    "instagramfix.com",
    "oginstagram.com",
    "kirkstagram.com",
)
MAX_HTML = 210_000
MAX_BYTES = 180 * 1024 * 1024
MAX_TRANSFER_SEC = 230


class ReelFallbackError(Exception):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(_NoRedirect())


class _VideoMeta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag != "meta":
            return
        a = dict(attrs)
        kind = (a.get("property") or a.get("name") or "").lower()
        url = a.get("content")
        if kind in ("og:video", "og:video:url", "og:video:secure_url",
                    "twitter:player:stream") and url:
            self.urls.append(url)


def _validate_mirror_media_url(value: str, host: str, shortcode: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme or parsed.netloc:
        if parsed.scheme != "https" or parsed.hostname != host:
            raise ReelFallbackError("외부 미리보기 서버가 잘못된 파일 주소를 반환했어요.")
    path = parsed.path
    if (parsed.username or parsed.password or parsed.port not in (None, 443)
            or not path.startswith(("/videos/", "/offload/", "/proxy/video/"))
            or shortcode not in path):
        raise ReelFallbackError("릴스 파일 주소를 확인할 수 없어요.")
    url = urllib.parse.urljoin(f"https://{host}/", value)
    if urllib.parse.urlsplit(url).hostname != host:
        raise ReelFallbackError("릴스 영상 주소가 허용된 도메인이 아니에요.")
    return url


def _valid_cdn(url: str) -> bool:
    p = urllib.parse.urlsplit(url)
    host = (p.hostname or "").lower()
    return (p.scheme == "https" and p.port in (None, 443)
            and p.username is None and p.password is None
            and (host.endswith(".cdninstagram.com") or host.endswith(".fbcdn.net")))


def _post_identity(raw_url: str) -> tuple[str, str]:
    try:
        site, canon, ident = normalize_url(raw_url)
    except SocialError:
        raise ReelFallbackError("인스타그램 릴스 또는 게시물 주소를 입력해 주세요.") from None
    if site != "instagram":
        raise ReelFallbackError("인스타그램 주소만 지원해요.")
    if "/share/" in canon:
        from instagram_vx import _parse_post  # avoid module-level cycle
        canon, ident = _parse_post(raw_url)
    if not re.fullmatch(r"[A-Za-z0-9_-]{5,40}", ident):
        raise ReelFallbackError("게시물 주소를 확인할 수 없어요.")
    return canon, ident


def _resolve_source(canon: str, ident: str, host: str) -> str:
    route = urllib.parse.urlsplit(canon).path
    request = urllib.request.Request(f"https://{host}{route}", headers={
        "User-Agent": "Twitterbot/1.0",
        "Accept": "text/html,application/xhtml+xml",
    })
    try:
        with OPENER.open(request, timeout=14) as response:
            if response.status != 200:
                raise ReelFallbackError("미리보기 서버가 게시물을 반환하지 않았어요.")
            body = response.read(MAX_HTML + 1)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        raise ReelFallbackError("미리보기 서버에서 릴스를 확인하지 못했어요.") from None
    if len(body) > MAX_HTML:
        raise ReelFallbackError("릴스 미리보기 응답이 너무 커요.")
    metadata = _VideoMeta()
    metadata.feed(body.decode("utf-8", "replace"))
    for value in metadata.urls:
        try:
            return _validate_mirror_media_url(value, host, ident)
        except (ReelFallbackError, ValueError):
            continue
    raise ReelFallbackError("이 미리보기 서버는 릴스 영상을 제공하지 않아요.")


def inspect(raw_url: str) -> dict:
    canonical, ident = _post_identity(raw_url)
    for host in SERVICES:
        try:
            _resolve_source(canonical, ident, host)
            return {
                "id": ident, "title": "Instagram 공개 릴스·영상",
                "channel": "Instagram", "site": "instagram",
                "provider": "instagram_mirror", "content_type": "video",
                "duration": 0, "duration_unknown": True,
                "qualities": [0], "max_height": 0,
                "thumbnail": "",
                "note": ("기본 미리보기가 해당 릴스를 읽지 못해 다른 공개 미리보기 서버를 사용합니다. "
                         "게시물 주소가 독립적인 미리보기 서비스에 전송되지만, "
                         "영상 파일은 FRAME STUDIO에서 직접 다운로드합니다."),
            }
        except ReelFallbackError:
            continue
    raise ReelFallbackError(
        "공개 미리보기 서버 여러 곳에서 릴스 영상을 찾지 못했어요. "
        "게시물이 공개 상태인지, 주소가 /reel/로 시작하는지 확인해 주세요."
    )


def _receive_video(source_url: str, host: str, output: Path, limit: int,
                   deadline: float, progress: Callable[[int, str], None]) -> None:
    current = source_url
    response = None
    for hop in range(3):
        parsed = urllib.parse.urlsplit(current)
        if parsed.hostname != host and not _valid_cdn(current):
            raise ReelFallbackError("영상 다운로드 주소의 보안 검증에 실패했어요.")
        req = urllib.request.Request(current, headers={
            "User-Agent": "Mozilla/5.0 (compatible; FrameStudio/1.0)",
            "Accept": "video/mp4,video/*,*/*",
        })
        try:
            response = OPENER.open(req, timeout=24)
            if response.status not in (200, 206):
                response.close()
                raise ReelFallbackError("외부 서버에서 영상 데이터를 반환하지 않았어요.")
            break
        except urllib.error.HTTPError as exc:
            if exc.code not in (301, 302, 303, 307, 308):
                raise ReelFallbackError("외부 서버에서 영상 요청을 거부했어요.") from None
            target = urllib.parse.urljoin(current, exc.headers.get("location", ""))
            if not _valid_cdn(target):
                raise ReelFallbackError("영상 주소가 신뢰할 수 없는 서버로 이동했어요.") from None
            current = target
        except (urllib.error.URLError, TimeoutError, OSError):
            raise ReelFallbackError("릴스 영상 서버와 연결하지 못했어요.") from None
    else:
        raise ReelFallbackError("미디어 서버의 연결 경로가 너무 복잡해요.")
    assert response is not None
    with response:
        mime = response.headers.get("content-type", "").split(";")[0].lower()
        if mime not in ("video/mp4", "video/quicktime", "application/octet-stream"):
            raise ReelFallbackError("서버가 영상 파일 대신 다른 데이터를 반환했어요.")
        length = response.headers.get("content-length", "")
        if length.isdigit() and int(length) > limit:
            raise ReelFallbackError("영상 용량이 무료 서버 제한을 초과했어요.")
        total = 0
        with output.open("wb") as file:
            while True:
                if time.monotonic() >= deadline:
                    raise ReelFallbackError("릴스 다운로드 제한 시간을 초과했어요.")
                try:
                    block = response.read(64 * 1024)
                except (TimeoutError, OSError):
                    raise ReelFallbackError("릴스 파일 전송이 중단됐어요.") from None
                if not block:
                    break
                total += len(block)
                if total > limit:
                    raise ReelFallbackError("영상 크기가 서버 제한을 초과했어요.")
                file.write(block)
                if length.isdigit() and int(length) > 0:
                    progress(min(75, 5 + int(70 * total / int(length))),
                             "대체 서버에서 릴스 영상 다운로드 중...")
    if total < 1024:
        raise ReelFallbackError("릴스 영상 파일이 비어 있어요.")


def obtain_source(raw_url: str, folder: Path, max_bytes: int,
                  progress: Callable[[int, str], None]) -> Path:
    canonical, ident = _post_identity(raw_url)
    limit = min(MAX_BYTES, max_bytes)
    deadline = time.monotonic() + MAX_TRANSFER_SEC
    last_error = None
    for host in SERVICES:
        if time.monotonic() >= deadline:
            break
        output = folder / "instagram_mirror_source.mp4"
        output.unlink(missing_ok=True)
        try:
            media_url = _resolve_source(canonical, ident, host)
            progress(4, "대체 인스타그램 미리보기 서버 확인 중...")
            _receive_video(media_url, host, output, limit, deadline, progress)
            return output
        except ReelFallbackError as exc:
            last_error = exc
    if last_error:
        raise ReelFallbackError(
            "릴스 영상 서버 여러 곳에서 다운로드에 실패했어요. "
            "다른 공개 릴스에서 재시도하거나 주소를 확인해 주세요."
        ) from None
    raise ReelFallbackError("릴스 영상을 가져오지 못했어요.")
