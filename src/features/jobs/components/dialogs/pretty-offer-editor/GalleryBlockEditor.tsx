import * as React from 'react'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Plus, Trash, Upload } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  resolvePrettyOfferMediaUrl,
  uploadPrettyOfferMedia,
} from '../../../utils/prettyOfferMediaUpload'
import { createEmptyBlockItem } from './types'
import type { LocalBlockItem, LocalContentBlock } from './types'

type Props = {
  block: LocalContentBlock
  companyId: string
  offerId: string
  readOnly: boolean
  onChange: (updates: Partial<LocalContentBlock>) => void
}

export function GalleryBlockEditor({
  block,
  companyId,
  offerId,
  readOnly,
  onChange,
}: Props) {
  const { error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const updateItem = (itemId: string, updates: Partial<LocalBlockItem>) => {
    onChange({
      items: block.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    })
  }

  const removeItem = (itemId: string) => {
    onChange({
      items: block.items.filter((item) => item.id !== itemId),
    })
  }

  const addExternalUrlItem = () => {
    const sortOrder = block.items.length
    onChange({
      items: [
        ...block.items,
        {
          ...createEmptyBlockItem(block.id, sortOrder),
          url: '',
        },
      ],
    })
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const nextItems = [...block.items]
      for (const file of Array.from(files)) {
        const path = await uploadPrettyOfferMedia({
          companyId,
          offerId,
          file,
          kind: 'image',
        })
        nextItems.push({
          ...createEmptyBlockItem(block.id, nextItems.length),
          url: path,
        })
      }
      onChange({ items: nextItems })
    } catch (err) {
      toastError(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload image.',
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Flex direction="column" gap="2">
      <TextField.Root
        value={block.text_content ?? ''}
        disabled={readOnly}
        placeholder="Gallery title (optional)"
        onChange={(e) => onChange({ text_content: e.target.value || null })}
      />

      <Text size="1" color="gray">
        Images up to 5 MB · JPG, PNG, or WebP
      </Text>

      {!readOnly && (
        <Flex gap="2" wrap="wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <Button
            size="1"
            variant="soft"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload width={14} height={14} />
            Upload image
          </Button>
          <Button size="1" variant="outline" onClick={addExternalUrlItem}>
            <Plus width={14} height={14} />
            Add image URL
          </Button>
        </Flex>
      )}

      {block.items.map((item) => {
        const previewUrl = resolvePrettyOfferMediaUrl(item.url)
        return (
          <Box
            key={item.id}
            p="2"
            style={{ background: 'var(--gray-a2)', borderRadius: 6 }}
          >
            <Flex gap="2" align="start">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt=""
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: 'cover',
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
              )}
              <Flex direction="column" gap="2" style={{ flex: 1 }}>
                <TextField.Root
                  value={item.url ?? ''}
                  disabled={readOnly}
                  placeholder="Image URL or uploaded path"
                  onChange={(e) =>
                    updateItem(item.id, { url: e.target.value || null })
                  }
                />
                <TextField.Root
                  value={item.summary ?? ''}
                  disabled={readOnly}
                  placeholder="Caption (optional)"
                  onChange={(e) =>
                    updateItem(item.id, { summary: e.target.value || null })
                  }
                />
              </Flex>
              {!readOnly && (
                <IconButton
                  size="1"
                  variant="ghost"
                  color="red"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash width={14} height={14} />
                </IconButton>
              )}
            </Flex>
          </Box>
        )
      })}
    </Flex>
  )
}
