import { Badge, Box, Flex, Heading, Text } from '@radix-ui/themes'
import LazyImage from '@shared/ui/components/LazyImage'
import { supabase } from '@shared/api/supabase'
import { useTheme } from '@app/hooks/useTheme'
import './prettyOfferDeckStyles.css'
import type { OfferDetail } from '../../types'

function formatOfferNumberDisplay(offernr: number | null | undefined) {
  if (offernr == null) return null
  return String(offernr).padStart(4, '0')
}

function formatDateTimeShort(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  offer: OfferDetail
}

export function PrettyOfferHero({ offer }: Props) {
  const { isDark } = useTheme()

  const companyLogoPath = isDark
    ? offer.company?.logo_dark_path || offer.company?.logo_light_path
    : offer.company?.logo_light_path || offer.company?.logo_dark_path

  const companyLogoUrl = companyLogoPath
    ? supabase.storage.from('logos').getPublicUrl(companyLogoPath).data
        .publicUrl + `?v=${companyLogoPath}`
    : null

  const customerLogoUrl = offer.customer?.logo_path
    ? supabase.storage.from('logos').getPublicUrl(offer.customer.logo_path).data
        .publicUrl + `?v=${offer.customer.logo_path}`
    : null

  return (
    <Box className="pretty-deck-hero">
      <Box className="pretty-deck-hero__shapes" aria-hidden>
        <Box className="pretty-deck-hero__blob pretty-deck-hero__blob--1" />
        <Box className="pretty-deck-hero__blob pretty-deck-hero__blob--2" />
        <Box className="pretty-deck-hero__blob pretty-deck-hero__blob--3" />
      </Box>

      <Box className="pretty-deck-hero__content">
        {(companyLogoUrl || customerLogoUrl) && (
          <Flex className="pretty-deck-logo-lockup">
            {companyLogoUrl && (
              <Box className="pretty-deck-logo-lockup__logo pretty-deck-logo-lockup__logo--company">
                <img
                  src={companyLogoUrl}
                  alt={offer.company?.name || 'Company logo'}
                  style={{
                    display: 'block',
                    maxWidth: 'min(180px, 40vw)',
                    maxHeight: 72,
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                  }}
                />
              </Box>
            )}
            {companyLogoUrl && customerLogoUrl && (
              <Box className="pretty-deck-logo-lockup__divider" />
            )}
            {customerLogoUrl && (
              <LazyImage
                src={customerLogoUrl}
                alt={offer.customer?.name || 'Customer logo'}
                eager
                className="pretty-deck-logo-lockup__logo pretty-deck-logo-lockup__logo--customer"
                style={{ objectFit: 'contain' }}
              />
            )}
          </Flex>
        )}

        <Heading
          size="9"
          align="center"
          mb="3"
          style={{ lineHeight: 1.1, letterSpacing: '-0.02em' }}
        >
          {offer.title}
        </Heading>

        {offer.pretty_intro_text && (
          <Text
            size="5"
            align="center"
            color="gray"
            mb="4"
            style={{
              maxWidth: 720,
              margin: '0 auto 1.5rem',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
            as="div"
          >
            {offer.pretty_intro_text}
          </Text>
        )}

        <Flex justify="center" gap="3" wrap="wrap" mb="4">
          {formatOfferNumberDisplay(offer.offernr) ? (
            <Badge size="2" variant="soft" color="gray">
              Offer {formatOfferNumberDisplay(offer.offernr)}
            </Badge>
          ) : null}
          <Badge size="2" variant="soft">
            Version {offer.version_number}
          </Badge>
        </Flex>

        {(offer.job_start_at || offer.job_end_at || offer.job_address) && (
          <Flex
            justify="center"
            gap="6"
            wrap="wrap"
            style={{ textAlign: 'center' }}
          >
            {offer.job_start_at && (
              <Flex direction="column" gap="1">
                <Text size="1" color="gray" weight="medium">
                  Start
                </Text>
                <Text size="2" weight="medium">
                  {formatDateTimeShort(offer.job_start_at)}
                </Text>
              </Flex>
            )}
            {offer.job_end_at && (
              <Flex direction="column" gap="1">
                <Text size="1" color="gray" weight="medium">
                  End
                </Text>
                <Text size="2" weight="medium">
                  {formatDateTimeShort(offer.job_end_at)}
                </Text>
              </Flex>
            )}
            {offer.job_address && (
              <Flex direction="column" gap="1" style={{ maxWidth: 320 }}>
                <Text size="1" color="gray" weight="medium">
                  Location
                </Text>
                <Text
                  size="2"
                  weight="medium"
                  as="div"
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {offer.job_address.replace(/, /g, ',\n')}
                </Text>
              </Flex>
            )}
          </Flex>
        )}
      </Box>
    </Box>
  )
}
