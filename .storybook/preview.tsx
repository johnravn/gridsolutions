import { useEffect } from 'react'
import '@radix-ui/themes/styles.css'
import '../src/app/styles.css'
import 'react-phone-number-input/style.css'
import { StorybookProviders } from './StorybookProviders'
import type { Preview } from '@storybook/react-vite'
import type { ReactNode } from 'react'

function ThemeSync({
  theme,
  children,
}: {
  theme: string
  children: ReactNode
}) {
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.remove('light')
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.classList.remove('light', 'dark')
    }
  }, [theme])

  return <>{children}</>
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light / dark mode',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'system', title: 'System' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
  decorators: [
    (Story, context) => (
      <StorybookProviders>
        <ThemeSync theme={context.globals.theme ?? 'light'}>
          <div style={{ padding: '1rem', minHeight: 120 }}>
            <Story />
          </div>
        </ThemeSync>
      </StorybookProviders>
    ),
  ],
}

export default preview
