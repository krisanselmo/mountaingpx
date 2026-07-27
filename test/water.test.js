import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boundsAreaKm2, createWaterOverlay, WATER_FILTERS, WATER_MAX_AREA_KM2,
} from '../js/water.js';

// Leaflet-like LatLngBounds stub.
function B(s, w, n, e) {
  return {
    getSouth: () => s,
    getWest: () => w,
    getNorth: () => n,
    getEast: () => e,
    pad(r) {
      const dv = (n - s) * r;
      const dh = (e - w) * r;
      return B(s - dv, w - dh, n + dv, e + dh);
    },
    contains(o) {
      return o.getSouth() >= s && o.getNorth() <= n && o.getWest() >= w && o.getEast() <= e;
    },
  };
}

// Minimal Leaflet-like map: event emitter + current bounds.
function fakeMap(layer, bounds) {
  const handlers = {};
  return {
    bounds,
    on(names, fn) {
      for (const nm of names.split(' ')) (handlers[nm] = handlers[nm] || []).push(fn);
    },
    fire(name, ev) {
      for (const fn of handlers[name] || []) fn(ev);
    },
    getBounds() { return this.bounds; },
    hasLayer(l) { return l === layer; },
  };
}

function fakeLayer() {
  return {
    cleared: 0,
    added: [],
    clearLayers() { this.cleared++; this.added = []; },
  };
}

function fakeMarkerFactory() {
  const made = [];
  const makeMarker = (el) => {
    const m = { el, addTo(layer) { layer.added.push(m); } };
    made.push(m);
    return m;
  };
  return { made, makeMarker };
}

const SMALL = B(45.0, 6.0, 45.1, 6.1); // ~87 km²
const HUGE = B(40, 0, 50, 10); // way past the cap

const tick = () => new Promise((r) => setTimeout(r, 5));

function setup(bounds, elements) {
  const layer = fakeLayer();
  const map = fakeMap(layer, bounds);
  const { made, makeMarker } = fakeMarkerFactory();
  const calls = [];
  let tooWide = 0;
  createWaterOverlay({
    map,
    layer,
    fetchWater: async (box) => { calls.push(box); return elements; },
    makeMarker,
    onTooWide: () => tooWide++,
    debounceMs: 0,
  });
  return { layer, map, made, calls, tooWideCount: () => tooWide };
}

test('boundsAreaKm2: rough area of a bounds box', () => {
  const area = boundsAreaKm2(B(45.0, 6.0, 45.1, 6.1));
  assert.ok(area > 80 && area < 95, `got ${area}`);
  assert.ok(boundsAreaKm2(HUGE) > WATER_MAX_AREA_KM2);
});

test('exports the water filters used by the generation catalog too', () => {
  assert.ok(WATER_FILTERS.includes('node["amenity"="drinking_water"]'));
});

test('enabling the overlay on a small view fetches a padded box once', async () => {
  const { layer, map, calls } = setup(SMALL, [
    { type: 'node', id: 1, lat: 45.05, lon: 6.05, tags: {} },
    { type: 'node', id: 1, lat: 45.05, lon: 6.05, tags: {} }, // duplicate
    { type: 'way', id: 2 }, // non-node, ignored
  ]);
  map.fire('overlayadd', { layer });
  await tick();
  assert.equal(calls.length, 1);
  // The fetched box is padded beyond the visible bounds.
  const [s, w, n, e] = calls[0].split(',').map(Number);
  assert.ok(s < 45.0 && w < 6.0 && n > 45.1 && e > 6.1);
  // One marker: the duplicate node and the way are skipped.
  assert.equal(layer.added.length, 1);
});

test('enabling the overlay on a too-wide view warns instead of querying', async () => {
  const { map, layer, calls, tooWideCount } = setup(HUGE, []);
  map.fire('overlayadd', { layer });
  await tick();
  assert.equal(calls.length, 0);
  assert.equal(tooWideCount(), 1);
});

test('moving inside the already-fetched area does not re-query', async () => {
  const { map, layer, calls } = setup(SMALL, []);
  map.fire('overlayadd', { layer });
  await tick();
  assert.equal(calls.length, 1);
  // Pan slightly, still inside the padded fetched bounds.
  map.bounds = B(45.01, 6.01, 45.11, 6.11);
  map.fire('moveend');
  await tick();
  assert.equal(calls.length, 1);
  // Jump far away: a new fetch is needed.
  map.bounds = B(46.0, 7.0, 46.1, 7.1);
  map.fire('moveend');
  await tick();
  assert.equal(calls.length, 2);
});

test('zooming way out hides the dots, zooming back restores them', async () => {
  const { map, layer } = setup(SMALL, [
    { type: 'node', id: 1, lat: 45.05, lon: 6.05, tags: {} },
  ]);
  map.fire('overlayadd', { layer });
  await tick();
  assert.equal(layer.added.length, 1);

  map.bounds = HUGE;
  map.fire('moveend');
  await tick();
  assert.equal(layer.cleared, 1);
  assert.equal(layer.added.length, 0);

  map.bounds = SMALL;
  map.fire('moveend');
  await tick();
  assert.equal(layer.added.length, 1);
});
