/*
 * customlayers.js — user-defined tile layers (extra base maps and overlays).
 * Definitions are plain data, validated and persisted here; app.js turns them
 * into Leaflet layers.
 */

export const LS_KEY = 'mountaingpx.customLayers.v1';

// Keeps the stored list — and the layers control — manageable.
export const MAX_LAYERS = 12;

// Loopback hosts: browsers treat them as trustworthy, so their http tiles are
// not blocked as mixed content — a local tile server is fair game.
const LOOPBACK = /^(localhost|127(?:\.\d+){3}|\[::1\])$/i;

// Applied when the definition leaves a field empty. `maxNativeZoom` has no
// default: without it Leaflet stops at `maxZoom` instead of upscaling.
export const DEFAULTS = { minZoom: 0, maxZoom: 19, baseOpacity: 1, overlayOpacity: 0.7 };

const MAX_ZOOM_LEVEL = 24;

/** Stable id of a custom layer, used by the layer-selection persistence. */
export function keyFor(name) {
  return 'custom:' + name;
}

/** Optional zoom level; an empty field means "not set". */
function optZoom(raw) {
  if (raw == null || String(raw).trim() === '') return {};
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > MAX_ZOOM_LEVEL) return { error: 'error.layerZoom' };
  return { value: n };
}

/** Optional opacity in (0, 1]; an empty field means "not set". */
function optOpacity(raw) {
  if (raw == null || String(raw).trim() === '') return {};
  const n = Number(raw);
  if (!isFinite(n) || n <= 0 || n > 1) return { error: 'error.layerOpacity' };
  return { value: n };
}

/**
 * Check a user-entered definition against the names already in use (built-in
 * layers included). Returns `{ def }` when usable, `{ error }` otherwise,
 * where `error` is the i18n key to report.
 */
export function validate(input, taken = []) {
  const name = String(input.name || '').trim();
  // Not `new URL().href`: that percent-encodes the {z}/{x}/{y} braces.
  const url = String(input.url || '').trim();

  if (!name) return { error: 'error.layerName' };
  if (taken.some((n) => n.toLowerCase() === name.toLowerCase())) {
    return { error: 'error.layerDuplicate' };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return { error: 'error.layerUrl' };
  }
  // The app is served over TLS: http tiles would be blocked as mixed content,
  // except from a loopback host.
  if (parsed.protocol !== 'https:'
    && !(parsed.protocol === 'http:' && LOOPBACK.test(parsed.hostname))) {
    return { error: 'error.layerScheme' };
  }
  if (!/\{z\}/.test(url) || !/\{x\}/.test(url) || !/\{-?y\}/.test(url)) {
    return { error: 'error.layerTemplate' };
  }

  const minZoom = optZoom(input.minZoom);
  const maxZoom = optZoom(input.maxZoom);
  const maxNativeZoom = optZoom(input.maxNativeZoom);
  const opacity = optOpacity(input.opacity);
  const bad = [minZoom, maxZoom, maxNativeZoom, opacity].find((f) => f.error);
  if (bad) return { error: bad.error };

  // Compare against the effective levels: an omitted bound keeps its default.
  const lo = minZoom.value ?? DEFAULTS.minZoom;
  const hi = maxZoom.value ?? DEFAULTS.maxZoom;
  if (lo > hi) return { error: 'error.layerZoom' };
  if (maxNativeZoom.value != null
    && (maxNativeZoom.value < lo || maxNativeZoom.value > hi)) {
    return { error: 'error.layerZoom' };
  }

  const def = { name, url, overlay: !!input.overlay };
  // Only the fields the user actually set are carried around and stored.
  for (const [k, f] of [
    ['minZoom', minZoom], ['maxZoom', maxZoom],
    ['maxNativeZoom', maxNativeZoom], ['opacity', opacity],
  ]) {
    if (f.value != null) def[k] = f.value;
  }
  return { def };
}

/**
 * Read the stored definitions, dropping whatever no longer validates
 * (hand-edited storage, name now taken by a built-in layer…).
 */
export function load(storage, taken = []) {
  let raw;
  try {
    raw = JSON.parse(storage.getItem(LS_KEY));
  } catch (_) {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const out = [];
  const seen = [...taken];
  for (const item of raw) {
    const { def } = validate(item || {}, seen);
    if (!def) continue;
    out.push(def);
    seen.push(def.name);
    if (out.length >= MAX_LAYERS) break;
  }
  return out;
}

export function save(storage, defs) {
  try {
    storage.setItem(LS_KEY, JSON.stringify(defs.map(toDef)));
  } catch (_) {}
}

/** Strip a runtime entry (Leaflet layer, key…) down to its definition. */
export function toDef(entry) {
  const def = { name: entry.name, url: entry.url, overlay: !!entry.overlay };
  for (const k of ['minZoom', 'maxZoom', 'maxNativeZoom', 'opacity']) {
    if (entry[k] != null) def[k] = entry[k];
  }
  return def;
}
