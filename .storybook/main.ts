/**
 * Storybook config for shared UI components.
 *
 * Deploy to Vercel (free, shareable preview URLs):
 * 1. Create a second Vercel project linked to this repo (e.g. grid-storybook).
 * 2. Build command: npm run build-storybook
 * 3. Output directory: storybook-static
 * 4. Optional env: VITE_GOOGLE_MAPS_PLATFORM_API_KEY (for MapEmbed stories)
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import type { StorybookConfig } from '@storybook/react-vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ['../src/shared/**/*.stories.@(ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-vite',
  viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@app': path.resolve(dirname, '../src/app'),
          '@shared': path.resolve(dirname, '../src/shared'),
          '@features': path.resolve(dirname, '../src/features'),
          '@test': path.resolve(dirname, '../src/test'),
          [path.resolve(dirname, '../src/shared/api/supabase.ts')]:
            path.resolve(dirname, './mocks/supabase.ts'),
        },
      },
    })
  },
}

export default config
