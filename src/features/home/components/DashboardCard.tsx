import * as React from 'react'
import { Badge, Box, Card, Flex, Heading, Text } from '@radix-ui/themes'

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
  count,
  variant = 'card',
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
  /** Shown beside the title when > 0 (e.g. unread / pending counts). */
  count?: number
  /** `plain` = title + content only (no outer Card). Used on mobile home. */
  variant?: 'card' | 'plain'
}) {
  const isPlain = variant === 'plain'

  const cardStyle: React.CSSProperties | undefined =
    !isPlain && (fillHeight || !notFullHeight)
      ? {
          height: '100%',
          flex: 1,
          minHeight: 0,
          alignSelf: 'stretch',
          display: 'flex',
          flexDirection: 'column',
        }
      : undefined

  const columnStyle: React.CSSProperties = isPlain
    ? {}
    : fillHeight
      ? { flex: 1, minHeight: 0, overflow: 'hidden' }
      : notFullHeight
        ? {}
        : { height: '100%' }

  const contentBoxStyle: React.CSSProperties | undefined = isPlain
    ? undefined
    : notFullHeight
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

  const body = (
    <Flex direction="column" gap={isPlain ? '4' : '3'} style={columnStyle}>
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
          {!isPlain ? <IconBadge>{icon}</IconBadge> : null}
          <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
            <Flex align="center" gap="2" style={{ minWidth: 0 }}>
              <Heading size={isPlain ? '5' : '4'} weight="bold">
                {title}
              </Heading>
              {count != null && count > 0 ? (
                <Badge
                  size="1"
                  radius="full"
                  highContrast
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    fontSize: 'var(--font-size-1)',
                    flexShrink: 0,
                  }}
                >
                  {count > 99 ? '99+' : count}
                </Badge>
              ) : null}
            </Flex>
            {subtitle != null ? (
              <Text as="div" size="2" color="gray" style={{ lineHeight: 1.35 }}>
                {subtitle}
              </Text>
            ) : null}
          </Flex>
        </Flex>
        {headerAction ? (
          <Box style={{ flexShrink: 0, alignSelf: 'center' }}>
            {headerAction}
          </Box>
        ) : null}
      </Flex>

      <Box style={contentBoxStyle}>{children}</Box>

      {footer && <Flex justify="end">{footer}</Flex>}
    </Flex>
  )

  if (isPlain) {
    return <Box style={{ width: '100%', minWidth: 0 }}>{body}</Box>
  }

  return (
    <Card size="3" style={cardStyle}>
      {body}
    </Card>
  )
}
