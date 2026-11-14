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
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const checks=[];const check=(n,f)=>{assert.ok(f,n);checks.push(n);console.log('PASS '+n);};
 await page.goto(BASE+'dev.html');
 await page.waitForFunction(()=>window.OttoPlexDev);
 const frame=page.frameLocator('#previewFrame');
 await frame.locator('#executeNow').waitFor({timeout:15000});
 check('Dev page and planner are separate pages',page.url().endsWith('/dev.html'));
 check('Preview embeds the planner page',(await page.locator('#previewFrame').getAttribute('src'))==='index.html');
 // live theme change propagates into the preview
 await page.locator('#cfgAccentHex').fill('#159b79');
 await page.locator('#cfgAccentHex').dispatchEvent('change');
 await page.waitForTimeout(250);
 const accent=await frame.locator('body').evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blue').trim());
 check('Theme colour applies live in preview',accent==='#159b79');
 // font size
 await page.locator('#cfgSize').fill('17');await page.locator('#cfgSize').dispatchEvent('change');
 await page.waitForTimeout(200);
 const fs=await frame.locator('body').evaluate(()=>getComputedStyle(document.body).fontSize);
 check('Font size applies live in preview',fs==='17px');
 // copy text
 await page.locator('#cfgTitle').fill('巡检航线实验室');
 await page.waitForTimeout(150);
 const h1=await frame.locator('.heading h1').textContent();
 check('Copy text applies live in preview',h1==='巡检航线实验室');
 // canvas size
 await page.locator('#cfgScene').fill('600');await page.locator('#cfgScene').dispatchEvent('change');
 await page.waitForTimeout(250);
 const sceneH=await frame.locator('#scene').evaluate(el=>Math.round(el.getBoundingClientRect().height));
 check('Canvas height applies live in preview',Math.abs(sceneH-600)<=2);
 // snippets
 const iframeCode=await page.locator('#codeIframe').textContent();
 check('Embed snippet carries encoded config',/src="http.*\?cfg=[A-Za-z0-9_-]+"/.test(iframeCode));
 const apiCode=await page.locator('#codeApi').textContent();
 check('API snippet documents the loader',/api\.js/.test(apiCode)&&/OttoPlexDronePlanner/.test(apiCode));
 const install=await page.locator('#codeInstall').textContent();
 check('Install snippet present',/plugin_manager install_bundle/.test(install));
 // copy button writes to clipboard
 await page.locator('[data-copy="codeIframe"]').click();
 await page.waitForTimeout(200);
 const clip=await page.evaluate(()=>navigator.clipboard.readText());
 check('Copy button copies snippet',clip===iframeCode.trim());
 check('Copy shows confirmation',/已复制/.test(await page.locator('#toast').textContent()));
 // device width
 await page.locator('.devices button[data-w="390"]').click();
 await page.waitForTimeout(200);
 const fw=await page.locator('#previewFrame').evaluate(el=>Math.round(el.getBoundingClientRect().width));
 check('Device preset resizes preview',fw<=390);
 // config in URL renders standalone
 const url=await page.locator('#openConfigured').getAttribute('href');
 const solo=await ctx.newPage();
 await solo.goto(url);
 await solo.waitForFunction(()=>window.OttoPlexDronePlanner);
 await solo.waitForTimeout(300);
 const soloAccent=await solo.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blue').trim());
 check('URL config renders standalone page',soloAccent==='#159b79'&&await solo.locator('.heading h1').textContent()==='巡检航线实验室');
 // api loader inside a host page
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
