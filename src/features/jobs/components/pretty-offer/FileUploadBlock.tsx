import * as React from 'react'
import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { Download, Eye, Page } from 'iconoir-react'
import {
  downloadPrettyOfferResource,
  getFilenameFromResourceUrl,
  isPdfResourceUrl,
} from '../../utils/prettyOfferResources'
import { resolvePrettyOfferMediaUrl } from '../../utils/prettyOfferMediaUpload'
import type { PrettyOfferModuleBlock } from '../../types'

type Props = {
  block: PrettyOfferModuleBlock
}

function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return resolvePrettyOfferMediaUrl(url) ?? url
}

function FileItem({
  item,
}: {
  item: NonNullable<PrettyOfferModuleBlock['items']>[number]
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [downloading, setDownloading] = React.useState(false)
  const fileUrl = resolveFileUrl(item.url)
  if (!fileUrl) return null

  const displayName =
    item.label?.trim() ||
    item.summary?.trim() ||
    getFilenameFromResourceUrl(fileUrl, 'Document')
  const isPdf = isPdfResourceUrl(fileUrl)

  return (
    <Box className="pretty-deck-file-item">
      <Flex align="center" gap="3" wrap="wrap">
        <Flex align="center" gap="2" style={{ flex: 1, minWidth: 0 }}>
          <Page width={20} height={20} />
          <Box style={{ minWidth: 0 }}>
            <Text size="3" weight="medium" as="div" truncate>
              {displayName}
            </Text>
            {item.summary && item.label && (
              <Text size="2" color="gray" as="div">
                {item.summary}
              </Text>
            )}
          </Box>
        </Flex>
        <Flex gap="2" wrap="wrap">
          {isPdf && (
            <Button
              size="2"
              variant="soft"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye width={16} height={16} />
              Preview
            </Button>
          )}
          <Button
            size="2"
            variant="outline"
            disabled={downloading}
            onClick={() => {
              setDownloading(true)
              void downloadPrettyOfferResource({
                url: fileUrl,
                name: displayName,
              })
                .catch(() => {
                  window.open(fileUrl, '_blank', 'noopener,noreferrer')
                })
                .finally(() => setDownloading(false))
            }}
          >
            <Download width={16} height={16} />
            {downloading ? 'Downloading…' : 'Download'}
          </Button>
        </Flex>
      </Flex>

      {isPdf && (
        <Dialog.Root open={previewOpen} onOpenChange={setPreviewOpen}>
          <Dialog.Content
            maxWidth="96vw"
            className="pretty-deck-pdf-viewer"
            aria-describedby={undefined}
          >
            <Dialog.Title className="pretty-deck-pdf-viewer__title">
              {displayName}
            </Dialog.Title>
            <iframe
              src={fileUrl}
              title={displayName}
              className="pretty-deck-pdf-viewer__frame"
            />
            <Flex gap="2" mt="3" justify="end">
              <Button
                variant="soft"
                onClick={() => {
                  void downloadPrettyOfferResource({
                    url: fileUrl,
                    name: displayName,
                  }).catch(() => {
                    window.open(fileUrl, '_blank', 'noopener,noreferrer')
                  })
                }}
              >
                <Download width={16} height={16} />
                Download
              </Button>
              <Dialog.Close>
                <Button variant="solid">Close</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}

export function FileUploadBlock({ block }: Props) {
  const items = [...(block.items ?? [])]
    .filter((item) => item.url)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (
    items.length === 0 &&
    !block.text_content?.trim() &&
    !block.caption?.trim()
  ) {
    return null
  }

  return (
    <Box mb="3" className="pretty-deck-file-upload-block">
      {block.text_content?.trim() && (
        <Text size="4" weight="medium" mb="2" as="div">
          {block.text_content}
        </Text>
      )}
      {block.caption?.trim() && (
        <Text
          size="3"
          color="gray"
          mb="3"
          as="div"
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {block.caption}
        </Text>
      )}
      {items.length > 0 && (
        <Flex direction="column" gap="2">
          {items.map((item) => (
            <FileItem key={item.id} item={item} />
          ))}
        </Flex>
      )}
    </Box>
  )
}
