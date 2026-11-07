
/* Shared, offline, deterministic virtual LAN. The entire topology, HTTP stack,
 * service state and incident evidence are fictional. No fetch(), sockets, host access. */
(()=>{'use strict';
const KEY='kali-sim-lan-v1';
const seedLogs=[
 'Nov 07 13:08:10 web01 sshd[110]: Failed password for guest from 192.0.2.77 port 52001 ssh2',
 'Nov 07 13:08:13 web01 sshd[111]: Failed password for guest from 192.0.2.77 port 52002 ssh2',
 'Nov 07 13:08:15 web01 sshd[112]: Failed password for guest from 192.0.2.77 port 52003 ssh2',
 'Nov 07 13:09:22 web01 sshd[122]: Accepted password for kali from 192.0.2.20 port 52115 ssh2'
];
const steps=[
 ['게이트웨이 확인','먼저 연결된 네트워크의 출구가 정상인지 확인해야겠죠?','ping 192.0.2.1','네트워크 지도에서 공유기의 상태도 확인해 보세요.'],
 ['웹 장애 확인','웹 서버가 응답하는지 HTTP 상태 코드를 확인해 봐요.','curl -I http://training.lab','503은 서버가 일시적으로 요청을 처리하지 못한다는 뜻이에요.'],
 ['인증 로그 조사','반복된 로그인 실패가 있는지, 출처와 시간을 확인해 봅시다.','grep "Failed password" /var/log/auth.log','실패 기록만으로 침입 성공을 단정할 수는 없어요.'],
 ['서비스 복구','원인을 살폈으니 가상 웹 서비스를 재시작해 보죠.','sudo service lab-web restart','이 명령은 오직 가상 서버 내부의 서비스 상태만 변경해요.'],
 ['브라우저에서 재확인','웹 서비스가 복구됐다면 브라우저에서도 직접 확인해야겠죠?','Firefox SIM에서 http://training.lab 열기','데스크톱의 Firefox SIM 아이콘을 사용해 보세요.'],
 ['웹 설정 보안 점검','서비스는 복구됐지만 보안 설정이 충분한지 점검해야 해요.','web-audit demo.lab','지금은 진단한 상태이지 아직 모두 고친 것은 아니에요.'],
 ['취약 설정 개선','보안 헤더, 관리자 접근 통제, HTML 출력 처리 세 항목을 모두 수정해 봅시다.','web-fix headers\nweb-fix access\nweb-fix output','세 설정이 모두 적용되어야 검증할 수 있어요.'],
 ['최종 보고와 검증','정상 작동과 보안 개선을 확인한 다음, 조사한 근거를 보고서로 남겨 볼까요?','incident-report','보고서에는 관찰한 증거와 조치 결과가 함께 기록돼요.']
];
const init=()=>({version:2,web:{hostOnline:true,running:true,headers:false,access:false,output:false},shell:{host:'kali',user:'kali',cwd:'/home/kali'},
 logs:seedLogs.slice(),events:[{when:'13:09',message:'가상 환경 준비됨'}],
 mission:{started:false,flags:{gateway:false,outage:false,logs:false,restart:false,browser:false,audit:false,secured:false,report:false},report:''}
});
let state=init();
try{
 const v=JSON.parse(localStorage.getItem(KEY)||'null');
 if(v&&[1,2].includes(v.version)&&v.web&&v.mission){
  state={...init(),...v,version:2,web:{...init().web,...v.web},shell:{host:'kali',user:'kali',cwd:'/home/kali'},mission:{...init().mission,...v.mission,flags:{...init().mission.flags,...v.mission.flags}}};
  if(!Array.isArray(state.logs))state.logs=seedLogs.slice();
  if(!Array.isArray(state.events))state.events=[];
 }
}catch(_){}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}}
function changed(type,message=''){
 if(message){state.events.unshift({when:new Date().toTimeString().slice(0,5),message});state.events=state.events.slice(0,30)}
 persist();document.dispatchEvent(new CustomEvent('kali-sim:lan-changed',{detail:{type,message}}));
}
function net(){return window.KaliNetwork}
function hostOnline(){return !!state.web.hostOnline}
function isRemote(){return state.shell.host==='web01'}
function localHint(){return {ok:false,reason:'location',lines:['lab-web는 Kali PC가 아닌 192.0.2.20 서버에 있어요.','ssh trainee@192.0.2.20으로 가상 서버에 접속해 보세요.']}}
function fail(reason,message,help){return {ok:false,reason,lines:[message,...(help?[help]:[])]}}
function link(){
 const n=net();
 return !!(n&&n.ap.online&&n.station.connected&&!n.radio.monitor);
}
function issues(){return [
 ...(!state.web.headers?['X-Content-Type-Options 및 CSP 보안 헤더 없음']:[]),
 ...(!state.web.access?['관리자 경로 접근 제어 미설정']:[]),
 ...(!state.web.output?['사용자 입력 출력 처리 미설정']:[])
]}
function progress(){
 const flags=state.mission.flags;
 const keys=['gateway','outage','logs','restart','browser','audit','secured','report'];
 const count=keys.filter(x=>flags[x]).length;
 const nextIndex=keys.findIndex(x=>!flags[x]);
 return {count,total:keys.length,index:nextIndex<0?keys.length:nextIndex,steps:steps.map(([title,desc,command,hint],i)=>({title,desc,command,hint,done:!!flags[keys[i]]})),started:!!state.mission.started,complete:!!flags.report};
}
function flag(key){
 if(!state.mission.started||state.mission.flags[key])return;
 state.mission.flags[key]=true;
 changed('mission',key+' 목표를 달성했습니다.');
}
function snapshot(){return JSON.parse(JSON.stringify({...state,progress:progress(),devices:devices()}))}
function devices(){
 const n=net(),on=!!n?.ap.online,connected=link();
 return [
  {id:'kali',name:'Kali Workstation',ip:'192.0.2.10',type:'workstation',online:true,detail:connected?'가상 LAN 연결됨':'가상 LAN 연결 안 됨'},
  {id:'router',name:'Lab Router',ip:'192.0.2.1',type:'router',online:on,detail:on?'게이트웨이 동작 중':'가상 AP 꺼짐'},
  {id:'web',name:'Web Server',ip:'192.0.2.20',type:'server',online:hostOnline(),reachable:on&&hostOnline(),service:hostOnline()?(state.web.running?'RUNNING':'STOPPED'):'UNAVAILABLE',detail:!hostOnline()?'서버 전원 OFF':!on?'공유기 연결 끊김':state.web.running?'서버 온라인 · HTTP 서비스 정상':'서버 온라인 · HTTP 서비스 중단 (503)'},
  {id:'log',name:'Log Server',ip:'192.0.2.30',type:'server',online:on,detail:'학습용 인증 로그 보관'}
 ]
}
function urlParts(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='http:'||!['training.lab','demo.lab','192.0.2.20'].includes(u.hostname))return null;
  return {hostname:u.hostname,path:u.pathname,search:u.search};
 }catch(_){return null}
}
function request(raw,{head=false,browser=false}={}){
 const p=urlParts(raw);
 if(!p)return {ok:false,status:0,heading:'주소를 확인하세요',message:'가상 브라우저는 training.lab, demo.lab, 192.0.2.20만 지원합니다. 외부 인터넷 요청은 하지 않습니다.',headers:[],body:[]};
 if(!link())return {ok:false,status:0,heading:'연결할 수 없습니다',message:'가상 네트워크 연결이 없습니다. 공유기 전원과 클라이언트 상태를 확인하세요.',headers:[],body:[]};
 if(!hostOnline())return {ok:false,status:0,heading:'서버에 연결할 수 없습니다',message:'가상 웹 서버 전원이 꺼져 TCP 연결을 맺을 수 없어요.',headers:[],body:[]};
 if(!state.web.running){
  if(head&&p.hostname==='training.lab')flag('outage');
  return {ok:true,status:503,heading:'503 Service Unavailable',message:'가상 lab-web 서비스가 중지되어 있습니다.',headers:['HTTP/1.1 503 Service Unavailable','Server: training-lab (SIM)','Retry-After: 30'],body:['현재 웹 서비스를 사용할 수 없습니다.','서버의 서비스 상태를 확인하세요.']}
 }
 const access=p.path.startsWith('/admin');
 if(access&&state.web.access)return {ok:true,status:403,heading:'403 Forbidden',message:'역할 기반 접근 통제로 관리 기능을 보호합니다.',headers:['HTTP/1.1 403 Forbidden'],body:['관리자 권한이 없어 접근이 거부됐습니다.']};
 if(!['/','/health','/admin','/status'].includes(p.path))
  return {ok:true,status:404,heading:'404 Not Found',message:'해당 가상 경로가 존재하지 않습니다.',headers:['HTTP/1.1 404 Not Found'],body:[]};
 const headers=['HTTP/1.1 200 OK','Content-Type: text/html; charset=utf-8','Server: training-lab (SIM)'];
 if(state.web.headers)headers.push('X-Content-Type-Options: nosniff',"Content-Security-Policy: default-src 'self'");
 let body;
 if(p.path==='/health')body=['STATUS: OK','web service: running'];
 else if(access)body=['관리자 전용 자료가 공개되어 있습니다.','학습용 예시: 접근 통제가 아직 설정되지 않았습니다.'];
 else if(p.path==='/status')body=['lab-web: running','HTTP: 200','보안 점검 항목: '+(3-issues().length)+'/3'];
 else body=['LAB-TRAINING INTRANET · DEMO WEB','사내 학습용 포털에 오신 것을 환영합니다.',state.web.output?'출력값은 HTML 문맥에 따라 이스케이프됩니다.':'출력 검증 미설정: 사용자 입력을 안전하게 처리하도록 개선하세요.'];
 if(browser&&p.hostname==='training.lab'&&p.path==='/')flag('browser');
 return {ok:true,status:200,heading:p.path==='/admin'?'관리자 페이지':p.path==='/health'?'서비스 상태':'Virtual Training Portal',message:'이 문서는 브라우저 안에서 생성한 가상 HTTP 응답입니다.',headers,body};
}
function missionStart(){
 state.web={hostOnline:true,running:false,headers:false,access:false,output:false};
 state.shell={host:'kali',user:'kali',cwd:'/home/kali'};
 state.mission={started:true,flags:{gateway:false,outage:false,logs:false,restart:false,browser:false,audit:false,secured:false,report:false},report:''};
 changed('mission-start','INCIDENT-001 시작: 가상 웹 서비스 중단과 인증 실패 로그 발생');
 return {ok:true,message:'INCIDENT-001이 시작되었습니다. 가상 웹 서비스는 중단(503) 상태입니다.'};
}
function resetMission(){state=init();changed('mission-reset','INCIDENT-001 및 가상 서버 상태 초기화');}
function setHostPower(on){
 state.web.hostOnline=!!on;
 if(!on)state.shell={host:'kali',user:'kali',cwd:'/home/kali'};
 changed('host-power','가상 웹 서버 전원이 '+(on?'켜졌어요.':'꺼졌어요. 원격 접속이 종료됩니다.'));
 return {ok:true,online:state.web.hostOnline};
}
function remoteLogin(cmd){
 if(!link())return fail('network','Kali PC의 가상 Wi-Fi가 연결되지 않았어요.','NetworkManager에서 Kali PC 연결 상태를 확인하세요.');
 if(!hostOnline())return fail('host','가상 웹 서버 전원이 꺼져 있어 SSH 연결이 불가능해요.','Network Map에서 가상 서버를 켜세요.');
 const match=cmd.match(/^ssh\s+([^\s@]+)@([^\s]+)$/);
 if(!match)return fail('syntax','사용법: ssh trainee@192.0.2.20','등록된 가상 학습 키로 로그인하는 모형이에요.');
 if(!['192.0.2.20','web01','training.lab'].includes(match[2]))return fail('target','허가된 연습용 서버가 아닙니다.','192.0.2.20으로 연결하세요.');
 if(match[1]!=='trainee')return fail('permission','이 계정은 로그인할 수 없어요.','교육용 계정 trainee를 사용하세요.');
 state.shell={host:'web01',user:'trainee',cwd:'/home/trainee'};
 changed('ssh','가상 실습 키로 trainee@web01에 로그인');
 return {ok:true,lines:['[SIM] trainee@web01 (192.0.2.20) 로그인 성공','등록된 교육용 가상 키 인증을 모의했습니다. 실제 SSH 연결은 수행하지 않아요.','종료하려면 exit를 입력하세요.']};
}
function remoteLogout(){
 if(!isRemote())return fail('location','지금은 Kali PC에 있습니다.','먼저 ssh trainee@192.0.2.20으로 접속하세요.');
 state.shell={host:'kali',user:'kali',cwd:'/home/kali'};
 changed('ssh','가상 SSH 세션 종료');
 return {ok:true,lines:['Connection to 192.0.2.20 closed.','Kali PC로 돌아왔어요.']};
}

