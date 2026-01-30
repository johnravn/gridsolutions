import * as React from 'react'
import { Box, Button, Flex, Skeleton, Text } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Upload } from 'iconoir-react'

interface CompanyLogoUploadProps {
  currentLightLogoPath: string | null
  currentDarkLogoPath: string | null
  onUploadComplete: (lightPath: string | null, darkPath: string | null) => void
  uploadPathPrefix: string // e.g., "companies/{companyId}"
  disabled?: boolean
}

export default function CompanyLogoUpload({
  currentLightLogoPath,
  currentDarkLogoPath,
  onUploadComplete,
  uploadPathPrefix,
  disabled = false,
}: CompanyLogoUploadProps) {
  const [uploadingLight, setUploadingLight] = React.useState(false)
  const [uploadingDark, setUploadingDark] = React.useState(false)
  const [previewLightUrl, setPreviewLightUrl] = React.useState<string | null>(
    null,
  )
  const [previewDarkUrl, setPreviewDarkUrl] = React.useState<string | null>(
    null,
  )
  const [lightImageLoading, setLightImageLoading] = React.useState(true)
  const [darkImageLoading, setDarkImageLoading] = React.useState(true)
  const lightFileInputRef = React.useRef<HTMLInputElement>(null)
  const darkFileInputRef = React.useRef<HTMLInputElement>(null)
  const previewLightUrlRef = React.useRef<string | null>(null)
  const previewDarkUrlRef = React.useRef<string | null>(null)
  const { success, error: toastError } = useToast()

  // Get public URLs for current logos with cache-busting
  const lightLogoUrl = React.useMemo(() => {
    if (currentLightLogoPath) {
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(currentLightLogoPath)
      return `${data.publicUrl}?t=${Date.now()}`
    }
    return null
  }, [currentLightLogoPath])

  const darkLogoUrl = React.useMemo(() => {
    if (currentDarkLogoPath) {
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(currentDarkLogoPath)
      return `${data.publicUrl}?t=${Date.now()}`
    }
    return null
  }, [currentDarkLogoPath])

  // Reset preview URLs when paths change
  React.useEffect(() => {
    if (previewLightUrlRef.current) {
      URL.revokeObjectURL(previewLightUrlRef.current)
      previewLightUrlRef.current = null
    }
    if (previewDarkUrlRef.current) {
      URL.revokeObjectURL(previewDarkUrlRef.current)
      previewDarkUrlRef.current = null
    }
    setPreviewLightUrl(null)
    setPreviewDarkUrl(null)
    setLightImageLoading(true)
    setDarkImageLoading(true)
  }, [currentLightLogoPath, currentDarkLogoPath])

  // Clean up preview URLs on unmount
  React.useEffect(() => {
    return () => {
      if (previewLightUrlRef.current) {
        URL.revokeObjectURL(previewLightUrlRef.current)
      }
      if (previewDarkUrlRef.current) {
        URL.revokeObjectURL(previewDarkUrlRef.current)
      }
    }
  }, [])

  const handleFileSelect = async (
    file: File,
    mode: 'light' | 'dark',
    setUploading: (v: boolean) => void,
    setPreviewUrl: (url: string | null) => void,
    previewUrlRef: React.MutableRefObject<string | null>,
    setImageLoading: (v: boolean) => void,
  ) => {
    // Validate file type (SVG or PNG only)
    if (!file.type.match(/^image\/(png|svg\+xml)$/)) {
      toastError(
        'Invalid file type',
        'Company logos must be PNG or SVG format (with transparent backgrounds).',
      )
      return
    }

    setUploading(true)
    try {
      // Clean up previous preview URL if it exists
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }

      // Create preview
      const preview = URL.createObjectURL(file)
      previewUrlRef.current = preview
      setPreviewUrl(preview)
      setImageLoading(true)

      // Determine file extension
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const uploadPath = `${uploadPathPrefix}/logo_${mode}.${ext}`

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(uploadPath, file, {
          upsert: true,
          cacheControl: '3600',
        })

      if (uploadError) {
        throw uploadError
      }

      // Update the appropriate path
      const currentLightPath =
        mode === 'light' ? uploadPath : currentLightLogoPath
      const currentDarkPath = mode === 'dark' ? uploadPath : currentDarkLogoPath

      onUploadComplete(currentLightPath, currentDarkPath)
      success(
        `${mode === 'light' ? 'Light' : 'Dark'} logo uploaded`,
        'Logo has been uploaded successfully.',
      )

      // Clear preview URL after successful upload
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setPreviewUrl(null)
    } catch (err: any) {
      toastError('Upload failed', err?.message || 'Failed to upload logo.')
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (
    mode: 'light' | 'dark',
    currentPath: string | null,
  ) => {
    if (!currentPath) return

    try {
      const { error } = await supabase.storage
        .from('logos')
        .remove([currentPath])

      if (error) throw error

      const currentLightPath = mode === 'light' ? null : currentLightLogoPath
      const currentDarkPath = mode === 'dark' ? null : currentDarkLogoPath

      onUploadComplete(currentLightPath, currentDarkPath)

      if (mode === 'light' && previewLightUrlRef.current) {
        URL.revokeObjectURL(previewLightUrlRef.current)
        previewLightUrlRef.current = null
      }
      if (mode === 'dark' && previewDarkUrlRef.current) {
        URL.revokeObjectURL(previewDarkUrlRef.current)
        previewDarkUrlRef.current = null
      }
      setPreviewLightUrl(null)
      setPreviewDarkUrl(null)
      success('Logo deleted', 'Logo has been removed.')
    } catch (err: any) {
      toastError('Delete failed', err?.message || 'Failed to delete logo.')
    }
  }

  const displayLightUrl = previewLightUrl || lightLogoUrl
  const displayDarkUrl = previewDarkUrl || darkLogoUrl

  return (
    <Box>
      <Flex direction="column" gap="3">
        {/* Light and Dark Mode Logos side by side */}
        <Flex gap="4" wrap="wrap" align="start">
          {/* Light Mode Logo */}
          <Box style={{ flex: '1 1 300px', minWidth: 250 }}>
            <Text as="div" size="2" color="gray" mb="2">
              Light Mode Logo
            </Text>
            {displayLightUrl && (
              <Box
                style={{
                  width: '100%',
                  maxWidth: 300,
                  aspectRatio: '5/3',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--gray-a6)',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {lightImageLoading && (
                  <Skeleton
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  />
                )}
                <img
                  src={displayLightUrl}
                  alt="Light mode logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: lightImageLoading ? 0 : 1,
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                  onLoad={() => setLightImageLoading(false)}
                  onError={() => setLightImageLoading(false)}
                />
              </Box>
            )}
            <Flex gap="2" align="center" mt="2">
              <input
                ref={lightFileInputRef}
                type="file"
                accept="image/png,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileSelect(
                      file,
                      'light',
                      setUploadingLight,
                      setPreviewLightUrl,
                      previewLightUrlRef,
                      setLightImageLoading,
                    )
                  }
                  if (lightFileInputRef.current) {
                    lightFileInputRef.current.value = ''
                  }
                }}
                disabled={disabled || uploadingLight}
                style={{ display: 'none' }}
              />
              <Button
                size="2"
                variant="soft"
                onClick={() => lightFileInputRef.current?.click()}
                disabled={disabled || uploadingLight}
              >
                <Upload width={16} height={16} />
                {uploadingLight
                  ? 'Uploading...'
                  : displayLightUrl
                    ? 'Replace'
                    : 'Upload'}
              </Button>
              {displayLightUrl && (
                <Button
                  size="2"
                  variant="soft"
                  color="red"
                  onClick={() => handleDelete('light', currentLightLogoPath)}
                  disabled={disabled || uploadingLight}
                >
                  Delete
                </Button>
              )}
            </Flex>
          </Box>

          {/* Dark Mode Logo */}
          <Box style={{ flex: '1 1 300px', minWidth: 250 }}>
            <Text as="div" size="2" color="gray" mb="2">
              Dark Mode Logo
            </Text>
            {displayDarkUrl && (
              <Box
                style={{
                  width: '100%',
                  maxWidth: 300,
                  aspectRatio: '5/3',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--gray-a6)',
                  backgroundColor: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {darkImageLoading && (
                  <Skeleton
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  />
                )}
                <img
                  src={displayDarkUrl}
                  alt="Dark mode logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: darkImageLoading ? 0 : 1,
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                  onLoad={() => setDarkImageLoading(false)}
                  onError={() => setDarkImageLoading(false)}
                />
              </Box>
            )}
            <Flex gap="2" align="center" mt="2">
              <input
                ref={darkFileInputRef}
                type="file"
                accept="image/png,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileSelect(
                      file,
                      'dark',
                      setUploadingDark,
                      setPreviewDarkUrl,
                      previewDarkUrlRef,
                      setDarkImageLoading,
                    )
                  }
                  if (darkFileInputRef.current) {
                    darkFileInputRef.current.value = ''
                  }
                }}
                disabled={disabled || uploadingDark}
                style={{ display: 'none' }}
              />
              <Button
                size="2"
                variant="soft"
                onClick={() => darkFileInputRef.current?.click()}
                disabled={disabled || uploadingDark}
              >
                <Upload width={16} height={16} />
                {uploadingDark
                  ? 'Uploading...'
                  : displayDarkUrl
                    ? 'Replace'
                    : 'Upload'}
              </Button>
              {displayDarkUrl && (
                <Button
                  size="2"
                  variant="soft"
                  color="red"
                  onClick={() => handleDelete('dark', currentDarkLogoPath)}
                  disabled={disabled || uploadingDark}
                >
                  Delete
                </Button>
              )}
            </Flex>
          </Box>
        </Flex>

        <Text size="1" color="gray">
          Company logos must be PNG or SVG format with transparent backgrounds.
          Upload separate logos for light and dark mode.
        </Text>
      </Flex>
    </Box>
  )
}
