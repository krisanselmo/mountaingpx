import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bbox, segmentRoute, buildAllFilters, buildQuery, snapElements } from '../js/overpass.js';

test('bbox: south,west,north,east with margin', () => {
  assert.equal(bbox([45, 46], [6, 7], 0.5), '44.5,5.5,46.5,7.5');
  // Default margin.
  assert.equal(bbox([45], [6]), '44.999,5.999,45.001,6.001');
});

test('segmentRoute: one box for a short route, several for a long one', () => {
  const short = { lat: [45.0, 45.01], lon: [6.0, 6.01] };
  assert.equal(segmentRoute(short).length, 1);

  // ~111 km along a meridian: 2-3 segments of ~45 km.
  const lat = [];
  const lon = [];
  for (let i = 0; i <= 100; i++) {
    lat.push(45 + i / 100);
    lon.push(6);
  }
  const boxes = segmentRoute({ lat, lon });
  assert.ok(boxes.length >= 2 && boxes.length <= 4, `got ${boxes.length}`);
  for (const b of boxes) assert.match(b, /^[\d.,-]+$/);
});

test('buildAllFilters: catalog filters plus a guarded custom snippet', () => {
  const filters = buildAllFilters('');
  assert.ok(filters.includes('node["natural"="peak"]'));
  assert.ok(filters.includes('way["tourism"="alpine_hut"]'));

  const withCustom = buildAllFilters('way["leisure"="park"]');
  assert.ok(withCustom.includes('way["leisure"="park"]'));

  // Anything that is not a single node/way/relation filter is dropped.
  assert.equal(buildAllFilters('foo; out body;').length, filters.length);
  assert.equal(buildAllFilters('node[amenity]; node[shop]').length, filters.length);
});

test('buildQuery: assembles the Overpass QL statement', () => {
  const q = buildQuery('1,2,3,4', ['node["natural"="peak"]']);
  assert.match(q, /^\[out:json\]\[timeout:90\];/);
  assert.ok(q.includes('node["natural"="peak"](1,2,3,4);'));
  assert.match(q, /out geom;$/);
});

// Straight route along the 45th parallel; POIs must snap on middle points
// (the endpoints are never densified).
const route = {
  lat: [45, 45, 45, 45, 45],
  lon: [6.00, 6.01, 6.02, 6.03, 6.04],
  ele: [0, 0, 0, 0, 0],
};
const allTypes = { withName: new Set(['peak']), noName: new Set(['spring']), custom: '' };
const LIM = 0.05; // 50 m

test('snapElements: named node within reach is snapped with its OSM name', () => {
  const elements = [
    { type: 'node', id: 1, lat: 45.0001, lon: 6.02, tags: { natural: 'peak', name: 'Pic A', ele: '2800' } },
  ];
  const pts = snapElements(elements, route, allTypes, LIM);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].name, 'Pic A');
  assert.equal(pts[0].queryName, 'peak');
  assert.equal(pts[0].ele, 2800);
  assert.equal(pts[0].index, 2);
});

test('snapElements: out-of-reach and unselected elements are dropped', () => {
  const elements = [
    // ~1.1 km north of the route: beyond the 50 m snap distance.
    { type: 'node', id: 1, lat: 45.01, lon: 6.02, tags: { natural: 'peak', name: 'Trop loin' } },
    // In reach but the type is not selected.
    { type: 'node', id: 2, lat: 45.0001, lon: 6.02, tags: { natural: 'saddle', name: 'Col' } },
    // In reach, named, but only the no-name variant of springs is selected.
    { type: 'node', id: 3, lat: 45.0001, lon: 6.03, tags: { natural: 'spring', name: 'Source' } },
  ];
  assert.equal(snapElements(elements, route, allTypes, LIM).length, 0);
});

test('snapElements: unnamed POIs get numbered generic names', () => {
  const elements = [
    { type: 'node', id: 1, lat: 45.0001, lon: 6.01, tags: { natural: 'spring' } },
    { type: 'node', id: 2, lat: 45.0001, lon: 6.03, tags: { natural: 'spring' } },
  ];
  const pts = snapElements(elements, route, allTypes, LIM);
  assert.deepEqual(pts.map((p) => p.name).sort(), ['spring1', 'spring2']);
  assert.ok(pts.every((p) => p.hasName === false));
});

test('snapElements: ways snap through their geometry, one POI per route point', () => {
  const elements = [
    // Node and way competing for index 2: nodes have priority.
    { type: 'node', id: 1, lat: 45.0001, lon: 6.02, tags: { natural: 'peak', name: 'Pic' } },
    {
      type: 'way', id: 2, tags: { tourism: 'alpine_hut', name: 'Refuge' },
      geometry: [{ lat: 45.0001, lon: 6.0199 }, { lat: 45.0001, lon: 6.0201 }],
    },
  ];
  const sel = { withName: new Set(['peak', 'alpine_hut']), noName: new Set(), custom: '' };
  const pts = snapElements(elements, route, sel, LIM);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].osmType, 'node');
});

test('snapElements: custom-query elements bypass the type selection', () => {
  const elements = [
    { type: 'node', id: 1, lat: 45.0001, lon: 6.02, tags: { leisure: 'park', name: 'Parc' } },
  ];
  const none = { withName: new Set(), noName: new Set(), custom: 'node["leisure"="park"]' };
  const pts = snapElements(elements, route, none, LIM);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].queryName, ''); // no catalog type
});
