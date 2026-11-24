import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// base './' = funciona en GitHub Pages (/juasdex/) o en cualquier carpeta
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: null, // se registra a mano en main.tsx
      registerType: 'prompt', // la versión nueva espera a que la persona toque "Actualizar"
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'JuasDex',
        short_name: 'JuasDex',
        description: 'Pokédex en español: tipos, debilidades, habilidades, movimientos, evoluciones y ubicaciones.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#d6182f',
        theme_color: '#d6182f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La app y los sprites se guardan al instalar; los datos de cada Pokémon al abrirlos.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}', 'data/*.json'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/p/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'juasdex-pokemon', expiration: { maxEntries: 100 } },
          },
          {
            // Lugares por juego: se guardan al abrir cada juego
            urlPattern: ({ url }) => url.pathname.includes('/data/places/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'juasdex-lugares', expiration: { maxEntries: 60 } },
          },
          {
            // Gritos: se guardan la primera vez que se escuchan
            urlPattern: ({ url }) => url.origin === 'https://raw.githubusercontent.com' && url.pathname.startsWith('/PokeAPI/cries/'),
            handler: 'CacheFirst',
            options: { cacheName: 'juasdex-gritos', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'juasdex-fuentes', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
});
