import * as React from 'react'
import { Box, Button, Flex, Text } from '@radix-ui/themes'
import { Link as LinkIcon } from 'iconoir-react'
import {
  motionEaseRevealOut,
  motionOffsetRevealY,
  motionRevealTransition,
} from '@shared/lib/motion'
import {
  isStorageMediaPath,
  resolvePrettyOfferMediaUrl,
} from '../../utils/prettyOfferMediaUpload'
import { InteractiveListBlock } from './InteractiveListBlock'
import { GalleryBlock } from './GalleryBlock'
import { FileUploadBlock } from './FileUploadBlock'
import { TimelineBlock } from './TimelineBlock'
import { ColumnLayoutBlock } from './ColumnLayoutBlock'
import type { PrettyOfferModuleBlock } from '../../types'

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

export function PrettyOfferBlockRenderer({
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
    case 'column_layout':
      content = <ColumnLayoutBlock block={block} startIndex={index} />
      break
    case 'file_upload':
      content = <FileUploadBlock block={block} />
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

export function getVideoEmbedUrlForHero(url: string): string | null {
  return getVideoEmbedUrl(url)
}

export function HeroMediaDisplay({
  mediaType,
  mediaUrl,
  caption,
  title,
}: {
  mediaType: 'image' | 'video' | null | undefined
  mediaUrl: string | null | undefined
  caption?: string | null
  title?: string
}) {
  if (!mediaType || !mediaUrl) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Text size="2" color="gray">
          No hero media
        </Text>
      </Flex>
    )
  }

  if (mediaType === 'image') {
    const src = isStorageMediaPath(mediaUrl)
      ? resolvePrettyOfferMediaUrl(mediaUrl)
      : mediaUrl
    if (!src) return null
    return <img src={src} alt={caption || title || 'Module hero'} />
  }

  const embedUrl = getVideoEmbedUrl(mediaUrl)
  const uploadedUrl = isStorageMediaPath(mediaUrl)
    ? resolvePrettyOfferMediaUrl(mediaUrl)
    : null

  if (embedUrl) {
    return (
      <Box className="pretty-deck-slide__media-video-wrap">
        <iframe
          src={embedUrl}
          title={title || 'Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </Box>
    )
  }

  if (uploadedUrl) {
    return <video src={uploadedUrl} controls />
  }

  return (
    <Flex align="center" justify="center" style={{ height: '100%' }}>
      <Button asChild variant="soft" size="3">
        <a href={mediaUrl} target="_blank" rel="noreferrer">
          Watch video
        </a>
      </Button>
    </Flex>
  )
}
