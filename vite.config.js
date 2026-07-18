import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative asset paths so dist/ works from any static subdirectory.
  base: './',
  plugins: [
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
