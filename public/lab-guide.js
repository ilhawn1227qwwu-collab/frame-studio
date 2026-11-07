
/* Self-contained nine-step learning companion: education-only simulation. */
(()=>{'use strict';
const $=id=>document.getElementById(id), order=['iface','wifi','monitor','survey','capture','audit','managed','connect','verify'];
const lessons={
iface:['먼저 무선 장치를 확인해 볼까요?','와이파이를 찾거나 연결하려면 컴퓨터가 쓸 수 있는 네트워크 장치부터 알아야겠죠? 아직 Wi-Fi에 연결할 필요는 없어요.','네트워크 인터페이스 목록에서 wlan0를 찾아보세요.','ip a','이곳의 wlan0는 실제 기기가 아니라 가상 장치예요.'],
wifi:['이제 실습할 와이파이를 찾아봐요.','장치를 확인했으니 어떤 무선 네트워크가 보이는지 살펴봐야겠죠? 우리에게 허가된 학습 대상은 LAB-TRAINING이에요.','SSID(네트워크 이름)와 보안 방식 열을 확인하세요.','nmcli dev wifi list','목록을 조회하는 것과 연결하는 것은 서로 다른 일이에요.'],
monitor:['관찰하려면 다른 작동 방식이 필요해요.','일반적인 Wi-Fi 접속은 관리(Managed) 모드에서 해요. 무선 프레임 관찰 실습은 별도의 모니터(Monitor) 모드를 활용하기도 해요.','가상 어댑터를 관찰용 모드로 전환해 보세요.','sudo airmon-ng start wlan0','모든 Wi-Fi 연결에 모니터 모드가 필요한 건 아니에요. 이곳에서는 상태만 가상으로 바꿔요.'],
survey:['이번에는 대상 네트워크를 관찰해 봐요.','네트워크가 여러 개 보이네요! 허가된 대상의 식별자 BSSID와 채널을 확인하면 특정 접속 지점을 구별할 수 있어요.','가상 네트워크 목록에서 LAB-TRAINING을 찾아보세요.','sudo airodump-ng wlan0mon','보이는 목록과 신호는 미리 정해진 예시이며 실제 전파를 읽지 않아요.'],
capture:['암호 점검용 예시 자료를 준비해요.','무선 보안을 검사하려면 인증에 관한 자료가 필요해요. 하지만 여기서는 실제 데이터를 수집하지 않고 미리 준비된 가상 인증 교환 기록만 사용해요.','NetworkManager의 「가상 클라이언트 재연결」 버튼을 눌러 교육용 인증 교환 이벤트를 만들어요. 그다음 BSSID와 채널을 지정해 예제 파일을 준비해 보세요.','sudo airodump-ng --bssid 02:1A:11:20:26:01 -c 6 -w labcap wlan0mon','관찰 모드에서 클라이언트가 새로 연결되어야 모의 캡처가 성공해요. 실제 패킷을 수집하지는 않아요.'],
audit:['비밀번호가 약한지 살펴볼까요?','사전에 적힌 흔한 비밀번호 후보를 비교해 취약한 암호가 왜 위험한지 확인하는 단계예요.','학습용 사전과 가상 캡처 파일로 암호 강도를 점검해 보세요.','aircrack-ng -w /usr/share/wordlists/lab-demo.txt labcap-01.cap','실제 WPA2 암호학적 검증이 아니라 정해진 예시를 비교하는 시뮬레이션이에요.'],
managed:['이제 연결할 수 있도록 되돌려 봐요.','아까는 관찰용 모드를 썼죠? 평범하게 Wi-Fi에 접속하려면 가상 장치를 다시 관리(Managed) 모드로 돌려놓아야 해요.','관찰용 모드를 종료해 보세요.','sudo airmon-ng stop wlan0mon','관찰 단계와 일반 접속 단계가 구분된다는 점을 기억하세요.'],
connect:['찾았으니 이번엔 연결해 볼까요?','네트워크를 찾는 것과 접속하는 건 달라요. 이제 학습용 암호를 사용해서 접속하는 과정을 재현해 볼게요.','가상 LAB-TRAINING에 연결해 보세요.','nmcli dev wifi connect LAB-TRAINING password coffee2026 ifname wlan0','실제 인터넷이나 주변 Wi-Fi에 연결되는 것은 아니에요.'],
verify:['이번엔 해킹이 아니라 방어해 봅시다!','취약한 설정을 발견했다면 이제 고쳐야겠죠? 교육용 Router Admin에서 WPA3-SAE와 강한 암호를 설정하고 다시 확인해 보세요.','Router Admin을 열어 설정을 강화한 후 검사 명령을 실행하세요.','open router\nlab-verify LAB-TRAINING','Wi-Fi 비밀번호를 아는 것과 공유기 관리자 권한을 얻는 것은 별개예요.'],
finished:['모든 보안 실습을 마쳤어요!','장치 확인, 네트워크 탐색, 학습용 암호 점검, 가상 접속, 보안 강화까지 진행했어요. 이제 각 단계를 왜 했는지 설명해 볼까요?','원하면 학습 노트를 읽거나 실습을 초기화해 다시 연습해 보세요.','help','실제 무선 네트워크를 공격하지 않는 교육용 실험실이에요.']
};
const mission=$('mission'),content=mission?.querySelector('.mission-content');if(!content)return;
const guide=document.createElement('section');guide.className='lab-guide lab-guide-mission';guide.id='lab-guide';
guide.setAttribute('aria-label','현재 실습 단계 안내');
guide.innerHTML='<div class="lg-heading"><span class="lg-kicker">학습 안내 · 지금 해야 할 일</span><span id="lg-number" class="lg-number"></span></div>'+
'<div class="lg-content"><h3 class="lg-title" id="lg-title"></h3><p class="lg-message" id="lg-message"></p>'+
'<div class="lg-do"><strong>이제 해봅시다</strong><div id="lg-do"></div><code class="lg-command" id="lg-command"></code></div>'+
'<p class="lg-safety" id="lg-note"></p><div class="lg-footer"><button type="button" id="lg-notes">학습 노트 열기</button><span class="lg-counter" id="lg-counter"></span></div></div>';
const progBar=content.querySelector('.progress');if(progBar)progBar.after(guide);else content.prepend(guide);
const mobile=document.createElement('div');mobile.className='lab-mobile-guide';mobile.id='lab-mobile-guide';
mobile.innerHTML='<button type="button" class="lg-mobile-toggle" id="lg-mobile-toggle" aria-expanded="false" aria-controls="lg-mobile-body">'+
'<span class="lg-mobile-index" id="lg-mobile-index"></span><span class="lg-mobile-title" id="lg-mobile-title"></span><span class="lg-mobile-arrow" id="lg-mobile-arrow">▼</span></button>'+
'<div class="lg-mobile-body" id="lg-mobile-body" hidden><p id="lg-mobile-message"></p><p id="lg-mobile-do"></p><code id="lg-mobile-command"></code><small id="lg-mobile-note"></small><div><button type="button" id="lg-mobile-notes">학습 노트 열기</button></div></div>';
const tBody=$('terminal')?.querySelector('.terminal-body');if(tBody)tBody.prepend(mobile);
let current='iface',doneCount=0,booted=false,tourActive=false;
let expanded=false;
function notes(){
 const b=document.querySelector('.desktop-shortcuts [data-open="guide"]');if(b)b.click();
 if(innerWidth<=760)mission.classList.remove('show');
}
$('lg-notes').addEventListener('click',notes);$('lg-mobile-notes').addEventListener('click',notes);
$('lg-mobile-toggle').addEventListener('click',()=>{
 expanded=!expanded;$('lg-mobile-body').hidden=!expanded;
 $('lg-mobile-toggle').setAttribute('aria-expanded',String(expanded));
 $('lg-mobile-arrow').textContent=expanded?'▲':'▼';
});
function showAllowed(){
 const activeIntro=$('onboard-root');
 return booted&&!tourActive&&$('power-layer').hidden&&(!activeIntro||activeIntro.hidden);
}
function visibility(){
 const visible=showAllowed();
 guide.hidden=!visible;mobile.hidden=!visible;
 mission.classList.toggle('lab-guide-ready',visible);
}
function render(){
 const v=[...(lessons[current]||lessons.iface)];
 const net=window.KaliNetwork;
 if(net&&current==='capture')v[3]='sudo airodump-ng --bssid '+net.ap.bssid+' -c '+net.ap.channel+' -w labcap wlan0mon';
 if(net&&current==='connect')v[3]='nmcli dev wifi connect LAB-TRAINING password '+net.ap.psk+' ifname wlan0';
 const index=current==='finished'?'9 / 9':String(doneCount+1)+' / 9';
 $('lg-number').textContent=index;$('lg-title').textContent=v[0];$('lg-message').textContent=v[1];
 $('lg-do').textContent=v[2];$('lg-command').textContent=v[3];$('lg-note').textContent=v[4];
 $('lg-counter').textContent='진행률 '+doneCount+'/9';
 $('lg-mobile-index').textContent=index;$('lg-mobile-title').textContent=v[0];$('lg-mobile-message').textContent=v[1];
 $('lg-mobile-do').textContent=v[2];$('lg-mobile-command').textContent=v[3];$('lg-mobile-note').textContent=v[4];
 expanded=false;$('lg-mobile-body').hidden=true;$('lg-mobile-arrow').textContent='▼';
 $('lg-mobile-toggle').setAttribute('aria-expanded','false');visibility();
}
document.addEventListener('kali-sim:lab-progress',e=>{
 const data=e.detail||{};
 doneCount=Number.isInteger(data.doneCount)?data.doneCount:doneCount;
 current=(data.nextId&&lessons[data.nextId])?data.nextId:(doneCount===9?'finished':order[doneCount]||'iface');
 render();
});
document.addEventListener('kali-sim:booted',()=>{booted=true;setTimeout(visibility,210)});
document.addEventListener('kali-sim:shutdown',()=>{booted=false;visibility()});
document.addEventListener('kali-sim:tour-started',()=>{tourActive=true;visibility()});
document.addEventListener('kali-sim:tour-ended',()=>{tourActive=false;visibility()});
const item=document.querySelector('#steps .step.current .step-index');
const n=item?Number.parseInt(item.textContent,10):10;
doneCount=Number.isFinite(n)?Math.min(9,Math.max(0,n-1)):9;
current=order[doneCount]||'finished';render();
})();
