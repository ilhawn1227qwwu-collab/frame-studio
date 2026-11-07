
/* Virtual Firefox, LAN diagram, guided incident and no-scriptable external networking. */
(()=>{'use strict';
const $=id=>document.getElementById(id),LAN=window.KaliLAN;
if(!LAN||!window.KaliCurriculum)return;
const desktop=$('desktop'),terminal=$('terminal');
let windowLevel=1250,browserHistory=[],historyIndex=-1,currentURL='http://training.lab',isExpanded=false,selectedDevice='web';
function button(text,cls='',handler){
 const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;if(handler)b.addEventListener('click',handler);return b;
}
function focus(w){w.style.zIndex=String(++windowLevel)}
function close(w){w.classList.add('hidden')}
function open(w){if($('power-layer')&&!$('power-layer').hidden)return;w.classList.remove('hidden','minimized');focus(w);$('menu-panel')?.classList.remove('open')}
function addWindow(id,name,bodyClass){
 const w=document.createElement('section');w.className='window hidden';w.id=id;w.setAttribute('aria-label',name);
 w.innerHTML='<div class="window-head"><span class="win-name">'+name+'</span>'+
 '<div class="window-buttons"><button type="button" class="lan-min" aria-label="최소화">─</button><button type="button" class="lan-max" aria-label="최대화">▣</button><button type="button" class="lan-close" aria-label="닫기">×</button></div></div>'+
 '<div class="'+bodyClass+'" style="display:flex;flex-direction:column;flex:1;min-height:0"></div>';
 desktop.append(w);
 w.querySelector('.lan-min').addEventListener('click',()=>w.classList.add('minimized'));
 w.querySelector('.lan-max').addEventListener('click',()=>w.classList.toggle('maximized'));
 w.querySelector('.lan-close').addEventListener('click',()=>close(w));
 w.addEventListener('pointerdown',()=>focus(w));
 const head=w.querySelector('.window-head');let drag=null;
 head.addEventListener('pointerdown',e=>{if(e.target.closest('button')||matchMedia('(max-width:760px)').matches)return;drag={pid:e.pointerId,x:e.clientX,y:e.clientY,l:w.offsetLeft,t:w.offsetTop};head.setPointerCapture(e.pointerId)});
 head.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pid)return;w.style.left=Math.max(0,Math.min(innerWidth-w.offsetWidth,drag.l+e.clientX-drag.x))+'px';w.style.top=Math.max(40,Math.min(innerHeight-w.offsetHeight-52,drag.t+e.clientY-drag.y))+'px'});
 head.addEventListener('pointerup',()=>drag=null);head.addEventListener('pointercancel',()=>drag=null);
 return w;
}
const browser=addWindow('lan-browser','Firefox [SIM] — Virtual Intranet','lan-browser-root');
const bRoot=browser.querySelector('.lan-browser-root');
bRoot.innerHTML='<div class="lan-toolbar"><button id="lan-back" type="button" aria-label="뒤로">‹</button>'+
 '<button id="lan-refresh" type="button" aria-label="새로고침">↻</button><input id="lan-address" aria-label="가상 주소" type="text" spellcheck="false" value="http://training.lab">'+
 '<button id="lan-go" type="button">이동</button></div><div id="lan-browser-status" class="lan-browser-status"></div>'+
 '<div class="lan-browser-page" id="lan-browser-page"></div>';
const map=addWindow('lan-map','Network Topology — Virtual Lab','lan-map-root');
map.querySelector('.lan-map-root').innerHTML='<div class="lan-map-content"><div class="lan-map-overline">VIRTUAL PRIVATE LAB · 192.0.2.0/24 · OFFLINE</div>'+
 '<div class="lan-topology" id="lan-topology"></div><div id="lan-device-detail" class="lan-map-hint"></div>'+
 '<div class="lan-map-actions" id="lan-map-actions"></div>'+
 '<div class="lan-map-overline" style="margin-top:18px">RECENT SIMULATED EVENTS</div><div class="lan-map-events" id="lan-events"></div>'+
 '<p style="font-size:10px;line-height:1.6;color:#99b5cb">모든 기기와 요청은 브라우저 내부에서 생성한 모형입니다. 외부 주소 접속, 포트 스캔, 실제 패킷 전송은 하지 않습니다.</p></div>';
const side=document.createElement('aside');side.id='lan-side';side.className='lan-side';
side.innerHTML='<div class="lan-side-head"><span id="lan-mode-heading">INCIDENT-001</span><span id="lan-count"></span></div>'+
 '<div class="lan-side-content"><h3 id="lan-step-title"></h3><p id="lan-step-desc"></p>'+
 '<code id="lan-step-command"></code><p id="lan-step-hint"></p>'+
 '<div><button type="button" id="lan-open-map">네트워크 지도</button><button type="button" id="lan-open-browser">Firefox</button></div>'+
 '<div><button type="button" id="lan-open-courses">학습센터</button></div></div>';
