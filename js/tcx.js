/*
 * tcx.js — build a Garmin TCX Course from a route + snapped waypoints.
 *
 * Garmin Connect imports GPX, TCX and FIT. A TCX *Course* carries typed
 * `CoursePoint` markers (Summit, Water, Food…) that render as dedicated icons
 * on Garmin devices, which plain GPX `<wpt>` cannot express. The track itself
 * is emitted as `Trackpoint`s with synthetic (monotonic) timestamps and a
 * cumulative distance, both of which the TCX schema requires.
 */
import { haversine } from './geometry.js';
import { densify, esc } from './gpx.js';

// TCX CoursePointType_t only allows a fixed vocabulary; anything unmapped
// falls back to "Generic". Keys are POI types (poi.js `queryName`) or the raw
// `type`/`sym` of a waypoint already present in the source file.
const POINT_TYPE = {
  // Summits & high points
  peak: 'Summit', saddle: 'Summit', volcano: 'Summit',
  viewpoint: 'Summit', toposcope: 'Summit', attraction: 'Summit',
  // Water
  drinking_water: 'Water', fountain: 'Water', spring: 'Water',
  waterfall: 'Water', lake: 'Water', glacier: 'Water', ford: 'Water',
  // Shelter / food
  alpine_hut: 'Food', wilderness_hut: 'Food', shelter: 'Food',
  camp_site: 'Food', hostel: 'Food', hotel: 'Food',
  // Hazards
  barrier: 'Danger', tunnel: 'Danger', cave_entrance: 'Danger',
};

function pointType(type) {
  return POINT_TYPE[type] || 'Generic';
}

// Fixed epoch for synthetic timestamps: a course has no real recording time,
// but the schema still requires monotonic `<Time>` values.
const BASE_TIME = Date.parse('2000-01-01T00:00:00Z');
function timeAt(seconds) {
  return new Date(BASE_TIME + seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Index of the densified track point closest to (lon, lat). */
function nearestIndex(lon, lat, wLon, wLat) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < lat.length; i++) {
    const d = haversine(lon[i], lat[i], wLon, wLat);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Build a TCX Course XML string from the original route + detected waypoints.
 * Mirrors gpx.build(): `pts` are Waypoint objects (see overpass.js) and
 * `keepOld` preserves the waypoints already present in the source file.
 */
export function build(route, pts, keepOld) {
  const { name } = route;
  const { lat, lon, ele } = densify(route, pts);

  // Cumulative distance (metres) along the densified track.
  const dist = new Array(lat.length);
  dist[0] = 0;
  for (let i = 1; i < lat.length; i++) {
    dist[i] = dist[i - 1] + haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]) * 1000;
  }
  const total = dist.length ? dist[dist.length - 1] : 0;
  const last = lat.length - 1;

  // Gather the course points (from both kept and generated waypoints).
  const cps = [];
  if (keepOld && route.waypoints) {
    for (const w of route.waypoints) {
      if (Number.isNaN(w.lat) || Number.isNaN(w.lon)) continue;
      cps.push({ lat: w.lat, lon: w.lon, name: w.name, type: w.type, notes: '' });
    }
  }
  for (const p of pts) {
    cps.push({ lat: p.lat, lon: p.lon, name: p.name, type: p.queryName, notes: p.descText });
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<TrainingCenterDatabase'
    + ' xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"'
    + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
    + ' xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2'
    + ' http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n';
  xml += '  <Courses>\n';
  xml += '    <Course>\n';
  xml += '      <Name>' + esc(name || 'Mountain GPX') + '</Name>\n';

  // A single lap spanning the whole track.
  xml += '      <Lap>\n';
  xml += '        <TotalTimeSeconds>' + last + '</TotalTimeSeconds>\n';
  xml += '        <DistanceMeters>' + total.toFixed(1) + '</DistanceMeters>\n';
  if (lat.length) {
    xml += '        <BeginPosition>\n';
    xml += '          <LatitudeDegrees>' + lat[0] + '</LatitudeDegrees>\n';
    xml += '          <LongitudeDegrees>' + lon[0] + '</LongitudeDegrees>\n';
    xml += '        </BeginPosition>\n';
    xml += '        <EndPosition>\n';
    xml += '          <LatitudeDegrees>' + lat[last] + '</LatitudeDegrees>\n';
    xml += '          <LongitudeDegrees>' + lon[last] + '</LongitudeDegrees>\n';
    xml += '        </EndPosition>\n';
  }
  xml += '        <Intensity>Active</Intensity>\n';
  xml += '      </Lap>\n';

  // Track.
  xml += '      <Track>\n';
  for (let i = 0; i < lat.length; i++) {
    xml += '        <Trackpoint>\n';
    xml += '          <Time>' + timeAt(i) + '</Time>\n';
    xml += '          <Position>\n';
    xml += '            <LatitudeDegrees>' + lat[i] + '</LatitudeDegrees>\n';
    xml += '            <LongitudeDegrees>' + lon[i] + '</LongitudeDegrees>\n';
    xml += '          </Position>\n';
    xml += '          <AltitudeMeters>' + (ele[i] || 0) + '</AltitudeMeters>\n';
    xml += '          <DistanceMeters>' + dist[i].toFixed(1) + '</DistanceMeters>\n';
    xml += '        </Trackpoint>\n';
  }
  xml += '      </Track>\n';

  // Emit course points in track order, snapped onto a track point: Garmin drops
  // those with non-increasing <Time> or a <Position> off the track.
  for (const cp of cps) {
    cp.idx = nearestIndex(lon, lat, cp.lon, cp.lat);
  }
  cps.sort((a, b) => a.idx - b.idx);

  for (const cp of cps) {
    const idx = cp.idx;
    xml += '      <CoursePoint>\n';
    xml += '        <Name>' + esc(cp.name || '') + '</Name>\n';
    xml += '        <Time>' + timeAt(idx) + '</Time>\n';
    xml += '        <Position>\n';
    xml += '          <LatitudeDegrees>' + lat[idx] + '</LatitudeDegrees>\n';
    xml += '          <LongitudeDegrees>' + lon[idx] + '</LongitudeDegrees>\n';
    xml += '        </Position>\n';
    xml += '        <PointType>' + pointType(cp.type) + '</PointType>\n';
    if (cp.notes) xml += '        <Notes>' + esc(cp.notes) + '</Notes>\n';
    xml += '      </CoursePoint>\n';
  }

  xml += '    </Course>\n';
  xml += '  </Courses>\n';
  xml += '</TrainingCenterDatabase>\n';
  return xml;
}
