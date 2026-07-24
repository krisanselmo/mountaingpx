import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as TCX from '../js/tcx.js';

const route = {
  name: 'Test Route',
  lat: [45.00, 45.05, 45.10],
  lon: [6.00, 6.05, 6.10],
  ele: [1000, 1050, 1100],
  waypoints: [],
};
const pts = [
  { lat: 45.02, lon: 6.02, ele: 2564, name: 'Col Test', queryName: 'saddle', descText: '2564 m' },
  { lat: 45.04, lon: 6.04, ele: 1890, name: 'Source Test', queryName: 'spring', descText: '' },
  { lat: 45.06, lon: 6.06, ele: 2100, name: 'Refuge Test', queryName: 'alpine_hut', descText: 'CAF' },
  { lat: 45.08, lon: 6.08, ele: 900, name: 'Château Test', queryName: 'castle', descText: '' },
  { lat: 45.09, lon: 6.09, ele: 0, name: 'Importé', queryName: 'generic', descText: '' },
];

test('course points carry the TCX CoursePointType vocabulary', () => {
  const tcx = TCX.build(route, pts, false);
  assert.match(tcx, /<Name>Col Test<\/Name>[^]*?<PointType>Summit<\/PointType>/);
  assert.match(tcx, /<Name>Source Test<\/Name>[^]*?<PointType>Water<\/PointType>/);
  assert.match(tcx, /<Name>Refuge Test<\/Name>[^]*?<PointType>Food<\/PointType>/);
  // Unmapped catalog types and the generic type of imported waypoints.
  assert.match(tcx, /<Name>Château Test<\/Name>[^]*?<PointType>Generic<\/PointType>/);
  assert.match(tcx, /<Name>Importé<\/Name>[^]*?<PointType>Generic<\/PointType>/);
  // Raw POI names must never leak into <PointType>.
  assert.doesNotMatch(tcx, /<PointType>saddle<\/PointType>/);
});

test('every waypoint becomes a CoursePoint; notes only when present', () => {
  const tcx = TCX.build(route, pts, false);
  assert.equal((tcx.match(/<CoursePoint>/g) || []).length, pts.length);
  assert.match(tcx, /<Notes>2564 m<\/Notes>/);
  assert.match(tcx, /<Notes>CAF<\/Notes>/);
});

test('trackpoints carry monotonic synthetic times and cumulative distances', () => {
  const tcx = TCX.build(route, [], false);
  assert.equal((tcx.match(/<Trackpoint>/g) || []).length, route.lat.length);
  // Restricted to the <Trackpoint> blocks: the <Lap> carries the total
  // distance before the track starts.
  const tpts = [...tcx.matchAll(/<Trackpoint>[^]*?<\/Trackpoint>/g)].map((m) => m[0]);
  const times = tpts.map((t) => Date.parse(t.match(/<Time>([^<]+)<\/Time>/)[1]));
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
  const dists = tpts.map((t) => parseFloat(t.match(/<DistanceMeters>([^<]+)<\/DistanceMeters>/)[1]));
  for (let i = 1; i < dists.length; i++) assert.ok(dists[i] >= dists[i - 1]);
});

test('keepOld re-emits the waypoints of the source file', () => {
  const r = { ...route, waypoints: [{ lat: 45.03, lon: 6.03, name: 'Ancien', type: 'summit' }] };
  const tcx = TCX.build(r, [], true);
  assert.match(tcx, /<Name>Ancien<\/Name>/);
});
