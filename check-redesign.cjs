/**
 * P1–P2 界面改版验收：函数级几何/口径检查（Node，无第三方依赖）。
 * 用法：node check-redesign.cjs
 */
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(__dirname + '/page/index.html', 'utf8')
  .split('<script>')[1].split('</script>')[0];
const context = { document: {}, console, setTimeout };
vm.createContext(context);
vm.runInContext(
  source.split('let screen=')[0] +
    '\nglobalThis.api={fov,geometry,basis,insideFov,validateTarget,directionOK,effYawTarget,segYawOf,toLatLon,state,area,spacingAllowed,slopeAB,groundZfn,riskInfo,ACTION_DEFS,NO_STAY_OK,samples,cylinderOf,spiralWaypoints,lineWaypoints,greedyWaypoints,scanWaypoints,fillGaps};',
  context,
);
const { fov, geometry, basis, insideFov, validateTarget, directionOK, effYawTarget, segYawOf, toLatLon, state, area, spacingAllowed, slopeAB, groundZfn, riskInfo, ACTION_DEFS, NO_STAY_OK, samples, cylinderOf, spiralWaypoints, lineWaypoints, scanWaypoints } = context.api;

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }

const config = { height: 110, distance: 1000, zoom: 1, yawMode: 'fixed', bodyYaw: null, pitch: -60, home: { lat: 0, lon: 0 } };
const down = { x: 0, y: 0, yaw: 0, pitch: -90, zoom: 1, height: 110 };

test('Zoom 1 uses 64x44 base; zoom 2 halves the tangent', () => {
  const f1 = fov({ zoom: 1 }, config);
  assert.ok(Math.abs(f1[0] - 64) < 1e-9 && Math.abs(f1[1] - 44) < 1e-9);
  const f2 = fov({ zoom: 2 }, config);
  assert.ok(Math.abs(f2[0] - 2 * Math.atan(Math.tan(32 * Math.PI / 180) / 2) / Math.PI * 180) < 1e-9);
});

test('Per-waypoint height drives the footprint, not task height', () => {
  const g150 = geometry({ ...down, height: 150 }, config);
  const expected = 4 * 150 * 150 * Math.tan(32 * Math.PI / 180) * Math.tan(22 * Math.PI / 180);
  assert.ok(Math.abs(g150.rawArea - expected) < 1e-5);
  const g90 = geometry({ ...down, height: 90 }, config);
  assert.ok(g90.rawArea < g150.rawArea);
});

test('effective yaw target: fixed+set wins, blank and along mean segment heading', () => {
  assert.equal(effYawTarget({ yawMode: 'fixed', bodyYaw: 45 }), 45);
  assert.equal(effYawTarget({ yawMode: 'fixed', bodyYaw: null }), null);
  assert.equal(effYawTarget({ yawMode: 'along', bodyYaw: 45 }), null);
});

test('segYawOf: north and east segments, last point reuses previous segment', () => {
  const pts = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }];
  assert.ok(Math.abs(segYawOf(pts, 0)) < 1e-9);          // north = 0°
  assert.ok(Math.abs(segYawOf(pts, 1) - 90) < 1e-9);     // east = 90°
  assert.ok(Math.abs(segYawOf(pts, 2) - 90) < 1e-9);     // last reuses segment 1→2
});

test('directionOK follows segment heading in along mode within tolerance', () => {
  const c = { yawMode: 'along', bodyYaw: null };
  assert.ok(directionOK({ yaw: 90.2 }, c, 90));
  assert.ok(!directionOK({ yaw: 0 }, c, 90));
  const cf = { yawMode: 'fixed', bodyYaw: 45 };
  assert.ok(directionOK({ yaw: 45 }, cf, 90));
  assert.ok(!directionOK({ yaw: 90 }, cf, 90));
  assert.ok(directionOK({ yaw: 0 }, c, null)); // single point, no segment yet
});

test('toLatLon: origin maps to home, axes convert at expected rate', () => {
  state.config = { home: { lat: 39.9, lon: 116.4 } };
  const o = toLatLon(0, 0);
  assert.ok(Math.abs(o[0] - 39.9) < 1e-12 && Math.abs(o[1] - 116.4) < 1e-12);
  const p = toLatLon(1000, 1000); // x east, y north
  const dLat = 1000 / 6378137 * 180 / Math.PI;
  const dLon = 1000 / (6378137 * Math.cos(39.9 * Math.PI / 180)) * 180 / Math.PI;
  assert.ok(Math.abs(p[0] - (39.9 + dLat)) < 1e-12);
  assert.ok(Math.abs(p[1] - (116.4 + dLon)) < 1e-12);
  state.config = null;
});