desktop.append(side);
const strip=document.createElement('div');strip.id='lan-mobile-guide';strip.className='lan-mobile-guide';
strip.innerHTML='<button id="lan-mobile-toggle" type="button" aria-expanded="false"><span class="lan-mobile-count" id="lan-mobile-count"></span>'+
 '<span class="lan-mobile-title" id="lan-mobile-title"></span><span id="lan-mobile-arrow">▼</span></button>'+
 '<div class="lan-mobile-detail" id="lan-mobile-detail" hidden><div id="lan-mobile-desc"></div><code id="lan-mobile-command"></code></div>';
terminal.querySelector('.terminal-body').prepend(strip);
$('lan-mobile-toggle').addEventListener('click',()=>{isExpanded=!isExpanded;$('lan-mobile-detail').hidden=!isExpanded;$('lan-mobile-toggle').setAttribute('aria-expanded',String(isExpanded));$('lan-mobile-arrow').textContent=isExpanded?'▲':'▼'});
function activeTrack(){return window.KaliCurriculum.snapshot().active}
function inLAN(){return ['incident','sandbox'].includes(activeTrack())}
function pageVisit(url,{push=true}={}){
 const r=LAN.request(url,{browser:true});
 currentURL=url;
 $('lan-address').value=url;
 $('lan-browser-status').textContent='VIRTUAL HTTP · '+(r.status||'OFFLINE')+' · '+url+' · EXTERNAL REQUESTS DISABLED';
 if(push){browserHistory=browserHistory.slice(0,historyIndex+1);browserHistory.push(url);historyIndex=browserHistory.length-1}
 const body=$('lan-browser-page');body.replaceChildren();
 const head=document.createElement('div');head.className='lan-site-head';
 head.textContent='TRAINING LAB · 192.0.2.20 · FICTIONAL INTRANET';
 body.append(head);
 const box=document.createElement('div');box.className='lan-web-box';box.style.marginTop='12px';
 const status=document.createElement('div');status.className='lan-http-status'+(r.status>=400||!r.ok?' bad':'');
 status.textContent='HTTP '+(r.status||'CONNECTION FAILED')+' · SIMULATION';
 const title=document.createElement('h2');title.textContent=r.heading;
 box.append(status,title);
 for(const line of r.body||[]){const p=document.createElement('p');p.textContent=line;box.append(p)}
 const note=document.createElement('p');note.className='lan-browser-small';note.textContent=r.message;box.append(note);
 const nav=document.createElement('div');nav.className='lan-links';
 for(const [label,address] of [['홈','http://training.lab/'],['상태','http://training.lab/status'],['관리자','http://training.lab/admin'],['진단','http://training.lab/health'],['웹 보안 예시','http://demo.lab/']]){
  nav.append(button(label,'',()=>pageVisit(address)));
 }
 box.append(nav);
 const warn=document.createElement('div');warn.className='lan-browse-warning';
 warn.textContent='브라우저 안의 가상 웹 문서입니다. 네트워크 패킷과 실제 HTTP 요청을 보내지 않습니다.';
 box.append(warn);
 const headers=document.createElement('pre');headers.className='lan-headers';headers.textContent=(r.headers||[]).join('\n');
 box.append(headers);body.append(box);
}
$('lan-go').addEventListener('click',() =>pageVisit($('lan-address').value.trim()));
$('lan-address').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();pageVisit($('lan-address').value.trim())}});
$('lan-refresh').addEventListener('click',()=>pageVisit(currentURL,{push:false}));
$('lan-back').addEventListener('click',()=>{if(historyIndex>0){historyIndex--;pageVisit(browserHistory[historyIndex],{push:false})}});
function openBrowser(url){open(browser);if(url)pageVisit(url);else pageVisit(currentURL,{push:historyIndex<0})}
function renderMap(){
 const snapshot=LAN.snapshot(),nodes=$('lan-topology');nodes.replaceChildren();
 const icons={kali:'⌘',router:'⌁',web:'▣',log:'▤'};
 for(const d of snapshot.devices){
  const b=button('','lan-device'+(d.online?'':' off'),()=>{selectedDevice=d.id;renderMap()});b.dataset.device=d.id;
  const ic=document.createElement('div');ic.className='lan-device-icon';ic.textContent=icons[d.id];
  const name=document.createElement('strong');name.textContent=d.name;
  const addr=document.createElement('span');addr.textContent=d.ip+' · '+(d.online?'ONLINE':'OFFLINE');
  const status=document.createElement('span');status.textContent=d.detail;
  const dot=document.createElement('span');dot.className='lan-dot';dot.title=d.online?'Online':'Offline';
  b.append(ic,name,addr,status,dot);
  b.setAttribute('aria-pressed',String(selectedDevice===d.id));nodes.append(b);
 }
 const node=snapshot.devices.find(d=>d.id===selectedDevice)||snapshot.devices[0];
 $('lan-device-detail').textContent=node.name+' · '+node.ip+'\n'+node.detail+
  (node.id==='web'?'\nHost: '+(LAN.hostOnline?'ONLINE':'OFFLINE')+' · HTTP: '+(LAN.hostOnline?(LAN.web.running?'RUNNING':'STOPPED'):'UNAVAILABLE')+' · 설정 문제 '+LAN.issues().length+'개':'');
 const actions=$('lan-map-actions');actions.replaceChildren();
 actions.append(button('Firefox 열기','',()=>openBrowser('http://training.lab')));
 actions.append(button('터미널 열기','',openTerminal));
 actions.append(button('INCIDENT-001 시작 / 재시작','',()=>{
  if(!confirm('가상 INCIDENT-001을 초기화하고 시작할까요? 기존 가상 웹 서버 상태가 변경됩니다.'))return;
  LAN.missionStart();window.KaliCurriculum.selectTrack('incident');openTerminal();
 }));
 actions.append(button('웹 서버 전원 '+(LAN.hostOnline?'끄기':'켜기'),'',()=>{
  const willPowerOn=!LAN.hostOnline;
  if(!confirm('가상 웹 서버 전원을 '+(willPowerOn?'켜':'꺼')+'겠어요? SSH 연결과 실습 상태에 영향을 줄 수 있어요.'))return;
  LAN.setHostPower(willPowerOn);renderMap();
 }));
 actions.append(button('SSH 접속 안내','',()=>{
  openTerminal();$('shell-input').value='ssh trainee@192.0.2.20';$('shell-input').focus();
 }));
 actions.append(button('가상 웹 서비스 복구','',()=>{
  openTerminal();$('shell-input').value='sudo systemctl restart lab-web';
  $('shell-input').focus(); // The user must run this from the remote shell.
 }));
 actions.append(button('네트워크 연결 보기','',()=>document.querySelector('.panel-left [data-open="wifi"]')?.click()));
 $('lan-events').textContent=snapshot.events.slice(0,10).map(e=>'['+e.when+'] '+e.message).join('\n');
}
function openMap(){renderMap();open(map)}
function openTerminal(){document.querySelector('.desktop-shortcuts [data-open="terminal"]')?.click();terminal.classList.remove('hidden','minimized');focus(terminal)}

