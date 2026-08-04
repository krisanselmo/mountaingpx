/*
 * roadbook.js — waypoint list sorted by distance along the track.
 * Renders the rows into a container element; icons, labels and behaviours
 * are injected by the caller so the module stays free of Leaflet and i18n
 * imports (and therefore unit-testable under Node).
 */
import { haversine } from './geometry.js';
import { escapeHtml } from './html.js';

/** Cumulative distance (km) at each route point, cached on the route. */
export function cumDistFor(route) {
  if (route._cum) return route._cum;
  const { lat, lon } = route;
  const d = [0];
  for (let i = 1; i < lat.length; i++) {
    d.push(d[i - 1] + haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]));
  }
  route._cum = d;
  return d;
}

function makeRow(doc) {
  const row = doc.createElement('button');
  row.className = 'rb-row';
  row.type = 'button';
  return row;
}

/**
 * Rebuild the roadbook rows inside `body`.
 * opts:
 *   iconSvg(p)        inline SVG for a waypoint row
 *   flagSvg(kind)     inline SVG for the start/end rows ('start'|'end')
 *   typeLabel(p)      translated POI type label, or '' to omit the line
 *   startLabel/endLabel  translated names of the start/end rows
 *   onFocus(p)        click on a waypoint row
 *   onHover(p, on)    hover/focus of a waypoint row
 *   onEndpoint(index) click on the start/end row (route point index)
 *   noteFor(p|'start'|'end')  optional { text, kind } badge (hydration…)
 */
export function render(body, route, pts, opts) {
  const doc = body.ownerDocument;
  const cum = cumDistFor(route);
  const sorted = [...pts].sort((a, b) => a.index - b.index);
  body.innerHTML = '';
  body.appendChild(endpointRow(doc, route, 'start', 0, cum, opts));
  for (const p of sorted) {
    const row = makeRow(doc);
    row.dataset.wpt = p.osmType + p.id;
    const typeLabel = opts.typeLabel(p);
    row.innerHTML =
      `<span class="rb-icon">${opts.iconSvg(p)}</span>` +
      `<span class="rb-main"><span class="rb-name">${escapeHtml(p.name)}</span>` +
      (typeLabel ? `<span class="rb-type">${escapeHtml(typeLabel)}</span>` : '') +
      noteHtml(opts, p) +
      `</span>` +
      `<span class="rb-meta"><b>${cum[p.index].toFixed(1)} km</b>` +
      (p.ele ? `<span>${Math.round(p.ele)} m</span>` : '') +
      `</span>`;
    row.addEventListener('click', () => opts.onFocus(p));
    // Mirror the hover onto the profile dot and the map pin (also on
    // keyboard focus).
    row.addEventListener('mouseenter', () => opts.onHover(p, true));
    row.addEventListener('mouseleave', () => opts.onHover(p, false));
    row.addEventListener('focus', () => opts.onHover(p, true));
    row.addEventListener('blur', () => opts.onHover(p, false));
    body.appendChild(row);
  }
  body.appendChild(endpointRow(doc, route, 'end', route.lat.length - 1, cum, opts));
}

/**
 * Optional badge under a row's name ("fill 0.8 L", "leave with 1 L"…).
 * `kind` becomes a modifier class so the caller can color it.
 */
function noteHtml(opts, subject) {
  const note = opts.noteFor && opts.noteFor(subject);
  if (!note || !note.text) return '';
  return `<span class="rb-note${note.kind ? ' ' + note.kind : ''}">${escapeHtml(note.text)}</span>`;
}

/** Start/end row of the roadbook (flags matching the map markers). */
function endpointRow(doc, route, kind, idx, cum, opts) {
  const row = makeRow(doc);
  const e = route.ele[idx];
  const label = kind === 'start' ? opts.startLabel : opts.endLabel;
  row.innerHTML =
    `<span class="rb-icon">${opts.flagSvg(kind)}</span>` +
    `<span class="rb-main"><span class="rb-name">${escapeHtml(label)}</span>` +
    noteHtml(opts, kind) +
    `</span>` +
    `<span class="rb-meta"><b>${cum[idx].toFixed(1)} km</b>` +
    (e ? `<span>${Math.round(e)} m</span>` : '') +
    `</span>`;
  row.addEventListener('click', () => opts.onEndpoint(idx));
  return row;
}
