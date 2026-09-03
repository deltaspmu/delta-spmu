import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // In production vercel.json rewrites /api to the Frappe backend. Locally that
  // rewrite doesn't exist, so proxy it here to keep the site same-origin — the
  // contact form's CSRF flow depends on it. Mirrors the portals' vite configs.
  // '' as the prefix so VITE_DEV_API_TARGET stays server-side only.
  const env = loadEnv(mode, import.meta.dirname, '')
  const target = env.VITE_DEV_API_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: 'localhost',
        },
      },
    },
  }
})
