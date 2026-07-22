import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];

  return {
    base: process.env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/',
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'KI3 POS', short_name: 'KI3 POS', description: 'Multi-tenant point of sale and shop management',
        theme_color: '#111827', background_color: '#f8fafc', display: 'standalone', start_url: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [{
          urlPattern: /^https:\/\/images\.unsplash\.com\//,
          handler: 'CacheFirst',
          options: { cacheName: 'product-images', expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 } },
        }],
      },
    })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) return 'firebase';
            if (id.includes('node_modules/react')) return 'react';
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) return 'motion';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
