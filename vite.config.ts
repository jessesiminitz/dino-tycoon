import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works both at a domain root and under a
  // GitHub Pages project path (https://<user>.github.io/dino-tycoon/).
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000, // Phaser is ~1.2 MB on its own
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Dino Tycoon',
        short_name: 'Dino Tycoon',
        description: 'Build and run your own dinosaur park.',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#1b3a4b',
        theme_color: '#1b3a4b',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,json,mp3,ogg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
