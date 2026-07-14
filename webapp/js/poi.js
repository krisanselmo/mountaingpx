/*
 * poi.js — Points of interest catalog.
 * Merges the Overpass query dictionaries and the waypoint-type detection
 * logic from wpts/osm.py, plus the French UI labels from settings_osm.html.
 */
(function (global) {
  'use strict';

  // Base path to the marker icons shipped with the original app.
  const ICON_BASE = '../static/img/markers/';

  /*
   * Each POI type maps to:
   *  - label : French display name
   *  - icon  : marker file name (in ICON_BASE)
   *  - node  : Overpass node filter (or null)
   *  - way   : Overpass way filter (or null)
   *  - noName: whether a "without name" query variant is offered in the UI
   *  - group : sidebar grouping
   */
  const POI = {
    peak:          { label: 'Sommet',              icon: 'peak.png',           node: 'node["natural"="peak"]', way: null, noName: true, group: 'summits' },
    saddle:        { label: 'Col',                 icon: 'saddle.png',         node: 'node["natural"="saddle"]', way: null, noName: true, group: 'summits' },
    volcano:       { label: 'Volcan',              icon: 'volcano.png',        node: 'node["natural"="volcano"]', way: null, noName: true, group: 'summits' },
    viewpoint:     { label: 'Point de vue',        icon: 'viewpoint.png',      node: 'node["tourism"="viewpoint"]["map_type"!="toposcope"]', way: null, noName: true, group: 'summits' },
    toposcope:     { label: "Table d'orientation", icon: 'toposcope.png',      node: 'node["map_type"="toposcope"]', way: null, noName: true, group: 'summits' },
    attraction:    { label: 'Attraction',          icon: 'attraction.png',     node: 'node["tourism"="attraction"]', way: null, noName: true, group: 'summits' },

    alpine_hut:    { label: 'Refuge gardé',        icon: 'alpine_hut.png',     node: 'node["tourism"="alpine_hut"]', way: 'way["tourism"="alpine_hut"]', noName: true, group: 'shelter' },
    wilderness_hut:{ label: 'Refuge non gardé',    icon: 'wilderness_hut.png', node: 'node["tourism"="wilderness_hut"]', way: 'way["tourism"="wilderness_hut"]', noName: true, group: 'shelter' },
    shelter:       { label: 'Abri',                icon: 'shelter.png',        node: 'node["amenity"="shelter"]', way: 'way["amenity"="shelter"]', noName: true, group: 'shelter' },
    camp_site:     { label: 'Camping',             icon: 'camping.png',        node: 'node["tourism"="camp_site"]', way: 'way["tourism"="camp_site"]', noName: true, group: 'shelter' },
    hostel:        { label: 'Auberge de jeunesse', icon: 'hostel.png',         node: 'node["tourism"="hostel"]', way: 'way["tourism"="hostel"]', noName: true, group: 'shelter' },
    hotel:         { label: 'Hôtel',               icon: 'hotel.png',          node: 'node["tourism"="hotel"]', way: 'way["tourism"="hotel"]', noName: true, group: 'shelter' },

    drinking_water:{ label: 'Eau potable',         icon: 'water.png',          node: 'node["amenity"="drinking_water"]', way: null, noName: true, group: 'water' },
    fountain:      { label: 'Fontaine',            icon: 'fountain.png',       node: 'node["amenity"="fountain"]', way: null, noName: true, group: 'water' },
    spring:        { label: 'Source',              icon: 'fountain.png',       node: 'node["natural"="spring"]', way: null, noName: true, group: 'water' },
    waterfall:     { label: 'Cascade',             icon: 'waterfall.png',      node: 'node["waterway"="waterfall"]', way: null, noName: true, group: 'water' },
    lake:          { label: 'Lac',                 icon: 'lake.png',           node: null, way: 'way["water"="lake"]', noName: true, group: 'water' },
    glacier:       { label: 'Glacier',             icon: 'glacier.png',        node: null, way: 'way["natural"="glacier"]', noName: true, group: 'water' },
    ford:          { label: 'Gué',                 icon: 'ford.png',           node: 'node["ford"="yes"]', way: null, noName: true, group: 'water' },

    guidepost:     { label: 'Panneau',             icon: 'guidepost.png',      node: 'node["information"="guidepost"]', way: null, noName: true, group: 'landmark' },
    cave_entrance: { label: 'Grotte',              icon: 'cave.png',           node: 'node["natural"="cave_entrance"]', way: null, noName: true, group: 'landmark' },
    chapel:        { label: 'Chapelle',            icon: 'chapel.png',         node: 'node["building"="chapel"]', way: 'way["building"="chapel"]', noName: true, group: 'landmark' },
    castle:        { label: 'Château',             icon: 'castle.png',         node: 'node["historic"="castle"]', way: null, noName: true, group: 'landmark' },
    ruins:         { label: 'Ruines',              icon: 'ruins.png',          node: 'node["historic"="ruins"]', way: null, noName: true, group: 'landmark' },
    observatory:   { label: 'Observatoire',        icon: 'observatory.png',    node: null, way: 'way["man_made"="observatory"]', noName: true, group: 'landmark' },
    tree:          { label: 'Arbre remarquable',   icon: 'tree.png',           node: 'node["natural"="tree"]["name"]', way: null, noName: false, group: 'landmark' },
    locality:      { label: 'Lieu-dit',            icon: 'i.png',              node: 'node["place"="locality"]', way: null, noName: true, group: 'landmark' },

    toilets:       { label: 'Toilettes',           icon: 'toilets.png',        node: 'node["amenity"="toilets"]', way: null, noName: true, group: 'misc' },
    barrier:       { label: 'Barrière',            icon: 'barrier.png',        node: 'node["barrier"]["barrier"!="bollard"]', way: null, noName: true, group: 'misc' },
    tunnel:        { label: 'Tunnel',              icon: 'tunnel.png',         node: null, way: 'way["tunnel"="yes"]', noName: true, group: 'misc' },
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

  /** Icon URL for a detected type (falls back to a generic marker). */
  function iconFor(type) {
    if (POI[type]) return ICON_BASE + POI[type].icon;
    return ICON_BASE + 'i.png';
  }

  global.POIData = {
    POI, GROUPS, DEFAULT_WITH_NAME, ICON_BASE,
    getWptType, iconFor,
  };
})(window);
