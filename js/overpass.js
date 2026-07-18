/*
 * overpass.js — query the Overpass API directly from the browser and snap
 * the returned OSM features onto the GPX route.
 * Browser port of the Overpass logic in wpts/osm.py + wpts/main.py.
 */
import * as G from './geometry.js';
import { POI, getWptType } from './poi.js';
// Public Overpass instances (all CORS-enabled). Response time varies wildly
// between instances depending on their load, so queries are hedged across
// them (see runHedged) instead of tried strictly in order.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Segmentation of the route into per-chunk bbox queries. Benchmarked on a
// 149 km trace: one route-wide bbox covers ~2270 km² while 3-4 segment
// bboxes cover ~700-850 km², and separate requests can run in parallel on
// different instances. Past ~4 segments the per-request overhead dominates.
const TARGET_SEG_KM = 45;
const MAX_SEGMENTS = 4;

// Hedged dispatch: if an instance has not answered after HEDGE_MS the same
// query is also fired at the next one and the first response wins. A busy
// instance can hang for minutes, which is what made generation feel stuck.
const HEDGE_MS = 8000;
const HARD_TIMEOUT_MS = 60000;

// Instances that failed in this session get deprioritized.
const failures = new Map();

/** Build an Error carrying an i18n `code` (translated at the display site). */
function errWithCode(code, params) {
  const e = new Error(code);
  e.code = code;
  if (params) e.params = params;
  return e;
}

/**
 * Compute a bounding box (with a margin) from coordinate arrays.
 * Returns "south,west,north,east".
 */
export function bbox(lat, lon, margin) {
  const m = margin == null ? 0.001 : margin;
  const s = Math.min(...lat) - m;
  const n = Math.max(...lat) + m;
  const w = Math.min(...lon) - m;
  const e = Math.max(...lon) + m;
  return `${s},${w},${n},${e}`;
}

// Bbox margin in degrees; covers the snap-distance slider maximum so the
// fetched corridor stays valid when the user re-snaps from memory later.
const BBOX_MARGIN = 0.003;

/**
 * Split the route into contiguous chunks of roughly TARGET_SEG_KM and
 * return one bbox per chunk.
 */
export function segmentRoute(route) {
  const { lat, lon } = route;
  let totalKm = 0;
  for (let i = 1; i < lat.length; i++) {
    totalKm += G.haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]);
  }
  const nSeg = Math.max(1, Math.min(MAX_SEGMENTS, Math.round(totalKm / TARGET_SEG_KM)));
  const per = Math.ceil(lat.length / nSeg);
  const margin = BBOX_MARGIN;
  const boxes = [];
  for (let i = 0; i < lat.length; i += per) {
    // Overlap chunks by one point so nothing falls between two boxes.
    const a = Math.max(0, i - 1);
    const b = Math.min(lat.length, i + per);
    boxes.push(bbox(lat.slice(a, b), lon.slice(a, b), margin));
  }
  return boxes;
}

/**
 * Build the Overpass filters for EVERY POI type of the catalog, named or
 * not — one statement per node/way base. Fetching everything upfront costs
 * about the same server-side (measured: +50% elements, same wall time) and
 * lets the UI re-filter from memory without re-querying Overpass.
 */
export function buildAllFilters(custom) {
  const filters = [];
  for (const type of Object.keys(POI)) {
    const cfg = POI[type];
    for (const kind of ['node', 'way']) {
      if (cfg[kind]) filters.push(cfg[kind]);
    }
  }
  // Custom Overpass QL snippet (single element), same guard as the Python.
  if (custom) {
    const c = custom.trim();
    if (/^(node|way|relation)\["(.)+"([=~!])"?(.)+"?\](.)*$/.test(c)) {
      filters.push(c);
    }
  }
  return filters;
}

/** Assemble the full Overpass QL query string. */
export function buildQuery(box, filters) {
  let q = '[out:json][timeout:90];\n(\n';
  for (const f of filters) q += `  ${f}(${box});\n`;
  q += ');\nout geom;';
  return q;
}

/**
 * Endpoint order for a given segment: healthiest first, rotated by segment
 * index so parallel segments start on different instances.
 */
