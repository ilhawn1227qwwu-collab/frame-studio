
/* Guided Kali XFCE tour. Simulated OS only; requires actual user interactions. */
(()=>{'use strict';
const $=id=>document.getElementById(id),KEY='kali-sim-tour-v1-complete';
const I=(title,body,target,tip,next)=>({mode:'info',title,body,target,tip,next});
const C=(title,body,target,hint)=>({mode:'click',title,body,target,hint});
const M=(mode,title,body,target,hint)=>({mode,title,body,target,hint});
const stages=[
 I('Kali Linux에 오신 걸 환영해요!','Linux는 Windows처럼 컴퓨터를 작동시키는 운영체제(OS)예요. Kali Linux는 보안 실습에 필요한 도구를 모아 놓은 리눅스 배포판이고요.',null,'지금은 진짜 Kali OS가 아니라, 브라우저 안에서 작동하는 가상 실습 데스크톱이에요. 하나씩 눌러봅시다!','바탕화면 살펴보기'),
 C('왼쪽 위 버튼이 뭘까요?','Kali 로고 옆 Applications 버튼은 윈도우의 시작 메뉴 같은 거예요. 눌러보세요!','#menu-btn','강조된 Applications 버튼을 눌러보세요.'),
 I('와, 프로그램 메뉴가 열렸어요!','이곳에서 설치된 프로그램을 찾아요. 카테고리를 구분해서 보안 도구를 탐색할 수 있어요.','#menu-panel .menu-head','Kali는 정보 수집, 무선 네트워크, 분석 등 분야별 보안 도구를 제공해요.','네트워크 프로그램 찾아보기'),
 C('Wi-Fi 프로그램을 찾아볼까요?','Network Connections 버튼을 눌러서 무선 네트워크 목록을 열어볼게요.','#menu-panel button[data-open="wifi"]','메뉴에서 Network Connections를 눌러주세요.'),
 I('여기가 NetworkManager예요.','리눅스에서 네트워크 연결을 확인하는 도구예요. LAB-TRAINING은 연습용 가상 Wi-Fi 이름(SSID)이에요.','#wifi .window-head','SSID는 와이파이 이름, WPA2·WPA3는 보안 방식이에요.','네트워크 정보 살펴보기'),
 C('이 버튼도 눌러봅시다!','LAB-TRAINING 오른쪽에 있는 정보 보기 버튼을 눌러주세요.','#wifi .net.target button','정보 보기 버튼을 눌러주세요.'),
 I('오, 네트워크 정보가 나왔네요!','BSSID는 접속 지점을 식별하는 값이고, 채널은 무선 통신에 쓰는 주파수 구분이에요.','#net-info','이 정보는 실제 주변 Wi-Fi를 스캔한 게 아니라 미리 만들어 둔 가상 데이터예요.','바탕화면으로 돌아가기'),
 C('바탕화면으로 돌아가요!','Wi-Fi 창 오른쪽 위 × 버튼을 눌러 닫아보세요.','#wifi [data-close="wifi"]','× 버튼을 눌러 창을 닫아주세요.'),
 C('이번에는 터미널을 눌러봐요.','바탕화면 Terminal 아이콘을 열어볼게요. 리눅스를 배우는 데 아주 중요한 도구예요.','.desktop-shortcuts [data-open="terminal"]','바탕화면 Terminal 아이콘을 눌러보세요.'),
 I('짜잔! 터미널이에요.','터미널은 글자로 명령을 내려 시스템을 조작하는 공간이에요. 파일 탐색, 시스템 확인, 프로그램 실행에 쓰여요.','#terminal .window-head','명령어의 뜻을 알고 실행 결과를 읽는 게 핵심이에요.','첫 명령어 사용하기'),
 M('command','직접 help를 입력해 봐요!','입력칸에 help를 치고 Enter 또는 실행 버튼을 눌러주세요. 이 가상 터미널에서 쓸 수 있는 명령이 보여요.','#shell-input','help를 입력하고 Enter를 눌러주세요.'),
 I('잘했어요! 명령이 실행됐네요.','명령어 목록이 보이죠? 나중에는 whoami, pwd, ls, ip a도 입력해 보세요. 실제 리눅스에서도 쓰는 명령이에요.','#terminal .terminal-log','다만 이 화면의 실행 결과는 JavaScript로 만든 교육용 시뮬레이션이에요.','터미널 닫기'),
 C('터미널에서 나와볼까요?','창 오른쪽 위의 × 버튼을 누르면 바탕화면으로 돌아갈 수 있어요.','#terminal [data-close="terminal"]','터미널의 × 버튼을 눌러주세요.'),
 C('Home 아이콘은 뭐예요?','리눅스의 파일 탐색기 Thunar를 열어볼까요? Windows 파일 탐색기와 비슷한 역할이에요.','.desktop-shortcuts [data-open="files"]','바탕화면 Home 아이콘을 눌러주세요.'),
 I('여기가 파일 관리자 Thunar예요.','주소 /home/kali는 kali 사용자 홈 폴더의 경로예요. 폴더와 파일을 살펴볼 수 있어요.','#files .gtk-toolbar','리눅스에서 / 문자는 폴더 경로를 구분해요.','실습 폴더 찾아보기'),
 C('lab-files 폴더도 열어볼까요?','왼쪽 목록에서 lab-files를 누르면 연습용 자료들이 나와요.','#file-sidebar [data-place="lab-files"]','왼쪽 lab-files 폴더를 눌러주세요.'),
 I('이곳엔 실습 파일이 있네요.','.cap은 패킷 캡처 파일, .txt는 일반 텍스트 파일을 뜻해요. 실제 보안 실습에서는 파일의 역할을 확인해야 해요.','#file-items','여기 보이는 건 가상 파일 목록이에요. 실제 파일을 생성하거나 읽지는 않아요.','바탕화면으로 돌아가기'),
 C('파일 관리자도 닫아볼까요?','오른쪽 위 × 버튼을 눌러주세요.','#files [data-close="files"]','Thunar의 × 버튼을 눌러주세요.'),
 C('이젠 Lab Notes를 열어봐요.','바탕화면의 Lab Notes는 실습 방법을 설명한 메모장이에요.','.desktop-shortcuts [data-open="guide"]','Lab Notes 아이콘을 눌러주세요.'),
 I('여기가 학습 노트예요!','실습에서 사용할 명령어와 주의할 점을 읽을 수 있어요. 낯선 개념이 나오면 이곳부터 확인해요.','#guide .window-body',null,'노트 창 닫기'),
 C('다시 바탕화면으로!','노트 창의 × 버튼을 눌러주세요.','#guide [data-close="guide"]','Lab Notes 창의 × 버튼을 눌러주세요.'),
 C('이번엔 화면을 꾸며볼까요?','바탕화면 Appearance 아이콘은 모양 설정이에요.','.desktop-shortcuts [data-open="appearance"]','Appearance 아이콘을 눌러주세요.'),
 I('모양 설정 창이네요!','Kali Dark 스타일과 배경화면을 바꿔볼 수 있어요. 직접 변경해 볼까요?','#appearance .appearance-options',null,'배경 바꿔보기'),
 M('change','배경화면을 골라보세요.','Desktop Wallpaper 목록에서 Graphite Dark 또는 Ocean Blue를 선택해 주세요.','#wallpaper-choice','현재 기본값과 다른 배경을 선택해 보세요.'),
 I('바뀌었어요!','화면 색상이 달라졌네요. 이렇게 리눅스의 데스크톱은 원하는 대로 꾸밀 수 있어요.','#appearance .appearance-preview','선택한 테마는 지금 쓰는 브라우저에 저장돼요.','설정 창 닫기'),
 C('마지막으로 바탕화면으로!','Appearance 창 오른쪽 위의 × 버튼을 눌러주세요.','#appearance [data-close="appearance"]','× 버튼을 눌러주세요.'),
 I('이제 실습을 시작할 차례예요.','Wireless Lab에는 9단계의 가상 Wi-Fi 보안 학습이 있어요. 터미널에서 ip a부터 시작하면 돼요.','#mission','실제 Kali 도구 실행이 아니라 페이지 안에 만든 실습 시뮬레이션이에요.','튜토리얼 마치기'),
 I('Kali 데스크톱 탐험 성공!','Applications, Wi-Fi, 터미널, 파일 관리자, 노트, 배경화면까지 직접 다뤄봤어요. 이제 스스로 찾아볼 수 있겠죠?',null,'상단 ? 버튼으로 언제든 다시 배울 수 있어요. 다음은 터미널에서 ip a 명령을 입력해 보세요.','이제 혼자 해보기')
];
const root=document.createElement('div');root.id='onboard-root';root.hidden=true;
root.innerHTML='<div id="onboard-spot" aria-hidden="true"></div>'+
'<section id="onboard-card" role="dialog" aria-labelledby="ob-title" aria-describedby="ob-body" tabindex="-1">'+
'<div class="ob-head"><span class="ob-brand">KALI · DESKTOP TOUR</span><span id="ob-number" class="ob-number"></span></div>'+
'<div class="ob-progress"><div id="ob-progress"></div></div>'+
'<div class="ob-content"><div class="ob-icon" aria-hidden="true">⌘</div><h2 id="ob-title"></h2><p id="ob-body"></p>'+
'<div id="ob-learn" class="ob-learn"></div><div id="ob-action" class="ob-action" hidden><span></span><div id="ob-action-text"></div></div></div>'+
'<div class="ob-footer"><button id="ob-skip" class="ob-skip" type="button">건너뛰기</button>'+
'<button id="ob-next" class="ob-next" type="button">다음</button></div></section>';
$('desktop').append(root);
const card=$('onboard-card'),spot=$('onboard-spot'),next=$('ob-next');
// Tour card clicks must not be treated as outside-clicks by the XFCE launcher.
card.addEventListener('pointerdown',event=>event.stopPropagation());
const panel=document.querySelector('.panel-right');
const restart=document.createElement('button');restart.id='onboard-restart';restart.type='button';restart.className='panel-item';
restart.title='Kali 데스크톱 튜토리얼 다시 시작';
restart.innerHTML='<span class="ob-help-icon" aria-hidden="true">?</span><span class="ob-help-label">튜토리얼</span>';
panel.insertBefore(restart,panel.firstElementChild);
restart.addEventListener('click',()=>start());
const appList=document.querySelector('.menu-apps');
if(appList){
 const b=document.createElement('button');b.id='onboard-menu-entry';b.type='button';
 b.dataset.groups='favorites all';b.dataset.appName='guided desktop tour kali linux tutorial 튜토리얼';
 b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1"/></svg>Guided Desktop Tour';
 b.addEventListener('click',()=>start());appList.append(b);
}
let active=false,index=0,frame=0;
const done=()=>{try{return localStorage.getItem(KEY)==='yes'}catch(_){return false}};
const markDone=()=>{try{localStorage.setItem(KEY,'yes')}catch(_){}};
function resetDesktop(){
 document.querySelectorAll('.window').forEach(w=>{w.classList.add('hidden');w.classList.remove('minimized')});
 $('menu-panel').classList.remove('open');$('menu-btn').setAttribute('aria-expanded','false');
 $('mission').classList.remove('show','hide-on-desktop');$('shell-input').blur();
}
function start(){
 if(!$('power-layer').hidden)return;
 active=true;index=0;resetDesktop();root.hidden=false;document.dispatchEvent(new Event('kali-sim:tour-started'));show();
}
function end(mark=true){
 if(mark)markDone();
 active=false;root.hidden=true;root.classList.remove('is-center');document.dispatchEvent(new Event('kali-sim:tour-ended'));
 $('menu-panel').classList.remove('open');$('menu-btn').setAttribute('aria-expanded','false');
 $('mission').classList.remove('show');
 // After onboarding or skip, open the terminal for the first lab mission.
 if(mark&&$('power-layer').hidden){
   const terminalLauncher=document.querySelector('.desktop-shortcuts [data-open="terminal"]');
   if(terminalLauncher)terminalLauncher.click();
 }
}
function proceed(){
 if(!active)return;
 if(index===stages.length-1){end();return}
 index++;show();
}
function center(){
 const ww=card.offsetWidth,hh=card.offsetHeight;
 card.style.left=Math.round(Math.max(8,(innerWidth-ww)/2))+'px';
 card.style.top=Math.round(Math.max(8,(innerHeight-hh)/2))+'px';
}
function place(){
 if(!active)return;
 const s=stages[index],target=s.target?document.querySelector(s.target):null;
 if(!target||!target.getClientRects().length||getComputedStyle(target).visibility==='hidden'){
  root.classList.add('is-center');center();return;
 }
 root.classList.remove('is-center');
 const r=target.getBoundingClientRect(),W=innerWidth,H=innerHeight,pad=6;
 spot.style.left=Math.round(Math.max(2,r.left-pad))+'px';
 spot.style.top=Math.round(Math.max(2,r.top-pad))+'px';
 spot.style.width=Math.round(Math.min(W-4,r.width+pad*2))+'px';
 spot.style.height=Math.round(Math.min(H-4,r.height+pad*2))+'px';
 const cw=card.offsetWidth,ch=card.offsetHeight,gap=14;
 let x=Math.max(8,(W-cw)/2),y=8;
 if(r.right+gap+cw<W-8){x=r.right+gap;y=r.top}
 else if(r.left-gap-cw>8){x=r.left-gap-cw;y=r.top}
 else if(r.bottom+gap+ch<H-8){y=r.bottom+gap}
 else if(r.top-ch-gap>8){y=r.top-ch-gap}
 else y=r.top>H/2?8:H-ch-8;
 card.style.left=Math.round(Math.max(8,Math.min(W-cw-8,x)))+'px';
 card.style.top=Math.round(Math.max(8,Math.min(H-ch-8,y)))+'px';
}
function schedule(){if(frame)cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;place()})}
function show(){
 if(!active)return;
 const s=stages[index],action=['click','command','change'].includes(s.mode);
 $('ob-title').textContent=s.title;$('ob-body').textContent=s.body;
 $('ob-number').textContent=String(index+1).padStart(2,'0')+' / '+stages.length;
 $('ob-progress').style.width=(100*(index+1)/stages.length)+'%';
 $('ob-learn').hidden=!s.tip;$('ob-learn').textContent=s.tip||'';
 $('ob-action').hidden=!action;$('ob-action-text').textContent=s.hint||'직접 눌러 보세요.';
 next.hidden=action;next.textContent=s.next||'다음';
 if(s.target==='#mission'&&innerWidth<=760)$('mission').classList.add('show');
 requestAnimationFrame(()=>requestAnimationFrame(place));
}
next.addEventListener('click',proceed);
$('ob-skip').addEventListener('click',()=>end(true));
document.addEventListener('click',e=>{
 if(!active)return;
 const step=stages[index];if(step.mode!=='click')return;
 const target=e.target.closest(step.target);if(!target)return;
 setTimeout(()=>{if(active&&stages[index]===step)proceed()},100);
},true);
document.addEventListener('submit',e=>{
 if(!active||stages[index].mode!=='command'||e.target.id!=='shell-form')return;
 if($('shell-input').value.trim().toLowerCase()==='help'){
  const step=stages[index];setTimeout(()=>{if(active&&stages[index]===step)proceed()},150);
 }
},true);
document.addEventListener('change',e=>{
 if(!active||stages[index].mode!=='change'||e.target.id!=='wallpaper-choice'||e.target.value==='default')return;
 const step=stages[index];setTimeout(()=>{if(active&&stages[index]===step)proceed()},120);
},true);
document.addEventListener('kali-sim:booted',()=>{
 // Every power-on starts the desktop tour, even if it was completed previously.
 // The nine-stage lab coach takes over only when the tour finishes or is skipped.
 setTimeout(()=>{if($('power-layer').hidden&&!active)start()},100);
});
document.addEventListener('kali-sim:shutdown',()=>{if(active)end(false)});
window.addEventListener('resize',schedule);
document.addEventListener('scroll',schedule,true);
document.addEventListener('fullscreenchange',schedule);
})();
