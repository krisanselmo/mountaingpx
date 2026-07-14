/*
 * overpass.js — query the Overpass API directly from the browser and snap
 * the returned OSM features onto the GPX route.
 * Browser port of the Overpass logic in wpts/osm.py + wpts/main.py.
 */
(function (global) {
  'use strict';

  const { POI, getWptType } = global.POIData;
  const G = global.Geometry;

  // Public Overpass instances (all CORS-enabled). Tried in order on failure.
  const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  /**
   * Compute a bounding box (with a small margin) from the route.
   * Returns "south,west,north,east".
   */
  function bbox(lat, lon) {
    const margin = 0.001;
    const s = Math.min(...lat) - margin;
    const n = Math.max(...lat) + margin;
    const w = Math.min(...lon) - margin;
    const e = Math.max(...lon) + margin;
    return `${s},${w},${n},${e}`;
  }

  /**
   * Build the list of Overpass filters for the current selection.
   * `selection` = { withName: Set, noName: Set, custom: string }.
   */
  function buildFilters(selection) {
    const filters = [];
    for (const type of Object.keys(POI)) {
      const cfg = POI[type];
      const wanted = selection.withName.has(type) || selection.noName.has(type);
      if (!wanted) continue;
      for (const kind of ['node', 'way']) {
        const base = cfg[kind];
        if (!base) continue;
        if (selection.withName.has(type)) filters.push(base + '["name"]');
        if (selection.noName.has(type) && cfg.noName) filters.push(base + '["name"!~".*"]');
      }
    }
    // Custom Overpass QL snippet (single element), same guard as the Python.
    if (selection.custom) {
      const c = selection.custom.trim();
      if (/^(node|way|relation)\["(.)+"([=~!])"?(.)+"?\](.)*$/.test(c)) {
        filters.push(c);
      }
    }
    return filters;
  }

  /** Assemble the full Overpass QL query string. */
  function buildQuery(box, filters) {
    let q = '[out:json][timeout:90];\n(\n';
    for (const f of filters) q += `  ${f}(${box});\n`;
    q += ');\nout geom;';
    return q;
  }

  /** POST the query, trying each endpoint until one answers. */
  async function run(query) {
    let lastErr;
    for (const url of ENDPOINTS) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!resp.ok) {
          lastErr = new Error('Overpass HTTP ' + resp.status);
          continue;
        }
        return await resp.json();
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Aucun serveur Overpass ne répond.');
  }

  /** Build the popup/description HTML table from OSM tags. */
  function describeOsm(type, id, tags) {
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

  /**
   * Full pipeline: build query, fetch, snap. Returns { pts, count }.
   */
  async function findWaypoints(route, selection, limDist) {
    const filters = buildFilters(selection);
    if (filters.length === 0) return { pts: [], count: 0, empty: true };

    const box = bbox(route.lat, route.lon);
    const query = buildQuery(box, filters);
    const json = await run(query);

    const indexUsed = new Set();
    const pts = [];
    // Nodes first (higher priority to occupy a route index), then ways.
    const nodes = json.elements.filter((e) => e.type === 'node');
    const ways = json.elements.filter((e) => e.type === 'way');
    processWithProjection(nodes, route, limDist, indexUsed, pts);
    processWithProjection(ways, route, limDist, indexUsed, pts);

    return { pts, count: pts.length, query };
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

  global.Overpass = { bbox, buildFilters, buildQuery, run, findWaypoints, describeOsm };
})(window);
