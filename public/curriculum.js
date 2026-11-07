
/* Kali SIM LAB Learning Center — contained, deterministic training scenarios.
 * Educational UI and a browser-only command interpreter. NO OS, sockets, or external targets. */
(()=>{'use strict';
const $=id=>document.getElementById(id), STORE='kali-sim-curriculum-v1';
const trackOrder=['linux','network','wireless','web','forensics','incident','sandbox'];
const tracks={
 incident:{title:'종합 임무 · INCIDENT-001',glyph:'⚑',desc:'가상 사내 네트워크에서 서버 장애와 인증 실패 기록을 조사하고 서비스를 복구하며 보안 조치 보고서를 작성하세요.',steps:[['게이트웨이 확인'],['웹 장애 확인'],['인증 로그 조사'],['서비스 복구'],['Firefox로 확인'],['웹 보안 진단'],['취약 설정 개선'],['최종 보고']]},
 sandbox:{title:'자유 실습 · Virtual LAN',glyph:'∞',desc:'명령 순서를 지정하지 않고 동일한 가상 공유기·웹 서버·로그를 자유롭게 관찰하고 조작할 수 있어요.',steps:[['가상 실습 자유 탐색']]},
 linux:{title:'리눅스 기초',glyph:'⌘',desc:'디렉터리와 파일을 직접 조작하면서 기본 터미널 명령을 익혀요.',steps:[
 ['현재 위치 확인','지금 내가 어디 있는지 알아야 파일을 찾을 수 있겠죠? 현재 작업 경로를 출력해 봅시다.','pwd','경로 앞의 /는 파일 시스템의 시작을 뜻해요.'],
 ['폴더 내용 살펴보기','파일을 찾으려면 현재 폴더에 무엇이 있는지 먼저 살펴봐야겠죠?','ls','ls는 list의 줄임말이에요.'],
 ['새 연습 폴더 만들기','파일을 아무 데나 만들면 헷갈리겠죠? 공부 자료를 모을 디렉터리를 만들어요.','mkdir training','실제 리눅스의 mkdir는 폴더를 만드는 명령이에요.'],
 ['폴더로 이동하기','방금 만든 연습 폴더 안으로 들어가 봅시다.','cd training','cd는 change directory의 줄임말이에요.'],
 ['메모 파일 만들기','폴더를 만들었으니 빈 메모 파일 하나를 준비해 볼게요.','touch notes.txt','여기서는 실제 디스크가 아닌 브라우저의 가상 파일 시스템에 저장돼요.'],
 ['결과 점검하기','정말 파일이 만들어졌을까요? 긴 목록 형식으로 확인해 봅시다.','ls -l','파일 이름과 권한 표시 방식을 함께 살펴보세요.']
 ]},
 network:{title:'네트워크 기초',glyph:'◉',desc:'네트워크 인터페이스·라우팅·게이트웨이·DNS의 차이를 익히고 상태 변화를 관찰해요.',steps:[
 ['인터페이스 확인','네트워크로 통신하려면 먼저 어떤 장치가 있는지 확인해야겠죠?','ip a','여기서는 가상의 wlan0와 loopback만 보여줘요.'],
 ['경로 확인','내 컴퓨터에서 다른 네트워크로 나갈 때는 어디로 전달할까요? 라우팅 표를 확인해요.','ip route','기본 게이트웨이는 출구 역할을 해요.'],
 ['게이트웨이 통신 검사','가상 공유기까지 닿을까요? 네트워크 전원을 켠 상태에서 확인해 봅시다.','ping 192.0.2.1','192.0.2.0/24는 문서·실습용으로 예약된 주소 범위예요.'],
 ['이름을 주소로 바꾸기','숫자 IP 대신 도메인 이름을 쓰려면 DNS가 필요해요. 이름 조회를 해봅시다.','nslookup training.lab','DNS는 도메인 이름을 IP 주소로 찾는 역할을 해요.'],
 ['웹 서비스 응답 확인','네트워크가 살아 있다면 서버는 어떤 응답 헤더를 줄까요?','curl -I http://training.lab','이 사이트에서는 실제 HTTP 요청 대신 준비된 가상 응답만 반환해요.']
 ]},
 wireless:{title:'Wi-Fi 보안 실습',glyph:'⌁',desc:'상태가 바뀌는 허가된 가상 공유기에서 관찰·교육용 암호 점검·방어까지 연습해요.',steps:[]},
 web:{title:'웹 보안',glyph:'▣',desc:'HTTP 응답 검사부터 가상 SSH 원격 접속, 권한 확인, 서버 보안 설정 개선까지 연습해요.',steps:[
 ['웹사이트 살펴보기','가상 웹페이지가 어떤 응답을 보내는지 먼저 확인해 봅시다.','curl http://demo.lab','Kali PC에서 교육용 도메인의 응답을 확인해요.'],
 ['보안 헤더 확인','서버에서 Content-Security-Policy 등의 설정이 전달될까요?','curl -I http://demo.lab','응답 헤더를 살펴보세요.'],
 ['보안 문제 진단','서버 설정 중 부족한 부분을 알아봅시다.','web-audit demo.lab','현재 서버에 도달할 수 있어야 진단이 가능해요.'],
 ['SSH 원격 로그인','이제 서버의 설정을 고치려면 서버에 직접 접속해야겠죠?','ssh trainee@192.0.2.20','교육용 SSH 키가 이미 등록되어 있는 모형입니다. 실제 로그인은 하지 않아요.'],
 ['보안 헤더 적용','웹 서버에 접속했으니 첫 번째 문제부터 개선해 봅시다.','web-fix headers','실제 서비스에서는 설정 적용과 검증에 더 세심한 절차가 필요해요.'],
 ['접근 통제 강화','관리자 자료에 일반 사용자가 접근하지 못하게 해봐요.','web-fix access','접근 통제는 누구에게 어떤 권한을 줄지 결정하는 과정이에요.'],
 ['출력 안전하게 처리','사용자 입력이 코드처럼 실행되지 않고 문자로 보이게 고쳐요.','web-fix output','출력 문맥에 맞는 인코딩과 검증이 중요해요.'],
 ['원격 서버에서 나오기','설정을 다 바꿨으면 exit로 Kali PC로 돌아갑시다.','exit','현재 실행 위치가 Kali인지 web01인지 확인해 보세요.'],
 ['최종 보안 검증','다시 Kali에서 점검 도구를 실행해 설정이 개선됐는지 확인해 봅시다.','web-verify demo.lab','이 명령은 외부 서버가 아니라 가상 보안 설정만 검사합니다.']
 ]},
 forensics:{title:'로그·디지털 포렌식',glyph:'▤',desc:'원격 서버에 접속해 인증 로그를 조사하고 Kali로 돌아와 증거 무결성을 확인해요.',steps:[
 ['가상 웹 서버 SSH 접속','로그가 웹 서버에 있다면 먼저 원격 시스템에 접속해야겠죠?','ssh trainee@192.0.2.20','등록된 교육용 키를 사용하는 SSH 모의 연결이에요.'],
 ['원격 로그 폴더 확인','어디에 기록이 있는지 서버의 /var/log 폴더를 살펴봐요.','ls /var/log','서버에서 실행하는 명령이라는 점을 확인하세요.'],
 ['서버 인증 로그 읽기','서버에서 로그인 성공과 실패 기록을 구별해 봅시다.','cat /var/log/auth.log','시간·사용자·접속 출처를 함께 확인하세요.'],
 ['실패 기록 검색하기','반복된 실패 기록만 골라 검색해 보세요.','grep "Failed password" /var/log/auth.log','반복된 로그인 실패만으로 침입 성공을 단정할 수는 없어요.'],
 ['Kali 컴퓨터로 돌아가기','이제 원격 서버의 기록을 확인했으니 exit로 Kali로 돌아가요.','exit','원격 서버와 Kali PC는 다른 컴퓨터예요.'],
 ['증거 파일의 무결성 검사','Kali에 보관된 가상 증거 파일의 SHA-256을 계산해요.','sha256sum /cases/evidence.txt','이 SHA-256은 브라우저의 Web Crypto로 실제 계산해요.'],
 ['분석 결과 작성','실패 기록과 정상 인증, 해시 결과를 정리해 봅시다.','forensic-report','로그만으로 특정 인물이 공격했다고 단정하면 안 돼요.']
 ]}
};
const initial=()=>({
 schemaVersion:2,active:'wireless',progress:{linux:0,network:0,web:0,forensics:0},
 fs:{cwd:'/home/kali',dirs:['/','/home','/home/kali','/var','/var/log','/cases','/home/kali/Desktop','/home/kali/Documents','/home/kali/Downloads','/home/kali/lab-files'],
 files:{'/home/kali/README.txt':'Kali SIM LAB: browser-only training environment.\nNo host OS access.',
 '/home/kali/lab-files/lab-demo.txt':'12345678\npassword123\nsummer2026\nhello-world\ncoffee2026\nadmin2026\nstarlight88\nletmein2026',
 '/var/log/auth.log':'Nov 07 13:08:10 kali sshd[110]: Failed password for guest from 192.0.2.77 port 52001 ssh2\nNov 07 13:08:13 kali sshd[111]: Failed password for guest from 192.0.2.77 port 52002 ssh2\nNov 07 13:08:15 kali sshd[112]: Failed password for guest from 192.0.2.77 port 52003 ssh2\nNov 07 13:09:22 kali sshd[122]: Accepted password for kali from 192.0.2.20 port 52115 ssh2',
 '/cases/evidence.txt':'CASE SIM-107\nSynthetic timeline: three failed logins from 192.0.2.77.\nNo real users or logs are involved.'}},
 web:{headers:false,access:false,output:false},hashChecked:false
});
let data=initial();
try{const raw=JSON.parse(localStorage.getItem(STORE)||'null');if(raw&&raw.progress&&raw.fs&&raw.web){
 const clean=initial();
 data={...clean,...raw,progress:{...clean.progress,...raw.progress},fs:{...clean.fs,...raw.fs,dirs:Array.isArray(raw.fs.dirs)?raw.fs.dirs:clean.fs.dirs,files:{...clean.fs.files,...raw.fs.files}},web:{...clean.web,...raw.web}};
 if(!trackOrder.includes(data.active))data.active='wireless';
 if((data.schemaVersion||1)<2){
  const web=Number(data.progress.web)||0,forensics=Number(data.progress.forensics)||0;
  data.progress.web=web===7?9:web>3?web+1: web;
  data.progress.forensics=forensics===5?7:forensics>3?forensics+2:forensics>0?forensics+1:forensics;
  data.schemaVersion=2;
 }
 for(const k of ['linux','network','web','forensics'])data.progress[k]=Math.min(tracks[k].steps.length,Math.max(0,Number(data.progress[k])||0));
}}catch(_){}
function save(){try{localStorage.setItem(STORE,JSON.stringify(data))}catch(_){}}
function syncFiles(){document.dispatchEvent(new Event('kali-sim:fs-changed'))}
const desktop=$('desktop'),term=$('terminal'),textlog=$('log');
const windowEl=document.createElement('section');windowEl.className='window hidden';windowEl.id='courses';windowEl.setAttribute('aria-label','Kali 학습센터');
windowEl.innerHTML='<div class="window-head"><span class="win-name">▤ Kali Learning Center — Practical Labs [SIM]</span>'+
'<div class="window-buttons"><button id="course-close" class="close" type="button" aria-label="학습센터 닫기">×</button></div></div>'+
'<div class="course-layout"><nav id="course-list" class="course-list" aria-label="보안 과목"></nav>'+
'<div class="course-main"><div class="course-overline">KALI SIM LAB · HANDS-ON CURRICULUM</div><h2 id="course-name"></h2>'+
'<p class="course-desc" id="course-desc"></p><div class="course-score"><span>과목 진행률</span><strong id="course-score"></strong></div>'+
'<div class="course-progress"><div id="course-progress-bar"></div></div><ol class="course-stages" id="course-stages"></ol>'+
'<div class="course-actions"><button type="button" id="course-start">선택한 실습 시작</button>'+
'<button type="button" id="course-reset" class="course-reset">이 과목 초기화</button></div>'+
'<p class="course-disclaimer">가상 교육용 환경입니다. 모든 명령은 이 웹페이지 내부의 모형에만 적용되며 실제 Kali Linux·무선 장치·외부 사이트와 연결되지 않습니다.</p></div></div>';
desktop.append(windowEl);
const side=document.createElement('aside');side.id='course-coach';side.className='course-coach';side.setAttribute('aria-label','현재 과목 실습 안내');
side.innerHTML='<div class="cc-head"><span id="cc-track"></span><span id="cc-progress"></span></div><div class="cc-body">'+
'<h3 id="cc-title"></h3><p id="cc-intro"></p><div class="cc-task">직접 명령을 실행하세요<code id="cc-command"></code></div>'+
'<p class="cc-note" id="cc-note"></p><div class="cc-foot"><button id="cc-courses" type="button">다른 과목 선택</button><button id="cc-reset" type="button">다시 연습</button></div></div>';
desktop.append(side);
const mobile=document.createElement('div');mobile.id='course-mobile';mobile.className='cc-mobile';
mobile.innerHTML='<button type="button" id="cc-mobile-toggle" class="cc-mobile-toggle" aria-expanded="false"><span id="cc-mobile-num" class="cc-num"></span><span id="cc-mobile-title" class="cc-title"></span><span id="cc-mobile-arrow">▼</span></button>'+
'<div id="cc-mobile-detail" class="cc-detail" hidden><p id="cc-mobile-intro"></p><code id="cc-mobile-command"></code><p id="cc-mobile-note"></p>'+
'<button id="cc-mobile-courses" type="button">다른 과목 선택</button></div>';
term.querySelector('.terminal-body').prepend(mobile);
let expanded=false;
$('cc-mobile-toggle').addEventListener('click',()=>{expanded=!expanded;$('cc-mobile-detail').hidden=!expanded;
 $('cc-mobile-toggle').setAttribute('aria-expanded',String(expanded));$('cc-mobile-arrow').textContent=expanded?'▲':'▼'});
function launchButton(label,cls,parent,mode){
 const b=document.createElement('button');b.type='button';b.className=cls||'';b.textContent=label;
 b.addEventListener('click',openHub);parent.append(b);return b;
}
const shortcuts=document.querySelector('.desktop-shortcuts');
const shortcut=launchButton('학습센터','shortcut course-shortcut',shortcuts);
shortcut.innerHTML='<span class="shortcut-icon"><svg class="ico big" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h8l2 3h8v12H3z"/><path d="M7 12h10M7 16h8"/></svg></span>Learning Center';
const dock=document.querySelector('.taskbar'),dockB=launchButton('▤','desktop-task',dock);dockB.id='course-dock';dockB.title='Learning Center · 학습센터';
dockB.setAttribute('aria-label','학습센터 열기');
const cat=document.querySelector('.menu-apps');
const menuEntry=document.createElement('button');menuEntry.type='button';menuEntry.dataset.groups='favorites recon settings';
menuEntry.dataset.appName='learning center security course curriculum education 학습센터';
menuEntry.textContent='▤ Learning Center';menuEntry.addEventListener('click',openHub);cat?.append(menuEntry);
const panelLeft=document.querySelector('.panel-left');
const panelB=launchButton('▤ 학습센터','panel-item',panelLeft);panelB.title='Kali Learning Center';
$('course-close').addEventListener('click',()=>windowEl.classList.add('hidden'));
$('cc-courses').addEventListener('click',openHub);
$('cc-mobile-courses').addEventListener('click',openHub);
$('cc-reset').addEventListener('click',()=>resetCurrent());
$('course-reset').addEventListener('click',()=>resetCurrent());
$('course-start').addEventListener('click',()=>startTrack(data.active));
function currentLength(id){return id==='wireless'?9:tracks[id].steps.length}
function currentProgress(id){
 if(id==='incident')return window.KaliLAN?.progress().count||0;
 if(id==='sandbox')return 0;
 if(id==='wireless'){const m=$('progress-text')?.textContent?.split('/');return m?Number.parseInt(m[0],10)||0:0}
 return data.progress[id]||0;
}
function renderHub(){
 const left=$('course-list');left.replaceChildren();
 for(const id of trackOrder){
  const t=tracks[id],n=currentProgress(id),max=currentLength(id);
  const b=document.createElement('button');b.type='button';b.dataset.track=id;b.className=data.active===id?'selected':'';
  const icon=document.createElement('span');icon.textContent=t.glyph;icon.setAttribute('aria-hidden','true');
  const title=document.createElement('span');title.className='course-label';title.textContent=t.title;
  const progress=document.createElement('span');progress.className='course-count';progress.textContent=n+'/'+max;
  b.append(icon,title,progress);b.addEventListener('click',()=>selectTrack(id,false));left.append(b);
 }
 const t=tracks[data.active],n=currentProgress(data.active),max=currentLength(data.active);
 $('course-name').textContent=t.title;$('course-desc').textContent=t.desc;
 $('course-score').textContent=n+' / '+max;$('course-progress-bar').style.width=(100*n/max)+'%';
 $('course-stages').replaceChildren();
 const steps=data.active==='wireless'?
  ['인터페이스 확인','Wi-Fi 목록','모니터 모드','AP 관찰','인증 교환 이벤트','암호 점검','관리 모드 복귀','가상 연결','보안 강화'].map(x=>[x]):t.steps;
 steps.forEach((s,i)=>{
  const row=document.createElement('li');row.className=i<n?'done':i===n?'next':'';
  const idx=document.createElement('span');idx.className='num';idx.textContent=i<n?'✓':String(i+1);
  const label=document.createElement('span');label.textContent=s[0];row.append(idx,label);$('course-stages').append(row);
 });
 $('course-start').textContent=n===max?'과목 다시 살펴보기':'선택한 실습 시작';
 $('course-reset').disabled=data.active==='wireless'||data.active==='sandbox';
 $('course-reset').title=data.active==='wireless'?'Wi-Fi 실습의 초기화 버튼은 원래 진행률 창에서 사용해 주세요.':data.active==='sandbox'?'자유 실습은 진행률이 없어요.':'이 과목만 처음부터 다시 시작';
}
function renderCoach(){
 desktop.classList.toggle('course-other',data.active!=='wireless');
 renderHub();
 if(data.active==='incident'||data.active==='sandbox'){$('course-coach').hidden=true;mobile.hidden=true;return}
 if(data.active==='wireless'){ $('course-coach').hidden=true;mobile.hidden=true;return }
 const id=data.active,t=tracks[id],n=data.progress[id],len=t.steps.length;
 const step=n>=len?['과목을 완료했어요!','모든 단계가 끝났어요. 학습센터에서 다음 과목을 고르거나 다시 연습해 보세요.','help','명령어가 왜 필요한지 떠올려 보세요.']:t.steps[n];
 $('cc-track').textContent=t.title;$('cc-progress').textContent=n+'/'+len;
 $('cc-title').textContent=step[0];$('cc-intro').textContent=step[1];
 $('cc-command').textContent=step[2];$('cc-note').textContent=step[3];
 $('cc-mobile-num').textContent=(n+1>len?len:n+1)+'/'+len;
 $('cc-mobile-title').textContent=step[0];$('cc-mobile-intro').textContent=step[1];
 $('cc-mobile-command').textContent=step[2];$('cc-mobile-note').textContent=step[3];
 expanded=false;$('cc-mobile-detail').hidden=true;$('cc-mobile-toggle').setAttribute('aria-expanded','false');$('cc-mobile-arrow').textContent='▼';
 $('course-coach').hidden=false;mobile.hidden=false;
 // Replace Wi-Fi quick commands while another course is in focus.
 const area=$('quick');area.replaceChildren();
 const choices=[step[2],'help'].filter(Boolean);
 for(const cmd of choices){const b=document.createElement('button');b.type='button';b.textContent=cmd;
   b.addEventListener('click',()=>executeTrack(cmd));area.append(b)}
}
function selectTrack(id,saveSelection=true){
 if(!tracks[id])return;
 data.active=id;save();
 document.dispatchEvent(new Event('kali-sim:course-switched'));
 renderCoach();
}
function openHub(){
 if($('power-layer')&&!$('power-layer').hidden)return;
 windowEl.classList.remove('hidden','minimized');
 windowEl.style.zIndex=String(Math.max(1500,...[...document.querySelectorAll('.window')].map(x=>Number(x.style.zIndex)||0))+1);
 $('menu-panel')?.classList.remove('open');
 renderHub();
}
function openTerminal(){
 const launcher=document.querySelector('.desktop-shortcuts [data-open="terminal"]');if(launcher)launcher.click();
 term.classList.remove('hidden','minimized');
 // Focus stacking is handled by the original XFCE window manager.
 // Do not pin the terminal above other application windows.
}
function startTrack(id){
 if(id==='incident'&&!window.KaliLAN?.mission.started)window.KaliLAN?.missionStart();
 selectTrack(id);
 windowEl.classList.add('hidden');
 openTerminal();
 if(id==='incident'||id==='sandbox')window.KaliLANUI?.render();
}
function resetCurrent(){
 if(data.active==='wireless'||data.active==='sandbox')return;
 if(data.active==='incident'){
  if(confirm('INCIDENT-001을 처음부터 시작할까요? 종합 임무 기록과 공유 가상 웹 서버 상태가 초기화되어 웹 보안·자유 실습에도 반영됩니다.')){
   window.KaliLAN?.missionStart();
   renderCoach();window.KaliLANUI?.render();
  }
  return
 }
 const resetQuestion=data.active==='web'?
 '웹 보안 과목의 진행 단계만 초기화할까요? 가상 웹 서버 설정은 종합 임무·자유 실습과 공유하므로 유지됩니다.':
 '선택한 과목의 진행을 초기화할까요?';
 if(!confirm(resetQuestion))return;
 data.progress[data.active]=0;
 if(data.active==='linux')data.fs=initial().fs;
 if(data.active==='web')data.web=initial().web;
 if(data.active==='forensics')data.hashChecked=false;
 save();syncFiles();renderCoach();
}
function print(message,kind=''){
 const line=document.createElement('div');line.className='line '+kind;line.textContent=String(message);
 textlog.append(line);textlog.scrollTop=textlog.scrollHeight;
}
function normalize(p){
 const parts=p.startsWith('/')?[]:data.fs.cwd.split('/').filter(Boolean);
 for(const v of p.split('/')){if(v===''||v==='.')continue;if(v==='..')parts.pop();else parts.push(v)}
 return '/'+parts.join('/');
}
function fsDir(path){return data.fs.dirs.includes(path)}
function ls(path,long=false){
 const dir=normalize(path||'.');
 if(!fsDir(dir))return {ok:false,lines:['ls: directory not found: '+dir]};
 const children=[];
 for(const d of data.fs.dirs){if(d!==dir&&d.startsWith(dir==='/'?'/':dir+'/')){
 const rem=d.slice((dir==='/'?'':dir).length+1);if(rem&&!rem.includes('/'))children.push({name:rem,dir:true})}}
 for(const k of Object.keys(data.fs.files)){if(k.startsWith(dir==='/'?'/':dir+'/')){
 const rem=k.slice((dir==='/'?'':dir).length+1);if(rem&&!rem.includes('/'))children.push({name:rem,dir:false})}}
 children.sort((a,b)=>a.name.localeCompare(b.name));
 return {ok:true,lines:[children.length?children.map(x=>long?(x.dir?'drwxr-xr-x':'-rw-r--r--')+' kali kali '+x.name:x.name).join('\n'):'(empty directory)']};
}
const webPreview=()=> (window.KaliLAN?.web.output??data.web.output)?'사용자 입력은 HTML 이스케이프 처리됨':'사용자 입력이 안전하지 않게 표시되는 설정 [SIM]';
const issues=()=>[
 ...(!(window.KaliLAN?.web.headers??data.web.headers)?['보안 응답 헤더가 빠졌습니다.']:[]),
 ...(!(window.KaliLAN?.web.access??data.web.access)?['관리자 자료에 대한 접근 통제가 없습니다.']:[]),
 ...(!(window.KaliLAN?.web.output??data.web.output)?['사용자 입력이 안전하게 이스케이프되지 않습니다.']:[])
];
async function sha256(text){
 if(!crypto?.subtle)throw Error('SHA-256을 이용하려면 HTTPS 또는 로컬 호스트의 보안 컨텍스트가 필요해요.');
 const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return [...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function success(out,task){
 out.forEach(v=>print(v,task?'ok':''));
 if(task && data.progress[data.active]<tracks[data.active].steps.length){
  data.progress[data.active]+=1;save();renderCoach();
  print('✓ '+tracks[data.active].title+' '+data.progress[data.active]+'/'+tracks[data.active].steps.length+' 단계 완료','ok');
 }
}

const LOCAL_FS=/^(?:pwd$|ls(?:\s|$)|cd(?:\s|$)|mkdir\s|touch\s|cat\s)/;
function virtualFs(cmd){
 if(!LOCAL_FS.test(cmd))return null;
 let result={ok:false,lines:['가상 파일 시스템에서 지원하지 않는 명령입니다.']};
 if(cmd==='pwd')result={ok:true,lines:[data.fs.cwd]};
 else if(cmd==='ls'||cmd==='ls -l'||cmd.startsWith('ls ')){
  const m=cmd.match(/^ls(?: (-l))?(?: (.+))?$/);
  if(m)result=ls(m[2]||'.',!!m[1]);
 }else if(/^mkdir [\w./-]+$/.test(cmd)){
  const d=normalize(cmd.slice(6)),parent=d.slice(0,d.lastIndexOf('/'))||'/';
  if(!fsDir(parent))result={ok:false,lines:['mkdir: parent directory does not exist: '+parent]};
  else if(fsDir(d)||Object.hasOwn(data.fs.files,d))result={ok:false,lines:['mkdir: File exists: '+d]};
  else{data.fs.dirs.push(d);save();syncFiles();result={ok:true,lines:['디렉터리 생성됨: '+d+' [SIM]']}}
 }else if(/^cd(?: .+)?$/.test(cmd)){
  const p=normalize(cmd==='cd'?'/home/kali':cmd.slice(3).trim()==='~'?'/home/kali':cmd.slice(3));
  if(fsDir(p)){data.fs.cwd=p;save();result={ok:true,lines:['작업 경로: '+p]}}
  else result={ok:false,lines:['cd: no such directory: '+p]};
 }else if(/^touch [\w./-]+$/.test(cmd)){
  const path=normalize(cmd.slice(6)),parent=path.slice(0,path.lastIndexOf('/'))||'/';
  if(!fsDir(parent))result={ok:false,lines:['touch: parent directory does not exist: '+parent]};
  else if(fsDir(path))result={ok:false,lines:['touch: cannot overwrite a directory: '+path]};
  else{data.fs.files[path]??='';save();syncFiles();result={ok:true,lines:['파일 생성: '+path+' [SIM]']}}
 }else if(/^cat \S+$/.test(cmd)){
  const path=normalize(cmd.slice(4));
  result=data.fs.files[path]!==undefined?{ok:true,lines:[data.fs.files[path]||'(empty file)']}:{ok:false,lines:['cat: no such file: '+path]};
 }
 return result;
}
async function executeTrack(raw){
 const cmd=String(raw).trim().replace(/\s+/g,' ');
 if(!cmd||data.active==='wireless'||data.active==='incident'||data.active==='sandbox')return;
 $('shell-input').value='';const shell=window.KaliLAN?.shell||{host:'kali',user:'kali'};
 const promptPath=shell.host==='web01'?'~':data.fs.cwd.startsWith('/home/kali')?'~'+data.fs.cwd.slice('/home/kali'.length):data.fs.cwd;
 print('┌──('+shell.user+'㉿'+shell.host+')-['+promptPath+']\n└─$ '+cmd,'prompt');
 const id=data.active,t=tracks[id],progress=data.progress[id],step=t.steps[progress];
 if(cmd==='help'){
  print('교육용 '+t.title+' 모드입니다. 현재 목표: '+(step?.[0]||'과목 완료'),'sys');
  print('추천 명령: '+(step?.[2]||'Learning Center에서 다른 과목을 선택하세요.'));
  print('가상 명령만 구현되어 있어요. 실제 시스템이나 외부 서버에는 접근하지 않습니다.','warn');return;
 }

 const shared=window.KaliLAN?.common(cmd);
 if(shared){
  if(shared.ok&&/^web-fix\s/.test(cmd)){const k=cmd.split(' ')[1];data.web[k]=true;save()}
  for(const line of shared.lines||[])print(line,shared.ok?'':'warn');
  if(!shared.ok)print(window.KaliLAN.explainFailure(shared,cmd),'warn');
  const isExpected=shared.ok&&cmd===step?.[2]&&
    (!(id==='network'&&cmd.startsWith('curl'))||shared.status===200);
  if(isExpected)success([],true);
  return;
 }
 if(window.KaliLAN?.shell.host==='web01'&&LOCAL_FS.test(cmd)){
  print('원격 서버에서는 이 가상 파일 명령을 사용할 수 없어요. exit로 Kali PC에 돌아가세요.','warn');return
 }
 let result={ok:false,lines:['지원되지 않는 가상 명령입니다. 현재 과목의 안내를 확인하세요.']};
 let completed=false;
 if(id==='linux'||(LOCAL_FS.test(cmd)&&window.KaliLAN?.shell.host!=='web01')){
  result=virtualFs(cmd)||result;
  completed=id==='linux'&&result.ok&&(
   (progress===0&&cmd==='pwd'&&data.fs.cwd==='/home/kali')||
   (progress===1&&cmd==='ls')||
   (progress===2&&cmd==='mkdir training'&&fsDir('/home/kali/training'))||
   (progress===3&&cmd==='cd training'&&data.fs.cwd==='/home/kali/training')||
   (progress===4&&cmd==='touch notes.txt'&&Object.hasOwn(data.fs.files,'/home/kali/training/notes.txt'))||
   (progress===5&&cmd==='ls -l'&&data.fs.cwd==='/home/kali/training')
  );
 } else if(id==='network'){
  const net=window.KaliNetwork,ap=net?.ap||{online:true,channel:6,security:'WPA2-PSK'};
  const link=!!(ap.online&&net?.station?.connected&&!net?.radio?.monitor);
  if(cmd==='ip a')result={ok:true,lines:['1: lo    inet 127.0.0.1/8\n2: wlan0  [SIM] state '+(link?'CONNECTED':ap.online?'DISCONNECTED':'DOWN')]};
  else if(cmd==='ip route')result={ok:true,lines:[link?'default via 192.0.2.1 dev wlan0\n192.0.2.0/24 dev wlan0 scope link':'(연결된 가상 인터페이스가 없어 기본 경로가 없습니다.)']};
  else if(cmd==='ping 192.0.2.1')result=link?{ok:true,lines:['PING 192.0.2.1: 3 packets transmitted, 3 received (SIM)']}:{ok:false,lines:['Destination Host Unreachable: AP 전원 또는 클라이언트 연결 상태를 Network에서 확인하세요.']};
  else if(cmd==='nslookup training.lab')result=link?{ok:true,lines:['Server: 192.0.2.1 [SIM]\nName: training.lab\nAddress: 192.0.2.20']}:{ok:false,lines:['DNS lookup failed: 가상 네트워크가 연결되지 않았어요.']};
  else if(cmd==='curl -I http://training.lab'){const r=window.KaliLAN?.request('http://training.lab',{head:true});result={ok:r?.ok&&r.status===200,lines:r?.headers||['가상 웹 서버에 접근할 수 없어요.']}};
  completed=result.ok&&cmd===step?.[2];
 }else if(id==='web'){
  const lan=window.KaliLAN;
  if(cmd==='curl http://demo.lab'||cmd==='curl -I http://demo.lab'){
   const head=cmd.startsWith('curl -I ');
   const r=lan?.request('http://demo.lab',{head})||{ok:false,headers:[],body:[]};
   result={ok:r.ok&&r.status===200,lines:head?r.headers:[...r.headers,'',...r.body]};
  }
  else if(cmd==='web-audit demo.lab'){
   if(!lan?.web.running)result={ok:false,lines:['가상 lab-web 서비스가 멈춰 있어요. Network Map에서 복구하세요.']};
   else result={ok:true,lines:[issues().length?'가상 보안 진단:\n- '+issues().join('\n- '):'가상 보안 진단: 발견된 설정 문제가 없어요.']};
  }
  else if(/^web-fix (headers|access|output)$/.test(cmd)){
   const what=cmd.split(' ')[1],r=lan?.webFix(what);
   if(r?.ok){data.web[what]=true;save();result={ok:true,lines:r.lines}}
   else result={ok:false,lines:r?.lines||['가상 웹 설정 변경 실패']};
  }
  else if(cmd==='web-verify demo.lab')result=lan?.web.running&&issues().length===0?
   {ok:true,lines:['PASS: 모든 가상 웹 보안 점검 통과']}:
   {ok:false,lines:['아직 남은 항목:\n- '+(!lan?.web.running?'웹 서비스가 중단되어 있습니다.':issues().join('\n- '))]};
  completed=result.ok&&cmd===step?.[2];
 }else if(id==='forensics'){
  const logfile=window.KaliLAN?.logText()||data.fs.files['/var/log/auth.log'];
  if(cmd==='ls /var/log')result={ok:true,lines:['auth.log']};
  else if(cmd==='cat /var/log/auth.log')result={ok:true,lines:[logfile]};
  else if(cmd==='grep "Failed password" /var/log/auth.log'||cmd==='grep Failed /var/log/auth.log')result={ok:true,lines:[logfile.split('\n').filter(l=>l.includes('Failed password')).join('\n')]};
  else if(cmd==='sha256sum /cases/evidence.txt'){
   try{const digest=await sha256(data.fs.files['/cases/evidence.txt']);data.hashChecked=true;save();result={ok:true,lines:[digest+'  /cases/evidence.txt [SHA-256 computed locally]']}}
   catch(e){result={ok:false,lines:[e.message]}}
  }else if(cmd==='forensic-report')result=data.hashChecked?{ok:true,lines:['CASE SIM-107 (가상 보고서)\n- 출처 192.0.2.77: 실패한 SSH 인증 3건\n- 192.0.2.20: 정상 인증 1건\n- 증거 파일 SHA-256 확인됨\n- 반복된 실패가 반드시 침입 성공을 의미하지는 않습니다.']}: {ok:false,lines:['먼저 증거 파일 SHA-256을 확인하세요.']};
  completed=result.ok&&cmd===step?.[2];
 }
 if(!result.ok){result.lines.forEach(l=>print(l,'warn'));return}
 success(result.lines,completed);
}
const form=$('shell-form');
form.addEventListener('submit',e=>{
 if(data.active==='wireless'||data.active==='incident'||data.active==='sandbox')return;
 e.preventDefault();e.stopImmediatePropagation();
 void executeTrack($('shell-input').value);
},true);
document.addEventListener('kali-sim:lab-progress',()=>{if(data.active==='wireless')renderHub()});
document.addEventListener('kali-sim:lan-changed',()=>{if(['incident','sandbox'].includes(data.active))renderHub()});
document.addEventListener('kali-sim:tour-started',()=>desktop.classList.add('tour-running'));
document.addEventListener('kali-sim:tour-ended',()=>{desktop.classList.remove('tour-running');renderCoach()});
document.addEventListener('kali-sim:booted',()=>{renderCoach()});
document.addEventListener('kali-sim:shutdown',()=>{windowEl.classList.add('hidden')});
window.KaliCurriculum={selectTrack:startTrack,open:openHub,fs:virtualFs,snapshot:()=>JSON.parse(JSON.stringify(data)),run:executeTrack,reset:resetCurrent};
renderCoach();syncFiles();
})();
