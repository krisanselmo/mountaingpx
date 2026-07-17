/*
 * poi.js — Points of interest catalog.
 * Merges the Overpass query dictionaries and the waypoint-type detection
 * logic from wpts/osm.py, plus the French UI labels from settings_osm.html.
 */
(function (global) {
  'use strict';

  /*
   * Each POI type maps to:
   *  - label : French display name
   *  - icon  : glyph name in icons.js (Lucide or hand-drawn)
   *  - node  : Overpass node filter (or null)
   *  - way   : Overpass way filter (or null)
   *  - noName: whether a "without name" query variant is offered in the UI
   *  - group : sidebar grouping
   */
  const POI = {
    peak:          { label: 'Sommet',              icon: 'mountain',     node: 'node["natural"="peak"]', way: null, noName: true, group: 'summits' },
    saddle:        { label: 'Col',                 icon: 'saddle',       node: 'node["natural"="saddle"]', way: null, noName: true, group: 'summits' },
    volcano:       { label: 'Volcan',              icon: 'flame',        node: 'node["natural"="volcano"]', way: null, noName: true, group: 'summits' },
    viewpoint:     { label: 'Point de vue',        icon: 'eye',          node: 'node["tourism"="viewpoint"]["map_type"!="toposcope"]', way: null, noName: true, group: 'summits' },
    toposcope:     { label: "Table d'orientation", icon: 'compass',      node: 'node["map_type"="toposcope"]', way: null, noName: true, group: 'summits' },
    attraction:    { label: 'Attraction',          icon: 'ferris-wheel', node: 'node["tourism"="attraction"]', way: null, noName: true, group: 'summits' },

    alpine_hut:    { label: 'Refuge gardé',        icon: 'house',        node: 'node["tourism"="alpine_hut"]', way: 'way["tourism"="alpine_hut"]', noName: true, group: 'shelter' },
    wilderness_hut:{ label: 'Refuge non gardé',    icon: 'cabin',        node: 'node["tourism"="wilderness_hut"]', way: 'way["tourism"="wilderness_hut"]', noName: true, group: 'shelter' },
    shelter:       { label: 'Abri',                icon: 'umbrella',     node: 'node["amenity"="shelter"]', way: 'way["amenity"="shelter"]', noName: true, group: 'shelter' },
    camp_site:     { label: 'Camping',             icon: 'tent',         node: 'node["tourism"="camp_site"]', way: 'way["tourism"="camp_site"]', noName: true, group: 'shelter' },
    hostel:        { label: 'Auberge de jeunesse', icon: 'bed-double',   node: 'node["tourism"="hostel"]', way: 'way["tourism"="hostel"]', noName: true, group: 'shelter' },
    hotel:         { label: 'Hôtel',               icon: 'hotel',        node: 'node["tourism"="hotel"]', way: 'way["tourism"="hotel"]', noName: true, group: 'shelter' },

    drinking_water:{ label: 'Eau potable',         icon: 'glass-water',  node: 'node["amenity"="drinking_water"]', way: null, noName: true, group: 'water' },
    fountain:      { label: 'Fontaine',            icon: 'droplets',     node: 'node["amenity"="fountain"]', way: null, noName: true, group: 'water' },
    spring:        { label: 'Source',              icon: 'droplet',      node: 'node["natural"="spring"]', way: null, noName: true, group: 'water' },
    waterfall:     { label: 'Cascade',             icon: 'waterfall',    node: 'node["waterway"="waterfall"]', way: null, noName: true, group: 'water' },
    lake:          { label: 'Lac',                 icon: 'waves',        node: null, way: 'way["water"="lake"]', noName: true, group: 'water' },
    glacier:       { label: 'Glacier',             icon: 'snowflake',    node: null, way: 'way["natural"="glacier"]', noName: true, group: 'water' },
    ford:          { label: 'Gué',                 icon: 'ford',         node: 'node["ford"="yes"]', way: null, noName: true, group: 'water' },

    guidepost:     { label: 'Panneau',             icon: 'signpost',     node: 'node["information"="guidepost"]', way: null, noName: true, group: 'landmark' },
    cave_entrance: { label: 'Grotte',              icon: 'cave',         node: 'node["natural"="cave_entrance"]', way: null, noName: true, group: 'landmark' },
    chapel:        { label: 'Chapelle',            icon: 'church',       node: 'node["building"="chapel"]', way: 'way["building"="chapel"]', noName: true, group: 'landmark' },
    castle:        { label: 'Château',             icon: 'castle',       node: 'node["historic"="castle"]', way: null, noName: true, group: 'landmark' },
    ruins:         { label: 'Ruines',              icon: 'landmark',     node: 'node["historic"="ruins"]', way: null, noName: true, group: 'landmark' },
    observatory:   { label: 'Observatoire',        icon: 'telescope',    node: null, way: 'way["man_made"="observatory"]', noName: true, group: 'landmark' },
    tree:          { label: 'Arbre remarquable',   icon: 'tree-pine',    node: 'node["natural"="tree"]["name"]', way: null, noName: false, group: 'landmark' },
    locality:      { label: 'Lieu-dit',            icon: 'map-pin',      node: 'node["place"="locality"]', way: null, noName: true, group: 'landmark' },

    toilets:       { label: 'Toilettes',           icon: 'toilet',       node: 'node["amenity"="toilets"]', way: null, noName: true, group: 'misc' },
    barrier:       { label: 'Barrière',            icon: 'fence',        node: 'node["barrier"]["barrier"!="bollard"]', way: null, noName: true, group: 'misc' },
    tunnel:        { label: 'Tunnel',              icon: 'tunnel',       node: null, way: 'way["tunnel"="yes"]', noName: true, group: 'misc' },
  };

  const GROUPS = {
    summits: 'Sommets & panoramas',
    shelter: 'Hébergements & abris',
    water:   'Eau & relief',
    landmark:'Points remarquables',
    misc:    'Divers',
  };

  // Defaults enabled on first visit (mirrors the original default cookie).
  const DEFAULT_WITH_NAME = ['peak', 'saddle', 'alpine_hut', 'wilderness_hut', 'viewpoint', 'lake', 'waterfall', 'fountain', 'drinking_water', 'chapel', 'guidepost'];

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
  function getWptType(tags) {
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

  global.POIData = {
    POI, GROUPS, DEFAULT_WITH_NAME,
    getWptType,
  };
})(window);
