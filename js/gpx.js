/*
 * gpx.js — parse an uploaded GPX and rebuild one with snapped waypoints.
 * Browser port of parse_route() and build_and_save_gpx() from wpts/main.py.
 */
import { haversine } from './geometry.js';

/** Build an Error carrying an i18n `code` (translated at the display site). */
function errWithCode(code, params) {
  const e = new Error(code);
  e.code = code;
  if (params) e.params = params;
  return e;
}

/**
 * Parse a GPX string into { name, lat[], lon[], ele[], time[]|null,
 * trackCount, waypoints[] }.
 * Handles both <trk>/<trkseg>/<trkpt> and <rte>/<rtept>.
 * `time` holds one epoch-ms value (or null) per point, or is null when the
 * file carries no timestamp at all; `trackCount` counts the <trk>/<rte>
 * elements that contributed points (they are concatenated when several).
 */
export function parse(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw errWithCode('error.gpxInvalidXml');
  }

  let container = 'trk';
  let pts = Array.from(doc.getElementsByTagName('trkpt'));
  if (pts.length === 0) {
    container = 'rte';
    pts = Array.from(doc.getElementsByTagName('rtept'));
  }
  if (pts.length === 0) {
    throw errWithCode('error.gpxNoPoints');
  }

  // Several <trk> (or <rte>) in one file end up concatenated; the caller
  // can warn the user, whose profile/roadbook may otherwise look absurd.
  const trackCount = Array.from(doc.getElementsByTagName(container))
    .filter((tr) => tr.getElementsByTagName(container + 'pt').length > 0)
    .length;

  const lat = [];
  const lon = [];
  const ele = [];
  const time = [];
  let hasTime = false;
  for (const p of pts) {
    const la = parseFloat(p.getAttribute('lat'));
    const lo = parseFloat(p.getAttribute('lon'));
    if (Number.isNaN(la) || Number.isNaN(lo)) continue;
    lat.push(la);
    lon.push(lo);
    const eleNode = p.getElementsByTagName('ele')[0];
    ele.push(eleNode ? parseFloat(eleNode.textContent) || 0 : 0);
    // Timestamps are preserved through the export (an "enrichment" tool
    // should not strip them); stored as epoch ms for easy interpolation.
    const timeNode = p.getElementsByTagName('time')[0];
    const ts = timeNode ? Date.parse(timeNode.textContent.trim()) : NaN;
    time.push(Number.isNaN(ts) ? null : ts);
    if (!Number.isNaN(ts)) hasTime = true;
  }

  // Existing waypoints already present in the file (displayed and kept on
  // export). <sym> is read too: many apps classify waypoints with it
  // instead of <type>.
  const waypoints = Array.from(doc.getElementsByTagName('wpt')).map((w) => {
    const child = (tag) => (w.getElementsByTagName(tag)[0] || {}).textContent || '';
    return {
      lat: parseFloat(w.getAttribute('lat')),
      lon: parseFloat(w.getAttribute('lon')),
      ele: child('ele'),
      name: child('name'),
      type: child('type'),
      sym: child('sym'),
      desc: child('desc') || child('cmt'),
    };
  });

  // Empty when the GPX carries no name; the UI falls back to the file name.
  // The first <name> of the document can belong to a <wpt>, so only the
  // track/route/metadata name qualifies.
  const nameNode = doc.querySelector('trk > name, rte > name, metadata > name');
  const name = nameNode ? nameNode.textContent.trim() : '';

  return { name, lat, lon, ele, time: hasTime ? time : null, trackCount, waypoints };
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remove consecutive duplicate coordinates (port of filtering_duplicate). */
function dedupe(lat, lon, ele, time) {
  const oLat = [];
  const oLon = [];
  const oEle = [];
  const oTime = time ? [] : null;
  for (let i = 0; i < lat.length; i++) {
    if (i > 1 && lat[i] === lat[i - 1] && lon[i] === lon[i - 1]) continue;
    oLat.push(lat[i]);
    oLon.push(lon[i]);
    oEle.push(ele[i]);
    if (oTime) oTime.push(time[i]);
  }
  return [oLat, oLon, oEle, oTime];
}

/**
 * Timestamp for a point inserted between route points a and b, interpolated
 * by its distance fraction along the a→b leg. Falls back to whichever
 * neighbour has a timestamp when the other one is missing.
 */
function interpTime(route, a, b, pLat, pLon) {
  const { lat, lon, time } = route;
  const ta = time[a];
  const tb = time[b];
  if (ta == null || tb == null) return ta != null ? ta : tb;
  const leg = haversine(lon[a], lat[a], lon[b], lat[b]);
  const frac = leg > 0 ? haversine(lon[a], lat[a], pLon, pLat) / leg : 0;
  return Math.round(ta + (tb - ta) * Math.min(1, Math.max(0, frac)));
}

