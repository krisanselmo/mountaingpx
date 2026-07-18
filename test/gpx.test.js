import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as GPX from '../js/gpx.js';
import { describeText } from '../js/overpass.js';

// Minimal route + POIs covering the mapped, fallback and note cases.
const route = {
  name: 'Test Route',
  lat: [45.00, 45.10],
  lon: [6.00, 6.10],
  ele: [1000, 1100],
  waypoints: [],
};
const pts = [
  { lat: 45.02, lon: 6.02, ele: 2564, name: 'Col Test', queryName: 'saddle', descText: '2564 m' },
  { lat: 45.04, lon: 6.04, ele: 1890, name: 'Source Test', queryName: 'spring', descText: '1890 m · Source' },
  { lat: 45.06, lon: 6.06, ele: 2100, name: 'Refuge Test', queryName: 'alpine_hut', descText: '2100 m · CAF' },
  { lat: 45.08, lon: 6.08, ele: 900, name: 'Château Test', queryName: 'castle', descText: '' },
];

test('waypoints carry a Garmin course-point <type>, not the raw OSM type', () => {
  const gpx = GPX.build(route, pts, false);
  assert.match(gpx, /<name>Col Test<\/name>[^]*?<type>summit<\/type>/);
  assert.match(gpx, /<name>Source Test<\/name>[^]*?<type>water<\/type>/);
  assert.match(gpx, /<name>Refuge Test<\/name>[^]*?<type>shelter<\/type>/);
  // Raw OSM types must not leak into <type>.
  assert.doesNotMatch(gpx, /<type>saddle<\/type>/);
  assert.doesNotMatch(gpx, /<type>spring<\/type>/);
});

test('unmapped POI types fall back to "generic"', () => {
  const gpx = GPX.build(route, pts, false);
  assert.match(gpx, /<name>Château Test<\/name>[^]*?<type>generic<\/type>/);
});

test('notes are the readable one-liner, no <sym>, no OSM tag dump', () => {
  const gpx = GPX.build(route, pts, false);
  assert.match(gpx, /<cmt>2564 m<\/cmt>/);
  assert.match(gpx, /<cmt>1890 m · Source<\/cmt>/);
  assert.doesNotMatch(gpx, /<sym>/);
  assert.doesNotMatch(gpx, /hikingyes|OSM #/);
});

test('every generated POI is emitted as a <wpt> with its name', () => {
  const gpx = GPX.build(route, pts, false);
  assert.equal((gpx.match(/<wpt /g) || []).length, pts.length);
  for (const p of pts) assert.ok(gpx.includes(`<name>${p.name}</name>`));
});

test('describeText builds a readable note from OSM tags', () => {
  assert.equal(describeText({ ele: '1890', information: 'guidepost', tourism: 'information' }), '1890 m');
  assert.equal(
    describeText({ ele: '2107', operator: 'CAF', capacity: '30', website: 'https://x.fr' }),
    '2107 m · CAF · 30 places · https://x.fr',
  );
  assert.equal(describeText({ natural: 'saddle' }), '');
  assert.equal(describeText(null), '');
});
