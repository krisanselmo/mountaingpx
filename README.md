# Mountain GPX

Application web qui ajoute automatiquement des waypoints (sommets, cols,
refuges, points d'eau…) à une trace GPX, à partir des données OpenStreetMap.
100 % client-side : le fichier GPX est traité dans le navigateur, seules des
requêtes vers l'API Overpass sont émises.

Déployée sur https://krisanselmo.github.io/mountaingpx/

## Fonctionnalités

- Import GPX par glisser-déposer ou sélecteur de fichier (`trk` et `rte`).
- Récupération des POI via l'API Overpass : sommets, cols, refuges, fontaines,
  lacs, cascades, chapelles, points de vue, etc.
- Accrochage des POI sur la trace : distance de Haversine, point le plus
  proche, projection perpendiculaire sur le segment.
- Sélection par type de POI, « avec nom » et/ou « sans nom », requête Overpass
  personnalisée, distance d'accrochage réglable, inversion du sens de la trace.
- Carte Leaflet (OpenTopoMap / OpenStreetMap / satellite Esri, overlay
  sentiers, overlay points d'eau) avec popups des tags OSM ; renommage et
  suppression des waypoints depuis la carte.
- Profil altimétrique et statistiques (distance, D+, altitude max).
- Export GPX enrichi des waypoints, téléchargé localement.
- Préférences mémorisées dans `localStorage`.
- **PWA installable** : l'application peut être ajoutée à l'écran d'accueil
  (mobile) ou installée comme app de bureau, et fonctionne hors-ligne grâce à
  un service worker (mise en cache de l'app, des tuiles carto déjà consultées
  et des réponses Overpass).

## Développement

Build [Vite](https://vite.dev), Leaflet en dépendance npm.

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production en local
```

`dist/` est un site statique à chemins relatifs (`base: './'`), déployable sur
n'importe quel hébergeur statique.

## Structure

```
├── index.html          # interface (SPA), point d'entrée Vite
├── public/             # assets copiés tels quels (favicon, icônes PWA)
├── css/style.css       # styles
└── js/                 # modules ES
    ├── geometry.js     # Haversine, plus proche point, projection
    ├── poi.js          # catalogue POI, filtres Overpass, détection de type
    ├── icons.js        # icônes SVG inline (Lucide, licence ISC + glyphes maison), pins Leaflet
    ├── gpx.js          # parsing et génération GPX
    ├── overpass.js     # requêtes Overpass segmentées et hedgées, accrochage
    └── app.js          # carte Leaflet, UI, orchestration
```

## Déploiement

`.github/workflows/deploy-webapp.yml` : à chaque push sur `master`,
`npm ci && npm run build` puis publication de `dist/` sur GitHub Pages.

## Notes

- Les requêtes Overpass sont réparties sur plusieurs instances publiques :
  la trace est découpée en segments interrogés en parallèle, et chaque requête
  est relancée sur une autre instance après 8 s sans réponse.
- Les marqueurs sont des `L.divIcon` SVG générés par `js/icons.js` — aucun
  asset image.
