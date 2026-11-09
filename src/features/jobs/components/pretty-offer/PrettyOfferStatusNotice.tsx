import { Box, Flex, Heading, Text } from '@radix-ui/themes'
import { resolvePrettyOfferStatusNotice } from '../../utils/prettyOfferStatusNotice'
import type { PrettyOfferStatusKind } from '../../utils/prettyOfferStatusNotice'
import type { OfferDetail } from '../../types'
import './prettyOfferDeckStyles.css'

const HEADING_COLOR: Record<
  PrettyOfferStatusKind,
  'orange' | 'green' | 'red' | 'blue'
> = {
  superseded: 'orange',
  accepted: 'green',
  rejected: 'red',
  revision: 'blue',
}

type Props = {
  offer: OfferDetail
  variant: 'banner' | 'card' | 'inline'
}

export function PrettyOfferStatusNotice({ offer, variant }: Props) {
  const notice = resolvePrettyOfferStatusNotice(offer)
  if (!notice) return null

  const headingColor = HEADING_COLOR[notice.kind]
  const summary = notice.lines[0]

  if (variant === 'inline') {
    return (
      <Box
        className={`pretty-deck-status-inline pretty-deck-status-inline--${notice.kind}`}
        role="status"
        title={[notice.title, ...notice.lines].join(' · ')}
      >
        <Text size="2" weight="bold" color={headingColor}>
          {notice.title}
        </Text>
        {summary ? (
          <Text size="1" color="gray" truncate style={{ maxWidth: 280 }}>
            {summary}
          </Text>
        ) : null}
      </Box>
    )
  }

  if (variant === 'banner') {
    return (
      <Box
        className={`pretty-deck-status-banner pretty-deck-status-banner--${notice.kind}`}
        role="status"
      >
        <Box className="pretty-deck-status-banner__inner">
          <Heading size="4" mb="1" color={headingColor}>
            {notice.title}
          </Heading>
          {notice.lines.map((line) => (
            <Text key={line} size="2" color="gray" as="p" mb="1">
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box
      mt="4"
      p="3"
      className={`pretty-deck-status-card pretty-deck-status-card--${notice.kind}`}
      role="status"
    >
      <Heading size="4" mb="1" color={headingColor}>
        {notice.title}
      </Heading>
      <Flex direction="column" gap="1">
        {notice.lines.map((line) => (
          <Text key={line} size="2" color="gray">
            {line}
          </Text>
        ))}
      </Flex>
    </Box>
  )
}

export function PrettyOfferStatusBanner({ offer }: { offer: OfferDetail }) {
  return <PrettyOfferStatusNotice offer={offer} variant="banner" />
}

export function PrettyOfferStatusInline({ offer }: { offer: OfferDetail }) {
  return <PrettyOfferStatusNotice offer={offer} variant="inline" />
}
