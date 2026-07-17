import { Box, Flex, Spinner, Text } from '@radix-ui/themes'
import { NavArrowRight } from 'iconoir-react'
import type { ReactNode } from 'react'

export type HomeDisclosureTone = 'accent' | 'orange' | 'red' | 'green'

const TONE_STYLES: Record<
  HomeDisclosureTone,
  { background: string; color: string }
> = {
  accent: { background: 'var(--accent-a3)', color: 'var(--accent-11)' },
  orange: { background: 'var(--orange-a3)', color: 'var(--orange-11)' },
  red: { background: 'var(--red-a3)', color: 'var(--red-11)' },
  green: { background: 'var(--green-a3)', color: 'var(--green-11)' },
}

/** iOS Settings-style disclosure row — body 17px (size="3") on phone. */
export function HomeDisclosureRow({
  icon,
  label,
  count,
  loading,
  tone,
  onClick,
}: {
  icon: ReactNode
  label: string
  count: number
  loading?: boolean
  /** Active action color, or green when idle (count === 0). */
  tone: HomeDisclosureTone
  onClick: () => void
}) {
  const toneStyle = TONE_STYLES[tone]
  const active = count > 0

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      style={{
        cursor: 'pointer',
        minHeight: 44,
        padding: '12px 16px',
      }}
    >
      <Flex align="center" gap="3" style={{ minHeight: 32 }}>
        <Flex
          align="center"
          justify="center"
          width="32px"
          height="32px"
          style={{
            borderRadius: 8,
            background: toneStyle.background,
            color: toneStyle.color,
            flexShrink: 0,
          }}
        >
          {icon}
        </Flex>
        <Text size="3" weight="medium" style={{ flex: 1, minWidth: 0 }}>
          {label}
        </Text>
        {loading ? (
          <Spinner size="2" />
        ) : (
          <Text
            size="3"
            color={active ? undefined : 'gray'}
            weight="medium"
            style={{
              ...(active ? { color: toneStyle.color } : null),
              fontVariantNumeric: 'tabular-nums',
              minWidth: '1.5ch',
              textAlign: 'right',
            }}
          >
            {count}
          </Text>
        )}
        <Box style={{ color: 'var(--gray-8)', lineHeight: 0, flexShrink: 0 }}>
          <NavArrowRight width={18} height={18} />
        </Box>
      </Flex>
    </Box>
  )
}
