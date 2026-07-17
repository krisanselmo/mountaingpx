/*
 * app.js — Mountain GPX (browser edition)
 * Orchestrates the UI, the Leaflet map and the OSM waypoint pipeline.
 * 100% client-side: no server, no upload leaves the browser.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import * as GPX from './gpx.js';
import { haversine } from './geometry.js';
import * as Icons from './icons.js';
import * as Overpass from './overpass.js';
import { POI, GROUPS, DEFAULT_WITH_NAME } from './poi.js';

const LS_KEY = 'mountaingpx.settings.v1';

// ---- Application state -------------------------------------------------
const state = {
  route: null, // { name, lat[], lon[], ele[], waypoints[] }
  pts: [],
  map: null,
  layers: {},
  trackLayer: null,
  markerLayer: null,
  endpoints: null,
  lastGpx: null,
  showProfileWpts: true,
  genElements: null, // raw OSM elements of the last generation (all types)
  genCustom: '',     // custom query used by the last generation
  // Per-OSM-element user edits ("osmType+id" -> { name?, removed? }),
  // re-applied after every re-snap so they survive selection changes.
  overrides: new Map(),
};

// ---- DOM helpers ------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch (_) {
    return {};
  }
}
function saveSettings(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch (_) {}
}

// ---- POI selection panel ---------------------------------------------
function buildPoiPanel() {
  const container = $('#poi-list');
  const saved = loadSettings();
  const savedWith = new Set(saved.withName || DEFAULT_WITH_NAME);
  const savedNo = new Set(saved.noName || []);

  // Group POI types.
  const groups = {};
  for (const [type, cfg] of Object.entries(POI)) {
    (groups[cfg.group] = groups[cfg.group] || []).push([type, cfg]);
  }

  for (const [gkey, gname] of Object.entries(GROUPS)) {
    const details = el('details', 'poi-group');
    details.open = true;
    const summary = el('summary', null, gname);
    details.appendChild(summary);

    const table = el('table', 'poi-table');
    const head = el('tr', null,
      '<th></th>' +
      '<th title="Inclure les POI qui ont un nom dans OpenStreetMap — le waypoint reprend ce nom (ex. « Col de la Vache »).">Nommé</th>' +
      '<th title="Inclure aussi les POI sans nom dans OpenStreetMap — un nom générique numéroté est attribué (ex. saddle1, spring2).">Sans&nbsp;nom</th>');
    table.appendChild(head);

    for (const [type, cfg] of (groups[gkey] || [])) {
      const tr = el('tr');
      const tdName = el('td', 'poi-name');
      tdName.innerHTML = `${Icons.svgFor(type, 18)} ${cfg.label}`;
      tr.appendChild(tdName);

      const mkCell = (kind, saved) => {
        const td = el('td');
        const cb = el('input');
        cb.type = 'checkbox';
        cb.dataset.type = type;
        cb.dataset.kind = kind;
        cb.checked = saved.has(type);
        cb.addEventListener('change', onSelectionChanged);
        td.appendChild(cb);
        const cnt = el('span', 'cnt');
        cnt.dataset.cntType = type;
        cnt.dataset.cntKind = kind;
        td.appendChild(cnt);
        return td;
      };
      tr.appendChild(mkCell('with', savedWith));
      tr.appendChild(cfg.noName ? mkCell('no', savedNo) : el('td'));
      table.appendChild(tr);
    }
    details.appendChild(table);
    container.appendChild(details);
  }

  // Custom overpass + snap distance from saved settings.
  $('#overpass-custom').value = saved.custom || '';
  $('#snap-dist').value = saved.snap || 50;
  $('#snap-dist-val').textContent = (saved.snap || 50) + ' m';
  $('#reverse').checked = !!saved.reverse;
}

function getSelection() {
  const withName = new Set();
  const noName = new Set();
  document.querySelectorAll('#poi-list input[type=checkbox]').forEach((cb) => {
    if (!cb.checked) return;
    if (cb.dataset.kind === 'with') withName.add(cb.dataset.type);
    else noName.add(cb.dataset.type);
  });
  return { withName, noName, custom: $('#overpass-custom').value.trim() };
}

function persistSelection() {
  const sel = getSelection();
  saveSettings({
    withName: [...sel.withName],
    noName: [...sel.noName],
    custom: sel.custom,
    snap: parseInt($('#snap-dist').value, 10),
    reverse: $('#reverse').checked,
  });
}

// ---- Map --------------------------------------------------------------
function initMap() {
  const map = L.map('map', { zoomControl: true }).setView([45.9, 6.87], 12);

  const opentopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© OpenStreetMap, © OpenTopoMap (CC-BY-SA)',
  });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  });
  const sat = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles © Esri' }
  );
  const cycl = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 18,
    opacity: 0.7,
  });

  opentopo.addTo(map);
  L.control
    .layers(
      { 'OpenTopoMap': opentopo, 'OpenStreetMap': osm, 'Satellite': sat },
      { 'Sentiers (waymarked)': cycl, "Points d'eau": initWaterOverlay(map) }
    )
    .addTo(map);

  state.map = map;
  state.markerLayer = L.layerGroup().addTo(map);

  // Keep the map position in the URL (OSM-style #map=zoom/lat/lon) so the
  // view survives reloads and can be shared.
  const fromHash = parseMapHash(location.hash);
  if (fromHash) map.setView([fromHash.lat, fromHash.lon], fromHash.zoom);
  map.on('moveend', () => {
    const c = map.getCenter();
    history.replaceState(null, '', `#map=${map.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`);
  });
}

function parseMapHash(hash) {
  const m = /^#map=(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(hash || '');
  if (!m) return null;
  return { zoom: parseFloat(m[1]), lat: parseFloat(m[2]), lon: parseFloat(m[3]) };
}

// ---- "Points d'eau" overlay --------------------------------------------
// No public tile overlay exists for water points, so this one is built from
// Overpass on the fly: it loads the water POIs of the visible area when the
// overlay is enabled, with a zoom floor to keep the queries small.
const WATER_FILTERS = [
  'node["amenity"="drinking_water"]',
  'node["amenity"="water_point"]',
  'node["man_made"="water_tap"]',
  'node["amenity"="fountain"]',
  'node["natural"="spring"]',
];
// Area cap instead of a zoom floor: the same zoom level covers wildly
// different areas depending on the screen size.
const WATER_MAX_AREA_KM2 = 1000;

function boundsAreaKm2(b) {
  const midLat = (b.getNorth() + b.getSouth()) / 2;
  return (b.getNorth() - b.getSouth()) * 111.32 *
    (b.getEast() - b.getWest()) * 111.32 * Math.cos((midLat * Math.PI) / 180);
}

function initWaterOverlay(map) {
  const layer = L.layerGroup();
  const seen = new Set();
  const markers = [];
  let dotsVisible = true;
  let fetchedBounds = null;
  let loading = false;
  let timer = null;

  // Hide the loaded dots past the area cap (with a little hysteresis):
  // hundreds of DOM markers make panning laggy at wide zooms.
  function updateVisibility() {
    const tooBig = boundsAreaKm2(map.getBounds()) > WATER_MAX_AREA_KM2 * 1.5;
    if (tooBig && dotsVisible) {
      layer.clearLayers();
      dotsVisible = false;
    } else if (!tooBig && !dotsVisible) {
      for (const m of markers) m.addTo(layer);
      dotsVisible = true;
    }
  }

  async function refresh() {
    if (!map.hasLayer(layer) || loading) return;
    if (boundsAreaKm2(map.getBounds()) > WATER_MAX_AREA_KM2) return;
    const view = map.getBounds();
    if (fetchedBounds && fetchedBounds.contains(view)) return;

    const padded = view.pad(0.4);
    const box = `${padded.getSouth()},${padded.getWest()},${padded.getNorth()},${padded.getEast()}`;
    loading = true;
    try {
      const json = await Overpass.run(Overpass.buildQuery(box, WATER_FILTERS));
      fetchedBounds = padded;
      for (const el of json.elements) {
        const key = el.type + el.id;
        if (el.type !== 'node' || seen.has(key)) continue;
        seen.add(key);
        const tags = el.tags || {};
        const marker = L.marker([el.lat, el.lon], {
          title: tags.name || "Point d'eau",
          icon: Icons.waterDotIcon(),
        });
        marker.bindPopup(
          `<div class="wpt-popup"><h3>${escapeHtml(tags.name || "Point d'eau")}</h3>` +
          Overpass.describeOsm(el.type, el.id, tags) + '</div>'
        );
        markers.push(marker);
        if (dotsVisible) marker.addTo(layer);
      }
    } catch (err) {
      console.warn("Overlay points d'eau :", err.message || err);
    } finally {
      loading = false;
    }
  }

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 600);
  };
  map.on('moveend', () => {
    updateVisibility();
    schedule();
  });
  map.on('overlayadd', (e) => {
    if (e.layer !== layer) return;
    if (boundsAreaKm2(map.getBounds()) > WATER_MAX_AREA_KM2) {
      toast("Zoomez pour charger les points d'eau", 'warn');
    } else {
      refresh();
    }
  });
  return layer;
}

function drawRoute() {
  const { lat, lon } = state.route;
  if (state.trackLayer) state.map.removeLayer(state.trackLayer);
  const coords = lat.map((la, i) => [la, lon[i]]);

  const line = L.polyline(coords, { color: '#e4572e', weight: 4, opacity: 0.9 });
  const mk = (kind, ll, title) =>
    L.marker(ll, { title, icon: Icons.flagIcon(kind) });

  // Group the polyline and the start/end markers so they toggle together.
  state.trackLayer = L.featureGroup([
    line,
    mk('start', coords[0], 'Départ'),
    mk('end', coords[coords.length - 1], 'Arrivée'),
  ]).addTo(state.map);

  state.map.fitBounds(line.getBounds(), { padding: [30, 30] });
}

function drawWaypoints() {
  state.markerLayer.clearLayers();
  for (const p of state.pts) {
    const marker = L.marker([p.lat, p.lon], {
      title: p.name,
      icon: Icons.markerIcon(p.queryName),
    });
    marker.bindPopup(popupHtml(p));
    marker.on('popupopen', (ev) => bindPopupActions(ev.popup.getElement(), p));
    marker.addTo(state.markerLayer);
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// ---- Waypoint edition (rename / remove from the popup) -----------------
function popupHtml(p) {
  const ele = p.ele ? `<span class="wpt-ele">${Math.round(p.ele)} m</span>` : '';
  return `<div class="wpt-popup">` +
    `<div class="wpt-edit">` +
    `<input class="wpt-name-input" value="${escapeAttr(p.name)}" maxlength="100" aria-label="Nom du waypoint">` +
    ele +
    `</div>` +
    p.description +
    `<div class="wpt-actions">` +
    `<button type="button" class="wpt-btn wpt-save">Renommer</button>` +
    `<button type="button" class="wpt-btn danger wpt-delete">Retirer de la trace</button>` +
    `</div></div>`;
}

function bindPopupActions(root, p) {
  if (!root) return;
  const input = root.querySelector('.wpt-name-input');
  const save = () => renameWpt(p, input.value);
  root.querySelector('.wpt-save').addEventListener('click', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
  });
  root.querySelector('.wpt-delete').addEventListener('click', () => removeWpt(p));
}

function overrideFor(p) {
  const key = p.osmType + p.id;
  const o = state.overrides.get(key) || {};
  state.overrides.set(key, o);
  return o;
}

function renameWpt(p, newName) {
  const name = newName.trim();
  if (!name || name === p.name) return;
  overrideFor(p).name = name;
  p.name = name;
  state.map.closePopup();
  syncWaypointUI();
  toast(`Renommé en « ${name} »`, 'ok');
}

function removeWpt(p) {
  overrideFor(p).removed = true;
  state.pts = state.pts.filter((q) => q !== p);
  state.map.closePopup();
  syncWaypointUI();
  toast(`« ${p.name} » retiré de la trace`, 'ok');
}

/** Drop removed waypoints and re-apply renames after a (re-)snap. */
function applyOverrides(pts) {
  if (!state.overrides.size) return pts;
  const out = [];
  for (const p of pts) {
    const o = state.overrides.get(p.osmType + p.id);
    if (o && o.removed) continue;
    if (o && o.name) p.name = o.name;
    out.push(p);
  }
  return out;
}

