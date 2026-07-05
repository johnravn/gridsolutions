import { Box, Flex, Heading, Text } from '@radix-ui/themes'
import {
  getModuleStoryPairs,
  resolveModuleCustomerPrice,
} from '../../utils/prettyOfferCalculations'
import {
  HeroMediaDisplay,
  PrettyOfferBlockRenderer,
} from './PrettyOfferBlockRenderer'
import { TimelineBlock } from './TimelineBlock'
import './prettyOfferDeckStyles.css'
import type { PublicPrettyOfferModule } from '../../types'

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

function hasDeckStory(module: PublicPrettyOfferModule): boolean {
  return Boolean(
    getModuleStoryPairs(module).length > 0 || module.hero_media_url?.trim(),
  )
}

function StoryPairBlock({
  heading,
  body,
  variant,
}: {
  heading: string | null
  body: string
  variant: 'neutral' | 'accent'
}) {
  return (
    <Box
      className={
        variant === 'accent' ? 'pretty-deck-solution' : 'pretty-deck-problem'
      }
    >
      {heading && (
        <Text
          size="1"
          weight="bold"
          mb="1"
          className={
            variant === 'accent'
              ? 'pretty-deck-story-heading--accent'
              : undefined
          }
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
          color={variant === 'accent' ? undefined : 'gray'}
          as="div"
        >
          {heading}
        </Text>
      )}
      <Text
        size="3"
        weight={variant === 'accent' ? 'medium' : undefined}
        style={{ whiteSpace: 'pre-wrap' }}
        as="div"
      >
        {body}
      </Text>
    </Box>
  )
}

type Props = {
  module: PublicPrettyOfferModule
  index: number
}

export function PrettyOfferModuleSlide({ module, index }: Props) {
  const customerPrice = resolveModuleCustomerPrice(module)

  if (module.module_type === 'timeline') {
    return (
      <Box className="pretty-deck-slide pretty-deck-slide--accent" mb="0">
        <Box className="pretty-deck-slide__inner">
          {module.title && (
            <Heading size="6" mb="4">
              {module.title}
            </Heading>
          )}
          <TimelineBlock items={module.timeline_items ?? []} />
          {customerPrice != null && (
            <Flex justify="end" mt="4">
              <Box className="pretty-deck-price-pill">
                <Text size="3" weight="bold">
                  {formatMoney(customerPrice)}
                </Text>
              </Box>
            </Flex>
          )}
        </Box>
      </Box>
    )
  }

  const sortedBlocks = [...(module.blocks ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  const storyPairs = getModuleStoryPairs(module)
  const reversed = index % 2 === 1
  const variant = index % 2 === 0 ? 'accent' : 'neutral'

  if (!hasDeckStory(module)) {
    return (
      <Box className={`pretty-deck-slide pretty-deck-slide--${variant}`} mb="0">
        <Box className="pretty-deck-slide__inner">
          {module.title && (
            <Heading size="6" mb="4">
              {module.title}
            </Heading>
          )}
          {sortedBlocks.map((block, blockIndex) => (
            <PrettyOfferBlockRenderer
              key={block.id}
              block={block}
              index={blockIndex}
            />
          ))}
          {customerPrice != null && (
            <Flex justify="end" mt="4">
              <Box className="pretty-deck-price-pill">
                <Text size="3" weight="bold">
                  {formatMoney(customerPrice)}
                </Text>
              </Box>
            </Flex>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box className={`pretty-deck-slide pretty-deck-slide--${variant}`}>
      <Box className="pretty-deck-slide__shape pretty-deck-slide__shape--circle" />
      <Box className="pretty-deck-slide__shape pretty-deck-slide__shape--diagonal" />

      <Box className="pretty-deck-slide__inner">
        <Box
          className={`pretty-deck-slide__grid${reversed ? ' pretty-deck-slide__grid--reversed' : ''}`}
        >
          <Box className="pretty-deck-slide__media">
            <HeroMediaDisplay
              mediaType={module.hero_media_type}
              mediaUrl={module.hero_media_url}
              caption={module.hero_media_caption}
              title={module.title}
            />
          </Box>

          <Box className="pretty-deck-slide__narrative">
            <Heading
              size="8"
              mb="2"
              style={{ lineHeight: 1.1, letterSpacing: '-0.02em' }}
            >
              {module.title || 'Untitled module'}
            </Heading>

            {module.tagline && (
              <Text
                size="4"
                weight="medium"
                mb="3"
                className="pretty-deck-slide__tagline"
                as="div"
              >
                {module.tagline}
              </Text>
            )}

            {storyPairs.map((pair, pairIndex) => (
              <StoryPairBlock
                key={pairIndex}
                heading={pair.heading}
                body={pair.body}
                variant={pairIndex % 2 === 0 ? 'neutral' : 'accent'}
              />
            ))}

            {module.hero_media_caption && (
              <Text size="2" color="gray" mt="2" as="div">
                {module.hero_media_caption}
              </Text>
            )}

            {customerPrice != null && (
              <Flex mt="4">
                <Box className="pretty-deck-price-pill pretty-deck-price-pill--solid">
                  <Text size="3" weight="bold">
                    {formatMoney(customerPrice)}
                  </Text>
                </Box>
              </Flex>
            )}
          </Box>
        </Box>

        {sortedBlocks.length > 0 && (
          <Box className="pretty-deck-blocks">
            {sortedBlocks.map((block, blockIndex) => (
              <PrettyOfferBlockRenderer
                key={block.id}
                block={block}
                index={blockIndex}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
