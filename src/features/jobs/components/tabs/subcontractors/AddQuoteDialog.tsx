import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
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
  const [totalAmount, setTotalAmount] = React.useState(0)
  const [note, setNote] = React.useState('')
  const [pdfMeta, setPdfMeta] = React.useState<PdfMeta | null>(null)
  const [pdfReplaced, setPdfReplaced] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  const reset = () => {
    setTotalAmount(0)
    setNote('')
    setPdfMeta(null)
    setPdfReplaced(false)
  }

  React.useEffect(() => {
    if (!open) return
    if (quote) {
      setTotalAmount(quote.total_amount)
      setNote(quote.note ?? '')
      setPdfMeta(quotePdfMeta(quote))
      setPdfReplaced(false)
    } else {
      reset()
    }
  }, [open, quote])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pdfPath = pdfMeta?.path ?? null
      const pdfFilename = pdfMeta?.filename ?? null
      const mimeType = pdfMeta?.mimeType ?? null
      const sizeBytes = pdfMeta?.sizeBytes ?? null

      if (isEdit && quote) {
        await updateJobSubcontractorQuote({
          id: quote.id,
          totalAmount,
          note: note.trim() || null,
          pdfPath,
          pdfFilename,
          mimeType,
          sizeBytes,
        })
      } else {
        await createJobSubcontractorQuote({
          jobId,
          jobSubcontractorId: subcontractor.id,
          totalAmount,
          note: note.trim() || null,
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
      reset()
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
      setPdfMeta(uploaded)
      setPdfReplaced(true)
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
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>{dialogTitle}</Dialog.Title>
        <Flex direction="column" gap="3" mt="3">
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">
              Total amount
            </Text>
            <TextField.Root
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium">
              Note
            </Text>
            <TextArea
              value={note}
              rows={2}
              placeholder="Optional note"
              onChange={(e) => setNote(e.target.value)}
            />
          </Flex>
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
              size="1"
              variant="soft"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {pdfMeta ? 'Replace PDF' : 'Upload PDF'}
            </Button>
            {pdfMeta && (
              <Text size="2">
                {pdfReplaced || !isEdit
                  ? pdfMeta.filename
                  : (quote?.pdf_filename ?? pdfMeta.filename)}
              </Text>
            )}
          </Flex>
          <Flex justify="end" gap="2" mt="2">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || totalAmount <= 0}
            >
              {saveMutation.isPending
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : 'Save quote version'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
