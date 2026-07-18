/*
 * app.js — Mountain GPX (browser edition)
 * Orchestrates the UI, the Leaflet map and the OSM waypoint pipeline.
 * 100% client-side: no server, no upload leaves the browser.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import * as GPX from './gpx.js';
import * as TCX from './tcx.js';
import { haversine } from './geometry.js';
import * as Icons from './icons.js';
import * as Overpass from './overpass.js';
import { POI, GROUPS, DEFAULT_WITH_NAME } from './poi.js';
import {
  t, translateDom, detectLang, getLang, setLang, saveLang,
  SUPPORTED, LANG_NAMES,
} from './i18n.js';

const LS_KEY = 'mountaingpx.settings.v1';
const LS_VIEW_KEY = 'mountaingpx.view.v1';
const LS_LAYERS_KEY = 'mountaingpx.layers.v1';
const DEFAULT_VIEW = { lat: 45.9, lon: 6.87, zoom: 12 };

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
  lastTcx: null,
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
  container.innerHTML = '';
  const saved = loadSettings();
  const savedWith = new Set(saved.withName || DEFAULT_WITH_NAME);
  const savedNo = new Set(saved.noName || []);

  // Group POI types.
  const groups = {};
  for (const [type, cfg] of Object.entries(POI)) {
    (groups[cfg.group] = groups[cfg.group] || []).push([type, cfg]);
  }

  for (const gkey of GROUPS) {
    const details = el('details', 'poi-group');
    details.open = true;
    const summary = el('summary', null, escapeHtml(t('group.' + gkey)));
    details.appendChild(summary);

    const table = el('table', 'poi-table');
    const head = el('tr', null,
      '<th></th>' +
      `<th title="${escapeAttr(t('th.namedTitle'))}">${escapeHtml(t('th.named'))}</th>` +
      `<th title="${escapeAttr(t('th.nonameTitle'))}">${escapeHtml(t('th.noname'))}</th>`);
    table.appendChild(head);

    for (const [type, cfg] of (groups[gkey] || [])) {
      const tr = el('tr');
      const tdName = el('td', 'poi-name');
      tdName.innerHTML = `${Icons.svgFor(type, 18)} ${escapeHtml(t('poi.' + type))}`;
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

// ---- Map view persistence ---------------------------------------------
function loadView() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_VIEW_KEY));
    if (v && isFinite(v.lat) && isFinite(v.lon) && isFinite(v.zoom)) return v;
  } catch (_) {}
  return null;
}
function saveView(map) {
  const c = map.getCenter();
  try {
    localStorage.setItem(
      LS_VIEW_KEY,
      JSON.stringify({ lat: c.lat, lon: c.lng, zoom: map.getZoom() })
    );
  } catch (_) {}
}

function loadLayers() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_LAYERS_KEY));
    if (v && typeof v.base === 'string' && Array.isArray(v.overlays)) return v;
  } catch (_) {}
  return null;
}
function saveLayers(base, overlays) {
  try {
    localStorage.setItem(LS_LAYERS_KEY, JSON.stringify({ base, overlays }));
  } catch (_) {}
}

// ---- Map --------------------------------------------------------------
function initMap() {
  // Restore the last view: the URL hash wins (shareable links), otherwise
  // fall back to the position saved from the previous session.
  const saved = parseMapHash(location.hash) || loadView() || DEFAULT_VIEW;
  const map = L.map('map', { zoomControl: true })
    .setView([saved.lat, saved.lon], saved.zoom);

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

  // Layers keyed by a stable id (used for persistence) with the display name
  // resolved through i18n, so switching language never breaks the saved
  // selection and the control can simply be rebuilt with new labels.
  state.baseLayers = [
    { key: 'opentopo', i18n: 'layers.opentopo', layer: opentopo },
    { key: 'osm', i18n: 'layers.osm', layer: osm },
    { key: 'satellite', i18n: 'layers.satellite', layer: sat },
  ];
  state.overlayLayers = [
    { key: 'trails', i18n: 'layers.trails', layer: cycl },
    { key: 'water', i18n: 'layers.water', layer: initWaterOverlay(map) },
  ];

  state.map = map;

  // Restore the base map and overlays chosen in the previous session.
  const savedLayers = loadLayers();
  const baseDef = (savedLayers && state.baseLayers.find((d) => d.key === savedLayers.base))
    || state.baseLayers[0];
  baseDef.layer.addTo(map);

  buildLayersControl();

  // Add restored overlays after the control exists, firing `overlayadd` so
  // dependent layers (e.g. the on-demand water points) load their data.
  if (savedLayers) {
    for (const def of state.overlayLayers) {
      if (savedLayers.overlays.includes(def.key) && !map.hasLayer(def.layer)) {
        def.layer.addTo(map);
        map.fire('overlayadd', { layer: def.layer, name: t(def.i18n) });
      }
    }
  }

  map.on('baselayerchange overlayadd overlayremove', persistLayers);

  state.markerLayer = L.layerGroup().addTo(map);

  // Keep the map position in the URL (OSM-style #map=zoom/lat/lon) so the
  // view can be shared, and persist it to localStorage so it is restored
  // whenever the app is reopened (even without the hash, e.g. as a PWA).
  map.on('moveend', () => {
    const c = map.getCenter();
    history.replaceState(null, '', `#map=${map.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}`);
    saveView(map);
  });
}

function parseMapHash(hash) {
  const m = /^#map=(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(hash || '');
  if (!m) return null;
  return { zoom: parseFloat(m[1]), lat: parseFloat(m[2]), lon: parseFloat(m[3]) };
}

/** (Re)build the Leaflet layers control with the current-language labels. */
function buildLayersControl() {
  if (state.layersControl) state.map.removeControl(state.layersControl);
  const bases = {};
  for (const d of state.baseLayers) bases[t(d.i18n)] = d.layer;
  const overs = {};
  for (const d of state.overlayLayers) overs[t(d.i18n)] = d.layer;
  state.layersControl = L.control.layers(bases, overs).addTo(state.map);
}

