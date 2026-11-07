
/* Contextual final popup: icons/menus for the complete browser-only Kali SIM lab. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const items=[
 ['⌘','Kali 메뉴','앱 목록·카테고리·가상 컴퓨터 종료·Wi-Fi 초기화'],
 ['⌘','Terminal','가상 리눅스·네트워크·웹·포렌식 명령어 입력'],
 ['◉','Wi-Fi / NetworkManager','가상 공유기와 Kali PC, 교육용 클라이언트의 상태·연결 제어'],
 ['⌂','Home / Thunar','가상 파일과 폴더 탐색. 터미널에서 만든 파일과 연동'],
 ['▤','Lab Notes','명령어·용어·주의사항을 읽는 학습 노트'],
 ['⚙','Router Admin','가상 Wi-Fi에 WPA3-SAE와 강한 암호 적용'],
 ['✦','Appearance','데스크톱 배경화면·색상 변경'],
 ['▤','Learning Center','7개 과정·모드 선택, 과목별 진도와 과제 보기'],
 ['▣','Firefox SIM','가상 사내 사이트에서 HTTP 상태 코드·접근 제어 확인'],
 ['◉','Network Map','Kali·공유기·웹 서버·로그 서버의 가상 상태 확인'],
 ['⚑','INCIDENT-001','서버 장애 조사 → 복구 → 보안 조치 → 보고서 작성'],
 ['∞','자유 실습','순서 없이 가상 LAN 명령어와 기능 연습'],
 ['▥','실습 진행률','단계별 목표와 설명. 모바일에서는 안내를 접고 펼치기'],
 ['?','튜토리얼','데스크톱 및 보안 도구 사용법을 처음부터 다시 학습'],
 ['ⓘ','아이콘 안내','지금 이 아이콘별 요약표 다시 보기'],
 ['⛶','전체화면','브라우저가 허용할 때 가상 OS 화면을 넓게 사용'],
 ['⏻','종료 / 다시 켜기','가상 컴퓨터 종료·재부팅. 실제 기기 전원과 무관'],
 ['↺','초기화','Wi-Fi 또는 특정 과목의 진도 초기화. 저장 범위 주의']
];
const el=document.createElement('div');el.id='onboard-icon-reference';el.hidden=true;
el.innerHTML='<div class="ob-ref-backdrop"></div>'+
 '<section class="ob-ref-modal" role="dialog" aria-modal="true" aria-labelledby="ob-ref-title">'+
 '<div class="ob-ref-header"><div><small>QUICK REFERENCE · KALI SIM LAB</small>'+
 '<h2 id="ob-ref-title">아이콘별 기능 한눈에 보기</h2>'+
 '<p>어떤 기능인지 기억나지 않으면 상단의 ⓘ 아이콘으로 다시 열어볼 수 있어요.</p></div>'+
 '<button type="button" id="ob-ref-x" aria-label="팝업 닫기">×</button></div>'+
 '<div class="ob-ref-list" id="ob-ref-list"></div>'+
 '<footer class="ob-ref-footer"><span>실제 Kali Linux가 아닌 교육용 가상 환경이에요.</span>'+
 '<button type="button" id="ob-ref-done">튜토리얼 완료 · 실습 시작</button></footer>'+
 '</section>';
$('desktop').append(el);
for(const [icon,name,desc] of items){
 const row=document.createElement('div');row.className='ob-ref-item';
 const glyph=document.createElement('span');glyph.className='ob-ref-glyph';glyph.textContent=icon;glyph.setAttribute('aria-hidden','true');
 const content=document.createElement('div'),title=document.createElement('strong'),info=document.createElement('p');
 title.textContent=name;info.textContent=desc;content.append(title,info);row.append(glyph,content);
 $('ob-ref-list').append(row);
}
const btn=document.createElement('button');btn.id='onboard-icons';btn.type='button';btn.className='panel-item';
btn.title='아이콘별 기능 한눈에 보기';btn.innerHTML='<span aria-hidden="true">ⓘ</span><span class="ob-help-label">아이콘</span>';
const restart=$('onboard-restart');restart.parentElement.insertBefore(btn,restart.nextSibling);
const menu=$('onboard-menu-entry')?.parentElement;
if(menu){
 const m=document.createElement('button');m.id='onboard-menu-icons';m.type='button';
 m.dataset.groups='favorites all';m.dataset.appName='icon reference kali quick help icons 아이콘 안내';
 m.textContent='ⓘ Icon Quick Reference';m.addEventListener('click',()=>open(false));menu.append(m);
}
let finishing=false;
function open(asFinal){
 if($('power-layer')&&!$('power-layer').hidden)return;
 finishing=!!asFinal;el.hidden=false;
 $('ob-ref-done').textContent=asFinal?'튜토리얼 완료 · 실습 시작':'닫기 · 데스크톱으로 돌아가기';
 $('ob-ref-done').focus({preventScroll:true});
}
function close(){
 if(el.hidden)return;
 const wasFinal=finishing;finishing=false;el.hidden=true;
 if(wasFinal)document.dispatchEvent(new Event('kali-sim:tour-finished'));
}
btn.addEventListener('click',()=>open(false));
$('ob-ref-x').addEventListener('click',close);
$('ob-ref-done').addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el.hidden){e.preventDefault();close()}});
document.addEventListener('kali-sim:tour-completion',()=>open(true));
document.addEventListener('kali-sim:tour-started',()=>{finishing=false;el.hidden=true});
document.addEventListener('kali-sim:shutdown',()=>{finishing=false;el.hidden=true});
window.KaliTourReference={open:()=>open(false),get count(){return items.length}};
})();
