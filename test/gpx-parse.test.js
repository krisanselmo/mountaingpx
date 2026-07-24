import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as GPX from '../js/gpx.js';

// gpx.js relies on the browser DOMParser; jsdom provides it under Node.
before(() => {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
});

const GPX_WITH_WAYPOINTS = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SomeOtherApp" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="45.905" lon="6.872"><ele>2100</ele><name>Pic Test</name><type>summit</type></wpt>
  <wpt lat="45.912" lon="6.879"><name>Repère</name><type>Flag, Blue</type><cmt>un commentaire</cmt></wpt>
  <wpt lat="45.918" lon="6.886"><name>Fontaine</name><sym>Drinking Water</sym><desc>robinet</desc></wpt>
  <trk>
    <name>Trace Test</name>
    <trkseg>
      <trkpt lat="45.900" lon="6.870"><ele>1000</ele></trkpt>
      <trkpt lat="45.910" lon="6.880"><ele>1200</ele></trkpt>
      <trkpt lat="45.920" lon="6.890"><ele>1400</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

test('parse: track points and elevations', () => {
  const route = GPX.parse(GPX_WITH_WAYPOINTS);
  assert.deepEqual(route.lat, [45.9, 45.91, 45.92]);
  assert.deepEqual(route.lon, [6.87, 6.88, 6.89]);
  assert.deepEqual(route.ele, [1000, 1200, 1400]);
});

test('parse: waypoints carry name, type, sym and desc/cmt', () => {
  const { waypoints } = GPX.parse(GPX_WITH_WAYPOINTS);
  assert.equal(waypoints.length, 3);
  assert.deepEqual(
    waypoints.map((w) => [w.name, w.type, w.sym, w.desc]),
    [
      ['Pic Test', 'summit', '', ''],
      ['Repère', 'Flag, Blue', '', 'un commentaire'],
      ['Fontaine', '', 'Drinking Water', 'robinet'],
    ]
  );
  assert.equal(waypoints[0].ele, '2100');
  assert.equal(waypoints[0].lat, 45.905);
});

test('parse: the route name comes from <trk>, not from a preceding <wpt>', () => {
  const route = GPX.parse(GPX_WITH_WAYPOINTS);
  assert.equal(route.name, 'Trace Test');
});

test('parse: <rte>/<rtept> files work and expose their name', () => {
  const route = GPX.parse(`<?xml version="1.0"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <rte><name>Itinéraire</name>
        <rtept lat="45.0" lon="6.0"><ele>900</ele></rtept>
        <rtept lat="45.1" lon="6.1"><ele>950</ele></rtept>
      </rte>
    </gpx>`);
  assert.equal(route.name, 'Itinéraire');
  assert.deepEqual(route.lat, [45.0, 45.1]);
});

test('parse: no track name and no metadata leaves the name empty', () => {
  const route = GPX.parse(`<?xml version="1.0"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <wpt lat="45.0" lon="6.0"><name>Un waypoint</name></wpt>
      <trk><trkseg>
        <trkpt lat="45.0" lon="6.0"/><trkpt lat="45.1" lon="6.1"/>
      </trkseg></trk>
    </gpx>`);
  assert.equal(route.name, '');
});

test('parse: errors carry i18n codes', () => {
  assert.throws(() => GPX.parse('not xml <<<'), (e) => e.code === 'error.gpxInvalidXml');
  assert.throws(
    () => GPX.parse('<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"></gpx>'),
    (e) => e.code === 'error.gpxNoPoints'
  );
});
