/*
 * hydration.js — hydration and resupply planning along a track.
 *
 * On a long trail outing the question is never "where is the water" but
 * "how far is the next one, and do I carry enough to get there". This module
 * turns the waypoints already snapped on the route into that answer: the
 * water sources are the stops, the track between two stops is a leg, and a
 * leg is a problem when the drink it costs exceeds what fits in the flasks.
 *
 * Pure computation — no DOM, no Leaflet, no i18n: the rendering lives in
 * app.js / profile.js / roadbook.js, so the model stays unit-testable.
 */
import { haversine } from './geometry.js';

/*
 * Effort model. Trail runners reason in "km-effort" (kilomètres-effort):
 * 100 m of climb costs roughly the same as 1 km on the flat. Duration then
 * comes from a single pace figure, and the drink from a single rate — two
 * numbers a runner already knows about themselves.
 */
export function effortKm(km, dplus) {
  return km + (dplus > 0 ? dplus : 0) / 100;
}

// Sweat rate multiplier. Heat is what turns a comfortable 500 mL/h into the
// litre-per-hour that empties the flasks halfway up the climb.
export const HEAT_FACTORS = {
  cool: 0.8,
  temperate: 1,
  hot: 1.3,
  scorching: 1.6,
};

// Rough energy cost of an hour of trail effort, for the resupply hint. An
// order of magnitude, not a nutrition plan.
export const KCAL_PER_HOUR = 300;

export const DEFAULTS = {
  // Off until asked for: the plan annotates the profile and the roadbook,
  // which most outings do not need.
  enabled: false,
  intake: 500,        // mL/h drunk in temperate conditions
  capacity: 1000,     // mL carried at once (flasks + bladder)
  speed: 5,           // km-effort per hour
  heat: 'temperate',  // key of HEAT_FACTORS
  sources: 'hut',     // key of SOURCE_SETS
};

/*
 * What counts as a place to fill up, by how much it can be relied on:
 *   tap     — treated water, drink as is
 *   hut     — staffed place: water, and usually food (the "ravito")
 *   natural — spring, stream, lake: there, but to be filtered — and an
 *             unstaffed hut, which promises no more than that
 */
export const SOURCE_KINDS = {
  drinking_water: 'tap',
  fountain: 'tap',
  alpine_hut: 'hut',
  hostel: 'hut',
  hotel: 'hut',
  camp_site: 'hut',
  wilderness_hut: 'natural',
  spring: 'natural',
  waterfall: 'natural',
  lake: 'natural',
  ford: 'natural',
};

// Selectable trust levels, from the strictest to the most optimistic.
export const SOURCE_SETS = {
  tap: ['tap'],
  hut: ['tap', 'hut'],
  all: ['tap', 'hut', 'natural'],
};

/*
 * Plain-language landmarks for the three figures the panel asks for. "5
 * km-effort/h" means nothing to someone who has never counted in km-effort;
 * "randonnée" does. The UI shows the band name next to the value, so the
 * slider can be dragged until the label reads like the outing planned.
 * Labels come from i18n (`hydration.<scale>.<key>`).
 */
export const INTAKE_BANDS = [       // mL/h in temperate conditions
  { upTo: 350, key: 'low' },
  { upTo: 650, key: 'usual' },
  { upTo: 850, key: 'high' },
  { upTo: Infinity, key: 'veryHigh' },
];

export const PACE_BANDS = [         // km-effort per hour
  { upTo: 3.5, key: 'stroll' },
  { upTo: 5, key: 'hike' },
  { upTo: 6.5, key: 'fastHike' },
  { upTo: 8.5, key: 'trail' },
  { upTo: 10.5, key: 'fastTrail' },
  { upTo: Infinity, key: 'race' },
];

export const CAPACITY_BANDS = [     // mL carried
  { upTo: 600, key: 'oneFlask' },
  { upTo: 1200, key: 'twoFlasks' },
  { upTo: 2200, key: 'bladder' },
  { upTo: Infinity, key: 'big' },
];

/** Band key a value falls into (see INTAKE_BANDS & co). */
export function bandFor(bands, value) {
  const b = bands.find((x) => value <= x.upTo);
  return (b || bands[bands.length - 1]).key;
}

// Two sources within this distance are the same stop (a fountain next to a
// hut must not produce a 30 m leg of its own).
const MERGE_KM = 0.2;

/**
 * Cumulative distance (km) and cumulative positive gain (m) at each route
 * point. Not cached on the route: the plan is recomputed on every waypoint
 * change, and a stale cache after a reversal costs more than the walk.
 */
export function cumulative(route) {
  const { lat, lon, ele } = route;
  const dist = [0];
  const gain = [0];
  for (let i = 1; i < lat.length; i++) {
    dist.push(dist[i - 1] + haversine(lon[i - 1], lat[i - 1], lon[i], lat[i]));
    const de = (ele[i] || 0) - (ele[i - 1] || 0);
    gain.push(gain[i - 1] + (de > 0 ? de : 0));
  }
  return { dist, gain };
}