/** Redraw everything that depends on state.pts. */
function syncWaypointUI() {
  drawWaypoints();
  renderProfileWaypoints();
  state.lastGpx = GPX.build(state.route, state.pts, true);
  $('#stat-wpt').textContent = state.pts.length;
  $('#btn-download').disabled = state.pts.length === 0;
}

// ---- Elevation profile (lightweight SVG) ------------------------------
function drawProfile() {
  const svg = $('#profile');
  const { lat, lon, ele } = state.route;
  if (!ele.some((e) => e > 0)) {
    svg.innerHTML = '<text x="12" y="24" fill="#889">Pas de données d\'altitude</text>';
    $('#profile-wrap').classList.add('empty');
    return;
  }
  $('#profile-wrap').classList.remove('empty');

  // Cumulative distance.
  const dist = [0];
  for (let i = 1; i < lat.length; i++) {
    dist.push(dist[i - 1] + haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]));
  }
  const total = dist[dist.length - 1] || 1;
  const W = svg.clientWidth || 600;
  const H = 120;
  const pad = { l: 40, r: 10, t: 10, b: 20 };
  const minE = Math.min(...ele.filter((e) => e > 0));
  const maxE = Math.max(...ele);
  const x = (d) => pad.l + (d / total) * (W - pad.l - pad.r);
  const y = (e) => H - pad.b - ((e - minE) / (maxE - minE || 1)) * (H - pad.t - pad.b);

  let d = `M ${x(0)} ${y(ele[0] || minE)}`;
  for (let i = 1; i < lat.length; i++) d += ` L ${x(dist[i])} ${y(ele[i] || minE)}`;
  const area = d + ` L ${x(total)} ${H - pad.b} L ${x(0)} ${H - pad.b} Z`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML =
    `<path d="${area}" fill="rgba(228,87,46,0.15)"/>` +
    `<path d="${d}" fill="none" stroke="#e4572e" stroke-width="2"/>` +
    `<text x="4" y="${y(maxE)}" class="ax">${Math.round(maxE)}m</text>` +
    `<text x="4" y="${y(minE) - 2}" class="ax">${Math.round(minE)}m</text>` +
    `<text x="${x(total) - 30}" y="${H - 4}" class="ax">${total.toFixed(1)} km</text>` +
    `<g id="profile-cursor" style="display:none">` +
    `<line y1="${pad.t}" y2="${H - pad.b}" stroke="rgba(255,255,255,.45)" stroke-dasharray="3 3"/>` +
    `<circle r="3.5" fill="#fff" stroke="#e4572e" stroke-width="2"/>` +
    `</g>`;

  // Kept for the hover sync between the profile and the map.
  state.profile = {
    dist, total, W, pad,
    cx: (i) => x(dist[i]),
    cy: (i) => y(ele[i] || minE),
  };

  const dplus = ele.reduce((a, e, i) => (i && e > ele[i - 1] ? a + (e - ele[i - 1]) : a), 0);
  $('#stat-dist').textContent = total.toFixed(1) + ' km';
  $('#stat-dplus').textContent = '+' + Math.round(dplus) + ' m';
  $('#stat-alt').textContent = Math.round(maxE) + ' m';

  renderProfileWaypoints();
}

