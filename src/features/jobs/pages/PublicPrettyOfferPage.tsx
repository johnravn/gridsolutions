import { Box } from '@radix-ui/themes'
import { motion } from 'framer-motion'
import { PrettyOfferHero } from '../components/pretty-offer/PrettyOfferHero'
import { PrettyOfferModuleSlide } from '../components/pretty-offer/PrettyOfferModuleSlide'
import { PrettyOfferFooter } from '../components/pretty-offer/PrettyOfferFooter'
import { PrettyOfferStatusBanner } from '../components/pretty-offer/PrettyOfferStatusNotice'
import { hasPrettyOfferStatusNotice } from '../utils/prettyOfferStatusNotice'
import '../components/pretty-offer/prettyOfferDeckStyles.css'
import { usePublicOfferResponse } from '../hooks/usePublicOfferResponse'
import {
  buildDeckGradientCss,
  resolvePrettyOfferTheme,
} from '../utils/prettyOfferTheme'
import { buildPublicPrettyModule } from '../utils/prettyOfferCalculations'
import type { OfferDetail } from '../types'

type Props = {
  offer: OfferDetail
  accessToken: string
}

export default function PublicPrettyOfferPage({ offer, accessToken }: Props) {
  const prettyTheme = resolvePrettyOfferTheme(offer)
  const themeStyle = buildDeckGradientCss(prettyTheme)
  const response = usePublicOfferResponse(accessToken, offer)

  const canAccept = offer.status === 'sent'
  const showStatusNotice = hasPrettyOfferStatusNotice(offer)

  const showPricePerLine = offer.show_price_per_line !== false

  const modules = [...(offer.modules ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((module) => buildPublicPrettyModule(module, showPricePerLine))

  const hasModules = modules.length > 0

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
        ...themeStyle,
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {showStatusNotice && <PrettyOfferStatusBanner offer={offer} />}
        <PrettyOfferHero offer={offer} />
        {modules.map((module, index) => (
          <PrettyOfferModuleSlide
            key={module.id}
            index={index}
            module={module}
          />
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
    </Box>
  )
}
