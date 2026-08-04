/*
 * weather.js — live weather tile overlay, provider-agnostic.
 *
 * A weather source is described by a small *provider* object; the overlay
 * logic below knows nothing about RainViewer in particular. Swapping the
 * source (or adding a second one) means writing another descriptor here,
 * not touching the overlay logic nor app.js:
 *
 *   id           stable id (persistence / debugging)
 *   attribution  HTML credit line required by the source
 *   tile         Leaflet TileLayer options for its tiles
 *   indexUrl     optional JSON listing the available frames; omit it for a
 *                source whose tile URL is fixed (single frame)
 *   frames(json) turn that JSON (null when there is no indexUrl) into
 *                [{ time, url, forecast }], sorted oldest first, where `url`
 *                is a Leaflet {z}/{x}/{y} template and `time` is a timestamp
 *                in ms (null for a source that has no notion of frames)
 *   refreshMs    how often to reload the index while the overlay is visible
 *
 * The Leaflet pieces (layer group, tile layers) and the HTTP call are injected
 * by the caller, so everything here stays testable without a DOM.
 */

// RainViewer's public API: no key, no sign-up, worldwide precipitation radar
// with ~2 h of observed frames and ~30 min of nowcast. Free for
// non-commercial use, attribution required.
// https://www.rainviewer.com/api/weather-maps-api.html
const RAINVIEWER_HOST = /(^|\.)rainviewer\.com$/;

// Colour scheme 2 ("Universal Blue") with smoothing and the snow overlay on
// (`1_1`), which paints snow apart from rain — handy in the mountains.
const RAINVIEWER_TILE = { size: 256, color: 2, options: '1_1' };

// A missing tile has to stay invisible: Leaflet's default broken-image icon
// scattered over the map reads as a bug.
const BLANK_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

export const RAINVIEWER = {
  id: 'rainviewer',
  indexUrl: 'https://api.rainviewer.com/public/weather-maps.json',
  attribution:
    'Radar © <a href="https://www.rainviewer.com" target="_blank" rel="noopener">RainViewer</a>',
  tile: {
    opacity: 0.6,
    // The free radar tiles stop at zoom 7: past that the service answers with
    // a placeholder image instead of radar. Leaflet upscales the last real
    // tiles rather than asking for any, so the overlay stays visible (blurrier
    // as you zoom in) all the way to the base map's own limit. Radar data is
    // ~1 km per pixel anyway, so there is little detail to lose.
    maxNativeZoom: 7,
    maxZoom: 19,
    errorTileUrl: BLANK_TILE,
    // Above the base map and the other tile overlays, below the markers.
    zIndex: 400,
  },
  refreshMs: 5 * 60 * 1000,
  frames: rainviewerFrames,
};

/**
 * Frames of a RainViewer `weather-maps.json` payload: the observed radar
 * scans followed by the nowcast ones (flagged `forecast`).
 *
 * The tile host comes from the payload, so it is validated the same way as
 * any other remote URL we accept: https, and RainViewer's own domain.
 * Anything malformed yields no frame rather than a bogus tile URL.
 */
export function rainviewerFrames(json, opts = {}) {
  const { size, color, options } = { ...RAINVIEWER_TILE, ...opts };
  let host;
  try {
    const u = new URL(String(json && json.host));
    if (u.protocol !== 'https:' || !RAINVIEWER_HOST.test(u.hostname)) return [];
    host = u.origin;
  } catch (_) {
    return [];
  }

  const radar = (json && json.radar) || {};
  const out = [];
  for (const [kind, list] of [['past', radar.past], ['nowcast', radar.nowcast]]) {
    if (!Array.isArray(list)) continue;
    for (const f of list) {
      if (!f || !isFinite(f.time) || !/^\/[\w./-]+$/.test(String(f.path))) continue;
      out.push({
        time: Number(f.time) * 1000,
        forecast: kind === 'nowcast',
        url: `${host}${f.path}/${size}/{z}/{x}/{y}/${color}/${options}.png`,
      });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Index of the most recent observed frame, or the last one if all forecast. */
export function latestObserved(frames) {
  for (let i = frames.length - 1; i >= 0; i--) if (!frames[i].forecast) return i;
  return frames.length - 1;
}

/**
 * Wire the weather overlay behaviour onto `layer` and return a controller.
 * opts:
 *   map            Leaflet-like map: on(), hasLayer()
 *   layer          Leaflet-like layer group: clearLayers(), addLayer()
 *   provider       provider descriptor (see the header)
 *   fetchIndex(url)      async url -> parsed JSON
 *   makeTileLayer(frame, provider) -> Leaflet-like tile layer
 *   onError(err)   called when the frames cannot be loaded
 *
 * Frames are only loaded while the overlay is actually shown, and reloaded
 * every `provider.refreshMs` so a session left open keeps showing live data.
 * The controller exposes the frame list and `setFrame()` so a timeline UI can
 * be added later without touching any of this.
 */
export function createWeatherOverlay({
  map, layer, provider, fetchIndex, makeTileLayer, onError = () => {},
}) {
  let frames = [];
  let index = -1;
  let follow = true;      // stay on the latest observed frame across refreshes
  let painted = null;     // tile URL currently in the group
  let timer = null;
  let loading = false;

  const visible = () => map.hasLayer(layer);

  /** Drop the tiles of the previous frame and paint the current one. */
  function render() {
    const frame = frames[index];
    if (!visible() || !frame || frame.url === painted) return;
    layer.clearLayers();
    layer.addLayer(makeTileLayer(frame, provider));
    painted = frame.url;
  }

  /** Keep the user's frame across a refresh, or track the latest one. */
  function reselect(previousTime) {
    if (follow || previousTime == null) {
      index = latestObserved(frames);
      return;
    }
    let best = 0;
    for (let i = 1; i < frames.length; i++) {
      if (Math.abs(frames[i].time - previousTime) < Math.abs(frames[best].time - previousTime)) {
        best = i;
      }
    }
    index = best;
  }

  async function refresh() {
    if (loading) return;
    const previousTime = frames[index] ? frames[index].time : null;
    loading = true;
    try {
      const json = provider.indexUrl ? await fetchIndex(provider.indexUrl) : null;
      const next = provider.frames(json);
      if (!next.length) throw new Error('aucune image météo disponible');
      frames = next;
      reselect(previousTime);
      render();
    } catch (err) {
      onError(err);
    } finally {
      loading = false;
    }
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    layer.clearLayers();
    painted = null;
  }

  function schedule() {
    clearTimeout(timer);
    if (!provider.refreshMs) return;
    timer = setTimeout(() => {
      if (!visible()) return;
      refresh().then(schedule);
    }, provider.refreshMs);
  }

  map.on('overlayadd', (e) => {
    if (e.layer !== layer) return;
    refresh().then(schedule);
  });
  map.on('overlayremove', (e) => {
    if (e.layer === layer) stop();
  });

  return {
    layer,
    provider,
    /** Loaded frames, oldest first. */
    frames: () => frames,
    /** Index of the displayed frame (-1 before the first load). */
    current: () => index,
    /** Show frame `i`; from then on the overlay stops tracking the latest. */
    setFrame(i) {
      if (!frames.length) return;
      index = Math.max(0, Math.min(frames.length - 1, i));
      follow = index === latestObserved(frames);
      render();
    },
    /** Repaint the current frame (e.g. after a language change). */
    redraw() {
      painted = null;
      render();
    },
    refresh,
    stop,
  };
}
