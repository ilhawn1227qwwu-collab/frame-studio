"""FRAME STUDIO — personal web media exporter.

Download only content you have the rights and permission to save.
Deployments intended for remote access require FRAME_PUBLIC_MODE and a password.
"""
from __future__ import annotations

import base64
import json
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from alternative import AlternativeError, inspect as inspect_alternative, obtain_source as obtain_alternative_source

try:
    import yt_dlp
except ImportError:
    yt_dlp = None

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / 'static'
WORKDIR = Path(tempfile.gettempdir()) / 'frame-studio-jobs'
WORKDIR.mkdir(parents=True, exist_ok=True)

PUBLIC_MODE = os.getenv('FRAME_PUBLIC_MODE', '').lower() in ('1', 'true', 'yes')
SITE_PASSWORD = os.getenv('FRAME_SITE_PASSWORD', '')
if PUBLIC_MODE and len(SITE_PASSWORD) < 12:
    raise RuntimeError('Public deployments require FRAME_SITE_PASSWORD of at least 12 characters.')
MAX_DURATION = int(os.getenv('FRAME_MAX_DURATION', str(2 * 60 * 60)))
MAX_FILE_BYTES = int(os.getenv('FRAME_MAX_FILE_BYTES', str(1024 * 1024 * 1024)))
JOB_TTL = 60 * 60
INSPECT_TTL = 10 * 60
MAX_ACTIVE_JOBS = int(os.getenv("FRAME_MAX_ACTIVE_JOBS", "2"))
RESOLUTIONS = (360, 480, 720, 1080)
BITRATES = (128, 192, 320)
ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{11}$')
SAFE_HOSTS = {'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'}

app = FastAPI(title='FRAME STUDIO', docs_url=None, redoc_url=None)
app.mount('/static', StaticFiles(directory=STATIC), name='static')

_lock = threading.RLock()
_slots = threading.BoundedSemaphore(MAX_ACTIVE_JOBS)
_jobs: dict[str, 'Job'] = {}
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_rate: dict[str, list[float]] = {}


@app.middleware('http')
async def access_control(request: Request, call_next):
    # Render/Railway issue HTTPS URLs; password protection is required in public mode.
    if request.url.path != '/api/health' and SITE_PASSWORD:
        header = request.headers.get('authorization', '')
        expected = 'Basic ' + base64.b64encode(('frame:' + SITE_PASSWORD).encode('utf-8')).decode('ascii')
        if not secrets.compare_digest(header, expected):
            return JSONResponse({'detail': '사이트 암호를 입력해 주세요.'}, status_code=401,
                                headers={'WWW-Authenticate': 'Basic realm="FRAME STUDIO", charset="UTF-8"'})
    if PUBLIC_MODE and request.method == 'POST' and request.url.path in ('/api/inspect', '/api/inspect-alt', '/api/jobs'):
        key = request.url.path
        limit, window = (10, 600) if key == '/api/inspect-alt' else (30, 600) if key == '/api/inspect' else (10, 3600)
        now = time.monotonic()
        with _lock:
            recent = [t for t in _rate.get(key, []) if now - t < window]
            if len(recent) >= limit:
                _rate[key] = recent
                return JSONResponse({'detail': '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'}, status_code=429)
            recent.append(now)
            _rate[key] = recent
    return await call_next(request)


class InspectRequest(BaseModel):
    url: str = Field(min_length=1, max_length=1200)


class ExtractRequest(BaseModel):
    url: str = Field(min_length=1, max_length=1200)
    provider: str = 'youtube'
    mode: str = 'mp4'
    quality: int = 720
    start: str = ''
    end: str = ''


@dataclass
class Job:
    id: str
    video_id: str
    created: float = field(default_factory=time.time)
    state: str = 'queued'
    stage: str = 'queued'
    message: str = '작업을 준비하고 있어요.'
    progress: int = 0
    title: str = ''
    error: str | None = None
    output: Path | None = None
    filename: str | None = None
    finished: float | None = None

    def public(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'state': self.state,
            'stage': self.stage,
            'message': self.message,
            'progress': self.progress,
            'filename': self.filename if self.state == 'ready' else None,
            'error': self.error,
        }


