// 需要本机 Playwright 与 Chrome；可用 PW / CHROME / BASE 环境变量覆盖路径与地址。
// 默认地址为 Harness 插件面板路由；也可先 python3 -m http.server 8765 再设 BASE=http://127.0.0.1:8765/
const {chromium}=require(process.env.PW || 'playwright');
const CHROME=process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE=process.env.BASE || 'http://127.0.0.1:58150/dsh-drone-planner/';
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:CHROME,headless:true});
 const page=await browser.newPage({viewport:{width:1512,height:1100},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const checks=[];const check=(n,f)=>{assert.ok(f,n);checks.push(n);console.log('PASS '+n);};
 const ready=()=>page.waitForFunction(()=>window.PlannerDemo&&!PlannerDemo.state.busy&&PlannerDemo.state.config);
 const S=()=>page.evaluate(()=>PlannerDemo.state);
 await page.goto(BASE);await ready();
 check('Defaults: area/agl/along/stay/yes/hover',
   await page.inputValue('#targetType')==='area'&&await page.inputValue('#heightMode')==='agl'&&
   await page.inputValue('#yawMode')==='along'&&await page.inputValue('#stay')==='yes'&&
   await page.inputValue('#endAction')==='hover');
 check('Along-mode default hides fixed pose fields',await page.locator('#fixedPoseFields').isHidden());
 check('Initial plan still generated with along default',(await S()).points.length>0);
 const area=await page.evaluate(()=>{const s=PlannerDemo.state;const rows={};s.points.forEach(p=>{(rows[p.y.toFixed(1)]=rows[p.y.toFixed(1)]||[]).push(p)});const ys=Object.keys(rows).map(Number).sort((a,b)=>a-b);const dirs=ys.map(y=>{const xs=rows[y.toFixed(1)].map(p=>p.x);return xs.length>1?(xs[xs.length-1]>xs[0]?1:-1):0});
   return {cov:s.coverage.filter(Boolean).length,total:s.samples.length,rows:ys.length,alt:dirs.includes(1)&&dirs.includes(-1)};});
 check('Area route is boustrophedon',area.rows>=3&&area.alt);
 check('Boustrophedon covers every area sample',area.cov===area.total);
 // slope 60
 await page.selectOption('#targetType','slope');await page.locator('#targetType').dispatchEvent('change');
 check('Slope angle defaults to 60°',await page.inputValue('#slopeAngle')==='60');
 await page.locator('#generate').click();await ready();
 const slopeOK=await page.evaluate(()=>{const s=PlannerDemo.state;const ab=PlannerDemo.slopeAB(s.config);return !!ab&&Math.abs(Math.hypot(...ab)-Math.tan(60*Math.PI/180))<1e-9&&s.points.length>0;});
 check('Slope plane uses 60° inclination',slopeOK);
 const slopeCov=await page.evaluate(()=>{const s=PlannerDemo.state;const rows={};s.points.forEach(p=>{(rows[p.y.toFixed(1)]=rows[p.y.toFixed(1)]||[]).push(p)});const ys=Object.keys(rows).map(Number).sort((a,b)=>a-b);const dirs=ys.map(y=>{const xs=rows[y.toFixed(1)].map(p=>p.x);return xs.length>1?(xs[xs.length-1]>xs[0]?1:-1):0});
   return {cov:s.coverage.filter(Boolean).length,total:s.samples.length,alt:dirs.includes(1)&&dirs.includes(-1)};});
 check('Slope route is boustrophedon too',slopeCov.alt);
 check('Boustrophedon covers every slope sample',slopeCov.cov===slopeCov.total);
 // solid -> cylinder
 await page.selectOption('#targetType','solid');await page.locator('#targetType').dispatchEvent('change');
 await page.locator('#generate').click();await ready();
 const cyl=await page.evaluate(()=>{const s=PlannerDemo.state;const c=PlannerDemo.cylinderOf(s.config);return {n:s.points.length,cx:c.cx,cy:c.cy,rad:c.rad,top:c.top,heights:s.points.map(p=>p.height),radii:s.points.map(p=>Math.hypot(p.x,p.y)),yaws:s.points.map(p=>p.yaw),target:s.target.length};});
 check('Solid target is a cylinder (radius from 24-gon)',cyl.target===24&&Math.abs(cyl.rad-100)<1&&Math.abs(cyl.cx)<1&&Math.abs(cyl.cy)<1);
 check('Cylinder height defaults to 200 m',cyl.top===200);
 check('Waypoints spiral around the cylinder',cyl.n>=16&&cyl.radii.every(r=>r>100)&&Math.max(...cyl.heights)>Math.min(...cyl.heights));
 check('Spiral climbs the 200 m cylinder',Math.max(...cyl.heights)-Math.min(...cyl.heights)>100);
 const inward=await page.evaluate(()=>PlannerDemo.state.points.every(p=>{const t=Math.atan2(-p.x,-p.y)*180/Math.PI;return Math.abs(((p.yaw-t+540)%360)-180)<1;}));
 check('Spiral yaw faces the cylinder axis',inward);
 check('Solid coverage not blocked by direction constraint',(await S()).coverage.filter(Boolean).length>0);
 // line -> along route
 await page.selectOption('#targetType','line');await page.locator('#targetType').dispatchEvent('change');
 await page.locator('#generate').click();await ready();
 const onLine=await page.evaluate(()=>{const s=PlannerDemo.state,t=s.target;const sd=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;const k=d?Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/d)):0;return Math.hypot(p.x-a[0]-k*dx,p.y-a[1]-k*dy);};return s.points.length>2&&s.points.every(p=>t.some((a,i)=>i&&sd(p,t[i-1],a)<0.02));});
 check('Line waypoints sit on the route',onLine);
 // layout: paired fields must stay aligned and range sliders stay side by side at narrow widths
 const layout=[];
 for(const w of [1512,1300,1150,1000,900,800,760,720,600,480,390]){
   await page.setViewportSize({width:w,height:1200});
   await page.waitForTimeout(110);
   layout.push(await page.evaluate(()=>{
     const bad=[];
     document.querySelectorAll('.pair').forEach(pair=>{
       const fs=[...pair.children].filter(el=>el.classList.contains('field')&&el.offsetParent);
       if(fs.length<2)return;
       const pick=f=>f.querySelector('input:not([type=range]),select,textarea')||f;
       const a=pick(fs[0]).getBoundingClientRect().bottom, c=pick(fs[1]).getBoundingClientRect().bottom;
       if(Math.abs(a-c)>1.2)bad.push('pair:'+Math.round(Math.abs(a-c)));
     });
     document.querySelectorAll('.range-line').forEach(rl=>{
       const s=rl.querySelector('input[type=range]'), n=rl.querySelector('input[type=number]');
       if(!s||!n||!rl.offsetParent)return;
       const a=s.getBoundingClientRect(), c=n.getBoundingClientRect();
       if(c.left<a.right-1)bad.push('range-stacked');
     });
     return {w:window.innerWidth,bad,overflow:document.documentElement.scrollWidth-window.innerWidth};
   }));
 }
 const misaligned=layout.filter(r=>r.bad.length);
 check('Paired fields align at every width',misaligned.length===0);
 check('Range sliders stay side by side',!layout.some(r=>r.bad.includes('range-stacked')));
 check('No horizontal overflow while narrowing',layout.every(r=>r.overflow<=1));
 await page.setViewportSize({width:1512,height:1100});
 check('No browser runtime errors',errors.length===0);
 await browser.close();
 console.log(`${checks.length} browser checks passed.`);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
