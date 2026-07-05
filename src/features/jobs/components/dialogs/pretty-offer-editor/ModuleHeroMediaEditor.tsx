import * as React from 'react'
import {
  Box,
  Button,
  Flex,
  SegmentedControl,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { MediaImage, Plus, Trash, Upload } from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import LazyImage from '@shared/ui/components/LazyImage'
import {
  resolvePrettyOfferMediaUrl,
  uploadPrettyOfferMedia,
} from '../../../utils/prettyOfferMediaUpload'
import { PrettyOfferImageLibraryPicker } from './PrettyOfferImageLibraryPicker'
import type { LocalPrettyModule } from './types'
import type { PrettyModuleHeroMediaType } from '../../../types'

type Props = {
  module: LocalPrettyModule
  readOnly: boolean
  fieldErrors?: Record<string, string>
  onChange: (patch: Partial<LocalPrettyModule>) => void
}

export function ModuleStoryFields({
  module,
  readOnly,
  fieldErrors = {},
  onChange,
}: Props) {
  const hasSecondPair =
    module.story_heading_2 != null || module.story_body_2 != null

  return (
    <Flex direction="column" gap="3">
      <Box>
        <Text size="2" weight="medium" mb="1" as="div">
          Tagline
        </Text>
        <TextField.Root
          value={module.tagline ?? ''}
          disabled={readOnly}
          placeholder="One-line hook for this module"
          onChange={(e) => onChange({ tagline: e.target.value || null })}
        />
      </Box>

      <Box
        p="3"
        style={{
          border: '1px solid var(--gray-a5)',
          borderRadius: 8,
          background: 'var(--gray-a2)',
        }}
      >
        <Text size="2" weight="medium" mb="2" as="div">
          Story block 1 <Text color="red">*</Text>
        </Text>
        {fieldErrors.story_body_1 && (
          <Text size="1" color="red" mb="1" as="div">
            {fieldErrors.story_body_1}
          </Text>
        )}
        <Flex direction="column" gap="2">
          <TextField.Root
            value={module.story_heading_1 ?? ''}
            disabled={readOnly}
            placeholder="Heading (optional)"
            onChange={(e) =>
              onChange({ story_heading_1: e.target.value || null })
            }
          />
          <TextArea
            value={module.story_body_1 ?? ''}
            disabled={readOnly}
            rows={3}
            placeholder="Paragraph text"
            onChange={(e) => onChange({ story_body_1: e.target.value || null })}
          />
        </Flex>
      </Box>

      {hasSecondPair ? (
        <Box
          p="3"
          style={{
            border: '1px solid var(--gray-a5)',
            borderRadius: 8,
            background: 'var(--gray-a2)',
          }}
        >
          <Flex justify="between" align="center" mb="2">
            <Text size="2" weight="medium" as="div">
              Story block 2
            </Text>
            {!readOnly && (
              <Button
                size="1"
                variant="ghost"
                color="red"
                onClick={() =>
                  onChange({ story_heading_2: null, story_body_2: null })
                }
              >
                <Trash width={14} height={14} />
                Remove
              </Button>
            )}
          </Flex>
          <Flex direction="column" gap="2">
            <TextField.Root
              value={module.story_heading_2 ?? ''}
              disabled={readOnly}
              placeholder="Heading (optional)"
              onChange={(e) =>
                onChange({ story_heading_2: e.target.value || null })
              }
            />
            <TextArea
              value={module.story_body_2 ?? ''}
              disabled={readOnly}
              rows={3}
              placeholder="Paragraph text"
              onChange={(e) =>
                onChange({ story_body_2: e.target.value || null })
              }
            />
          </Flex>
        </Box>
      ) : (
        !readOnly && (
          <Button
            size="1"
            variant="soft"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => onChange({ story_heading_2: '', story_body_2: '' })}
          >
            <Plus width={14} height={14} />
            Add second story block
          </Button>
        )
      )}
    </Flex>
  )
}

type HeroProps = {
  module: LocalPrettyModule
  companyId: string
  offerId: string
  readOnly: boolean
  fieldErrors?: Record<string, string>
  onChange: (patch: Partial<LocalPrettyModule>) => void
}

type VideoSourceMode = 'upload' | 'embed'