def canonical_url(url: str) -> tuple[str, str]:
    """Allow-list link parsing; discard every untrusted query parameter."""
    raw = url.strip()
    try:
        parsed = urlsplit(raw)
        host = (parsed.hostname or '').lower()
        if parsed.scheme not in ('http', 'https') or host not in SAFE_HOSTS:
            raise ValueError
        if parsed.username or parsed.password or parsed.port:
            raise ValueError
        path = parsed.path.strip('/')
        if host in ('youtu.be', 'www.youtu.be'):
            video_id = path
        elif path == 'watch':
            video_id = parse_qs(parsed.query).get('v', [''])[0]
        elif path.startswith(('shorts/', 'live/', 'embed/')):
            parts = path.split('/')
            video_id = parts[1] if len(parts) == 2 else ''
        else:
            video_id = ''
        if not ID_PATTERN.fullmatch(video_id):
            raise ValueError
        return video_id, f'https://www.youtube.com/watch?v={video_id}'
    except (ValueError, TypeError):
        raise HTTPException(400, '유효한 유튜브 영상 링크를 입력해 주세요. 재생목록 주소는 지원하지 않습니다.')


def parse_time(raw: str, *, default: float) -> float:
    raw = (raw or '').strip()
    if not raw:
        return default
    chunks = raw.split(':')
    if len(chunks) > 3 or not all(re.fullmatch(r'\d{1,4}(?:\.\d{1,2})?', x) for x in chunks):
        raise HTTPException(400, '구간 시간은 초 또는 01:30 / 01:02:30 형식으로 입력해 주세요.')
    try:
        result = 0.0
        for chunk in chunks:
            result = result * 60 + float(chunk)
    except ValueError:
        raise HTTPException(400, '시간을 올바르게 입력해 주세요.')
    if not 0 <= result <= MAX_DURATION:
        raise HTTPException(400, '구간 시간이 허용 범위를 벗어났어요.')
    return result


def _runtime_options() -> dict[str, Any]:
    """EJS support: Deno is recommended; Node >= 22 is a fallback."""
    if shutil.which('deno'):
        return {'js_runtimes': {'deno': {}}}
    if shutil.which('node'):
        return {'js_runtimes': {'node': {}}}
    return {}


def _ensure_deps() -> None:
    if yt_dlp is None:
        raise HTTPException(503, 'yt-dlp가 설치되지 않았어요. README의 설치 방법을 확인해 주세요.')
    if not (shutil.which('ffmpeg') and shutil.which('ffprobe')):
        raise HTTPException(503, 'FFmpeg와 ffprobe가 필요해요. README의 설치 방법을 확인해 주세요.')


def _clean() -> None:
    """Expire only completed jobs, never delete an in-progress file."""
    now = time.time()
    with _lock:
        for key, job in list(_jobs.items()):
            if job.finished is not None and now - job.finished > JOB_TTL:
                _jobs.pop(key, None)
                shutil.rmtree(WORKDIR / key, ignore_errors=True)
        for key, (ts, _) in list(_cache.items()):
            if now - ts > INSPECT_TTL:
                _cache.pop(key, None)


def _safe_error(exc: Exception) -> str:
    """Report YouTube bot checks separately from video account restrictions.

    yt-dlp's `Sign in to confirm you're not a bot` error does NOT mean
    the video is private. In particular, cloud/datacenter IPs can receive
    this error for fully public Shorts and ordinary videos.
    """
    message = str(exc).splitlines()[-1][:500]
    lower = message.lower()
    if ('not a bot' in lower or 'captcha' in lower or
            'unusual traffic' in lower or 'automated queries' in lower):
        return ('유튜브가 이 서버의 접속을 봇으로 판단해 차단했습니다. '
                '공개 쇼츠에서도 발생할 수 있으며 링크나 영상의 공개 설정 문제가 아닙니다. '
                '현재 서버에서는 추출할 수 없어요.')
    if 'requested format is not available' in lower:
        return '선택한 화질을 제공하지 않아요. 다른 화질을 선택해 주세요.'
    if 'private video' in lower or 'sign in' in lower or 'login' in lower or 'age-restricted' in lower:
        return '접근 권한이 필요한 영상은 지원하지 않습니다. 공개된 영상인지 확인해 주세요.'
    if 'not available' in lower or 'unavailable' in lower:
        return '이 영상을 불러올 수 없어요. 링크 또는 공개 설정을 확인해 주세요.'
    if 'http error 429' in lower or 'too many requests' in lower:
        return '유튜브의 요청 제한에 도달했습니다. 나중에 다시 시도해 주세요.'
    if 'http error 403' in lower or 'forbidden' in lower:
        return '유튜브가 파일 요청을 거부했습니다. 서버의 접근 제한 또는 인증 문제일 수 있어요.'
    if 'max-filesize' in lower or 'larger than max' in lower:
        return '파일 크기 제한을 초과했어요. 낮은 화질로 시도해 주세요.'
    return '영상 처리에 실패했어요. yt-dlp 업데이트 또는 네트워크 상태를 확인해 주세요.'