/** Persist the active base map / overlays (by stable key) after any change. */
function persistLayers() {
  let baseKey = state.baseLayers[0].key;
  for (const d of state.baseLayers) if (state.map.hasLayer(d.layer)) baseKey = d.key;
  const on = state.overlayLayers
    .filter((d) => state.map.hasLayer(d.layer))
    .map((d) => d.key);
  saveLayers(baseKey, on);
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
          title: tags.name || t('water.default'),
          icon: Icons.waterDotIcon(),
        });
        marker.bindPopup(
          `<div class="wpt-popup"><h3>${escapeHtml(tags.name || t('water.default'))}</h3>` +
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
      toast(t('water.zoomIn'), 'warn');
    } else {
      refresh();
    }
  });
  return layer;
}

function drawRoute(fit = true) {
  const { lat, lon } = state.route;
  if (state.trackLayer) state.map.removeLayer(state.trackLayer);
  const coords = lat.map((la, i) => [la, lon[i]]);

  const line = L.polyline(coords, { color: '#e4572e', weight: 4, opacity: 0.9 });
  const mk = (kind, ll, title) =>
    L.marker(ll, { title, icon: Icons.flagIcon(kind) });

  // Group the polyline and the start/end markers so they toggle together.
  state.trackLayer = L.featureGroup([
    line,
    mk('start', coords[0], t('map.start')),
    mk('end', coords[coords.length - 1], t('map.end')),
  ]).addTo(state.map);

  if (fit) state.map.fitBounds(line.getBounds(), { padding: [30, 30] });
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
    `<input class="wpt-name-input" value="${escapeAttr(p.name)}" maxlength="100" aria-label="${escapeAttr(t('popup.nameAria'))}">` +
    ele +
    `</div>` +
    p.description +
    `<div class="wpt-actions">` +
    `<button type="button" class="wpt-btn wpt-save">${escapeHtml(t('popup.rename'))}</button>` +
    `<button type="button" class="wpt-btn danger wpt-delete">${escapeHtml(t('popup.delete'))}</button>` +
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
  toast(t('toast.renamed', { name }), 'ok');
}

function removeWpt(p) {
  overrideFor(p).removed = true;
  state.pts = state.pts.filter((q) => q !== p);
  state.map.closePopup();
  syncWaypointUI();
  toast(t('toast.removed', { name: p.name }), 'ok');
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
  state.lastTcx = TCX.build(state.route, state.pts, true);
  $('#stat-wpt').textContent = state.pts.length;
  $('#btn-download').disabled = state.pts.length === 0;
  $('#btn-download-tcx').disabled = state.pts.length === 0;
}