test('Removed UI surface: no parseTask/strategy/lens/export/reset/addPoint/clipDemo', () => {
  for (const stale of ['parseTask', 'strategy', 'baseLens', "lens===", "lens:", "directionMode", 'wideH', "clipDemo", "addPoint'", "export'", "reset'"]) {
    assert.ok(!source.includes(stale), 'stale reference: ' + stale);
  }
});

test('New preset ids present exactly once in the page', () => {
  const page = fs.readFileSync(__dirname + '/page/index.html', 'utf8');
  for (const id of ['heightMode', 'groundElevation', 'speed', 'yawMode', 'bodyYaw', 'gimbalPitch', 'zoom', 'cutDistance', 'stay', 'endAction', 'homeLat', 'homeLon', 'spacingStat', 'pointLatlon', 'pointHeight', 'riskBar', 'energyItem', 'energyTime', 'energyBudget', 'altItem', 'spaceItem', 'resumeRow']) {
    assert.ok(page.includes(`id="${id}"`), 'missing id ' + id);
  }
  for (const gone of ['id="task"', 'id="parseTask"', 'id="directionMode"', 'id="basePitch"', 'id="baseLens"', 'id="strategy"', 'id="export"', 'id="reset"', 'id="clipDemo"', 'id="addPoint"', 'id="pointLens"', 'id="resultNote"', 'id="sampleCount"', 'id="sampleSpacing"', 'id="missCount"', 'id="overlapRate"', 'class="panel risk-panel"', 'id="nfzItem"', 'id="nfzAck"']) {
    assert.ok(!page.includes(gone), 'unexpected id ' + gone);
  }
});

test('Slope nadir area matches independent numeric integration', () => {
  const c = { type: 'slope', slopeAngle: 15, slopeAspect: 180, distance: 1000, zoom: 1 };
  const [A, Bc] = slopeAB(c);
  assert.ok(Math.abs(A) < 1e-12 && Math.abs(Bc + Math.tan(15 * Math.PI / 180)) < 1e-12);
  const g = geometry({ x: 0, y: 0, yaw: 0, pitch: -90, zoom: 1, height: 110 }, c);
  // Independent check: nadir frustum on plane z=tan15*y, camera (0,0,110):
  // |x| <= (110 - tan15*y)*tan32 and |y| <= (110 - tan15*y)*tan22; surface area scales by 1/cos15.
  const t15 = Math.tan(15 * Math.PI / 180), t32 = Math.tan(32 * Math.PI / 180), t22 = Math.tan(22 * Math.PI / 180);
  const ymax = 110 * t22 / (1 + t15 * t22), ymin = -110 * t22 / (1 - t15 * t22);
  const cell = 0.2; let count = 0;
  for (let y = ymin + cell / 2; y < ymax; y += cell) {
    const xr = (110 - t15 * y) * t32;
    for (let x = -xr + cell / 2; x < xr; x += cell) count++;
  }
  const expected = count * cell * cell / Math.cos(15 * Math.PI / 180);
  assert.ok(Math.abs(g.rawArea - expected) / expected < 0.02, `impl ${g.rawArea} vs mc ${expected}`);
  assert.ok(g.raw.every(v => v.length === 3));
});

test('Slope range cut: every effective vertex within slant distance', () => {
  const c = { type: 'slope', slopeAngle: 15, slopeAspect: 180, distance: 250, zoom: 1 };
  const w = { x: 0, y: 0, yaw: 0, pitch: -35, zoom: 1, height: 110 };
  const g = geometry(w, c);
  assert.ok(g.cut > 0 && g.validArea > 0);
  const C = [0, 0, 110];
  for (const v of g.effective) assert.ok(Math.hypot(v[0] - C[0], v[1] - C[1], v[2] - C[2]) <= 250 + 1e-6);
});

test('insideFov on slope uses ground-relative camera altitude', () => {
  const c = { type: 'slope', slopeAngle: 15, slopeAspect: 180, distance: 1000, zoom: 1 };
  const w = { x: 0, y: 0, yaw: 0, pitch: -90, zoom: 1, height: 110 };
  const b = basis(w, c);
  assert.ok(insideFov([0, 0, groundZfn(c)(0, 0)], w, c, b));           // point directly below
  assert.ok(!insideFov([500, 500, groundZfn(c)(500, 500)], w, c, b));  // far outside
});

