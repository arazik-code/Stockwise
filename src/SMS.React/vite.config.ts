import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite'

export default defineConfig({
  plugins: [wgslVitePlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5001',
        ws: true,
      },
      '/uploads': 'http://localhost:5001',
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // Every route is lazy-loaded, so the entry chunk only carries the shell.
        // Splitting the heavy libraries out by feature keeps them off pages that
        // never touch them - the POS must never download the chart bundle.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)/.test(id)) return 'vendor'
          if (id.includes('@microsoft/signalr')) return 'signalr'
          if (/[\\/]node_modules[\\/](motion|framer-motion)[\\/]/.test(id)) return 'motion'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('@visx') || id.includes('d3-')) return 'charts'
          if (id.includes('i18next')) return 'i18n'
          if (id.includes('jsbarcode') || id.includes('qrcode')) return 'codes'
          if (/[\\/]node_modules[\\/](zustand|axios|clsx|tailwind-merge|class-variance-authority)/.test(id)) return 'state'
        },
      },
    },
  },
})
