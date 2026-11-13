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
    '\nglobalThis.api={fov,geometry,basis,insideFov,validateTarget,directionOK,effYawTarget,segYawOf,toLatLon,state,area,spacingAllowed};',
  context,
);
const { fov, geometry, basis, insideFov, validateTarget, directionOK, effYawTarget, segYawOf, toLatLon, state, area, spacingAllowed } = context.api;

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
  for (const id of ['heightMode', 'groundElevation', 'speed', 'yawMode', 'bodyYaw', 'gimbalPitch', 'zoom', 'cutDistance', 'stay', 'endAction', 'homeLat', 'homeLon', 'spacingStat', 'sampleCount', 'sampleSpacing', 'pointLatlon', 'pointHeight']) {
    assert.ok(page.includes(`id="${id}"`), 'missing id ' + id);
  }
  for (const gone of ['id="task"', 'id="parseTask"', 'id="directionMode"', 'id="basePitch"', 'id="baseLens"', 'id="strategy"', 'id="export"', 'id="reset"', 'id="clipDemo"', 'id="addPoint"', 'id="pointLens"']) {
    assert.ok(!page.includes(gone), 'unexpected id ' + gone);
  }
});

console.log(`${checks} redesign checks passed.`);
