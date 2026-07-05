import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@test': path.resolve(__dirname, 'src/test'),
    },
  },
  test: {
    pool: 'threads',
    environment: 'node',
    include: ['src/test/integration/**/*.test.ts'],
    globalSetup: ['./src/test/integration/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
