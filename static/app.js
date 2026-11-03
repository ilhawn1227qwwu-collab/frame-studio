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
}
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
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const selected = button.dataset.mode === state.mode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('qualityTitle').textContent = '';
  const title = document.createTextNode(state.mode === 'mp4' ? '영상 화질 ' : '오디오 비트레이트 ');
  const caption = document.createElement('span');
  caption.textContent = state.mode === 'mp4' ? 'RESOLUTION' : 'BITRATE';
  $('qualityTitle').append(title, caption);
  $('qualityNote').textContent = state.mode === 'mp4' ? '가능한 화질만 표시됩니다' : '원본보다 음질이 좋아지지는 않아요';
  const choices = state.mode === 'mp4' ? state.info.qualities : [128, 192, 320];
  state.quality = state.mode === 'mp4' ? (choices.includes(720) ? 720 : choices[choices.length - 1]) : 192;
  elements.qualities.replaceChildren();
  for (const quality of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quality-button';
    const mark = state.mode === 'mp4' ? `${quality}p` : `${quality}k`;
    btn.textContent = mark;
    btn.dataset.value = String(quality);
    btn.addEventListener('click', () => { state.quality = quality; paintSelectedQuality(); });
    elements.qualities.append(btn);
  }
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
  $('videoThumb').src = info.thumbnail;
  $('videoTitle').textContent = info.title;
  $('videoChannel').textContent = info.channel;
  $('videoId').textContent = info.id;
  $('videoDuration').textContent = timeLabel(info.duration);
  $('endInput').value = timeLabel(info.duration);
  $('startInput').value = '00:00';
  $('trimSwitch').checked = false;
  hide($('trimFields'));
  $('rightsCheck').checked = false;
  state.mode = 'mp4';
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
  setLoading(elements.inspect, true);
  elements.inspectLabel.textContent = '영상 확인 중...';
  try {
    const info = await request('/api/inspect', { url });
    displayVideo(info);
  } catch (error) { showError(error.message); }
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
      if (isServerBotBlock(data.error)) show($('fallbackJobBtn'));
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