/**
 * Rebuild the route coordinates with each snapped waypoint projected onto the
 * track (inserted before/after its anchor route point), then de-duplicated.
 * Shared by the GPX and TCX exporters. Returns { lat[], lon[], ele[], time[]|null }
 * — `time` mirrors route.time, with interpolated values on inserted points.
 */
export function densify(route, pts) {
  const { lat, lon, ele, time } = route;
  const byIndex = new Map();
  for (const p of pts) {
    // Waypoints loaded from the file are never re-projected; keep them from
    // shadowing a generated waypoint anchored on the same route point.
    if (p.newGpxIndex != null) byIndex.set(p.index, p);
  }

  const _lat = [];
  const _lon = [];
  const _ele = [];
  const _time = time ? [] : null;
  for (let i = 0; i < lat.length; i++) {
    const P = byIndex.get(i);
    // Insert the projected waypoint point *before* the route point.
    if (P && P.newGpxIndex != null && P.newGpxIndex < i) {
      _lat.push(P.lat);
      _lon.push(P.lon);
      _ele.push(ele[i]);
      if (_time) _time.push(i > 0 ? interpTime(route, i - 1, i, P.lat, P.lon) : time[i]);
    }
    _lat.push(lat[i]);
    _lon.push(lon[i]);
    _ele.push(ele[i]);
    if (_time) _time.push(time[i]);
    // Insert the projected waypoint point *after* the route point.
    if (P && P.newGpxIndex != null && P.newGpxIndex > i) {
      _lat.push(P.lat);
      _lon.push(P.lon);
      _ele.push(ele[i]);
      if (_time) _time.push(i + 1 < lat.length ? interpTime(route, i, i + 1, P.lat, P.lon) : time[i]);
    }
  }

  const [dLat, dLon, dEle, dTime] = dedupe(_lat, _lon, _ele, _time);
  return { lat: dLat, lon: dLon, ele: dEle, time: dTime };
}

/**
 * Build a GPX XML string from the original route + detected waypoints.
 * `pts` are Waypoint objects (see overpass.js); `keepOld` preserves the
 * waypoints already present in the source file.
 */
export function build(route, pts, keepOld) {
  const { name } = route;
  const { lat: dLat, lon: dLon, ele: dEle, time: dTime } = densify(route, pts);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<gpx version="1.1" creator="Mountain GPX" xmlns="http://www.topografix.com/GPX/1/1">\n';
  xml += '  <trk>\n';
  xml += '    <name>' + esc(name) + '</name>\n';
  xml += '    <src>Mountain GPX</src>\n';
  xml += '    <trkseg>\n';
  for (let i = 0; i < dLat.length; i++) {
    xml += '      <trkpt lat="' + dLat[i] + '" lon="' + dLon[i] + '">';
    xml += '<ele>' + (dEle[i] || 0) + '</ele>';
    if (dTime && dTime[i] != null) xml += '<time>' + isoTime(dTime[i]) + '</time>';
    xml += '</trkpt>\n';
  }
  xml += '    </trkseg>\n';
  xml += '  </trk>\n';

  if (keepOld && route.waypoints) {
    for (const w of route.waypoints) {
      if (Number.isNaN(w.lat) || Number.isNaN(w.lon)) continue;
      xml += wptXml(w.lat, w.lon, w.ele, w.name, w.type);
    }
  }
  for (const p of pts) {
    // Waypoints loaded from the file keep their original <type> verbatim;
    // generated ones get the Garmin course-point vocabulary.
    xml += wptXml(p.lat, p.lon, p.ele, p.name, p.rawType || courseType(p.queryName), p.descText);
  }
  xml += '</gpx>\n';
  return xml;
}

// Garmin Connect classifies imported waypoints by <type> (its course-point
// vocabulary), not by <sym>. Map our POI types to it; anything else is generic.
const COURSE_TYPE = {
  peak: 'summit', saddle: 'summit', volcano: 'summit', cairn: 'summit',
  viewpoint: 'overlook', toposcope: 'overlook', attraction: 'overlook', glacier: 'overlook',
  alpine_hut: 'shelter', wilderness_hut: 'shelter', shelter: 'shelter', hostel: 'shelter', hotel: 'shelter',
  camp_site: 'campsite',
  drinking_water: 'water', fountain: 'water', spring: 'water', waterfall: 'water', lake: 'water', ford: 'water',
  toilets: 'toilet', barrier: 'danger', tunnel: 'danger',
};

function courseType(type) {
  return COURSE_TYPE[type] || 'generic';
}

/** Epoch ms -> GPX <time> value (UTC, no milliseconds). */
function isoTime(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function wptXml(lat, lon, ele, name, type, desc) {
  let s = '  <wpt lat="' + lat + '" lon="' + lon + '">';
  if (ele) s += '<ele>' + ele + '</ele>';
  if (name) s += '<name>' + esc(name) + '</name>';
  if (desc) s += '<cmt>' + esc(desc) + '</cmt>';
  if (type) s += '<type>' + esc(type) + '</type>';
  s += '</wpt>\n';
  return s;
}
