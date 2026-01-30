import * as React from 'react'
import {
  AlertDialog,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  IconButton,
  Separator,
  Table,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Download, Edit, GoogleDocs, Plus, Trash } from 'iconoir-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { JobDetail } from '../../types'

export type FilesTabHandle = {
  checkUnsavedChanges: (proceed: () => void) => void
}

const FilesTab = React.forwardRef<FilesTabHandle, { job: JobDetail }>(
  ({ job }, ref) => {
    const { companyRole } = useAuthz()
    const isReadOnly = companyRole === 'freelancer'
    const { success, error, info } = useToast()
    const qc = useQueryClient()
    const [addOpen, setAddOpen] = React.useState(false)
    const [editFileId, setEditFileId] = React.useState<string | null>(null)

    const { data: authUser } = useQuery({
      queryKey: ['auth', 'user'],
      queryFn: async () => {
        const { data, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        return data.user
      },
    })

    const [notes, setNotes] = React.useState(job.description)
    const [saveBeforeLeaveOpen, setSaveBeforeLeaveOpen] = React.useState(false)
    const [pendingNavigation, setPendingNavigation] = React.useState<
      (() => void) | null
    >(null)

    // Reset notes when job changes
    React.useEffect(() => {
      setNotes(job.description)
      setPendingNavigation(null)
      setSaveBeforeLeaveOpen(false)
    }, [job.id, job.description])

    const initialNotes = job.description
    const hasUnsavedChanges = initialNotes !== notes

    // Expose function to check for unsaved changes when parent tries to change tabs
    React.useImperativeHandle(
      ref,
      () => ({
        checkUnsavedChanges: (proceed: () => void) => {
          if (hasUnsavedChanges) {
            setPendingNavigation(() => proceed)
            setSaveBeforeLeaveOpen(true)
          } else {
            proceed()
          }
        },
      }),
      [hasUnsavedChanges],
    )

    // Handle beforeunload for page navigation
    React.useEffect(() => {
      if (!hasUnsavedChanges || isReadOnly) return

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }, [hasUnsavedChanges, isReadOnly])

    const notesMutation = useMutation({
      mutationFn: async () => {
        if (!authUser?.id) throw new Error('Not Authenticated')

        const { error: linkErr } = await supabase
          .from('jobs')
          .update({ description: notes })
          .eq('id', job.id)
        if (linkErr) throw linkErr
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['jobs-detail', job.id] })
        success('Saved', 'Notes saved on selected job.')
        // If there was a pending navigation, allow it now
        if (pendingNavigation) {
          const proceed = pendingNavigation
          setPendingNavigation(null)
          setSaveBeforeLeaveOpen(false)
          proceed()
        }
      },
      onError: (e: any) => {
        error('Save failed', e?.message ?? 'Please try again.')
      },
    })

    const handleSaveAndLeave = () => {
      if (pendingNavigation) {
        notesMutation.mutate()
      }
    }

    const handleDiscardAndLeave = () => {
      setNotes(initialNotes)
      if (pendingNavigation) {
        const proceed = pendingNavigation
        setPendingNavigation(null)
        setSaveBeforeLeaveOpen(false)
        proceed()
      }
    }

    const { data: files = [], isLoading } = useQuery({
      queryKey: ['job-files', job.id],
      queryFn: async () => {
        const { data, error: queryError } = await supabase
          .from('job_files')
          .select('*, uploaded_by:uploaded_by_user_id(email, display_name)')
          .eq('job_id', job.id)
          .order('created_at', { ascending: false })

        if (queryError) throw queryError
        return data
      },
    })

    const deleteFile = useMutation({
      mutationFn: async (fileId: string) => {
        // Get the file to delete the storage object
        const { data: file } = await supabase
          .from('job_files')
          .select('path')
          .eq('id', fileId)
          .single()

        if (file) {
          // Delete from storage
          const { error: storageErr } = await supabase.storage
            .from('job_files')
            .remove([file.path])

          if (storageErr) throw storageErr
        }

        // Delete from database
        const { error: dbErr } = await supabase
          .from('job_files')
          .delete()
          .eq('id', fileId)

        if (dbErr) throw dbErr
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['job-files', job.id] })
        success('File deleted', 'The file has been removed.')
      },
      onError: (err: any) => {
        error('Delete failed', err?.message || 'Please try again.')
      },
    })

    if (isLoading) return <Text>Loading files…</Text>

    return (
      <Box>
        <Box mb="4">
          <Heading size="3" mb="3">
            Notes
          </Heading>
          {isReadOnly ? (
            <Text style={{ whiteSpace: 'pre-wrap' }}>{notes || '—'}</Text>
          ) : (
            <Box>
              <TextArea
                value={notes || ''}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes here"
                rows={6}
                resize="vertical"
              />
              {initialNotes != notes && (
                <Flex gap="2" mt="2" justify="end">
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => {
                      setNotes(initialNotes)
                    }}
                    disabled={notesMutation.isPending}
                  >
                    Discard
                  </Button>
                  <Button
                    size="2"
                    variant="solid"
                    onClick={() => notesMutation.mutate()}
                    disabled={notesMutation.isPending}
                  >
                    {notesMutation.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </Flex>
              )}
            </Box>
          )}
        </Box>

        <Box>
          <Flex justify="between" align="center" mb="3">
            <Text size="2" color="gray">
              Files uploaded for this job
            </Text>
            {!isReadOnly && (
              <Button size="2" variant="soft" onClick={() => setAddOpen(true)}>
                <Plus width={16} height={16} />
                Upload file
              </Button>
            )}
            <AddFileDialog
              open={addOpen}
              onOpenChange={setAddOpen}
              jobId={job.id}
              onUploaded={() => {
                setAddOpen(false)
                qc.invalidateQueries({ queryKey: ['job-files', job.id] })
              }}
            />
            <EditFileDialog
              open={!!editFileId}
              onOpenChange={(open) => !open && setEditFileId(null)}
              fileId={editFileId}
              jobId={job.id}
              onSaved={() => {
                setEditFileId(null)
                qc.invalidateQueries({ queryKey: ['job-files', job.id] })
              }}
            />
          </Flex>

          {files.length === 0 ? (
            <Box
              p="4"
              style={{ border: '1px dashed var(--gray-a6)', borderRadius: 8 }}
            >
              <Text size="2" color="gray" align="center">
                No files uploaded yet. Click "Upload file" to add one.
              </Text>
            </Box>
          ) : (
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>File</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Uploaded by</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: 80 }}>
                    Actions
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {files.map((file: any) => (
                  <Table.Row key={file.id}>
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <GoogleDocs width={16} height={16} />
                        <Text size="2" weight="medium">
                          {file.filename || 'Unnamed file'}
                        </Text>
                        {file.size_bytes && (
                          <Text size="1" color="gray">
                            ({(file.size_bytes / 1024).toFixed(1)} KB)
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color={file.title ? undefined : 'gray'}>
                        {file.title || '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color={file.note ? undefined : 'gray'}>
                        {file.note || '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="2" color="gray">
                        {file.uploaded_by?.display_name ||
                          file.uploaded_by?.email ||
                          '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="1">
                        <IconButton
                          size="1"
                          variant="soft"
                          onClick={async () => {
                            const { data } = await supabase.storage
                              .from('job_files')
                              .download(file.path)

                            if (data && file.filename) {
                              const url = window.URL.createObjectURL(data)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = file.filename
                              document.body.appendChild(a)
                              a.click()
                              window.URL.revokeObjectURL(url)
                              document.body.removeChild(a)
                            }
                          }}
                        >
                          <Download width={14} height={14} />
                        </IconButton>
                        {!isReadOnly && (
                          <>
                            <IconButton
                              size="1"
                              variant="soft"
                              onClick={() => setEditFileId(file.id)}
                            >
                              <Edit width={14} height={14} />
                            </IconButton>
                            <IconButton
                              size="1"
                              variant="soft"
                              color="red"
                              onClick={() => {
                                info('Deleting file...', 'Please wait')
                                deleteFile.mutate(file.id)
                              }}
                            >
                              <Trash width={14} height={14} />
                            </IconButton>
                          </>
                        )}
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Box>

        {/* Save before leave dialog */}
        <AlertDialog.Root
          open={saveBeforeLeaveOpen}
          onOpenChange={setSaveBeforeLeaveOpen}
        >
          <AlertDialog.Content maxWidth="480px">
            <AlertDialog.Title>Save changes?</AlertDialog.Title>
            <AlertDialog.Description size="2">
              You have unsaved changes to the notes. Do you want to save them
              before leaving?
            </AlertDialog.Description>
            <Flex gap="3" justify="end" mt="4">
              <AlertDialog.Cancel>
                <Button
                  variant="soft"
                  onClick={() => {
                    setSaveBeforeLeaveOpen(false)
                    setPendingNavigation(null)
                  }}
                >
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <Button
                variant="soft"
                color="red"
                onClick={handleDiscardAndLeave}
                disabled={notesMutation.isPending}
              >
                Discard
              </Button>
              <Button
                variant="solid"
                onClick={handleSaveAndLeave}
                disabled={notesMutation.isPending}
              >
                {notesMutation.isPending ? 'Saving…' : 'Save and leave'}
              </Button>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </Box>
    )
  },
)

FilesTab.displayName = 'FilesTab'

export default FilesTab

function AddFileDialog({
  open,
  onOpenChange,
  jobId,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  onUploaded: () => void
}) {
  const { success, error } = useToast()
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [note, setNote] = React.useState('')
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const titleSuggestions = [
    'Contract',
    'Schedule',
    'Offer',
    'Quote',
    'Drawings',
  ]

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleSave = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Generate unique filename
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'bin'
      const timestamp = Date.now()
      const filename = `${timestamp}.${ext}`
      const path = `${jobId}/${filename}`

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from('job_files')
        .upload(path, selectedFile, {
          upsert: false,
          cacheControl: '3600',
        })

      if (uploadErr) throw uploadErr

      // Insert metadata into database
      const { error: dbErr } = await supabase.from('job_files').insert({
        job_id: jobId,
        filename: selectedFile.name,
        path,
        mime_type: selectedFile.type,
        size_bytes: selectedFile.size,
        uploaded_by_user_id: user.id,
        title: title || null,
        note: note || null,
      })

      if (dbErr) throw dbErr

      success('File uploaded', 'The file has been successfully uploaded.')
      // Reset form
      setSelectedFile(null)
      setTitle('')
      setNote('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      onUploaded()
    } catch (err: any) {
      error('Upload failed', err?.message || 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setTitle('')
    setNote('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Upload File</Dialog.Title>
        <Separator my="3" />

        <Flex direction="column" gap="3">
          <Flex gap="2" align="center">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <Button
              variant="soft"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Upload file
            </Button>
            {selectedFile && (
              <Text size="2" color="gray">
                {selectedFile.name}
              </Text>
            )}
          </Flex>

          <Field label="Title">
            <TextField.Root
              placeholder="e.g., Contract, Schedule, Offer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Flex gap="2" wrap="wrap" mt="2">
              <Text size="1" color="gray" style={{ width: '100%' }}>
                Quick suggestions:
              </Text>
              {titleSuggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={() => setTitle(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </Flex>
          </Field>

          <Field label="Description">
            <TextArea
              placeholder="Optional description or additional information"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </Field>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" onClick={handleCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="solid"
            onClick={handleSave}
            disabled={uploading || !selectedFile}
          >
            {uploading ? 'Uploading…' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}
function EditFileDialog({
  open,
  onOpenChange,
  fileId,
  jobId: _jobId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileId: string | null
  jobId: string
  onSaved: () => void
}) {
  const { success, error } = useToast()
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [note, setNote] = React.useState('')

  const { data: file } = useQuery({
    queryKey: ['job-file', fileId],
    queryFn: async () => {
      if (!fileId) return null
      const { data, error: queryError } = await supabase
        .from('job_files')
        .select('*')
        .eq('id', fileId)
        .single()

      if (queryError) throw queryError
      return data
    },
    enabled: !!fileId && open,
  })

  // Populate form when file loads
  React.useEffect(() => {
    if (file) {
      setTitle(file.title || '')
      setNote(file.note || '')
    }
  }, [file])

  const handleSave = async () => {
    if (!fileId) return

    setSaving(true)
    try {
      const { error: dbErr } = await supabase
        .from('job_files')
        .update({
          title: title || null,
          note: note || null,
        })
        .eq('id', fileId)

      if (dbErr) throw dbErr

      success('File updated', 'The file information has been saved.')
      onSaved()
    } catch (err: any) {
      error('Update failed', err?.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setTitle('')
    setNote('')
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="600px">
        <Dialog.Title>Edit File</Dialog.Title>
        <Separator my="3" />

        <Flex direction="column" gap="3">
          <Field label="File">
            <Text size="2" color="gray">
              {file?.filename || 'Loading…'}
            </Text>
          </Field>

          <Field label="Title">
            <TextField.Root
              placeholder="e.g., Contract, Invoice, Setup Photos"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label="Description">
            <TextArea
              placeholder="Optional description or additional information"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </Field>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="solid" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