/** Draw the snapped waypoints as colored dots on the elevation curve. */
function renderProfileWaypoints() {
  const old = $('#profile-wpts');
  if (old) old.remove();
  const cursor = $('#profile-cursor');
  const p = state.profile;
  $('#profile-wpts-toggle-wrap').hidden = !state.pts.length;
  if (!p || !cursor || !state.pts.length) return;

  let html = `<g id="profile-wpts"${state.showProfileWpts ? '' : ' style="display:none"'}>`;
  for (const w of state.pts) {
    const group = (POI[w.queryName] || {}).group;
    const color = Icons.GROUP_COLORS[group] || '#64748b';
    const alt = w.ele ? ` — ${Math.round(w.ele)} m` : '';
    html += `<circle cx="${p.cx(w.index)}" cy="${p.cy(w.index)}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5">` +
      `<title>${escapeHtml(w.name)}${alt}</title></circle>`;
  }
  html += '</g>';
  // Insert below the hover cursor so the cursor stays readable on top.
  cursor.insertAdjacentHTML('beforebegin', html);
}

// ---- Profile <-> map hover sync ---------------------------------------
function profileHover(evt) {
  const p = state.profile;
  if (!p || !state.route) return;
  const rect = $('#profile').getBoundingClientRect();
  const px = (evt.clientX - rect.left) * (p.W / rect.width);
  const dTarget = ((px - p.pad.l) / (p.W - p.pad.l - p.pad.r)) * p.total;
  if (dTarget < 0 || dTarget > p.total) {
    profileLeave();
    return;
  }

  // Nearest track index by cumulative distance (dist is sorted).
  let lo = 0;
  let hi = p.dist.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (p.dist[mid] < dTarget) lo = mid + 1; else hi = mid;
  }
  const i = lo;

  const g = $('#profile-cursor');
  if (g) {
    g.style.display = '';
    const line = g.querySelector('line');
    const dot = g.querySelector('circle');
    line.setAttribute('x1', p.cx(i));
    line.setAttribute('x2', p.cx(i));
    dot.setAttribute('cx', p.cx(i));
    dot.setAttribute('cy', p.cy(i));
  }

  const ll = [state.route.lat[i], state.route.lon[i]];
  if (!state.hoverMarker) {
    state.hoverMarker = L.circleMarker(ll, {
      radius: 7, color: '#fff', weight: 2,
      fillColor: '#e4572e', fillOpacity: 1, interactive: false,
    });
  }
  state.hoverMarker.setLatLng(ll);
  if (!state.map.hasLayer(state.hoverMarker)) state.hoverMarker.addTo(state.map);
}

