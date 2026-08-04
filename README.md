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
profile and a printable roadbook, plans hydration and resupply along the way
(how much water to carry, where to fill up, which stretches are too dry),
and exports to GPX or Garmin TCX. No
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
sentiers et points d'eau), popups des tags OSM, renommage et suppression des
waypoints (annulable depuis le toast).

**Waypoints manuels** — clic droit (appui long sur mobile) pour ajouter un
waypoint nommé et typé (ravitaillement, rendez-vous…).

**Repères réguliers** — tous les N km ou tous les N m de D+ cumulé.

**Hydratation & ravitaillement** — à partir des points d'eau accrochés à la
trace : eau totale estimée (débit de boisson, allure en km-effort, chaleur),
portions entre deux ravitaillements, alerte sur celles qui dépassent la
contenance portée. Affichage désactivé par défaut ; une fois activé, les
portions sèches sont ombrées sur le profil et le roadbook signale les points
d'eau après lesquels la suite est trop longue.

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
hors-ligne (app, tuiles carto déjà consultées, réponses Overpass).

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
    ├── hydration.js    # plan hydratation : portions entre points d'eau, besoins
    ├── tcx.js          # génération TCX (parcours Garmin)
    ├── share.js        # encodage compact de la trace pour le partage par URL
    ├── overpass.js     # requêtes Overpass segmentées et hedgées, accrochage
    ├── profile.js      # profil altimétrique SVG
    ├── roadbook.js     # lignes du roadbook (liste des waypoints au km)
    ├── water.js        # overlay « points d'eau » à la demande
    └── app.js          # carte Leaflet, UI, orchestration
```

## Notes

- Requêtes Overpass réparties sur plusieurs instances publiques : la trace
  est découpée en segments interrogés en parallèle, chaque requête étant
  relancée sur une autre instance après 8 s sans réponse.
- Marqueurs en `L.divIcon` SVG générés par `js/icons.js` — aucun asset image.
- `scripts/build-lang-pages.mjs` génère une page d'entrée par langue
  (`en.html`, `de.html`…) — meta, JSON-LD et texte statique traduits depuis
  `js/locales/<lang>.json`, donc indexable sans exécuter le JS — plus
  `sitemap.xml` et `robots.txt` (qui déclare le sitemap et exclut
  `pr-preview/` ; sur une build de préview, il interdit tout).
- L'URL publique n'est pas écrite en dur : `scripts/site-url.mjs` la résout
  via `SITE_URL`, sinon le dépôt courant, sinon le champ `homepage` de
  `package.json`.
