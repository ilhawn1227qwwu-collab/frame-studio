"""Public Instagram photos, reels and video via a bounded vxInstagram embed.

No Instagram account/cookies. Explicit public shortcode is sent to an
independent media preview service, whose documented offload redirects to
Instagram's publicly accessible CDN. Never accept untrusted media URLs.
This integration is low-volume, one post only, and may stop working whenever
Instagram or the independent service changes their policy.
"""
from __future__ import annotations

import base64
import json
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Callable

from social import normalize_url, SocialError

BASE = "https://www.vxinstagram.com"
HOST = "www.vxinstagram.com"
MAX_ITEMS = 12
MAX_RESPONSE = 350_000
MAX_IMAGE_BYTES = 22 * 1024 * 1024
MAX_VIDEO_BYTES = 200 * 1024 * 1024
MAX_TOTAL_BYTES = 225 * 1024 * 1024
MAX_TRANSFER_SECONDS = 240


class InstagramVXError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect())


def _parse_post(raw: str) -> tuple[str, str]:
    try:
        site, url, ident = normalize_url(raw)
    except SocialError:
        raise InstagramVXError("공개 인스타그램 게시물 또는 릴스 주소를 입력해 주세요.") from None
    if site != "instagram" or not re.fullmatch(r"[A-Za-z0-9_-]{5,40}", ident):
        raise InstagramVXError("인스타그램 개별 게시물·릴스만 지원해요.")
    return url, ident


def _cdn_allowed(url: str) -> bool:
    try:
        p = urllib.parse.urlsplit(url)
        hostname = (p.hostname or "").lower()
        return (p.scheme == "https" and p.port in (None, 443) and
                not p.username and not p.password and
                (hostname.endswith(".cdninstagram.com") or hostname.endswith(".fbcdn.net")))
    except ValueError:
        return False


def _preview_allowed(url: str) -> bool:
    try:
        p = urllib.parse.urlsplit(url)
        return (p.scheme == "https" and p.hostname in ("vxinstagram.com", HOST)
                and p.port in (None, 443) and not p.username and not p.password)
    except ValueError:
        return False


def _request_post(url: str, ident: str, start: int) -> list[dict]:
    encoded = base64.urlsafe_b64encode(
        f"{ident}&{start}&{url}".encode("utf-8")
    ).rstrip(b"=").decode("ascii")
    api = f"{BASE}/api/v1/statuses/{encoded}"
    request = urllib.request.Request(api, headers={
        "Accept": "application/json", "User-Agent": "FrameStudio/1.0",
    })
    try:
        with OPENER.open(request, timeout=20) as response:
            if response.status != 200:
                raise InstagramVXError("공개 게시물 미리보기 서버가 응답하지 않아요.")
            content = response.read(MAX_RESPONSE + 1)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        raise InstagramVXError("인스타그램 공개 미리보기 정보를 불러올 수 없어요.") from None
    if len(content) > MAX_RESPONSE:
        raise InstagramVXError("미리보기 정보가 너무 커요.")
    try:
        obj = json.loads(content)
    except (ValueError, UnicodeDecodeError):
        raise InstagramVXError("인스타그램 미리보기 정보를 해석할 수 없어요.") from None
    entries = obj.get("media_attachments") if isinstance(obj, dict) else None
    if not isinstance(entries, list):
        raise InstagramVXError("미리보기에서 이미지·영상 데이터를 찾지 못했어요.")
    parsed = []
    for position, m in enumerate(entries[:4]):
        if not isinstance(m, dict) or m.get("type") not in ("image", "video"):
            continue
        raw_offload = m.get("url")
        if not isinstance(raw_offload, str) or not _preview_allowed(raw_offload):
            continue
        p = urllib.parse.urlsplit(raw_offload)
        if not re.fullmatch(r"/offload/[A-Za-z0-9_-]{5,40}(?:\.mp4)?", p.path):
            continue
        # Accept only media pointing at the shortcode we explicitly requested.
        post_path = p.path.split("/")[2].removesuffix(".mp4")
        if post_path != ident:
            continue
        values = urllib.parse.parse_qs(p.query).get("order")
        try:
            index = int(values[0]) if values else start + position
        except (ValueError, TypeError):
            continue
        if not 0 <= index <= 30:
            continue
        parsed.append({"index": index, "type": m["type"]})
    return parsed


