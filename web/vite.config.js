import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const apiTarget = process.env.API_TARGET || 'http://127.0.0.1:4000'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': apiTarget,
      '/img': {
        target: apiTarget,
        rewrite: path => `/api${path}`
      }
    }
  }
})
