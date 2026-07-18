/*
 * gpx.js — parse an uploaded GPX and rebuild one with snapped waypoints.
 * Browser port of parse_route() and build_and_save_gpx() from wpts/main.py.
 */
/** Build an Error carrying an i18n `code` (translated at the display site). */
function errWithCode(code, params) {
  const e = new Error(code);
  e.code = code;
  if (params) e.params = params;
  return e;
}

/**
 * Parse a GPX string into { name, lat[], lon[], ele[], waypoints[] }.
 * Handles both <trk>/<trkseg>/<trkpt> and <rte>/<rtept>.
 */
export function parse(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw errWithCode('error.gpxInvalidXml');
  }

  let pts = Array.from(doc.getElementsByTagName('trkpt'));
  if (pts.length === 0) {
    pts = Array.from(doc.getElementsByTagName('rtept'));
  }
  if (pts.length === 0) {
    throw errWithCode('error.gpxNoPoints');
  }

  const lat = [];
  const lon = [];
  const ele = [];
  for (const p of pts) {
    const la = parseFloat(p.getAttribute('lat'));
    const lo = parseFloat(p.getAttribute('lon'));
    if (Number.isNaN(la) || Number.isNaN(lo)) continue;
    lat.push(la);
    lon.push(lo);
    const eleNode = p.getElementsByTagName('ele')[0];
    ele.push(eleNode ? parseFloat(eleNode.textContent) || 0 : 0);
  }

  // Existing waypoints already present in the file (kept on export).
  const waypoints = Array.from(doc.getElementsByTagName('wpt')).map((w) => ({
    lat: parseFloat(w.getAttribute('lat')),
    lon: parseFloat(w.getAttribute('lon')),
    ele: (w.getElementsByTagName('ele')[0] || {}).textContent || '',
    name: (w.getElementsByTagName('name')[0] || {}).textContent || '',
    type: (w.getElementsByTagName('type')[0] || {}).textContent || '',
  }));

  // Empty when the GPX carries no name; the UI falls back to the file name.
  const nameNode = doc.getElementsByTagName('name')[0];
  const name = nameNode ? nameNode.textContent.trim() : '';

  return { name, lat, lon, ele, waypoints };
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remove consecutive duplicate coordinates (port of filtering_duplicate). */
function dedupe(lat, lon, ele) {
  const oLat = [];
  const oLon = [];
  const oEle = [];
  for (let i = 0; i < lat.length; i++) {
    if (i > 1 && lat[i] === lat[i - 1] && lon[i] === lon[i - 1]) continue;
    oLat.push(lat[i]);
    oLon.push(lon[i]);
    oEle.push(ele[i]);
  }
  return [oLat, oLon, oEle];
}

/**
 * Rebuild the route coordinates with each snapped waypoint projected onto the
 * track (inserted before/after its anchor route point), then de-duplicated.
 * Shared by the GPX and TCX exporters. Returns { lat[], lon[], ele[] }.
 */
export function densify(route, pts) {
  const { lat, lon, ele } = route;
  const byIndex = new Map();
  for (const p of pts) byIndex.set(p.index, p);

  const _lat = [];
  const _lon = [];
  const _ele = [];
  for (let i = 0; i < lat.length; i++) {
    const P = byIndex.get(i);
    // Insert the projected waypoint point *before* the route point.
    if (P && P.newGpxIndex != null && P.newGpxIndex < i) {
      _lat.push(P.lat);
      _lon.push(P.lon);
      _ele.push(ele[i]);
    }
    _lat.push(lat[i]);
    _lon.push(lon[i]);
    _ele.push(ele[i]);
    // Insert the projected waypoint point *after* the route point.
    if (P && P.newGpxIndex != null && P.newGpxIndex > i) {
      _lat.push(P.lat);
      _lon.push(P.lon);
      _ele.push(ele[i]);
    }
  }

  const [dLat, dLon, dEle] = dedupe(_lat, _lon, _ele);
  return { lat: dLat, lon: dLon, ele: dEle };
}

/**
 * Build a GPX XML string from the original route + detected waypoints.
 * `pts` are Waypoint objects (see overpass.js); `keepOld` preserves the
 * waypoints already present in the source file.
 */
export function build(route, pts, keepOld) {
  const { name } = route;
  const { lat: dLat, lon: dLon, ele: dEle } = densify(route, pts);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<gpx version="1.1" creator="Mountain GPX" xmlns="http://www.topografix.com/GPX/1/1">\n';
  xml += '  <trk>\n';
  xml += '    <name>' + esc(name) + '</name>\n';
  xml += '    <src>Mountain GPX</src>\n';
  xml += '    <trkseg>\n';
  for (let i = 0; i < dLat.length; i++) {
    xml += '      <trkpt lat="' + dLat[i] + '" lon="' + dLon[i] + '">';
    xml += '<ele>' + (dEle[i] || 0) + '</ele></trkpt>\n';
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
    xml += wptXml(p.lat, p.lon, p.ele, p.name, p.queryName, p.description);
  }
  xml += '</gpx>\n';
  return xml;
}

function wptXml(lat, lon, ele, name, type, desc) {
  let s = '  <wpt lat="' + lat + '" lon="' + lon + '">';
  if (ele) s += '<ele>' + ele + '</ele>';
  if (name) s += '<name>' + esc(name) + '</name>';
  if (desc) s += '<cmt>' + esc(stripHtml(desc)) + '</cmt>';
  if (type) s += '<sym>' + esc(type) + '</sym><type>' + esc(type) + '</type>';
  s += '</wpt>\n';
  return s;
}

export function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
}