def _post_items(url: str, ident: str) -> list[dict]:
    items, seen = [], set()
    for offset in range(0, MAX_ITEMS, 4):
        batch = _request_post(url, ident, offset)
        if not batch:
            break
        fresh = 0
        for candidate in batch:
            if candidate["index"] in seen:
                continue
            seen.add(candidate["index"])
            items.append(candidate)
            fresh += 1
            if len(items) >= MAX_ITEMS:
                break
        if fresh == 0 or len(batch) < 4:
            break
    if not items:
        raise InstagramVXError(
            "공개 게시물에서 다운로드 가능한 사진·영상을 찾지 못했어요. "
            "비공개·삭제된 콘텐츠는 지원하지 않아요."
        )
    return items[:MAX_ITEMS]


def inspect(raw_url: str) -> dict:
    url, ident = _parse_post(raw_url)
    items = _post_items(url, ident)
    single_video = len(items) == 1 and items[0]["type"] == "video"
    count = len(items)
    return {
        "id": ident,
        "title": "Instagram 공개 릴스·영상" if single_video else "Instagram 사진·영상 게시물",
        "channel": "Instagram",
        "site": "instagram",
        "provider": "instagram_vx",
        "content_type": "video" if single_video else "photo",
        "duration": 0,
        "duration_unknown": single_video,
        "qualities": [0] if single_video else [],
        "max_height": 0,
        "photo_count": 0 if single_video else count,
        "gallery_has_video": not single_video and any(x["type"] == "video" for x in items),
        "thumbnail": f"{BASE}/offload/{ident}?order=0&thumbnail=true",
        "note": ("공개 미리보기 서비스(vxInstagram)에서 받은 파일을 FRAME STUDIO 안에서 저장해요. "
                 "인스타그램 영상은 원본 형식으로, 여러 장의 게시물은 ZIP으로 저장합니다. "
                 "게시물 링크가 이 서비스로 전달됩니다."),
    }


def _download_item(ident: str, item: dict, output: Path,
                   size_limit: int, deadline: float,
                   progress: Callable[[int], None]) -> str:
    # Only a verified shortcode + bounded index are inserted into the URL.
    offload = f"{BASE}/offload/{ident}?order={item['index']}"
    request = urllib.request.Request(offload, headers={
        "User-Agent": "FrameStudio/1.0", "Accept": "*/*",
    })
    try:
        response = OPENER.open(request, timeout=19)
    except urllib.error.HTTPError as error:
        if error.code not in (301, 302, 303, 307, 308):
            raise InstagramVXError("미리보기 서버가 원본 파일 요청을 거부했어요.") from None
        target = urllib.parse.urljoin(offload, error.headers.get("location", ""))
        if not _cdn_allowed(target):
            raise InstagramVXError("미디어 서버가 신뢰할 수 없는 다운로드 주소를 반환했어요.") from None
        response = None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise InstagramVXError("공개 미리보기 서버에 연결하지 못했어요.") from None
    else:
        # Some previews may serve media bytes directly.
        target = offload
        if response.status not in (200, 206):
            response.close()
            raise InstagramVXError("미리보기 서버가 파일 데이터를 반환하지 않았어요.")

    if response is None:
        req = urllib.request.Request(target, headers={
            "User-Agent": "Mozilla/5.0", "Accept": "video/*,image/*,*/*",
        })
        try:
            response = OPENER.open(req, timeout=24)
        except urllib.error.HTTPError as error:
            raise InstagramVXError(f"인스타그램 파일 서버가 요청을 거부했어요 (HTTP {error.code}).") from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise InstagramVXError("인스타그램 파일 서버에 연결할 수 없어요.") from None

    with response:
        if response.status not in (200, 206):
            raise InstagramVXError("인스타그램에서 파일 데이터를 받아오지 못했어요.")
        ctype = response.headers.get("content-type", "").lower().split(";")[0]
        expected_type = "video/" if item["type"] == "video" else "image/"
        if not ctype.startswith(expected_type):
            raise InstagramVXError("파일 종류가 게시물 정보와 일치하지 않아요.")
        declared = response.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > size_limit:
            raise InstagramVXError("원본 파일이 서버 용량 제한을 초과했어요.")
        got = 0
        with output.open("wb") as file:
            while True:
                if time.monotonic() > deadline:
                    raise InstagramVXError("인스타그램 다운로드 제한 시간을 초과했어요.")
                try:
                    chunk = response.read(64 * 1024)
                except (TimeoutError, OSError):
                    raise InstagramVXError("인스타그램 파일 전송이 중단됐어요.") from None
                if not chunk:
                    break
                got += len(chunk)
                if got > size_limit:
                    raise InstagramVXError("원본 파일이 서버 용량 제한을 초과했어요.")
                file.write(chunk)
                if declared.isdigit() and int(declared) > 0:
                    progress(int(got * 100 / int(declared)))
    if got < 256:
        raise InstagramVXError("인스타그램 원본 파일이 비어 있어요.")
    return ctype


