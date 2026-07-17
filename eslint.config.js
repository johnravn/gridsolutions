// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from 'eslint-plugin-storybook'

//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      'storybook-static/**',
      'debug-storybook.log',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
  },
  ...tanstackConfig,
  ...storybook.configs['flat/recommended'],
]
