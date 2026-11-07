
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const configs=[
 {name:'desktop',width:1366,height:768},
 {name:'mobile',width:390,height:844},
 {name:'small',width:320,height:640}
];
async function testTour(browser,config){
 const errors=[];
 const context=await browser.newContext({viewport:{width:config.width,height:config.height},isMobile:config.name!=='desktop',hasTouch:config.name!=='desktop'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const current=()=>page.evaluate(()=>window.KaliTour.current);
 let latest=null;
 try{
  await page.goto('http://127.0.0.1:8000',{waitUntil:'load'});
  assert.equal(await page.locator('#power-layer').isVisible(),true,'power screen must appear first');
  await page.locator('#power-start').click({timeout:8000});
  await page.locator('#power-layer').waitFor({state:'hidden',timeout:15000});
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:9000});
  const length=await page.evaluate(()=>window.KaliTour.length);
  assert.ok(length>=75,'tour should teach all old and new applications; got '+length);
  assert.equal(await page.evaluate(()=>window.KaliTourReference.count),18,'missing icons in summary');
  const originally=await page.evaluate(()=>window.KaliCurriculum.snapshot().active);
  for(let i=0;i<length;i++){
   const number=await page.locator('#ob-number').innerText();
   assert.equal(number,String(i+1).padStart(2,'0')+' / '+length,'unexpected step at '+i);
   latest=await current();
   try{
    if(latest.mode==='command'){
     await page.locator('#shell-input').fill('help');
     await page.locator('#shell-input').press('Enter');
    }else if(latest.mode==='change'){
     await page.locator('#wallpaper-choice').selectOption('graphite');
    }else if(latest.mode==='click'){
     assert.ok(latest.target,'click stage needs a target');
     await page.locator(latest.target).first().click({timeout:9500});
    }else{
     await page.locator('#ob-next').click({timeout:9500});
    }
    if(i<length-1){
     await page.waitForFunction(expected=>window.KaliTour.index===expected,i+1,{timeout:5000});
    }
   }catch(e){
    await page.screenshot({path:'/tmp/tour-'+config.name+'-step'+(i+1)+'.png',fullPage:true});
    throw new Error('Failed step '+(i+1)+' title='+latest.title+' target='+latest.target+': '+e.message);
   }
  }
  await page.locator('#onboard-icon-reference').waitFor({state:'visible',timeout:5000});
  assert.equal(await page.locator('#onboard-root').isVisible(),true,'last popup should come before tour completion');
  assert.equal(await page.locator('#ob-ref-list .ob-ref-item').count(),18);
  assert.match(await page.locator('#ob-ref-list').innerText(),/Firefox SIM|Learning Center|Network Map/);
  await page.locator('#ob-ref-done').click();
  await page.locator('#onboard-icon-reference').waitFor({state:'hidden'});
  await page.locator('#onboard-root').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().active),originally,'tour changed selected study course');
  assert.equal(await page.evaluate(()=>localStorage.getItem('kali-sim-tour-v1-complete')),'yes');
  assert.equal(await page.evaluate(()=>window.KaliLAN.mission.started),false,'tour accidentally started a destructive incident');
  await page.locator('#onboard-icons').click();
  await page.locator('#onboard-icon-reference').waitFor({state:'visible'});
  assert.match(await page.locator('#ob-ref-done').innerText(),/닫기/);
  await page.locator('#ob-ref-x').click();
  await page.locator('#onboard-icon-reference').waitFor({state:'hidden'});
  await page.reload();
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:13000});
  assert.equal(await page.locator('#ob-number').innerText(),'01 / '+length,'tour must restart after every power-on');
  const coach=page.locator(config.name==='desktop'?'#lab-guide':'#lab-mobile-guide');
  assert.equal(await coach.isVisible(),false,'lab coach appears during tutorial');
  await page.locator('#ob-skip').click();
  assert.equal(await page.locator('#onboard-root').isVisible(),false);
  await coach.waitFor({state:'visible',timeout:6000});
  await page.locator('#terminal').waitFor({state:'visible',timeout:6000});
  // Replaying the tour does not erase the last selected course.
  await page.evaluate(()=>window.KaliCurriculum.selectTrack('web'));
  await page.locator('#onboard-restart').click();
  await page.locator('#onboard-root').waitFor({state:'visible'});
  await page.evaluate(()=>window.KaliCurriculum.selectTrack('sandbox'));
  await page.locator('#ob-skip').click();
  assert.equal(await page.evaluate(()=>window.KaliCurriculum.snapshot().active),'web','skip should restore original course');
  assert.equal(await page.locator('#onboard-icon-reference').isVisible(),false,'skip should not open end popup');
  assert.deepEqual(errors,[],'browser JS runtime errors');
  console.log('PASS '+config.name+' '+length+' interactive tour steps + 18 icon summary + persistence + skip / replay / course restoration');
 }finally{await context.close()}
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{for(const config of configs)await testTour(browser,config)}
 finally{await browser.close()}
})().catch(err=>{console.error(err.stack);process.exit(1)});
