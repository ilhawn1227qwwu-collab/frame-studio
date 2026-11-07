
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
async function boot(page){
 await page.goto('http://127.0.0.1:8000',{waitUntil:'load'});
 await page.locator('#power-start').click();
 await page.locator('#onboard-root').waitFor({state:'visible',timeout:13000});
 assert.match(await page.locator('#ob-number').innerText(),/^01 \/ 28/);
 await page.locator('#ob-skip').click();
 await page.locator('#terminal').waitFor({state:'visible',timeout:4000});
 if(await page.locator('#typing-btn').getAttribute('aria-pressed')==='true')await page.locator('#typing-btn').click();
}
async function cmd(page,value){
 await page.locator('#shell-input').fill(value);
 await page.locator('#shell-input').press('Enter');
}
async function done(page,n){
 await page.waitForFunction(expected=>document.querySelector('#progress-text')?.textContent?.startsWith(expected+' /'),n,{timeout:9500});
}
async function fsTest(browser,label,width,height){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:label!=='desktop',hasTouch:label!=='desktop'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await boot(page);
  await page.evaluate(()=>window.KaliCurriculum.selectTrack('linux'));
  await cmd(page,'touch missing/ghost.txt');
  assert.match(await page.locator('#log').innerText(),/parent directory does not exist/);
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().fs.files['/home/kali/missing/ghost.txt']),undefined);
  await cmd(page,'mkdir missing/child');
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().fs.dirs.includes('/home/kali/missing/child')),false);
  await cmd(page,'pwd');await cmd(page,'ls');
  await cmd(page,'mkdir training');
  await page.waitForFunction(()=>window.KaliCurriculum.snapshot().fs.dirs.includes('/home/kali/training'));
  await page.locator('.taskbar button[title="Home"]').click();
  await page.locator('#files').waitFor({state:'visible'});
  await page.locator('#file-items .file-icon').filter({hasText:'training'}).click();
  assert.equal(await page.locator('#file-path').innerText(),'/home/kali/training');
  await page.locator('.taskbar button[title="Terminal"]').click();
  await cmd(page,'cd training');await cmd(page,'touch notes.txt');
  await page.waitForFunction(()=>Object.hasOwn(window.KaliCurriculum.snapshot().fs.files,'/home/kali/training/notes.txt'));
  await page.locator('.taskbar button[title="Home"]').click();
  await page.locator('#file-items .file-icon').filter({hasText:'notes.txt'}).click();
  assert.match(await page.locator('#file-status').innerText(),/빈 파일/);
  await page.locator('.taskbar button[title="Terminal"]').click();
  await cmd(page,'ls -l');
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().progress.linux),6);
  page.once('dialog',async dialog=>await dialog.accept());
  await page.evaluate(()=>window.KaliCurriculum.reset());
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().progress.linux),0);
  await page.locator('.taskbar button[title="Home"]').click();
  await page.locator('#file-back').click();
  assert.equal(await page.locator('#file-items .file-icon').filter({hasText:'training'}).count(),0);
  assert.deepEqual(errors,[],'JS runtime errors');
  console.log('PASS '+label+' FS: invalid paths rejected, Thunar sync, course reset, no runtime errors');
 }finally{await ctx.close()}
}
async function networkTest(browser,label,width,height){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:label!=='desktop',hasTouch:label!=='desktop'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await boot(page);
  await page.locator('.panel-left [data-open="wifi"]').click();
  await page.locator('#sim-channel').selectOption('11');
  await page.locator('#sim-weakpass').selectOption('summer2026');
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.psk),'summer2026');
  await page.reload();
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:13000});
  await page.locator('#ob-skip').click();
  if(await page.locator('#typing-btn').getAttribute('aria-pressed')==='true')await page.locator('#typing-btn').click();
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.channel),11,'channel overwritten by legacy migration');
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.psk),'summer2026','password overwritten by legacy migration');
  await cmd(page,'ip a');await done(page,1);
  await cmd(page,'nmcli dev wifi list');await done(page,2);
  await cmd(page,'sudo airmon-ng start wlan0');await done(page,3);
  await cmd(page,'sudo airodump-ng wlan0mon');await done(page,4);
  const cap='sudo airodump-ng --bssid 02:1A:11:20:26:01 -c 11 -w labcap wlan0mon';
  await cmd(page,cap);
  await page.waitForTimeout(130);
  assert.equal((await page.locator('#progress-text').innerText()).trim(),'4 / 9','capture passed without client auth event');
  assert.match(await page.locator('#log').innerText(),/인증 교환 이벤트/);
  await page.locator('.panel-left [data-open="wifi"]').click();
  await page.locator('#sim-reconnect').click();
  await page.locator('#wifi [data-close="wifi"]').click();
  await cmd(page,cap);await done(page,5);
  assert.ok(await page.evaluate(()=>window.KaliNetwork.capture?.event)>0);
  await cmd(page,'aircrack-ng -w /usr/share/wordlists/lab-demo.txt labcap-01.cap');await done(page,6);
  assert.match(await page.locator('#log').innerText(),/KEY FOUND! \[ summer2026 \]/);
  await cmd(page,'sudo airmon-ng stop wlan0mon');await done(page,7);
  assert.ok(await page.evaluate(()=>window.KaliNetwork.capture),'leaving monitor mode destroyed already saved fixture');
  await cmd(page,'nmcli dev wifi connect LAB-TRAINING password coffee2026 ifname wlan0');
  assert.equal((await page.locator('#progress-text').innerText()).trim(),'7 / 9','wrong password should not advance');
  await cmd(page,'nmcli dev wifi connect LAB-TRAINING password summer2026 ifname wlan0');await done(page,8);
  await cmd(page,'open router');await page.locator('#router').waitFor({state:'visible'});
  await page.locator('#secret').fill('River-Maple-Sky-Cloud-84');
  await page.locator('#security').selectOption('WPA3-SAE');
  await page.locator('#admin-pass').fill('wrong-admin');
  await page.locator('#router-form button[type="submit"]').click();
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.security),'WPA2-PSK','wrong administrator credential accepted');
  await page.locator('#admin-pass').fill('lab-admin-2026');
  await page.locator('#router-form button[type="submit"]').click();
  await page.waitForFunction(()=>window.KaliNetwork.ap.security==='WPA3-SAE');
  await cmd(page,'lab-verify LAB-TRAINING');await done(page,9);
  await page.reload();
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:13000});
  await page.locator('#ob-skip').click();
  if(await page.locator('#typing-btn').getAttribute('aria-pressed')==='true')await page.locator('#typing-btn').click();
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.security),'WPA3-SAE');
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.psk),'River-Maple-Sky-Cloud-84','legacy migration destroyed strong passphrase');
  await page.locator('.panel-left [data-open="wifi"]').click();
  await page.locator('#sim-ap-power').uncheck();
  assert.equal(await page.locator('#nets .net.target').count(),0);
  assert.equal((await page.locator('#progress-text').innerText()).trim(),'9 / 9','AP power cycling must not erase already completed WPA3 remediation');
  await page.locator('#sim-ap-power').check();
  assert.equal(await page.locator('#nets .net.target').count(),1);
  assert.deepEqual(errors,[],'JS errors');
  console.log('PASS '+label+' Wi-Fi: persistence, event-gated capture, variable audit, auth, WPA3, dependency invalidation');
 }finally{await ctx.close()}
}

