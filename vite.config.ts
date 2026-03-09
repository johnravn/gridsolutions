import path from 'node:path'
import fs from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env / .env.local so API middleware (e.g. calendar feed) can read SUPABASE_SERVICE_ROLE_KEY.
  const env = loadEnv(mode, process.cwd(), '')
  // Also load .env.local.db so Conta/other vars (e.g. VITE_CONTA_USE_PRODUCTION_IN_DEV) are used when running with local Supabase
  const localDbPath = path.resolve(process.cwd(), '.env.local.db')
  if (fs.existsSync(localDbPath)) {
    const content = fs.readFileSync(localDbPath, 'utf-8')
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (match) {
        const key = match[1]
        const value = match[2].replace(/^["']|["']$/g, '').trim()
        env[key] = value
        if (!process.env[key]) process.env[key] = value
      }
    }
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
  }
  if (env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
  }
  if (env.SUPABASE_URL && !process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = env.SUPABASE_URL
  }

  return {
  plugins: [
    viteReact(),
    tailwindcss(),
    {
      name: 'youversion-dev-api',
      configureServer(server) {
        server.middlewares.use(
          '/api/verse-of-the-day',
          async (req, res, next) => {
            if (!req || !res) return next()
            if (req.method && req.method !== 'GET') return next()

            try {
              const url = new URL(req.url ?? '/', 'http://localhost')
              const lang = url.searchParams.get('lang') || 'en'
              const { getVerseOfTheDay } = await import(
                '@glowstudent/youversion'
              )
              const data = await getVerseOfTheDay(lang)

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(data ?? null))
            } catch (e: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(
                JSON.stringify({
                  error: 'Failed to load verse of the day',
                  message: e?.message ?? String(e),
                }),
              )
            }
          },
        )
      },
    },
    {
      name: 'calendar-feed-dev-api',
      configureServer(server) {
        server.middlewares.use(
          '/api/calendar/feed',
          async (req, res, next) => {
            if (!req || !res) return next()
            if (req.method !== 'GET' && req.method !== 'OPTIONS') return next()

            try {
              const url = new URL(req.url ?? '/', 'http://localhost')
              const token = url.searchParams.get('token')
              const { default: handler } = await import('../api/calendar/feed')
              const fakeReq = { method: req.method, query: { token } }
              const fakeRes = {
                setHeader: res.setHeader.bind(res),
                get statusCode() {
                  return res.statusCode
                },
                set statusCode(v: number) {
                  res.statusCode = v
                },
                end: res.end.bind(res),
              }
              await handler(fakeReq, fakeRes)
            } catch (e: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  error: 'Calendar feed error',
                  message: e?.message ?? String(e),
                }),
              )
            }
          },
        )
      },
    },
  ],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/features'),
    },
  },
  optimizeDeps: {
    // Avoid stale chunk errors when devtools (or other deps) are re-optimized
    exclude: ['@tanstack/react-router-devtools'],
  },
  preview: {
    // Ensure preview server handles SPA routing correctly
    port: 3000,
  },
  }
})
