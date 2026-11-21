import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Link } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { linkContaInvoiceByNumber } from '../../api/linkContaInvoice'

/**
 * Primary UI for linking an existing Conta sales invoice (by invoice number)
 * to the current job. Lives on the Invoice tab.
 */
export default function LinkContaInvoiceByNumberCard({
  jobId,
  jobTitle,
  jobnr,
  organizationId,
}: {
  jobId: string
  jobTitle: string
  jobnr: number | null
  organizationId: string | null
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [invoiceNumberInput, setInvoiceNumberInput] = React.useState('')

  const invalidateInvoiceQueries = React.useCallback(() => {
    void qc.invalidateQueries({
      queryKey: ['jobs', jobId, 'money', 'sales-invoices'],
    })
    void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'invoices'] })
    void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'money'] })
  }, [qc, jobId])

  const linkMutation = useMutation({
    mutationFn: async (invoiceNumber: string) => {
      if (!organizationId) {
        throw new Error('Conta organization is not configured for this company')
      }
      const { data: auth } = await supabase.auth.getUser()
      return linkContaInvoiceByNumber({
        jobId,
        organizationId,
        invoiceNumber,
        jobMeta: { id: jobId, title: jobTitle, jobnr },
        createdByUserId: auth.user?.id ?? null,
      })
    },
    onSuccess: (result) => {
      setInvoiceNumberInput('')
      invalidateInvoiceQueries()
      if (result.kind === 'already_linked') {
        success(
          'Already linked',
          `Conta invoice #${result.contaInvoiceId} is already linked to this job.`,
        )
        return
      }
      if (result.kind === 'added_to_existing') {
        const other =
          result.primaryJob.jobnr != null
            ? `#${result.primaryJob.jobnr} ${result.primaryJob.title}`
            : result.primaryJob.title
        success(
          'Job added to Conta invoice',
          `Invoice #${result.contaInvoiceId} was already on ${other}. This job is now included (multi-job link).`,
        )
        return
      }
      success(
        'Conta invoice linked',
        `Invoice #${result.contaInvoiceId} is linked to this job.`,
      )
    },
    onError: (e: unknown) => {
      toastError(
        'Could not link Conta invoice',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const isLinking = linkMutation.isPending
  const canLink = !!organizationId && !isLinking

  const submitLink = () => {
    const trimmed = invoiceNumberInput.trim()
    if (!trimmed || !canLink) return
    linkMutation.mutate(trimmed)
  }

  return (
    <Card mb="4">
      <Heading size="4" mb="2">
        Link existing Conta invoice
      </Heading>
      <Text size="2" color="gray" mb="3">
        If the invoice was created outside Grid, enter the Conta invoice number
        to attach it to this job. Preview and lines stay on the Accounting tab.
      </Text>
      <Flex gap="2" align="end" wrap="wrap">
        <Box style={{ flex: '1 1 160px', minWidth: 140 }}>
          <Text size="1" color="gray" mb="1">
            Conta invoice number
          </Text>
          <TextField.Root
            id="invoice-tab-link-conta-invoice-no"
            size="2"
            placeholder="e.g. 10042"
            value={invoiceNumberInput}
            disabled={!organizationId || isLinking}
            onChange={(e) => setInvoiceNumberInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitLink()
              }
            }}
          />
        </Box>
        <Button
          size="2"
          disabled={!canLink || !invoiceNumberInput.trim()}
          onClick={submitLink}
        >
          <Flex align="center" gap="1">
            {isLinking ? <Spinner size="1" /> : <Link width={14} height={14} />}
            {isLinking ? 'Linking…' : 'Link invoice'}
          </Flex>
        </Button>
        {!organizationId && (
          <Text size="1" color="orange" style={{ flexBasis: '100%' }}>
            Connect Conta in Company settings to link invoices.
          </Text>
        )}
      </Flex>
    </Card>
  )
}
