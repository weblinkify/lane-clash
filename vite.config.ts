import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { port: 5173 },
  plugins: [
    // Generates the web app manifest and a service worker that precaches every built file,
    // so the game installs to the home screen and plays offline after the first load.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,png,webmanifest}'] },
      manifest: {
        name: 'Lane Clash',
        short_name: 'Lane Clash',
        description: 'A two-minute, one-lane battler for your phone.',
        theme_color: '#1b2a41',
        background_color: '#1b2a41',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