function profileLeave() {
  const g = $('#profile-cursor');
  if (g) g.style.display = 'none';
  if (state.hoverMarker && state.map.hasLayer(state.hoverMarker)) {
    state.map.removeLayer(state.hoverMarker);
  }
}

// ---- File handling ----------------------------------------------------
function handleFile(file) {
  if (!file.name.toLowerCase().endsWith('.gpx')) {
    toast('Merci de fournir un fichier .gpx', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const route = GPX.parse(reader.result);
      if (loadSettings().reverse || $('#reverse').checked) reverseRoute(route);
      state.route = route;
      state.pts = [];
      state.lastGpx = null;
      state.genElements = null;
      state.genCustom = '';
      state.overrides = new Map();
      state.markerLayer.clearLayers();
      drawRoute();
      drawProfile();
      $('#track-name').textContent = route.name || file.name;
      $('#toolbar').classList.add('active');
      $('#btn-download').disabled = true;
      updatePoiCounts();
      toast(`Trace chargée : ${route.lat.length} points`, 'ok');
    } catch (err) {
      toast(err.message || 'Erreur de lecture du GPX', 'error');
    }
  };
  reader.readAsText(file);
}

function reverseRoute(route) {
  route.lat.reverse();
  route.lon.reverse();
  route.ele.reverse();
}

