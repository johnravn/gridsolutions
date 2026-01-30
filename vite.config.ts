import path from 'node:path'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
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
  ],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/features'),
    },
  },
  preview: {
    // Ensure preview server handles SPA routing correctly
    port: 3000,
  },
})
