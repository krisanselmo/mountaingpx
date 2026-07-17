/*
 * poi.js — Points of interest catalog.
 * Merges the Overpass query dictionaries and the waypoint-type detection
 * logic from wpts/osm.py. Human-readable labels are NOT stored here: they
 * are resolved through i18n (keys `poi.<type>` and `group.<key>`).
 */
/*
 * Each POI type maps to:
 *  - icon  : glyph name in icons.js (Lucide or hand-drawn)
 *  - node  : Overpass node filter (or null)
 *  - way   : Overpass way filter (or null)
 *  - noName: whether a "without name" query variant is offered in the UI
 *  - group : sidebar grouping
 */
export const POI = {
  peak:          { icon: 'mountain',     node: 'node["natural"="peak"]', way: null, noName: true, group: 'summits' },
  saddle:        { icon: 'saddle',       node: 'node["natural"="saddle"]', way: null, noName: true, group: 'summits' },
  volcano:       { icon: 'flame',        node: 'node["natural"="volcano"]', way: null, noName: true, group: 'summits' },
  viewpoint:     { icon: 'eye',          node: 'node["tourism"="viewpoint"]["map_type"!="toposcope"]', way: null, noName: true, group: 'summits' },
  toposcope:     { icon: 'compass',      node: 'node["map_type"="toposcope"]', way: null, noName: true, group: 'summits' },
  attraction:    { icon: 'ferris-wheel', node: 'node["tourism"="attraction"]', way: null, noName: true, group: 'summits' },

  alpine_hut:    { icon: 'house',        node: 'node["tourism"="alpine_hut"]', way: 'way["tourism"="alpine_hut"]', noName: true, group: 'shelter' },
  wilderness_hut:{ icon: 'cabin',        node: 'node["tourism"="wilderness_hut"]', way: 'way["tourism"="wilderness_hut"]', noName: true, group: 'shelter' },
  shelter:       { icon: 'umbrella',     node: 'node["amenity"="shelter"]', way: 'way["amenity"="shelter"]', noName: true, group: 'shelter' },
  camp_site:     { icon: 'tent',         node: 'node["tourism"="camp_site"]', way: 'way["tourism"="camp_site"]', noName: true, group: 'shelter' },
  hostel:        { icon: 'bed-double',   node: 'node["tourism"="hostel"]', way: 'way["tourism"="hostel"]', noName: true, group: 'shelter' },
  hotel:         { icon: 'hotel',        node: 'node["tourism"="hotel"]', way: 'way["tourism"="hotel"]', noName: true, group: 'shelter' },

  drinking_water:{ icon: 'glass-water',  node: 'node["amenity"="drinking_water"]', way: null, noName: true, group: 'water' },
  fountain:      { icon: 'droplets',     node: 'node["amenity"="fountain"]', way: null, noName: true, group: 'water' },
  spring:        { icon: 'droplet',      node: 'node["natural"="spring"]', way: null, noName: true, group: 'water' },
  waterfall:     { icon: 'waterfall',    node: 'node["waterway"="waterfall"]', way: null, noName: true, group: 'water' },
  lake:          { icon: 'waves',        node: null, way: 'way["water"="lake"]', noName: true, group: 'water' },
  glacier:       { icon: 'snowflake',    node: null, way: 'way["natural"="glacier"]', noName: true, group: 'water' },
  ford:          { icon: 'ford',         node: 'node["ford"="yes"]', way: null, noName: true, group: 'water' },

  guidepost:     { icon: 'signpost',     node: 'node["information"="guidepost"]', way: null, noName: true, group: 'landmark' },
  cave_entrance: { icon: 'cave',         node: 'node["natural"="cave_entrance"]', way: null, noName: true, group: 'landmark' },
  chapel:        { icon: 'church',       node: 'node["building"="chapel"]', way: 'way["building"="chapel"]', noName: true, group: 'landmark' },
  castle:        { icon: 'castle',       node: 'node["historic"="castle"]', way: null, noName: true, group: 'landmark' },
  ruins:         { icon: 'landmark',     node: 'node["historic"="ruins"]', way: null, noName: true, group: 'landmark' },
  observatory:   { icon: 'telescope',    node: null, way: 'way["man_made"="observatory"]', noName: true, group: 'landmark' },
  tree:          { icon: 'tree-pine',    node: 'node["natural"="tree"]["name"]', way: null, noName: false, group: 'landmark' },
  locality:      { icon: 'map-pin',      node: 'node["place"="locality"]', way: null, noName: true, group: 'landmark' },

  toilets:       { icon: 'toilet',       node: 'node["amenity"="toilets"]', way: null, noName: true, group: 'misc' },
  barrier:       { icon: 'fence',        node: 'node["barrier"]["barrier"!="bollard"]', way: null, noName: true, group: 'misc' },
  tunnel:        { icon: 'tunnel',       node: null, way: 'way["tunnel"="yes"]', noName: true, group: 'misc' },
};

// Ordered list of sidebar group keys; display names come from i18n
// (`group.<key>`).
export const GROUPS = ['summits', 'shelter', 'water', 'landmark', 'misc'];

// Defaults enabled on first visit (mirrors the original default cookie).
export const DEFAULT_WITH_NAME = ['peak', 'saddle', 'alpine_hut', 'wilderness_hut', 'viewpoint', 'lake', 'waterfall', 'fountain', 'drinking_water', 'chapel', 'guidepost'];

/*
 * Priority-ordered list used to detect a waypoint's type from OSM tags.
 * Mirrors get_wpt_type() in osm.py.
 */
const OSM_VALUES = ['peak', 'saddle', 'volcano', 'attraction', 'toposcope', 'viewpoint',
  'drinking_water', 'fountain', 'glacier', 'waterfall', 'spring', 'lake',
  'guidepost', 'locality', 'observatory', 'cave_entrance',
  'chapel', 'castle', 'ruins', 'toilets', 'tree', 'cairn',
  'alpine_hut', 'wilderness_hut', 'shelter', 'camp_site', 'hostel', 'hotel'];
const OSM_KEYS = ['ford', 'barrier', 'tunnel'];
const OSM_BADLY_TAGGED = { water: 'lake' };

/** Determine the waypoint type from an OSM tag dictionary. */
export function getWptType(tags) {
  const values = Object.values(tags);
  for (const v of OSM_VALUES) {
    if (values.includes(v)) return v;
  }
  for (const k of OSM_KEYS) {
    if (k in tags) return k;
  }
  for (const [k, v] of Object.entries(OSM_BADLY_TAGGED)) {
    if (values.includes(k)) return v;
  }
  return '';
}
