import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMilestones } from '../js/milestones.js';
import { haversine } from '../js/geometry.js';

// Straight route going north: 20 steps of 0.01° of latitude (~1.112 km each,
// ~22.2 km total). Profile: +1000 m climb, -250 m descent, +500 m climb,
// so the cumulative gain is 1500 m.
function northRoute() {
  const lat = [];
  const lon = [];
  const ele = [];
  for (let i = 0; i <= 20; i++) {
    lat.push(45 + i * 0.01);
    lon.push(6.0);
    ele.push(i <= 10 ? 1000 + i * 100 : i <= 15 ? 2000 - (i - 10) * 50 : 1750 + (i - 15) * 100);
  }
  return { lat, lon, ele };
}

test('dist mode: one marker per interval, interpolated on the segment', () => {
  const route = northRoute();
  const marks = computeMilestones(route, 'dist', 5);
  assert.deepEqual(marks.map((m) => m.value), [5, 10, 15, 20]);
  // Each marker sits at the exact cumulative distance from the start.
  for (const m of marks) {
    const d = haversine(route.lon[0], route.lat[0], m.lon, m.lat);
    assert.ok(Math.abs(d - m.value) < 0.005, `${m.value} km marker is ${d} km away`);
  }
});

test('dist mode: a small interval yields several markers inside one segment', () => {
  const route = { lat: [45, 45.1], lon: [6, 6], ele: [0, 0] }; // one ~11 km segment
  const marks = computeMilestones(route, 'dist', 2);
  assert.deepEqual(marks.map((m) => m.value), [2, 4, 6, 8, 10]);
});

test('ele mode: markers every N m of cumulative gain, descents ignored', () => {
  const route = northRoute();
  const marks = computeMilestones(route, 'ele', 400);
  assert.deepEqual(marks.map((m) => m.value), [400, 800, 1200]);
  // Markers sit on route points.
  for (const m of marks) assert.ok(route.lat.includes(m.lat));
});

test('ele mode: a flat route yields no markers', () => {
  const route = { lat: [45, 45.1], lon: [6, 6], ele: [0, 0] };
  assert.deepEqual(computeMilestones(route, 'ele', 100), []);
});

test('invalid input yields no markers', () => {
  assert.deepEqual(computeMilestones(null, 'dist', 5), []);
  assert.deepEqual(computeMilestones(northRoute(), 'dist', 0), []);
  assert.deepEqual(computeMilestones(northRoute(), 'dist', NaN), []);
  assert.deepEqual(computeMilestones(northRoute(), 'none', 5), []);
});

test('the marker count is capped on absurd intervals', () => {
  const route = { lat: [45, 46], lon: [6, 6], ele: [0, 0] }; // ~111 km segment
  const marks = computeMilestones(route, 'dist', 0.01);
  assert.ok(marks.length <= 300);
});
