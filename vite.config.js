import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'FRANC | Finance OS',
        short_name: 'FRANC',
        description: 'A personal finance tracker built for reality.',
        theme_color: '#080810',
        background_color: '#080810',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'https://via.placeholder.com/192/c8f542/080810?text=F',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://via.placeholder.com/512/c8f542/080810?text=F',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
