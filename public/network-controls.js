
/* User-operated controls for fictional AP and synthetic client events. */
(()=>{'use strict';
const NET=window.KaliNetwork,by=id=>document.getElementById(id);
if(!NET||!by('wifi'))return;
const body=by('wifi').querySelector('.window-body');
const node=document.createElement('details');node.className='sim-radio';node.id='sim-radio';
// Keep controls available by default for existing users and lab flows.
// The tutorial temporarily collapses this panel while teaching the Wi-Fi Info button.
node.open=true;
node.innerHTML='<summary>가상 네트워크 제어 · 공유기와 클라이언트</summary>'+
'<div class="sim-radio-body">'+
'<div class="sim-fields">'+
'<label><input id="sim-ap-power" type="checkbox">LAB-TRAINING 전원</label>'+
'<label><input id="sim-client-present" type="checkbox">연습용 클라이언트 준비</label>'+
'<label class="sim-stack">가상 AP 채널<select id="sim-channel"><option value="1">CH 1</option><option value="6">CH 6</option><option value="11">CH 11</option></select></label>'+
'<label class="sim-stack">연습용 암호 시나리오<select id="sim-weakpass">'+
'<option value="coffee2026">coffee2026 (목록에 있음)</option>'+
'<option value="summer2026">summer2026 (목록에 있음)</option>'+
'<option value="password123">password123 (목록에 있음)</option>'+
'<option value="not-in-dictionary">not-in-dictionary (목록에 없음)</option>'+
'</select></label></div>'+
'<div class="sim-actions"><button type="button" id="sim-reconnect">연습용 클라이언트 재연결 · 인증 이벤트 만들기</button></div>'+
'<div class="sim-fields"><label class="sim-stack" for="sim-station-pass">Kali PC 접속 암호 (WPA3 전환 후 새 암호)<input id="sim-station-pass" type="password" autocomplete="off" placeholder="가상 Wi-Fi 암호 입력"></label>'+
'<div class="sim-actions"><button type="button" id="sim-station-connect">Kali PC 연결하기</button></div></div>'+
'<div id="sim-net-state" class="sim-state"></div><div role="status" id="sim-feedback"></div>'+
'<div class="sim-disclaimer">이 컨트롤은 허구의 Wi-Fi와 클라이언트 상태만 바꿉니다. 실제 무선 신호, 기기, 패킷에 접근하지 않습니다. 이 실습에서 「캡처」는 인증 이벤트를 바탕으로 모의 자료를 준비하는 것입니다.</div></div>';
const list=by('nets');list.before(node);
function render(){
 const ap=NET.ap,client=NET.client,radio=NET.radio;
 by('sim-ap-power').checked=ap.online;
 by('sim-client-present').checked=client.present;
 by('sim-channel').value=String(ap.channel);
 by('sim-weakpass').value=['coffee2026','summer2026','password123','not-in-dictionary'].includes(ap.psk)?ap.psk:'coffee2026';
 by('sim-weakpass').disabled=ap.security!=='WPA2-PSK';
 by('sim-net-state').textContent=
  'AP: '+(ap.online?'ON':'OFF')+' | '+ap.security+' | CH '+ap.channel+
  '\n클라이언트: '+(client.present?(client.connected?'CONNECTED':'READY'):'UNAVAILABLE')+
  ' | 인증 이벤트 #'+client.lastEvent+
  '\nKali PC: '+(NET.station.connected?'CONNECTED':'DISCONNECTED')+
  '\n어댑터: '+(radio.monitor?'MONITOR (SIM)':'MANAGED (SIM)')+
  ' | 캡처 예제: '+(NET.capture?'READY':'없음');
}
function feedback(result){
 by('sim-feedback').textContent=result?.message||'가상 환경 상태가 변경됐어요.';
 render();
}
by('sim-ap-power').addEventListener('change',e=>feedback(NET.setOnline(e.target.checked)));
by('sim-client-present').addEventListener('change',e=>{NET.setClientPresent(e.target.checked);feedback({message:e.target.checked?'클라이언트 준비 완료.':'클라이언트가 분리됐어요.'})});
by('sim-channel').addEventListener('change',e=>feedback(NET.setChannel(Number(e.target.value))));
by('sim-weakpass').addEventListener('change',e=>feedback(NET.setDemoPassword(e.target.value)));
by('sim-reconnect').addEventListener('click',()=>feedback(NET.reconnect()));
by('sim-station-connect').addEventListener('click',()=>{
 const input=by('sim-station-pass');
 const result=NET.connect(input.value);
 input.value='';
 feedback(result);
});
document.addEventListener('kali-sim:network-changed',render);
render();
})();
