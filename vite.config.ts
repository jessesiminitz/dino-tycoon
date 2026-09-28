import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

function gitVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // Relative base so the build works both at a domain root and under a
  // GitHub Pages project path (https://<user>.github.io/dino-tycoon/).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(gitVersion()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000, // Phaser is ~1.2 MB on its own
  },
  plugins: [
    VitePWA({
      // Ask before swapping in a new version, so an update never interrupts play.
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Dino Tycoon',
        short_name: 'Dino Tycoon',
        description: 'Build and run your own dinosaur park.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1b3a4b',
        theme_color: '#1b3a4b',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,json,mp3,ogg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // The pixel title font comes from Google Fonts; keep a copy for offline play.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
