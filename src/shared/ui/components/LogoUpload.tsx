import * as React from 'react'
import { Box, Button, Flex, Skeleton, Text } from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Upload } from 'iconoir-react'

const TARGET_ASPECT_RATIO = 2 / 1 // 2:1 ratio
const ASPECT_RATIO_TOLERANCE = 0.1 // Allow 10% tolerance

interface LogoUploadProps {
  currentLogoPath: string | null
  onUploadComplete: (path: string) => void
  onDelete?: () => void
  uploadPath: string // e.g., "companies/{companyId}/logo.jpg" or "customers/{companyId}/{customerId}/logo.jpg"
  disabled?: boolean
}

export default function LogoUpload({
  currentLogoPath,
  onUploadComplete,
  onDelete,
  uploadPath,
  disabled = false,
}: LogoUploadProps) {
  const [uploading, setUploading] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [imageLoading, setImageLoading] = React.useState(true)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const previewUrlRef = React.useRef<string | null>(null)
  const { success, error: toastError } = useToast()

  // Get public URL for current logo with cache-busting
  const logoUrl = React.useMemo(() => {
    if (currentLogoPath) {
      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(currentLogoPath)
      // Add cache-busting parameter to ensure fresh images when switching customers
      return `${data.publicUrl}?t=${Date.now()}`
    }
    return null
  }, [currentLogoPath])

  // Reset preview URL when currentLogoPath or uploadPath changes (i.e., when switching customers/companies)
  React.useEffect(() => {
    // Clean up previous preview URL if it exists
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreviewUrl(null)
    // Reset loading state when logo path changes
    setImageLoading(true)
  }, [currentLogoPath, uploadPath])

  // Clean up preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  // Validate image aspect ratio
  const validateAspectRatio = (
    file: File,
  ): Promise<{ isValid: boolean; width?: number; height?: number }> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const aspectRatio = img.width / img.height
        const isValid =
          Math.abs(aspectRatio - TARGET_ASPECT_RATIO) <=
          TARGET_ASPECT_RATIO * ASPECT_RATIO_TOLERANCE
        URL.revokeObjectURL(url)
        resolve({ isValid, width: img.width, height: img.height })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve({ isValid: false })
      }
      img.src = url
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg)$/)) {
      toastError(
        'Invalid file type',
        'Please upload a JPG image file. PNG files with transparency are not allowed.',
      )
      return
    }

    // Validate aspect ratio
    setUploading(true)
    try {
      const {
        isValid: isValidAspectRatio,
        width,
        height,
      } = await validateAspectRatio(file)
      if (!isValidAspectRatio) {
        const currentRatio = width && height ? `${width}:${height}` : 'unknown'
        toastError(
          'Invalid aspect ratio',
          `Logo must have a 2:1 aspect ratio (width:height). Your image has a ${currentRatio} ratio.`,
        )
        setUploading(false)
        return
      }

      // Clean up previous preview URL if it exists
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }

      // Create preview
      const preview = URL.createObjectURL(file)
      previewUrlRef.current = preview
      setPreviewUrl(preview)
      setImageLoading(true) // Show skeleton while preview loads

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

      onUploadComplete(uploadPath)
      success('Logo uploaded', 'Logo has been uploaded successfully.')

      // Clear preview URL after successful upload - the actual logo URL will be used
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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    if (!currentLogoPath) return

    try {
      const { error } = await supabase.storage
        .from('logos')
        .remove([currentLogoPath])

      if (error) throw error

      onDelete?.()
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setPreviewUrl(null)
      success('Logo deleted', 'Logo has been removed.')
    } catch (err: any) {
      toastError('Delete failed', err?.message || 'Failed to delete logo.')
    }
  }

  const displayUrl = previewUrl || logoUrl

  return (
    <Box>
      <Flex direction="column" gap="3">
        {displayUrl && (
          <Box
            style={{
              width: '100%',
              maxWidth: 300,
              aspectRatio: '2/1',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--gray-a6)',
              backgroundColor: 'var(--gray-a2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {imageLoading && (
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
              src={displayUrl}
              alt="Logo preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: imageLoading ? 0 : 1,
                transition: 'opacity 0.2s ease-in-out',
              }}
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
          </Box>
        )}

        <Flex gap="2" align="center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg"
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            style={{ display: 'none' }}
          />
          <Button
            size="2"
            variant="soft"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
          >
            <Upload width={16} height={16} />
            {uploading ? 'Uploading...' : displayUrl ? 'Replace' : 'Upload'}
          </Button>
          {displayUrl && onDelete && (
            <Button
              size="2"
              variant="soft"
              color="red"
              onClick={handleDelete}
              disabled={disabled || uploading}
            >
              Delete
            </Button>
          )}
        </Flex>
        <Text size="1" color="gray">
          Logo must be JPG format with a 2:1 aspect ratio (width:height)
        </Text>
      </Flex>
    </Box>
  )
}
