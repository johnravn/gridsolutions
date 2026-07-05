import * as React from 'react'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import LazyImage from '@shared/ui/components/LazyImage'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { companyPrettyOfferDefaultImagesQuery } from '@features/company/api/prettyOfferDefaultImagesQueries'
import {
  copyPrettyOfferLibraryImageToOffer,
  resolvePrettyOfferMediaUrl,
} from '../../../utils/prettyOfferMediaUpload'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  offerId: string
  onSelect: (path: string) => void
}

export function PrettyOfferImageLibraryPicker({
  open,
  onOpenChange,
  companyId,
  offerId,
  onSelect,
}: Props) {
  const { error: toastError } = useToast()
  const [copyingId, setCopyingId] = React.useState<string | null>(null)

  const { data: images = [], isLoading } = useQuery({
    ...companyPrettyOfferDefaultImagesQuery({ companyId }),
    enabled: open && !!companyId,
  })

  const handleSelect = async (imageId: string, storagePath: string) => {
    setCopyingId(imageId)
    try {
      const offerPath = await copyPrettyOfferLibraryImageToOffer({
        companyId,
        offerId,
        libraryPath: storagePath,
      })
      onSelect(offerPath)
      onOpenChange(false)
    } catch (err) {
      toastError(
        'Could not add image',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setCopyingId(null)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Choose from library</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          Pick a company default image. It will be copied into this offer.
        </Dialog.Description>

        {isLoading ? (
          <Flex align="center" justify="center" py="6">
            <Spinner size="2" />
          </Flex>
        ) : images.length === 0 ? (
          <Flex direction="column" gap="2" py="2">
            <Text size="2" color="gray">
              No default images configured yet.
            </Text>
            <Button asChild size="2" variant="soft">
              <Link to="/company" search={{ tab: 'setup' }}>
                Manage images in Company Setup
              </Link>
            </Button>
          </Flex>
        ) : (
          <Grid columns={{ initial: '2', sm: '3' }} gap="3">
            {images.map((image) => {
              const previewUrl = resolvePrettyOfferMediaUrl(image.storage_path)
              const isCopying = copyingId === image.id
              return (
                <button
                  key={image.id}
                  type="button"
                  disabled={isCopying || copyingId != null}
                  onClick={() =>
                    void handleSelect(image.id, image.storage_path)
                  }
                  style={{
                    border: '1px solid var(--gray-a5)',
                    borderRadius: 8,
                    background: 'var(--gray-a2)',
                    padding: 8,
                    cursor: isCopying || copyingId != null ? 'wait' : 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Box
                    mb="2"
                    style={{
                      borderRadius: 6,
                      overflow: 'hidden',
                      aspectRatio: '16 / 10',
                      background: 'var(--gray-a3)',
                      position: 'relative',
                    }}
                  >
                    {previewUrl ? (
                      <LazyImage
                        src={previewUrl}
                        alt={image.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : null}
                    {isCopying && (
                      <Flex
                        align="center"
                        justify="center"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.35)',
                        }}
                      >
                        <Spinner size="2" />
                      </Flex>
                    )}
                  </Box>
                  <Text size="2" weight="medium" as="div">
                    {image.title}
                  </Text>
                </button>
              )
            })}
          </Grid>
        )}

        <Flex justify="end" mt="4">
          <Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