function updateShellCaption(){
 const sh=LAN.shell,host=sh.host==='web01'?'web01':'kali';
 const title=terminal.querySelector('.window-head .win-name');
 if(title)title.textContent='⌘ '+sh.user+'@'+host+': '+sh.cwd+' [SIM]';
 const prompt=terminal.querySelector('#shell-form .caret');
 if(prompt)prompt.textContent=host==='web01'?'web01 $':'kali $';
 const input=$('shell-input');
 if(input)input.setAttribute('aria-label',sh.user+'@'+host+' 교육용 가상 터미널 명령어');
}
function print(text,kind=''){
 const t=$('log');const e=document.createElement('div');e.className='line '+kind;e.textContent=String(text);t.append(e);t.scrollTop=t.scrollHeight;
}
function run(raw){
 const input=String(raw||'').trim();
 if(!input)return;
 $('shell-input').value='';
 if(input==='clear'){$('log').replaceChildren();return}
 const sh=LAN.shell;print('┌──('+sh.user+'㉿'+(sh.host==='web01'?'web01':'kali')+')-[Virtual LAN]\n└─$ '+input,'prompt');
 const r=LAN.common(input)||(LAN.shell.host==='kali'?window.KaliCurriculum?.fs(input):null)||LAN.command(input);
 for(const line of r.lines||[])print(line,r.ok?'':'warn');
 if(!r.ok)print(LAN.explainFailure(r,input),'warn');
 if(r.ok)renderMap();
 return r;
}
function renderCoach(){
 const enabled=inLAN();
 desktop.classList.toggle('lan-active',enabled);
 side.hidden=!enabled;strip.hidden=!enabled;
 if(!enabled)return;
 const id=activeTrack(),p=LAN.progress(),sandbox=id==='sandbox',current=p.steps[p.index]||null;
 $('lan-mode-heading').textContent=sandbox?'FREE PRACTICE':'INCIDENT-001';
 $('lan-count').textContent=sandbox?'자유 탐색':p.count+'/'+p.total;
 $('lan-step-title').textContent=sandbox?'가상 네트워크 자유 탐색':!p.started?'임무를 시작해 주세요':p.complete?'보안 임무 완료!':current?.title||'임무 완료';
 $('lan-step-desc').textContent=sandbox?'정해진 명령 순서 없이 가상 서버와 네트워크 상태를 바꿔 보세요. help로 지원 명령을 확인할 수 있어요.':
 !p.started?'네트워크 지도에서 INCIDENT-001을 시작하거나 학습센터에서 이 과목을 시작하세요.':
 p.complete?'서비스와 보안 설정을 복구하고 가상 조사 보고서를 작성했어요. 네트워크 지도에서 결과를 확인할 수 있어요.':current?.desc||'';
 $('lan-step-command').textContent=sandbox?'help\nip a\ncurl -I http://training.lab\nweb-audit demo.lab':
 p.complete?'incident-status':current?.command||'incident-status';
 $('lan-step-hint').textContent=sandbox?'외부 서버나 실제 네트워크에는 명령을 보내지 않아요.':current?.hint||'';
 $('lan-mobile-count').textContent=sandbox?'FREE':p.count+'/'+p.total;
 $('lan-mobile-title').textContent=$('lan-step-title').textContent;
 $('lan-mobile-desc').textContent=$('lan-step-desc').textContent;
 $('lan-mobile-command').textContent=$('lan-step-command').textContent;
 isExpanded=false;$('lan-mobile-detail').hidden=true;$('lan-mobile-toggle').setAttribute('aria-expanded','false');$('lan-mobile-arrow').textContent='▼';
 const area=$('quick');area.replaceChildren();
 const commands=sandbox?['help','incident-status']:p.complete?['incident-status']:current?.command.includes('\n')?current.command.split('\n'):[current?.command||'incident-status'];
 for(const c of commands){
  if(c.includes('Firefox'))continue;
  const btn=button(c,'',()=>{$('shell-input').value=c;$('shell-input').focus();});
  btn.title='명령어를 입력칸에 채우기 (자동 실행하지 않음)';area.append(btn);
 }
}
$('lan-open-map').addEventListener('click',openMap);
$('lan-open-browser').addEventListener('click',()=>openBrowser('http://training.lab'));
$('lan-open-courses').addEventListener('click',()=>window.KaliCurriculum.open());
function shortcut(label,icon,handler){
 const b=button('','shortcut',handler);
 b.innerHTML='<span class="shortcut-icon" aria-hidden="true" style="font-size:29px;color:#98d8ff">'+icon+'</span>'+label;
 document.querySelector('.desktop-shortcuts').append(b);
 return b;
}
shortcut('Firefox SIM','▣',()=>openBrowser()).classList.add('lan-browser-shortcut');
shortcut('Network Map','◉',openMap).classList.add('lan-map-shortcut');
function dock(label,icon,handler){
 const b=button(icon,'desktop-task',handler);b.title=label;b.setAttribute('aria-label',label);
 const taskbar=document.querySelector('.taskbar');const caption=taskbar.querySelector('.task-caption');taskbar.insertBefore(b,caption||null);
 return b;
}
dock('Firefox SIM','▣',()=>openBrowser());dock('Network Map','◉',openMap);
const apps=document.querySelector('.menu-apps');
for(const [label,icon,cb] of [['Firefox SIM — Intranet','▣',()=>openBrowser()],['Network Topology','◉',openMap]]){
 const b=button(icon+' '+label,'',cb);b.dataset.groups='favorites recon settings';b.dataset.appName=label.toLowerCase();apps.append(b)
}
const form=$('shell-form');form.addEventListener('submit',e=>{
 if(!inLAN())return;
 e.preventDefault();e.stopImmediatePropagation();run($('shell-input').value);
},true);
document.addEventListener('kali-sim:lan-changed',()=>{renderMap();renderCoach();updateShellCaption();});
document.addEventListener('kali-sim:network-changed',()=>{if(inLAN())renderMap()});
document.addEventListener('kali-sim:course-switched',renderCoach);
document.addEventListener('kali-sim:tour-started',()=>desktop.classList.add('tour-running'));
document.addEventListener('kali-sim:tour-ended',()=>{desktop.classList.remove('tour-running');renderCoach()});
document.addEventListener('kali-sim:shutdown',()=>{close(browser);close(map)});
window.KaliLANUI={openMap,openBrowser,run,render:()=>{renderMap();renderCoach()},snapshot:LAN.snapshot};
renderMap();renderCoach();updateShellCaption();
})();