def _inspect_video(video_id: str, url: str) -> dict[str, Any]:
    _ensure_deps()
    with _lock:
        hit = _cache.get(video_id)
        if hit and time.time() - hit[0] < INSPECT_TTL:
            return hit[1].copy()
    opts = {
        'quiet': True, 'no_warnings': True, 'noplaylist': True,
        'skip_download': True, 'extract_flat': False,
        'socket_timeout': 20, 'retries': 2,
        **_runtime_options(),
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:
        raise HTTPException(422, _safe_error(exc)) from exc
    if not info or not isinstance(info, dict):
        raise HTTPException(422, '영상 정보를 가져오지 못했어요.')
    if info.get('is_live') or info.get('live_status') in ('is_live', 'is_upcoming'):
        raise HTTPException(422, '실시간 방송과 예정된 방송은 지원하지 않아요.')
    duration = int(info.get('duration') or 0)
    if duration <= 0:
        raise HTTPException(422, '재생 시간을 확인할 수 없는 영상은 지원하지 않아요.')
    if duration > MAX_DURATION:
        raise HTTPException(422, '최대 2시간 길이의 영상만 지원해요.')
    heights = [int(f.get('height')) for f in (info.get('formats') or []) if isinstance(f.get('height'), (int, float)) and f.get('vcodec') != 'none']
    max_height = max(heights, default=360)
    qualities = [n for n in (240, *RESOLUTIONS) if n in heights and n <= 1080]
    if not qualities:
        qualities = [min(max_height, 1080)]
    data = {
        'id': video_id,
        'title': str(info.get('title') or '제목 없는 영상')[:250],
        'channel': str(info.get('channel') or info.get('uploader') or '채널 정보 없음')[:180],
        'duration': duration,
        'thumbnail': f'https://i.ytimg.com/vi/{video_id}/hqdefault.jpg',
        'qualities': qualities,
        'max_height': max_height,
    }
    with _lock:
        _cache[video_id] = (time.time(), data)
    return data.copy()


def _update(job: Job, **kwargs: Any) -> None:
    with _lock:
        for key, value in kwargs.items():
            setattr(job, key, value)


def _safe_filename(title: str, extension: str) -> str:
    clean = re.sub(r'[<>:"/\\|?*\x00-\x1f]', ' ', title)
    clean = re.sub(r'\s+', ' ', clean).strip(' .')[:90].strip(' .')
    if not clean or clean.split('.')[0].upper() in {'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'}:
        clean = 'youtube-video'
    return f'{clean}.{extension}'


def _media_codecs(path: Path) -> tuple[str, str]:
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,codec_type',
            '-of', 'json', str(path),
        ], capture_output=True, text=True, timeout=20, check=True)
        streams = json.loads(result.stdout).get('streams', [])
        video = next((x['codec_name'] for x in streams if x.get('codec_type') == 'video'), '')
        audio = next((x['codec_name'] for x in streams if x.get('codec_type') == 'audio'), '')
        return video, audio
    except Exception:
        return '', ''


def _encode(job: Job, source: Path, output: Path, *, mode: str,
            start: float, end: float, duration: float, bitrate: int) -> None:
    length = end - start
    command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y']
    clipped = start > 0 or end < duration - .1
    if clipped:
        # Accurate input seek: avoid keyframe-only approximation.
        command += ['-i', str(source), '-ss', f'{start:.3f}', '-t', f'{length:.3f}']
    else:
        command += ['-i', str(source)]

    if mode == 'mp3':
        command += ['-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', f'{bitrate}k']
    elif mode in ('m4a', 'opus'):
        _, acodec = _media_codecs(source)
        required = 'aac' if mode == 'm4a' else 'opus'
        if acodec != required:
            raise RuntimeError('요청한 원본 오디오 코덱을 찾지 못했어요.')
        # Remux, do not convert the lossy YouTube stream a second time.
        command += ['-map', '0:a:0', '-vn', '-c:a', 'copy']
    else:
        vcodec, acodec = _media_codecs(source)
        command += ['-map', '0:v:0', '-map', '0:a:0']
        if not clipped and vcodec in ('h264', 'hevc'):
            # Full-duration MP4 preserves the existing video bitstream.
            command += ['-c:v', 'copy']
        else:
            # Accurate cuts/non-mobile codecs require video re-encoding.
            # CRF 18 reduces generation loss compared with the old CRF 23.
            command += ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                        '-pix_fmt', 'yuv420p']
        if acodec == 'aac':
            command += ['-c:a', 'copy']
        else:
            command += ['-c:a', 'aac', '-b:a', '192k']
        if vcodec == 'hevc' and not clipped:
            command += ['-tag:v', 'hvc1']
        command += ['-movflags', '+faststart']

    command += ['-progress', 'pipe:1', '-nostats', str(output)]
    with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          universal_newlines=True, bufsize=1) as process:
        lines: list[str] = []
        assert process.stdout is not None
        for line in process.stdout:
            line = line.strip()
            if line.startswith('out_time='):
                value = line.split('=', 1)[1]
                try:
                    h, m, s = value.split(':')
                    elapsed = int(h) * 3600 + int(m) * 60 + float(s)
                    ratio = max(0, min(1, elapsed / max(length, 1)))
                    _update(job, progress=max(job.progress, int(80 + ratio * 18)))
                except (ValueError, TypeError):
                    pass
            elif line and not line.startswith(('progress=', 'frame=', 'fps=', 'stream_', 'bitrate=', 'total_size=', 'out_time_', 'dup_frames=', 'drop_frames=', 'speed=')):
                lines.append(line)
                lines = lines[-10:]
        exitcode = process.wait()
        if exitcode != 0:
            raise RuntimeError('FFmpeg 변환 실패: ' + ' | '.join(lines)[-240:])
    if not output.exists() or output.stat().st_size == 0:
        raise RuntimeError('결과 파일이 비어 있어요.')
    if output.stat().st_size > MAX_FILE_BYTES:
        raise RuntimeError('최종 파일이 크기 제한을 초과했어요.')


