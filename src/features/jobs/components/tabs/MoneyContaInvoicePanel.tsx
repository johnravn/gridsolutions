import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Refresh } from 'iconoir-react'
import { contaClient } from '@shared/api/conta/client'
import { fetchContaInvoice } from '@shared/conta/invoicePaidSyncCore'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { MobileHScroll } from '@shared/ui/components/MobileHScroll'
import {
  buildContaInvoiceDisplay,
  formatContaInvoiceMoney,
} from '../../utils/contaInvoiceDisplay'

export type MoneyContaInvoiceRecord = {
  id: string
  status: string
  created_at: string
  invoice_data: unknown
  conta_response: unknown
  conta_invoice_id: string | null
  organization_id: string | null
}

function HeaderField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!value) return null
  return (
    <Flex direction="column" gap="0" style={{ minWidth: 0 }}>
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="2" style={{ wordBreak: 'break-word' }}>
        {value}
      </Text>
    </Flex>
  )
}

export default function MoneyContaInvoicePanel({
  jobId,
  organizationId,
  invoices,
}: {
  jobId: string
  organizationId: string | null
  invoices: Array<MoneyContaInvoiceRecord>
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [fetchedById, setFetchedById] = React.useState<Record<string, unknown>>(
    {},
  )

  const selected =
    invoices.find((inv) => inv.id === selectedId) ?? invoices[0] ?? null

  React.useEffect(() => {
    if (!selected && invoices[0]) setSelectedId(invoices[0].id)
    if (selected && !invoices.some((inv) => inv.id === selected.id)) {
      setSelectedId(invoices[0]?.id ?? null)
    }
  }, [invoices, selected])

  const display = React.useMemo(() => {
    if (!selected) return null
    return buildContaInvoiceDisplay({
      invoice_data: selected.invoice_data,
      conta_response: selected.conta_response,
      fetched: fetchedById[selected.id],
      conta_invoice_id: selected.conta_invoice_id,
      status: selected.status,
    })
  }, [selected, fetchedById])

  const fetchMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No invoice selected')
      const orgId = selected.organization_id ?? organizationId ?? null
      if (!orgId) {
        throw new Error('Conta organization is not configured for this company')
      }
      if (!selected.conta_invoice_id && !selected.conta_response) {
        throw new Error(
          'This invoice has no Conta id yet — send it from the Invoice tab first',
        )
      }
      const fetched = await fetchContaInvoice(contaClient, orgId, {
        id: selected.id,
        job_id: jobId,
        organization_id: orgId,
        conta_invoice_id: selected.conta_invoice_id,
        status: selected.status,
        conta_response:
          selected.conta_response && typeof selected.conta_response === 'object'
            ? (selected.conta_response as Record<string, unknown>)
            : null,
      })
      if (!fetched) {
        throw new Error('Conta invoice not found')
      }

      const nextInvoiceId =
        selected.conta_invoice_id ||
        (fetched.invoiceNo != null ? String(fetched.invoiceNo) : null) ||
        (fetched.id != null ? String(fetched.id) : null)

      const { error } = await supabase
        .from('job_invoices')
        .update({
          conta_response: fetched as never,
          ...(nextInvoiceId ? { conta_invoice_id: nextInvoiceId } : {}),
        })
        .eq('id', selected.id)
      if (error) throw error

      return { invoiceId: selected.id, fetched }
    },
    onSuccess: ({ invoiceId, fetched }) => {
      setFetchedById((prev) => ({ ...prev, [invoiceId]: fetched }))
      void qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'money', 'sales-invoices'],
      })
      success('Conta invoice loaded', 'Lines and header refreshed from Conta.')
    },
    onError: (e: unknown) => {
      toastError(
        'Could not fetch Conta invoice',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const canFetch =
    !!organizationId || invoices.some((inv) => !!inv.organization_id)

  return (
    <Card style={{ background: 'var(--gray-a2)' }}>
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box style={{ minWidth: 0 }}>
            <Heading size="3" mb="1">
              Conta invoice
            </Heading>
            <Text size="2" color="gray">
              Sent Conta invoice lines and header — compare with Accounting
              ledger.
            </Text>
          </Box>
          <Button
            size="2"
            variant="solid"
            disabled={
              !selected || !canFetch || fetchMutation.isPending || !display
            }
            onClick={() => fetchMutation.mutate()}
          >
            <Flex align="center" gap="2">
              <Refresh width={16} height={16} />
              {fetchMutation.isPending ? 'Fetching…' : 'Fetch Conta invoice'}
            </Flex>
          </Button>
        </Flex>

        {invoices.length === 0 ? (
          <Text size="2" color="gray">
            No sent Conta invoices on this job yet. Create one from the Invoice
            tab, then fetch here to inspect the lines Conta recorded.
          </Text>
        ) : (
          <>
            {invoices.length > 1 && (
              <Flex gap="2" wrap="wrap">
                {invoices.map((inv) => {
                  const active = (selected?.id ?? invoices[0]?.id) === inv.id
                  return (
                    <Button
                      key={inv.id}
                      size="1"
                      variant={active ? 'solid' : 'soft'}
                      onClick={() => setSelectedId(inv.id)}
                    >
                      {inv.conta_invoice_id
                        ? `#${inv.conta_invoice_id}`
                        : new Date(inv.created_at).toLocaleDateString('nb-NO')}
                    </Button>
                  )
                })}
              </Flex>
            )}

            {display && (
              <>
                <Flex gap="2" wrap="wrap" align="center">
                  {display.header.invoiceNo && (
                    <Badge size="1" variant="soft" color="blue">
                      Invoice #{display.header.invoiceNo}
                    </Badge>
                  )}
                  {display.header.status && (
                    <Badge size="1" variant="soft" color="gray">
                      {display.header.status}
                    </Badge>
                  )}
                  {selected?.status && (
                    <Badge size="1" variant="outline" color="gray">
                      Grid: {selected.status}
                    </Badge>
                  )}
                </Flex>

                <Flex gap="3" wrap="wrap">
                  <HeaderField
                    label="Org / sender ref"
                    value={display.header.orgReference}
                  />
                  <HeaderField
                    label="Customer ref"
                    value={display.header.customerReference}
                  />
                  <HeaderField
                    label="Title / message"
                    value={display.header.personalMessage}
                  />
                  <HeaderField
                    label="Invoice date"
                    value={display.header.invoiceDate}
                  />
                  <HeaderField
                    label="Due date"
                    value={display.header.invoiceDueDate}
                  />
                  <HeaderField
                    label="EHF order ref"
                    value={display.header.ehfOrderReference}
                  />
                  <HeaderField label="KID" value={display.header.kid} />
                  <HeaderField
                    label="Currency"
                    value={display.header.currency}
                  />
                  <HeaderField
                    label="Project id"
                    value={display.header.projectId}
                  />
                  <HeaderField
                    label="Customer id"
                    value={display.header.customerId}
                  />
                </Flex>

                <Flex gap="4" wrap="wrap">
                  <Text size="2">
                    Net:{' '}
                    <Text weight="medium">
                      {formatContaInvoiceMoney(display.header.sumNet)}
                    </Text>
                  </Text>
                  <Text size="2">
                    VAT:{' '}
                    <Text weight="medium">
                      {formatContaInvoiceMoney(display.header.sumVat)}
                    </Text>
                  </Text>
                  <Text size="2">
                    Total:{' '}
                    <Text weight="medium">
                      {formatContaInvoiceMoney(display.header.sumTotal)}
                    </Text>
                  </Text>
                </Flex>

                {display.lines.length === 0 ? (
                  <Text size="2" color="gray">
                    No invoice lines in stored data. Fetch from Conta to load
                    the lines that were sent.
                  </Text>
                ) : (
                  <MobileHScroll>
                    <Table.Root size="1" variant="surface">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>#</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Description
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell justify="end">
                            Qty
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell justify="end">
                            Price
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell justify="end">
                            Disc %
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>VAT</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell justify="end">
                            Net
                          </Table.ColumnHeaderCell>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {display.lines.map((line, index) => (
                          <Table.Row
                            key={`${line.lineNo ?? index}-${line.description}`}
                          >
                            <Table.Cell>{line.lineNo ?? index + 1}</Table.Cell>
                            <Table.Cell>
                              <Text size="2">{line.description}</Text>
                            </Table.Cell>
                            <Table.Cell justify="end">
                              {line.quantity}
                            </Table.Cell>
                            <Table.Cell justify="end">
                              {formatContaInvoiceMoney(line.price)}
                            </Table.Cell>
                            <Table.Cell justify="end">
                              {line.discount}
                            </Table.Cell>
                            <Table.Cell>{line.vatCode ?? '—'}</Table.Cell>
                            <Table.Cell justify="end">
                              {formatContaInvoiceMoney(line.sumNet)}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </MobileHScroll>
                )}
              </>
            )}
          </>
        )}
      </Flex>
    </Card>
  )
}