def _mime_extension(kind: str, ctype: str) -> str:
    if kind == "video":
        return ".mp4"
    return {"image/jpeg": ".jpg", "image/png": ".png",
            "image/webp": ".webp", "image/avif": ".avif"}.get(ctype, ".jpg")


def download(raw_url: str, folder: Path, max_file_bytes: int,
             progress: Callable[[int, str], None]) -> tuple[Path, str, bool]:
    """Return (output_path, filename, is_single_video)."""
    url, ident = _parse_post(raw_url)
    items = _post_items(url, ident)
    if not items:
        raise InstagramVXError("인스타그램 게시물에 다운로드할 파일이 없어요.")
    one_video = len(items) == 1 and items[0]["type"] == "video"
    deadline = time.monotonic() + MAX_TRANSFER_SECONDS
    max_total = min(MAX_TOTAL_BYTES, max_file_bytes)
    folder_media = folder / "instagram_media"
    folder_media.mkdir(exist_ok=False)
    files = []
    running_size = 0
    for idx, item in enumerate(items, 1):
        max_per = MAX_VIDEO_BYTES if item["type"] == "video" else MAX_IMAGE_BYTES
        capacity = min(max_per, max_total - running_size)
        if capacity <= 0:
            raise InstagramVXError("게시물 전체가 무료 서버 용량 제한을 초과했어요.")
        path = folder_media / f"media_{idx:02d}.bin"
        progress(10 + int((idx - 1) * 65 / len(items)),
                 f"인스타그램 파일 {idx}/{len(items)} 다운로드 중...")
        ctype = _download_item(ident, item, path, capacity, deadline,
                               lambda pct: progress(
                                   10 + int(((idx - 1) + pct / 100) * 65 / len(items)),
                                   f"파일 {idx}/{len(items)} 다운로드 중..."))
        running_size += path.stat().st_size
        ext = _mime_extension(item["type"], ctype)
        destination = path.with_suffix(ext)
        path.rename(destination)
        files.append(destination)
    if len(files) == 1:
        ext = files[0].suffix
        target = folder / f"source{ext}" if one_video else folder / f"export{ext}"
        shutil.move(str(files[0]), str(target))
        shutil.rmtree(folder_media, ignore_errors=True)
        return target, f"Instagram_{ident}{ext}", one_video
    target = folder / "export.zip"
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_STORED) as archive:
        for pos, media in enumerate(files, 1):
            archive.write(media, f"Instagram_{ident}_{pos:02d}{media.suffix.lower()}")
    shutil.rmtree(folder_media, ignore_errors=True)
    if target.stat().st_size > max_file_bytes:
        raise InstagramVXError("게시물 ZIP 파일이 서버 용량 제한을 초과했어요.")
    return target, f"Instagram_{ident}_{len(files)}items.zip", False
