import * as React from 'react'
import { Box, Card, Flex, Heading } from '@radix-ui/themes'

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
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  headerAction?: React.ReactNode
  notFullHeight?: boolean
}) {
  return (
    <Card size="3" style={notFullHeight ? undefined : { height: '100%' }}>
      <Flex
        direction="column"
        gap="3"
        style={notFullHeight ? undefined : { height: '100%' }}
      >
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <IconBadge>{icon}</IconBadge>
            <Heading size="4">{title}</Heading>
          </Flex>
          {headerAction && <Box>{headerAction}</Box>}
        </Flex>

        <Box
          style={
            notFullHeight
              ? undefined
              : { flex: 1, minHeight: 0, overflowY: 'auto' }
          }
        >
          {children}
        </Box>

        {footer && <Flex justify="end">{footer}</Flex>}
      </Flex>
    </Card>
  )
}
