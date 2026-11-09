import * as React from 'react'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Plus, Trash, Upload } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import LazyImage from '@shared/ui/components/LazyImage'
import { resolvePrettyOfferMediaUrl } from '@features/jobs/utils/prettyOfferMediaUpload'
import {
  companyPrettyOfferDefaultImagesQuery,
  createCompanyPrettyOfferDefaultImage,
  deleteCompanyPrettyOfferDefaultImage,
  updateCompanyPrettyOfferDefaultImageTitle,
} from '../api/prettyOfferDefaultImagesQueries'
import type { CompanyPrettyOfferDefaultImage } from '../api/prettyOfferDefaultImagesQueries'

type PendingImage = {
  id: string
  file: File
  title: string
}

function fileBaseName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').trim() || 'Untitled image'
}

function ImageCard({
  image,
  companyId,
  onDeleted,
  onTitleUpdated,
}: {
  image: CompanyPrettyOfferDefaultImage
  companyId: string
  onDeleted: () => void
  onTitleUpdated: () => void
}) {
  const { error: toastError } = useToast()
  const [title, setTitle] = React.useState(image.title)
  const previewUrl = resolvePrettyOfferMediaUrl(image.storage_path)

  React.useEffect(() => {
    setTitle(image.title)
  }, [image.title])

  const updateTitleMutation = useMutation({
    mutationFn: async () =>
      updateCompanyPrettyOfferDefaultImageTitle({
        companyId,
        imageId: image.id,
        title,
      }),
    onSuccess: () => onTitleUpdated(),
    onError: (err: Error) => {
      toastError('Could not save title', err.message)
      setTitle(image.title)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () =>
      deleteCompanyPrettyOfferDefaultImage({
        companyId,
        imageId: image.id,
        storagePath: image.storage_path,
      }),
    onSuccess: () => onDeleted(),
    onError: (err: Error) => {
      toastError('Could not delete image', err.message)
    },
  })

  const titleDirty = title.trim() !== image.title

  return (
    <Box
      p="2"
      style={{
        border: '1px solid var(--gray-a5)',
        borderRadius: 8,
        background: 'var(--gray-a2)',
      }}
    >
      <Box
        mb="2"
        style={{
          borderRadius: 6,
          overflow: 'hidden',
          aspectRatio: '16 / 10',
          background: 'var(--gray-a3)',
        }}
      >
        {previewUrl ? (
          <LazyImage
            src={previewUrl}
            alt={image.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
      </Box>
      <Flex gap="2" align="center">
        <TextField.Root
          size="1"
          value={title}
          placeholder="Image title"
          style={{ flex: 1 }}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (titleDirty && title.trim()) {
              updateTitleMutation.mutate()
            } else if (!title.trim()) {
              setTitle(image.title)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && titleDirty && title.trim()) {
              updateTitleMutation.mutate()
            }
          }}
        />
        <IconButton
          size="1"
          variant="ghost"
          color="red"
          disabled={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
        >
          <Trash width={14} height={14} />
        </IconButton>
      </Flex>
    </Box>
  )
}

export default function CompanyPrettyOfferImagesSection() {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [pendingImages, setPendingImages] = React.useState<Array<PendingImage>>(
    [],
  )

  const queryOptions = companyId
    ? companyPrettyOfferDefaultImagesQuery({ companyId })
    : {
        queryKey: ['company', 'none', 'pretty-offer-default-images'] as const,
        queryFn: () => Promise.resolve([]),
      }

  const { data: images = [], isLoading } = useQuery({
    ...queryOptions,
    enabled: !!companyId,
  })

  const invalidate = async () => {
    if (!companyId) return
    await qc.invalidateQueries({
      queryKey: ['company', companyId, 'pretty-offer-default-images'],
    })
  }

  const createMutation = useMutation({
    mutationFn: async (items: Array<PendingImage>) => {
      if (!companyId) throw new Error('No company selected')
      const results = []
      for (const item of items) {
        results.push(
          await createCompanyPrettyOfferDefaultImage({
            companyId,
            title: item.title,
            file: item.file,
          }),
        )
      }
      return results
    },
    onSuccess: async (_data, items) => {
      await invalidate()
      const count = items.length
      success(
        count === 1 ? 'Image added' : 'Images added',
        count === 1
          ? 'Default offer image saved to your library.'
          : `${count} default offer images saved to your library.`,
      )
      setAddDialogOpen(false)
      setPendingImages([])
    },
    onError: (err: Error) => {
      toastError('Upload failed', err.message)
    },
  })

  const handleFileSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setPendingImages(
      Array.from(files).map((file) => ({
        id: crypto.randomUUID(),
        file,
        title: fileBaseName(file),
      })),
    )
    setAddDialogOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const updatePendingTitle = (id: string, title: string) => {
    setPendingImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title } : item)),
    )
  }

  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (next.length === 0) setAddDialogOpen(false)
      return next
    })
  }

  const canSubmit =
    pendingImages.length > 0 &&
    pendingImages.every((item) => item.title.trim()) &&
    !createMutation.isPending

  if (!companyId) return null

  const isMultiple = pendingImages.length > 1

  return (
    <>
      <Flex direction="column" gap="3">
        <Text as="div" size="1" color="gray">
          Reusable images for pretty offers. When editing an offer, team members
          can pick from this library instead of uploading each time.
        </Text>

        <Flex gap="2" wrap="wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => handleFileSelected(e.target.files)}
          />
          <Button
            size="2"
            variant="soft"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload width={16} height={16} />
            Add images
          </Button>
        </Flex>

        {isLoading ? (
          <Text size="2" color="gray">
            Loading images…
          </Text>
        ) : images.length === 0 ? (
          <Text size="2" color="gray">
            No default images yet. Add photos your team reuses across offers
            (e.g. venue shots, crew at work, equipment setups).
          </Text>
        ) : (
          <Grid columns={{ initial: '2', sm: '3', md: '4' }} gap="3">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                companyId={companyId}
                onDeleted={() => void invalidate()}
                onTitleUpdated={() => void invalidate()}
              />
            ))}
          </Grid>
        )}
      </Flex>

      <Dialog.Root
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) setPendingImages([])
        }}
      >
        <Dialog.Content maxWidth={isMultiple ? '520px' : '420px'}>
          <Dialog.Title>
            {isMultiple
              ? `Add ${pendingImages.length} default offer images`
              : 'Add default offer image'}
          </Dialog.Title>
          <Dialog.Description size="2" mb="3">
            {isMultiple
              ? 'Give each image a short title so your team can find them when building offers.'
              : 'Give this image a short title so your team can find it when building offers.'}
          </Dialog.Description>
          <Flex direction="column" gap="3">
            {pendingImages.map((item, index) => (
              <Box key={item.id}>
                <Flex gap="2" align="end">
                  <Box style={{ flex: 1 }}>
                    <Text size="2" weight="medium" mb="1" as="div">
                      {isMultiple ? `Title ${index + 1}` : 'Title'}
                    </Text>
                    <TextField.Root
                      value={item.title}
                      placeholder="e.g. Main stage setup"
                      autoFocus={index === 0}
                      onChange={(e) =>
                        updatePendingTitle(item.id, e.target.value)
                      }
                    />
                    <Text size="1" color="gray" mt="1" as="div">
                      {item.file.name}
                    </Text>
                  </Box>
                  {isMultiple && (
                    <IconButton
                      size="2"
                      variant="ghost"
                      color="red"
                      disabled={createMutation.isPending}
                      onClick={() => removePendingImage(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <Trash width={14} height={14} />
                    </IconButton>
                  )}
                </Flex>
              </Box>
            ))}
            <Flex gap="2" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                disabled={!canSubmit}
                onClick={() => {
                  if (!canSubmit) return
                  createMutation.mutate(pendingImages)
                }}
              >
                <Plus width={16} height={16} />
                {createMutation.isPending
                  ? 'Uploading…'
                  : isMultiple
                    ? `Add ${pendingImages.length} to library`
                    : 'Add to library'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