function orderFor(segIndex) {
  const sorted = [...ENDPOINTS].sort(
    (a, b) => (failures.get(a) || 0) - (failures.get(b) || 0)
  );
  // Rotate only among the healthiest endpoints so a failing instance never
  // gets a segment first again; it stays available as a late fallback.
  const minFail = failures.get(sorted[0]) || 0;
  const healthy = sorted.filter((u) => (failures.get(u) || 0) === minFail);
  const rest = sorted.filter((u) => (failures.get(u) || 0) !== minFail);
  const r = segIndex % healthy.length;
  return healthy.slice(r).concat(healthy.slice(0, r), rest);
}

/**
 * POST the query with hedging: start with order[0], fire the next endpoint
 * every HEDGE_MS (or immediately on failure) while no one has answered.
 * The first successful response wins; the losers are aborted.
 */
function runHedged(query, order) {
  return new Promise((resolve, reject) => {
    const attempts = [];
    const timers = new Set();
    let inFlight = 0;
    let settled = false;
    let lastErr = null;

    function markFailed(url) {
      failures.set(url, (failures.get(url) || 0) + 1);
    }

    function settle(winner, fn, value) {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      for (const a of attempts) {
        if (a === winner || a.done) continue;
        // A pending endpoint launched before the winner had a HEDGE_MS
        // head start and still lost: deprioritize it for later segments.
        if (winner && attempts.indexOf(a) < attempts.indexOf(winner)) markFailed(a.url);
        a.ctrl.abort();
      }
      fn(value);
    }

    function launch() {
      if (settled || attempts.length >= order.length) return;
      const url = order[attempts.length];
      const attempt = { url, ctrl: new AbortController(), done: false };
      attempts.push(attempt);
      inFlight++;
      timers.add(setTimeout(() => attempt.ctrl.abort(), HARD_TIMEOUT_MS));
      if (attempts.length < order.length) timers.add(setTimeout(launch, HEDGE_MS));

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: attempt.ctrl.signal,
      })
        .then((resp) => {
          if (!resp.ok) throw errWithCode('error.overpassHttp', { status: resp.status });
          return resp.json();
        })
        .then((json) => {
          attempt.done = true;
          settle(attempt, resolve, json);
        })
        .catch((err) => {
          attempt.done = true;
          inFlight--;
          if (settled) return;
          markFailed(url);
          lastErr = err && err.name === 'AbortError'
            ? errWithCode('error.overpassTimeout', { host: new URL(url).host })
            : err;
          if (attempts.length < order.length) launch();
          else if (inFlight === 0) {
            settle(null, reject, lastErr || errWithCode('error.overpassNoServer'));
          }
        });
    }

    launch();
  });
}

/** POST a single query (kept for console/debug use). */
export function run(query) {
  return runHedged(query, orderFor(0));
}

