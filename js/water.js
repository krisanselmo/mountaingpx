/*
 * water.js — "Points d'eau" on-demand map overlay.
 * No public tile overlay exists for water points, so this one is built from
 * Overpass on the fly: it loads the water POIs of the visible area when the
 * overlay is enabled, with an area cap to keep the queries small.
 *
 * The Leaflet pieces (layer group, markers) and the Overpass runner are
 * injected by the caller, keeping the caching/visibility logic testable.
 */
export const WATER_FILTERS = [
  'node["amenity"="drinking_water"]',
  'node["amenity"="water_point"]',
  'node["man_made"="water_tap"]',
  'node["amenity"="fountain"]',
  'node["natural"="spring"]',
];

// Area cap instead of a zoom floor: the same zoom level covers wildly
// different areas depending on the screen size.
export const WATER_MAX_AREA_KM2 = 1000;

/** Approximate area (km²) of a Leaflet-like LatLngBounds. */
export function boundsAreaKm2(b) {
  const midLat = (b.getNorth() + b.getSouth()) / 2;
  return (b.getNorth() - b.getSouth()) * 111.32 *
    (b.getEast() - b.getWest()) * 111.32 * Math.cos((midLat * Math.PI) / 180);
}

/**
 * Wire the water overlay behaviour onto `layer` and return it.
 * opts:
 *   map          Leaflet-like map: on(), hasLayer(), getBounds()
 *   layer        Leaflet-like layer group: clearLayers()
 *   fetchWater(box)   async "south,west,north,east" -> OSM elements
 *   makeMarker(el)    node element -> marker with addTo(layer)
 *   onTooWide()  called when the overlay is enabled on a too-wide view
 *   debounceMs   settle delay after a map move (default 600)
 */
export function createWaterOverlay({ map, layer, fetchWater, makeMarker, onTooWide, debounceMs = 600 }) {
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
      const elements = await fetchWater(box);
      fetchedBounds = padded;
      for (const el of elements) {
        const key = el.type + el.id;
        if (el.type !== 'node' || seen.has(key)) continue;
        seen.add(key);
        const marker = makeMarker(el);
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
    timer = setTimeout(refresh, debounceMs);
  };
  map.on('moveend', () => {
    updateVisibility();
    schedule();
  });
  map.on('overlayadd', (e) => {
    if (e.layer !== layer) return;
    if (boundsAreaKm2(map.getBounds()) > WATER_MAX_AREA_KM2) {
      onTooWide();
    } else {
      refresh();
    }
  });
  return layer;
}