/** Water-source kind of a waypoint, or null when it is not one. */
export function sourceKind(p) {
  return (p && SOURCE_KINDS[p.queryName]) || null;
}

/**
 * Stops along the route: the start, every water source of the selected
 * kinds sorted by position, and the finish. Sources sitting on the very
 * first/last route point, or right next to the previous one, are merged
 * into their neighbour.
 */
export function stopsAlong(route, pts, opts = {}) {
  const kinds = SOURCE_SETS[opts.sources] || SOURCE_SETS[DEFAULTS.sources];
  const { dist } = opts.cum || cumulative(route);
  const last = route.lat.length - 1;

  const out = [{ index: 0, km: 0, kind: 'start', p: null }];
  const sources = (pts || [])
    .filter((p) => {
      const kind = sourceKind(p);
      return kind && kinds.includes(kind) && p.index > 0 && p.index < last;
    })
    .sort((a, b) => a.index - b.index);

  for (const p of sources) {
    const km = dist[p.index];
    if (km - out[out.length - 1].km < MERGE_KM) continue;
    out.push({ index: p.index, km, kind: sourceKind(p), p });
  }
  // The finish always closes the last leg, however close the last source is.
  out.push({ index: last, km: dist[last], kind: 'end', p: null });
  return out;
}

/** Stable key of a stop, matching the waypoint keys used across the UI. */
export function stopKey(stop) {
  if (stop.kind === 'start') return 'start';
  if (stop.kind === 'end') return 'end';
  return stop.p.osmType + stop.p.id;
}

/**
 * Build the hydration plan of a route.
 *
 * Returns null when there is nothing to plan (no route, or a route without
 * two points). Otherwise:
 *   { rate, speed, capacity, totalKm, totalDplus, hours, needMl, kcal,
 *     legs[], stops[], legFrom: Map(stopKey -> leg), driest, riskyLegs,
 *     sourceCount }
 * A leg is `ok: false` when the water it costs does not fit in the flasks.
 * Flasks get topped up at every source anyway, so that flag — not a refill
 * volume — is what the roadbook and the profile show.
 */
export function buildPlan(route, pts, opts = {}) {
  if (!route || !route.lat || route.lat.length < 2) return null;
  const o = { ...DEFAULTS, ...opts };
  const rate = Math.max(0, o.intake) * (HEAT_FACTORS[o.heat] || 1); // mL/h
  const speed = o.speed > 0 ? o.speed : DEFAULTS.speed;             // km-eff/h
  const capacity = o.capacity > 0 ? o.capacity : DEFAULTS.capacity; // mL

  const cum = cumulative(route);
  const stops = stopsAlong(route, pts, { ...o, cum });
  const legs = [];
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1];
    const to = stops[i];
    const km = to.km - from.km;
    const dplus = cum.gain[to.index] - cum.gain[from.index];
    const hours = effortKm(km, dplus) / speed;
    const needMl = Math.round(hours * rate);
    legs.push({
      from, to, km, dplus, hours, needMl,
      shortMl: Math.max(0, needMl - capacity),
      ok: needMl <= capacity,
    });
  }

  // Leg starting at each stop, so a roadbook row can tell what lies ahead.
  const legFrom = new Map(legs.map((l) => [stopKey(l.from), l]));

  const totalKm = cum.dist[cum.dist.length - 1];
  const totalDplus = cum.gain[cum.gain.length - 1];
  const hours = effortKm(totalKm, totalDplus) / speed;
  const driest = legs.reduce((a, l) => (a && a.needMl >= l.needMl ? a : l), null);

  return {
    rate,
    speed,
    capacity,
    totalKm,
    totalDplus,
    hours,
    needMl: legs.reduce((a, l) => a + l.needMl, 0),
    kcal: Math.round(hours * KCAL_PER_HOUR),
    legs,
    stops,
    legFrom,
    driest,
    riskyLegs: legs.filter((l) => !l.ok),
    sourceCount: stops.length - 2,
  };
}

// ---- Display helpers (shared by the panel, the roadbook and the profile) --
/** mL -> compact litre string ("0.75 L", "2.4 L"). */
export function formatLiters(ml) {
  const l = (ml || 0) / 1000;
  return (l < 1 ? l.toFixed(2).replace(/0$/, '') : l.toFixed(1)) + ' L';
}

/** Hours -> "4 h 45" / "45 min". */
export function formatDuration(hours) {
  const mins = Math.round((hours || 0) * 60);
  if (mins < 60) return mins + ' min';
  return Math.floor(mins / 60) + ' h ' + String(mins % 60).padStart(2, '0');
}