async function noMatchTest(browser){
 const ctx=await browser.newContext({viewport:{width:1366,height:768}}),page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await boot(page);
  await page.evaluate(()=>window.KaliNetwork.setDemoPassword('not-in-dictionary'));
  await cmd(page,'ip a');await done(page,1);
  await cmd(page,'nmcli dev wifi list');await done(page,2);
  await cmd(page,'sudo airmon-ng start wlan0');await done(page,3);
  await cmd(page,'sudo airodump-ng wlan0mon');await done(page,4);
  await page.locator('.panel-left [data-open="wifi"]').click();
  await page.locator('#sim-reconnect').click();
  await page.locator('#wifi [data-close="wifi"]').click();
  await cmd(page,'sudo airodump-ng --bssid 02:1A:11:20:26:01 -c 6 -w labcap wlan0mon');await done(page,5);
  await cmd(page,'aircrack-ng -w /usr/share/wordlists/lab-demo.txt labcap-01.cap');await done(page,6);
  const log=await page.locator('#log').innerText();
  assert.match(log,/NO MATCH:.*일치하는 비밀번호가 없어요/);
  assert.doesNotMatch(log,/KEY FOUND!/,'false dictionary success');
  await cmd(page,'sudo airmon-ng stop wlan0mon');await done(page,7);
  await cmd(page,'nmcli dev wifi connect LAB-TRAINING password not-in-dictionary ifname wlan0');await done(page,8);
  await cmd(page,'open router');
  await page.locator('#router').waitFor({state:'visible'});
  await page.locator('#admin-pass').fill('lab-admin-2026');
  await page.locator('#security').selectOption('WPA3-SAE');
  await page.locator('#secret').fill('River-Maple-Sky-Cloud-84');
  await page.locator('#router-form button[type="submit"]').click();
  await cmd(page,'lab-verify LAB-TRAINING');await done(page,9);
  assert.deepEqual(errors,[]);
  console.log('PASS desktop no-match dictionary branch permits legitimate owner-known connection and remediation');
 }finally{await ctx.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  await fsTest(browser,'desktop',1366,768);
  await networkTest(browser,'desktop',1366,768);
  await fsTest(browser,'mobile',390,844);
  await networkTest(browser,'mobile',390,844);
  await noMatchTest(browser);
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
