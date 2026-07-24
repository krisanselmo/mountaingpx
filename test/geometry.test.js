import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversine, findNearest, findNearestWay, addNewCoordinate, getPerp } from '../js/geometry.js';

// Arguments are (lon, lat, …) and distances are in kilometers.

test('haversine: known distances', () => {
  assert.equal(haversine(6, 45, 6, 45), 0);
  // 1° of longitude at the equator ≈ 111.19 km.
  const oneDegEquator = haversine(0, 0, 1, 0);
  assert.ok(Math.abs(oneDegEquator - 111.19) < 0.1, `got ${oneDegEquator}`);
  // 1° of latitude ≈ 111.19 km at any longitude.
  const oneDegLat = haversine(6, 45, 6, 46);
  assert.ok(Math.abs(oneDegLat - 111.19) < 0.1, `got ${oneDegLat}`);
});

// Straight route along the 45th parallel, one point every 0.01° of longitude.
const rLon = [6.00, 6.01, 6.02, 6.03, 6.04];
const rLat = [45, 45, 45, 45, 45];

test('findNearest: picks the closest route point and honors the limit', () => {
  const near = findNearest(rLon, rLat, 6.0201, 45.0001, 0.05);
  assert.equal(near.index, 2);
  assert.equal(near.match, true);
  assert.ok(near.minDist < 0.05);

  const far = findNearest(rLon, rLat, 6.02, 45.1, 0.05); // ~11 km north
  assert.equal(far.match, false);
  assert.equal(far.index, 2); // still reports the closest point
});

test('findNearestWay: closest approach between a way and the route', () => {
  // Way crossing the route near index 3.
  const wLon = [6.03, 6.03];
  const wLat = [44.9999, 45.0001];
  const hit = findNearestWay(rLon, rLat, wLon, wLat, 0.05);
  assert.equal(hit.match, true);
  assert.equal(hit.index, 3);

  const miss = findNearestWay(rLon, rLat, [6.03], [45.2], 0.05);
  assert.equal(miss.match, false);
});

test('addNewCoordinate: no projection on the route endpoints', () => {
  assert.deepEqual(addNewCoordinate(rLon, rLat, 6.0, 45.0001, 0), [null, null, null]);
  assert.deepEqual(addNewCoordinate(rLon, rLat, 6.04, 45.0001, rLat.length - 1), [null, null, null]);
});

test('addNewCoordinate: projects the POI onto the nearest segment', () => {
  // POI slightly north of the route, closest to index 2, leaning towards 3.
  const [lonNew, latNew, newIndex] = addNewCoordinate(rLon, rLat, 6.024, 45.0001, 2);
  assert.ok(Math.abs(lonNew - 6.024) < 1e-6);
  assert.ok(Math.abs(latNew - 45) < 1e-6); // foot of the perpendicular is on the parallel
  // The projection lands on the segment towards index 3: the new point is
  // inserted on that side.
  assert.equal(newIndex, 3);
});

test('getPerp: perpendicular foot, degenerate segment falls back to the endpoint', () => {
  assert.deepEqual(getPerp(0, 0, 10, 0, 4, 3), [4, 0, 0]);
  assert.deepEqual(getPerp(5, 5, 5, 5, 1, 2), [5, 5, 1]);
});
