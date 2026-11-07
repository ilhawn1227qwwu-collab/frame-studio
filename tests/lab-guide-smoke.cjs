
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const commands=[
'ip a','nmcli dev wifi list','sudo airmon-ng start wlan0','sudo airodump-ng wlan0mon',
'sudo airodump-ng --bssid 02:1A:11:20:26:01 -c 6 -w labcap wlan0mon',
'aircrack-ng -w /usr/share/wordlists/lab-demo.txt labcap-01.cap',
'sudo airmon-ng stop wlan0mon',
'nmcli dev wifi connect LAB-TRAINING password coffee2026 ifname wlan0'
];
const cases=[['desktop',1366,768],['mobile',390,844],['small',320,640]];
async function run(browser,[label,width,height]){
 const context=await browser.newContext({viewport:{width,height},isMobile:label!=='desktop',hasTouch:label!=='desktop'});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8000',{waitUntil:'load'});
  await page.locator('#power-start').click();
  await page.locator('#power-layer').waitFor({state:'hidden',timeout:13000});
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:6000});
  assert.equal(await page.locator('#lab-guide').isVisible(),false,'guide appears while tutorial is active');
  await page.locator('#ob-skip').click();
  const compact=label!=='desktop';
  const guide=page.locator(compact?'#lab-mobile-guide':'#lab-guide');
  await guide.waitFor({state:'visible',timeout:5000});
  assert.match(await page.locator('#lg-title').innerText(),/무선 장치/);
  if(compact){
   await page.locator('#lg-mobile-toggle').click();
   assert.equal(await page.locator('#lg-mobile-body').isVisible(),true);
   await page.locator('#lg-mobile-toggle').click();
   assert.equal(await page.locator('#lg-mobile-body').isVisible(),false);
  }
  for(let i=0;i<commands.length;i++){
   const input=page.locator('#shell-input');
   await input.fill(commands[i]);await input.press('Enter');
   await page.waitForFunction(expected=>document.querySelector('#lg-counter')?.textContent?.includes(String(expected)+'/9'),i+1,{timeout:6500});
   const expectedTitle=await page.locator('#lg-title').innerText();
   assert.ok(expectedTitle.length>=9);
   if(compact)assert.equal(await guide.isVisible(),true,'missing compact guide at '+(i+1));
  }
  await page.locator('#shell-input').fill('open router');
  await page.locator('#shell-input').press('Enter');
  await page.locator('#router').waitFor({state:'visible'});
  await page.locator('#security').selectOption('WPA3-SAE');
  await page.locator('#secret').fill('River-Maple-Sky-Cloud-84');
  await page.locator('#router-form button[type="submit"]').click();
  await page.locator('#shell-input').fill('lab-verify LAB-TRAINING');
  await page.locator('#shell-input').press('Enter');
  await page.waitForFunction(()=>document.querySelector('#lg-title')?.textContent.includes('모든 보안 실습'),null,{timeout:6500});
  await page.locator('#finish-close').click();
  assert.equal(await guide.isVisible(),true);
  assert.deepEqual(errors,[],'browser JS errors');
  console.log('PASS '+label+' lab 9/9 progress, coaching content, tutorial separation, controls');
 }catch(e){console.error('FAILED '+label+': '+e.message);await page.screenshot({path:'/tmp/labguide-'+label+'.png'});throw e}
 finally{await context.close()}
}
(async()=>{const b=await chromium.launch({headless:true,args:['--no-sandbox']});try{for(const c of cases)await run(b,c)}finally{await b.close()}})().catch(e=>{console.error(e.stack);process.exit(1)});
