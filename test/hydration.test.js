import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPlan, drinkReminders, stopsAlong, sourceKind, effortKm,
  cumulative, formatLiters, formatDuration, HEAT_FACTORS, DEFAULTS,
} from '../js/hydration.js';

// Straight route going north: 20 steps of 0.01° of latitude (~1.112 km each,
// ~22.2 km total), climbing 100 m per step for a 2000 m gain.
function climbRoute() {
  const lat = [];
  const lon = [];
  const ele = [];
  for (let i = 0; i <= 20; i++) {
    lat.push(45 + i * 0.01);
    lon.push(6.0);
    ele.push(1000 + i * 100);
  }
  return { lat, lon, ele };
}

/** Waypoint as produced by overpass.js / the manual-waypoint form. */
function wpt(index, queryName, id) {
  return { index, queryName, osmType: 'node', id, name: queryName + id, lat: 45 + index * 0.01, lon: 6 };
}

const OPTS = { intake: 500, capacity: 1000, speed: 5, heat: 'temperate', sources: 'hut' };

test('effort km: 100 m of climb costs one flat kilometre', () => {
  assert.equal(effortKm(10, 500), 15);
  assert.equal(effortKm(10, 0), 10);
  assert.equal(effortKm(10, -200), 10); // descents are free in this model
});

test('cumulative: distance and positive gain only', () => {
  const { dist, gain } = cumulative({ lat: [45, 45.01, 45.02], lon: [6, 6, 6], ele: [1000, 1100, 1050] });
  assert.ok(Math.abs(dist[2] - 2.224) < 0.01);
  assert.equal(gain[2], 100); // the 50 m descent is not subtracted
});

test('source kinds follow the trust level of the selected set', () => {
  assert.equal(sourceKind(wpt(1, 'drinking_water', 1)), 'tap');
  assert.equal(sourceKind(wpt(1, 'alpine_hut', 1)), 'hut');
  assert.equal(sourceKind(wpt(1, 'spring', 1)), 'natural');
  assert.equal(sourceKind(wpt(1, 'peak', 1)), null);
  // Our own reminders mark where to drink, never where to fill up.
  assert.equal(sourceKind({ queryName: 'drinking_water', drinkReminder: true }), null);
});

test('stops: start, selected sources in order, finish', () => {
  const route = climbRoute();
  const pts = [wpt(15, 'spring', 3), wpt(5, 'drinking_water', 1), wpt(10, 'alpine_hut', 2)];

  const taps = stopsAlong(route, pts, { sources: 'tap' });
  assert.deepEqual(taps.map((s) => s.kind), ['start', 'tap', 'end']);

  const huts = stopsAlong(route, pts, { sources: 'hut' });
  assert.deepEqual(huts.map((s) => s.kind), ['start', 'tap', 'hut', 'end']);
  assert.deepEqual(huts.map((s) => s.index), [0, 5, 10, 20]);

  const all = stopsAlong(route, pts, { sources: 'all' });
  assert.deepEqual(all.map((s) => s.kind), ['start', 'tap', 'hut', 'natural', 'end']);
});

test('stops: sources on the endpoints or next to each other are merged', () => {
  const route = climbRoute();
  const pts = [
    wpt(0, 'fountain', 1),  // on the start point
    wpt(10, 'fountain', 2),
    wpt(10, 'spring', 3),   // same spot as the previous one
    wpt(20, 'fountain', 4), // on the finish point
  ];
  const stops = stopsAlong(route, pts, { sources: 'all' });
  assert.deepEqual(stops.map((s) => s.index), [0, 10, 20]);
});

test('plan: legs between sources, water from the effort they cost', () => {
  const route = climbRoute();
  const plan = buildPlan(route, [wpt(10, 'drinking_water', 1)], OPTS);

  assert.equal(plan.legs.length, 2);
  const [first] = plan.legs;
  // Half the route: ~11.1 km and 1000 m of climb -> ~21.1 km-effort, ~4.2 h.
  assert.ok(Math.abs(first.km - 11.12) < 0.05);
  assert.equal(first.dplus, 1000);
  assert.ok(Math.abs(first.hours - 4.22) < 0.05);
  assert.ok(Math.abs(first.needMl - 2112) < 30); // 4.22 h at 500 mL/h
  // The whole outing costs what its legs cost.
  assert.equal(plan.needMl, plan.legs.reduce((a, l) => a + l.needMl, 0));
  assert.equal(plan.sourceCount, 1);
});

