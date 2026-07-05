import type { ReactNode } from 'react'
import { Box, Theme } from '@radix-ui/themes'
import { motion } from 'framer-motion'
import { PrettyOfferHero } from '../components/pretty-offer/PrettyOfferHero'
import { PrettyOfferModuleSlide } from '../components/pretty-offer/PrettyOfferModuleSlide'
import { PrettyOfferFooter } from '../components/pretty-offer/PrettyOfferFooter'
import '../components/pretty-offer/prettyOfferDeckStyles.css'
import { usePublicOfferResponse } from '../hooks/usePublicOfferResponse'
import {
  buildDeckGradientCss,
  resolvePrettyOfferTheme,
} from '../utils/prettyOfferTheme'
import { buildPublicPrettyModule } from '../utils/prettyOfferCalculations'
import type { OfferDetail } from '../types'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'

function ThemeOptionalWrapper({
  enabled,
  accent,
  children,
}: {
  enabled: boolean
  accent: RadixAccentColor | null
  children: ReactNode
}) {
  if (enabled && accent) {
    return <Theme accentColor={accent}>{children}</Theme>
  }
  return <>{children}</>
}

type Props = {
  offer: OfferDetail
  accessToken: string
}

export default function PublicPrettyOfferPage({ offer, accessToken }: Props) {
  const prettyTheme = resolvePrettyOfferTheme(offer)
  const themeStyle = buildDeckGradientCss(prettyTheme)
  const response = usePublicOfferResponse(accessToken, offer)

  const canAccept = offer.status === 'sent'
  const isAccepted = offer.status === 'accepted'
  const isRejected = offer.status === 'rejected'
  const isSuperseded = offer.status === 'superseded'

  const showPricePerLine = offer.show_price_per_line !== false

  const modules = [...(offer.modules ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((module) => buildPublicPrettyModule(module, showPricePerLine))

  const hasModules = modules.length > 0

  return (
    <Box
      className="pretty-deck-root pretty-deck-page"
      style={{
        position: 'relative',
        zIndex: 1,
        ...themeStyle,
      }}
    >
      <ThemeOptionalWrapper
        enabled={Boolean(
          prettyTheme.useCustomerAccent && prettyTheme.radixAccent,
        )}
        accent={prettyTheme.radixAccent}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
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
              isAccepted={isAccepted}
              isRejected={isRejected}
              isSuperseded={isSuperseded}
              response={response}
            />
          )}
        </motion.div>
      </ThemeOptionalWrapper>
    </Box>
  )
}
