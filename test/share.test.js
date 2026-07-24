import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Share from '../js/share.js';

/** Synthetic mountain track: n points wandering around the Mont-Blanc area. */
function makeRoute(n, name = 'Tour du Test') {
  const lat = [];
  const lon = [];
  const ele = [];
  for (let i = 0; i < n; i++) {
    lat.push(45.9 + 0.05 * Math.sin(i / 40) + 0.00013 * i);
    lon.push(6.87 + 0.05 * Math.cos(i / 55) + 0.00011 * i);
    ele.push(1200 + 800 * Math.sin(i / 90) + (i % 7));
  }
  return { name, lat, lon, ele, waypoints: [] };
}

test('encode/decode round-trips name, coordinates and elevation', async () => {
  const route = makeRoute(500);
  const code = await Share.encode(route);
  assert.match(code, /^[A-Za-z0-9_-]+$/); // URL-safe, no escaping needed
  const back = await Share.decode(code);

  assert.equal(back.name, 'Tour du Test');
  assert.equal(back.lat.length, 500);
  for (let i = 0; i < 500; i++) {
    assert.ok(Math.abs(back.lat[i] - route.lat[i]) < 1e-5 / 2 + 1e-9);
    assert.ok(Math.abs(back.lon[i] - route.lon[i]) < 1e-5 / 2 + 1e-9);
    assert.ok(Math.abs(back.ele[i] - route.ele[i]) <= 0.5);
  }
  assert.deepEqual(back.waypoints, []);
});

test('negative coordinates and missing elevation survive the trip', async () => {
  const route = {
    name: '',
    lat: [-33.4372, -33.44, -33.4501],
    lon: [-70.6506, -70.66, -70.6702],
    ele: [0, 0, 0],
    waypoints: [],
  };
  const back = await Share.decode(await Share.encode(route));
  assert.equal(back.name, '');
  assert.ok(Math.abs(back.lat[2] + 33.4501) < 1e-5);
  assert.ok(Math.abs(back.lon[0] + 70.6506) < 1e-5);
  assert.deepEqual(back.ele, [0, 0, 0]);
});

test('encodeFit leaves short tracks untouched', async () => {
  const route = makeRoute(200);
  const res = await Share.encodeFit(route);
  assert.equal(res.simplified, false);
  assert.equal(res.points, 200);
  const back = await Share.decode(res.code);
  assert.equal(back.lat.length, 200);
});

test('encodeFit simplifies long tracks down to the URL budget', async () => {
  const route = makeRoute(20000);
  const res = await Share.encodeFit(route);
  assert.ok(res.code.length <= Share.CHAR_BUDGET, `code is ${res.code.length} chars`);
  assert.equal(res.simplified, true);
  assert.equal(res.total, 20000);
  assert.ok(res.points >= 2 && res.points < 20000);

  // The simplified route still decodes and keeps the endpoints.
  const back = await Share.decode(res.code);
  assert.equal(back.lat.length, res.points);
  assert.ok(Math.abs(back.lat[0] - route.lat[0]) < 1e-5);
  assert.ok(Math.abs(back.lat.at(-1) - route.lat.at(-1)) < 1e-5);
});

test('long names are capped, unicode is preserved', async () => {
  const route = makeRoute(10, 'Grande Traversée des Alpes — étape n°5 ⛰️' + 'x'.repeat(200));
  const back = await Share.decode(await Share.encode(route));
  assert.ok(back.name.startsWith('Grande Traversée des Alpes — étape n°5 ⛰️'));
  assert.ok(back.name.length <= 100);
});

test('malformed codes are rejected with error.shareInvalid', async () => {
  for (const bad of ['', 'not base64 ù%', 'AAAA', (await Share.encode(makeRoute(10))).slice(0, 20)]) {
    await assert.rejects(Share.decode(bad), (e) => e.code === 'error.shareInvalid');
  }
});
