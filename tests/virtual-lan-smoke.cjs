
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const configs=[['desktop',1366,768],['mobile',390,844],['small',320,640]];
async function launch(browser,[name,width,height]){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:name!=='desktop',hasTouch:name!=='desktop'});
 const page=await ctx.newPage(),errors=[],unapproved=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',request=>{if(/https?:\/\/(?:training|demo)\.lab\b/.test(request.url()))unapproved.push(request.url())});
 const cmd=async s=>{
  await page.locator('#shell-input').fill(s);
  await page.locator('#shell-input').press('Enter');
 };
 const count=async n=>await page.waitForFunction(val=>window.KaliLAN.progress().count===val,n,{timeout:6000});
 try{
  await page.goto('http://127.0.0.1:8000',{waitUntil:'load'});
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:12000});
  await page.locator('#ob-skip').click();
  await page.evaluate(()=>window.KaliCurriculum.open());
  await page.locator('#courses').waitFor({state:'visible'});
  assert.equal(await page.locator('#course-list button').count(),7,'expected five original plus two new tracks');
  await page.locator('#course-list button').filter({hasText:'INCIDENT-001'}).click();
  await page.locator('#course-start').click();
  await page.locator('#terminal').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().active),'incident');
  assert.equal(await page.evaluate(()=>window.KaliLAN.web.running),false);
  await page.evaluate(()=>window.KaliLANUI.openMap());
  await page.locator('#lan-map').waitFor({state:'visible'});
  assert.match(await page.locator('#lan-device-detail').innerText(),/STOPPED|HTTP/);
  await page.locator('#lan-map .lan-close').click();
  await cmd('ping 192.0.2.1');await count(1);
  await cmd('curl -I http://training.lab');await count(2);
  assert.match(await page.locator('#log').innerText(),/503 Service Unavailable/);
  await page.evaluate(()=>window.KaliLANUI.openBrowser('http://training.lab/'));
  await page.locator('#lan-browser').waitFor({state:'visible'});
  assert.match(await page.locator('#lan-browser-page').innerText(),/503 Service Unavailable/);
  assert.equal(await page.evaluate(()=>window.KaliLAN.progress().count),2,'browser error response must not clear mission');
  await page.locator('#lan-browser .lan-close').click();
  await cmd('grep "Failed password" /var/log/auth.log');await count(3);
  assert.match(await page.locator('#log').innerText(),/192\.0\.2\.77/);
  await cmd('sudo service lab-web restart');await count(4);
  await page.evaluate(()=>window.KaliLANUI.openBrowser('http://training.lab/'));
  await count(5);
  assert.match(await page.locator('#lan-browser-page').innerText(),/200|Virtual Training Portal/);
  await page.locator('#lan-address').fill('http://training.lab/admin');
  await page.locator('#lan-go').click();
  assert.match(await page.locator('#lan-browser-page').innerText(),/관리자 전용 자료/);
  await page.locator('#lan-browser .lan-close').click();
  await cmd('web-audit demo.lab');await count(6);
  await cmd('web-fix headers');
  await cmd('web-fix access');
  await cmd('web-fix output');await count(7);
  assert.deepEqual(await page.evaluate(()=>window.KaliLAN.issues()),[]);
  await page.evaluate(()=>window.KaliLANUI.openBrowser('http://demo.lab/'));
  await page.locator('#lan-address').fill('http://training.lab/admin');
  await page.locator('#lan-go').click();
  assert.match(await page.locator('#lan-browser-page').innerText(),/403 Forbidden/,'browser must use same access control as command');
  await page.locator('#lan-browser .lan-close').click();
  await cmd('incident-report');await count(8);
  assert.equal(await page.evaluate(()=>window.KaliLAN.progress().complete),true);
  assert.match(await page.locator('#log').innerText(),/INCIDENT-001 — Virtual Network Incident Report/);
  await page.evaluate(()=>window.KaliCurriculum.selectTrack('sandbox'));
  await cmd('curl -I http://demo.lab');
  assert.match(await page.locator('#log').innerText(),/Content-Security-Policy/,'free practice must read hardened server');
  await page.evaluate(()=>window.KaliLANUI.openMap());
  await page.locator('#lan-map').waitFor({state:'visible'});
  assert.equal(await page.locator('#lan-topology .lan-device').count(),4);
  await page.locator('#lan-map .lan-close').click();
  await page.reload();
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:12000});
  await page.locator('#ob-skip').click();
  assert.equal(await page.evaluate(()=>window.KaliLAN.progress().complete),true,'mission lost after reload');
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().active),'sandbox','selected track should persist');
  assert.equal(await page.evaluate(()=>window.KaliLAN.web.running),true);
  await page.evaluate(()=>window.KaliLANUI.openBrowser('http://training.lab/'));
  assert.match(await page.locator('#lan-browser-page').innerText(),/200|Virtual Training Portal/);
  assert.deepEqual(unapproved,[],'virtual browser made an external HTTP request');
  assert.deepEqual(errors,[],'page JS runtime errors');
  console.log('PASS '+name+' virtual LAN 4 nodes, Firefox sim, incident 8/8, shared web config, free practice, saved state');
 }finally{await ctx.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const config of configs)await launch(browser,config)}finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