test('Solid sampling produces 3D samples on top and sides', () => {
  state.target = [[-120, -80], [120, -80], [120, 80], [-120, 80]];
  const c = { type: 'solid', solidTop: 30, height: 110, zoom: 1, distance: 210 };
  const pts = samples(c);
  assert.ok(pts.length > 10 && pts.every(p => p.length === 3));
  assert.ok(pts.some(p => Math.abs(p[2] - 30) < 1e-9));
  assert.ok(pts.some(p => p[2] < 30));
});

test('No-stay action whitelist excludes gimbal/payload/standard AI photo', () => {
  assert.ok(NO_STAY_OK.has('photo') && NO_STAY_OK.has('rec_start') && NO_STAY_OK.has('rec_stop') && NO_STAY_OK.has('wait') && NO_STAY_OK.has('ai_photo_fast'));
  assert.ok(!NO_STAY_OK.has('ai_photo') && !NO_STAY_OK.has('gimbal_pitch') && !NO_STAY_OK.has('gimbal_zoom') && !NO_STAY_OK.has('payload_custom'));
  for (const k of Object.keys(ACTION_DEFS)) assert.ok(ACTION_DEFS[k].group && ACTION_DEFS[k].label);
});

test('riskInfo: travel + waits + return vs endurance budget', () => {
  state.points = [
    { x: 0, y: 0, height: 100, actions: [{ type: 'wait', params: { sec: 60 } }] },
    { x: 100, y: 0, height: 100, actions: [] },
  ];
  const c = { speed: 5, endAction: 'rth' };
  const r = riskInfo(c, 25, 80);           // travel 20 + wait 60 + return 20 = 100s
  assert.ok(Math.abs(r.time - 100) < 1e-9 && !r.over);
  const r2 = riskInfo(c, 1, 100);          // budget 60s < 100s
  assert.ok(r2.over);
  state.points = [];
});

test('Field info icons present across all three sections', () => {
  const page = fs.readFileSync(__dirname + '/page/index.html', 'utf8');
  const n = (page.match(/class="fi"/g) || []).length;
  assert.ok(n >= 45, 'expected >=45 info icons, got ' + n);
  for (const frag of ['data-tip="距机身超过该距离（三维斜距）', 'FOV(z)＝2·atan', '指令延迟需＜1s', '35mm 等效焦距', '等距圆柱近似']) {
    assert.ok(page.includes(frag), 'missing tip fragment ' + frag);
  }
  assert.ok(page.includes('#fieldTip') || page.includes("fieldTip"));
});

test('Inline hint paragraphs removed, content kept in tooltips', () => {
  const page = fs.readFileSync(__dirname + '/page/index.html', 'utf8');
  assert.ok(!page.includes('超视距裁切：距机身该距离'), 'cut-distance hint paragraph still visible');
  assert.ok(!page.includes('停留 = 是：支持全部动作'), 'stay hint paragraph still visible');
  assert.ok(!page.includes('不填 = 沿航线方向）'), 'default-value suffix still in a label');
  const tip = page.match(/data-tip="停留＝是：支持全部动作[^"]*"/);
  assert.ok(tip && /智拍固定第一/.test(tip[0]) && /1s/.test(tip[0]), 'actions tooltip lost content');
  assert.ok(!/地图管理未设置禁飞区/.test(page), 'no-fly-zone assessment still present');
  assert.ok(!page.includes('nfz'), 'nfz identifiers still present');
  assert.ok(page.includes('id="executeNow"'), 'execute button missing');
  assert.ok(/立即执行/.test(page), 'execute button label missing');
  assert.ok(!/执行飞行|上传航线|下发任务/.test(page), 'execute button must stay a placeholder');
});

test('Cylinder: centroid/radius from polygon, sampling on top and sides', () => {
  state.config = { type: 'solid', solidTop: 30, height: 110, zoom: 1, distance: 210, spacing: 0 };
  state.target = Array.from({ length: 24 }, (_, k) => [Math.cos(k * Math.PI / 12) * 100, Math.sin(k * Math.PI / 12) * 100]);
  const cyl = cylinderOf(state.config);
  assert.ok(Math.abs(cyl.cx) < 1e-9 && Math.abs(cyl.cy) < 1e-9 && Math.abs(cyl.rad - 100) < 1e-6 && cyl.top === 30);
  const pts = samples(state.config);
  assert.ok(pts.some(p => Math.abs(p[2] - 30) < 1e-9), 'missing top samples');
  assert.ok(pts.some(p => p[2] > 0 && p[2] < 30), 'missing side samples');
  assert.ok(pts.every(p => Math.hypot(p[0], p[1]) <= 100 + 1e-6));
});

