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
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)
  const [pendingTitle, setPendingTitle] = React.useState('')

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
    mutationFn: async ({ title, file }: { title: string; file: File }) => {
      if (!companyId) throw new Error('No company selected')
      return createCompanyPrettyOfferDefaultImage({ companyId, title, file })
    },
    onSuccess: async () => {
      await invalidate()
      success('Image added', 'Default offer image saved to your library.')
      setAddDialogOpen(false)
      setPendingFile(null)
      setPendingTitle('')
    },
    onError: (err: Error) => {
      toastError('Upload failed', err.message)
    },
  })

  const handleFileSelected = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setPendingFile(file)
    const baseName = file.name.replace(/\.[^.]+$/, '').trim()
    setPendingTitle(baseName)
    setAddDialogOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!companyId) return null

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
            hidden
            onChange={(e) => handleFileSelected(e.target.files)}
          />
          <Button
            size="2"
            variant="soft"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload width={16} height={16} />
            Add image
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

      <Dialog.Root open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>Add default offer image</Dialog.Title>
          <Dialog.Description size="2" mb="3">
            Give this image a short title so your team can find it when building
            offers.
          </Dialog.Description>
          <Flex direction="column" gap="3">
            <Box>
              <Text size="2" weight="medium" mb="1" as="div">
                Title
              </Text>
              <TextField.Root
                value={pendingTitle}
                placeholder="e.g. Main stage setup"
                autoFocus
                onChange={(e) => setPendingTitle(e.target.value)}
              />
            </Box>
            {pendingFile && (
              <Text size="1" color="gray">
                {pendingFile.name}
              </Text>
            )}
            <Flex gap="2" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                disabled={
                  !pendingFile ||
                  !pendingTitle.trim() ||
                  createMutation.isPending
                }
                onClick={() => {
                  if (!pendingFile) return
                  createMutation.mutate({
                    title: pendingTitle,
                    file: pendingFile,
                  })
                }}
              >
                <Plus width={16} height={16} />
                {createMutation.isPending ? 'Uploading…' : 'Add to library'}
              </Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
