
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const configs=[['desktop',1366,768],['mobile',390,844],['small',320,640]];
async function run(browser,[name,width,height]){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:name!=='desktop',hasTouch:name!=='desktop'});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const current=()=>page.evaluate(()=>window.KaliTour.index);
 const visibility=selector=>page.locator(selector).evaluate(el=>{
  const r=el.getBoundingClientRect(),v=el.closest('#wifi .window-body')?.getBoundingClientRect();
  return {shown:!!v&&r.top>=v.top-2&&r.bottom<=v.bottom+2,top:r.top,bottom:r.bottom,viewport:v&&[v.top,v.bottom]};
 });
 async function infoStep(){
  await page.locator('#ob-next').click();
  await page.locator('#menu-btn').click();
  await page.locator('#ob-next').click();
  await page.locator('#menu-panel button[data-open="wifi"]').click();
  await page.locator('#ob-next').click();
  assert.equal(await current(),5,'not on guided Info button stage');
 }
 try{
  await page.goto('http://127.0.0.1:8000',{waitUntil:'load'});
  await page.locator('#power-start').click();
  await page.locator('#onboard-root').waitFor({state:'visible',timeout:14000});
  await infoStep();
  assert.equal(await page.locator('#sim-radio').evaluate(x=>x.open),false,'advanced settings hide Info button');
  const target=page.locator('#wifi .net.target button');
  await target.waitFor({state:'visible'});
  await page.waitForFunction(()=>{
   const el=document.querySelector('#wifi .net.target button'),v=document.querySelector('#wifi .window-body');
   if(!el||!v)return false;const r=el.getBoundingClientRect(),c=v.getBoundingClientRect();
   return r.top>=c.top-2&&r.bottom<=c.bottom+2;
  },null,{timeout:4000});
  assert.equal((await visibility('#wifi .net.target button')).shown,true,'info button outside scroller');
  await target.click();
  await page.waitForFunction(()=>window.KaliTour.index===6);
  await page.locator('#net-info').waitFor({state:'visible'});
  assert.match(await page.locator('#net-info').innerText(),/BSSID|채널|보안 방식/);
  assert.equal(await page.locator('#wifi .net.target').evaluate(x=>x.nextElementSibling?.id),'net-info',
   'information should appear adjacent to clicked network');
  await page.waitForFunction(()=>{
   const el=document.querySelector('#net-info'),v=document.querySelector('#wifi .window-body');
   if(!el||!v)return false;const r=el.getBoundingClientRect(),c=v.getBoundingClientRect();
   return r.top>=c.top-2&&r.bottom<=c.bottom+2;
  },null,{timeout:4000});
  assert.equal((await visibility('#net-info')).shown,true,'Info panel hidden beneath viewport');
  // The controller now expands automatically at the later advanced Wi-Fi tutorial chapter.
  await page.evaluate(()=>window.KaliNetwork.setOnline(false));
  await page.locator('#onboard-restart').click();
  await infoStep();
  assert.equal(await page.locator('#sim-radio').evaluate(x=>x.open),true,'AP-off recovery control should open');
  assert.equal(await page.locator('#wifi .net.target button').count(),0,'offline AP should not appear');
  assert.match(await page.locator('#ob-title').innerText(),/꺼져/);
  await page.locator('#sim-ap-power').check();
  await page.waitForFunction(()=>window.KaliNetwork.ap.online);
  assert.equal(await current(),5,'turning AP on should not skip information step');
  await page.locator('#wifi .net.target button').click();
  await page.waitForFunction(()=>window.KaliTour.index===6);
  await page.locator('#net-info').waitFor({state:'visible'});
  assert.match(await page.locator('#net-info').innerText(),/BSSID/);
  await page.locator('#ob-skip').click();
  assert.equal(await page.locator('#onboard-root').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS '+name+' Info button and details visibly aligned; offline AP recovery; no skipped tour steps');
 }catch(e){
  await page.screenshot({path:'/tmp/info-'+name+'.png',fullPage:true});
  throw new Error(name+': '+e.stack);
 }finally{await ctx.close()}
}
(async()=>{const b=await chromium.launch({headless:true,args:['--no-sandbox']});
try{for(const c of configs)await run(b,c)}finally{await b.close()}
})().catch(e=>{console.error(e.stack);process.exit(1)});
