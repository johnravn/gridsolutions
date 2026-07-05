import * as React from 'react'
import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { Download, ZoomIn } from 'iconoir-react'
import LazyImage from '@shared/ui/components/LazyImage'

type Props = {
  src: string
  alt: string
  caption?: string | null
  thumbnailStyle?: React.CSSProperties
  /** Fill the parent container (module hero media). */
  fill?: boolean
  className?: string
}

function getImageDownloadFilename(src: string, alt: string): string {
  try {
    const pathname = new URL(src).pathname
    const segment = pathname.split('/').pop()
    if (segment && /\.[a-z0-9]+$/i.test(segment)) return segment
  } catch {
    // ignore invalid URLs
  }

  const safeAlt = alt
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return safeAlt ? `${safeAlt}.jpg` : 'image.jpg'
}

async function downloadImage(src: string, filename: string) {
  const response = await fetch(src)
  if (!response.ok) throw new Error('Download failed')

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
}

export function PrettyOfferClickableImage({
  src,
  alt,
  caption,
  thumbnailStyle,
  fill = false,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)

  const buttonClass = [
    'pretty-deck-clickable-image',
    fill ? 'pretty-deck-clickable-image--fill' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen(true)}
        aria-label={`View full image: ${alt}`}
        style={fill ? undefined : thumbnailStyle}
      >
        {fill ? (
          <img
            src={src}
            alt={alt}
            className="pretty-deck-clickable-image__thumb"
          />
        ) : (
          <LazyImage
            src={src}
            alt={alt}
            style={thumbnailStyle}
            className="pretty-deck-clickable-image__lazy"
          />
        )}
        <Box className="pretty-deck-clickable-image__hint" aria-hidden>
          <ZoomIn width={22} height={22} />
        </Box>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content
          maxWidth="96vw"
          aria-describedby={undefined}
          className="pretty-deck-image-viewer"
        >
          <Dialog.Title className="pretty-deck-image-viewer__sr-title">
            {alt}
          </Dialog.Title>

          <Flex direction="column" align="center" gap="3">
            <img
              src={src}
              alt={alt}
              className="pretty-deck-image-viewer__image"
            />
            {caption && (
              <Text
                size="2"
                color="gray"
                align="center"
                as="p"
                mb="0"
                className="pretty-deck-image-viewer__caption"
              >
                {caption}
              </Text>
            )}
            <Flex gap="3" className="pretty-deck-image-viewer__actions">
              <Button
                variant="soft"
                size="3"
                disabled={downloading}
                onClick={() => {
                  setDownloading(true)
                  void downloadImage(src, getImageDownloadFilename(src, alt))
                    .catch(() => {
                      window.open(src, '_blank', 'noopener,noreferrer')
                    })
                    .finally(() => setDownloading(false))
                }}
              >
                <Download width={18} height={18} />
                {downloading ? 'Downloading…' : 'Download'}
              </Button>
              <Dialog.Close>
                <Button variant="solid" size="3">
                  Close
                </Button>
              </Dialog.Close>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
