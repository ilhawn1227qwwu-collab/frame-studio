
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const configs=[['desktop',1366,768],['mobile',390,844],['small',320,640]];
async function verify(browser,[name,width,height]){
 const context=await browser.newContext({viewport:{width,height},isMobile:name!=='desktop',hasTouch:name!=='desktop'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const evalCmd=c=>page.evaluate(value=>window.KaliLAN.command(value),c);
 const evalPage=fn=>page.evaluate(fn);
 try{
  await page.goto('http://127.0.0.1:8000');
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:13000});
  assert.equal(await evalPage(()=>window.KaliTour.chapters.length),6,'chapter selector definitions');
  await page.locator('#ob-chapters').click();
  assert.equal(await page.locator('#ob-chapter-list button').count(),6);
  await page.locator('#ob-chapter-list button').nth(1).click();
  assert.equal(await evalPage(()=>window.KaliTour.index),await evalPage(()=>window.KaliTour.chapters[1].start));
  await page.locator('#ob-chapters').click();
  await page.locator('#ob-chapter-list button').nth(3).click();
  assert.equal(await evalPage(()=>window.KaliTour.index),await evalPage(()=>window.KaliTour.chapters[3].start));
  // Preserve a chapter checkpoint across restart without losing any study records.
  await evalPage(()=>window.KaliTour.restart());
  assert.equal(await page.locator('#ob-resume').isVisible(),true,'resume chapter should be available');
  await page.locator('#ob-resume').click();
  assert.equal(await evalPage(()=>window.KaliTour.index),await evalPage(()=>window.KaliTour.chapters[3].start));
  await page.locator('#ob-skip').click();
  assert.equal(await page.locator('#onboard-root').isVisible(),false);
  await page.locator('#terminal').waitFor({state:'visible'});
  await evalPage(()=>window.KaliLAN.missionStart());
  assert.equal(await evalPage(()=>window.KaliLAN.hostOnline),true);
  assert.equal(await evalPage(()=>window.KaliLAN.web.running),false);
  assert.equal((await evalCmd('ping 192.0.2.20')).ok,true,'ping must work if HTTP alone is down');
  assert.equal(await evalPage(()=>window.KaliLAN.request('http://training.lab',{head:true}).status),503);
  const localRestart=await evalCmd('sudo systemctl restart lab-web');
  assert.equal(localRestart.ok,false,'cannot restart remote service from Kali');
  assert.equal(localRestart.reason,'location');
  assert.equal((await evalCmd('ssh root@192.0.2.20')).ok,false);
  assert.equal((await evalCmd('ssh trainee@203.0.113.9')).ok,false);
  assert.equal((await evalCmd('ssh trainee@192.0.2.20')).ok,true);
  assert.equal((await evalCmd('whoami')).lines[0],'trainee');
  assert.equal((await evalCmd('hostname')).lines[0],'web01');
  assert.equal((await evalCmd('pwd')).lines[0],'/home/trainee');
  assert.equal((await evalCmd('ls /var/log')).lines[0],'auth.log');
  assert.equal((await evalCmd('cat /var/log/auth.log')).ok,true);
  assert.equal((await evalCmd('systemctl restart lab-web')).reason,'permission','sudo must be required');
  assert.equal((await evalCmd('sudo systemctl status lab-web')).ok,true);
  assert.equal((await evalCmd('sudo systemctl restart lab-web')).ok,true);
  assert.equal(await evalPage(()=>window.KaliLAN.web.running),true);
  assert.equal((await evalCmd('web-fix headers')).ok,true);
  assert.equal((await evalCmd('exit')).ok,true);
  assert.equal((await evalCmd('cat /var/log/auth.log')).reason,'location');
  assert.equal(await evalPage(()=>window.KaliLAN.request('http://training.lab').status),200);
  assert.ok((await evalPage(()=>window.KaliLAN.request('http://training.lab').headers)).some(x=>x.includes('Content-Security-Policy')));
  await evalPage(()=>window.KaliLAN.setHostPower(false));
  assert.equal(await evalPage(()=>window.KaliLAN.devices().find(n=>n.id==='web').online),false);
  assert.equal((await evalCmd('ping 192.0.2.20')).reason,'host');
  assert.equal((await evalCmd('ping 192.0.2.1')).ok,true,'router works when web server off');
  assert.equal(await evalPage(()=>window.KaliLAN.request('http://training.lab').status),0,'host off is not HTTP 503');
  assert.equal((await evalCmd('ssh trainee@192.0.2.20')).reason,'host');
  await evalPage(()=>window.KaliLAN.setHostPower(true));
  assert.equal((await evalCmd('ssh trainee@192.0.2.20')).ok,true);
  assert.equal((await evalCmd('sudo systemctl restart lab-web')).ok,true);
  await page.evaluate(()=>window.KaliLANUI.openMap());
  await page.locator('#lan-map').waitFor({state:'visible'});
  await page.locator('#lan-topology .lan-device[data-device="web"]').click();
  assert.match(await page.locator('#lan-device-detail').innerText(),/Host: ONLINE.*HTTP: RUNNING/s);
  await page.locator('#lan-map .lan-close').click();
  assert.deepEqual(errors,[]);
  console.log('PASS '+name+' chapter resume, remote SSH identity/permissions, host-vs-HTTP outages, shared web state');
 }catch(e){
  await page.screenshot({path:'/tmp/ssh-chapters-'+name+'.png',fullPage:true});
  throw new Error(name+': '+e.stack);
 }finally{await context.close()}
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{for(const config of configs)await verify(browser,config)}finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
