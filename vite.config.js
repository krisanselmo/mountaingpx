import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { resolveSiteUrl, injectSiteUrl } from './scripts/site-url.mjs';

// Fills the __SITE_URL__ placeholders of index.html (canonical, Open Graph,
// alternates…) with the URL resolved by scripts/site-url.mjs.
const siteUrl = {
  name: 'site-url',
  transformIndexHtml: (html) => injectSiteUrl(html, resolveSiteUrl()),
};

// Adds a robots noindex tag when NOINDEX_BUILD is set (PR preview builds).
const noindexPreview = {
  name: 'noindex-preview',
  transformIndexHtml(html) {
    return html.replace('<head>', '<head>\n  <meta name="robots" content="noindex">');
  },
};

export default defineConfig({
  // Relative asset paths so dist/ works from any static subdirectory.
  base: './',
  plugins: [
    siteUrl,
    ...(process.env.NOINDEX_BUILD ? [noindexPreview] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Mountain GPX — waypoints automatiques',
        short_name: 'Mountain GPX',
        description:
          'Ajoutez automatiquement des waypoints (sommets, cols, refuges, fontaines…) sur votre trace GPX. Entièrement dans le navigateur, sans serveur.',
        lang: 'fr',
        theme_color: '#0f1720',
        background_color: '#0f1720',
        display: 'standalone',
        orientation: 'any',
        categories: ['sports', 'navigation', 'utilities'],
        // Relative scope/start so the PWA works under any subdirectory
        // (e.g. GitHub Pages /mountaingpx/).
        scope: './',
        start_url: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The production service worker is served from the root of gh-pages,
        // so its scope also covers the PR previews published under
        // pr-preview/pr-<n>/ (see .github/workflows/pr-preview.yml). Without
        // this denylist, its navigation fallback would answer those
        // navigations with the *production* app shell and the preview would
        // never be seen by anyone who already installed the app. The pattern
        // is deliberately unanchored: the deployed base varies (GitHub Pages
        // subdirectory, custom domain…) and Workbox matches it against the
        // full pathname + search.
        navigateFallbackDenylist: [/\/pr-preview\//],
        // The map/POI data comes from third-party APIs; cache it at runtime
        // so a previously loaded area stays usable offline.
        runtimeCaching: [
          {
            // Leaflet tile layers: OpenTopoMap, OSM, Esri satellite, Waymarked Trails.
            urlPattern: ({ url }) =>
              /(opentopomap|openstreetmap|waymarkedtrails)\.org$/.test(url.hostname) ||
              url.hostname === 'server.arcgisonline.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Overpass API responses (overpass-api.de, kumi.systems, maps.mail.ru).
            urlPattern: ({ url }) => /\/overpass\/|\/interpreter$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'overpass-api',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