def _process(job: Job, url: str, mode: str, quality: int, start: float,
             end: float, duration: float, provider: str = 'youtube') -> None:
    folder = WORKDIR / job.id
    try:
        folder.mkdir(parents=True, exist_ok=False)
        _update(job, state='running', stage='downloading', message='원본 파일을 가져오는 중...', progress=2)
        if provider == 'invidious':
            source = obtain_alternative_source(
                job.video_id, mode, quality, folder,
                lambda progress, message: _update(job, progress=progress, message=message))
        else:
            def progress_hook(data: dict[str, Any]) -> None:
                if data.get('status') == 'downloading':
                    total = data.get('total_bytes') or data.get('total_bytes_estimate') or 0
                    got = data.get('downloaded_bytes') or 0
                    if total:
                        percentage = min(77, max(3, int(3 + 74 * got / total)))
                        _update(job, progress=max(job.progress, percentage), message='영상을 다운로드하는 중...')
                elif data.get('status') == 'finished':
                    _update(job, progress=max(job.progress, 78), message='다운로드 완료. 파일을 준비하는 중...')

            opts: dict[str, Any] = {
                'format': ('bestaudio/best' if mode == 'mp3' else
                           f'bv*[height<={quality}]+ba/b[height<={quality}]'),
                'outtmpl': str(folder / 'source.%(ext)s'),
                'merge_output_format': 'mkv',
                'quiet': True, 'no_warnings': True, 'noplaylist': True,
                'max_filesize': MAX_FILE_BYTES, 'socket_timeout': 25,
                'retries': 3, 'fragment_retries': 3,
                'progress_hooks': [progress_hook],
                **_runtime_options(),
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])

            sources = [p for p in folder.iterdir() if p.is_file() and
                       p.name.startswith('source.') and not p.suffix.endswith('part')]
            if not sources:
                raise RuntimeError('원본 파일이 생성되지 않았어요.')
            source = max(sources, key=lambda p: p.stat().st_size)

        if source.stat().st_size > MAX_FILE_BYTES:
            raise RuntimeError('파일 크기 제한을 초과했어요.')
        _update(job, stage='converting', message=('MP3를 변환하는 중...' if mode == 'mp3'
                                                  else '원본 음성을 저장하는 중...' if mode in ('m4a', 'opus')
                                                  else 'MP4 파일을 완성하는 중...'), progress=80)
        output = folder / f'export.{mode}'
        _encode(job, source, output, mode=mode, start=start, end=end,
                duration=duration, bitrate=quality if mode == 'mp3' else 192)
        for path in folder.iterdir():
            if path != output and path.is_file():
                path.unlink(missing_ok=True)
        with _lock:
            job.output = output
            job.filename = _safe_filename(job.title, mode)
            job.state = 'ready'
            job.stage = 'ready'
            job.message = '준비가 끝났어요. 파일을 저장할 수 있어요.'
            job.progress = 100
            job.finished = time.time()
    except AlternativeError as exc:
        _update(job, state='error', stage='error', error=str(exc),
                message='외부 서버 처리에 실패했어요.', finished=time.time())
        shutil.rmtree(folder, ignore_errors=True)
    except Exception as exc:
        _update(job, state='error', stage='error', error=_safe_error(exc),
                message='처리에 실패했어요.', finished=time.time())
        shutil.rmtree(folder, ignore_errors=True)
    finally:
        _slots.release()


