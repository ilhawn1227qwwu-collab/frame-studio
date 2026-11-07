
/* KALI SIM LAB: deterministic, local-only fictional radio world.
   This is NOT a wireless driver, capture engine, or WPA cryptographic verifier. */
(()=>{'use strict';
const KEY='kali-sim-radio-world-v1';
const defaults=()=>({
 ap:{ssid:'LAB-TRAINING',bssid:'02:1A:11:20:26:01',channel:6,security:'WPA2-PSK',psk:'coffee2026',online:true,signal:76},
 guest:{ssid:'CAMPUS-GUEST',bssid:'02:1A:11:20:26:02',channel:1,security:'WPA2-PSK',signal:58},
 secure:{ssid:'LAB-SECURE',bssid:'02:1A:11:20:26:03',channel:11,security:'WPA3-SAE',signal:88},
 client:{present:true,connected:true,attempts:0,lastEvent:0},
 radio:{monitor:false,observationSince:0,handshakeConsumed:0},
 capture:null,
 events:[], version:1
});
function load(){
 let data=defaults();
 try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o&&o.version===1&&o.ap&&o.client&&o.radio){
 data={...data,...o,ap:{...data.ap,...o.ap},client:{...data.client,...o.client},radio:{...data.radio,...o.radio}};
 }}catch(_){}
 return data;
}
let world=load();
function store(){try{localStorage.setItem(KEY,JSON.stringify(world))}catch(_){}}
function emit(kind,message){world.events.unshift({kind,message,time:Date.now()});world.events=world.events.slice(0,35);store();document.dispatchEvent(new CustomEvent('kali-sim:network-changed',{detail:{kind,message}}))}
function copy(){return JSON.parse(JSON.stringify(world))}
function isValidChannel(v){return [1,6,11].includes(Number(v))}
const api={
 snapshot:copy, get ap(){return {...world.ap}},get client(){return {...world.client}},get radio(){return {...world.radio}},
 get capture(){return world.capture?{...world.capture}:null},
 networks(){
  return [world.ap.online?{...world.ap,note:'허가된 가상 실습 대상'}:null,
   {...world.guest,note:'비교용 가상 네트워크'},
   {...world.secure,note:'비교용 가상 네트워크'}].filter(Boolean);
 },
 setDemoPassword(password){
  const allowed=['coffee2026','password123','summer2026','not-in-dictionary'];
  if(!allowed.includes(password))return {ok:false,message:'허용된 교육용 시나리오 암호를 선택하세요.'};
  if(world.ap.security!=='WPA2-PSK')return {ok:false,message:'WPA3-SAE에서는 이 약한 암호 시나리오를 변경할 수 없어요.'};
  world.ap.psk=password;world.capture=null;world.client.connected=false;
  emit('password','학습용 Wi-Fi 암호가 변경됐어요. 이전 캡처와 접속 상태가 무효화됐습니다.');
  return {ok:true,message:'가상 암호 변경 완료. 초기 네트워크 연결부터 다시 살펴보세요.'};
 },
 setChannel(channel){
  if(!isValidChannel(channel))return {ok:false,message:'가상 채널은 1, 6, 11 중에서 고를 수 있어요.'};
  world.ap.channel=Number(channel);world.capture=null;world.radio.handshakeConsumed=world.client.lastEvent;
  emit('channel','LAB-TRAINING 가상 채널이 '+channel+'로 변경됐어요.');
  return {ok:true,message:'채널 변경: '+channel};
 },
 setOnline(on){
  world.ap.online=!!on;
  if(!on){world.client.connected=false;world.capture=null;}
  emit('ap',world.ap.online?'가상 공유기가 켜졌어요.':'가상 공유기가 꺼졌어요. 네트워크 목록에서 사라져요.');
  return {ok:true};
 },
 setClientPresent(present){
  world.client.present=!!present;
  if(!present)world.client.connected=false;
  emit('client',present?'연습용 클라이언트가 준비됐어요.':'연습용 클라이언트를 분리했어요.');
 },
 monitorStart(){world.radio.monitor=true;world.radio.observationSince=world.client.lastEvent;world.capture=null;emit('radio','가상 wlan0mon 관찰 모드를 시작했어요.');},
 monitorStop(){world.radio.monitor=false;emit('radio','관리 모드로 돌아왔어요. 기존 가상 캡처 파일은 유지돼요.');},
 reconnect(){
  if(!world.ap.online)return {ok:false,message:'공유기가 꺼져 있어 클라이언트를 연결할 수 없어요.'};
  if(!world.client.present)return {ok:false,message:'가상 클라이언트가 연결 대상에 없어요. 클라이언트를 먼저 켜세요.'};
  world.client.connected=true;world.client.attempts+=1;world.client.lastEvent+=1;
  emit('auth','가상 클라이언트 인증 교환 이벤트 #'+world.client.lastEvent+' 생성');
  return {ok:true,message:world.ap.security==='WPA2-PSK'?
   '연습용 클라이언트가 재연결했어요. 교육용 인증 교환 이벤트가 생겼습니다.':
   'WPA3-SAE 환경에서 가상 클라이언트가 재연결했습니다. 이 WPA2 전용 캡처 실습에는 사용할 수 없습니다.'};
 },
 captureFixture({bssid,channel,filename}){
  if(!world.ap.online)return {ok:false,message:'AP가 꺼져 있어 실습 패킷 예제를 만들 수 없어요.'};
  if(!world.radio.monitor)return {ok:false,message:'wlan0mon 관찰 모드가 활성화되지 않았어요.'};
  if(world.ap.security!=='WPA2-PSK')return {ok:false,message:'이 예제는 WPA2-PSK 전용입니다. 현재는 '+world.ap.security+'입니다.'};
  if(String(bssid).toUpperCase()!==world.ap.bssid.toUpperCase())
    return {ok:false,message:'BSSID가 다릅니다. 관찰 결과에서 대상 접속 지점 식별자를 확인하세요.'};
  if(Number(channel)!==world.ap.channel)
    return {ok:false,message:'채널이 다릅니다. 현재 가상 AP는 채널 '+world.ap.channel+'을 사용합니다.'};
  if(filename!=='labcap')return {ok:false,message:'실습용 저장 이름은 labcap입니다.'};
  if(world.client.lastEvent<=Math.max(world.radio.observationSince,world.radio.handshakeConsumed))
    return {ok:false,message:'아직 관찰 중 생성된 인증 교환 이벤트가 없어요. Network 창에서 「클라이언트 재연결」을 눌러 보세요.'};
  world.radio.handshakeConsumed=world.client.lastEvent;
  world.capture={file:'labcap-01.cap',event:world.client.lastEvent,channel:world.ap.channel,bssid:world.ap.bssid,pskAtCapture:world.ap.psk,security:world.ap.security,created:Date.now()};
  emit('capture','가상 인증 교환 예제를 labcap-01.cap에 기록했습니다.');
  return {ok:true,message:'학습용 인증 교환 이벤트 #'+world.capture.event+'가 캡처 예제에 반영됐어요.'};
 },
 auditCandidate(word){
  if(!world.capture)return {ok:false,message:'먼저 가상 캡처 예제를 준비하세요.'};
  // Illustrative string comparison ONLY. This is NOT a WPA2 verifier.
  return {ok:true,matched:String(word)===world.capture.pskAtCapture};
 },
 connect(password){
  if(world.radio.monitor)return {ok:false,message:'관찰 모드에서는 일반 연결을 사용할 수 없어요.'};
  if(!world.ap.online)return {ok:false,message:'공유기가 꺼져 있어 연결할 수 없어요.'};
  if(String(password)!==world.ap.psk)return {ok:false,message:'인증 실패: 가상 Wi-Fi 암호가 현재 공유기 설정과 달라요.'};
  world.client.connected=true;emit('connect','가상 wlan0가 LAB-TRAINING에 연결됐어요.');
  return {ok:true,message:'가상 연결 성공 (실제 네트워크 접속 없음)'};
 },
 harden(password){
  if(String(password).length<16)return {ok:false,message:'가상 암호는 16자 이상이어야 합니다.'};
  world.ap.psk=String(password);
  world.ap.security='WPA3-SAE';
  world.client.connected=false;
  world.capture=null;
  emit('harden','WPA3-SAE 전환: 이전 캡처는 유효하지 않으며 클라이언트 연결이 해제됐어요.');
  return {ok:true,message:'가상 공유기 보안 설정이 갱신됐어요.'};
 },
 reset(){
  world=defaults();store();document.dispatchEvent(new CustomEvent('kali-sim:network-changed',{detail:{kind:'reset',message:'가상 네트워크를 초기화했습니다.'}}));
 },
 restoreFromLegacy({monitor=false,protocol,connected=false,hardened=false}){
  // One-time migration only. Never overwrite the newer radio-world settings on reload.
  let alreadySaved=false;
  try{alreadySaved=localStorage.getItem(KEY)!==null}catch(_){}
  if(alreadySaved)return;
  if(protocol==='WPA3-SAE'||hardened){
   world.ap.security='WPA3-SAE';
   if(world.ap.psk==='coffee2026')world.ap.psk='River-Maple-Sky-Cloud-84';
  }
  if(monitor)world.radio.monitor=true;
  if(connected)world.client.connected=true;
  store();
 }
};
window.KaliNetwork=api;
})();
