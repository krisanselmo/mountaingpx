/*
 * formats.js — import parsers for the non-GPX track formats.
 * Every parser returns the same shape as gpx.js parse():
 * { name, lat[], lon[], ele[], waypoints[] } with waypoints carrying
 * { lat, lon, ele, name, type, sym, desc } (fed to fileWaypointsToPts).
 */
import { parse as parseGpx } from './gpx.js';

/** Build an Error carrying an i18n `code` (translated at the display site). */
function errWithCode(code, params) {
  const e = new Error(code);
  e.code = code;
  if (params) e.params = params;
  return e;
}

// Extensions the file picker and the dropzone accept. FIT is binary, the
// rest is XML — parse() receives an ArrayBuffer or a string accordingly.
export const EXTENSIONS = ['gpx', 'fit', 'tcx', 'kml'];
export const BINARY_EXTENSIONS = ['fit'];

/** Dispatch `content` (string, or ArrayBuffer for FIT) to the right parser. */
export function parse(ext, content) {
  switch (ext) {
    case 'gpx': return parseGpx(content);
    case 'tcx': return parseTcx(content);
    case 'kml': return parseKml(content);
    case 'fit': return parseFit(content);
    default: throw errWithCode('error.badFormat');
  }
}

function parseXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.querySelector('parsererror')) throw errWithCode('error.fileInvalidXml');
  return doc;
}

const num = (s) => parseFloat(String(s == null ? '' : s).trim());

// ---- TCX (Garmin Training Center: activities and courses) ---------------
export function parseTcx(xmlString) {
  const doc = parseXml(xmlString);
  const childText = (node, tag) =>
    ((node.getElementsByTagName(tag)[0] || {}).textContent || '').trim();

  const lat = [];
  const lon = [];
  const ele = [];
  for (const tp of doc.getElementsByTagName('Trackpoint')) {
    const pos = tp.getElementsByTagName('Position')[0];
    if (!pos) continue; // trackpoints without a fix (paused GPS) are common
    const la = num(childText(pos, 'LatitudeDegrees'));
    const lo = num(childText(pos, 'LongitudeDegrees'));
    if (Number.isNaN(la) || Number.isNaN(lo)) continue;
    lat.push(la);
    lon.push(lo);
    ele.push(num(childText(tp, 'AltitudeMeters')) || 0);
  }
  if (!lat.length) throw errWithCode('error.tcxNoPoints');

  // Course points map straight onto waypoints: their PointType vocabulary
  // (Summit, Water, Food…) is resolved by poiTypeFrom() downstream.
  const waypoints = [];
  for (const cp of doc.getElementsByTagName('CoursePoint')) {
    const pos = cp.getElementsByTagName('Position')[0];
    if (!pos) continue;
    const la = num(childText(pos, 'LatitudeDegrees'));
    const lo = num(childText(pos, 'LongitudeDegrees'));
    if (Number.isNaN(la) || Number.isNaN(lo)) continue;
    waypoints.push({
      lat: la,
      lon: lo,
      ele: childText(cp, 'AltitudeMeters'),
      name: childText(cp, 'Name'),
      type: childText(cp, 'PointType'),
      sym: '',
      desc: childText(cp, 'Notes'),
    });
  }

  // A course carries a <Name>; an activity only has its start-time <Id>.
  const course = doc.getElementsByTagName('Course')[0];
  const name = course ? childText(course, 'Name') : '';
  return { name, lat, lon, ele, waypoints };
}