/** Build the popup/description HTML table from OSM tags. */
export function describeOsm(type, id, tags) {
  const url = 'https://www.openstreetmap.org/' + type + '/' + id;
  const skip = new Set(['source', 'name']);
  let html = '';
  if (tags) {
    html += '<table class="tags">';
    for (const [key, raw] of Object.entries(tags)) {
      if (skip.has(key)) continue;
      let value = escapeHtml(raw);
      if (key === 'website' || /^https?:\/\//.test(raw)) {
        value = `<a href="${escapeAttr(raw)}" target="_blank" rel="noopener">${value}</a>`;
      } else if (key === 'wikidata') {
        value = `<a href="https://www.wikidata.org/wiki/${escapeAttr(raw)}" target="_blank" rel="noopener">${value}</a>`;
      } else if (key === 'wikipedia' && raw.includes(':')) {
        const [lang, title] = raw.split(':');
        value = `<a href="https://${lang}.wikipedia.org/wiki/${escapeAttr(title)}" target="_blank" rel="noopener">${value}</a>`;
      }
      html += `<tr><th>${escapeHtml(key)}</th><td>${value}</td></tr>`;
    }
    html += '</table>';
  }
  html += `<a class="osm-link" href="${url}" target="_blank" rel="noopener">OSM #${id}</a>`;
  return html;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/** Does this element pass the current type selection? */
function matchesSelection(el, selection) {
  const tags = el.tags || {};
  const type = getWptType(tags);
  // Elements only reachable through the custom query have no catalog type.
  if (!type || !POI[type]) return true;
  return ('name' in tags)
    ? selection.withName.has(type)
    : selection.noName.has(type);
}

/**
 * Snap the fetched OSM elements matching `selection` onto the route.
 * Pure client-side: reusable to re-filter from memory without re-querying.
 */
export function snapElements(elements, route, selection, limDist) {
  const wanted = elements.filter((el) => matchesSelection(el, selection));
  const indexUsed = new Set();
  const pts = [];
  // Nodes first (higher priority to occupy a route index), then ways.
  processWithProjection(wanted.filter((e) => e.type === 'node'), route, limDist, indexUsed, pts);
  processWithProjection(wanted.filter((e) => e.type === 'way'), route, limDist, indexUsed, pts);
  return pts;
}

/**
 * Full pipeline: segment the route, fetch EVERY POI type in parallel
 * (hedged across instances), merge, then snap the selected subset.
 * The raw `elements` are returned so later selection changes can be
 * re-snapped from memory. `onProgress(done, total)` follows the segments.
 */
export async function findWaypoints(route, selection, limDist, onProgress) {
  const filters = buildAllFilters(selection.custom);
  const boxes = segmentRoute(route);
  let done = 0;
  if (onProgress) onProgress(0, boxes.length);
  const settled = await Promise.allSettled(
    boxes.map((box, i) =>
      runHedged(buildQuery(box, filters), orderFor(i)).then((json) => {
        done++;
        if (onProgress) onProgress(done, boxes.length);
        return json;
      })
    )
  );
  const results = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  if (results.length === 0) throw settled[0].reason;

  // Merge segments, deduping elements found in overlapping bboxes.
  const seen = new Set();
  const elements = [];
  for (const json of results) {
    for (const el of json.elements) {
      const key = el.type + el.id;
      if (!seen.has(key)) {
        seen.add(key);
        elements.push(el);
      }
    }
  }

  const pts = snapElements(elements, route, selection, limDist);
  return {
    pts,
    count: pts.length,
    elements,
    failedSegments: settled.length - results.length,
    totalSegments: boxes.length,
  };
}

/**
 * Same as process() but keeps the full [lon,lat,newIndex] projection so the
 * exported track can weave through the waypoint.
 */
function processWithProjection(elements, route, limDist, indexUsed, pts) {
  const { lat, lon } = route;
  const counters = {};
  for (const el of elements) {
    const tags = el.tags || {};
    const queryName = getWptType(tags);

    let index, near;
    if (el.type === 'node') {
      const r = G.findNearest(lon, lat, el.lon, el.lat, limDist);
      if (!r.match) continue;
      index = r.index;
      near = { lon: el.lon, lat: el.lat };
    } else if (el.type === 'way' && el.geometry && el.geometry.length) {
      const wlon = el.geometry.map((p) => p.lon);
      const wlat = el.geometry.map((p) => p.lat);
      const r = G.findNearestWay(lon, lat, wlon, wlat, limDist);
      if (!r.match) continue;
      index = r.index;
      near = { lon: r.nearLon, lat: r.nearLat };
    } else {
      continue;
    }

    const [projLon, projLat, newGpxIndex] = G.addNewCoordinate(lon, lat, near.lon, near.lat, index);
    if (indexUsed.has(index) || newGpxIndex == null) continue;

    const hasName = 'name' in tags;
    let name;
    if (hasName) {
      name = tags.name;
    } else {
      counters[queryName] = (counters[queryName] || 0) + 1;
      name = (queryName || 'poi') + counters[queryName];
    }
    const ele = tags.ele ? parseFloat(tags.ele) || 0 : 0;

    pts.push({
      name,
      osmType: el.type,
      lat: projLat != null ? projLat : el.lat,
      lon: projLon != null ? projLon : el.lon,
      ele,
      id: el.id,
      index,
      newGpxIndex,
      queryName,
      hasName,
      tags,
      description: describeOsm(el.type, el.id, tags),
    });
    indexUsed.add(index);
  }
  return pts;
}