test('Spiral waypoints ring the cylinder and climb', () => {
  state.config = { type: 'solid', solidTop: 30, height: 110, zoom: 1, distance: 210, spacing: 0, yawMode: 'along', bodyYaw: null };
  const pts = spiralWaypoints(state.config);
  assert.ok(pts.length >= 8 && pts.length <= 80);
  const radii = pts.map(p => Math.hypot(p.x, p.y));
  assert.ok(radii.every(r => r > 100 && r < 260), 'waypoints should orbit outside the cylinder');
  const heights = pts.map(p => p.height);
  assert.ok(Math.max(...heights) > Math.min(...heights), 'spiral should climb');
  // heading points inward at the cylinder axis
  for (const p of pts) {
    const toCenter = Math.atan2(-p.x, -p.y) * 180 / Math.PI;
    assert.ok(Math.abs(((p.yaw - toCenter + 540) % 360) - 180) < 1, 'yaw should face the axis');
  }
  assert.ok(pts.every(p => p.pitch <= 0));
});

test('Line waypoints distributed along the route, not offset', () => {
  state.config = { type: 'line', height: 110, zoom: 1, distance: 210, spacing: 0, pitch: -60, lineWidth: 20 };
  state.target = [[-230, -100], [-110, -70], [-30, 10], [100, 70], [220, 95]];
  const pts = lineWaypoints(state.config);
  assert.ok(pts.length >= 4);
  const onLine = p => state.target.some((a, i) => i && segDistLocal(p, state.target[i - 1], a) < 1e-6);
  assert.ok(pts.every(onLine), 'every waypoint should sit on the route');
  function segDistLocal(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = dx * dx + dy * dy;
    const t = d ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / d)) : 0;
    return Math.hypot(p.x - a[0] - t * dx, p.y - a[1] - t * dy);
  }
});

test('Scan pattern is boustrophedon across the target bbox', () => {
  state.config = { type: 'area', height: 110, zoom: 1, distance: 210, spacing: 0, pitch: -60 };
  state.target = [[-160, -110], [170, -110], [205, 40], [90, 140], [-150, 115]];
  const pts = scanWaypoints(state.config);
  assert.ok(pts.length >= 8, 'expected several scan waypoints');
  const rows = new Map();
  for (const p of pts) {
    const key = p.y.toFixed(3);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(p);
  }
  assert.ok(rows.size >= 3, 'expected at least 3 rows');
  const dirs = [...rows.values()].map(xs => xs[0].x < xs[1].x ? 1 : -1);
  assert.ok(dirs.includes(1) && dirs.includes(-1), 'rows must alternate direction (boustrophedon)');
  for (const xs of rows.values()) {
    assert.ok(Math.abs(xs[0].x - Math.min(...xs.map(p => p.x))) < 1e-9 || Math.abs(xs[0].x - Math.max(...xs.map(p => p.x))) < 1e-9,
      'each row must start at a bbox edge');
    assert.ok(xs.every(p => p.heading === p.yaw), 'scan waypoints carry their leg heading');
  }
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  assert.ok(Math.min(...xs) === -160 && Math.max(...xs) === 205, 'scan spans bbox in x');
  assert.ok(Math.min(...ys) === -110 && Math.max(...ys) === 140, 'scan spans bbox in y');
});

test('Cylinder default height is 200 m when unset', () => {
  state.target = Array.from({ length: 24 }, (_, k) => [Math.cos(k * Math.PI / 12) * 100, Math.sin(k * Math.PI / 12) * 100]);
  const cyl = cylinderOf({ type: 'solid' });
  assert.equal(cyl.top, 200);
  const pts = spiralWaypoints({ type: 'solid', solidTop: 200, height: 110, zoom: 1, distance: 210, spacing: 0 });
  assert.ok(pts.length >= 16 && pts.length <= 80);
  const hs = pts.map(p => p.height);
  assert.ok(Math.max(...hs) - Math.min(...hs) > 100, 'spiral must climb across the taller cylinder');
});

test('Page copy follows the 智飞航线规划 wording', () => {
  const page = fs.readFileSync(__dirname + '/page/index.html', 'utf8');
  assert.ok(page.includes('<h1>智飞航线规划</h1>'), 'title not renamed');
  assert.ok(page.includes('航线让无人机视野覆盖目标区域'), 'subtitle not replaced');
  assert.ok(!page.includes('当前航点实时计算'), 'idle status copy still present');
  assert.ok(!page.includes('距机身超视距裁切距离（三维斜距）以外的地面投影不计入有效数据'), 'table footnote still present');
  assert.ok(!page.includes('让视野覆盖目标'), 'old title still present');
});

console.log(`${checks} redesign checks passed.`);
