
const {chromium}=require('playwright'), assert=require('node:assert/strict');
const configs=[
 {name:'desktop',width:1366,height:768,mobile:false},
 {name:'mobile',width:390,height:844,mobile:true},
 {name:'compact',width:320,height:640,mobile:true},
 {name:'landscape',width:844,height:390,mobile:true}
];
async function check(browser,config){
 const context=await browser.newContext({
  viewport:{width:config.width,height:config.height},
  isMobile:config.mobile,hasTouch:config.mobile
 });
 const page=await context.newPage(),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:8000/'))missing.push(r.status()+' '+r.url())});
 const evalPage=(fn,arg)=>page.evaluate(fn,arg);
 try{
  await page.goto('http://127.0.0.1:8000',{waitUntil:'load'});
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:14000});
  assert.equal(await page.locator('#ob-number').innerText(),'01 / 79');
  const card=await page.locator('#onboard-card').boundingBox();
  assert.ok(card&&card.x>=-1&&card.y>=-1&&card.x+card.width<=config.width+1&&card.y+card.height<=config.height+1,'tour intro card outside viewport: '+JSON.stringify(card));
  await page.locator('#ob-skip').click();
  await page.locator('#terminal').waitFor({state:'visible'});
  assert.equal(await page.locator('#onboard-root').isVisible(),false);
  assert.equal(await page.locator('#router #secret').getAttribute('type'),'password','saved virtual passphrase should be masked');
  assert.match(await page.locator('#router .sub').innerText(),/로컬 저장소/,'local persistence disclosure missing');
  // Quick commands should stay under the chosen course when Wi-Fi settings change.
  for(const track of ['network','web','sandbox','wireless']){
   await evalPage(id=>window.KaliCurriculum.selectTrack(id),track);
   const before=await page.locator('#quick').innerText();
   const expected={network:'ip a',web:'curl http://demo.lab',sandbox:'incident-status',wireless:'ip a'};
   assert.ok(before.includes(expected[track]),'course '+track+' missing quick command: '+before);
   await evalPage(()=>window.KaliNetwork.setOnline(false));
   const off=await page.locator('#quick').innerText();
   assert.equal(off,before,'course '+track+' quick commands overwritten after AP off');
   await evalPage(()=>window.KaliNetwork.setOnline(true));
   const on=await page.locator('#quick').innerText();
   assert.equal(on,before,'course '+track+' quick commands overwritten after AP on');
  }
  // Web course resets progress only, not the server state shared with other courses.
  await evalPage(()=>window.KaliNetwork.connect('coffee2026'));
  await evalPage(()=>window.KaliCurriculum.selectTrack('web'));
  await evalPage(()=>window.KaliLAN.command('ssh trainee@192.0.2.20'));
  const pass=await evalPage(()=>window.KaliLAN.webFix('headers'));
  assert.equal(pass.ok,true);
  await page.locator('#shell-input').fill('curl http://demo.lab');
  await page.locator('#shell-input').press('Enter');
  await page.waitForFunction(()=>window.KaliCurriculum.snapshot().progress.web===1,{timeout:6000});
  let message='';
  page.once('dialog',d=>{message=d.message();return d.accept()});
  await evalPage(()=>window.KaliCurriculum.reset());
  assert.match(message,/서버 설정.*유지|가상 웹 서버 설정.*유지/,'reset should disclose shared server state');
  assert.equal(await evalPage(()=>window.KaliCurriculum.snapshot().progress.web),0);
  assert.equal(await evalPage(()=>window.KaliLAN.web.headers),true,'web reset must not silently reset shared server');
  // End-of-tour icon popup must be reusable independently of the active course.
  await page.evaluate(()=>window.KaliTourReference.open());
  await page.locator('#onboard-icon-reference').waitFor({state:'visible'});
  assert.equal(await page.locator('.ob-ref-item').count(),18);
  assert.match(await page.locator('#ob-ref-list').innerText(),/Firefox SIM/);
  const modal=await page.locator('.ob-ref-modal').boundingBox();
  assert.ok(modal&&modal.x>=-1&&modal.y>=-1&&modal.x+modal.width<=config.width+1&&modal.y+modal.height<=config.height+1,'icon modal outside viewport: '+JSON.stringify(modal));
  await page.keyboard.press('Escape');
  await page.locator('#onboard-icon-reference').waitFor({state:'hidden'});
  assert.equal(await evalPage(()=>window.KaliCurriculum.snapshot().active),'web','icon popup unexpectedly switched study course');
  assert.deepEqual(errors,[],config.name+' runtime errors');
  assert.deepEqual(missing,[],config.name+' missing resource');
  console.log('PASS '+config.name+' quick command isolation, truthful credential disclosure, shared web reset, icon popup bounds, Esc, resources');
 }catch(e){
  await page.screenshot({path:'/tmp/kali-extra-'+config.name+'.png',fullPage:true});
  throw new Error(config.name+': '+e.stack)
 }finally{await context.close()}
}
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{for(const c of configs)await check(browser,c)}finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
