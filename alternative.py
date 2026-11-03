"""Opt-in alternate extraction via a documented public Invidious instance.

This is for occasional personal, authorized media exports only. The user's
YouTube video ID is forwarded to an independent third party after opting in.
Never forward cookies, site passwords, or user-supplied unvalidated URLs.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable

INVIDIOUS_HOST = "yt.chocolatemoo53.com"
COMPANION_HOST = "yt-comp2.chocolatemoo53.com"
INVIDIOUS_ORIGIN = "https://" + INVIDIOUS_HOST
# The hard-coded three-minute pilot limit is no longer necessary.
# Long videos may still exceed the file-size, network, or hosting constraints.
ALT_MAX_SECONDS = min(7200, max(60, int(os.getenv("FRAME_MAX_DURATION", "7200"))))
ALT_MAX_MEDIA_BYTES = min(220 * 1024 * 1024,
                          max(20 * 1024 * 1024, int(os.getenv("FRAME_MAX_FILE_BYTES", "367001600")) * 2 // 3))
ALT_AUDIO_BYTES = min(110 * 1024 * 1024, ALT_MAX_MEDIA_BYTES)
MAX_TRANSFER_SECONDS = 20 * 60
REDIRECT_STATUSES = {301, 302, 303, 307, 308}
MAX_REDIRECTS = 3
ALLOWED_HOSTS = frozenset((INVIDIOUS_HOST, COMPANION_HOST))


class AlternativeError(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


OPENER = urllib.request.build_opener(NoRedirect())


def _validate_media_url(url: str) -> str:
    """Allowlist redirects even when the upstream metadata is malicious."""
    parts = urllib.parse.urlsplit(url)
    if (parts.scheme != "https" or parts.hostname not in ALLOWED_HOSTS
            or parts.port not in (None, 443) or parts.username or parts.password):
        raise AlternativeError("외부 미디어 서버가 신뢰할 수 없는 주소를 반환했어요.")
    return url


def _read_info(video_id: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
        raise AlternativeError("영상 주소를 확인해 주세요.")
    url = f"{INVIDIOUS_ORIGIN}/api/v1/videos/{video_id}?local=true"
    request = urllib.request.Request(url, headers={
        "Accept": "application/json", "User-Agent": "FrameStudio/1.0"
    })
    try:
        with OPENER.open(request, timeout=16) as resp:
            if resp.status != 200 or "json" not in resp.headers.get("content-type", "").lower():
                raise AlternativeError("외부 서버에서 영상 정보를 확인할 수 없어요.")
            data_bytes = resp.read(700_001)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        raise AlternativeError("외부 영상 서버가 일시적으로 응답하지 않아요.") from None
    if len(data_bytes) > 700_000:
        raise AlternativeError("외부 영상 서버의 응답이 너무 커요.")
    try:
        info = json.loads(data_bytes)
    except (ValueError, UnicodeDecodeError):
        raise AlternativeError("외부 영상 서버의 응답을 해석할 수 없어요.") from None
    if not isinstance(info, dict) or info.get("videoId") != video_id:
        raise AlternativeError("영상 ID 검증에 실패했어요.")
    if info.get("liveNow") or info.get("isUpcoming") or info.get("paid") or info.get("premium"):
        raise AlternativeError("라이브·유료·제한된 영상은 이 경로에서 지원하지 않아요.")
    duration = int(info.get("lengthSeconds") or 0)
    if not 0 < duration <= ALT_MAX_SECONDS:
        raise AlternativeError(f"현재 서버에서는 최대 {ALT_MAX_SECONDS // 60}분 길이의 영상을 지원해요. 영상 길이가 더 길면 구간을 나누거나 별도 서버가 필요해요.")
    if not isinstance(info.get("adaptiveFormats"), list):
        raise AlternativeError("외부 서버에 영상 추출 정보가 없어요.")
    return info


def _video_height(fmt: dict) -> int:
    match = re.search(r"(\d{3,4})p", str(fmt.get("qualityLabel") or fmt.get("resolution") or ""))
    return int(match.group(1)) if match else 0


def _candidates(info: dict, kind: str) -> list[dict]:
    prefix = "video/" if kind == "video" else "audio/"
    result = []
    for fmt in info.get("adaptiveFormats") or []:
        if not isinstance(fmt, dict) or not str(fmt.get("type", "")).startswith(prefix):
            continue
        raw = fmt.get("url")
        if not isinstance(raw, str) or not raw:
            continue
        try:
            _validate_media_url(urllib.parse.urljoin(INVIDIOUS_ORIGIN, raw))
        except AlternativeError:
            continue
        result.append(fmt)
    return result


def inspect(video_id: str) -> dict:
    info = _read_info(video_id)
    heights = sorted({
        _video_height(fmt) for fmt in _candidates(info, "video")
        if 0 < _video_height(fmt) <= 720
    })
    if not heights or not _candidates(info, "audio"):
        raise AlternativeError("외부 서버에서 추출 가능한 영상·음성 형식을 찾지 못했어요.")
    return {
        "id": video_id,
        "title": str(info.get("title") or "제목 없는 영상")[:250],
        "channel": str(info.get("author") or "채널 정보 없음")[:180],
        "duration": int(info["lengthSeconds"]),
        "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "qualities": heights,
        "max_height": max(heights),
        "provider": "invidious",
        "notice": f"외부 공개 서버에서 영상 정보를 가져왔어요. 일반 영상도 가능하며, 최대 {ALT_MAX_SECONDS // 60}분·720p까지 시도할 수 있어요. 파일 크기와 서버 상태에 따라 실패할 수 있습니다.",
    }


def _choose_sources(info: dict, mode: str, quality: int) -> tuple[dict | None, dict]:
    audio = _candidates(info, "audio")
    if not audio:
        raise AlternativeError("외부 서버에서 오디오 형식을 찾지 못했어요.")
    audio.sort(key=lambda f: (
        str(f.get("type", "")).startswith("audio/mp4"),
        int(f.get("bitrate") or 0)), reverse=True)
    chosen_audio = audio[0]
    if mode == "mp3":
        return None, chosen_audio
    video = [f for f in _candidates(info, "video")
             if 0 < _video_height(f) <= min(quality, 720)]
    if not video:
        raise AlternativeError("선택한 화질에 맞는 영상이 없어요.")
    video.sort(key=lambda f: (
        _video_height(f),
        str(f.get("type", "")).startswith("video/mp4"),
        int(f.get("bitrate") or 0)), reverse=True)
    return video[0], chosen_audio


def _download(url: str, output: Path, maximum: int, update: Callable[[int], None]):
    url = _validate_media_url(urllib.parse.urljoin(INVIDIOUS_ORIGIN, url))
    deadline = time.monotonic() + MAX_TRANSFER_SECONDS
    for hop in range(MAX_REDIRECTS + 1):
        request = urllib.request.Request(url, headers={
            "User-Agent": "FrameStudio/1.0", "Accept": "*/*"
        })
        try:
            response = OPENER.open(request, timeout=22)
        except urllib.error.HTTPError as error:
            if error.code in REDIRECT_STATUSES and error.headers.get("location"):
                if hop == MAX_REDIRECTS:
                    raise AlternativeError("외부 서버의 리다이렉트 횟수가 너무 많아요.") from None
                url = _validate_media_url(urllib.parse.urljoin(url, error.headers["location"]))
                continue
            raise AlternativeError(f"외부 미디어 서버가 파일 요청을 거부했어요 (HTTP {error.code}).") from None
        except (urllib.error.URLError, TimeoutError, OSError):
            raise AlternativeError("외부 미디어 서버 연결에 실패했어요.") from None
        with response:
            if response.status not in (200, 206):
                raise AlternativeError("외부 서버에서 영상 데이터를 받을 수 없어요.")
            content_type = response.headers.get("content-type", "").lower()
            if content_type.startswith(("text/", "application/json")):
                raise AlternativeError("외부 서버가 영상 대신 오류 문서를 반환했어요.")
            size_text = response.headers.get("content-length", "")
            if size_text.isdigit() and int(size_text) > maximum:
                raise AlternativeError("영상 크기가 이 무료 서버의 제한을 초과했어요. 화질을 낮추거나 구간을 줄여주세요.")
            received = 0
            with output.open("wb") as file:
                while True:
                    if time.monotonic() > deadline:
                        raise AlternativeError("외부 서버의 전송 시간 제한을 초과했어요. 더 낮은 화질로 시도해 주세요.")
                    try:
                        chunk = response.read(64 * 1024)
                    except (OSError, TimeoutError):
                        raise AlternativeError("외부 서버의 데이터 전송이 중단됐어요.") from None
                    if not chunk:
                        break
                    received += len(chunk)
                    if received > maximum:
                        raise AlternativeError("영상 파일이 무료 서버의 크기 제한을 초과했어요. 화질을 낮추거나 구간을 줄여주세요.")
                    file.write(chunk)
                    if size_text.isdigit() and int(size_text) > 0:
                        update(min(99, int(100 * received / int(size_text))))
            if not received:
                raise AlternativeError("외부 서버에서 빈 파일을 받았어요.")
        return
    raise AlternativeError("외부 미디어 서버에 연결하지 못했어요.")


def obtain_source(
    video_id: str, mode: str, quality: int, folder: Path,
    update: Callable[[int, str], None],
) -> Path:
    """Download one authorized video, bounded by storage, traffic, and time."""
    info = _read_info(video_id)
    video_format, audio_format = _choose_sources(info, mode, quality)
    audio = folder / ("alt_audio.m4a" if "audio/mp4" in audio_format["type"] else "alt_audio.webm")
    update(5, "외부 서버에서 오디오를 가져오는 중...")
    _download(audio_format["url"], audio, ALT_AUDIO_BYTES,
              lambda percent: update(5 + int(percent * .25), "오디오를 받아오는 중..."))
    if mode == "mp3":
        return audio
    if audio.stat().st_size >= ALT_MAX_MEDIA_BYTES:
        raise AlternativeError("영상과 오디오 파일이 서버 용량 제한을 초과했어요. 음질을 낮춰 주세요.")

    assert video_format is not None
    video = folder / ("alt_video.mp4" if "video/mp4" in video_format["type"] else "alt_video.webm")
    update(32, "외부 서버에서 영상을 가져오는 중...")
    _download(video_format["url"], video, max(1, ALT_MAX_MEDIA_BYTES - audio.stat().st_size),
              lambda percent: update(32 + int(percent * .43), "영상을 받아오는 중..."))
    output = folder / "source.mkv"
    update(76, "영상과 오디오를 합치는 중...")
    try:
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
            "-i", str(video), "-i", str(audio),
            "-map", "0:v:0", "-map", "1:a:0", "-c", "copy",
            "-shortest", str(output),
        ], capture_output=True, text=True, check=True, timeout=600)
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise AlternativeError("영상과 오디오를 결합하지 못했어요.") from None
    if not output.is_file() or not output.stat().st_size:
        raise AlternativeError("결합된 영상 파일이 생성되지 않았어요.")
    # Keep only the merged source during export so longer videos use less disk space.
    audio.unlink(missing_ok=True)
    video.unlink(missing_ok=True)
    return output
