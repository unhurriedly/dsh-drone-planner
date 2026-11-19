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
 check('Page heading uses the new copy',await page.locator('.heading h1').textContent()==='智飞航线规划'&&(await page.locator('.heading p').textContent())==='航线让无人机视野覆盖目标区域');
 check('Idle planning status is blank after render',(await page.locator('#planState').textContent()).trim()==='');
 check('Table footnote removed',await page.locator('.table-panel p.hint').count()===0);
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
 // 模拟飞行
 const orange=()=>page.evaluate(()=>{const cv=document.getElementById('scene'),d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-220)<18&&Math.abs(d[i+1]-139)<18&&Math.abs(d[i+2]-39)<20)n++;return n;});
 check('Simulation starts and advances along the route',await (async()=>{
   const before=await page.evaluate(()=>PlannerDemo.state.sim.d);
   await page.locator('#simulate').click();
   await page.waitForTimeout(700);
   const st=await page.evaluate(()=>({running:PlannerDemo.state.sim.running,d:PlannerDemo.state.sim.d}));
   return st.running&&st.d>before;
 })());
 check('Frustum is drawn during flight',(await orange())>50);
 check('Status line reports waypoint, progress and time',/^WP \d+\/\d+ · \d+% · 用时 \d+:\d{2}$/.test((await page.locator('#simStatus').textContent()).trim()));
 await page.locator('#simulate').click();await page.waitForTimeout(200);
 const paused=await page.evaluate(()=>PlannerDemo.state.sim.d);await page.waitForTimeout(400);
 check('Pausing freezes the drone',await page.evaluate(d0=>PlannerDemo.state.sim.d===d0,paused)&&await page.evaluate(()=>!PlannerDemo.state.sim.running));
 await page.locator('#simulate').click();await page.waitForTimeout(200);
 await page.evaluate(()=>{PlannerDemo.state.sim.d=PlannerDemo.simRoute().total-0.4;});
 await page.waitForTimeout(600);
 check('Simulation stops at the end of the route',await page.evaluate(()=>!PlannerDemo.state.sim.running&&Math.abs(PlannerDemo.state.sim.d-PlannerDemo.simRoute().total)<0.01));
 await page.locator('#simStop').click();await page.waitForTimeout(150);
 check('Stop clears the flown trail',await page.evaluate(()=>PlannerDemo.state.sim.d===0)&&await page.locator('#simStatus').isHidden()&&await page.locator('#simStop').isHidden());
 check('Regenerating resets the simulation',await (async()=>{
   await page.locator('#simulate').click();await page.waitForTimeout(300);
   await page.evaluate(()=>PlannerDemo.recalc());
   return await page.evaluate(()=>!PlannerDemo.state.sim.running&&PlannerDemo.state.sim.d===0);
 })());
 check('Switching to the dev tab pauses the simulation',await (async()=>{
   await page.locator('#simulate').click();await page.waitForTimeout(300);
   await page.locator('#tab-dev').click();await page.waitForTimeout(250);
   const pausedOk=await page.evaluate(()=>!PlannerDemo.state.sim.running);
   await page.locator('#tab-planner').click();await page.waitForTimeout(250);
   await page.locator('#simStop').click();
   return pausedOk;
 })());

 // 电量不足的两种执行策略
 check('Strategy panel hidden while energy suffices',await page.locator('#planPanel').isHidden());
 await page.locator('details:has(#enduranceMin) summary').click();
 // 5 min × 10% 余量 = 30 s 预算，任何航线都必然超出
 await page.locator('#enduranceMin').fill('5');await page.locator('#enduranceMin').dispatchEvent('change');
 await page.locator('#safetyPct').fill('10');await page.locator('#safetyPct').dispatchEvent('change');
 await page.waitForTimeout(350);
 check('Strategy panel appears when the route exceeds endurance',await page.locator('#planPanel').isVisible()&&/无法飞完全程/.test(await page.locator('#energyState').textContent()));
 check('Resume strategy lists sorties',await page.locator('.sortie').count()>=2);
 check('Resume sorties report distance and minutes',/min/.test(await page.locator('.sortie').first().textContent()));
 await page.locator('.plan-tabs button[data-strategy="multi"]').click();
 await page.waitForTimeout(350);
 const multi=await page.evaluate(()=>{
   const rows=[...document.querySelectorAll('.plan-table tbody tr')];
   const assigned=rows.map(r=>parseInt(r.children[2].textContent,10));
   return {rows:rows.length,inputs:document.querySelectorAll('[data-home]').length,total:assigned.reduce((a,b)=>a+b,0),points:PlannerDemo.state.points.length};
 });
 check('Multi-drone strategy splits into 2+ drones',multi.rows>=2&&multi.inputs===multi.rows*2);
 check('Every waypoint is assigned exactly once',multi.total===multi.points);
 check('Each drone has its own take-off coordinates',await page.evaluate(()=>PlannerDemo.state.plan.homes.length>=2&&PlannerDemo.state.plan.homes.every(h=>Number.isFinite(h.lat)&&Number.isFinite(h.lon))));
 await page.locator('#planDroneCount').fill('3');await page.locator('#planDroneCount').dispatchEvent('change');
 await page.waitForTimeout(350);
 check('Fleet size is adjustable',await page.locator('.plan-table tbody tr').count()===3&&(await page.evaluate(()=>PlannerDemo.state.plan.homes.length))===3);
 const latBefore=await page.evaluate(()=>PlannerDemo.state.plan.homes[0].lat);
 await page.locator('[data-home="0"][data-key="lat"]').fill('39.95');
 await page.locator('[data-home="0"][data-key="lat"]').dispatchEvent('change');
 await page.waitForTimeout(350);
 check('Editing a take-off point is kept',await page.evaluate(v=>PlannerDemo.state.plan.homes[0].lat===v,39.95)&&latBefore!==39.95);
 check('Plan routes are drawn on the canvas',await page.evaluate(()=>{
   const cv=document.getElementById('scene'),d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
   const targets=[[220,139,39],[21,155,121],[168,85,206],[215,78,102]];
   for(let i=0;i<d.length;i+=4)for(const t of targets)if(Math.abs(d[i]-t[0])<16&&Math.abs(d[i+1]-t[1])<16&&Math.abs(d[i+2]-t[2])<16)return true;
   return false;
 }));
 await page.locator('#enduranceMin').fill('60');await page.locator('#enduranceMin').dispatchEvent('change');
 await page.locator('#safetyPct').fill('100');await page.locator('#safetyPct').dispatchEvent('change');
 await page.waitForTimeout(350);
 check('Strategy panel hides again when energy suffices',await page.locator('#planPanel').isHidden()&&/电量满足全程/.test(await page.locator('#energyState').textContent()));
 await page.locator('#enduranceMin').fill('25');await page.locator('#enduranceMin').dispatchEvent('change');
 await page.locator('#safetyPct').fill('80');await page.locator('#safetyPct').dispatchEvent('change');
 await page.waitForTimeout(200);

 // 合并为单页两 tab 后，规划侧功能必须照旧
 check('Planner tab renders the risk bar',await page.locator('#riskBar').isVisible()&&await page.locator('#energyTime').textContent()!=='—');
 const beforeActions=await page.evaluate(()=>JSON.stringify(PlannerDemo.state.points));
 await page.locator('#addAction').click();
 check('Waypoint actions still editable',(await page.evaluate(()=>PlannerDemo.state.points[PlannerDemo.state.selected].actions.length))===1);
 await page.locator('.act-type').first().selectOption('wait');
 await page.locator('#tab-dev').click();
 await page.waitForTimeout(300);
 await page.locator('#tab-planner').click();
 await page.waitForTimeout(400);
 const afterTabs=await page.evaluate(()=>JSON.stringify(PlannerDemo.state.points.map(p=>({x:p.x,y:p.y,yaw:p.yaw}))));
 check('Switching tabs keeps planner state',beforeActions.length>0&&afterTabs.length>0&&await page.locator('#scene').evaluate(el=>el.width>0));
 check('Planner tab is the default landing view',await page.locator('#planner-page').isVisible());
 check('立即执行 sits in the canvas toolbar',await page.evaluate(()=>{
   const b=document.getElementById('executeNow').getBoundingClientRect();
   const t=document.querySelector('.toolbar').getBoundingClientRect();
   return b.width>0&&b.y>=t.y-2&&b.y+b.height<=t.y+t.height+2;
 }));
 await page.locator('#tab-dev').click();await page.waitForTimeout(250);
 check('立即执行 hidden on the dev tab',await page.locator('#executeNow').isHidden());
 check('Dev tab has no preview iframe',await page.locator('#previewFrame').count()===0);
 await page.locator('#tab-planner').click();await page.waitForTimeout(250);
 check('No browser runtime errors',errors.length===0);
 await browser.close();
 console.log(`${checks.length} browser checks passed.`);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1);});