// ---- KML (Google Earth: LineString / gx:Track + Point placemarks) -------
export function parseKml(xmlString) {
  const doc = parseXml(xmlString);
  const lat = [];
  const lon = [];
  const ele = [];

  // <LineString><coordinates> lon,lat[,ele] tuples separated by whitespace.
  for (const ls of doc.getElementsByTagName('LineString')) {
    const coords = (ls.getElementsByTagName('coordinates')[0] || {}).textContent || '';
    for (const tuple of coords.trim().split(/\s+/)) {
      const [lo, la, el] = tuple.split(',').map(num);
      if (Number.isNaN(la) || Number.isNaN(lo)) continue;
      lat.push(la);
      lon.push(lo);
      ele.push(el || 0);
    }
  }
  // <gx:Track><gx:coord>lon lat ele</gx:coord> (Google Earth recordings).
  for (const c of doc.getElementsByTagName('gx:coord')) {
    const [lo, la, el] = c.textContent.trim().split(/\s+/).map(num);
    if (Number.isNaN(la) || Number.isNaN(lo)) continue;
    lat.push(la);
    lon.push(lo);
    ele.push(el || 0);
  }
  if (!lat.length) throw errWithCode('error.kmlNoPoints');

  // Point placemarks become waypoints; the track name comes from the
  // document, falling back to the placemark holding the line.
  const waypoints = [];
  let lineName = '';
  for (const pm of doc.getElementsByTagName('Placemark')) {
    const pmName = ((pm.getElementsByTagName('name')[0] || {}).textContent || '').trim();
    if (pm.getElementsByTagName('LineString')[0] || pm.getElementsByTagName('gx:Track')[0]) {
      if (!lineName) lineName = pmName;
      continue;
    }
    const point = pm.getElementsByTagName('Point')[0];
    if (!point) continue;
    const coords = (point.getElementsByTagName('coordinates')[0] || {}).textContent || '';
    const [lo, la, el] = coords.trim().split(',').map(num);
    if (Number.isNaN(la) || Number.isNaN(lo)) continue;
    waypoints.push({
      lat: la,
      lon: lo,
      ele: Number.isNaN(el) ? '' : String(el),
      name: pmName,
      type: '',
      sym: '',
      desc: ((pm.getElementsByTagName('description')[0] || {}).textContent || '').trim(),
    });
  }
  const docName = doc.querySelector('Document > name');
  const name = (docName ? docName.textContent.trim() : '') || lineName;
  return { name, lat, lon, ele, waypoints };
}

// ---- FIT (Garmin binary: activities and courses) -------------------------
// Minimal decoder for the record/course/course_point messages — enough to
// extract the track, its name and its typed course points. Reference:
// the FIT Protocol documentation (https://developer.garmin.com/fit/).
const SEMI2DEG = 180 / 2 ** 31;
const INVALID_SINT32 = 0x7fffffff;

// FIT global message numbers.
const MSG_RECORD = 20;
const MSG_COURSE = 31;
const MSG_COURSE_POINT = 32;

// course_point `type` enum → strings poiTypeFrom() understands (the rest
// falls back to the generic type downstream).
const COURSE_POINT_TYPES = ['generic', 'summit', 'valley', 'water', 'food',
  'danger', 'left', 'right', 'straight', 'first_aid'];

/** Read one scalar FIT field; null when the base type/size is unsupported. */
function readFitValue(view, off, size, baseType, le) {
  switch (baseType & 0x1f) {
    case 0: case 2: case 10: case 13: return size === 1 ? view.getUint8(off) : null;
    case 1: return size === 1 ? view.getInt8(off) : null;
    case 3: return size === 2 ? view.getInt16(off, le) : null;
    case 4: case 11: return size === 2 ? view.getUint16(off, le) : null;
    case 5: return size === 4 ? view.getInt32(off, le) : null;
    case 6: case 12: return size === 4 ? view.getUint32(off, le) : null;
    case 7: { // null-terminated UTF-8 string
      const bytes = new Uint8Array(view.buffer, view.byteOffset + off, size);
      let end = 0;
      while (end < size && bytes[end] !== 0) end++;
      return new TextDecoder().decode(bytes.subarray(0, end));
    }
    case 8: return size === 4 ? view.getFloat32(off, le) : null;
    case 9: return size === 8 ? view.getFloat64(off, le) : null;
    default: return null;
  }
}

