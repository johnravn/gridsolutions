import * as React from 'react'
import { Box, Button, Flex, Text, TextField } from '@radix-ui/themes'
import { Upload } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  resolvePrettyOfferMediaUrl,
  uploadPrettyOfferMedia,
} from '../../../utils/prettyOfferMediaUpload'
import type { LocalContentBlock } from './types'

type VideoSourceMode = 'upload' | 'embed'

type Props = {
  block: LocalContentBlock
  companyId: string
  offerId: string
  readOnly: boolean
  onChange: (updates: Partial<LocalContentBlock>) => void
}

function inferVideoMode(url: string | null | undefined): VideoSourceMode {
  if (!url) return 'upload'
  if (/^https?:\/\//i.test(url)) return 'embed'
  return 'upload'
}

export function VideoBlockEditor({
  block,
  companyId,
  offerId,
  readOnly,
  onChange,
}: Props) {
  const { error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [mode, setMode] = React.useState<VideoSourceMode>(() =>
    inferVideoMode(block.url),
  )

  React.useEffect(() => {
    setMode(inferVideoMode(block.url))
  }, [block.id, block.url])

  const handleUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = await uploadPrettyOfferMedia({
        companyId,
        offerId,
        file,
        kind: 'video',
      })
      onChange({ url: path })
      setMode('upload')
    } catch (err) {
      toastError(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload video.',
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const previewUrl =
    mode === 'upload' ? resolvePrettyOfferMediaUrl(block.url) : null

  return (
    <Flex direction="column" gap="2">
      <Flex gap="2">
        <Button
          size="1"
          variant={mode === 'upload' ? 'solid' : 'soft'}
          disabled={readOnly}
          onClick={() => {
            setMode('upload')
            if (/^https?:\/\//i.test(block.url ?? '')) onChange({ url: null })
          }}
        >
          Upload video
        </Button>
        <Button
          size="1"
          variant={mode === 'embed' ? 'solid' : 'soft'}
          disabled={readOnly}
          onClick={() => {
            setMode('embed')
            if (block.url && !/^https?:\/\//i.test(block.url)) {
              onChange({ url: null })
            }
          }}
        >
          YouTube / Vimeo
        </Button>
      </Flex>

      {mode === 'upload' ? (
        <>
          <Text size="1" color="gray">
            Videos up to 25 MB · MP4 or WebM. For longer videos, use YouTube /
            Vimeo embed instead.
          </Text>
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm"
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
                {uploading ? 'Uploading…' : 'Upload video'}
              </Button>
            </>
          )}
          {previewUrl && (
            <Box
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--gray-a5)',
              }}
            >
              <video
                src={previewUrl}
                controls
                style={{ width: '100%', maxHeight: 240, display: 'block' }}
              />
            </Box>
          )}
        </>
      ) : (
        <>
          <Text size="1" color="gray">
            Paste a YouTube or Vimeo link — no file size limit.
          </Text>
          <TextField.Root
            value={block.url ?? ''}
            disabled={readOnly}
            placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
            onChange={(e) => onChange({ url: e.target.value || null })}
          />
        </>
      )}

      <TextField.Root
        value={block.caption ?? ''}
        disabled={readOnly}
        placeholder="Caption (optional)"
        onChange={(e) => onChange({ caption: e.target.value || null })}
      />
    </Flex>
  )
}