@app.get('/')
def home() -> FileResponse:
    return FileResponse(STATIC / 'index.html')


@app.get('/api/health')
def health() -> dict[str, Any]:
    return {
        'ok': bool(yt_dlp is not None and shutil.which('ffmpeg') and shutil.which('ffprobe')),
        'yt_dlp': yt_dlp is not None,
        'ffmpeg': bool(shutil.which('ffmpeg') and shutil.which('ffprobe')),
        'js_runtime': ('deno' if shutil.which('deno') else 'node' if shutil.which('node') else None),
        'max_duration': MAX_DURATION,
        'public_mode': PUBLIC_MODE,
    }


@app.post('/api/inspect')
def inspect(payload: InspectRequest) -> dict[str, Any]:
    _clean()
    video_id, url = canonical_url(payload.url)
    return _inspect_video(video_id, url)


@app.post('/api/inspect-alt')
def inspect_alt(payload: InspectRequest) -> dict[str, Any]:
    """Opt-in alternative. The video ID is sent to a public Invidious instance."""
    _clean()
    video_id, _ = canonical_url(payload.url)
    try:
        return inspect_alternative(video_id)
    except AlternativeError as exc:
        raise HTTPException(422, str(exc)) from None


@app.post('/api/jobs', status_code=202)
def create_job(payload: ExtractRequest) -> dict[str, Any]:
    _clean()
    video_id, url = canonical_url(payload.url)
    if payload.mode not in ('mp4', 'mp3', 'm4a', 'opus'):
        raise HTTPException(400, '지원하지 않는 파일 형식이에요.')
    if payload.provider not in ('youtube', 'invidious'):
        raise HTTPException(400, '지원하지 않는 추출 방식이에요.')
    if payload.provider == 'invidious':
        try:
            info = inspect_alternative(video_id)
        except AlternativeError as exc:
            raise HTTPException(422, str(exc)) from None
    else:
        info = _inspect_video(video_id, url)
    if payload.mode in ('m4a', 'opus') and (payload.provider != 'invidious' or
                                             payload.mode not in info.get('audio_modes', [])):
        raise HTTPException(400, '이 영상에서는 해당 원본 오디오 형식을 제공하지 않아요.')
    if payload.mode == 'mp4' and payload.quality not in info['qualities']:
        raise HTTPException(400, '선택한 화질을 이 영상에서 사용할 수 없어요.')
    if payload.mode == 'mp3' and payload.quality not in BITRATES:
        raise HTTPException(400, '지원하지 않는 오디오 품질이에요.')
    start = parse_time(payload.start, default=0.0)
    end = parse_time(payload.end, default=float(info['duration']))
    if start >= end or end > info['duration'] + 1:
        raise HTTPException(400, '시작 시간은 종료 시간보다 빨라야 하며 영상 길이를 넘을 수 없어요.')
    _ensure_deps()
    if not _slots.acquire(blocking=False):
        raise HTTPException(429, '현재 다른 작업을 처리 중이에요. 완료 후 다시 시도해 주세요.')
    job = Job(id=uuid.uuid4().hex, video_id=video_id, title=info['title'])
    with _lock:
        _jobs[job.id] = job
    try:
        threading.Thread(target=_process, args=(job, url, payload.mode, payload.quality,
                    start, end, float(info['duration']), payload.provider), daemon=True).start()
    except Exception:
        _slots.release()
        with _lock:
            _jobs.pop(job.id, None)
        raise HTTPException(500, '작업을 시작할 수 없어요.')
    return {'id': job.id}


@app.get('/api/jobs/{job_id}')
def job_status(job_id: str) -> dict[str, Any]:
    _clean()
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(404, '작업을 찾을 수 없거나 보관 시간이 지났어요.')
        return job.public()


@app.get('/api/jobs/{job_id}/file')
def job_file(job_id: str) -> FileResponse:
    _clean()
    with _lock:
        job = _jobs.get(job_id)
        if not job or job.state != 'ready' or not job.output or not job.output.is_file():
            raise HTTPException(404, '다운로드할 파일이 없어요.')
        output, filename = job.output, job.filename
    return FileResponse(output, media_type='application/octet-stream', filename=filename)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0' if PUBLIC_MODE else '127.0.0.1',
                port=int(os.environ.get('PORT', '8000')))
