import * as React from 'react'
import { Badge, Box, Flex, Text } from '@radix-ui/themes'
import { motion } from 'framer-motion'
import { PrettyOfferHero } from '../components/pretty-offer/PrettyOfferHero'
import { PrettyOfferModuleSlide } from '../components/pretty-offer/PrettyOfferModuleSlide'
import { PrettyOfferFooter } from '../components/pretty-offer/PrettyOfferFooter'
import { PrettyOfferStatusBanner } from '../components/pretty-offer/PrettyOfferStatusNotice'
import {
  PrettyOfferOptionsProvider,
  usePrettyOfferOptions,
} from '../components/pretty-offer/PrettyOfferOptionsContext'
import { hasPrettyOfferStatusNotice } from '../utils/prettyOfferStatusNotice'
import '../components/pretty-offer/prettyOfferDeckStyles.css'
import { usePublicOfferResponse } from '../hooks/usePublicOfferResponse'
import {
  buildDeckGradientCss,
  resolvePrettyOfferTheme,
} from '../utils/prettyOfferTheme'
import { buildPublicPrettyModule } from '../utils/prettyOfferCalculations'
import { formatOfferAlternativeLabel } from '../utils/publicOfferAlternatives'
import type { OfferDetail, PublicOfferAlternative } from '../types'

type Props = {
  offer: OfferDetail
  accessToken: string
  alternatives?: Array<PublicOfferAlternative>
  defaultOfferId?: string
}

function tabStatusBadge(alt: PublicOfferAlternative): {
  label: string
  color: 'green' | 'red' | 'orange' | 'blue'
} | null {
  if (alt.offer.revision_requested_at && alt.status !== 'superseded') {
    return { label: 'Revision', color: 'blue' }
  }
  switch (alt.status) {
    case 'accepted':
      return { label: 'Accepted', color: 'green' }
    case 'rejected':
      return { label: 'Rejected', color: 'red' }
    case 'superseded':
      return { label: 'Superseded', color: 'orange' }
    default:
      return null
  }
}

function AlternativeTabs({
  alternatives,
  selectedOfferId,
  onSelect,
}: {
  alternatives: Array<PublicOfferAlternative>
  selectedOfferId: string
  onSelect: (offerId: string) => void
}) {
  return (
    <Box
      className="pretty-offer-alt-tabs"
      px={{ initial: '3', sm: '5' }}
      py="3"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
        // Soft accent wash, mixed toward solid panel so sticky content
        // underneath does not show through.
        background:
          'linear-gradient(135deg, color-mix(in oklab, var(--accent-a3) 45%, var(--color-panel-solid)) 0%, color-mix(in oklab, var(--gray-a2) 35%, var(--color-panel-solid)) 45%, color-mix(in oklab, var(--accent-a2) 40%, var(--color-panel-solid)) 100%)',
        borderBottom: '1px solid var(--accent-a4)',
      }}
    >
      <Flex
        gap="2"
        wrap="wrap"
        justify="center"
        align="center"
        width="100%"
        role="tablist"
        aria-label="Offer alternatives"
      >
        {alternatives.map((alt) => {
          const selected = alt.offer.id === selectedOfferId
          const statusBadge = tabStatusBadge(alt)
          const muted = alt.status === 'superseded' && !selected
          return (
            <button
              key={alt.offer.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(alt.offer.id)}
              style={{
                appearance: 'none',
                cursor: 'pointer',
                borderRadius: 999,
                border: selected
                  ? '2px solid var(--accent-9)'
                  : '1px solid var(--gray-a7)',
                background: selected
                  ? 'color-mix(in oklab, var(--accent-a4) 70%, var(--color-panel-solid))'
                  : 'color-mix(in oklab, var(--color-panel-solid) 70%, transparent)',
                opacity: muted ? 0.72 : 1,
                padding: '10px 18px',
                minWidth: 140,
              }}
            >
              <Flex align="center" justify="center" gap="2">
                <Text
                  size="3"
                  weight={selected ? 'bold' : 'medium'}
                  style={{ letterSpacing: '0.01em' }}
                >
                  {formatOfferAlternativeLabel(alt.sub_version)}
                </Text>
                {statusBadge && (
                  <Badge color={statusBadge.color} variant="soft" size="1">
                    {statusBadge.label}
                  </Badge>
                )}
              </Flex>
            </button>
          )
        })}
      </Flex>
    </Box>
  )
}