// ---- Waypoint generation ----------------------------------------------
async function generate() {
  if (!state.route) {
    toast('Chargez d\'abord une trace GPX', 'error');
    return;
  }
  persistSelection();
  const sel = getSelection();
  if (!sel.withName.size && !sel.noName.size && !sel.custom) {
    toast('Sélectionnez au moins un type de POI', 'error');
    return;
  }
  const limDist = parseInt($('#snap-dist').value, 10) / 1000; // m -> km

  setBusy(true);
  try {
    const res = await Overpass.findWaypoints(state.route, sel, limDist, (done, total) => {
      $('#overlay-msg').textContent = total > 1
        ? `Interrogation d'OpenStreetMap… ${done}/${total}`
        : "Interrogation d'OpenStreetMap…";
    });
    state.genElements = res.elements;
    state.genCustom = sel.custom;
    state.pts = applyOverrides(res.pts);
    syncWaypointUI();
    updatePoiCounts();
    const n = state.pts.length;
    if (res.failedSegments) {
      toast(`${n} waypoint(s) — ${res.failedSegments}/${res.totalSegments} portion(s) du parcours n'ont pas pu être interrogées, réessayez`, 'warn');
    } else {
      toast(`${n} waypoint(s) accroché(s) à la trace`, n ? 'ok' : 'warn');
    }
  } catch (err) {
    console.error(err);
    toast('Overpass : ' + (err.message || 'échec de la requête'), 'error');
  } finally {
    setBusy(false);
  }
}

// ---- Live selection updates (no Overpass round-trip) -------------------
/**
 * Re-snap the waypoints from the elements kept in memory with the current
 * selection and snap distance. Returns false when nothing was generated yet.
 */
function refreshFromMemory() {
  if (!state.route || !state.genElements) return false;
  const sel = getSelection();
  const limDist = parseInt($('#snap-dist').value, 10) / 1000;
  state.pts = applyOverrides(Overpass.snapElements(state.genElements, state.route, sel, limDist));
  syncWaypointUI();
  return true;
}

/**
 * Per-checkbox waypoint counters. Computed by snapping ALL types from the
 * elements in memory, so they don't depend on what is currently checked.
 */