/** FIT altitude fields are scaled: value / 5 - 500 m. */
function fitAltitude(alt, enhanced) {
  if (enhanced != null && enhanced !== 0xffffffff) return enhanced / 5 - 500;
  if (alt != null && alt !== 0xffff) return alt / 5 - 500;
  return 0;
}

export function parseFit(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < 14) {
    throw errWithCode('error.fitInvalid');
  }
  const view = new DataView(buf);
  const headerSize = view.getUint8(0);
  const dataSize = view.getUint32(4, true);
  const magic = String.fromCharCode(
    view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
  );
  if ((headerSize !== 12 && headerSize !== 14) || magic !== '.FIT') {
    throw errWithCode('error.fitInvalid');
  }

  const end = Math.min(headerSize + dataSize, buf.byteLength);
  const defs = new Map(); // local message type -> definition
  const lat = [];
  const lon = [];
  const ele = [];
  const waypoints = [];
  let name = '';

  let off = headerSize;
  try {
    while (off < end) {
      const hdr = view.getUint8(off++);
      let local;
      let isDef = false;
      let hasDev = false;
      if (hdr & 0x80) {
        local = (hdr >> 5) & 0x3; // compressed-timestamp data message
      } else {
        local = hdr & 0xf;
        isDef = !!(hdr & 0x40);
        hasDev = !!(hdr & 0x20);
      }

      if (isDef) {
        const le = view.getUint8(off + 1) === 0;
        const global = view.getUint16(off + 2, le);
        const nFields = view.getUint8(off + 4);
        off += 5;
        const fields = [];
        for (let i = 0; i < nFields; i++) {
          fields.push({
            num: view.getUint8(off),
            size: view.getUint8(off + 1),
            base: view.getUint8(off + 2),
          });
          off += 3;
        }
        let devBytes = 0;
        if (hasDev) {
          const nDev = view.getUint8(off++);
          for (let i = 0; i < nDev; i++) {
            devBytes += view.getUint8(off + 1);
            off += 3;
          }
        }
        defs.set(local, { global, le, fields, devBytes });
        continue;
      }

      const def = defs.get(local);
      if (!def) throw errWithCode('error.fitInvalid');
      const interesting = def.global === MSG_RECORD
        || def.global === MSG_COURSE || def.global === MSG_COURSE_POINT;
      const vals = {};
      for (const f of def.fields) {
        if (interesting) vals[f.num] = readFitValue(view, off, f.size, f.base, def.le);
        off += f.size;
      }
      off += def.devBytes;

      if (def.global === MSG_RECORD) {
        // 0 position_lat, 1 position_long (semicircles), 2 altitude,
        // 78 enhanced_altitude.
        const la = vals[0];
        const lo = vals[1];
        if (la == null || lo == null || la === INVALID_SINT32 || lo === INVALID_SINT32) continue;
        lat.push(la * SEMI2DEG);
        lon.push(lo * SEMI2DEG);
        ele.push(fitAltitude(vals[2], vals[78]));
      } else if (def.global === MSG_COURSE) {
        if (!name && typeof vals[5] === 'string') name = vals[5]; // 5 name
      } else if (def.global === MSG_COURSE_POINT) {
        // 1 position_lat, 2 position_long, 4 type (enum), 5 name.
        const la = vals[1];
        const lo = vals[2];
        if (la == null || lo == null || la === INVALID_SINT32 || lo === INVALID_SINT32) continue;
        waypoints.push({
          lat: la * SEMI2DEG,
          lon: lo * SEMI2DEG,
          ele: '',
          name: typeof vals[5] === 'string' ? vals[5] : '',
          type: COURSE_POINT_TYPES[vals[4]] || 'generic',
          sym: '',
          desc: '',
        });
      }
    }
  } catch (err) {
    if (err.code) throw err;
    throw errWithCode('error.fitInvalid'); // truncated file: DataView overrun
  }

  if (!lat.length) throw errWithCode('error.fitNoPoints');
  return { name, lat, lon, ele, waypoints };
}
