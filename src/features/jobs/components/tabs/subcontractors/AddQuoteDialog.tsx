import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  createJobSubcontractorQuote,
  jobSubcontractorQuotesKey,
  updateJobSubcontractorQuote,
  uploadJobSubcontractorQuotePdf,
} from '../../../api/subcontractorQueries'
import type {
  JobSubcontractorQuoteRow,
  JobSubcontractorRow,
} from '../../../api/subcontractorQueries'

type PdfMeta = {
  path: string
  filename: string
  mimeType: string
  sizeBytes: number
}

function quotePdfMeta(quote: JobSubcontractorQuoteRow): PdfMeta | null {
  if (!quote.pdf_path) return null
  return {
    path: quote.pdf_path,
    filename: quote.pdf_filename ?? 'quote.pdf',
    mimeType: quote.mime_type ?? 'application/pdf',
    sizeBytes: quote.size_bytes ?? 0,
  }
}

const defaultValues = {
  totalAmount: 0,
  note: '',
  pdfMeta: null as PdfMeta | null,
  pdfReplaced: false,
}

const schema = z.object({
  totalAmount: z.number().positive('Total amount must be greater than 0'),
  note: z.string(),
  pdfMeta: z
    .object({
      path: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number(),
    })
    .nullable(),
  pdfReplaced: z.boolean(),
})

export default function AddQuoteDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  subcontractor,
  quote,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  companyId: string
  subcontractor: JobSubcontractorRow
  quote?: JobSubcontractorQuoteRow | null
}) {
  const isEdit = quote != null
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (quote) {
      form.reset({
        totalAmount: quote.total_amount,
        note: quote.note ?? '',
        pdfMeta: quotePdfMeta(quote),
        pdfReplaced: false,
      })
    } else {
      form.reset(defaultValues)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, quote])

  const saveMutation = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      const pdfPath = value.pdfMeta?.path ?? null
      const pdfFilename = value.pdfMeta?.filename ?? null
      const mimeType = value.pdfMeta?.mimeType ?? null
      const sizeBytes = value.pdfMeta?.sizeBytes ?? null

      if (isEdit) {
        await updateJobSubcontractorQuote({
          id: quote.id,
          totalAmount: value.totalAmount,
          note: value.note.trim() || null,
          pdfPath,
          pdfFilename,
          mimeType,
          sizeBytes,
        })
      } else {
        await createJobSubcontractorQuote({
          jobId,
          jobSubcontractorId: subcontractor.id,
          totalAmount: value.totalAmount,
          note: value.note.trim() || null,
          pdfPath,
          pdfFilename,
          mimeType,
          sizeBytes,
        })
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: jobSubcontractorQuotesKey(jobId),
      })
      success(
        isEdit ? 'Quote updated' : 'Quote added',
        isEdit
          ? 'Subcontractor quote was updated.'
          : 'Subcontractor quote version saved.',
      )
      form.reset(defaultValues)
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toastError(
        isEdit ? 'Could not update quote' : 'Could not save quote',
        e.message,
      )
    },
  })

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const uploaded = await uploadJobSubcontractorQuotePdf({
        companyId,
        jobId,
        jobSubcontractorId: subcontractor.id,
        file,
      })
      form.setFieldValue('pdfMeta', uploaded)
      form.setFieldValue('pdfReplaced', true)
    } catch (e) {
      toastError(
        'Upload failed',
        e instanceof Error ? e.message : 'Could not upload PDF',
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const dialogTitle = isEdit
    ? `Edit quote v${quote.version_number} — ${subcontractor.customer.name}`
    : `Add quote — ${subcontractor.customer.name}`

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset(defaultValues)
        onOpenChange(next)
      }}
    >
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>{dialogTitle}</Dialog.Title>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="totalAmount">
                {(field) => (
                  <Flex direction="column" gap="1">
                    <Text size="2" weight="medium">
                      Total amount
                    </Text>
                    <TextField.Root
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(Number(e.target.value) || 0)
                      }
                    />
                  </Flex>
                )}
              </form.AppField>
              <form.AppField name="note">
                {(field) => (
                  <field.TextArea
                    label="Note"
                    rows={2}
                    placeholder="Optional note"
                  />
                )}
              </form.AppField>
              <form.Subscribe selector={(state) => state.values.pdfMeta}>
                {(pdfMeta) => (
                  <Flex gap="2" align="center" wrap="wrap">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleUpload(file)
                      }}
                    />
                    <Button
                      type="button"
                      size="1"
                      variant="soft"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {pdfMeta ? 'Replace PDF' : 'Upload PDF'}
                    </Button>
                    {pdfMeta && (
                      <Text size="2">
                        {form.state.values.pdfReplaced || !isEdit
                          ? pdfMeta.filename
                          : (quote.pdf_filename ?? pdfMeta.filename)}
                      </Text>
                    )}
                  </Flex>
                )}
              </form.Subscribe>
              <Flex justify="end" gap="2" mt="2">
                <Dialog.Close>
                  <Button type="button" variant="soft" color="gray">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton
                  label={isEdit ? 'Save changes' : 'Save quote version'}
                  pendingLabel="Saving…"
                />
              </Flex>
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
