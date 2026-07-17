import { Box } from '@radix-ui/themes'
import { PrettyOfferHero } from '../../pretty-offer/PrettyOfferHero'
import { PrettyOfferModuleSlide } from '../../pretty-offer/PrettyOfferModuleSlide'
import { PrettyOfferFooter } from '../../pretty-offer/PrettyOfferFooter'
import { PrettyOfferOptionsProvider } from '../../pretty-offer/PrettyOfferOptionsContext'
import PrettyOfferModuleView from '../../PrettyOfferModuleView'
import {
  applyComputedCostsToModules,
  buildPrettyOfferPricingFields,
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
import type { RentalFactorConfig } from '../../../utils/offerCalculations'

type Props = {
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
  technicalOffersById: Map<string, OfferDetail>
  offerBasesById: Map<string, OfferBasisDetail>
  jobQuotesById: Map<string, JobSubcontractorQuote>
  daysOfUse: number
  vatPercent?: number
  discountPercent?: number
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
  subcontractorMarkupPercent?: number
  offer?: OfferDetail | null
  prettyUseCustomerBrandColors?: boolean
  showPricePerLine?: boolean
}

export function PreviewSection({
  modules,
  pricingBases,
  technicalOffersById,
  offerBasesById,
  jobQuotesById,
  daysOfUse,
  vatPercent = 25,
  discountPercent = 0,
  rentalFactorConfig,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
  vehicleDailyRate,
  subcontractorMarkupPercent = 0,
  offer,
  prettyUseCustomerBrandColors = false,
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
    subcontractorMarkupPercent,
  })

  const sorted = [...modulesWithCost].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  const publicModules = sorted.map((module) =>
    buildPublicPrettyModule(
      { ...module, content_blocks: module.content_blocks },
      showPricePerLine,
    ),
  )

  const theme = resolvePrettyOfferTheme({
    pretty_use_customer_accent: prettyUseCustomerBrandColors,
    pretty_use_customer_background: prettyUseCustomerBrandColors,
    customer: offer?.customer,
  })

  const themeStyle = buildDeckGradientCss(theme)

  const previewOffer: OfferDetail | null = offer
    ? ({
        ...offer,
        title: offer.title,
        pretty_intro_text: offer.pretty_intro_text ?? null,
        offer_type: 'pretty',
        ...buildPrettyOfferPricingFields(modulesWithCost, {
          daysOfUse,
          vatPercent: offer.vat_percent ?? vatPercent,
          discountPercent: offer.discount_percent ?? discountPercent,
        }),
      } as OfferDetail)
    : null

  const content =
    sorted.length === 0 ? (
      <PrettyOfferModuleView.EmptyState />
    ) : previewOffer ? (
      <PrettyOfferOptionsProvider modules={modulesWithCost}>
        <PrettyOfferHero offer={previewOffer} />
        {publicModules.map((module, index) => (
          <PrettyOfferModuleSlide
            key={module.id}
            index={index}
            module={module}
          />
        ))}
        <PrettyOfferFooter
          preview
          offer={previewOffer}
          modules={publicModules}
          showPricePerLine={showPricePerLine}
        />
      </PrettyOfferOptionsProvider>
    ) : (
      sorted.map((module) => (
        <PrettyOfferModuleView
          key={module.id}
          module={buildPublicPrettyModule(
            { ...module, content_blocks: module.content_blocks },
            showPricePerLine,
          )}
        />
      ))
    )

  return (
    <Box
      className={[
        'pretty-deck-root',
        theme.useCustomerBrandColors ? 'pretty-deck-root--customer-brand' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      p="0"
      style={{
        background: 'var(--gray-a2)',
        borderRadius: 12,
        minHeight: '100%',
        overflow: 'hidden',
        ...themeStyle,
      }}
    >
      {content}
    </Box>
  )
}
