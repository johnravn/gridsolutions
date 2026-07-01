import { Box, Theme } from '@radix-ui/themes'
import PrettyOfferModuleView from '../../PrettyOfferModuleView'
import {
  buildCustomAccentCss,
  resolvePrettyOfferTheme,
} from '../../../utils/prettyOfferTheme'
import type { LocalPrettyModule } from './types'
import type { OfferDetail } from '../../../types'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'

type Props = {
  modules: Array<LocalPrettyModule>
  offer?: Pick<
    OfferDetail,
    'pretty_use_customer_accent' | 'pretty_use_customer_background' | 'customer'
  > | null
  prettyUseCustomerAccent?: boolean
  prettyUseCustomerBackground?: boolean
}

export function PreviewSection({
  modules,
  offer,
  prettyUseCustomerAccent = false,
  prettyUseCustomerBackground = false,
}: Props) {
  const sorted = [...modules].sort((a, b) => a.sort_order - b.sort_order)

  const theme = resolvePrettyOfferTheme({
    pretty_use_customer_accent: prettyUseCustomerAccent,
    pretty_use_customer_background: prettyUseCustomerBackground,
    customer: offer?.customer,
  })

  const themeStyle =
    theme.useCustomerAccent && theme.customHex
      ? buildCustomAccentCss(theme.customHex)
      : undefined
  const radixAccent: RadixAccentColor | null =
    theme.useCustomerAccent && theme.radixAccent ? theme.radixAccent : null

  const content =
    sorted.length === 0 ? (
      <PrettyOfferModuleView.EmptyState />
    ) : (
      sorted.map((module) => (
        <PrettyOfferModuleView
          key={module.id}
          useCustomerBackground={theme.useCustomerBackground}
          module={{
            id: module.id,
            title: module.title,
            sort_order: module.sort_order,
            display_price: module.display_price,
            show_price: module.show_price,
            blocks: module.content_blocks,
          }}
        />
      ))
    )

  return (
    <Box
      p="4"
      style={{
        background: 'var(--gray-a2)',
        borderRadius: 12,
        minHeight: '100%',
        ...(themeStyle ?? {}),
      }}
    >
      {radixAccent ? (
        <Theme accentColor={radixAccent}>{content}</Theme>
      ) : (
        content
      )}
    </Box>
  )
}
