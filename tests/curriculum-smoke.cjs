
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const sequences={
 linux:['pwd','ls','mkdir training','cd training','touch notes.txt','ls -l'],
 network:['ip a','ip route','ping 192.0.2.1','nslookup training.lab','curl -I http://training.lab'],
 web:['curl http://demo.lab','curl -I http://demo.lab','web-audit demo.lab','ssh trainee@192.0.2.20','web-fix headers','web-fix access','web-fix output','exit','web-verify demo.lab'],
 forensics:['ssh trainee@192.0.2.20','ls /var/log','cat /var/log/auth.log','grep "Failed password" /var/log/auth.log','exit','sha256sum /cases/evidence.txt','forensic-report']
};
const names={linux:'리눅스 기초',network:'네트워크 기초',web:'웹 보안',forensics:'로그·디지털 포렌식'};
const configs=[['desktop',1366,768],['mobile',390,844]];
async function test(browser,[label,width,height]){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:label==='mobile',hasTouch:label==='mobile'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8000');
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:12000});
  await page.locator('#ob-skip').click();
  assert.ok(await page.locator('#terminal').isVisible());
  for(const key of ['linux','network','web','forensics']){
   await page.locator(label==='desktop'?'.desktop-shortcuts .course-shortcut':'#course-dock').click();
   await page.locator('#courses').waitFor({state:'visible'});
   await page.locator('#course-list button').filter({hasText:names[key]}).click();
   await page.locator('#course-start').click();
   await page.locator('#courses').waitFor({state:'hidden'});
   await page.locator('#terminal').waitFor({state:'visible'});
   for(let i=0;i<sequences[key].length;i++){
    const cmd=sequences[key][i];
    await page.locator('#shell-input').fill(cmd);await page.locator('#shell-input').press('Enter');
    const next=i+1;
    await page.waitForFunction(args=>
      Number(window.KaliCurriculum.snapshot().progress[args.key])===args.next,
      {key,next},{timeout:6000});
    assert.equal(await page.locator('#course-coach').count(),1);
   }
   console.log('PASS '+label+' '+key+' '+sequences[key].length+'/' + sequences[key].length);
  }
  const hashOutput=await page.locator('#log').innerText();
  assert.match(hashOutput,/[0-9a-f]{64}\s+\/cases\/evidence\.txt/,'real SHA-256 should be shown');
  // The local AP is independently stateful.
  await page.locator('.panel-left [data-open="wifi"]').click();
  await page.locator('#wifi').waitFor({state:'visible'});
  await page.locator('#sim-ap-power').uncheck();
  assert.equal(await page.locator('#nets .net.target').count(),0,'powered-off AP should disappear');
  await page.locator('#sim-ap-power').check();
  assert.equal(await page.locator('#nets .net.target').count(),1,'AP should reappear after power-on');
  await page.locator('#sim-channel').selectOption('11');
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.channel),11);
  await page.locator('#sim-weakpass').selectOption('not-in-dictionary');
  assert.equal(await page.evaluate(()=>window.KaliNetwork.ap.psk),'not-in-dictionary');
  await page.locator('#sim-weakpass').selectOption('coffee2026');
  await page.locator('#sim-reconnect').click();
  assert.ok(await page.evaluate(()=>window.KaliNetwork.client.lastEvent)>0);
  await page.locator('#wifi [data-close="wifi"]').click();
  await page.reload();
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:12000});
  await page.locator('#ob-skip').click();
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().progress.web),9,'web progress should persist');
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().progress.forensics),7,'forensics progress should persist');
  assert.deepEqual(errors,[]);
  console.log('PASS '+label+' curriculum 23/23, network state, SHA-256, persistence');
 }catch(e){
  await page.screenshot({path:'/tmp/curriculum-'+label+'.png',fullPage:true});
  throw new Error(label+' '+e.message)
 }finally{await ctx.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const c of configs)await test(browser,c)}finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
