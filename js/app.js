/*
 * app.js — Mountain GPX (browser edition)
 * Orchestrates the UI, the Leaflet map and the OSM waypoint pipeline.
 * 100% client-side: no server, no upload leaves the browser.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import QRCode from 'qrcode';

import * as GPX from './gpx.js';
import * as TCX from './tcx.js';
import * as Share from './share.js';
import * as Formats from './formats.js';
import { findNearest } from './geometry.js';
import { computeMilestones } from './milestones.js';
import { escapeHtml, escapeAttr } from './html.js';
import * as Icons from './icons.js';
import * as Overpass from './overpass.js';
import * as Profile from './profile.js';
import * as Roadbook from './roadbook.js';
import * as Water from './water.js';
import { POI, GROUPS, DEFAULT_WITH_NAME, DEFAULT_NO_NAME, GENERIC_TYPE, poiTypeFrom } from './poi.js';
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
  fileWpts: [], // waypoints carried by the opened file itself
  userWpts: [], // waypoints added by hand on the map
  userSeq: 0,   // id sequence for user waypoints (override keys)
  map: null,
  milestoneLayer: null, // distance / D+ markers along the track
  layers: {},
  trackLayer: null,
  markerLayer: null,
  endpoints: null,
  lastGpx: null,
  lastTcx: null,
  shareCode: null, // encoded track kept in the URL hash (#track=…)
  showProfileWpts: true,
  genElements: null, // raw OSM elements of the last generation (all types)
  genCustom: '',     // custom query used by the last generation
  wptMarkers: new Map(), // waypoint object -> Leaflet marker (roadbook focus)
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
  const savedNo = new Set(saved.noName || DEFAULT_NO_NAME);

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
  $('#milestone-mode').value = ['dist', 'ele'].includes(saved.mstMode) ? saved.mstMode : 'none';
  syncMilestoneStepInput();
}

/** Reflect the selected milestone mode on the step input (value, bounds). */
function syncMilestoneStepInput() {
  const mode = $('#milestone-mode').value;
  const saved = loadSettings();
  const input = $('#milestone-step');
  input.disabled = mode === 'none';
  if (mode === 'ele') {
    input.min = 50;
    input.step = 50;
    input.value = saved.mstEle > 0 ? saved.mstEle : 100;
  } else {
    input.min = 1;
    input.step = 1;
    input.value = saved.mstDist > 0 ? saved.mstDist : 5;
  }
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
  // The step input only shows the active milestone mode's value: keep the
  // other mode's saved step so switching back restores it.
  const prev = loadSettings();
  const mstMode = $('#milestone-mode').value;
  const step = parseFloat($('#milestone-step').value);
  saveSettings({
    withName: [...sel.withName],
    noName: [...sel.noName],
    custom: sel.custom,
    snap: parseInt($('#snap-dist').value, 10),
    reverse: $('#reverse').checked,
    mstMode,
    mstDist: mstMode === 'dist' && step > 0 ? step : (prev.mstDist > 0 ? prev.mstDist : 5),
    mstEle: mstMode === 'ele' && step > 0 ? step : (prev.mstEle > 0 ? prev.mstEle : 100),
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
  const saved = parseHash(location.hash).view || loadView() || DEFAULT_VIEW;
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

  // Right-click (long-press on touch devices) adds a manual waypoint.
  map.on('contextmenu', (e) => {
    if (state.route) openAddWptPopup(e.latlng);
  });

  // Keep the map position in the URL (OSM-style #map=zoom/lat/lon) so the
  // view can be shared, and persist it to localStorage so it is restored
  // whenever the app is reopened (even without the hash, e.g. as a PWA).
  map.on('moveend', () => {
    updateHash();
    saveView(map);
  });
}

/**
 * Parse the URL hash into { view?, track? }. Both parts can coexist
 * (#map=zoom/lat/lon&track=<code>) so a shared track survives panning
 * and page reloads.
 */
function parseHash(hash) {
  const out = {};
  for (const part of String(hash || '').replace(/^#/, '').split('&')) {
    const m = /^map=(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(part);
    if (m) out.view = { zoom: parseFloat(m[1]), lat: parseFloat(m[2]), lon: parseFloat(m[3]) };
    const t = /^track=([A-Za-z0-9_-]+)$/.exec(part);
    if (t) out.track = t[1];
  }
  return out;
}

/** Rewrite the hash from the current map view, keeping the shared track. */
function updateHash() {
  const c = state.map.getCenter();
  const track = state.shareCode ? `&track=${state.shareCode}` : '';
  history.replaceState(
    null, '',
    `#map=${state.map.getZoom()}/${c.lat.toFixed(5)}/${c.lng.toFixed(5)}${track}`
  );
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
// The overlay logic (area cap, caching, dedup) lives in water.js; only the
// Leaflet marker construction and the Overpass runner are provided here.
function initWaterOverlay(map) {
  const layer = L.layerGroup();
  return Water.createWaterOverlay({
    map,
    layer,
    fetchWater: async (box) =>
      (await Overpass.run(Overpass.buildQuery(box, Water.WATER_FILTERS))).elements,
    makeMarker: (el) => {
      const tags = el.tags || {};
      const marker = L.marker([el.lat, el.lon], {
        title: tags.name || t('water.default'),
        icon: Icons.waterDotIcon(),
      });
      marker.bindPopup(
        `<div class="wpt-popup"><h3>${escapeHtml(tags.name || t('water.default'))}</h3>` +
        Overpass.describeOsm(el.type, el.id, tags) + '</div>'
      );
      return marker;
    },
    onTooWide: () => toast(t('water.zoomIn'), 'warn'),
  });
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
  drawMilestones();
}

// ---- Distance / D+ milestones along the track ---------------------------
/** (Re)draw the milestone badges from the current advanced-options settings. */
function drawMilestones() {
  if (state.milestoneLayer) {
    state.map.removeLayer(state.milestoneLayer);
    state.milestoneLayer = null;
  }
  if (!state.route) return;
  const mode = $('#milestone-mode').value;
  const step = parseFloat($('#milestone-step').value);
  if (mode === 'none' || !(step > 0)) return;
  const marks = computeMilestones(state.route, mode, step);
  state.milestoneLayer = L.layerGroup(
    marks.map((m) => L.marker([m.lat, m.lon], {
      icon: Icons.milestoneIcon(mode === 'dist' ? String(m.value) : '+' + m.value),
      interactive: false,
      keyboard: false,
      zIndexOffset: -500, // decorative: below the waypoint pins
    }))
  ).addTo(state.map);
}

function drawWaypoints() {
  state.markerLayer.clearLayers();
  state.wptMarkers = new Map();
  for (const p of state.pts) {
    const marker = L.marker([p.lat, p.lon], {
      title: p.name,
      icon: Icons.markerIcon(p.queryName),
    });
    marker.bindPopup(popupHtml(p));
    marker.on('popupopen', (ev) => bindPopupActions(ev.popup.getElement(), p));
    marker.on('mouseover', () => setWptHighlight(p, true));
    marker.on('mouseout', () => setWptHighlight(p, false));
    marker.addTo(state.markerLayer);
    state.wptMarkers.set(p, marker);
  }
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
  const idx = state.pts.indexOf(p);
  overrideFor(p).removed = true;
  state.pts = state.pts.filter((q) => q !== p);
  state.map.closePopup();
  syncWaypointUI();
  toast(t('toast.removed', { name: p.name }), 'ok', {
    label: t('toast.undo'),
    fn: () => restoreWpt(p, idx),
  });
}

/** Undo a removal: clear the override and put the waypoint back in place. */
function restoreWpt(p, idx) {
  delete overrideFor(p).removed;
  if (!state.pts.includes(p)) {
    state.pts.splice(idx < 0 ? state.pts.length : Math.min(idx, state.pts.length), 0, p);
  }
  syncWaypointUI();
  toast(t('toast.restored', { name: p.name }), 'ok');
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

// ---- Waypoints already present in the opened file -----------------------
/**
 * Turn the <wpt> elements of the opened GPX into first-class waypoint
 * objects (same shape as overpass.js) so they show up on the map, the
 * profile, the roadbook and the exports — whether the file was generated
 * by Mountain GPX or not. Types outside the POI catalog fall back to the
 * generic type (gray pin, "info" glyph).
 */
function fileWaypointsToPts(route) {
  const pts = [];
  const counters = {};
  (route.waypoints || []).forEach((w, i) => {
    if (!isFinite(w.lat) || !isFinite(w.lon)) return;
    const queryName = poiTypeFrom(w.type || w.sym);
    let name = (w.name || '').trim();
    if (!name) {
      counters[queryName] = (counters[queryName] || 0) + 1;
      name = queryName + counters[queryName];
    }
    pts.push({
      name,
      osmType: 'file', // key namespace for overrides & hover sync
      id: i,
      lat: w.lat,
      lon: w.lon,
      ele: parseFloat(w.ele) || 0,
      // Anchor on the nearest route point (roadbook order, profile dot),
      // even for waypoints sitting off the track.
      index: findNearest(route.lon, route.lat, w.lon, w.lat, Infinity).index,
      newGpxIndex: null, // never re-projected: the file position is kept
      queryName,
      rawType: w.type, // original <type>, re-exported verbatim
      hasName: !!w.name,
      description: w.desc ? `<p class="wpt-desc">${escapeHtml(w.desc)}</p>` : '',
      descText: w.desc || '',
    });
  });
  return pts;
}

/** Current waypoints: file + manual + generated ones, edits re-applied. */
function allPts(genPts) {
  return applyOverrides([...state.fileWpts, ...state.userWpts, ...(genPts || [])]);
}

// ---- Manual waypoints (added from the map) -------------------------------
/** Popup form: name, type from the POI catalog, add button. */
function addWptPopupHtml() {
  let opts = `<option value="${GENERIC_TYPE}">${escapeHtml(t('poi.' + GENERIC_TYPE))}</option>`;
  for (const gkey of GROUPS) {
    opts += `<optgroup label="${escapeAttr(t('group.' + gkey))}">`;
    for (const [type, cfg] of Object.entries(POI)) {
      if (cfg.group === gkey) {
        opts += `<option value="${type}">${escapeHtml(t('poi.' + type))}</option>`;
      }
    }
    opts += '</optgroup>';
  }
  return `<div class="wpt-popup wpt-add">` +
    `<h3>${escapeHtml(t('addwpt.title'))}</h3>` +
    `<input class="wpt-name-input" maxlength="100" placeholder="${escapeAttr(t('addwpt.namePlaceholder'))}" aria-label="${escapeAttr(t('popup.nameAria'))}">` +
    `<select class="wpt-type-select" aria-label="${escapeAttr(t('addwpt.typeAria'))}">${opts}</select>` +
    `<div class="wpt-actions"><button type="button" class="wpt-btn wpt-add-btn">${escapeHtml(t('addwpt.add'))}</button></div>` +
    `</div>`;
}

function openAddWptPopup(latlng) {
  const div = el('div', null, addWptPopupHtml());
  const popup = L.popup().setLatLng(latlng).setContent(div).openOn(state.map);
  const input = div.querySelector('.wpt-name-input');
  const add = () => {
    addUserWpt(latlng, input.value, div.querySelector('.wpt-type-select').value);
    state.map.closePopup(popup);
  };
  div.querySelector('.wpt-add-btn').addEventListener('click', add);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });
}

/**
 * Create the manual waypoint at the clicked position. Like file waypoints
 * it is anchored on the nearest route point (roadbook order, profile dot)
 * but keeps the clicked coordinates — the track is never re-woven.
 */
function addUserWpt(latlng, rawName, type) {
  const route = state.route;
  const near = findNearest(route.lon, route.lat, latlng.lng, latlng.lat, Infinity);
  const id = state.userSeq++;
  const name = rawName.trim() || `${t('poi.' + type)} ${id + 1}`;
  state.userWpts.push({
    name,
    osmType: 'user', // key namespace for overrides & hover sync
    id,
    lat: latlng.lat,
    lon: latlng.lng,
    ele: route.ele[near.index] || 0,
    index: near.index,
    newGpxIndex: null,
    queryName: type,
    hasName: true,
    description: '',
    descText: '',
  });
  if (!refreshFromMemory()) {
    state.pts = allPts();
    syncWaypointUI();
  }
  toast(t('toast.wptAdded', { name }), 'ok');
}

/** Redraw everything that depends on state.pts. */
function syncWaypointUI() {
  drawWaypoints();
  renderProfileWaypoints();
  renderRoadbook();
  // File waypoints being part of state.pts, keepOld would duplicate them.
  state.lastGpx = GPX.build(state.route, state.pts, false);
  state.lastTcx = TCX.build(state.route, state.pts, false);
  $('#stat-wpt').textContent = state.pts.length;
  $('#btn-download').disabled = state.pts.length === 0;
  $('#btn-download-tcx').disabled = state.pts.length === 0;
  refreshShareCode(); // async, keeps an active share link in sync
}

// ---- Roadbook (waypoint list sorted by distance along the track) --------
// Row rendering lives in roadbook.js; this wires it to the map, i18n and
// icons, and fills the printed header.
function setRoadbook(open) {
  $('#roadbook').classList.toggle('open', open);
  $('#btn-roadbook').setAttribute('aria-expanded', String(open));
}

/** Rebuild the roadbook rows; hides the toggle when there is nothing to list. */
function renderRoadbook() {
  const btn = $('#btn-roadbook');
  const body = $('#roadbook-body');
  btn.hidden = !state.pts.length;
  if (!state.pts.length) {
    body.innerHTML = '';
    setRoadbook(false);
    return;
  }

  Roadbook.render(body, state.route, state.pts, {
    iconSvg: (p) => Icons.svgFor(p.queryName, 18),
    flagSvg: (kind) => Icons.flagSvg(kind, 18),
    typeLabel: (p) =>
      (POI[p.queryName] || p.queryName === GENERIC_TYPE ? t('poi.' + p.queryName) : ''),
    startLabel: t('map.start'),
    endLabel: t('map.end'),
    onFocus: focusWpt,
    onHover: setWptHighlight,
    onEndpoint: (idx) => {
      if (window.matchMedia('(max-width: 820px)').matches) setRoadbook(false);
      state.map.setView(
        [state.route.lat[idx], state.route.lon[idx]],
        Math.max(state.map.getZoom(), 15)
      );
    },
  });

  // Header repeated on paper: the printed page has no toolbar.
  $('#rb-track').textContent = state.trackName || '';
  $('#rb-stats').textContent =
    `${$('#stat-dist').textContent} · D${$('#stat-dplus').textContent} · ` +
    `${state.pts.length} wpt`;
}

/**
 * Highlight a waypoint everywhere it is displayed: profile dot, map pin and
 * roadbook row. Hovering any of the three lights up the other two; the map
 * is never panned, only decorated.
 */
function setWptHighlight(p, on) {
  Profile.setDotHighlight($('#profile'), p.osmType + p.id, on);
  const marker = state.wptMarkers.get(p);
  if (marker) {
    const icon = marker.getElement();
    if (icon) icon.classList.toggle('hl', on);
    marker.setZIndexOffset(on ? 1000 : 0); // above neighbouring pins
  }
  const row = document.querySelector(
    `#roadbook-body .rb-row[data-wpt="${p.osmType}${p.id}"]`
  );
  if (row) {
    row.classList.toggle('hl', on);
    // Reveal the row when the hover comes from the map/profile ('nearest'
    // keeps the list still when the row is already visible).
    if (on && $('#roadbook').classList.contains('open')) {
      row.scrollIntoView({ block: 'nearest' });
    }
  }
}

/** Waypoint lookup by the "osmType+id" key carried by the profile dots. */
function wptByKey(key) {
  return state.pts.find((q) => q.osmType + q.id === key);
}

/** Center the map on a waypoint and open its popup. */
function focusWpt(p) {
  // The panel covers the whole map on small screens: reveal the result.
  if (window.matchMedia('(max-width: 820px)').matches) setRoadbook(false);
  state.map.setView([p.lat, p.lon], Math.max(state.map.getZoom(), 15));
  const marker = state.wptMarkers.get(p);
  if (marker) marker.openPopup();
}

// ---- Elevation profile (lightweight SVG) ------------------------------
// The SVG rendering lives in profile.js; this connects it to the toolbar
// stats and the map hover marker.
function drawProfile() {
  const svg = $('#profile');
  // Reveal the wrap *before* rendering: .empty hides it (display:none) and a
  // hidden svg reports clientWidth 0, so the profile would be drawn on the
  // 600-unit fallback and stretched to the real width afterwards.
  $('#profile-wrap').classList.remove('empty');
  const p = Profile.render(svg, state.route, { noElevationText: t('profile.noElevation') });
  // A null profile means no elevation data; stale geometry must not place
  // waypoint dots.
  state.profile = p;
  $('#profile-wrap').classList.toggle('empty', !p);
  if (!p) return;

  $('#stat-dist').textContent = p.total.toFixed(1) + ' km';
  $('#stat-dplus').textContent = '+' + Math.round(p.dplus) + ' m';
  $('#stat-alt').textContent = Math.round(p.maxE) + ' m';

  renderProfileWaypoints();
}

/** Draw the snapped waypoints as colored dots on the elevation curve. */
function renderProfileWaypoints() {
  $('#profile-wpts-toggle-wrap').hidden = !state.pts.length;
  Profile.renderWaypoints($('#profile'), state.profile, state.pts, {
    show: state.showProfileWpts,
    colorFor: (queryName) => Icons.GROUP_COLORS[(POI[queryName] || {}).group],
  });
}

// ---- Profile <-> map hover sync ---------------------------------------
function profileHover(evt) {
  const p = state.profile;
  if (!p || !state.route) return;
  const rect = $('#profile').getBoundingClientRect();
  const px = (evt.clientX - rect.left) * (p.W / rect.width);
  const i = Profile.indexAt(p, px);
  if (i == null) {
    profileLeave();
    return;
  }

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
/** Install a parsed route as the current track and reset everything else. */
function loadRoute(route, displayName, fit = true) {
  if (loadSettings().reverse || $('#reverse').checked) reverseRoute(route);
  state.route = route;
  state.genElements = null;
  state.genCustom = '';
  state.overrides = new Map();
  state.userWpts = [];
  // Waypoints carried by the file are displayed right away.
  state.fileWpts = fileWaypointsToPts(route);
  state.pts = [...state.fileWpts];
  drawRoute(fit);
  drawProfile();
  state.trackName = displayName;
  $('#track-name').textContent = state.trackName;
  $('#toolbar').classList.add('active');
  $('#btn-share').hidden = false;
  syncWaypointUI();
  updatePoiCounts();
  toast(state.fileWpts.length
    ? t('toast.trackLoadedWpts', { n: route.lat.length, w: state.fileWpts.length })
    : t('toast.trackLoaded', { n: route.lat.length }), 'ok');
}

function handleFile(file) {
  const m = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = m ? m[1].toLowerCase() : '';
  if (!Formats.EXTENSIONS.includes(ext)) {
    toast(t('error.badFormat'), 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const route = Formats.parse(ext, reader.result);
      // A locally opened file replaces any track shared through the URL.
      state.shareCode = null;
      loadRoute(route, route.name || file.name);
      // Several <trk> in one file are concatenated: warn, the resulting
      // profile and roadbook can be surprising.
      if (route.trackCount > 1) {
        toast(t('toast.multiTrack', { n: route.trackCount }), 'warn');
      }
    } catch (err) {
      toast(err.code ? t(err.code, err.params) : (err.message || t('toast.fileError')), 'error');
    }
  };
  // FIT is binary; every other supported format is XML text.
  if (Formats.BINARY_EXTENSIONS.includes(ext)) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
}

// ---- Track sharing through the URL -------------------------------------
/** Current waypoints in the wire shape shared through the link. */
function shareWpts() {
  return state.pts.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    ele: p.ele || 0,
    name: p.name,
    type: p.queryName,
  }));
}

/**
 * Re-encode the link after any waypoint change so the URL always carries
 * what is on screen. Only runs when a share link is already active.
 */
async function refreshShareCode() {
  if (!state.shareCode || !state.route) return;
  try {
    const res = await Share.encodeFit(state.route, shareWpts());
    state.shareCode = res.code;
    updateHash();
  } catch (_) {} // sharing stays best-effort: the UI already reflects the edit
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {}
  // Fallback for insecure contexts / older browsers.
  try {
    const ta = el('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

// ---- Share modal ---------------------------------------------------------
// URL-length ceiling for the QR code: a QR code tops out at 2953 bytes
// (version 40, byte mode, error correction L), so unlike the copied link
// (Share.CHAR_BUDGET) the ceiling is a hard physical limit — kept slightly
// under capacity, and the track is simplified further when needed.
const QR_URL_BUDGET = 2800;

/** Open/close the share modal; reopening always lands on the choice view. */
function setShareModal(open) {
  $('#share-modal').hidden = !open;
  if (open) {
    setShareQrView(false);
    $('#share-link').focus();
  } else {
    $('#btn-share').focus();
  }
}

/** Swap the modal between the mode-choice view and the QR code view. */
function setShareQrView(on) {
  $('#share-choice').hidden = on;
  $('#share-qr-view').hidden = !on;
}

/**
 * Encode the current track into the hash and return the share URL.
 * Every share mode goes through this, so the address bar always carries
 * the full-quality link whatever mode was picked.
 */
async function makeShareUrl() {
  const res = await Share.encodeFit(state.route, shareWpts());
  state.shareCode = res.code;
  updateHash();
  return { ...res, url: location.origin + location.pathname + '#track=' + res.code };
}

/** Wrap a share action: guard on the route and disable the clicked button. */
function shareAction(btnSel, fn) {
  return async () => {
    if (!state.route) return;
    const btn = $(btnSel);
    btn.disabled = true;
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast(t('error.shareFailed'), 'error');
    } finally {
      btn.disabled = false;
    }
  };
}

/** "Copier le lien": encode into the hash and copy the URL. */
const shareCopyLink = shareAction('#share-link', async () => {
  const res = await makeShareUrl();
  setShareModal(false);
  if (await copyText(res.url)) {
    toast(
      res.simplified
        ? t('toast.shareCopiedSimplified', { n: res.points, total: res.total })
        : t('toast.shareCopied'),
      'ok'
    );
  } else {
    window.prompt(t('share.copyPrompt'), res.url);
  }
});

/** "QR code": render the share URL as a QR code inside the modal. */
const shareQr = shareAction('#share-qr', async () => {
  let res = await makeShareUrl();
  let url = res.url;
  if (url.length > QR_URL_BUDGET) {
    const prefix = location.origin + location.pathname + '#track=';
    res = await Share.encodeFit(state.route, shareWpts(), QR_URL_BUDGET - prefix.length);
    url = prefix + res.code;
  }
  // Integer scale keeps the modules crisp whatever the QR version; the CSS
  // sizes the canvas down/up to the modal width.
  const canvas = $('#share-qr-canvas');
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'L',
    margin: 2,
    scale: 4,
    color: { dark: '#0f1720', light: '#ffffff' },
  });
  // toCanvas pins the on-screen size with an inline style: clear it so the
  // stylesheet keeps the code inside the modal.
  canvas.style.width = '';
  canvas.style.height = '';
  const note = $('#share-qr-note');
  note.hidden = !res.simplified;
  if (res.simplified) {
    note.textContent = t('share.qrSimplified', { n: res.points, total: res.total });
  }
  setShareQrView(true);
  $('#share-qr-back').focus();
});

/**
 * "Envoyer le fichier GPX": hand the full-fidelity GPX (track + waypoints,
 * nothing simplified) to the OS share sheet through the Web Share API.
 * The option only shows on browsers that can share files (see wire()).
 */
const shareFile = shareAction('#share-file', async () => {
  const base = (state.route.name || 'mountaingpx').replace(/[^\w.-]+/g, '_');
  const file = new File([state.lastGpx], base + '_wpt.gpx', {
    type: 'application/gpx+xml',
  });
  try {
    await navigator.share({ files: [file], title: state.trackName || base });
  } catch (err) {
    if (err && err.name === 'AbortError') return; // user closed the OS sheet
    throw err;
  }
  setShareModal(false);
});

/**
 * "Ouvrir dans Garmin Connect": Garmin has no URL to open a remote course,
 * so the closest hand-off is downloading the TCX course (typed CoursePoints)
 * and opening Garmin Connect's import page for the user to drop it in.
 */
const shareGarmin = shareAction('#share-garmin', async () => {
  saveFile(state.lastTcx, 'tcx', 'application/vnd.garmin.tcx+xml');
  window.open('https://connect.garmin.com/modern/import-data', '_blank', 'noopener');
  setShareModal(false);
  toast(t('toast.garminExport'), 'ok');
});

/** Load a track shared through #track=… (fit unless a #map= view is set). */
async function loadSharedTrack(code, fit) {
  try {
    const route = await Share.decode(code);
    state.shareCode = code;
    loadRoute(route, route.name || t('share.defaultName'), fit);
  } catch (err) {
    console.warn('Shared track:', err.message || err);
    toast(t(err.code || 'error.shareInvalid'), 'error');
  }
}

function reverseRoute(route) {
  route.lat.reverse();
  route.lon.reverse();
  route.ele.reverse();
  // Reversed timestamps would decrease along the track: drop them.
  route.time = null;
  delete route._cum; // cumulative distances are direction-dependent
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
  // Refuse a broken custom snippet upfront with a targeted message: sent to
  // Overpass it would make the whole generation fail with a generic error.
  if (sel.custom && !Overpass.isValidCustomFilter(sel.custom)) {
    toast(t('error.customQueryInvalid'), 'error');
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
    state.pts = allPts(res.pts);
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
  state.pts = allPts(Overpass.snapElements(state.genElements, state.route, sel, limDist));
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
/** `action` ({ label, fn }) adds a button to the toast (e.g. undo). */
function toast(msg, kind, action) {
  const node = $('#toast');
  node.textContent = msg;
  if (action) {
    const btn = el('button', 'toast-action', escapeHtml(action.label));
    btn.type = 'button';
    btn.addEventListener('click', () => {
      node.classList.remove('show');
      action.fn();
    });
    node.appendChild(btn);
  }
  node.className = 'toast show ' + (kind || '') + (action ? ' actionable' : '');
  clearTimeout(toastTimer);
  // An actionable toast stays a bit longer: the user has a decision to make.
  toastTimer = setTimeout(() => node.classList.remove('show'), action ? 6000 : 3500);
}
function setBusy(b) {
  $('#btn-generate').disabled = b;
  $('#btn-generate').classList.toggle('loading', b);
  $('#overlay').classList.toggle('show', b);
}

// ---- Bulk selection helpers ------------------------------------------
// "Tout" / "Rien" toggle both columns (named and unnamed POIs).
function selectAll(checked) {
  document.querySelectorAll('#poi-list input[type=checkbox]').forEach((cb) => {
    cb.checked = checked;
  });
  onSelectionChanged();
}
function resetDefaults() {
  document.querySelectorAll('#poi-list input[type=checkbox]').forEach((cb) => {
    const defaults = cb.dataset.kind === 'with' ? DEFAULT_WITH_NAME : DEFAULT_NO_NAME;
    cb.checked = defaults.includes(cb.dataset.type);
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
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setMenu(false);
    setRoadbook(false);
    if (!$('#share-modal').hidden) setShareModal(false);
  });

  // Roadbook panel.
  $('#btn-roadbook').addEventListener('click', () =>
    setRoadbook(!$('#roadbook').classList.contains('open'))
  );
  $('#rb-close').addEventListener('click', () => setRoadbook(false));
  $('#rb-print').addEventListener('click', () => window.print());

  $('#btn-generate').addEventListener('click', generate);

  // Share modal: pick a mode (link / QR code / Garmin).
  $('#btn-share').addEventListener('click', () => state.route && setShareModal(true));
  $('#share-close').addEventListener('click', () => setShareModal(false));
  $('#share-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) setShareModal(false); // backdrop click
  });
  $('#share-link').addEventListener('click', shareCopyLink);
  $('#share-qr').addEventListener('click', shareQr);
  $('#share-garmin').addEventListener('click', shareGarmin);
  // Web Share with files (mostly mobile): reveal the option when supported.
  try {
    const probe = new File([''], 'probe.gpx', { type: 'application/gpx+xml' });
    $('#share-file').hidden =
      !(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch (_) {} // File constructor missing: keep the option hidden
  $('#share-file').addEventListener('click', shareFile);
  $('#share-qr-back').addEventListener('click', () => {
    setShareQrView(false);
    $('#share-qr').focus();
  });
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
      // The route arrays were reversed in place: remap the file and manual
      // waypoints' anchor indices (their coordinates are absolute).
      for (const p of [...state.fileWpts, ...state.userWpts]) {
        p.index = state.route.lat.length - 1 - p.index;
      }
      // The encoded track carries a direction: drop the now-stale link.
      if (state.shareCode) {
        state.shareCode = null;
        updateHash();
      }
      drawRoute();
      drawProfile();
      if (!refreshFromMemory()) {
        state.pts = allPts();
        syncWaypointUI();
      }
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
  $('#milestone-mode').addEventListener('change', () => {
    // Restore the newly selected mode's saved step before persisting.
    syncMilestoneStepInput();
    persistSelection();
    drawMilestones();
  });
  $('#milestone-step').addEventListener('change', () => {
    persistSelection();
    drawMilestones();
  });
  $('#sel-all-with').addEventListener('click', () => selectAll(true));
  $('#sel-none-with').addEventListener('click', () => selectAll(false));
  $('#btn-defaults').addEventListener('click', resetDefaults);

  $('#profile').addEventListener('mousemove', profileHover);
  $('#profile').addEventListener('mouseleave', profileLeave);
  // Touch: dragging a finger over the profile tracks the position on the
  // map exactly like the mouse hover (touch-action: none in the CSS).
  const profileTouch = (e) => {
    if (e.touches.length) profileHover(e.touches[0]);
  };
  $('#profile').addEventListener('touchstart', profileTouch, { passive: true });
  $('#profile').addEventListener('touchmove', profileTouch, { passive: true });
  $('#profile').addEventListener('touchend', profileLeave);
  $('#profile').addEventListener('touchcancel', profileLeave);
  // Hovering a waypoint dot on the profile lights up its map pin and
  // roadbook row. Delegated: the dots are re-rendered on every sync.
  $('#profile').addEventListener('mouseover', (e) => {
    const dot = e.target.closest && e.target.closest('#profile-wpts circle');
    if (!dot) return;
    const p = wptByKey(dot.dataset.wpt);
    if (p) setWptHighlight(p, true);
  });
  $('#profile').addEventListener('mouseout', (e) => {
    const dot = e.target.closest && e.target.closest('#profile-wpts circle');
    if (!dot) return;
    const p = wptByKey(dot.dataset.wpt);
    if (p) setWptHighlight(p, false);
  });
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

  // Track shared through the URL: decode it and load it like a local file.
  // When the hash also pins a #map= view, respect it instead of fitting.
  const h = parseHash(location.hash);
  if (h.track) loadSharedTrack(h.track, !h.view);
});
