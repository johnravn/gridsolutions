import * as React from 'react'
import { Box, Button, Flex, Heading, Text, Theme } from '@radix-ui/themes'
import { Link as LinkIcon } from 'iconoir-react'
import {
  motionEaseRevealOut,
  motionOffsetRevealY,
  motionRevealTransition,
} from '@shared/lib/motion'
import {
  isStorageMediaPath,
  resolvePrettyOfferMediaUrl,
} from '../utils/prettyOfferMediaUpload'
import { InteractiveListBlock } from './pretty-offer/InteractiveListBlock'
import { GalleryBlock } from './pretty-offer/GalleryBlock'
import { TimelineBlock } from './pretty-offer/TimelineBlock'
import type { PrettyOfferModuleBlock, PublicPrettyOfferModule } from '../types'
import type { RadixAccentColor } from '@shared/theme/accentColorTypes'

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace('/', '')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const videoId = parsed.pathname.split('/').filter(Boolean).pop()
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
  } catch {
    return null
  }
  return null
}

function MediaBlock({ block }: { block: PrettyOfferModuleBlock }) {
  if (block.block_type === 'video' && block.url) {
    const embedUrl = getVideoEmbedUrl(block.url)
    const uploadedUrl = isStorageMediaPath(block.url)
      ? resolvePrettyOfferMediaUrl(block.url)
      : null

    return (
      <Box mb="3">
        {embedUrl ? (
          <Box
            style={{
              position: 'relative',
              paddingBottom: '56.25%',
              height: 0,
              overflow: 'hidden',
              borderRadius: 12,
            }}
          >
            <iframe
              src={embedUrl}
              title={block.link_title || 'Video'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 0,
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Box>
        ) : uploadedUrl ? (
          <video
            src={uploadedUrl}
            controls
            style={{
              width: '100%',
              maxHeight: 360,
              borderRadius: 12,
              display: 'block',
            }}
          />
        ) : (
          <Button asChild variant="soft" size="3">
            <a href={block.url} target="_blank" rel="noreferrer">
              {block.link_title || 'Watch video'}
            </a>
          </Button>
        )}
        {block.caption && (
          <Text size="2" color="gray" mt="2" as="div">
            {block.caption}
          </Text>
        )}
      </Box>
    )
  }

  if (block.block_type === 'link' && block.url) {
    return (
      <Box mb="3">
        <Button asChild size="3" variant="surface" style={{ width: '100%' }}>
          <a href={block.url} target="_blank" rel="noreferrer">
            <Flex align="center" justify="center" gap="2">
              <LinkIcon width={18} height={18} />
              <Text weight="medium">{block.link_title || block.url}</Text>
            </Flex>
          </a>
        </Button>
        {block.caption && (
          <Text size="2" color="gray" mt="2" as="div">
            {block.caption}
          </Text>
        )}
      </Box>
    )
  }

  return null
}

function AnimatedBlock({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), index * 60)
    return () => window.clearTimeout(timer)
  }, [index])

  return (
    <Box
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'translateY(0)'
          : `translateY(${motionOffsetRevealY})`,
        transition: visible
          ? motionRevealTransition(['opacity', 'transform'], {
              ease: motionEaseRevealOut,
            })
          : undefined,
      }}
    >
      {children}
    </Box>
  )
}

function ContentBlock({
  block,
  index,
}: {
  block: PrettyOfferModuleBlock
  index: number
}) {
  let content: React.ReactNode = null

  switch (block.block_type) {
    case 'subtitle':
      if (!block.text_content) return null
      content = (
        <Text
          size="4"
          weight="medium"
          color="gray"
          mb="3"
          style={{ whiteSpace: 'pre-wrap' }}
          as="div"
        >
          {block.text_content}
        </Text>
      )
      break
    case 'description':
      if (!block.text_content) return null
      content = (
        <Text size="3" mb="3" style={{ whiteSpace: 'pre-wrap' }} as="div">
          {block.text_content}
        </Text>
      )
      break
    case 'simple_list': {
      const items = [...(block.items ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      )
      if (items.length === 0 && !block.text_content) return null
      content = (
        <Box mb="3">
          {block.text_content && (
            <Text size="4" weight="medium" mb="2" as="div">
              {block.text_content}
            </Text>
          )}
          {items.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {items.map((item) => (
                <li key={item.id} style={{ marginBottom: 8 }}>
                  <Text size="3" weight="medium" as="div">
                    {item.label}
                  </Text>
                  {item.summary && (
                    <Text size="2" color="gray" as="div">
                      {item.summary}
                    </Text>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Box>
      )
      break
    }
    case 'interactive_list':
      content = (
        <Box mb="3">
          {block.text_content && (
            <Text size="4" weight="medium" mb="2" as="div">
              {block.text_content}
            </Text>
          )}
          <InteractiveListBlock items={block.items ?? []} />
        </Box>
      )
      break
    case 'gallery':
      content = <GalleryBlock block={block} />
      break
    case 'timeline':
      content = <TimelineBlock items={block.items ?? []} />
      break
    case 'video':
    case 'link':
      content = <MediaBlock block={block} />
      break
    default:
      return null
  }

  if (!content) return null
  return <AnimatedBlock index={index}>{content}</AnimatedBlock>
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
  useCustomerBackground?: boolean
}

function PrettyOfferModuleView({
  module,
  useCustomerBackground = false,
}: Props) {
  const sortedBlocks = [...(module.blocks ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  return (
    <Box
      mb="6"
      p="5"
      style={{
        background: useCustomerBackground
          ? 'var(--accent-a2)'
          : 'var(--color-panel-solid)',
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
        <ContentBlock key={block.id} block={block} index={index} />
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
