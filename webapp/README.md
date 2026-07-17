# Mountain GPX — édition navigateur (100% client-side)

Refonte complète de Mountain GPX **entièrement en JavaScript dans le
navigateur**, sans aucun serveur. La logique historique (Flask + Python :
parsing GPX, requêtes Overpass, accrochage géométrique des POI, génération du
GPX) a été réécrite en JS et s'exécute intégralement sur l'appareil de
l'utilisateur.

> Votre trace GPX ne quitte jamais votre machine : aucun upload, aucun stockage
> côté serveur. Seules des requêtes anonymes vers l'API Overpass (OpenStreetMap)
> sont effectuées pour récupérer les points d'intérêt.

## Fonctionnalités

- **Import GPX** par glisser-déposer ou sélecteur de fichier (traces `trk` et
  itinéraires `rte`).
- **Détection automatique des POI** via l'API Overpass : sommets, cols, refuges,
  fontaines, lacs, cascades, chapelles, points de vue, etc.
- **Accrochage géométrique** des POI sur la trace (portage fidèle de la
  formule de Haversine, de la recherche du point le plus proche et de la
  projection perpendiculaire de l'app Python).
- **Sélection fine** : chaque type de POI activable « avec nom » et/ou
  « sans nom », requête Overpass personnalisée, distance d'accrochage réglable,
  inversion du sens de la trace.
- **Carte interactive** Leaflet (OpenTopoMap / OpenStreetMap / satellite Esri,
  overlay sentiers) avec marqueurs iconographiés et popups détaillant les tags
  OSM.
- **Profil altimétrique** et statistiques (distance, dénivelé positif,
  altitude max).
- **Export GPX** enrichi des waypoints, généré et téléchargé localement.
- **Préférences mémorisées** dans le navigateur (`localStorage`).

## Lancer l'application

Le projet est construit avec [Vite](https://vite.dev) ; Leaflet est géré comme
dépendance npm (plus de copie vendorée).

```bash
cd webapp
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production en local
```

Le contenu de `dist/` (chemins relatifs, `base: './'`) se déploie tel quel sur
n'importe quel hébergeur statique (GitHub Pages, Netlify, S3…).

## Structure

```
webapp/
├── index.html          # interface (SPA), point d'entrée Vite
├── package.json        # dépendances (leaflet) et scripts (dev/build/preview)
├── vite.config.js
├── public/             # assets copiés tels quels (favicon)
├── css/style.css       # thème sombre responsive
└── js/                 # modules ES
    ├── geometry.js     # Haversine, plus proche point, projection (port de geometry.py)
    ├── poi.js          # catalogue POI, requêtes Overpass, détection de type (port de osm.py)
    ├── icons.js        # icônes SVG inline (Lucide + glyphes maison), pins Leaflet
    ├── gpx.js          # parsing et génération GPX (port de main.py)
    ├── overpass.js     # appels API Overpass segmentés + accrochage
    └── app.js          # carte Leaflet, UI, orchestration
```

## Notes

- Les icônes de marqueurs sont des SVG inline embarqués dans `js/icons.js`
  (glyphes [Lucide](https://lucide.dev), licence ISC, plus quelques glyphes
  maison), rendus en pins Leaflet colorés par groupe — aucun asset image.
- Les segments Strava (présents dans la version Python via l'API Strava) ne sont
  pas inclus : ils nécessitent une authentification OAuth incompatible avec une
  app purement client-side sans secret serveur.
- Plusieurs instances Overpass publiques sont essayées en cascade en cas
  d'indisponibilité.
