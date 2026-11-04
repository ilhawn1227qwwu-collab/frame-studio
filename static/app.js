'use strict';
const $ = (id) => document.getElementById(id);
const state = { info: null, url: '', mode: 'mp4', quality: 720, jobId: null, pollTimer: null };
const elements = {
  form: $('inspectForm'), url: $('urlInput'), inspect: $('inspectBtn'), inspectLabel: $('inspectLabel'),
  error: $('errorBox'), video: $('videoSection'), options: $('optionsSection'),
  progress: $('progressSection'), qualities: $('qualityChoices'), export: $('exportBtn'),
};
const show = (element) => element.classList.remove('hidden');
const hide = (element) => element.classList.add('hidden');
const pad = (num) => String(num).padStart(2, '0');
function timeLabel(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function detectPlatform(raw) {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be'].includes(host)) return 'youtube';
    if (['tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(host)) return 'tiktok';
    if (['instagram.com','www.instagram.com','m.instagram.com','instagr.am','www.instagr.am'].includes(host)) return 'instagram';
  } catch (_) { /* invalid URL */ }
  return '';
}
function isServerBotBlock(message) {
  return /유튜브가 이 서버의 접속|봇으로 판단|서버의 접근 제한/.test(message || '');
}
function showError(message) {
  elements.error.textContent = message;
  show(elements.error);
  if (state.url && isServerBotBlock(message)) show($('fallbackSection'));
}
function clearError() {
  hide(elements.error); elements.error.textContent = '';
  hide($('fallbackSection')); hide($('fallbackJobBtn'));
  hide($('socialFallbackSection'));
}
function showSocialFallback(platform) {
  const isInstagram = platform === 'instagram';
  $('socialFallbackTitle').textContent = isInstagram ? '인스타그램 서버가 로그인 검사를 요구하고 있어요'
    : '틱톡이 현재 처리 서버의 접속을 거부하고 있어요';
  $('socialFallbackNote').textContent = isInstagram
    ? '외부 IGDL 웹사이트에서 공개 게시물의 사진·영상을 시도할 수 있어요. 클릭하면 게시물 링크가 해당 사이트로 전달됩니다.'
    : 'TikWM 처리 서버로 시도하면 이 영상의 주소를 외부 서비스에 전송하고, 파일은 FRAME STUDIO에서 저장할 수 있어요. 별도 브라우저 서비스도 선택할 수 있습니다.';
  $('socialExternalBtn').textContent = isInstagram ? 'IGDL에서 사진·영상 열기 ↗' : 'TikWM 웹사이트 열기 ↗';
  $('socialTikwmBtn').classList.toggle('hidden', isInstagram);
  show($('socialFallbackSection'));
}
$('socialTikwmBtn').addEventListener('click', async () => {
  const url = elements.url.value.trim();
  if (detectPlatform(url) !== 'tiktok') return showError('틱톡 공개 영상 링크를 입력해 주세요.');
  state.url = url;
  const button = $('socialTikwmBtn');
  setLoading(button, true);
  clearError();
  try {
    const info = await request('/api/inspect-tikwm', { url });
    displayVideo(info);
    elements.video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showError(error.message);
    showSocialFallback('tiktok');
  } finally {
    setLoading(button, false);
  }
});
$('socialExternalBtn').addEventListener('click', () => {
  const url = state.url || elements.url.value.trim();
  const platform = detectPlatform(url);
  if (platform === 'instagram') {
    try {
      const path = new URL(url).pathname;
      if (!/^\/(p|reel|reels|tv)\/[A-Za-z0-9_-]{5,40}\/?$/.test(path)) throw Error('invalid path');
      window.open('https://igdl.app' + path, '_blank', 'noopener,noreferrer');
    } catch (_) { showError('인스타그램 게시물 링크를 다시 확인해 주세요.'); }
  } else if (platform === 'tiktok') {
    // No TikTok URL is forwarded until user pastes it into the external site.
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => {});
    window.open('https://tikwm.com/', '_blank', 'noopener,noreferrer');
  }
});
async function loadAlternativeVideo() {
  const url = elements.url.value.trim();
  if (!url || detectPlatform(url) !== 'youtube') return showError('이 보조 서버는 유튜브 링크에서만 사용할 수 있어요.');
  state.url = url;
  const buttons = [$('alternateBtn'), $('directAltBtn')];
  buttons.forEach(button => setLoading(button, true));
  $('alternateBtn').textContent = '외부 서버 확인 중...';
  $('directAltBtn').textContent = '외부 서버 확인 중...';
  clearError();
  try {
    const info = await request('/api/inspect-alt', { url: state.url });
    displayVideo(info);
    elements.video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showError(error.message);
    show($('fallbackSection')); // Third-party fallback can be attempted separately.
  } finally {
    buttons.forEach(button => setLoading(button, false));
    $('alternateBtn').textContent = '외부 서버로 불러오기';
    $('directAltBtn').textContent = '외부 서버로 바로 불러오기';
  }
}
$('alternateBtn').addEventListener('click', loadAlternativeVideo);
$('directAltBtn').addEventListener('click', loadAlternativeVideo);

function openExternalFallback() {
  // Opt-in browser navigation: only the YouTube URL, never our site password.
  const original = (state.url || elements.url.value).trim();
  try {
    const u = new URL(original);
    const allowed = ['youtube.com','www.youtube.com','m.youtube.com',
      'music.youtube.com','youtu.be','www.youtu.be'];
    if (!allowed.includes(u.hostname) || !['http:','https:'].includes(u.protocol)) {
      return showError('유효한 유튜브 영상 주소를 입력해 주세요.');
    }
    const link = 'https://cobalt.tools/#' + encodeURIComponent(original);
    window.open(link, '_blank', 'noopener,noreferrer');
  } catch (_) {
    showError('유효한 유튜브 영상 주소를 입력해 주세요.');
  }
}
$('fallbackBtn').addEventListener('click', openExternalFallback);
$('fallbackJobBtn').addEventListener('click', openExternalFallback);
async function request(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.detail) ? '입력 항목을 확인해 주세요.' : body.detail;
    throw new Error(detail || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return body;
}
function setLoading(button, isLoading) { button.disabled = isLoading; button.classList.toggle('loading', isLoading); }
function paintFormats() {
  const photo = state.info.content_type === 'photo';
  const sourceFormats = photo ? ['photos'] : ['mp4', 'mp3', ...(state.info.audio_modes || [])];
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const mode = button.dataset.mode;
    const available = sourceFormats.includes(mode);
    button.classList.toggle('hidden', !available);
    button.disabled = !available;
    const selected = available && mode === state.mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const video = state.mode === 'mp4';
  const originalAudio = ['m4a', 'opus'].includes(state.mode);
  $('qualityHead').classList.toggle('hidden', photo);
  elements.qualities.classList.toggle('hidden', photo);
  $('trimBox').classList.toggle('hidden', photo);
  const title = video ? '영상 화질 ' : originalAudio ? '원본 음성 품질 ' : photo ? '사진 원본 ' : 'MP3 출력 비트레이트 ';
  const caption = video ? 'RESOLUTION' : originalAudio ? 'SOURCE QUALITY' : photo ? 'PHOTOS' : 'OUTPUT BITRATE';
  $('qualityTitle').replaceChildren(document.createTextNode(title));
  const badge = document.createElement('span');
  badge.textContent = caption;
  $('qualityTitle').append(badge);
  $('qualityNote').textContent = video ? '원본에서 제공하는 화질만 선택할 수 있어요'
    : originalAudio ? '원본 음성을 재압축하지 않고 보존해요'
    : photo ? '사진 원본을 저장해요'
    : '출력 비트레이트를 높여도 원본 음질을 초과하지 않아요';
  const choices = video ? state.info.qualities : originalAudio || photo ? [0] : [128, 192, 320];
  elements.qualities.classList.toggle('original-quality', originalAudio || photo);
  state.quality = video ? Math.max(...choices) : originalAudio || photo ? 0 : 320;
  elements.qualities.replaceChildren();
  for (const quality of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quality-button';
    btn.textContent = video ? (quality === 0 ? '최고 원본' : quality + 'p') : photo ? '사진 원본' : originalAudio ? '원본 그대로 저장' : quality + 'k';
    btn.dataset.value = String(quality);
    btn.addEventListener('click', () => { state.quality = quality; paintSelectedQuality(); });
    elements.qualities.append(btn);
  }
  $('exportBtn').querySelector('span').textContent = photo ? '사진 저장 준비하기' : '파일 추출하기';
  paintSelectedQuality();
}
function paintSelectedQuality() {
  elements.qualities.querySelectorAll('button').forEach((button) => {
    const selected = Number(button.dataset.value) === state.quality;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function displayVideo(info) {
  state.info = info;
  const photo = info.content_type === 'photo';
  const site = info.site || info.provider || 'youtube';
  $('contentTypeLabel').textContent = String(site).replace('_photo','').toUpperCase() + ' / ' + (photo ? 'PHOTOS' : 'VIDEO');
  $('videoThumb').classList.toggle('hidden', photo || !info.thumbnail);
  $('photoPreview').classList.toggle('hidden', !photo);
  if (!photo && info.thumbnail) $('videoThumb').src = info.thumbnail;
  if (photo) $('photoPreview').textContent = (info.photo_count || 1) + ' PHOTOS · INSTAGRAM';
  $('videoTitle').textContent = info.title;
  const notice = $('altNotice');
  if (info.provider === 'invidious' || info.note) {
    notice.textContent = info.notice || info.note || '외부 서버에서 영상 정보를 가져왔어요.';
    show(notice);
  } else hide(notice);
  $('videoChannel').textContent = info.channel || '';
  $('videoId').textContent = info.id;
  $('videoDuration').textContent = photo ? (info.photo_count || 1) + ' PHOTOS' : timeLabel(info.duration);
  $('endInput').value = photo ? '' : timeLabel(info.duration);
  $('startInput').value = '00:00';
  $('trimSwitch').checked = false;
  hide($('trimFields'));
  $('rightsCheck').checked = false;
  state.mode = photo ? 'photos' : 'mp4';
  paintFormats();
  show(elements.video); show(elements.options); hide(elements.progress);
}
elements.form.addEventListener('submit', async (event) => {
  event.preventDefault(); clearError();
  const url = elements.url.value.trim();
  if (!url) return showError('영상 주소를 입력해 주세요.');
  if (state.pollTimer) clearTimeout(state.pollTimer);
  state.url = url; state.info = null;
  hide(elements.video); hide(elements.options); hide(elements.progress);
  hide($('fallbackSection'));
  setLoading(elements.inspect, true);
  elements.inspectLabel.textContent = '영상 확인 중...';
  try {
    const platform = detectPlatform(url);
    if (!platform) throw new Error('유튜브, 틱톡 영상 또는 인스타그램 게시물 주소를 입력해 주세요.');
    const endpoint = platform === 'youtube' ? '/api/inspect' : '/api/inspect-social';
    const info = await request(endpoint, { url });
    displayVideo(info);
  } catch (error) { showError(error.message); const p = detectPlatform(url); if (p === 'tiktok' || p === 'instagram') showSocialFallback(p); }
  finally { setLoading(elements.inspect, false); elements.inspectLabel.textContent = '영상 불러오기'; }
});
$('pasteBtn').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    elements.url.value = text.trim(); elements.url.focus();
  } catch (_) { elements.url.focus(); showError('클립보드 접근이 차단됐어요. 주소를 직접 붙여 넣어주세요.'); }
});
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
  if (!state.info) return;
  state.mode = button.dataset.mode;
  paintFormats();
}));
$('trimSwitch').addEventListener('change', (event) => {
  if (event.target.checked) show($('trimFields'));
  else hide($('trimFields'));
});
function timeSeconds(value) {
  if (!/^\d{1,4}(?:\.\d{1,2})?(?::\d{1,4}(?:\.\d{1,2})?){0,2}$/.test(value.trim())) return NaN;
  return value.trim().split(':').reduce((value, part) => value * 60 + Number(part), 0);
}
function progressUpdate(data) {
  const pct = Math.min(100, Math.max(0, Number(data.progress) || 0));
  $('progressBar').style.width = `${pct}%`;
  $('progressNumber').textContent = `${pct}%`;
  $('progressMessage').textContent = data.error || data.message || '';
}
async function pollJob(jobId) {
  if (state.jobId !== jobId) return;
  try {
    const response = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('작업 상태를 확인하지 못했어요.');
    const data = await response.json();
    progressUpdate(data);
    if (data.state === 'ready') {
      const link = $('downloadLink');
      link.href = `/api/jobs/${jobId}/file`;
      show(link);
      hide($('retryBtn'));
      setLoading(elements.export, false);
      elements.export.querySelector('span').textContent = '새로 추출하기';
      return;
    }
    if (data.state === 'error') {
      show($('retryBtn'));
      if (state.info?.site === 'instagram' || state.info?.site === 'tiktok') showSocialFallback(state.info.site);
      if (isServerBotBlock(data.error) || state.info?.provider === 'invidious') show($('fallbackJobBtn'));
      else hide($('fallbackJobBtn'));
      setLoading(elements.export, false);
      return;
    }
    state.pollTimer = setTimeout(() => pollJob(jobId), 900);
  } catch (error) {
    $('progressMessage').textContent = `${error.message} 다시 확인 중...`;
    state.pollTimer = setTimeout(() => pollJob(jobId), 2300);
  }
}
elements.export.addEventListener('click', async () => {
  if (!state.info) return;
  clearError();
  if (!$('rightsCheck').checked) { showError('추출 권한 확인 항목에 체크해 주세요.'); return; }
  const trimmed = $('trimSwitch').checked;
  const start = trimmed ? $('startInput').value.trim() : '';
  const end = trimmed ? $('endInput').value.trim() : '';
  if (trimmed) {
    const from = timeSeconds(start), to = timeSeconds(end);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to > state.info.duration + 1) {
      showError('시작·종료 시간을 확인해 주세요. 영상 길이를 벗어나거나 순서가 잘못됐어요.'); return;
    }
  }
  setLoading(elements.export, true);
  hide($('downloadLink')); hide($('retryBtn'));
  try {
    const data = await request('/api/jobs', {
      url: state.url,
      provider: state.info.provider || 'youtube',
      mode: state.mode,
      quality: state.quality,
      start, end,
    });
    state.jobId = data.id;
    show(elements.progress);
    progressUpdate({ progress: 0, message: '처리 작업이 시작됐어요.' });
    elements.progress.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    pollJob(data.id);
  } catch (error) { showError(error.message); setLoading(elements.export, false); }
});
$('retryBtn').addEventListener('click', () => elements.export.click());
async function checkRuntime() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    if (data.max_duration) {
      const label = document.querySelector('.limit-mark');
      label.textContent = `MAX ${Math.floor(data.max_duration / 60)} MIN`;
    }
    if (!data.ok) showError('서버 준비가 완료되지 않았어요. Python 패키지와 FFmpeg 설치 여부를 README에서 확인해 주세요.');
    else if (!data.js_runtime) showError('JavaScript 실행 환경(Deno 권장)이 감지되지 않았어요. 일부 유튜브 영상 추출이 실패할 수 있어요.');
  } catch (_) { /* backend unavailable; requests will show a precise error */ }
}
checkRuntime();
