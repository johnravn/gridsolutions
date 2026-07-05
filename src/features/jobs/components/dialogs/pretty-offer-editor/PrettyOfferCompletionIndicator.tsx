import { Flex, Text } from '@radix-ui/themes'
import { Check, WarningTriangle } from 'iconoir-react'
import type { PrettyOfferModuleCompletionStats } from '../../../utils/prettyOfferCalculations'

type Props = {
  stats: PrettyOfferModuleCompletionStats
}

export function PrettyOfferCompletionIndicator({ stats }: Props) {
  const containerStyle = {
    width: 'fit-content',
    flexShrink: 0,
    borderRadius: 'var(--radius-3)',
  } as const

  if (stats.moduleCount === 0) {
    return (
      <Flex
        align="center"
        gap="2"
        px="2"
        py="1"
        style={{
          ...containerStyle,
          background: 'var(--gray-a2)',
          border: '1px solid var(--gray-a5)',
        }}
      >
        <Text size="2" color="gray" wrap="nowrap">
          Add modules — each needs a title, story, and hero media
        </Text>
      </Flex>
    )
  }

  const fieldLabel = stats.remaining === 1 ? 'field' : 'fields'

  return (
    <Flex
      align="center"
      gap="2"
      px="2"
      py="1"
      style={{
        ...containerStyle,
        background: stats.isComplete ? 'var(--green-a2)' : 'var(--orange-a2)',
        border: `1px solid ${stats.isComplete ? 'var(--green-a5)' : 'var(--orange-a5)'}`,
      }}
    >
      {stats.isComplete ? (
        <Check width={16} height={16} color="var(--green-11)" />
      ) : (
        <WarningTriangle width={16} height={16} color="var(--orange-11)" />
      )}
      <Text
        size="2"
        color={stats.isComplete ? 'green' : 'orange'}
        wrap="nowrap"
      >
        {stats.isComplete
          ? `All ${stats.totalRequired} required fields complete`
          : `${stats.remaining} of ${stats.totalRequired} required ${fieldLabel} remaining`}
      </Text>
    </Flex>
  )
}
