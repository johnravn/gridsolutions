import * as React from 'react'
import { Box, Card, Flex, Heading, Text } from '@radix-ui/themes'

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="32px"
      height="32px"
      style={{
        borderRadius: 8,
        background: 'var(--accent-3)',
        color: 'var(--accent-11)',
      }}
    >
      <Box style={{ lineHeight: 0 }}>{children}</Box>
    </Flex>
  )
}

export function DashboardCard({
  title,
  icon,
  children,
  footer,
  headerAction,
  notFullHeight,
  scrollContainerStyle,
  subtitle,
  fillHeight,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  headerAction?: React.ReactNode
  notFullHeight?: boolean
  /** Optional style for the scroll container (when notFullHeight is false) */
  scrollContainerStyle?: React.CSSProperties
  /** Shown under the title (e.g. date range). Keeps the header fixed when the body scrolls. */
  subtitle?: React.ReactNode
  /**
   * Fill parent height and let children own scrolling (avoids nested overflow when
   * `notFullHeight` is used with an inner scroll region).
   */
  fillHeight?: boolean
}) {
  const cardStyle: React.CSSProperties | undefined =
    fillHeight || !notFullHeight
      ? {
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }
      : undefined

  const columnStyle: React.CSSProperties = fillHeight
    ? { flex: 1, minHeight: 0, overflow: 'hidden' }
    : notFullHeight
      ? {}
      : { height: '100%' }

  const contentBoxStyle: React.CSSProperties | undefined = notFullHeight
    ? fillHeight
      ? {
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }
      : undefined
    : {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        ...scrollContainerStyle,
      }

  return (
    <Card size="3" style={cardStyle}>
      <Flex direction="column" gap="3" style={columnStyle}>
        <Flex
          align="start"
          justify="between"
          gap="3"
          wrap="wrap"
          style={{ flexShrink: 0 }}
        >
          <Flex
            align={subtitle != null ? 'start' : 'center'}
            gap="2"
            style={{ minWidth: 0 }}
          >
            <IconBadge>{icon}</IconBadge>
            <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
              <Heading size="4">{title}</Heading>
              {subtitle != null ? (
                <Text
                  as="div"
                  size="2"
                  color="gray"
                  style={{ lineHeight: 1.35 }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </Flex>
          </Flex>
          {headerAction ? (
            <Box style={{ flexShrink: 0, alignSelf: 'start' }}>
              {headerAction}
            </Box>
          ) : null}
        </Flex>

        <Box style={contentBoxStyle}>{children}</Box>

        {footer && <Flex justify="end">{footer}</Flex>}
      </Flex>
    </Card>
  )
}
