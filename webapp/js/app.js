/*
 * app.js — Mountain GPX (browser edition)
 * Orchestrates the UI, the Leaflet map and the OSM waypoint pipeline.
 * 100% client-side: no server, no upload leaves the browser.
 */
(function () {
  'use strict';

  const { POI, GROUPS, DEFAULT_WITH_NAME, iconFor } = window.POIData;
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
      const head = el('tr', null, '<th></th><th title="POI nommés">Nommé</th><th title="POI sans nom">Sans&nbsp;nom</th>');
      table.appendChild(head);

      for (const [type, cfg] of (groups[gkey] || [])) {
        const tr = el('tr');
        const tdName = el('td', 'poi-name');
        tdName.innerHTML = `<img src="${iconFor(type)}" alt="" width="18" height="18" onerror="this.style.visibility='hidden'"> ${cfg.label}`;
        tr.appendChild(tdName);

        const tdWith = el('td');
        const cbWith = el('input');
        cbWith.type = 'checkbox';
        cbWith.dataset.type = type;
        cbWith.dataset.kind = 'with';
        cbWith.checked = savedWith.has(type);
        cbWith.addEventListener('change', persistSelection);
        tdWith.appendChild(cbWith);
        tr.appendChild(tdWith);

        const tdNo = el('td');
        if (cfg.noName) {
          const cbNo = el('input');
          cbNo.type = 'checkbox';
          cbNo.dataset.type = type;
          cbNo.dataset.kind = 'no';
          cbNo.checked = savedNo.has(type);
          cbNo.addEventListener('change', persistSelection);
          tdNo.appendChild(cbNo);
        }
        tr.appendChild(tdNo);
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
        { 'Sentiers (waymarked)': cycl }
      )
      .addTo(map);

    state.map = map;
    state.markerLayer = L.layerGroup().addTo(map);
  }

  function drawRoute() {
    const { lat, lon } = state.route;
    if (state.trackLayer) state.map.removeLayer(state.trackLayer);
    const coords = lat.map((la, i) => [la, lon[i]]);

    const line = L.polyline(coords, { color: '#e4572e', weight: 4, opacity: 0.9 });
    const mk = (file, ll, title) =>
      L.marker(ll, {
        title,
        icon: L.icon({ iconUrl: '../static/img/markers/' + file, iconSize: [24, 24], iconAnchor: [12, 24] }),
      });

    // Group the polyline and the start/end markers so they toggle together.
    state.trackLayer = L.featureGroup([
      line,
      mk('start.png', coords[0], 'Départ'),
      mk('end.png', coords[coords.length - 1], 'Arrivée'),
    ]).addTo(state.map);

    state.map.fitBounds(line.getBounds(), { padding: [30, 30] });
  }

  function drawWaypoints() {
    state.markerLayer.clearLayers();
    for (const p of state.pts) {
      const marker = L.marker([p.lat, p.lon], {
        title: p.name,
        icon: L.icon({
          iconUrl: iconFor(p.queryName),
          iconSize: [26, 26],
          iconAnchor: [13, 26],
          popupAnchor: [0, -24],
        }),
      });
      const ele = p.ele ? ` — ${Math.round(p.ele)} m` : '';
      marker.bindPopup(
        `<div class="wpt-popup"><h3>${escapeHtml(p.name)}${ele}</h3>${p.description}</div>`
      );
      marker.addTo(state.markerLayer);
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      dist.push(dist[i - 1] + window.Geometry.haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]));
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
      `<text x="${x(total) - 30}" y="${H - 4}" class="ax">${total.toFixed(1)} km</text>`;

    const dplus = ele.reduce((a, e, i) => (i && e > ele[i - 1] ? a + (e - ele[i - 1]) : a), 0);
    $('#stat-dist').textContent = total.toFixed(1) + ' km';
    $('#stat-dplus').textContent = '+' + Math.round(dplus) + ' m';
    $('#stat-alt').textContent = Math.round(maxE) + ' m';
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
        const route = window.GPX.parse(reader.result);
        if (loadSettings().reverse || $('#reverse').checked) reverseRoute(route);
        state.route = route;
        state.pts = [];
        state.lastGpx = null;
        state.markerLayer.clearLayers();
        drawRoute();
        drawProfile();
        $('#track-name').textContent = route.name || file.name;
        $('#empty-hint').style.display = 'none';
        $('#toolbar').classList.add('active');
        $('#btn-download').disabled = true;
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
    const limDist = parseInt($('#snap-dist').value, 10) / 1000; // m -> km

    setBusy(true);
    try {
      const res = await window.Overpass.findWaypoints(state.route, sel, limDist);
      if (res.empty) {
        toast('Sélectionnez au moins un type de POI', 'error');
        return;
      }
      state.pts = res.pts;
      drawWaypoints();
      state.lastGpx = window.GPX.build(state.route, state.pts, true);
      $('#btn-download').disabled = state.pts.length === 0;
      $('#stat-wpt').textContent = state.pts.length;
      toast(`${res.count} waypoint(s) accroché(s) à la trace`, res.count ? 'ok' : 'warn');
    } catch (err) {
      console.error(err);
      toast('Overpass : ' + (err.message || 'échec de la requête'), 'error');
    } finally {
      setBusy(false);
    }
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
    persistSelection();
  }
  function resetDefaults() {
    document.querySelectorAll('#poi-list input[type=checkbox]').forEach((cb) => {
      cb.checked = cb.dataset.kind === 'with' && DEFAULT_WITH_NAME.includes(cb.dataset.type);
    });
    persistSelection();
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

    $('#btn-generate').addEventListener('click', generate);
    $('#btn-download').addEventListener('click', download);
    $('#overpass-custom').addEventListener('change', persistSelection);
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
      }
    });
    $('#snap-dist').addEventListener('input', (e) => {
      $('#snap-dist-val').textContent = e.target.value + ' m';
    });
    $('#snap-dist').addEventListener('change', persistSelection);
    $('#sel-all-with').addEventListener('click', () => selectAll('with', true));
    $('#sel-none-with').addEventListener('click', () => selectAll('with', false));
    $('#btn-defaults').addEventListener('click', resetDefaults);

    window.addEventListener('resize', () => state.route && drawProfile());
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    buildPoiPanel();
    wire();
  });
})();
