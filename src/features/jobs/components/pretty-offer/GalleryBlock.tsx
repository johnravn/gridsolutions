import { Box, Grid, Text } from '@radix-ui/themes'
import LazyImage from '@shared/ui/components/LazyImage'
import { resolvePrettyOfferMediaUrl } from '../../utils/prettyOfferMediaUpload'
import type { PrettyOfferModuleBlock } from '../../types'

type Props = {
  block: PrettyOfferModuleBlock
}

export function GalleryBlock({ block }: Props) {
  const items = [...(block.items ?? [])]
    .filter((item) => item.url)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (items.length === 0 && !block.text_content) return null

  return (
    <Box mb="3">
      {block.text_content && (
        <Text size="4" weight="medium" mb="2" as="div">
          {block.text_content}
        </Text>
      )}
      {items.length > 0 && (
        <Grid columns={{ initial: '1', sm: '2' }} gap="3">
          {items.map((item) => {
            const src = resolvePrettyOfferMediaUrl(item.url)
            if (!src) return null
            return (
              <Box key={item.id}>
                <LazyImage
                  src={src}
                  alt={item.summary || block.text_content || 'Gallery image'}
                  style={{
                    width: '100%',
                    maxHeight: 280,
                    objectFit: 'cover',
                    borderRadius: 12,
                  }}
                />
                {item.summary && (
                  <Text size="2" color="gray" mt="2" as="div">
                    {item.summary}
                  </Text>
                )}
              </Box>
            )
          })}
        </Grid>
      )}
    </Box>
  )
}
