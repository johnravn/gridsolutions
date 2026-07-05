import { Box, Theme } from '@radix-ui/themes'
import { PrettyOfferHero } from '../../pretty-offer/PrettyOfferHero'
import { PrettyOfferModuleSlide } from '../../pretty-offer/PrettyOfferModuleSlide'
import PrettyOfferModuleView from '../../PrettyOfferModuleView'
import {
  applyComputedCostsToModules,
  buildPublicPrettyModule,
} from '../../../utils/prettyOfferCalculations'
import {
  buildDeckGradientCss,
  resolvePrettyOfferTheme,
} from '../../../utils/prettyOfferTheme'
import type { LocalPrettyModule, LocalPricingBasis } from './types'
import type {
  JobSubcontractorQuote,
  OfferBasisDetail,
  OfferDetail,
} from '../../../types'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'
import type { RentalFactorConfig } from '../../../utils/offerCalculations'

type Props = {
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
  technicalOffersById: Map<string, OfferDetail>
  offerBasesById: Map<string, OfferBasisDetail>
  jobQuotesById: Map<string, JobSubcontractorQuote>
  daysOfUse: number
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
  offer?: Pick<
    OfferDetail,
    | 'title'
    | 'offernr'
    | 'version_number'
    | 'pretty_intro_text'
    | 'pretty_use_customer_accent'
    | 'pretty_use_customer_background'
    | 'job_start_at'
    | 'job_end_at'
    | 'job_address'
    | 'customer'
    | 'company'
  > | null
  prettyUseCustomerAccent?: boolean
  prettyUseCustomerBackground?: boolean
  showPricePerLine?: boolean
}

export function PreviewSection({
  modules,
  pricingBases,
  technicalOffersById,
  offerBasesById,
  jobQuotesById,
  daysOfUse,
  rentalFactorConfig,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
  vehicleDailyRate,
  offer,
  prettyUseCustomerAccent = false,
  prettyUseCustomerBackground = false,
  showPricePerLine = false,
}: Props) {
  const technicalContext = {
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
    daysOfUse,
  }

  const modulesWithCost = applyComputedCostsToModules(modules, pricingBases, {
    technicalOffersById,
    offerBasesById,
    jobQuotesById,
    technicalContext,
  })

  const sorted = [...modulesWithCost].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  const theme = resolvePrettyOfferTheme({
    pretty_use_customer_accent: prettyUseCustomerAccent,
    pretty_use_customer_background: prettyUseCustomerBackground,
    customer: offer?.customer,
  })

  const themeStyle = buildDeckGradientCss(theme)
  const radixAccent: RadixAccentColor | null =
    theme.useCustomerAccent && theme.radixAccent ? theme.radixAccent : null

  const previewOffer: OfferDetail | null = offer
    ? ({
        ...offer,
        title: offer.title,
        pretty_intro_text: offer.pretty_intro_text ?? null,
        offer_type: 'pretty',
      } as OfferDetail)
    : null

  const content =
    sorted.length === 0 ? (
      <PrettyOfferModuleView.EmptyState />
    ) : previewOffer ? (
      <>
        <PrettyOfferHero offer={previewOffer} />
        {sorted.map((module, index) => (
          <PrettyOfferModuleSlide
            key={module.id}
            index={index}
            module={buildPublicPrettyModule(
              { ...module, content_blocks: module.content_blocks },
              showPricePerLine,
            )}
          />
        ))}
      </>
    ) : (
      sorted.map((module) => (
        <PrettyOfferModuleView
          key={module.id}
          useCustomerBackground={theme.useCustomerBackground}
          module={buildPublicPrettyModule(
            { ...module, content_blocks: module.content_blocks },
            showPricePerLine,
          )}
        />
      ))
    )

  return (
    <Box
      p="0"
      style={{
        background: 'var(--gray-a2)',
        borderRadius: 12,
        minHeight: '100%',
        overflow: 'hidden',
        ...themeStyle,
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