function updatePoiCounts() {
  const spans = document.querySelectorAll('#poi-list .cnt');
  if (!state.route || !state.genElements) {
    spans.forEach((s) => { s.textContent = ''; });
    return;
  }
  const all = new Set(Object.keys(POI));
  const limDist = parseInt($('#snap-dist').value, 10) / 1000;
  const pts = Overpass.snapElements(
    state.genElements, state.route,
    { withName: all, noName: all, custom: state.genCustom }, limDist
  );
  const counts = {};
  for (const p of pts) {
    const key = p.queryName + '/' + (p.hasName ? 'with' : 'no');
    counts[key] = (counts[key] || 0) + 1;
  }
  spans.forEach((s) => {
    const n = counts[s.dataset.cntType + '/' + s.dataset.cntKind] || 0;
    s.textContent = n;
    s.classList.toggle('zero', n === 0);
  });
}

/** A POI checkbox changed: update live, or hint that a generation is due. */
function onSelectionChanged() {
  persistSelection();
  if (!state.route) return;
  if (!refreshFromMemory()) flashGenerate();
}

/** Short holographic sweep on the Generate button. */
function flashGenerate() {
  const b = $('#btn-generate');
  b.classList.remove('holo');
  void b.offsetWidth; // restart the CSS animation
  b.classList.add('holo');
  clearTimeout(flashGenerate._t);
  flashGenerate._t = setTimeout(() => b.classList.remove('holo'), 1300);
}

function download() {
  if (!state.lastGpx) return;
  const base = (state.route.name || 'mountaingpx').replace(/[^\w.-]+/g, '_');
  const blob = new Blob([state.lastGpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = base + '_wpt.gpx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- UI feedback ------------------------------------------------------
let toastTimer;
function toast(msg, kind) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + (kind || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
function setBusy(b) {
  $('#btn-generate').disabled = b;
  $('#btn-generate').classList.toggle('loading', b);
  $('#overlay').classList.toggle('show', b);
}

// ---- Bulk selection helpers ------------------------------------------
function selectAll(kind, checked) {
  document.querySelectorAll(`#poi-list input[data-kind="${kind}"]`).forEach((cb) => {
    cb.checked = checked;
  });
  onSelectionChanged();
}
function resetDefaults() {
  document.querySelectorAll('#poi-list input[type=checkbox]').forEach((cb) => {
    cb.checked = cb.dataset.kind === 'with' && DEFAULT_WITH_NAME.includes(cb.dataset.type);
  });
  onSelectionChanged();
}

// ---- Wiring -----------------------------------------------------------
function wire() {
  const drop = document.body;
  const input = $('#file-input');
  $('#btn-open').addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => e.target.files[0] && handleFile(e.target.files[0]));

  // Drag & drop a GPX anywhere on the page (desktop convenience).
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('dragging');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'dragleave' && e.relatedTarget) return;
      drop.classList.remove('dragging');
    })
  );
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  $('#btn-generate').addEventListener('click', generate);
  $('#btn-download').addEventListener('click', download);
  $('#overpass-custom').addEventListener('change', () => {
    persistSelection();
    // The custom query results are not in memory: a new generation is due.
    if (state.genElements && $('#overpass-custom').value.trim() !== state.genCustom) {
      flashGenerate();
    }
  });
  $('#reverse').addEventListener('change', () => {
    persistSelection();
    if (state.route) {
      reverseRoute(state.route);
      state.pts = [];
      state.markerLayer.clearLayers();
      state.lastGpx = null;
      $('#btn-download').disabled = true;
      drawRoute();
      drawProfile();
      refreshFromMemory();
      updatePoiCounts();
    }
  });
  $('#snap-dist').addEventListener('input', (e) => {
    $('#snap-dist-val').textContent = e.target.value + ' m';
  });
  $('#snap-dist').addEventListener('change', () => {
    persistSelection();
    refreshFromMemory();
    updatePoiCounts();
  });
  $('#sel-all-with').addEventListener('click', () => selectAll('with', true));
  $('#sel-none-with').addEventListener('click', () => selectAll('with', false));
  $('#btn-defaults').addEventListener('click', resetDefaults);

  $('#profile').addEventListener('mousemove', profileHover);
  $('#profile').addEventListener('mouseleave', profileLeave);
  $('#profile-wpts-toggle').addEventListener('change', (e) => {
    state.showProfileWpts = e.target.checked;
    const g = $('#profile-wpts');
    if (g) g.style.display = state.showProfileWpts ? '' : 'none';
  });

  window.addEventListener('resize', () => state.route && drawProfile());
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  buildPoiPanel();
  wire();
});
