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
    '\nglobalThis.api={fov,geometry,basis,insideFov,validateTarget,directionOK,effYawTarget,segYawOf,toLatLon,state,area,spacingAllowed,slopeAB,groundZfn,riskInfo,ACTION_DEFS,NO_STAY_OK,samples};',
  context,
);
const { fov, geometry, basis, insideFov, validateTarget, directionOK, effYawTarget, segYawOf, toLatLon, state, area, spacingAllowed, slopeAB, groundZfn, riskInfo, ACTION_DEFS, NO_STAY_OK, samples } = context.api;

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
});

console.log(`${checks} redesign checks passed.`);
