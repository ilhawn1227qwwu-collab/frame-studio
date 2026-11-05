"""Public TikTok video and Instagram post support for FRAME STUDIO.

Only one explicitly supplied public post is accepted. No accounts, feeds,
stories, hidden posts, cookies, or credentials are requested or forwarded.
Video uses yt-dlp, Instagram images use gallery-dl.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import time
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

import yt_dlp

PHOTO_EXTS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
PHOTO_MAX_COUNT = 12
PHOTO_MAX_SINGLE = 18 * 1024 * 1024
PHOTO_MAX_TOTAL = 96 * 1024 * 1024
SOCIAL_MAX_DURATION = 7200
TIKTOK_HOSTS = frozenset({"tiktok.com", "www.tiktok.com", "m.tiktok.com",
                          "vm.tiktok.com", "vt.tiktok.com"})
INSTAGRAM_HOSTS = frozenset({"instagram.com", "www.instagram.com",
                             "m.instagram.com", "instagr.am", "www.instagr.am"})
TWITTER_HOSTS = frozenset({"x.com", "www.x.com", "mobile.x.com", "twitter.com",
                           "www.twitter.com", "mobile.twitter.com", "m.twitter.com"})


class SocialError(Exception):
    pass


def normalize_url(raw: str) -> tuple[str, str, str]:
    """Return (site, canonical single-post URL, sanitized opaque post id)."""
    try:
        value = urlsplit(raw.strip())
        host = (value.hostname or "").lower()
        if value.scheme not in ("http", "https") or value.username or value.password or value.port:
            raise ValueError
        path = value.path.rstrip("/")
        if host in INSTAGRAM_HOSTS:
            match = re.fullmatch(r"/(p|reel|reels|tv)/([A-Za-z0-9_-]{5,40})", path)
            if match:
                kind, identifier = match.groups()
                if kind == "reels":
                    kind = "reel"
                return "instagram", f"https://www.instagram.com/{kind}/{identifier}/", identifier
            # Instagram's Copy Link feature can produce short /share/reel/ links,
            # which redirect to the actual canonical shortcode.
            share = re.fullmatch(r"/share/(?:(reel|reels|p)/)?([A-Za-z0-9_-]{5,60})", path)
            if share:
                kind, token = share.groups()
                kind = "reel" if kind == "reels" else kind
                prefix = f"{kind}/" if kind else ""
                return "instagram", f"https://www.instagram.com/share/{prefix}{token}/", token
            # Instagram also supports user-qualified post URLs.
            username = re.fullmatch(
                r"/([A-Za-z0-9_.]{2,30})/(p|reel|reels|tv)/([A-Za-z0-9_-]{5,40})",
                path)
            if username:
                _, kind, identifier = username.groups()
                return "instagram", f"https://www.instagram.com/{'reel' if kind == 'reels' else kind}/{identifier}/", identifier
            raise ValueError
        if host in TWITTER_HOSTS:
            tweet = re.fullmatch(r"/(?:([A-Za-z0-9_]{1,15})|i|i/web)/status/([0-9]{2,20})(?:/(?:video|photo)/[1-4])?", path)
            if tweet:
                identifier = tweet.group(2)
                return "twitter", f"https://x.com/i/status/{identifier}", identifier
            raise ValueError
        if host in TIKTOK_HOSTS:
            match = re.fullmatch(r"/@([A-Za-z0-9._-]{2,36})/video/([0-9]{8,24})", path)
            if match:
                handle, identifier = match.groups()
                return "tiktok", f"https://www.tiktok.com/@{handle}/video/{identifier}", identifier
            short = re.fullmatch(r"/([A-Za-z0-9_-]{4,28})", path) if host.startswith(("vm.", "vt.")) else None
            if short:
                return "tiktok", f"https://{host}/{short.group(1)}/", short.group(1)
            token = re.fullmatch(r"/t/([A-Za-z0-9_-]{4,28})", path)
            if token:
                return "tiktok", f"https://www.tiktok.com/t/{token.group(1)}/", token.group(1)
            raise ValueError
    except (ValueError, TypeError):
        pass
    raise SocialError("유튜브·틱톡·인스타그램 또는 X(트위터)의 개별 게시물 링크를 입력해 주세요.")


def _gallery_base_args() -> list[str]:
    if not shutil.which("gallery-dl"):
        raise SocialError("사진 추출 도구가 서버에 설치되지 않았어요.")
    # A single post, 12 media items max; no profile, cookies, browser profile,
    # default configuration, shell interpolation or arbitrary user options.
    return [
        "gallery-dl", "--config-ignore", "--no-input", "--no-postprocessors",
        "--retries", "1", "--http-timeout", "14",
        "--range", f"1-{PHOTO_MAX_COUNT}",
        "--filter", "extension in ('jpg','jpeg','png','webp')",
    ]


def _gallery_probe(url: str) -> int:
    cmd = _gallery_base_args() + ["--print", "{extension}", "--no-download", url]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True,
                                timeout=38, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise SocialError("인스타그램 사진 정보를 확인하는 중 서버 응답 시간이 초과됐어요.") from None
    if result.returncode != 0:
        # Instagram often requires authentication even for public posts.
        raise SocialError("인스타그램이 사진 접근을 거부했어요. 공개 게시물도 로그인 검사가 적용될 수 있어요.")
    extensions = [line.strip().lower() for line in result.stdout.splitlines()]
    return min(PHOTO_MAX_COUNT, sum(ext in ("jpg", "jpeg", "png", "webp") for ext in extensions))


def _video_info(url: str, site: str, post_id: str, duration_limit: int) -> dict:
    opts = {
        "quiet": True, "no_warnings": True, "noplaylist": True,
        "skip_download": True, "socket_timeout": 20, "retries": 1,
        "extract_flat": False,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(url, download=False)
    except Exception:
        raise SocialError(
            f"{'틱톡' if site == 'tiktok' else 'X(트위터)' if site == 'twitter' else '인스타그램'}이 서버 접근을 제한했거나 영상이 공개되지 않았어요. "
            "로그인이 필요한 영상은 지원하지 않아요."
        ) from None
    if not isinstance(data, dict):
        raise SocialError("영상 정보를 확인할 수 없어요.")
    if data.get("_type") == "playlist":
        entries = [e for e in data.get("entries", []) if isinstance(e, dict)]
        if len(entries) != 1:
            raise SocialError("여러 개의 영상이 포함된 게시물은 현재 개별 영상으로 지원하지 않아요.")
        data = entries[0]
    if data.get("is_live") or data.get("live_status") in ("is_live", "is_upcoming"):
        raise SocialError("라이브 방송은 지원하지 않아요.")
    duration = int(data.get("duration") or 0)
    if duration <= 0 or duration > duration_limit:
        raise SocialError(f"최대 {duration_limit // 60}분 길이의 공개 영상만 지원해요.")
    formats = data.get("formats") or []
    video_formats = [f for f in formats if isinstance(f, dict) and f.get("vcodec") != "none"]
    if not video_formats and not data.get("url"):
        raise SocialError("재생 가능한 영상 형식을 찾을 수 없어요.")
    resolutions = set()
    for f in video_formats:
        width, height = f.get("width"), f.get("height")
        if isinstance(width, int) and isinstance(height, int):
            height_label = min(width, height) if height > width else height
        else:
            height_label = height
        if isinstance(height_label, (int, float)) and 0 < height_label <= 2160:
            resolutions.add(int(height_label))
    if resolutions:
        max_height = max(resolutions)
        qualities = sorted({n for n in (240, 360, 480, 540, 720, 1080, 1440, 2160)
                            if n <= max_height and n in resolutions})
        if not qualities:
            qualities = [max_height]
    else:
        qualities, max_height = [720], 720
    thumb = data.get("thumbnail") if isinstance(data.get("thumbnail"), str) else ""
    if not thumb.startswith("https://"):
        thumb = ""
    return {
        "provider": site,
        "site": site,
        "content_type": "video",
        "id": post_id,
        "title": str(data.get("title") or data.get("description") or
                     f"{site.title()} 영상")[:250],
        "channel": str(data.get("uploader") or data.get("channel") or
                       data.get("creator") or "")[:180],
        "thumbnail": thumb,
        "duration": duration,
        "qualities": [max_height],
        "max_height": max_height,
        "note": "SNS가 제공하는 원본 영상 중 재생 가능한 형식을 자동으로 선택해요. 화질을 인위적으로 높이지 않으며, 로그인·서버 제한이 있으면 실패할 수 있어요.",
    }


def inspect(raw_url: str, duration_limit: int = SOCIAL_MAX_DURATION) -> dict:
    site, url, identifier = normalize_url(raw_url)
    if site == "instagram" and "/p/" in url:
        try:
            count = _gallery_probe(url)
            if count:
                return {
                    "provider": "instagram_photo", "site": "instagram",
                    "content_type": "photo", "id": identifier,
                    "title": "Instagram 사진 게시물", "channel": "",
                    "thumbnail": "", "duration": 0, "qualities": [],
                    "photo_count": count,
                    "note": f"사진 {count}장 확인. 한 장은 원본 이미지, 여러 장은 ZIP 파일로 저장해요.",
                }
        except SocialError:
            # Video-only posts may not have any image. Try the video extractor.
            pass
    return _video_info(url, site, identifier, duration_limit)


def download_photos(raw_url: str, directory: Path, limit_bytes: int) -> tuple[Path, str]:
    site, url, identifier = normalize_url(raw_url)
    if site != "instagram" or "/p/" not in url:
        raise SocialError("인스타그램 사진 게시물 링크만 지원해요.")
    sources = directory / "gallery"
    sources.mkdir(parents=True, exist_ok=False)
    cmd = _gallery_base_args() + [
        "--directory", str(sources),
        "--filesize-max", str(PHOTO_MAX_SINGLE),
        "--limit-rate", "4M",
        url,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True,
                                timeout=170, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise SocialError("사진을 가져오는 데 시간이 너무 오래 걸렸어요.") from None
    images = sorted(p for p in sources.rglob("*") if
                    p.is_file() and not p.is_symlink() and p.suffix.lower() in PHOTO_EXTS)
    if not images:
        raise SocialError(
            "인스타그램 사진을 받지 못했어요. 서버의 로그인 검사 또는 게시물 공개 상태를 확인해 주세요."
        )
    if len(images) > PHOTO_MAX_COUNT:
        raise SocialError("사진은 게시물당 최대 12장까지 지원해요.")
    total = sum(p.stat().st_size for p in images)
    if total > PHOTO_MAX_TOTAL or total > limit_bytes or any(
        p.stat().st_size > PHOTO_MAX_SINGLE for p in images
    ):
        raise SocialError("사진 용량이 무료 서버의 다운로드 제한을 초과했어요.")
    if len(images) == 1:
        ext = images[0].suffix.lower()
        target = directory / ("export" + ext)
        shutil.copyfile(images[0], target)
        return target, f"Instagram_{identifier}{ext}"
    target = directory / "export.zip"
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_STORED) as archive:
        for i, photo in enumerate(images, 1):
            archive.write(photo, arcname=f"Instagram_{identifier}_{i:02}{photo.suffix.lower()}")
    if target.stat().st_size > limit_bytes:
        raise SocialError("압축한 사진 파일이 서버 용량 제한을 초과했어요.")
    return target, f"Instagram_{identifier}_{len(images)}photos.zip"
