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
 * The byte stream is deflate-raw compressed, then base64url encoded.
 * Delta + varint keeps consecutive points to 2-4 bytes, and deflate squeezes
 * the remaining redundancy; long tracks are Douglas-Peucker simplified until
 * the encoded string fits the URL budget.
 */

const VERSION = 1;
const SCALE = 1e5; // 1e-5° ≈ 1.1 m — matches GPX 5-decimal precision
const NAME_MAX = 100;

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
function encodeBytes(route) {
  const { lat, lon, ele } = route;
  const bytes = [VERSION];

  const name = new TextEncoder().encode((route.name || '').slice(0, NAME_MAX));
  pushVarint(bytes, name.length);
  for (const b of name) bytes.push(b);

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
  return Uint8Array.from(bytes);
}

/** Encode a route into a base64url share code. */
export async function encode(route) {
  return toBase64Url(await deflate(encodeBytes(route)));
}

/**
 * Decode a share code back into { name, lat[], lon[], ele[], waypoints[] }.
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
  if (bytes[pos.i++] !== VERSION) throw errWithCode('error.shareInvalid');

  const nameLen = readVarint(bytes, pos);
  if (nameLen > NAME_MAX * 4 || pos.i + nameLen > bytes.length) {
    throw errWithCode('error.shareInvalid');
  }
  const name = new TextDecoder().decode(bytes.subarray(pos.i, pos.i + nameLen));
  pos.i += nameLen;

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
  if (pos.i !== bytes.length) throw errWithCode('error.shareInvalid');

  return { name, lat, lon, ele, waypoints: [] };
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
 * Encode a route, simplifying it just enough to fit `budget` characters.
 * Returns { code, points, total, simplified }.
 */
export async function encodeFit(route, budget = CHAR_BUDGET) {
  const total = route.lat.length;
  let current = route;
  let code = await encode(current);
  for (let tol = MIN_TOL; code.length > budget && tol <= MAX_TOL; tol *= 2) {
    current = simplify(route, tol);
    code = await encode(current);
  }
  return {
    code,
    points: current.lat.length,
    total,
    simplified: current.lat.length < total,
  };
}