test('plan: a leg asking for more than the flasks hold is flagged', () => {
  const route = climbRoute();
  const plan = buildPlan(route, [], OPTS); // no source at all: one long leg
  assert.equal(plan.legs.length, 1);
  assert.equal(plan.legs[0].ok, false);
  assert.equal(plan.riskyLegs.length, 1);
  assert.equal(plan.legs[0].shortMl, plan.legs[0].needMl - OPTS.capacity);
  assert.equal(plan.driest, plan.legs[0]);

  // A big enough pack turns the same route into a comfortable one.
  const big = buildPlan(route, [], { ...OPTS, capacity: 6000 });
  assert.equal(big.riskyLegs.length, 0);
  assert.equal(big.legs[0].shortMl, 0);
});

test('plan: fills carry enough for the next leg, capped by the flasks', () => {
  const route = climbRoute();
  const source = wpt(18, 'drinking_water', 1); // late source: short last leg
  const plan = buildPlan(route, [source], OPTS);

  // Long first leg: leave with full flasks.
  assert.equal(plan.carryStartMl, OPTS.capacity);
  assert.equal(plan.fills.get('start'), OPTS.capacity);
  // Short last leg: only take what it needs.
  const fill = plan.fills.get('node1');
  assert.ok(fill > 0 && fill < OPTS.capacity);
  assert.equal(fill, plan.legs[1].needMl);
  // Nothing to fill at the finish.
  assert.equal(plan.fills.has('end'), false);
});

test('plan: heat and pace drive the amount', () => {
  const route = climbRoute();
  const mild = buildPlan(route, [], { ...OPTS, heat: 'temperate' });
  const hot = buildPlan(route, [], { ...OPTS, heat: 'scorching' });
  assert.equal(hot.rate, OPTS.intake * HEAT_FACTORS.scorching);
  assert.ok(Math.abs(hot.needMl - mild.needMl * HEAT_FACTORS.scorching) < 2);

  // Running the same route twice as fast halves the time on your feet.
  const fast = buildPlan(route, [], { ...OPTS, speed: 10 });
  assert.ok(Math.abs(fast.hours - mild.hours / 2) < 0.01);
});

test('plan: an unusable route yields no plan', () => {
  assert.equal(buildPlan(null, [], OPTS), null);
  assert.equal(buildPlan({ lat: [45], lon: [6], ele: [0] }, [], OPTS), null);
});

test('plan: falls back on the defaults for absurd settings', () => {
  const route = climbRoute();
  const plan = buildPlan(route, [], { ...OPTS, speed: 0, capacity: -1 });
  assert.equal(plan.speed, DEFAULTS.speed);
  assert.equal(plan.capacity, DEFAULTS.capacity);
});

test('reminders: one every N km, sip sized by the effort of the stretch', () => {
  const route = climbRoute();
  const rem = drinkReminders(route, { ...OPTS, remindKm: 5 });
  assert.deepEqual(rem.map((r) => r.km), [5, 10, 15, 20]);
  for (const r of rem) {
    assert.ok(r.index > 0 && r.index < route.lat.length);
    assert.ok(r.lat > 45 && r.lat < 45.2);
  }
  // Constant slope: every stretch costs the same, and the sips add up to
  // the water of the legs they cover.
  const ml = rem.map((r) => r.ml);
  assert.ok(Math.max(...ml) - Math.min(...ml) <= 1);
  const plan = buildPlan(route, [], { ...OPTS, remindKm: 5 });
  assert.ok(ml.reduce((a, b) => a + b, 0) < plan.needMl);
});

test('reminders: none when disabled, capped on absurd intervals', () => {
  const route = climbRoute();
  assert.deepEqual(drinkReminders(route, { ...OPTS, remindKm: 0 }), []);
  assert.deepEqual(drinkReminders(null, { ...OPTS, remindKm: 5 }), []);
  assert.ok(drinkReminders(route, { ...OPTS, remindKm: 0.01 }).length <= 200);
});

test('reminders: nothing dropped right on the finish line', () => {
  // ~22.2 km: a reminder every 11.1 km would land exactly on the finish.
  const rem = drinkReminders(climbRoute(), { ...OPTS, remindKm: 11.12 });
  assert.deepEqual(rem.map((r) => Math.round(r.km)), [11]);
});

test('display helpers', () => {
  assert.equal(formatLiters(2400), '2.4 L');
  assert.equal(formatLiters(750), '0.75 L');
  assert.equal(formatLiters(500), '0.5 L');
  assert.equal(formatDuration(0.5), '30 min');
  assert.equal(formatDuration(4.75), '4 h 45');
});
