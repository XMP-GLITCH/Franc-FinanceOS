import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['franc_icon_favicon.svg', 'franc_icon_squircle.svg'],
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
            src: '/franc_icon_squircle.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/franc_icon_squircle.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
