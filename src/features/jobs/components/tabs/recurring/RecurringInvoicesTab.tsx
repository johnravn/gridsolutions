// src/features/jobs/components/tabs/recurring/RecurringInvoicesTab.tsx
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
import { OpenNewWindow } from 'iconoir-react'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import {
  recurringJobInvoiceSummaryQuery,
  recurringJobInvoicesOverviewQuery,
} from '../../../api/recurringJobQueries'
import RecurringInvoiceJobPickerDialog from '../../dialogs/RecurringInvoiceJobPickerDialog'
import MultiJobInvoiceDialog from '../../dialogs/MultiJobInvoiceDialog'
import type { RecurringJobDetail, RecurringSeriesInvoice } from '../../../types'

type Props = {
  detail: RecurringJobDetail
  onSelectJob: (jobId: string) => void
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusLabel(invoice: RecurringSeriesInvoice): {
  label: string
  color: 'green' | 'orange' | 'blue' | 'red' | 'gray'
} {
  const response = invoice.conta_response as {
    status?: string
    extendedStatus?: string
  } | null
  const status = response?.status
  const extendedStatus = response?.extendedStatus
  if (status === 'CLOSED_BY_PAYMENT' || extendedStatus === 'PAID') {
    return { label: 'Paid', color: 'green' }
  }
  if (status === 'CLOSED_BY_CREDIT_NOTE' || extendedStatus === 'CREDIT_NOTE') {
    return { label: 'Credited', color: 'orange' }
  }
  if (
    status === 'INVOICE_CREATED' ||
    status === 'PAYMENT_REMINDER_CREATED' ||
    [
      'NOT_OVERDUE',
      'PAST_FOLLOW_UP_DATE',
      'PAST_FOLLOW_UP_DATE_BY_14_DAYS',
      'REMINDER_SENT',
      'PAYMENT_REMINDER_PAST_FOLLOW_UP_DATE',
    ].includes(extendedStatus || '')
  ) {
    return { label: 'Sent', color: 'blue' }
  }
  if (invoice.status === 'failed') return { label: 'Failed', color: 'red' }
  if (invoice.status === 'created') return { label: 'Created', color: 'green' }
  return { label: 'Pending', color: 'gray' }
}

function getContaInvoiceUrl(
  organizationId: string,
  invoiceId: string | null,
): string | null {
  if (!invoiceId) return null
  const baseUrl =
    import.meta.env.VITE_CONTA_API_URL || 'https://api.gateway.conta.no'
  const appBase =
    baseUrl.includes('sandbox') || baseUrl.includes('test')
      ? 'https://app.conta-sandbox.no'
      : 'https://app.conta.no'
  return `${appBase}/faktura/${organizationId}/fakturaer/${invoiceId}`
}

function formatJobLabel(job: { title: string; jobnr: number | null }): string {
  if (job.jobnr != null) {
    return `${job.title} (#${String(job.jobnr).padStart(6, '0')})`
  }
  return job.title
}

export default function RecurringInvoicesTab({ detail, onSelectJob }: Props) {
  const { canWrite } = useCompanyWriteAccess()
  const [invoicePickerOpen, setInvoicePickerOpen] = React.useState(false)
  const [invoicePreviewOpen, setInvoicePreviewOpen] = React.useState(false)
  const [invoiceSelectedJobIds, setInvoiceSelectedJobIds] = React.useState<
    Array<string>
  >([])

  const { data: invoiceSummary = [] } = useQuery({
    ...recurringJobInvoiceSummaryQuery({ recurringJobId: detail.id }),
  })

  const { data: invoices = [], isLoading } = useQuery({
    ...recurringJobInvoicesOverviewQuery({ recurringJobId: detail.id }),
  })

  const readyCount = invoiceSummary.filter(
    (entry) =>
      entry.status === 'completed' &&
      entry.invoice_count === 0 &&
      detail.jobs.some((j) => j.id === entry.job_id && !j.archived),
  ).length

  return (
    <Flex direction="column" gap="4">
      <Card>
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box>
            <Heading size="4" mb="1">
              Create invoice
            </Heading>
            <Text size="2" color="gray">
              Invoice one or more jobs in this series from their bookings.
              {readyCount > 0
                ? ` ${readyCount} completed job${readyCount !== 1 ? 's' : ''} ready to invoice.`
                : ''}
            </Text>
          </Box>
          {canWrite && (
            <Button
              size="2"
              onClick={() => setInvoicePickerOpen(true)}
              disabled={detail.jobs.length === 0}
            >
              Create invoice…
            </Button>
          )}
        </Flex>
      </Card>

      <Box>
        <Heading size="4" mb="3">
          Invoices
        </Heading>
        {isLoading ? (
          <Text size="2" color="gray">
            Loading invoices…
          </Text>
        ) : invoices.length === 0 ? (
          <Box
            p="4"
            style={{
              border: '2px dashed var(--gray-a6)',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <Text size="3" color="gray">
              No invoices for this series yet
            </Text>
            <Text size="2" color="gray" mt="2" style={{ display: 'block' }}>
              Invoices created for member jobs will appear here with the jobs
              they cover.
            </Text>
          </Box>
        ) : (
          <Box style={{ overflowX: 'auto' }}>
            <Table.Root size="2" variant="surface" style={{ minWidth: 640 }}>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Basis</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Jobs covered</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Conta ID</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                    Actions
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {invoices.map((invoice) => {
                  const status = getStatusLabel(invoice)
                  const response = invoice.conta_response as {
                    id?: number | string
                    invoiceId?: number | string
                    invoiceNo?: number | string
                  } | null
                  const displayContaId =
                    invoice.conta_invoice_id ||
                    response?.invoiceNo?.toString() ||
                    response?.id?.toString() ||
                    response?.invoiceId?.toString() ||
                    null
                  const contaUrlId =
                    response?.id?.toString() ||
                    response?.invoiceId?.toString() ||
                    displayContaId
                  const contaUrl = getContaInvoiceUrl(
                    invoice.organization_id,
                    contaUrlId,
                  )

                  return (
                    <Table.Row key={invoice.id}>
                      <Table.Cell>
                        <Text size="2">{formatDate(invoice.created_at)}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={status.color} variant="soft" size="1">
                          {status.label}
                        </Badge>
                        {invoice.error_message && (
                          <Text size="1" color="red" as="p" mt="1">
                            {invoice.error_message}
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          variant="soft"
                          color={
                            invoice.invoice_basis === 'offer'
                              ? 'blue'
                              : 'purple'
                          }
                          size="1"
                        >
                          {invoice.invoice_basis === 'offer'
                            ? 'Offer'
                            : 'Bookings'}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray">
                            {invoice.jobs.length} job
                            {invoice.jobs.length !== 1 ? 's' : ''}
                          </Text>
                          <Flex gap="1" wrap="wrap">
                            {invoice.jobs.map((job) => (
                              <Button
                                key={job.id}
                                size="1"
                                variant="soft"
                                color="gray"
                                onClick={() => onSelectJob(job.id)}
                              >
                                {formatJobLabel(job)}
                              </Button>
                            ))}
                          </Flex>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: 'monospace' }}>
                          {displayContaId ?? '—'}
                        </Text>
                      </Table.Cell>
                      <Table.Cell style={{ textAlign: 'right' }}>
                        {contaUrl ? (
                          <Button size="1" variant="soft" asChild>
                            <a
                              href={contaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <OpenNewWindow width={14} height={14} />
                              Conta
                            </a>
                          </Button>
                        ) : (
                          <Text size="2" color="gray">
                            —
                          </Text>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Box>

      <RecurringInvoiceJobPickerDialog
        open={invoicePickerOpen}
        onOpenChange={setInvoicePickerOpen}
        jobs={detail.jobs}
        invoiceSummary={invoiceSummary}
        onContinue={(ids) => {
          setInvoiceSelectedJobIds(ids)
          setInvoicePreviewOpen(true)
        }}
      />

      <MultiJobInvoiceDialog
        open={invoicePreviewOpen}
        onOpenChange={setInvoicePreviewOpen}
        selectedJobIds={invoiceSelectedJobIds}
        memberJobs={detail.jobs}
      />
    </Flex>
  )
}
