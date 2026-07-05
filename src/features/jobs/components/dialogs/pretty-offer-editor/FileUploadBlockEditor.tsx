import * as React from 'react'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Page, Plus, Trash, Upload } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  resolvePrettyOfferMediaUrl,
  uploadPrettyOfferMedia,
} from '../../../utils/prettyOfferMediaUpload'
import { isPdfResourceUrl } from '../../../utils/prettyOfferResources'
import { createEmptyBlockItem } from './types'
import type { LocalBlockItem, LocalContentBlock } from './types'

type Props = {
  block: LocalContentBlock
  companyId: string
  offerId: string
  readOnly: boolean
  onChange: (updates: Partial<LocalContentBlock>) => void
}

export function FileUploadBlockEditor({
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
          kind: 'document',
        })
        nextItems.push({
          ...createEmptyBlockItem(block.id, nextItems.length),
          url: path,
          label: file.name.replace(/\.pdf$/i, '') || file.name,
        })
      }
      onChange({ items: nextItems })
    } catch (err) {
      toastError(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload file.',
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
        placeholder="Title (optional)"
        onChange={(e) => onChange({ text_content: e.target.value || null })}
      />
      <TextArea
        value={block.caption ?? ''}
        disabled={readOnly}
        rows={3}
        placeholder="Description (optional)"
        onChange={(e) => onChange({ caption: e.target.value || null })}
      />

      <Text size="1" color="gray">
        PDF files up to 25 MB
      </Text>

      {!readOnly && (
        <Flex gap="2" wrap="wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
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
            Upload PDF
          </Button>
          <Button
            size="1"
            variant="outline"
            onClick={() =>
              onChange({
                items: [
                  ...block.items,
                  createEmptyBlockItem(block.id, block.items.length),
                ],
              })
            }
          >
            <Plus width={14} height={14} />
            Add file URL
          </Button>
        </Flex>
      )}

      {block.items.map((item) => {
        const previewUrl = resolvePrettyOfferMediaUrl(item.url)
        const isPdf = previewUrl ? isPdfResourceUrl(previewUrl) : false

        return (
          <Box
            key={item.id}
            p="2"
            style={{ background: 'var(--gray-a2)', borderRadius: 6 }}
          >
            <Flex gap="2" align="start">
              <Page
                width={20}
                height={20}
                style={{ flexShrink: 0, marginTop: 6 }}
              />
              <Flex direction="column" gap="2" style={{ flex: 1 }}>
                <TextField.Root
                  value={item.url ?? ''}
                  disabled={readOnly}
                  placeholder="File URL or uploaded path"
                  onChange={(e) =>
                    updateItem(item.id, { url: e.target.value || null })
                  }
                />
                <TextField.Root
                  value={item.label ?? ''}
                  disabled={readOnly}
                  placeholder="Display name"
                  onChange={(e) =>
                    updateItem(item.id, { label: e.target.value || '' })
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
                {isPdf && previewUrl && (
                  <Text size="1" color="gray">
                    PDF preview available on the public offer page.
                  </Text>
                )}
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
