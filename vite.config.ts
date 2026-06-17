import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
          plugins: [
                  react(),
                  tailwindcss(),
                  VitePWA({
                            registerType: 'autoUpdate',
                            includeAssets: ['icon.jpg', 'manifest.json'],
                            workbox: {
                                        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg}'],
                                        navigateFallback: '/index.html'
                            },
                            devOptions: {
                                        enabled: true
                            }
                  })
                ],
          build: {
                  target: ['es2015', 'safari11'],
          },
          resolve: {
                  alias: {
                            '@': path.resolve(__dirname, '.'),
                  },
          },
          server: {
                  hmr: process.env.DISABLE_HMR !== 'true',
                  watch: process.env.DISABLE_HMR === 'true' ? null : {},
          },
    };
});
