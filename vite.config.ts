import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
