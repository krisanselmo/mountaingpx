/*
 * share.js — encode a route into a compact URL-safe string and back.
 * The whole track travels in the URL fragment (#track=…), so a link is all
 * it takes to share a GPX: nothing is uploaded anywhere.
 *
 * Wire format (before compression):
 *   [version u8] [name length varint] [name utf-8…]
 *   [point count varint] [hasEle u8]
 *   then per point, zigzag varints of the deltas:
 *     lat and lon at 1e-5° (~1 m), elevation at 1 m (only when hasEle)
 *   then (version ≥ 2) [waypoint count varint] and per waypoint:
 *     [name varint+utf-8] [type varint+utf-8]
 *     [lat delta] [lon delta] [ele delta] — continuing the track's
 *     running values, so on-track waypoints cost only a few bytes
 * The byte stream is deflate-raw compressed, then base64url encoded.
 * Delta + varint keeps consecutive points to 2-4 bytes, and deflate squeezes
 * the remaining redundancy; long tracks are Douglas-Peucker simplified until
 * the encoded string fits the URL budget.
 */

const VERSION = 2;
const SCALE = 1e5; // 1e-5° ≈ 1.1 m — matches GPX 5-decimal precision
const NAME_MAX = 100;
const TYPE_MAX = 30;
const WPT_MAX = 500;

/** Encoded-length budget (characters) so links survive chats and e-mails. */
export const CHAR_BUDGET = 4000;

// Simplification tolerance ladder (degrees): start at ~1 m and double until
// the track fits the budget. The ceiling (~2 km) fits any route.
const MIN_TOL = 1e-5;
const MAX_TOL = 2e-2;

/** Build an Error carrying an i18n `code` (translated at the display site). */
function errWithCode(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

// ---- varint / zigzag ----------------------------------------------------
const zigzag = (n) => (n < 0 ? -2 * n - 1 : 2 * n);
const unzigzag = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);

