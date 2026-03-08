// src/features/jobs/components/invoice/InvoiceHistory.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes'
import { CheckCircle, OpenNewWindow, XmarkCircle } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { contaClient } from '@shared/api/conta/client'

type InvoiceRecord = {
  id: string
  job_id: string
  offer_id: string | null
  organization_id: string
  conta_invoice_id: string | null
  conta_customer_id: number | null
  invoice_basis: 'offer' | 'bookings'
  invoice_data: any
  status: 'pending' | 'created' | 'failed'
  error_message: string | null
  created_at: string
  conta_response: any
}

export default function InvoiceHistory({ jobId }: { jobId: string }) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['jobs', jobId, 'invoices'],
    queryFn: async (): Promise<Array<InvoiceRecord>> => {
      const { data, error } = await supabase
        .from('job_invoices')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Array<InvoiceRecord>
    },
  })
  const syncInFlightRef = React.useRef(false)

  const isContaInvoicePaid = (contaInvoice: any) => {
    const status = contaInvoice?.status
    const extendedStatus = contaInvoice?.extendedStatus
    return status === 'CLOSED_BY_PAYMENT' || extendedStatus === 'PAID'
  }

  type StatusColor = 'green' | 'orange' | 'blue' | 'red' | 'gray'

  const getInvoiceStatusPresentation = (
    invoice: InvoiceRecord,
  ): {
    label: string
    color: StatusColor
    icon: typeof CheckCircle | typeof XmarkCircle | null
  } => {
    const contaStatus = invoice.conta_response?.status
    const extendedStatus = invoice.conta_response?.extendedStatus
    if (isContaInvoicePaid(invoice.conta_response)) {
      return { label: 'Paid', color: 'green', icon: CheckCircle }
    }
    if (
      contaStatus === 'CLOSED_BY_CREDIT_NOTE' ||
      extendedStatus === 'CREDIT_NOTE'
    ) {
      return { label: 'Credited', color: 'orange', icon: XmarkCircle }
    }
    if (
      contaStatus === 'INVOICE_CREATED' ||
      contaStatus === 'PAYMENT_REMINDER_CREATED' ||
      [
        'NOT_OVERDUE',
        'PAST_FOLLOW_UP_DATE',
        'PAST_FOLLOW_UP_DATE_BY_14_DAYS',
        'REMINDER_SENT',
        'PAYMENT_REMINDER_PAST_FOLLOW_UP_DATE',
      ].includes(extendedStatus || '')
    ) {
      return { label: 'Sent', color: 'blue', icon: CheckCircle }
    }
    if (invoice.status === 'failed') {
      return { label: 'Failed', color: 'red', icon: XmarkCircle }
    }
    if (invoice.status === 'created') {
      return { label: 'Created', color: 'green', icon: CheckCircle }
    }
    return { label: 'Pending', color: 'gray', icon: null }
  }

  const vatCodeToPercent = (vatCode: string | undefined): number => {
    if (!vatCode || vatCode === 'no.vat') return 0
    if (vatCode === 'high') return 25
    if (vatCode === 'medium') return 15
    if (vatCode === 'low') return 10
    return 25
  }

  const getInvoiceTotal = (invoice: InvoiceRecord): number | null => {
    const contaAmount =
      invoice.conta_response?.amount ??
      invoice.conta_response?.totalAmount ??
      invoice.conta_response?.sumRemaining
    if (typeof contaAmount === 'number') return contaAmount

    const lines = invoice.invoice_data?.invoiceLines
    if (!Array.isArray(lines) || lines.length === 0) return null

    let totalWithVat = 0
    for (const line of lines) {
      const price = Number(line.price) || 0
      const qty = Number(line.quantity) || 0
      const discount = Number(line.discount) || 0
      const exVat = price * qty * (1 - discount / 100)
      const vatPercent = vatCodeToPercent(line.vatCode)
      totalWithVat += exVat * (1 + vatPercent / 100)
    }
    return Math.round(totalWithVat * 100) / 100
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)

  const getInvoiceDeliveryLabel = (invoice: InvoiceRecord) => {
    const recipients =
      invoice.conta_response?.invoiceRecipients ||
      invoice.invoice_data?.invoiceRecipients ||
      []
    const hasEhf = recipients.some(
      (recipient: { type?: string; deliveryMethod?: string }) =>
        recipient.type === 'EHF' || recipient.deliveryMethod === 'EHF',
    )
    if (hasEhf) return 'EHF'
    return 'Manual'
  }

  const fetchContaInvoiceByNumber = async (
    organizationId: string,
    invoiceNo: string,
  ) => {
    const searchResponse = (await contaClient.get(
      `/invoice/organizations/${organizationId}/invoices?invoiceNo=${encodeURIComponent(invoiceNo)}`,
    )) as { hits?: Array<{ id?: number | string }> } | Array<any>
    const hits = Array.isArray(searchResponse)
      ? searchResponse
      : Array.isArray((searchResponse as { hits?: Array<any> }).hits)
        ? (searchResponse as { hits: Array<any> }).hits
        : []
    const hitId = hits[0]?.id
    if (!hitId) return null
    return contaClient.get(
      `/invoice/organizations/${organizationId}/invoices/${hitId}`,
    )
  }

  const syncContaInvoiceStatuses = React.useCallback(async () => {
    const invoicesToSync = invoices.filter(
      (invoice) => invoice.conta_invoice_id,
    )
    if (invoicesToSync.length === 0 || syncInFlightRef.current) return

    syncInFlightRef.current = true
    try {
      let hasPaidInvoice = false

      for (const invoice of invoicesToSync) {
        try {
          const invoiceNo = invoice.conta_invoice_id
          if (!invoiceNo) {
            continue
          }
          const preferredInvoiceId =
            invoice.conta_response?.id || invoice.conta_response?.invoiceId
          const contaInvoice = preferredInvoiceId
            ? await contaClient.get(
                `/invoice/organizations/${invoice.organization_id}/invoices/${preferredInvoiceId}`,
              )
            : await fetchContaInvoiceByNumber(
                invoice.organization_id,
                invoiceNo,
              )
          if (!contaInvoice) {
            console.warn('Conta invoice not found for number', {
              invoiceId: invoice.id,
              contaInvoiceId: invoice.conta_invoice_id,
            })
            continue
          }
          const { error: updateError } = await supabase
            .from('job_invoices')
            .update({
              conta_response: contaInvoice,
              conta_invoice_id:
                invoice.conta_invoice_id ||
                contaInvoice?.invoiceNo?.toString() ||
                contaInvoice?.id?.toString() ||
                contaInvoice?.invoiceId?.toString() ||
                null,
            })
            .eq('id', invoice.id)
          if (updateError) {
            console.warn('Failed to persist Conta invoice response', {
              invoiceId: invoice.id,
              contaInvoiceId: invoice.conta_invoice_id,
              error: updateError,
            })
          }

          if (isContaInvoicePaid(contaInvoice)) {
            hasPaidInvoice = true
          }
        } catch (error) {
          console.warn('Failed to sync Conta invoice status', {
            invoiceId: invoice.id,
            contaInvoiceId: invoice.conta_invoice_id,
            error,
          })
        }
      }

      if (hasPaidInvoice) {
        await supabase
          .from('jobs')
          .update({ status: 'paid' })
          .eq('id', jobId)
          .in('status', ['invoiced'])
      }
    } finally {
      syncInFlightRef.current = false
    }
  }, [invoices, jobId])

  React.useEffect(() => {
    if (invoices.length === 0) return

    let isActive = true
    const runSync = async () => {
      if (!isActive) return
      await syncContaInvoiceStatuses()
    }

    runSync()
    const interval = window.setInterval(runSync, 5 * 60 * 1000)

    return () => {
      isActive = false
      window.clearInterval(interval)
    }
  }, [invoices, syncContaInvoiceStatuses])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getContaInvoiceUrl = (
    organizationId: string,
    invoiceId: string | null,
  ) => {
    if (!invoiceId) return null
    const baseUrl =
      import.meta.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'
    const appBase =
      baseUrl.includes('sandbox') || baseUrl.includes('test')
        ? 'https://app.conta-sandbox.no'
        : 'https://app.conta.no'
    return `${appBase}/faktura/${organizationId}/fakturaer/${invoiceId}`
  }

  if (isLoading) {
    return (
      <Card>
        <Heading size="4" mb="3">
          Invoice History
        </Heading>
        <Text>Loading invoice history...</Text>
      </Card>
    )
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <Heading size="4" mb="3">
          Invoice History
        </Heading>
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="3" color="gray">
            No invoices created yet
          </Text>
          <Text size="2" color="gray" mt="2" style={{ display: 'block' }}>
            Invoices created through this system will appear here
          </Text>
        </Box>
      </Card>
    )
  }

  return (
    <Card>
      <Heading size="4" mb="3">
        Invoice History
      </Heading>
      <Box style={{ overflowX: 'auto' }}>
          <Table.Root style={{ width: '100%', minWidth: 720 }}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Basis</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Delivery</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                Total
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Conta Invoice ID</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                Actions
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {invoices.map((invoice) => {
              const displayContaInvoiceId =
                invoice.conta_invoice_id ||
                invoice.conta_response?.invoiceNo?.toString() ||
                invoice.conta_response?.id?.toString() ||
                invoice.conta_response?.invoiceId?.toString() ||
                null
              const contaInvoiceIdForUrl =
                invoice.conta_response?.id?.toString() ||
                invoice.conta_response?.invoiceId?.toString() ||
                displayContaInvoiceId
              const contaUrl = getContaInvoiceUrl(
                invoice.organization_id,
                contaInvoiceIdForUrl,
              )

              return (
                <Table.Row key={invoice.id}>
                  <Table.Cell>
                    <Text size="2">{formatDate(invoice.created_at)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      variant="soft"
                      color={
                        invoice.invoice_basis === 'offer' ? 'blue' : 'purple'
                      }
                    >
                      {invoice.invoice_basis === 'offer' ? 'Offer' : 'Bookings'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {(() => {
                      const presentation = getInvoiceStatusPresentation(invoice)
                      if (!presentation.icon) {
                        return (
                          <Text size="2" color={presentation.color}>
                            {presentation.label}
                          </Text>
                        )
                      }
                      const Icon = presentation.icon
                      return (
                        <Flex align="center" gap="2">
                          <Icon
                            width={16}
                            height={16}
                            color={`var(--${presentation.color}-9)`}
                          />
                          <Text
                            size="2"
                            color={presentation.color}
                            weight="medium"
                          >
                            {presentation.label}
                          </Text>
                        </Flex>
                      )
                    })()}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2" color="gray">
                      {getInvoiceDeliveryLabel(invoice)}
                    </Text>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    {getInvoiceTotal(invoice) != null ? (
                      <Text size="2" weight="medium">
                        {formatCurrency(getInvoiceTotal(invoice)!)}
                      </Text>
                    ) : (
                      <Text size="2" color="gray">—</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {displayContaInvoiceId ? (
                      <Text
                        size="2"
                        weight="medium"
                        style={{ fontFamily: 'monospace' }}
                      >
                        {displayContaInvoiceId}
                      </Text>
                    ) : (
                      <Text size="2" color="gray">
                        —
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    {contaUrl && (
                      <Button
                        size="1"
                        variant="ghost"
                        onClick={() => window.open(contaUrl, '_blank')}
                      >
                        <OpenNewWindow width={14} height={14} />
                        View in Conta
                      </Button>
                    )}
                    {invoice.error_message && (
                      <Box mt="2">
                        <Text size="1" color="red">
                          {invoice.error_message}
                        </Text>
                      </Box>
                    )}
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      </Box>
    </Card>
  )
}