function PublicPrettyOfferPageContent({
  offer,
  accessToken,
  showStatusBanner,
  statusBannerStatic = false,
}: {
  offer: OfferDetail
  accessToken: string
  showStatusBanner: boolean
  statusBannerStatic?: boolean
}) {
  const optionsContext = usePrettyOfferOptions()
  const response = usePublicOfferResponse(accessToken, offer, {
    getSelectedOptionIds: () => [...(optionsContext?.selectedOptionIds ?? [])],
  })

  const canAccept = offer.status === 'sent'
  const showStatusNotice = showStatusBanner && hasPrettyOfferStatusNotice(offer)

  const showPricePerLine = offer.show_price_per_line !== false

  const modules = [...(offer.modules ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((module) => buildPublicPrettyModule(module, showPricePerLine))

  const hasModules = modules.length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {showStatusNotice && (
        <Box
          className={
            statusBannerStatic ? 'pretty-deck-status-banner-static' : undefined
          }
        >
          <PrettyOfferStatusBanner offer={offer} />
        </Box>
      )}
      <PrettyOfferHero offer={offer} />
      {modules.map((module, index) => (
        <PrettyOfferModuleSlide key={module.id} index={index} module={module} />
      ))}
      {hasModules && (
        <PrettyOfferFooter
          offer={offer}
          modules={modules}
          showPricePerLine={showPricePerLine}
          canAccept={canAccept}
          response={response}
        />
      )}
    </motion.div>
  )
}

export default function PublicPrettyOfferPage({
  offer,
  accessToken,
  alternatives,
  defaultOfferId,
}: Props) {
  const hasAlternatives = (alternatives?.length ?? 0) >= 2
  const [selectedOfferId, setSelectedOfferId] = React.useState(
    () => defaultOfferId ?? offer.id,
  )

  React.useEffect(() => {
    if (defaultOfferId) setSelectedOfferId(defaultOfferId)
  }, [defaultOfferId])

  const selected =
    alternatives?.find((alt) => alt.offer.id === selectedOfferId)?.offer ??
    offer

  const prettyTheme = resolvePrettyOfferTheme(selected)
  const themeStyle = buildDeckGradientCss(prettyTheme)

  return (
    <Box
      className={[
        'pretty-deck-root pretty-deck-page',
        prettyTheme.useCustomerBrandColors
          ? 'pretty-deck-root--customer-brand'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
        background:
          'var(--pretty-deck-hero-gradient, linear-gradient(135deg, var(--accent-a3) 0%, var(--gray-a2) 45%, var(--accent-a2) 100%))',
        backgroundAttachment: 'fixed',
        ...themeStyle,
      }}
    >
      {hasAlternatives && alternatives ? (
        <Box className="pretty-offer-sticky-header">
          <AlternativeTabs
            alternatives={alternatives}
            selectedOfferId={selected.id}
            onSelect={setSelectedOfferId}
          />
        </Box>
      ) : null}
      <PrettyOfferOptionsProvider
        key={selected.id}
        modules={selected.modules ?? []}
        acceptedSelections={selected.accepted_option_selections}
      >
        <PublicPrettyOfferPageContent
          offer={selected}
          accessToken={accessToken}
          showStatusBanner
          statusBannerStatic={hasAlternatives}
        />
      </PrettyOfferOptionsProvider>
    </Box>
  )
}