// ---- Elevation profile (lightweight SVG) ------------------------------
function drawProfile() {
  const svg = $('#profile');
  const { lat, lon, ele } = state.route;
  if (!ele.some((e) => e > 0)) {
    svg.innerHTML = `<text x="12" y="24" fill="#889">${escapeHtml(t('profile.noElevation'))}</text>`;
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
    toast(t('toast.notGpx'), 'error');
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
      state.lastTcx = null;
      state.genElements = null;
      state.genCustom = '';
      state.overrides = new Map();
      state.markerLayer.clearLayers();
      drawRoute();
      drawProfile();
      state.trackName = route.name || file.name;
      $('#track-name').textContent = state.trackName;
      $('#toolbar').classList.add('active');
      $('#btn-download').disabled = true;
      $('#btn-download-tcx').disabled = true;
      updatePoiCounts();
      toast(t('toast.trackLoaded', { n: route.lat.length }), 'ok');
    } catch (err) {
      toast(err.code ? t(err.code, err.params) : (err.message || t('toast.gpxError')), 'error');
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
    toast(t('toast.needTrack'), 'error');
    return;
  }
  persistSelection();
  const sel = getSelection();
  if (!sel.withName.size && !sel.noName.size && !sel.custom) {
    toast(t('toast.selectPoi'), 'error');
    return;
  }
  const limDist = parseInt($('#snap-dist').value, 10) / 1000; // m -> km

  setBusy(true);
  try {
    const res = await Overpass.findWaypoints(state.route, sel, limDist, (done, total) => {
      $('#overlay-msg').textContent = total > 1
        ? t('overlay.queryingProgress', { done, total })
        : t('overlay.querying');
    });
    state.genElements = res.elements;
    state.genCustom = sel.custom;
    state.pts = applyOverrides(res.pts);
    syncWaypointUI();
    updatePoiCounts();
    setMenu(false); // reveal the map with the fresh waypoints (mobile)
    const n = state.pts.length;
    if (res.failedSegments) {
      toast(t('toast.partialFail', { n, failed: res.failedSegments, total: res.totalSegments }), 'warn');
    } else {
      toast(t('toast.snapped', { n }), n ? 'ok' : 'warn');
    }
  } catch (err) {
    console.error(err);
    const msg = err.code ? t(err.code, err.params) : (err.message || t('error.requestFailed'));
    toast(t('toast.overpassError', { msg }), 'error');
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

function saveFile(content, ext, mime) {
  if (!content) return;
  const base = (state.route.name || 'mountaingpx').replace(/[^\w.-]+/g, '_');
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = base + '_wpt.' + ext;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function download() {
  saveFile(state.lastGpx, 'gpx', 'application/gpx+xml');
}

function downloadTcx() {
  saveFile(state.lastTcx, 'tcx', 'application/vnd.garmin.tcx+xml');
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

// ---- Mobile drawer ----------------------------------------------------
function setMenu(open) {
  const backdrop = $('#backdrop');
  document.body.classList.toggle('menu-open', open);
  $('#menu-btn').setAttribute('aria-expanded', String(open));
  if (open) {
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('show'));
  } else {
    backdrop.classList.remove('show');
    setTimeout(() => {
      if (!document.body.classList.contains('menu-open')) backdrop.hidden = true;
    }, 250);
  }
}

// ---- Wiring -----------------------------------------------------------
function wire() {
  const drop = $('#dropzone');
  const input = $('#file-input');
  $('#btn-open').addEventListener('click', () => input.click());
  input.addEventListener('change', (e) => e.target.files[0] && handleFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('over');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('over');
    })
  );
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });

  // Mobile drawer for the POI config.
  $('#menu-btn').addEventListener('click', () =>
    setMenu(!document.body.classList.contains('menu-open'))
  );
  $('#menu-close').addEventListener('click', () => setMenu(false));
  $('#backdrop').addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

  $('#btn-generate').addEventListener('click', generate);
  $('#btn-download').addEventListener('click', download);
  $('#btn-download-tcx').addEventListener('click', downloadTcx);
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
      state.lastTcx = null;
      $('#btn-download').disabled = true;
      $('#btn-download-tcx').disabled = true;
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

  $('#lang-select').addEventListener('change', (e) => setLanguage(e.target.value));

  window.addEventListener('resize', () => state.route && drawProfile());
}

// ---- Internationalization ---------------------------------------------
/** Fill the language selector with the supported languages' endonyms. */
function buildLangSelector() {
  const sel = $('#lang-select');
  sel.innerHTML = '';
  for (const code of SUPPORTED) {
    const opt = el('option');
    opt.value = code;
    opt.textContent = LANG_NAMES[code];
    sel.appendChild(opt);
  }
  sel.value = getLang();
}

/** Apply the current language to every static and dynamic part of the UI. */
function applyLanguage() {
  document.documentElement.lang = getLang();
  document.title = t('meta.title');
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('meta.description'));
  translateDom();
  // The track name is user data, not a translatable label.
  if (state.trackName) $('#track-name').textContent = state.trackName;
}

/** Switch language at runtime: persist, then re-render everything. */
function setLanguage(lang) {
  setLang(lang);
  saveLang(getLang());
  applyLanguage();
  buildPoiPanel();
  buildLayersControl();
  if (state.route) {
    drawRoute(false); // refresh start/end labels without moving the view
    drawProfile();
    syncWaypointUI();
  }
  updatePoiCounts();
}

document.addEventListener('DOMContentLoaded', () => {
  setLang(detectLang());
  buildLangSelector();
  applyLanguage();
  initMap();
  buildPoiPanel();
  wire();
});
