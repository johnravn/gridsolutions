import { Box, Card } from '@radix-ui/themes'
import type * as React from 'react'

/** Constrained height so VirtualIndexTable gets a scroll parent on Reporting. */
export const REPORT_TABLE_HEIGHT =
  'min(560px, max(280px, calc(100svh - 320px)))'

export function ReportTableShell({
  children,
  header,
}: {
  children: React.ReactNode
  header?: React.ReactNode
}) {
  return (
    <Card
      size="3"
      style={{
        height: REPORT_TABLE_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 280,
        overflow: 'hidden',
      }}
    >
      {header ? <Box mb="2">{header}</Box> : null}
      <Box style={{ flex: 1, minHeight: 0, minWidth: 0 }}>{children}</Box>
    </Card>
  )
}
