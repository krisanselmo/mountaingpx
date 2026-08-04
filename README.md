# Mountain GPX

![Mountain GPX — waypoints automatiques sur vos traces GPX](public/og-image.png)

Ajoute automatiquement des waypoints (sommets, cols, refuges, points d'eau…)
à une trace GPX à partir des données OpenStreetMap. 100 % client-side : le
fichier est traité dans le navigateur, seules les requêtes Overpass sortent.

https://krisanselmo.github.io/mountaingpx/

## English

Mountain GPX adds waypoints (peaks, passes, huts, water points, lakes,
waterfalls, viewpoints…) to a hiking, trail-running or mountain-bike GPX
track from OpenStreetMap data, snaps them onto the route, draws an elevation
profile and a printable roadbook, and exports to GPX or Garmin TCX. No
sign-up, 100% client-side, installable as an offline-capable PWA. Available
in English, French, German, Spanish and Italian:
https://krisanselmo.github.io/mountaingpx/en.html

## Fonctionnalités

**Import** — GPX (`trk`, `rte`), FIT (activités et parcours Garmin), TCX
(`Trackpoint`, `CoursePoint`) et KML (`LineString`, `gx:Track`, placemarks),
par glisser-déposer ou sélecteur de fichier. Format détecté d'après le
contenu, pas l'extension.

**Waypoints existants** — affichés sur la carte, le profil et le roadbook.
Leur `type`/`sym` est rattaché au catalogue de POI (repli sur un type
générique) et conservé à l'export.

**POI Overpass** — sommets, cols, refuges, fontaines, lacs, cascades,
chapelles, points de vue… Sélection par type, « avec nom » / « sans nom »,
requête personnalisée, distance d'accrochage réglable, inversion du sens.

**Accrochage** — distance de Haversine, point le plus proche, projection
perpendiculaire sur le segment.

**Carte** — Leaflet (OpenTopoMap / OpenStreetMap / satellite Esri, overlays
sentiers, points d'eau et radar de pluie), popups des tags OSM, renommage et
suppression des waypoints (annulable depuis le toast).

**Météo en direct** — overlay radar de précipitations (RainViewer, sans clé
API), rafraîchi toutes les 5 min tant qu'il est affiché ; l'heure de l'image
est indiquée dans les crédits de la carte. La source est décrite par un
*provider* dans `js/weather.js` : en changer (DWD, MétéoSuisse,
OpenWeatherMap…) tient en un descripteur.

**Calques personnalisés** — fonds de carte et overlays de tuiles ajoutés par
l'utilisateur (modèle XYZ `https://…/{z}/{x}/{y}.png`, `{s}` et `{-y}`
acceptés, `http://` toléré depuis `localhost` pour un serveur de tuiles local),
avec zoom min/max, zoom natif max (tuiles agrandies au-delà) et opacité.
Modifiables et supprimables, listés dans le sélecteur de calques et mémorisés
dans `localStorage`.

**Waypoints manuels** — clic droit (appui long sur mobile) pour ajouter un
waypoint nommé et typé (ravitaillement, rendez-vous…).

**Repères réguliers** — tous les N km ou tous les N m de D+ cumulé.

**Profil altimétrique** — distance, D+, altitude max ; le survol (souris ou
doigt) suit la position sur la carte.

**Roadbook** — waypoints triés par kilométrage (icône, type, km, altitude),
cliquables pour centrer la carte, imprimable.

**Partage** — par URL (`#track=…`, trace et waypoints encodés dans le lien,
sans serveur) ou par envoi du fichier GPX complet via le menu de partage de
l'appareil (Web Share).

**Chargement par URL** — `#gpx=<url percent-encodée>` télécharge et affiche
un fichier distant. URL `https:` uniquement, lecture plafonnée à 8 Mo.

**Exports** — GPX enrichi (horodatages du fichier source préservés,
interpolés sur les points insérés) et TCX (parcours Garmin, `CoursePoint`
typés) importable dans Garmin Connect.

**PWA installable** — écran d'accueil ou app de bureau, fonctionne
hors-ligne (app, tuiles carto déjà consultées — y compris celles des calques
personnalisés en `/{z}/{x}/{y}` —, réponses Overpass ; le radar, lui, a besoin
du réseau).

Préférences mémorisées dans `localStorage`.

## Développement

Build [Vite](https://vite.dev), Leaflet en dépendance npm.

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm test           # tests unitaires (node --test)
npm run test:e2e   # tests end-to-end Playwright (Overpass simulé)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production en local
```

Les tests e2e nécessitent `npx playwright install chromium` au premier
lancement, ou `PLAYWRIGHT_CHROMIUM_PATH` vers un Chromium existant.

`dist/` est un site statique à chemins relatifs (`base: './'`), déployable
sur n'importe quel hébergeur statique.

## Structure

```
├── index.html          # interface (SPA), point d'entrée Vite
├── public/             # assets copiés tels quels (favicon, icônes PWA)
├── css/style.css       # styles
├── e2e/                # tests end-to-end Playwright (Overpass simulé)
├── test/               # tests unitaires (node --test)
└── js/                 # modules ES
    ├── geometry.js     # Haversine, plus proche point, projection
    ├── poi.js          # catalogue POI, filtres Overpass, détection de type
    ├── icons.js        # icônes SVG inline (Lucide, licence ISC + glyphes maison), pins Leaflet
    ├── html.js         # échappement HTML partagé
    ├── gpx.js          # parsing et génération GPX (horodatages préservés)
    ├── formats.js      # parseurs d'import FIT, TCX, KML et détection de format
    ├── milestones.js   # repères distance / D+ le long de la trace
    ├── tcx.js          # génération TCX (parcours Garmin)
    ├── share.js        # encodage compact de la trace pour le partage par URL
    ├── overpass.js     # requêtes Overpass segmentées et hedgées, accrochage
    ├── profile.js      # profil altimétrique SVG
    ├── roadbook.js     # lignes du roadbook (liste des waypoints au km)
    ├── water.js        # overlay « points d'eau » à la demande
    ├── weather.js      # overlay météo (tuiles radar), sources interchangeables
    ├── customlayers.js # calques personnalisés (validation, localStorage)
    └── app.js          # carte Leaflet, UI, orchestration
```

## Notes

- Requêtes Overpass réparties sur plusieurs instances publiques : la trace
  est découpée en segments interrogés en parallèle, chaque requête étant
  relancée sur une autre instance après 8 s sans réponse.
- Marqueurs en `L.divIcon` SVG générés par `js/icons.js` — aucun asset image.
- L'API publique RainViewer est gratuite et sans clé, en usage non commercial,
  avec attribution obligatoire (affichée dans les crédits de la carte). Ses
  tuiles radar s'arrêtent au zoom 7 (au-delà, le service renvoie une image de
  remplacement) : l'overlay plafonne donc son `maxNativeZoom` et laisse Leaflet
  agrandir les dernières tuiles réelles, plutôt que d'en demander d'autres. Ses
  tuiles sont horodatées donc immuables : le service worker les garde une
  heure au maximum, pour qu'un radar périmé ne passe jamais pour du direct.
  L'index des images, lui, n'est jamais mis en cache.
- `scripts/build-lang-pages.mjs` génère une page d'entrée par langue
  (`en.html`, `de.html`…) — meta, JSON-LD et texte statique traduits depuis
  `js/locales/<lang>.json`, donc indexable sans exécuter le JS — plus
  `sitemap.xml` et `robots.txt` (qui déclare le sitemap et exclut
  `pr-preview/` ; sur une build de préview, il interdit tout).
- L'URL publique n'est pas écrite en dur : `scripts/site-url.mjs` la résout
  via `SITE_URL`, sinon le dépôt courant, sinon le champ `homepage` de
  `package.json`.