function webFix(key){
 if(!['headers','access','output'].includes(key))return {ok:false,lines:['수정할 설정은 headers, access, output입니다.']};
 if(!isRemote())return localHint();
 if(!link())return fail('network','가상 네트워크가 끊겨 서버 설정을 바꿀 수 없어요.');
 if(!hostOnline())return fail('host','원격 웹 서버 전원이 꺼져 있어요.');
 if(!state.web.running)return {ok:false,lines:['lab-web 서비스가 중단된 상태입니다. 먼저 서비스를 복구하세요.']};
 state.web[key]=true;
 changed('web-fix','가상 웹 보안 설정 개선: '+key);
 if(issues().length===0&&state.mission.flags.audit)flag('secured');
 return {ok:true,lines:['가상 보안 설정을 적용했습니다: '+key,issues().length===0?'모든 보안 설정을 적용했습니다.':'남은 항목: '+issues().length]};
}
function logText(){return state.logs.join('\n')}
function report(){
 if(!state.mission.started)return {ok:false,lines:['먼저 Learning Center에서 INCIDENT-001을 시작하세요.']};
 const needed=['gateway','outage','logs','restart','browser','audit','secured'];
 const missing=needed.filter(k=>!state.mission.flags[k]);
 if(missing.length||!hostOnline()||!state.web.running||issues().length||!link())return {ok:false,lines:['최종 검증 실패: '+(missing.length?'미완료 '+missing.join(', ')+' / ':'')+(!link()?'현재 가상 네트워크가 연결되지 않았습니다. / ':'')+'서버와 보안 설정을 확인하세요.']};
 state.mission.report='INCIDENT-001 — Virtual Network Incident Report\n'+
 '환경: 192.0.2.0/24 (완전한 로컬 시뮬레이션)\n'+
 '초기 관찰: HTTP 503 서비스 장애, 192.0.2.77의 인증 실패 3회\n'+
 '조치: lab-web 서비스 재시작, 웹 브라우저 정상 응답 확인, 웹 보안 설정 3개 개선\n'+
 '최종 상태: HTTP 200, 취약 설정 0개\n'+
 '주의: 이 보고서는 가상 로그와 상황을 바탕으로 작성되었으며 실제 침입 여부를 입증하지 않습니다.';
 flag('report');
 return {ok:true,lines:[state.mission.report,'✓ INCIDENT-001 임무 완료']};
}
function command(raw){
 const cmd=String(raw||'').trim().replace(/\s+/g,' ');
 if(!cmd)return {ok:true,lines:[]};
 if(cmd==='help')return {ok:true,lines:[
  'KALI SIM LAB — Virtual LAN commands (NO OS / NO EXTERNAL NETWORK)',
  'ip a | ip route | ping 192.0.2.1 | ping 192.0.2.20 | ping 192.0.2.30',
  'nmcli dev wifi connect LAB-TRAINING password <training-passphrase> ifname wlan0',
  'nslookup training.lab | curl -I http://training.lab | curl http://training.lab',
  'curl -I http://demo.lab | web-audit demo.lab',
  'web-fix headers | web-fix access | web-fix output',
  'cat /var/log/auth.log | grep "Failed password" /var/log/auth.log',
  'ssh trainee@192.0.2.20 | whoami | hostname | exit',
  'sudo systemctl status lab-web | sudo systemctl restart lab-web (SSH 접속 필요)',
  'ss -tln | incident-status | incident-report'
 ]};
 if(cmd==='ssh'||cmd.startsWith('ssh '))return remoteLogin(cmd);
 if(cmd==='exit')return remoteLogout();
 if(cmd==='whoami')return {ok:true,lines:[state.shell.user]};
 if(cmd==='hostname')return {ok:true,lines:[state.shell.host==='web01'?'web01':'kali']};
 if(isRemote()&&(!hostOnline()||!link())){
  state.shell={host:'kali',user:'kali',cwd:'/home/kali'};persist();
  return fail('network','가상 서버 연결이 끊겼어요. Kali PC로 돌아왔습니다.');
 }
 if(cmd==='incident-status'){
  const p=progress();return {ok:true,lines:['INCIDENT-001 '+p.count+'/'+p.total+' · '+(p.started?'진행 중':'미시작'),...p.steps.map((s,i)=>(s.done?'[✓] ':'[ ] ')+(i+1)+'. '+s.title)]};
 }
 if(cmd==='incident-report')return report();
 if(/^nmcli dev wifi connect LAB-TRAINING password /i.test(cmd)){
  const match=cmd.match(/^nmcli dev wifi connect LAB-TRAINING password (?:"([^"]+)"|'([^']+)'|([^ ]+)) ifname wlan0$/i);
  if(!match)return {ok:false,lines:['사용법: nmcli dev wifi connect LAB-TRAINING password [학습용암호] ifname wlan0']};
  const r=net()?.connect(match[1]||match[2]||match[3]);
  return {ok:!!r?.ok,lines:[r?.message||'가상 네트워크 연결 실패']};
 }
 if(cmd==='ip a')return {ok:true,lines:['1: lo    inet 127.0.0.1/8','2: wlan0  [SIM] state '+(link()?'CONNECTED':'DISCONNECTED')]};
 if(cmd==='ip route')return {ok:true,lines:[link()?'default via 192.0.2.1 dev wlan0\n192.0.2.0/24 dev wlan0 scope link':'(현재 가상 LAN 기본 경로 없음)']};
 if(/^ping 192\.0\.2\.(1|20|30)$/.test(cmd)){
  const ip=cmd.split(' ')[1],on=link()&&((ip==='192.0.2.1')?!!net()?.ap.online:!!net()?.ap.online);
  if(!on)return {ok:false,lines:['Destination Host Unreachable (SIM). Network Manager에서 가상 연결을 확인하세요.']};
  if(ip==='192.0.2.1')flag('gateway');
  return {ok:true,lines:['PING '+ip+' (SIM)','3 packets transmitted, 3 received, 0% packet loss','ICMP 도달성과 웹 서비스의 정상 작동은 별개입니다.']};
 }
 if(cmd==='nslookup training.lab'||cmd==='nslookup demo.lab')return link()?
 {ok:true,lines:['Server: 192.0.2.1 (SIM)','Name: '+cmd.split(' ')[1],'Address: 192.0.2.20']}:
 {ok:false,lines:['DNS 서버에 도달할 수 없어요.']};
 if(cmd==='ss -tln')return {ok:true,lines:isRemote()?['State  Local Address:Port','LISTEN 0.0.0.0:22 (SSH SIM)',state.web.running?'LISTEN 0.0.0.0:80 (lab-web)':'CLOSED :80 (lab-web stopped)']:
 ['State  Local Address:Port','LISTEN 127.0.0.1:22 (Kali demo)','원격 서버의 포트는 SSH로 접속해서 살펴보세요.']};
 if(cmd==='curl -I http://training.lab'||cmd==='curl -I http://demo.lab'||cmd==='curl http://training.lab'||cmd==='curl http://demo.lab'||cmd==='curl -I http://training.lab/health'){
  const head=cmd.startsWith('curl -I '),url=cmd.slice(head?8:5);
  const r=request(url,{head});return {ok:r.ok,lines:head?r.headers:[...r.headers,'',...r.body],status:r.status};
 }
 if(cmd==='cat /var/log/auth.log'){if(!isRemote())return localHint();if(!link())return fail('network','연결이 끊겼어요.');flag('logs');return {ok:true,lines:[logText()]}}
 if(cmd==='grep "Failed password" /var/log/auth.log'||cmd==='grep Failed /var/log/auth.log'){
  if(!isRemote())return localHint();
  if(!link())return fail('network','연결이 끊겼어요.');
  flag('logs');return {ok:true,lines:[state.logs.filter(v=>v.includes('Failed password')).join('\n')]};
 }
 if(/^(sudo )?(systemctl|service) (restart|status) lab-web$/.test(cmd)){
  if(!isRemote())return localHint();
  if(!hostOnline())return fail('host','원격 서버 전원이 꺼져 있어 서비스를 제어할 수 없어요.');
  const match=cmd.match(/^(sudo )?(systemctl|service) (restart|status) lab-web$/);
  const sudo=!!match[1],action=match[3];
  if(action==='status')return {ok:true,lines:['lab-web.service [SIM]','Host: web01 ONLINE','Active: '+(state.web.running?'active (running)':'inactive (dead)')]};
  if(!sudo)return fail('permission','Permission denied: lab-web 재시작에는 sudo 권한이 필요합니다.','trainee는 sudo systemctl restart lab-web만 허용돼요.');
  state.web.running=true;changed('restart','trainee가 가상 웹 서버에서 lab-web 서비스를 재시작');
  flag('restart');return {ok:true,lines:['[ OK ] lab-web.service restarted on web01 (SIM)','Web host: ONLINE / HTTP: RUNNING']};
 }
 if(/^sudo\s+/.test(cmd)&&isRemote())return fail('permission','trainee 계정은 제한된 관리자 권한만 가지고 있어요.','sudo systemctl restart lab-web 명령만 허용됩니다.');
 if(cmd==='web-audit demo.lab'||cmd==='web-audit training.lab'){
  if(!link())return {ok:false,lines:['가상 네트워크에 연결되어 있지 않아요.']};
  if(!state.web.running)return {ok:false,lines:['웹 서버가 중단되어 있어 보안 설정을 점검할 수 없어요.']};
  flag('audit');if(issues().length===0)flag('secured');
  return {ok:true,lines:['Virtual Web Security Check','남은 가상 보안 설정 문제 '+issues().length+'개',
  ...(issues().length?issues().map(x=>'- '+x):['설정 문제 없음'])]};
 }
 if(/^web-fix (headers|access|output)$/.test(cmd)){
  if(!state.web.running)return {ok:false,lines:['먼저 서비스를 복구해야 설정을 수정할 수 있어요.']};
  return webFix(cmd.split(' ')[1]);
 }
 return {ok:false,lines:['지원하지 않는 로컬 시뮬레이션 명령입니다. help를 입력해 보세요.']};
}
// Network events are copied into the same synthetic evidence stream read by
// both the incident terminal and the forensics training track.
document.addEventListener('kali-sim:network-changed',event=>{
 const d=event.detail||{};
 if(!['auth','connect','ap','channel','password','client'].includes(d.kind))return;
 const stamp=new Date().toISOString().slice(0,19).replace('T',' ');
 const message=String(d.message||d.kind).slice(0,170).replace(/\r|\n/g,' ');
 state.logs.push(stamp+' virtual-lan network[SIM]: '+message);
 state.logs=state.logs.slice(-100);
 changed('network-log','가상 네트워크 상태 변경을 사건 기록에 추가했어요: '+d.kind);
});
window.KaliLAN={snapshot,devices,steps,progress,command,request,missionStart,resetMission,setHostPower,webFix,issues,logText,link,
 get shell(){return {...state.shell}},get hostOnline(){return hostOnline()},
 get report(){return state.mission.report},get web(){return {...state.web}},get mission(){return snapshot().mission}};
persist();
})();
