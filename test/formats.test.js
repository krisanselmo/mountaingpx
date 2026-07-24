import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as Formats from '../js/formats.js';

// The XML parsers rely on the browser DOMParser; jsdom provides it under Node.
before(() => {
  globalThis.DOMParser = new JSDOM().window.DOMParser;
});

// ---- TCX -----------------------------------------------------------------
const TCX_COURSE = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Courses><Course>
    <Name>Tour du Lac</Name>
    <Track>
      <Trackpoint><Time>2026-01-01T10:00:00Z</Time>
        <Position><LatitudeDegrees>45.900</LatitudeDegrees><LongitudeDegrees>6.870</LongitudeDegrees></Position>
        <AltitudeMeters>1000</AltitudeMeters></Trackpoint>
      <Trackpoint><Time>2026-01-01T10:01:00Z</Time></Trackpoint>
      <Trackpoint><Time>2026-01-01T10:02:00Z</Time>
        <Position><LatitudeDegrees>45.910</LatitudeDegrees><LongitudeDegrees>6.880</LongitudeDegrees></Position>
        <AltitudeMeters>1200</AltitudeMeters></Trackpoint>
    </Track>
    <CoursePoint>
      <Name>Le Pic</Name><PointType>Summit</PointType>
      <Position><LatitudeDegrees>45.905</LatitudeDegrees><LongitudeDegrees>6.872</LongitudeDegrees></Position>
      <AltitudeMeters>2100</AltitudeMeters>
    </CoursePoint>
  </Course></Courses>
</TrainingCenterDatabase>`;

test('tcx: trackpoints, altitudes and the course name', () => {
  const route = Formats.parseTcx(TCX_COURSE);
  assert.equal(route.name, 'Tour du Lac');
  assert.deepEqual(route.lat, [45.9, 45.91]); // the fixless trackpoint is skipped
  assert.deepEqual(route.lon, [6.87, 6.88]);
  assert.deepEqual(route.ele, [1000, 1200]);
});

test('tcx: course points become typed waypoints', () => {
  const { waypoints } = Formats.parseTcx(TCX_COURSE);
  assert.equal(waypoints.length, 1);
  assert.equal(waypoints[0].name, 'Le Pic');
  assert.equal(waypoints[0].type, 'Summit');
  assert.equal(waypoints[0].lat, 45.905);
  assert.equal(waypoints[0].ele, '2100');
});

test('tcx: errors carry i18n codes', () => {
  assert.throws(() => Formats.parseTcx('not xml <<<'), (e) => e.code === 'error.fileInvalidXml');
  assert.throws(
    () => Formats.parseTcx('<?xml version="1.0"?><TrainingCenterDatabase/>'),
    (e) => e.code === 'error.tcxNoPoints'
  );
});

// ---- KML -----------------------------------------------------------------
const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Sortie VTT</name>
    <Placemark>
      <name>La Fontaine</name>
      <description>eau fraîche</description>
      <Point><coordinates>6.872,45.905,1500</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>Ma trace</name>
      <LineString><coordinates>
        6.870,45.900,1000
        6.880,45.910,1200 6.890,45.920,1400
      </coordinates></LineString>
    </Placemark>
  </Document>
</kml>`;

test('kml: LineString coordinates and the document name', () => {
  const route = Formats.parseKml(KML);
  assert.equal(route.name, 'Sortie VTT');
  assert.deepEqual(route.lat, [45.9, 45.91, 45.92]);
  assert.deepEqual(route.lon, [6.87, 6.88, 6.89]);
  assert.deepEqual(route.ele, [1000, 1200, 1400]);
});

test('kml: Point placemarks become waypoints, the track placemark does not', () => {
  const { waypoints } = Formats.parseKml(KML);
  assert.equal(waypoints.length, 1);
  assert.equal(waypoints[0].name, 'La Fontaine');
  assert.equal(waypoints[0].desc, 'eau fraîche');
  assert.equal(waypoints[0].lat, 45.905);
});

test('kml: gx:Track recordings are read too', () => {
  const route = Formats.parseKml(`<?xml version="1.0"?>
    <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
      <Placemark><name>Rando</name><gx:Track>
        <when>2026-01-01T10:00:00Z</when><gx:coord>6.87 45.90 1000</gx:coord>
        <when>2026-01-01T10:01:00Z</when><gx:coord>6.88 45.91 1200</gx:coord>
      </gx:Track></Placemark>
    </kml>`);
  assert.deepEqual(route.lat, [45.9, 45.91]);
  assert.deepEqual(route.ele, [1000, 1200]);
  assert.equal(route.name, 'Rando');
});

test('kml: errors carry i18n codes', () => {
  assert.throws(
    () => Formats.parseKml('<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"/>'),
    (e) => e.code === 'error.kmlNoPoints'
  );
});

