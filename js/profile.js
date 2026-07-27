/*
 * profile.js — lightweight SVG elevation profile.
 * Pure DOM/SVG rendering, no Leaflet dependency: the map-side reactions
 * (hover marker, waypoint highlight…) stay in app.js and are driven through
 * the geometry object returned by render().
 */
import { haversine } from './geometry.js';
import { escapeHtml } from './html.js';

const HEIGHT = 120;
const PAD = { l: 40, r: 10, t: 10, b: 20 };

/**
 * Draw the elevation profile of `route` into the `svg` element.
 * Returns the profile geometry { dist[], total, W, pad, cx(i), cy(i),
 * minE, maxE, dplus }, or null when the route has no elevation data
 * (an explanatory `noElevationText` is rendered instead).
 */
export function render(svg, route, { width, noElevationText } = {}) {
  const { lat, lon, ele } = route;
  if (!ele.some((e) => e > 0)) {
    svg.innerHTML = `<text x="12" y="24" fill="#889">${escapeHtml(noElevationText || '')}</text>`;
    return null;
  }

  // Cumulative distance.
  const dist = [0];
  for (let i = 1; i < lat.length; i++) {
    dist.push(dist[i - 1] + haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]));
  }
  const total = dist[dist.length - 1] || 1;
  const W = width || svg.clientWidth || 600;
  const H = HEIGHT;
  const pad = PAD;
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

  const dplus = ele.reduce((a, e, i) => (i && e > ele[i - 1] ? a + (e - ele[i - 1]) : a), 0);

  return {
    dist, total, W, H, pad, minE, maxE, dplus,
    cx: (i) => x(dist[i]),
    cy: (i) => y(ele[i] || minE),
    xKm: (km) => x(Math.min(Math.max(km, 0), total)),
  };
}

/**
 * Hydration layer: the stretches where the water needed does not fit in the
 * flasks are shaded, and every water source gets a tick. Drawn under the
 * waypoint dots so the pins stay readable on top.
 * `plan` comes from hydration.js (null clears the layer).
 */
export function renderHydration(svg, profile, plan, { warnLabel } = {}) {
  const old = svg.querySelector('#profile-hydration');
  if (old) old.remove();
  const cursor = svg.querySelector('#profile-cursor');
  if (!profile || !cursor || !plan) return;

  const top = profile.pad.t;
  const bottom = profile.H - profile.pad.b;
  let html = '<g id="profile-hydration">';
  for (const leg of plan.riskyLegs) {
    const x1 = profile.xKm(leg.from.km);
    const x2 = profile.xKm(leg.to.km);
    html += `<rect class="hyd-band" x="${x1}" y="${top}" width="${Math.max(1, x2 - x1)}" height="${bottom - top}">` +
      (warnLabel ? `<title>${escapeHtml(warnLabel)}</title>` : '') +
      '</rect>';
  }
  for (const stop of plan.stops) {
    if (stop.kind === 'start' || stop.kind === 'end') continue;
    const x = profile.xKm(stop.km);
    html += `<line class="hyd-tick" x1="${x}" x2="${x}" y1="${top}" y2="${bottom}"/>` +
      `<circle class="hyd-tick-dot" cx="${x}" cy="${top + 3}" r="2.5"/>`;
  }
  html += '</g>';
  // Below the waypoint dots (inserted before them, and before the cursor).
  const wpts = svg.querySelector('#profile-wpts');
  (wpts || cursor).insertAdjacentHTML('beforebegin', html);
}

/**
 * Draw the snapped waypoints as colored dots on the elevation curve.
 * `colorFor(queryName)` maps a POI type to its group color (injected so
 * this module needs no icon/Leaflet import).
 */
export function renderWaypoints(svg, profile, pts, { show = true, colorFor } = {}) {
  const old = svg.querySelector('#profile-wpts');
  if (old) old.remove();
  const cursor = svg.querySelector('#profile-cursor');
  if (!profile || !cursor || !pts.length) return;

  let html = `<g id="profile-wpts"${show ? '' : ' style="display:none"'}>`;
  for (const w of pts) {
    const color = (colorFor && colorFor(w.queryName)) || '#64748b';
    const alt = w.ele ? ` — ${Math.round(w.ele)} m` : '';
    // data-wpt links the dot to its roadbook row (hover highlight).
    html += `<circle data-wpt="${w.osmType}${w.id}" cx="${profile.cx(w.index)}" cy="${profile.cy(w.index)}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5">` +
      `<title>${escapeHtml(w.name)}${alt}</title></circle>`;
  }
  html += '</g>';
  // Insert below the hover cursor so the cursor stays readable on top.
  cursor.insertAdjacentHTML('beforebegin', html);
}

/**
 * Route index under the viewBox abscissa `px`, or null when outside the
 * plotted range. Binary search on the (sorted) cumulative distances.
 */
export function indexAt(profile, px) {
  const dTarget = ((px - profile.pad.l) / (profile.W - profile.pad.l - profile.pad.r)) * profile.total;
  if (dTarget < 0 || dTarget > profile.total) return null;
  let lo = 0;
  let hi = profile.dist.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (profile.dist[mid] < dTarget) lo = mid + 1; else hi = mid;
  }
  return lo;
}

/** Highlight (or reset) a waypoint's dot, addressed by its "osmType+id" key. */
export function setDotHighlight(svg, key, on) {
  const dot = svg.querySelector(`#profile-wpts circle[data-wpt="${key}"]`);
  if (!dot) return;
  dot.setAttribute('r', on ? 6.5 : 4);
  dot.setAttribute('stroke-width', on ? 2.5 : 1.5);
  // Bring the highlighted dot above its neighbours (SVG paints in order).
  if (on) dot.parentNode.appendChild(dot);
}
