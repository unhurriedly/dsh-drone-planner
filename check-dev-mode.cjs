/**
 * 合并后单页两 tab（航线规划 / 开发配置）的端到端验收。
 * 需要本机 Playwright 与 Chrome；PW / CHROME / BASE 可用环境变量覆盖。
 * BASE 指向插件路由根（以 / 结尾）。
 */
const {chromium}=require(process.env.PW || 'playwright');
const CHROME=process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE=process.env.BASE || 'http://127.0.0.1:58150/dsh-drone-planner/';
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({executablePath:CHROME,headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
 const page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const checks=[];const check=(name,fn)=>{assert.ok(fn,name);checks.push(name);console.log('PASS '+name);};
 const ready=()=>page.waitForFunction(()=>window.PlannerDemo&&!PlannerDemo.state.busy&&PlannerDemo.state.config);

 await page.goto(BASE);await ready();
 // 1. one page, two tabs
 const tabs=await page.locator('.module-tabs [role="tab"]').allTextContents();
 check('Single page hosts both modules as tabs',tabs.length===2&&tabs[0]==='航线规划'&&tabs[1]==='开发配置');
 check('Planner tab active by default',await page.locator('#planner-page').isVisible()&&await page.locator('#dev-page').isHidden());
 check('Planner still generates routes',await page.evaluate(()=>PlannerDemo.state.points.length>0));

 // 立即执行 属于航线规划 tab（放在画布工具条右侧）
 const execBox=await page.locator('#executeNow').boundingBox();
 const toolbarBox=await page.locator('.toolbar').first().boundingBox();
 check('立即执行 lives in the planner toolbar',execBox&&toolbarBox&&execBox.y>=toolbarBox.y-2&&execBox.y+execBox.height<=toolbarBox.y+toolbarBox.height+2);
 check('立即执行 is visible on the planner tab',await page.locator('#executeNow').isVisible());

 // 2. legacy /dev.html route still lands on the dev tab
 const legacy=await ctx.newPage();
 await legacy.goto(BASE+'dev.html');
 await legacy.waitForTimeout(900);
 check('Legacy dev.html redirects into the dev tab',/tab=dev/.test(legacy.url())&&await legacy.locator('#dev-page').isVisible());
 await legacy.close();

 // 3. tab switching + deep link + keyboard
 await page.locator('#tab-dev').click();
 await page.waitForTimeout(300);
 check('Clicking 开发配置 shows the dev panel',await page.locator('#dev-page').isVisible()&&await page.locator('#planner-page').isHidden());
 check('URL records the active tab',/tab=dev/.test(page.url()));
 await page.locator('#tab-planner').focus();
 await page.keyboard.press('ArrowRight');
 await page.waitForTimeout(200);
 check('Arrow keys move between tabs',/tab=dev/.test(page.url())&&await page.locator('#dev-page').isVisible());
 const deep=await ctx.newPage();
 await deep.goto(BASE+'?tab=dev');
 await deep.waitForTimeout(700);
 check('?tab=dev deep-links to the dev tab',await deep.locator('#dev-page').isVisible());
 await deep.close();

 // 4. dev layout
 await page.locator('#tab-dev').click();
 await page.waitForTimeout(300);
 check('No back-to-planner button',await page.locator('a:has-text("返回")').count()===0);
 check('立即执行 is not shown on the dev tab',await page.locator('#executeNow').isHidden());
 check('Heading no longer carries the action cluster',await page.locator('.heading-actions').count()===0);
 check('Config editor and code snippets sit side by side',await page.evaluate(()=>{
   const a=document.querySelector('.dev-editor').getBoundingClientRect();
   const b=document.querySelector('.dev-code-column').getBoundingClientRect();
   return b.left>a.right-1&&Math.abs(a.top-b.top)<2;
 }));
 check('Live preview panel removed',await page.locator('#previewFrame').count()===0&&await page.locator('.devices').count()===0&&await page.locator('#reloadPreview').count()===0);
 check('Config is a code editor, not form controls',await page.locator('#cfgCode').count()===1&&await page.locator('#cfgAccentHex').count()===0);

 // 5. apply / error / reset
 await page.locator('#cfgCode').fill("const config = { accent: '#159b79', size: 17, sceneH: 600, title: '巡检航线实验室' };");
 await page.waitForTimeout(650);
 const applied=await page.evaluate(()=>window.OttoPlexDev.getConfig());
 check('Editing code applies the config',applied.accent==='#159b79'&&applied.size===17&&applied.sceneH===600&&applied.title==='巡检航线实验室');
 check('Apply status reports success',/已应用/.test(await page.locator('#cfgStatus').textContent()));
 const docAccent=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blue').trim());
 check('Config applies to this page too',docAccent==='#159b79');
 await page.locator('#cfgCode').fill('const config = { accent: ');
 await page.waitForTimeout(650);
 const afterBad=await page.evaluate(()=>window.OttoPlexDev.getConfig());
 check('Broken code errors and keeps the last config',/解析失败/.test(await page.locator('#cfgStatus').textContent())&&afterBad.accent==='#159b79');

 // 6. the planner tab itself carries the applied look (no preview needed)
 await page.locator('#tab-planner').click();
 await page.waitForTimeout(500);
 const scene=await page.locator('#scene').evaluate(el=>({h:Math.round(el.getBoundingClientRect().height),w:el.width}));
 check('Planner canvas redraws after tab switch',Math.abs(scene.h-600)<=2&&scene.w>0);

 // 8. snippets + copy
 await page.locator('#tab-dev').click();
 await page.waitForTimeout(250);
 await page.locator('#resetConfig').click();
 await page.waitForTimeout(450);
 const reset=await page.evaluate(()=>window.OttoPlexDev.getConfig());
 check('Reset restores default code',reset.accent==='#4459f5'&&reset.sceneH===520);
 const iframeCode=await page.locator('#codeIframe').textContent();
 const apiCode=await page.locator('#codeApi').textContent();
 const install=await page.locator('#codeInstall').textContent();
 check('Embed snippet carries tab + encoded config',/src="http.*tab=planner&cfg=[A-Za-z0-9_-]+"/.test(iframeCode));
 check('API snippet documents the loader',/api\.js/.test(apiCode)&&/OttoPlexDronePlanner/.test(apiCode));
 check('Install snippet lists marketplace and GitHub paths',/插件市场/.test(install)&&/github:unhurriedly\/dsh-drone-planner/.test(install));
 await page.locator('[data-copy="codeIframe"]').click();
 await page.waitForTimeout(250);
 const clip=await page.evaluate(()=>navigator.clipboard.readText());
 check('Copy button copies snippet',clip.trim()===iframeCode.trim());

 // 9. official link + standalone URL config
 const official=page.locator('#openOfficial');
 check('Open-in-new-tab targets the planner tab',/\?tab=planner$/.test(await official.getAttribute('href'))&&await official.getAttribute('target')==='_blank');
 const url=(iframeCode.match(/src="([^"]+)"/)||[])[1];
 const solo=await ctx.newPage();
 await solo.goto(url);
 await solo.waitForFunction(()=>window.PlannerDemo&&!PlannerDemo.state.busy);
 await solo.waitForTimeout(300);
 const soloAccent=await solo.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--blue').trim());
 check('URL config renders the planner standalone',soloAccent==='#4459f5'&&await solo.locator('#planner-page').isVisible());
 await solo.close();

 // 10. api.js loader
 const host=await ctx.newPage();
 await host.goto(BASE+'?tab=dev');
 const mounted=await host.evaluate(async(origin)=>{
   document.body.innerHTML='<div id="mount"></div>';
   await new Promise((res,rej)=>{const s=document.createElement('script');s.src=origin+'api.js';s.onload=res;s.onerror=rej;document.head.appendChild(s);});
   const app=window.OttoPlexDronePlanner.mount('#mount',{accent:'#a855ce',height:700});
   await new Promise(r=>setTimeout(r,900));
   const f=document.querySelector('#mount iframe');
   return {has:!!f,src:f&&f.src,h:app.getConfig().height,version:window.OttoPlexDronePlanner.version};
 },BASE);
 check('api.js mounts an iframe with config',mounted.has&&/\?cfg=/.test(mounted.src)&&mounted.h===700&&mounted.version==='1.0.0');

 // 11. narrow widths stay usable
 const narrow=await ctx.newPage();
 await narrow.setViewportSize({width:390,height:844});
 await narrow.goto(BASE+'?tab=dev');
 await narrow.waitForTimeout(800);
 check('Dev tab has no horizontal overflow on mobile',await narrow.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
 await narrow.close();

 check('No browser runtime errors',errors.length===0);
 await browser.close();
 console.log(`${checks.length} dev-mode checks passed.`);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