function pushVarint(bytes, n) {
  while (n >= 0x80) {
    bytes.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  bytes.push(n);
}

function readVarint(bytes, pos) {
  let n = 0;
  let mul = 1;
  for (;;) {
    if (pos.i >= bytes.length) throw errWithCode('error.shareInvalid');
    const b = bytes[pos.i++];
    n += (b & 0x7f) * mul;
    if (!(b & 0x80)) return n;
    mul *= 0x80;
  }
}

// ---- base64url ----------------------------------------------------------
function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- deflate ------------------------------------------------------------
async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const deflate = (b) => pipe(b, new CompressionStream('deflate-raw'));
const inflate = (b) => pipe(b, new DecompressionStream('deflate-raw'));

// ---- core encode / decode -----------------------------------------------
function pushString(bytes, s, max) {
  const utf8 = new TextEncoder().encode(String(s || '').slice(0, max));
  pushVarint(bytes, utf8.length);
  for (const b of utf8) bytes.push(b);
}

function encodeBytes(route, wpts) {
  const { lat, lon, ele } = route;
  const bytes = [VERSION];

  pushString(bytes, route.name, NAME_MAX);

  pushVarint(bytes, lat.length);
  const hasEle = ele.some((e) => e > 0) ? 1 : 0;
  bytes.push(hasEle);

  let pla = 0;
  let plo = 0;
  let pel = 0;
  for (let i = 0; i < lat.length; i++) {
    const la = Math.round(lat[i] * SCALE);
    const lo = Math.round(lon[i] * SCALE);
    pushVarint(bytes, zigzag(la - pla));
    pushVarint(bytes, zigzag(lo - plo));
    pla = la;
    plo = lo;
    if (hasEle) {
      const e = Math.round(ele[i] || 0);
      pushVarint(bytes, zigzag(e - pel));
      pel = e;
    }
  }

  // Waypoints, deltas continuing from the last track point.
  pushVarint(bytes, wpts.length);
  for (const w of wpts) {
    pushString(bytes, w.name, NAME_MAX);
    pushString(bytes, w.type, TYPE_MAX);
    const la = Math.round(w.lat * SCALE);
    const lo = Math.round(w.lon * SCALE);
    const e = Math.round(w.ele || 0);
    pushVarint(bytes, zigzag(la - pla));
    pushVarint(bytes, zigzag(lo - plo));
    pushVarint(bytes, zigzag(e - pel));
    pla = la;
    plo = lo;
    pel = e;
  }
  return Uint8Array.from(bytes);
}

/** Encode a route (and its waypoints) into a base64url share code. */
export async function encode(route, wpts = []) {
  return toBase64Url(await deflate(encodeBytes(route, wpts.slice(0, WPT_MAX))));
}

function readString(bytes, pos, max) {
  const len = readVarint(bytes, pos);
  if (len > max * 4 || pos.i + len > bytes.length) {
    throw errWithCode('error.shareInvalid');
  }
  const s = new TextDecoder().decode(bytes.subarray(pos.i, pos.i + len));
  pos.i += len;
  return s;
}

/**
 * Decode a share code back into { name, lat[], lon[], ele[], waypoints[] },
 * waypoints being { lat, lon, ele, name, type } like GPX.parse() returns.
 * Throws an Error with code 'error.shareInvalid' on any malformed input.
 */
export async function decode(code) {
  let bytes;
  try {
    bytes = await inflate(fromBase64Url(String(code)));
  } catch (_) {
    throw errWithCode('error.shareInvalid');
  }

  const pos = { i: 0 };
  const version = bytes.length ? bytes[pos.i++] : 0;
  if (version < 1 || version > VERSION) throw errWithCode('error.shareInvalid');

  const name = readString(bytes, pos, NAME_MAX);

  const n = readVarint(bytes, pos);
  if (n < 2 || n > 1e6 || pos.i >= bytes.length) throw errWithCode('error.shareInvalid');
  const hasEle = bytes[pos.i++] === 1;

  const lat = [];
  const lon = [];
  const ele = [];
  let pla = 0;
  let plo = 0;
  let pel = 0;
  for (let i = 0; i < n; i++) {
    pla += unzigzag(readVarint(bytes, pos));
    plo += unzigzag(readVarint(bytes, pos));
    if (Math.abs(pla) > 90 * SCALE || Math.abs(plo) > 180 * SCALE) {
      throw errWithCode('error.shareInvalid');
    }
    lat.push(pla / SCALE);
    lon.push(plo / SCALE);
    if (hasEle) pel += unzigzag(readVarint(bytes, pos));
    ele.push(hasEle ? pel : 0);
  }

  const waypoints = [];
  if (version >= 2) {
    const w = readVarint(bytes, pos);
    if (w > WPT_MAX) throw errWithCode('error.shareInvalid');
    for (let i = 0; i < w; i++) {
      const wName = readString(bytes, pos, NAME_MAX);
      const wType = readString(bytes, pos, TYPE_MAX);
      pla += unzigzag(readVarint(bytes, pos));
      plo += unzigzag(readVarint(bytes, pos));
      pel += unzigzag(readVarint(bytes, pos));
      if (Math.abs(pla) > 90 * SCALE || Math.abs(plo) > 180 * SCALE) {
        throw errWithCode('error.shareInvalid');
      }
      waypoints.push({
        lat: pla / SCALE,
        lon: plo / SCALE,
        ele: pel,
        name: wName,
        type: wType,
      });
    }
  }
  if (pos.i !== bytes.length) throw errWithCode('error.shareInvalid');

  return { name, lat, lon, ele, waypoints };
}

// ---- track simplification (Douglas-Peucker) -------------------------------
/** Squared distance from point p to segment [a, b] in planar coords. */
function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return (px - qx) * (px - qx) + (py - qy) * (py - qy);
}

/** Douglas-Peucker on {lat, lon} with a tolerance in degrees. */
function simplify(route, tol) {
  const { lat, lon, ele } = route;
  const n = lat.length;
  // Planar approximation: longitudes shrunk by cos(latitude).
  const cosLat = Math.cos((lat[0] * Math.PI) / 180);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const tol2 = tol * tol;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = 0;
    let bestI = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(
        lon[i] * cosLat, lat[i],
        lon[a] * cosLat, lat[a],
        lon[b] * cosLat, lat[b]
      );
      if (d > best) {
        best = d;
        bestI = i;
      }
    }
    if (bestI > 0 && best > tol2) {
      keep[bestI] = 1;
      stack.push([a, bestI], [bestI, b]);
    }
  }

  const sLat = [];
  const sLon = [];
  const sEle = [];
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    sLat.push(lat[i]);
    sLon.push(lon[i]);
    sEle.push(ele[i]);
  }
  return { name: route.name, lat: sLat, lon: sLon, ele: sEle };
}

/**
 * Encode a route and its waypoints, simplifying the track (never the
 * waypoints) just enough to fit `budget` characters.
 * Returns { code, points, total, simplified }.
 */
export async function encodeFit(route, wpts = [], budget = CHAR_BUDGET) {
  const total = route.lat.length;
  let current = route;
  let code = await encode(current, wpts);
  for (let tol = MIN_TOL; code.length > budget && tol <= MAX_TOL; tol *= 2) {
    current = simplify(route, tol);
    code = await encode(current, wpts);
  }
  return {
    code,
    points: current.lat.length,
    total,
    simplified: current.lat.length < total,
  };
}