function inferVideoMode(url: string | null | undefined): VideoSourceMode {
  if (!url) return 'upload'
  if (/^https?:\/\//i.test(url)) return 'embed'
  return 'upload'
}

export function ModuleHeroMediaEditor({
  module,
  companyId,
  offerId,
  readOnly,
  fieldErrors = {},
  onChange,
}: HeroProps) {
  const { error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [libraryOpen, setLibraryOpen] = React.useState(false)
  const [videoMode, setVideoMode] = React.useState<VideoSourceMode>(() =>
    inferVideoMode(module.hero_media_url),
  )

  React.useEffect(() => {
    if (module.hero_media_type === 'video') {
      setVideoMode(inferVideoMode(module.hero_media_url))
    }
  }, [module.id, module.hero_media_type, module.hero_media_url])

  const mediaKind = module.hero_media_type ?? 'image'

  const handleImageUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = await uploadPrettyOfferMedia({
        companyId,
        offerId,
        file,
        kind: 'image',
      })
      onChange({ hero_media_type: 'image', hero_media_url: path })
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

  const handleVideoUpload = async (files: FileList | null) => {
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
      onChange({ hero_media_type: 'video', hero_media_url: path })
      setVideoMode('upload')
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

  const imagePreview =
    module.hero_media_type === 'image' && module.hero_media_url
      ? resolvePrettyOfferMediaUrl(module.hero_media_url) ||
        (/^https?:\/\//i.test(module.hero_media_url)
          ? module.hero_media_url
          : null)
      : null

  const videoPreview =
    module.hero_media_type === 'video' &&
    module.hero_media_url &&
    videoMode === 'upload'
      ? resolvePrettyOfferMediaUrl(module.hero_media_url)
      : null

  return (
    <Box>
      <Text size="2" weight="medium" mb="1" as="div">
        Hero media <Text color="red">*</Text>
      </Text>
      {fieldErrors.hero_media_url && (
        <Text size="1" color="red" mb="1" as="div">
          {fieldErrors.hero_media_url}
        </Text>
      )}

      <SegmentedControl.Root
        value={mediaKind}
        disabled={readOnly}
        onValueChange={(value) => {
          const nextType = value as PrettyModuleHeroMediaType
          onChange({
            hero_media_type: nextType,
            hero_media_url:
              module.hero_media_type === nextType
                ? module.hero_media_url
                : null,
          })
        }}
        mb="2"
      >
        <SegmentedControl.Item value="image">Image</SegmentedControl.Item>
        <SegmentedControl.Item value="video">Video</SegmentedControl.Item>
      </SegmentedControl.Root>

      {mediaKind === 'image' ? (
        <Flex direction="column" gap="2">
          <Text size="1" color="gray">
            JPG, PNG, or WebP · max 5 MB
          </Text>
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => void handleImageUpload(e.target.files)}
              />
              <Flex gap="2" wrap="wrap">
                <Button
                  size="1"
                  variant="soft"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload width={14} height={14} />
                  {uploading ? 'Uploading…' : 'Upload hero image'}
                </Button>
                <Button
                  size="1"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => setLibraryOpen(true)}
                >
                  <MediaImage width={14} height={14} />
                  Choose from library
                </Button>
              </Flex>
              <PrettyOfferImageLibraryPicker
                open={libraryOpen}
                onOpenChange={setLibraryOpen}
                companyId={companyId}
                offerId={offerId}
                onSelect={(path) =>
                  onChange({ hero_media_type: 'image', hero_media_url: path })
                }
              />
            </>
          )}
          {imagePreview && (
            <Box
              style={{
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--gray-a5)',
                maxHeight: 200,
              }}
            >
              <LazyImage
                src={imagePreview}
                alt="Hero preview"
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }}
              />
            </Box>
          )}
        </Flex>
      ) : (
        <Flex direction="column" gap="2">
          <Flex gap="2">
            <Button
              size="1"
              variant={videoMode === 'upload' ? 'solid' : 'soft'}
              disabled={readOnly}
              onClick={() => {
                setVideoMode('upload')
                if (/^https?:\/\//i.test(module.hero_media_url ?? '')) {
                  onChange({ hero_media_url: null })
                }
              }}
            >
              Upload video
            </Button>
            <Button
              size="1"
              variant={videoMode === 'embed' ? 'solid' : 'soft'}
              disabled={readOnly}
              onClick={() => {
                setVideoMode('embed')
                if (
                  module.hero_media_url &&
                  !/^https?:\/\//i.test(module.hero_media_url)
                ) {
                  onChange({ hero_media_url: null })
                }
              }}
            >
              YouTube / Vimeo
            </Button>
          </Flex>
          {videoMode === 'upload' ? (
            <>
              {!readOnly && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    hidden
                    onChange={(e) => void handleVideoUpload(e.target.files)}
                  />
                  <Button
                    size="1"
                    variant="soft"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload width={14} height={14} />
                    {uploading ? 'Uploading…' : 'Upload hero video'}
                  </Button>
                </>
              )}
              {videoPreview && (
                <video
                  src={videoPreview}
                  controls
                  style={{ width: '100%', maxHeight: 200, display: 'block' }}
                />
              )}
            </>
          ) : (
            <TextField.Root
              value={module.hero_media_url ?? ''}
              disabled={readOnly}
              placeholder="https://youtube.com/watch?v=…"
              onChange={(e) =>
                onChange({ hero_media_url: e.target.value || null })
              }
            />
          )}
        </Flex>
      )}

      <Box mt="2">
        <Text size="2" weight="medium" mb="1" as="div">
          Caption (optional)
        </Text>
        <TextField.Root
          value={module.hero_media_caption ?? ''}
          disabled={readOnly}
          placeholder="Short caption under the hero media"
          onChange={(e) =>
            onChange({ hero_media_caption: e.target.value || null })
          }
        />
      </Box>
    </Box>
  )
}
