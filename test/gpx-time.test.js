import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as GPX from '../js/gpx.js';

// gpx.js relies on the browser DOMParser; jsdom provides it under Node.
before(() => {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
});

const TIMED_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SomeApp" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Chrono</name><trkseg>
    <trkpt lat="45.00" lon="6.00"><ele>1000</ele><time>2024-06-01T08:00:00Z</time></trkpt>
    <trkpt lat="45.01" lon="6.00"><ele>1100</ele><time>2024-06-01T08:10:00Z</time></trkpt>
    <trkpt lat="45.02" lon="6.00"><ele>1200</ele><time>2024-06-01T08:20:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

test('parse: timestamps are read as epoch ms', () => {
  const route = GPX.parse(TIMED_GPX);
  assert.deepEqual(route.time, [
    Date.parse('2024-06-01T08:00:00Z'),
    Date.parse('2024-06-01T08:10:00Z'),
    Date.parse('2024-06-01T08:20:00Z'),
  ]);
});

test('parse: a file without <time> yields time = null', () => {
  const route = GPX.parse(`<?xml version="1.0"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>
        <trkpt lat="45.0" lon="6.0"/><trkpt lat="45.1" lon="6.1"/>
      </trkseg></trk>
    </gpx>`);
  assert.equal(route.time, null);
});

test('parse: an unreadable timestamp becomes null without dropping the others', () => {
  const route = GPX.parse(`<?xml version="1.0"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>
        <trkpt lat="45.0" lon="6.0"><time>not a date</time></trkpt>
        <trkpt lat="45.1" lon="6.1"><time>2024-06-01T08:10:00Z</time></trkpt>
      </trkseg></trk>
    </gpx>`);
  assert.deepEqual(route.time, [null, Date.parse('2024-06-01T08:10:00Z')]);
});

test('build: source timestamps survive the export', () => {
  const route = GPX.parse(TIMED_GPX);
  const xml = GPX.build(route, [], false);
  assert.equal((xml.match(/<time>/g) || []).length, 3);
  assert.ok(xml.includes('<time>2024-06-01T08:00:00Z</time>'));
  assert.ok(xml.includes('<time>2024-06-01T08:10:00Z</time>'));
  assert.ok(xml.includes('<time>2024-06-01T08:20:00Z</time>'));
});

test('build: no <time> is emitted for an untimed route', () => {
  const route = GPX.parse(TIMED_GPX);
  route.time = null;
  const xml = GPX.build(route, [], false);
  assert.doesNotMatch(xml, /<trkpt [^>]*>[^\n]*<time>/);
});

test('densify: inserted projections get a distance-interpolated timestamp', () => {
  const route = GPX.parse(TIMED_GPX);
  // Waypoint projected halfway between points 0 and 1, anchored on 1.
  const pt = { lat: 45.005, lon: 6.00, index: 1, newGpxIndex: 0 };
  const { lat, time } = GPX.densify(route, [pt]);
  assert.deepEqual(lat, [45.00, 45.005, 45.01, 45.02]);
  const t0 = Date.parse('2024-06-01T08:00:00Z');
  const t1 = Date.parse('2024-06-01T08:10:00Z');
  // Halfway along the leg -> halfway between the timestamps (±1s of rounding).
  assert.ok(Math.abs(time[1] - (t0 + (t1 - t0) / 2)) < 1000, `got ${time[1]}`);
  // Original points keep their exact timestamps.
  assert.equal(time[0], t0);
  assert.equal(time[2], t1);
});

test('densify: interpolation falls back to the known neighbour timestamp', () => {
  const route = GPX.parse(TIMED_GPX);
  route.time[0] = null;
  const pt = { lat: 45.005, lon: 6.00, index: 1, newGpxIndex: 0 };
  const { time } = GPX.densify(route, [pt]);
  assert.equal(time[1], Date.parse('2024-06-01T08:10:00Z'));
});

test('build: an inserted waypoint keeps the exported <time> sequence monotonic', () => {
  const route = GPX.parse(TIMED_GPX);
  const pt = { lat: 45.015, lon: 6.00, index: 1, newGpxIndex: 2 };
  const xml = GPX.build(route, [pt], false);
  const times = [...xml.matchAll(/<time>([^<]+)<\/time>/g)].map((m) => Date.parse(m[1]));
  assert.equal(times.length, 4);
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] >= times[i - 1], `not monotonic at ${i}`);
  }
});

test('parse: trackCount counts the <trk> elements carrying points', () => {
  const single = GPX.parse(TIMED_GPX);
  assert.equal(single.trackCount, 1);

  const multi = GPX.parse(`<?xml version="1.0"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><name>Jour 1</name><trkseg>
        <trkpt lat="45.0" lon="6.0"/><trkpt lat="45.1" lon="6.1"/>
      </trkseg></trk>
      <trk><name>Vide</name><trkseg/></trk>
      <trk><name>Jour 2</name><trkseg>
        <trkpt lat="46.0" lon="7.0"/><trkpt lat="46.1" lon="7.1"/>
      </trkseg></trk>
    </gpx>`);
  // The empty <trk> does not count; the two real ones are concatenated.
  assert.equal(multi.trackCount, 2);
  assert.equal(multi.lat.length, 4);
});

test('parse: several <trkseg> of a single <trk> stay one track', () => {
  const route = GPX.parse(`<?xml version="1.0"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg>
        <trkpt lat="45.0" lon="6.0"/><trkpt lat="45.1" lon="6.1"/>
      </trkseg><trkseg>
        <trkpt lat="45.2" lon="6.2"/>
      </trkseg></trk>
    </gpx>`);
  assert.equal(route.trackCount, 1);
});