// ---- FIT -----------------------------------------------------------------
// Synthetic FIT file built byte by byte (12-byte header, no CRC check).
const SEMI = 2 ** 31 / 180;
const semi = (deg) => Math.round(deg * SEMI);

function buildFit(records) {
  const bytes = [];
  const u8 = (v) => bytes.push(v & 0xff);
  const u16 = (v) => { u8(v); u8(v >> 8); };
  const u32 = (v) => { u16(v); u16(v >> 16); };
  const i32 = (v) => u32(v >>> 0);
  const str = (s, size) => {
    for (let i = 0; i < size; i++) u8(i < s.length ? s.charCodeAt(i) : 0);
  };

  // Definitions: local 0 = record (lat, lon, altitude), local 1 = course
  // (name), local 2 = course_point (lat, lon, type, name).
  u8(0x40); u8(0); u8(0); u16(20); u8(3);
  u8(0); u8(4); u8(0x85); u8(1); u8(4); u8(0x85); u8(2); u8(2); u8(0x84);
  u8(0x41); u8(0); u8(0); u16(31); u8(1);
  u8(5); u8(8); u8(0x07);
  u8(0x42); u8(0); u8(0); u16(32); u8(4);
  u8(1); u8(4); u8(0x85); u8(2); u8(4); u8(0x85); u8(4); u8(1); u8(0x00); u8(5); u8(8); u8(0x07);

  for (const r of records) {
    if (r.kind === 'record') {
      u8(0x00); i32(semi(r.lat)); i32(semi(r.lon)); u16(Math.round((r.ele + 500) * 5));
    } else if (r.kind === 'course') {
      u8(0x01); str(r.name, 8);
    } else {
      u8(0x02); i32(semi(r.lat)); i32(semi(r.lon)); u8(r.type); str(r.name, 8);
    }
  }

  const header = [12, 0x10, 0x54, 0x08, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54];
  const dataSize = bytes.length;
  header[4] = dataSize & 0xff;
  header[5] = (dataSize >> 8) & 0xff;
  header[6] = (dataSize >> 16) & 0xff;
  header[7] = (dataSize >> 24) & 0xff;
  return new Uint8Array([...header, ...bytes, 0, 0]).buffer; // trailing CRC
}

test('fit: records, scaled altitude, course name and course points', () => {
  const route = Formats.parseFit(buildFit([
    { kind: 'course', name: 'UTMB' },
    { kind: 'record', lat: 45.9, lon: 6.87, ele: 1000 },
    { kind: 'record', lat: 45.91, lon: 6.88, ele: 1200 },
    { kind: 'point', lat: 45.905, lon: 6.872, type: 1, name: 'Pic' }, // 1 = summit
    { kind: 'point', lat: 45.908, lon: 6.875, type: 3, name: 'Eau' }, // 3 = water
  ]));
  assert.equal(route.name, 'UTMB');
  assert.equal(route.lat.length, 2);
  assert.ok(Math.abs(route.lat[0] - 45.9) < 1e-6);
  assert.ok(Math.abs(route.lon[1] - 6.88) < 1e-6);
  assert.deepEqual(route.ele, [1000, 1200]);
  assert.deepEqual(route.waypoints.map((w) => [w.name, w.type]),
    [['Pic', 'summit'], ['Eau', 'water']]);
});

test('fit: errors carry i18n codes', () => {
  assert.throws(() => Formats.parseFit(new ArrayBuffer(4)), (e) => e.code === 'error.fitInvalid');
  const notFit = new Uint8Array(20).fill(7).buffer;
  assert.throws(() => Formats.parseFit(notFit), (e) => e.code === 'error.fitInvalid');
  assert.throws(
    () => Formats.parseFit(buildFit([{ kind: 'course', name: 'vide' }])),
    (e) => e.code === 'error.fitNoPoints'
  );
});

test('fit: truncated files fail cleanly', () => {
  const full = buildFit([{ kind: 'record', lat: 45.9, lon: 6.87, ele: 1000 }]);
  const truncated = full.slice(0, full.byteLength - 8);
  assert.throws(() => Formats.parseFit(truncated), (e) => e.code === 'error.fitInvalid');
});

// ---- dispatcher ------------------------------------------------------------
test('parse: dispatches gpx too and rejects unknown extensions', () => {
  const route = Formats.parse('gpx', `<?xml version="1.0"?>
    <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
      <trk><trkseg><trkpt lat="45.0" lon="6.0"/><trkpt lat="45.1" lon="6.1"/></trkseg></trk>
    </gpx>`);
  assert.equal(route.lat.length, 2);
  assert.throws(() => Formats.parse('doc', ''), (e) => e.code === 'error.badFormat');
});
