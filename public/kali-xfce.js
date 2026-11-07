
/* XFCE-inspired GUI: progressive enhancement over the existing lab engine.
   No Linux OS, real Wi-Fi device, or host filesystem is accessed. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const svg={
 dragon:'<path d="M4 14c4-8 12-11 18-8-4 1-6 3-7 5 3-1 7 1 8 4-5-2-8-1-12 3l-4 3 2-6-6 2 1-3Z"/><path d="M13 7 15 2m2 14 4 5" />',
 terminal:'<rect x="2" y="3" width="20" height="18" rx="2"/><path d="m6 8 4 4-4 4m7 0h5"/>',
 folder:'<path d="M3 6h7l2 2h9v11H3z"/><path d="M3 9h18"/>',
 wifi:'<path d="M2 9c5-5 15-5 20 0M5 12c3.5-3 10.5-3 14 0M8.5 15c2-1.8 5-1.8 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
 notes:'<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M8 7h8M8 11h8M8 15h6"/>',
 settings:'<path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1m0-14.2L17 7M7 17l-2.1 2.1"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
 shield:'<path d="m12 2 8 4v5c0 6-3 9-8 11-5-2-8-5-8-11V6z"/><path d="m8 12 3 3 5-6"/>',
 power:'<path d="M12 2v10"/><path d="M7 4.5A9 9 0 1 0 17 4.5"/>',
 maximize:'<rect x="4" y="4" width="16" height="16" rx="1"/>',
 minimize:'<path d="M5 17h14"/>',
 close:'<path d="m5 5 14 14M19 5 5 19"/>',
 disk:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 15h12M7 8h10"/>',
 book:'<path d="M3 5c4-2 7-2 9 0 2-2 5-2 9 0v15c-4-2-7-2-9 0-2-2-5-2-9 0zM12 5v15"/>',
 tools:'<path d="M13 7a5 5 0 0 1 7-4l-3 3 1 2 3-2a5 5 0 0 1-7 6L7 20l-3-3 9-10Z"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v.5"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 arrow:'<path d="m9 18 6-6-6-6"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 21h4"/>',
 home:'<path d="M3 10 12 3l9 7v11h-7v-7h-4v7H3z"/>',
 doc:'<path d="M6 2h9l4 4v16H6zM15 2v5h4M9 12h7M9 16h7"/>',
 lock:'<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 refresh:'<path d="M20 7V3l-3 3a8 8 0 1 0 3 10M20 3v6h-6"/>'
};
function ico(name,cl=''){return '<svg class="ico '+cl+'" viewBox="0 0 24 24" aria-hidden="true">'+(svg[name]||svg.doc)+'</svg>'}
function put(id,text){const e=$(id);if(e)e.innerHTML=text}
const launcher=$('menu-btn');
put('menu-btn','<span class="kali-badge">'+ico('dragon')+'</span><span class="menu-title">Applications ▾</span>');
const left=document.querySelector('.panel-left');
for(const b of left.querySelectorAll('[data-open]')){
 const id=b.dataset.open;b.innerHTML=ico(id==='terminal'?'terminal':'wifi')+'<span class="panel-label">'+(id==='terminal'?'Terminal':'Network')+'</span>';
 b.title=id==='terminal'?'Terminal Emulator':'NetworkManager';
}
const afterTerminal=left.querySelector('[data-open="terminal"]');
const panelLink=(id,label,icon)=>{const b=document.createElement('button');b.className='panel-item';b.type='button';b.title=label;b.innerHTML=ico(icon)+'<span class="panel-label">'+label+'</span>';b.addEventListener('click',()=>openApp(id));return b};
afterTerminal.after(panelLink('files','Thunar','folder'),panelLink('guide','Mousepad','notes'));
const workspace=document.createElement('div');workspace.className='workspaces';workspace.innerHTML='<button class="workspace active" title="Workspace 1">1</button><button class="workspace" title="Workspace 2">2</button>';left.append(workspace);
workspace.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{workspace.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(b.textContent==='2')toast('작업 공간 2 (시뮬레이션)');else toast('작업 공간 1 (시뮬레이션)')}));
const right=document.querySelector('.panel-right');
const status=right.querySelector('.fake-status');status.textContent='LOCAL SIMULATION';status.title='외부 무선 기기를 검색하거나 조작하지 않습니다';
const tray=document.createElement('button');tray.className='panel-item';tray.title='NetworkManager';tray.innerHTML=ico('wifi');tray.addEventListener('click',()=>openApp('wifi'));right.insertBefore(tray,$('full-btn'));
const alerts=document.createElement('button');alerts.className='panel-item';alerts.title='Lab Progress';alerts.innerHTML=ico('shield');alerts.addEventListener('click',toggleMission);right.insertBefore(alerts,$('full-btn'));
const fullscreen=$('full-btn');fullscreen.innerHTML=ico('maximize')+'<span id="full-label">전체화면</span>';
const clock=$('clock');clock.title='시스템 시계 · 브라우저 로컬 시간';
const shutdown=$('shutdown-btn');if(shutdown)shutdown.innerHTML=ico('power');
const cut=document.createElement('div');cut.className='panel-sep';right.insertBefore(cut,shutdown||null);
const titleBar={
 terminal:['terminal','kali@kali: ~ — QTerminal [SIM]'],
 wifi:['wifi','NetworkManager — Wireless Networks'],
 guide:['notes','Mousepad — Wireless Lab Notes.txt'],
 router:['settings','Firefox — 192.0.2.1 (SIM)'],
 files:['folder','kali — Thunar File Manager'],
 appearance:['settings','Appearance — Kali Dark']
};
for(const [id,[symbol,name]] of Object.entries(titleBar)){
 const win=$(id);if(!win)continue;
 const nm=win.querySelector('.win-name');if(nm)nm.innerHTML=ico(symbol)+name;
 const buttons=win.querySelector('.window-buttons');
 if(buttons){
  const min=document.createElement('button');min.type='button';min.className='xfce-min';min.title='최소화';min.setAttribute('aria-label',name+' 최소화');min.innerHTML=ico('minimize','mini');min.addEventListener('click',()=>{win.classList.add('minimized');toast(name+' 최소화됨. 작업 표시줄에서 다시 열 수 있습니다.')});
  const max=document.createElement('button');max.type='button';max.className='xfce-max';max.title='최대화 / 원래 크기';max.setAttribute('aria-label',name+' 최대화');max.innerHTML=ico('maximize','mini');max.addEventListener('click',()=>win.classList.toggle('maximized'));
  const close=buttons.querySelector('.close');if(close){close.innerHTML=ico('close','mini');buttons.insertBefore(min,close);buttons.insertBefore(max,close)}
 }
}
function openApp(id){
 const original=document.querySelector('.desktop-shortcuts [data-open="'+id+'"]');
 if(original)original.click();else{
  const win=$(id);if(win){win.classList.remove('hidden','minimized');win.style.zIndex='900'}
 }
 const win=$(id);if(win)win.classList.remove('minimized');
 const menu=$('menu-panel');menu.classList.remove('open');launcher.setAttribute('aria-expanded','false');
 if(innerWidth<=760)$('mission').classList.remove('show');
}
function toast(text){const t=$('toast');t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
/* Rebuild Whisker launcher, retaining original buttons and their event listeners. */
const menu=$('menu-panel');
const original=[...menu.querySelectorAll('button')];
const menus={terminal:['terminal','Terminal Emulator','favorites recon wireless'],wifi:['wifi','Network Connections','favorites wireless'],guide:['notes','Mousepad Notes','favorites wireless'],router:['settings','Router Admin [SIM]','wireless settings']};
const head=document.createElement('div');head.className='menu-head';head.innerHTML='<div class="menu-head-logo"><span class="kali-badge">'+ico('dragon')+'</span>kali</div><input id="kali-app-search" aria-label="앱 검색" placeholder="Search applications..." autocomplete="off">';
const core=document.createElement('div');core.className='menu-core';
const cats=document.createElement('nav');cats.className='menu-categories';
const categories=[['favorites','★ Favorites'],['recon','01 · Information Gathering'],['wireless','06 · Wireless Attacks'],['settings','Settings'],['all','All Applications']];
for(const [key,label] of categories){const b=document.createElement('button');b.type='button';b.dataset.group=key;b.textContent=label;cats.append(b)}
const apps=document.createElement('div');apps.className='menu-apps';
for(const b of original){
 const id=b.dataset.open;if(!id||!menus[id])continue;
 b.innerHTML=ico(menus[id][0])+menus[id][1];b.dataset.groups=menus[id][2];b.dataset.appName=menus[id][1].toLowerCase();apps.append(b);
}
function extraApp(id,label,icon,groups){const b=document.createElement('button');b.dataset.groups=groups;b.dataset.appName=label.toLowerCase();b.innerHTML=ico(icon)+label;b.addEventListener('click',()=>openApp(id));apps.append(b)}
extraApp('files','Thunar File Manager','folder','favorites recon');
extraApp('appearance','Appearance Settings','settings','settings');
core.append(cats,apps);
const footer=document.createElement('div');footer.className='menu-footer';
const user=document.createElement('span');user.className='session-indicator';user.innerHTML=ico('shield','mini')+' kali · XFCE SIM';
footer.append(user);
const reset=original.find(b=>b.id==='menu-reset'),off=original.find(b=>b.id==='menu-power');
if(reset){reset.innerHTML=ico('refresh','mini')+' Reset Lab';footer.append(reset)}
if(off){off.innerHTML=ico('power','mini')+' Shut Down';footer.append(off)}
menu.replaceChildren(head,core,footer);
let group='favorites';const search=$('kali-app-search');
function filterApps(){
 const q=search.value.toLowerCase().trim();
 apps.querySelectorAll('button').forEach(b=>{const allowed=group==='all'||(b.dataset.groups||'').split(/\s+/).includes(group);b.hidden=!(allowed&&(b.dataset.appName||'').includes(q))});
 cats.querySelectorAll('button').forEach(b=>b.classList.toggle('sel',b.dataset.group===group))
}
cats.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;filterApps()}));
search.addEventListener('input',()=>{if(search.value.trim())group='all';filterApps()});filterApps();
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&menu.classList.contains('open')){menu.classList.remove('open');launcher.setAttribute('aria-expanded','false')}
 if((e.ctrlKey&&e.altKey&&e.key.toLowerCase()==='t')||(e.metaKey&&e.key.toLowerCase()==='t')){e.preventDefault();openApp('terminal')}
 if(e.metaKey&&e.key.toLowerCase()==='e'){e.preventDefault();openApp('files')}
});
/* XFCE desktop icons, quicklaunch icons and mobile mission access. */
const symbols={terminal:'terminal',wifi:'wifi',guide:'notes',router:'settings',files:'folder',appearance:'settings'};
const labels={terminal:'Terminal',wifi:'Wi-Fi Networks',guide:'Lab Notes',router:'Router Admin',files:'Home',appearance:'Appearance'};
const shortcuts=document.querySelector('.desktop-shortcuts');
for(const b of shortcuts.querySelectorAll('[data-open]')){
 const id=b.dataset.open;b.innerHTML='<span class="shortcut-icon">'+ico(symbols[id],'big')+'</span>'+labels[id];
}
for(const id of ['files','appearance']){
 const b=shortcuts.querySelector('[data-open="'+id+'"]');
 if(b)b.innerHTML='<span class="shortcut-icon">'+ico(symbols[id],'big')+'</span>'+labels[id];
}
const bar=document.querySelector('.taskbar');
for(const b of bar.querySelectorAll('.desktop-task[data-open]')){
 const id=b.dataset.open;b.innerHTML=ico(symbols[id]);b.title=labels[id];
}
const mobile=bar.querySelector('.mobile-icons');if(mobile)mobile.remove();
const caption=bar.querySelector('.task-caption');if(caption)caption.textContent='kali@kali · XFCE 4.20 (SIM)';
function dockApp(id){const b=document.createElement('button');b.className='desktop-task';b.title=labels[id];b.setAttribute('aria-label',labels[id]);b.innerHTML=ico(symbols[id]);b.addEventListener('click',()=>openApp(id));bar.insertBefore(b,caption||null)}
dockApp('files');dockApp('appearance');
const missionBtn=document.createElement('button');missionBtn.className='desktop-task';missionBtn.title='Wireless Lab Tasks';missionBtn.setAttribute('aria-label','임무 창 열기');missionBtn.innerHTML=ico('shield');missionBtn.addEventListener('click',toggleMission);bar.insertBefore(missionBtn,caption||null);
function toggleMission(){const box=$('mission');if(innerWidth<=760){box.classList.toggle('show');menu.classList.remove('open')}else{box.classList.toggle('hide-on-desktop')}}
const mission=$('mission');const content=document.createElement('div');content.className='mission-content';
while(mission.firstChild)content.append(mission.firstChild);
const mbar=document.createElement('div');mbar.className='mission-titlebar';mbar.innerHTML='<span>'+ico('shield','mini')+' Wireless Lab — Tasks</span><button id="mission-close" type="button" aria-label="임무 창 닫기">'+ico('close','mini')+'</button>';
mission.append(mbar,content);
$('mission-close').addEventListener('click',toggleMission);
/* Native GTK-style app menu strips. */
const term=$('terminal');const tmenu=document.createElement('div');tmenu.className='terminal-menubar';tmenu.innerHTML='<span>File</span><span>Edit</span><span>View</span><span>Search</span><span>Terminal</span><span>Help</span>';
term.insertBefore(tmenu,term.querySelector('.terminal-body'));
const guide=$('guide');const gmenu=document.createElement('div');gmenu.className='gtk-menubar';gmenu.innerHTML='<span>File</span><span>Edit</span><span>Search</span><span>View</span><span>Document</span><span>Help</span>';guide.insertBefore(gmenu,guide.querySelector('.window-body'));
const wifi=$('wifi');const toolbar=document.createElement('div');toolbar.className='gtk-toolbar';toolbar.innerHTML=ico('wifi')+' NetworkManager <span style="margin-left:auto;font-size:10px;color:#a8c0d8">wlan0 · virtual device</span>';wifi.insertBefore(toolbar,wifi.querySelector('.window-body'));
const router=$('router');const rbody=router.querySelector('.window-body');
rbody.insertAdjacentHTML('beforebegin','<div class="browser-tabs"><span class="browser-tab">192.0.2.1 — Router Administration</span></div><div class="browser-toolbar"><span>‹ &nbsp; › &nbsp; ↻</span><span class="browser-url">http://192.0.2.1/wireless (SIM ONLY)</span></div>');
/* Virtual Thunar: shared browser-only filesystem for Linux and forensic lessons. */
const folderPaths={
 home:'/home/kali',desktop:'/home/kali/Desktop',documents:'/home/kali/Documents',
 downloads:'/home/kali/Downloads','lab-files':'/home/kali/lab-files'
};
const starterPlaces={
 home:[['Desktop','folder','path:/home/kali/Desktop'],['Documents','folder','path:/home/kali/Documents'],['Downloads','folder','path:/home/kali/Downloads'],['lab-files','folder','path:/home/kali/lab-files'],['README.txt','doc','file:/home/kali/README.txt']],
 desktop:[['Wi-Fi Networks','wifi','open:wifi'],['Wireless Lab Notes','notes','open:guide']],
 documents:[],downloads:[],
 'lab-files':[['lab-demo.txt','doc','file:/home/kali/lab-files/lab-demo.txt']]
};
let currentFolder='home';
const fileContainer=$('file-items'),fileStatus=$('file-status'),pathDisplay=$('file-path');
const fsSnapshot=()=>window.KaliCurriculum?.snapshot()?.fs||null;
function folderPath(key){return key.startsWith('path:')?key.slice(5):folderPaths[key]||'/home/kali'}
function showFolder(location){
 currentFolder=location;
 if(!fileContainer)return;
 const path=folderPath(location),fs=fsSnapshot();
 fileContainer.replaceChildren();pathDisplay.textContent=path;
 $('file-sidebar').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.place===location||folderPaths[b.dataset.place]===path));
 let rows=fs?[]:(starterPlaces[location]||starterPlaces.home).slice();
 if(fs){
   if(location==='desktop')rows.push(...starterPlaces.desktop);
   if(fs.dirs.includes(path)){
     const prefix=path==='/'?'/':path+'/';
     for(const d of fs.dirs){
       if(d===path||!d.startsWith(prefix))continue;
       const name=d.slice(prefix.length);
       if(name&&!name.includes('/'))rows.push([name,'folder','path:'+d]);
     }
     for(const full of Object.keys(fs.files)){
       if(!full.startsWith(prefix))continue;
       const name=full.slice(prefix.length);
       if(name&&!name.includes('/'))rows.push([name,'doc','file:'+full]);
     }
   }
   if(path==='/home/kali/lab-files'&&window.KaliNetwork?.capture){
     rows.push(['labcap-01.cap','doc','capture']);
   }
   rows.sort((a,b)=>a[1]===b[1]?a[0].localeCompare(b[0]):a[1]==='folder'?-1:b[1]==='folder'?1:0);
 }
 for(const [name,icon,action] of rows){
   const b=document.createElement('button');b.type='button';b.className='file-icon';
   b.insertAdjacentHTML('afterbegin',ico(icon));b.append(document.createTextNode(name));
   b.title=name;
   b.addEventListener('click',()=>{
     if(action.startsWith('path:')){showFolder(action);return}
     if(action.startsWith('open:')){openApp(action.slice(5));return}
     if(action==='capture'){
       const fixture=window.KaliNetwork?.capture;
       fileStatus.textContent=fixture?
         '가상 캡처 예제: event #'+fixture.event+' · BSSID '+fixture.bssid+' · CH '+fixture.channel+' (실제 패킷 파일 아님)':
         '이제 캡처 예제를 생성해야 합니다.';
       return
     }
     if(action.startsWith('file:')){
       const content=fsSnapshot()?.files?.[action.slice(5)];
       fileStatus.textContent=content===undefined?'가상 파일을 찾을 수 없어요.':
         name+': '+(content?content.slice(0,260).replace(/\n/g,' · '):'(빈 파일)')+
         (content?.length>260?' …':'');
       return
     }
     fileStatus.textContent=name+' · 교육용 가상 파일';
   });
   fileContainer.append(b);
 }
 fileStatus.textContent=rows.length+' items · Virtual filesystem (browser only)';
}
$('file-sidebar').querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>showFolder(b.dataset.place)));
$('file-back').addEventListener('click',()=>showFolder('home'));
document.addEventListener('kali-sim:fs-changed',()=>showFolder(currentFolder));
document.addEventListener('kali-sim:network-changed',()=>{if(folderPath(currentFolder)==='/home/kali/lab-files')showFolder(currentFolder)});
showFolder('home');
const choice=$('wallpaper-choice');
try{choice.value=localStorage.getItem('kali-wallpaper-choice-v3')||'default'}catch(_){}
$('desktop').dataset.wallpaper=choice.value;
choice.addEventListener('change',()=>{
 $('desktop').dataset.wallpaper=choice.value;
 try{localStorage.setItem('kali-wallpaper-choice-v3',choice.value)}catch(_){}
});
/* Power-on prompt stays explicit so the browser can honor fullscreen via click. */
/* Unminimize from any original app launcher, including top panel icons. */
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-open]');
  if(b&&$(b.dataset.open))$(b.dataset.open).classList.remove('minimized');
});
const power=$('power-start');if(power)power.innerHTML=ico('power')+' 컴퓨터 켜기 · 전체화면 요청';
const pEmblem=document.querySelector('.power-emblem');if(pEmblem)pEmblem.innerHTML=ico('power','big');
/* Surface simulator/accuracy disclaimer in native-looking titlebars. */
for(const id of ['terminal','wifi','guide','router','files','appearance'])$(id)?.setAttribute('data-simulation','true');
})();
