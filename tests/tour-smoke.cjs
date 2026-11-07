
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const configs=[
 {name:'desktop',width:1366,height:768},
 {name:'mobile',width:390,height:844},
 {name:'small',width:320,height:640}
];
const selectors=[
 null,'#menu-btn',null,'#menu-panel button[data-open="wifi"]',null,
 '#wifi .net.target button',null,'#wifi [data-close="wifi"]',
 '.desktop-shortcuts [data-open="terminal"]',null,'#shell-input',null,
 '#terminal [data-close="terminal"]','.desktop-shortcuts [data-open="files"]',null,
 '#file-sidebar [data-place="lab-files"]',null,'#files [data-close="files"]',
 '.desktop-shortcuts [data-open="guide"]',null,'#guide [data-close="guide"]',
 '.desktop-shortcuts [data-open="appearance"]',null,'#wallpaper-choice',null,
 '#appearance [data-close="appearance"]',null,null
];
async function testTour(browser,config){
 const errors=[];
 const context=await browser.newContext({viewport:{width:config.width,height:config.height},isMobile:config.name!=='desktop',hasTouch:config.name!=='desktop'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const stepInfo=async()=>({
    number:await page.locator('#ob-number').innerText(),
    title:await page.locator('#ob-title').innerText()
 });
 try{
  await page.goto('http://127.0.0.1:8000',{waitUntil:'load'});
  assert.equal(await page.locator('#power-layer').isVisible(),true,'power screen must appear first');
  await page.locator('#power-start').click({timeout:8000});
  await page.locator('#power-layer').waitFor({state:'hidden',timeout:15000});
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:9000});
  for(let i=0;i<28;i++){
   const number=await page.locator('#ob-number').innerText();
   assert.ok(number.startsWith(String(i+1).padStart(2,'0')),'unexpected tour step '+(i+1)+': '+number);
   try{
    if(i===10){await page.locator('#shell-input').fill('help');await page.locator('#shell-input').press('Enter')}
    else if(i===23)await page.locator('#wallpaper-choice').selectOption('graphite');
    else if(selectors[i])await page.locator(selectors[i]).click({timeout:7000});
    else await page.locator('#ob-next').click({timeout:7000});
    if(i<27){await page.waitForFunction(expected=>document.getElementById('ob-number')?.textContent?.startsWith(String(expected).padStart(2,'0')),i+2,{timeout:4000})}
   }catch(e){
    await page.screenshot({path:'/tmp/tour-'+config.name+'-step'+(i+1)+'.png',fullPage:true});
    throw new Error('Failed at '+JSON.stringify(await stepInfo())+' target='+selectors[i]+': '+e.message);
   }
  }
  await page.locator('#onboard-root').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('kali-sim-tour-v1-complete')),'yes');
  await page.reload();
  await page.locator('#power-start').click();
  await page.locator('#power-layer').waitFor({state:'hidden',timeout:15000});
  // Returning with a saved completion record must STILL start the tour after boot.
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:5000});
  assert.equal(await page.locator('#ob-number').innerText(),'01 / 28','tour should restart every boot');
  const coach=page.locator(config.name==='desktop'?'#lab-guide':'#lab-mobile-guide');
  assert.equal(await coach.isVisible(),false,'lab coach should wait for tour');
  await page.locator('#ob-skip').click();
  assert.equal(await page.locator('#onboard-root').isVisible(),false,'skip did not close tour');
  await coach.waitFor({state:'visible',timeout:5000});
  await page.locator('#terminal').waitFor({state:'visible',timeout:5000});
  await page.locator('#onboard-restart').click();
  await page.locator('#onboard-root').waitFor({state:'visible'});
  assert.equal(await coach.isVisible(),false,'coach should hide on replay');
  await page.locator('#ob-skip').click();
  await coach.waitFor({state:'visible'});
  assert.deepEqual(errors,[],'page errors');
  console.log('PASS '+config.name+' 28 steps, automatic replay on every boot, guided lab handoff');
 }finally{await context.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const config of configs)await testTour(browser,config)}
 finally{await browser.close()}
})().catch(err=>{console.error(err.stack);process.exit(1)});
