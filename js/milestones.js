/*
 * milestones.js — regular markers along the track, by distance or by
 * cumulative elevation gain. Pure geometry: the Leaflet rendering lives
 * in app.js.
 */
import { haversine } from './geometry.js';

// Safety cap: an absurdly small interval on a very long track must not
// freeze the map under thousands of DOM markers.
const MAX_MARKERS = 300;

/**
 * Compute the milestone positions of a route.
 *  - mode 'dist': one marker every `interval` km, interpolated on the
 *    segment where the threshold is crossed; value in km.
 *  - mode 'ele' : one marker every `interval` m of cumulative D+, placed on
 *    the route point where the gain is reached; value in m.
 * Returns [{ lat, lon, value }].
 */
export function computeMilestones(route, mode, interval) {
  if (!route || !(interval > 0)) return [];
  const { lat, lon, ele } = route;
  const out = [];

  if (mode === 'dist') {
    let cum = 0;
    let next = interval;
    for (let i = 1; i < lat.length && out.length < MAX_MARKERS; i++) {
      const d = haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]);
      while (d > 0 && cum + d >= next && out.length < MAX_MARKERS) {
        const f = (next - cum) / d;
        out.push({
          lat: lat[i - 1] + (lat[i] - lat[i - 1]) * f,
          lon: lon[i - 1] + (lon[i] - lon[i - 1]) * f,
          value: next,
        });
        next += interval;
      }
      cum += d;
    }
  } else if (mode === 'ele') {
    let gain = 0;
    let next = interval;
    for (let i = 1; i < lat.length && out.length < MAX_MARKERS; i++) {
      const de = ele[i] - ele[i - 1];
      if (de > 0) gain += de;
      while (gain >= next && out.length < MAX_MARKERS) {
        out.push({ lat: lat[i], lon: lon[i], value: next });
        next += interval;
      }
    }
  }
  return out;
}
