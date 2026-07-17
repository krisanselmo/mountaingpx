/*
 * icons.js — dynamic SVG icons for POI types.
 * Glyphs are vendored from Lucide (https://lucide.dev, ISC license) plus a
 * few hand-drawn ones (saddle, cabin, waterfall, ford, cave, tunnel) that
 * Lucide does not provide. Rendered as inline SVG in the sidebar and as
 * colored Leaflet div-icon pins on the map — no image assets involved.
 */
import L from 'leaflet';

import { POI } from './poi.js';
// Inner markup of each 24x24 stroke glyph (the <svg> wrapper is built in svg()).
const GLYPHS = {
  // --- Lucide ---
  'bed-double': '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /> <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" /> <path d="M12 4v6" /> <path d="M2 18h20" />',
  'castle': '<path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z" /> <path d="M18 11V4H6v7" /> <path d="M15 22v-4a3 3 0 0 0-3-3a3 3 0 0 0-3 3v4" /> <path d="M22 11V9" /> <path d="M2 11V9" /> <path d="M6 4V2" /> <path d="M18 4V2" /> <path d="M10 4V2" /> <path d="M14 4V2" />',
  'church': '<path d="M10 9h4" /> <path d="M12 7v5" /> <path d="M14 22v-4a2 2 0 0 0-4 0v4" /> <path d="M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22" /> <path d="m18 7 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7" />',
  'compass': '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" /> <circle cx="12" cy="12" r="10" />',
  'droplet': '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />',
  'droplets': '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" /> <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />',
  'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /> <circle cx="12" cy="12" r="3" />',
  'fence': '<path d="M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" /> <path d="M6 8h4" /> <path d="M6 18h4" /> <path d="m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" /> <path d="M14 8h4" /> <path d="M14 18h4" /> <path d="m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z" />',
  'ferris-wheel': '<circle cx="12" cy="12" r="2" /> <path d="M12 2v4" /> <path d="m6.8 15-3.5 2" /> <path d="m20.7 7-3.5 2" /> <path d="M6.8 9 3.3 7" /> <path d="m20.7 17-3.5-2" /> <path d="m9 22 3-8 3 8" /> <path d="M8 22h8" /> <path d="M18 18.7a9 9 0 1 0-12 0" />',
  'flag': '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" />',
  'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />',
  'glass-water': '<path d="M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z" /> <path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0" />',
  'hotel': '<path d="M10 22v-6.57" /> <path d="M12 11h.01" /> <path d="M12 7h.01" /> <path d="M14 15.43V22" /> <path d="M15 16a5 5 0 0 0-6 0" /> <path d="M16 11h.01" /> <path d="M16 7h.01" /> <path d="M8 11h.01" /> <path d="M8 7h.01" /> <rect x="4" y="2" width="16" height="20" rx="2" />',
  'house': '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  'info': '<circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" />',
  'landmark': '<path d="M10 18v-7" /> <path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z" /> <path d="M14 18v-7" /> <path d="M18 18v-7" /> <path d="M3 22h18" /> <path d="M6 18v-7" />',
  'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /> <circle cx="12" cy="10" r="3" />',
  'mountain': '<path d="m8 3 4 8 5-5 5 15H2L8 3z" />',
  'signpost': '<path d="M12 13v8" /> <path d="M12 3v3" /> <path d="M18 6a2 2 0 0 1 1.387.56l2.307 2.22a1 1 0 0 1 0 1.44l-2.307 2.22A2 2 0 0 1 18 13H6a2 2 0 0 1-1.387-.56l-2.306-2.22a1 1 0 0 1 0-1.44l2.306-2.22A2 2 0 0 1 6 6z" />',
  'snowflake': '<path d="m10 20-1.25-2.5L6 18" /> <path d="M10 4 8.75 6.5 6 6" /> <path d="m14 20 1.25-2.5L18 18" /> <path d="m14 4 1.25 2.5L18 6" /> <path d="m17 21-3-6h-4" /> <path d="m17 3-3 6 1.5 3" /> <path d="M2 12h6.5L10 9" /> <path d="m20 10-1.5 2 1.5 2" /> <path d="M22 12h-6.5L14 15" /> <path d="m4 10 1.5 2L4 14" /> <path d="m7 21 3-6-1.5-3" /> <path d="m7 3 3 6h4" />',
  'telescope': '<path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" /> <path d="m13.56 11.747 4.332-.924" /> <path d="m16 21-3.105-6.21" /> <path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" /> <path d="m6.158 8.633 1.114 4.456" /> <path d="m8 21 3.105-6.21" /> <circle cx="12" cy="13" r="2" />',
  'tent': '<path d="M3.5 21 14 3" /> <path d="M20.5 21 10 3" /> <path d="M15.5 21 12 15l-3.5 6" /> <path d="M2 21h20" />',
  'toilet': '<path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18" /> <path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8" />',
  'tree-pine': '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z" /> <path d="M12 22v-3" />',
  'umbrella': '<path d="M22 12a10.06 10.06 1 0 0-20 0Z" /> <path d="M12 12v8a2 2 0 0 0 4 0" /> <path d="M12 2v1" />',
  'waves': '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /> <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /> <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />',
  // --- Hand-drawn (no Lucide equivalent) ---
  'saddle': '<path d="M2 19 7 8l3 5.5a2.3 2.3 0 0 0 4 0L17 8l5 11Z" />',
  'cabin': '<path d="M3 10 12 3l9 7" /> <path d="M5 8.5V20h14V8.5" /> <path d="M10 20v-5h4v5" />',
  'waterfall': '<path d="M5 4h14" /> <path d="M8 4v9" /> <path d="M12 4v9" /> <path d="M16 4v9" /> <path d="M3 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />',
  'ford': '<path d="M2 15c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /> <path d="M12 4v3" /> <path d="M12 10v3" /> <path d="M12 17v3" />',
  'cave': '<path d="M4 20v-7a8 8 0 0 1 16 0v7" /> <path d="M2 20h20" /> <path d="M12 20v-4" />',
  'tunnel': '<path d="M3 20v-6a9 9 0 0 1 18 0v6" /> <path d="M2 20h20" /> <path d="M12 13v1.5" /> <path d="M12 17v1.5" />',
};

