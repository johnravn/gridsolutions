import { Box, Flex, Heading, Text, Theme } from '@radix-ui/themes'
import { PrettyOfferBlockRenderer } from './pretty-offer/PrettyOfferBlockRenderer'
import type { PublicPrettyOfferModule } from '../types'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

function EmptyState() {
  return (
    <Text size="2" color="gray" align="center">
      No modules to preview yet.
    </Text>
  )
}

type Props = {
  module: PublicPrettyOfferModule
}

function PrettyOfferModuleView({ module }: Props) {
  const sortedBlocks = [...(module.blocks ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  return (
    <Box
      mb="6"
      p="5"
      style={{
        background: 'var(--color-panel-solid)',
        borderRadius: 16,
        border: '1px solid var(--gray-a4)',
        boxShadow: '0 8px 24px var(--gray-a3)',
      }}
    >
      {module.title && (
        <Heading size="5" mb="4">
          {module.title}
        </Heading>
      )}

      {sortedBlocks.map((block, index) => (
        <PrettyOfferBlockRenderer key={block.id} block={block} index={index} />
      ))}

      {module.show_price && module.display_price != null && (
        <Flex
          justify="end"
          mt="4"
          pt="3"
          style={{ borderTop: '1px solid var(--gray-a4)' }}
        >
          <Box
            px="3"
            py="2"
            style={{
              background: 'var(--accent-a3)',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            <Text size="3" weight="bold">
              {formatMoney(module.display_price)}
            </Text>
          </Box>
        </Flex>
      )}
    </Box>
  )
}

PrettyOfferModuleView.EmptyState = EmptyState

type ThemedProps = Props & {
  radixAccent?: RadixAccentColor | null
  themeStyle?: Record<string, string>
}

export function ThemedPrettyOfferModuleView({
  radixAccent,
  themeStyle,
  ...props
}: ThemedProps) {
  const moduleView = <PrettyOfferModuleView {...props} />

  if (themeStyle) {
    return <Box style={themeStyle}>{moduleView}</Box>
  }

  if (radixAccent) {
    return <Theme accentColor={radixAccent}>{moduleView}</Theme>
  }

  return moduleView
}

export default PrettyOfferModuleView
