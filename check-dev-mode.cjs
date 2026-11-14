// 开发者模式端到端检查：需要本机 Playwright 与 Chrome。
// PW / CHROME / BASE 可用环境变量覆盖；BASE 需为插件路由根（以 / 结尾）。
const {chromium}=require(process.env.PW || 'playwright');
const CHROME=process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE=process.env.BASE || 'http://127.0.0.1:58150/dsh-drone-planner/';
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:CHROME,headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message);});

 const checks=[];const check=(n,f)=>{assert.ok(f,n);checks.push(n);console.log('PASS '+n);};
 await page.goto(BASE+'dev.html');
 const devState=await page.evaluate(()=>window.OttoPlexDev&&window.OttoPlexDev.getConfig());
 check('Dev page and planner are separate pages',page.url().endsWith('/dev.html'));
 check('No back-to-planner button',await page.locator('a[href="index.html"]:has-text("返回")').count()===0);
 check('Config and code cards sit side by side',await page.evaluate(()=>{
   const a=document.querySelector('#panel-config .cols>.card').getBoundingClientRect();
   const b=document.querySelectorAll('#panel-config .cols>.card')[1].getBoundingClientRect();
   return b.left>a.right-1&&Math.abs(a.top-b.top)<2;
 }));
 check('Tabs switch between config and preview',await page.locator('#panel-config').isVisible()&&await page.locator('#panel-preview').isHidden());
 await page.locator('.tab[data-tab="preview"]').click();
 check('Preview tab reveals the planner frame',await page.locator('#panel-preview').isVisible()&&await page.locator('#panel-config').isHidden());
 await page.locator('.tab[data-tab="config"]').click();
 // config is maintained as front-end code
 const hasEditor=await page.locator('#cfgCode').count();
 check('Config is a code editor, not form controls',hasEditor===1&&await page.locator('#cfgAccentHex').count()===0);
 await page.locator('#cfgCode').fill("const config = { accent: '#159b79', size: 17, sceneH: 600, title: '巡检航线实验室' };");
 await page.waitForTimeout(600);
 const applied=await page.evaluate(()=>window.OttoPlexDev.getConfig());
 check('Editing code applies the config',applied.accent==='#159b79'&&applied.size===17&&applied.sceneH===600&&applied.title==='巡检航线实验室');
 check('Apply status reports success',/已应用/.test(await page.locator('#cfgStatus').textContent()));
 // invalid code keeps last good config
 await page.locator('#cfgCode').fill('const config = { accent: ');
 await page.waitForTimeout(600);
 const afterBad=await page.evaluate(()=>window.OttoPlexDev.getConfig());
 check('Broken code shows an error and keeps the last config',/解析失败/.test(await page.locator('#cfgStatus').textContent())&&afterBad.accent==='#159b79');
 // reset restores defaults
 await page.locator('#resetConfig').click();
 await page.waitForTimeout(400);
 const reset=await page.evaluate(()=>window.OttoPlexDev.getConfig());
 check('Reset restores default code',reset.accent==='#4459f5'&&reset.sceneH===520);
 // apply the custom config again for the preview/URL checks
 await page.locator('#cfgCode').fill("const config = { accent: '#159b79', size: 17, sceneH: 600, title: '巡检航线实验室' };");
 await page.waitForTimeout(600);
 await page.locator('.tab[data-tab="preview"]').click();
 const frame=page.frameLocator('#previewFrame');
 await frame.locator('#executeNow').waitFor({timeout:15000});
 await page.waitForTimeout(400);
 const live=await frame.locator('body').evaluate(()=>({
   accent:getComputedStyle(document.documentElement).getPropertyValue('--blue').trim(),
   size:getComputedStyle(document.body).fontSize,
   title:document.querySelector('.heading h1').textContent,
   scene:Math.round(document.getElementById('scene').getBoundingClientRect().height)
 }));
 check('Preview applies theme live',live.accent==='#159b79');
 check('Preview applies font size live',live.size==='17px');
 check('Preview applies copy live',live.title==='巡检航线实验室');
 check('Preview applies canvas size live',Math.abs(live.scene-600)<=2);
 // snippets
 await page.locator('.tab[data-tab="config"]').click();
 const iframeCode=await page.locator('#codeIframe').textContent();
 const apiCode=await page.locator('#codeApi').textContent();
 const install=await page.locator('#codeInstall').textContent();
 check('Embed snippet carries encoded config',/src="http.*\?cfg=[A-Za-z0-9_-]+"/.test(iframeCode));
 check('API snippet documents the loader',/api\.js/.test(apiCode)&&/OttoPlexDronePlanner/.test(apiCode));
 check('Install snippet present',/plugin_manager install_bundle/.test(install));
 await page.locator('[data-copy="codeIframe"]').click();
 await page.waitForTimeout(250);
 const clip=await page.evaluate(()=>navigator.clipboard.readText());
 check('Copy button copies snippet',clip.trim()===iframeCode.trim());
 check('Copy shows confirmation',/已复制/.test(await page.locator('#toast').textContent()));
 // config in URL renders standalone
 const url=await page.locator('#openConfigured').getAttribute('href');
 const solo=await ctx.newPage();
 await solo.goto(url);
 await solo.waitForFunction(()=>window.OttoPlexDronePlanner);
 await solo.waitForTimeout(300);
 const soloAccent=await solo.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blue').trim());
 check('URL config renders standalone page',soloAccent==='#159b79'&&await solo.locator('.heading h1').textContent()==='巡检航线实验室');
 // main page has no developer-mode entry
 const main=await ctx.newPage();
 await main.goto(BASE);
 await main.waitForFunction(()=>window.PlannerDemo&&!PlannerDemo.state.busy);
 check('Main page exposes no developer-mode entry',await main.locator('a[href*="dev.html"]').count()===0);
 // api.js loader
 const host=await ctx.newPage();
 await host.goto(BASE+'dev.html');
 const mounted=await host.evaluate(async(origin)=>{
   document.body.innerHTML='<div id="mount"></div>';
   await new Promise((res,rej)=>{const s=document.createElement('script');s.src=origin+'api.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
   const app=window.OttoPlexDronePlanner.mount('#mount',{accent:'#a855ce',height:700});
   await new Promise(r=>setTimeout(r,900));
   const f=document.querySelector('#mount iframe');
   return {has:!!f,src:f&&f.src,h:app.getConfig().height,version:window.OttoPlexDronePlanner.version};
 },BASE);
 check('api.js mounts an iframe with config',mounted.has&&/\?cfg=/.test(mounted.src)&&mounted.h===700&&mounted.version==='1.0.0');
 check('No browser runtime errors',errors.length===0);
 await browser.close();
 console.log(`${checks.length} dev-mode checks passed.`);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
