import * as React from 'react'
import { Box, Flex, SegmentedControl, Text } from '@radix-ui/themes'
import { Lock } from 'iconoir-react'

export default function LoggingMonthScroller({
  value,
  onValueChange,
  months,
  lockedMonthSet,
}: {
  value: string
  onValueChange: (value: string) => void
  months: Array<{ label: string; value: string }>
  lockedMonthSet: Set<string>
}) {
  const scrollerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const active = root.querySelector<HTMLElement>(
      '.rt-SegmentedControlItem[data-state="on"]',
    )
    if (!active) return
    active.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [value])

  return (
    <Box ref={scrollerRef} className="logging-month-scroller">
      <SegmentedControl.Root value={value} onValueChange={onValueChange}>
        {months.map((month) => {
          const isLocked = lockedMonthSet.has(month.value)
          return (
            <SegmentedControl.Item
              key={month.value}
              value={month.value}
              style={
                isLocked
                  ? {
                      backgroundColor: 'var(--green-3)',
                      color: 'var(--green-11)',
                    }
                  : undefined
              }
            >
              <Flex align="center" gap="1">
                <Text size="1">{month.label}</Text>
                {isLocked && <Lock width={12} height={12} />}
              </Flex>
            </SegmentedControl.Item>
          )
        })}
      </SegmentedControl.Root>
    </Box>
  )
}