// One color per sidebar group; used as the pin background on the map and
// as the glyph color in the sidebar.
export const GROUP_COLORS = {
  summits: '#d95f2b',
  shelter: '#7c5cd6',
  water: '#2f8fd0',
  landmark: '#0e9488',
  misc: '#64748b',
};
const FALLBACK_COLOR = '#64748b';

function colorFor(type) {
  const cfg = POI[type];
  return (cfg && GROUP_COLORS[cfg.group]) || FALLBACK_COLOR;
}

function glyphFor(type) {
  const cfg = POI[type];
  return GLYPHS[cfg && cfg.icon] || GLYPHS.info;
}

/** Full inline <svg> for a POI type (sidebar usage), colored by group. */
export function svgFor(type, size) {
  const s = size || 18;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${colorFor(type)}" aria-hidden="true">${glyphFor(type)}</svg>`;
}

function pinHtml(glyph, color) {
  return `<div class="poi-marker" style="--mc:${color}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></div>`;
}

const PIN_OPTS = {
  className: 'poi-pin',
  iconSize: [30, 30],
  iconAnchor: [15, 36],
  popupAnchor: [0, -40],
};

/** Leaflet div-icon pin for a POI type. */
export function markerIcon(type) {
  return L.divIcon(Object.assign({}, PIN_OPTS, {
    html: pinHtml(glyphFor(type), colorFor(type)),
  }));
}

/** Leaflet div-icon pin for the track start/end. */
export function flagIcon(kind) {
  return L.divIcon(Object.assign({}, PIN_OPTS, {
    html: pinHtml(GLYPHS.flag, kind === 'start' ? '#2e9e5b' : '#d33c3c'),
  }));
}

/** Small round dot for the "Points d'eau" overlay (shared instance). */
let waterDot = null;
export function waterDotIcon() {
  if (!waterDot) {
    waterDot = L.divIcon({
      className: 'water-dot',
      html: `<div class="water-dot-inner"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${GLYPHS.droplet}</svg></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
  }
  return waterDot;
}
