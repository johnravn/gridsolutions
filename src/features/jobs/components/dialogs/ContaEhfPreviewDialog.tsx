import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  ScrollArea,
  Spinner,
  Table,
  Text,
} from '@radix-ui/themes'
import { contaClient } from '@shared/api/conta/client'
import { isContaEhfTransactionSource } from '@shared/api/conta/gatewayUrls'
import { fetchContaEhfPreview } from '../../utils/contaEhfPreview'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string | null | undefined
  transactionId: number | null | undefined
  externalUrl?: string | null
  title?: string | null
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
  }).format(Number(value))
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value.slice(0, 10)
  return d.toLocaleDateString('nb-NO')
}

function field(
  label: string,
  value: React.ReactNode,
): React.ReactElement | null {
  if (value == null || value === '' || value === '—') return null
  return (
    <Flex direction="column" gap="0">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="2">{value}</Text>
    </Flex>
  )
}

export default function ContaEhfPreviewDialog({
  open,
  onOpenChange,
  orgId,
  transactionId,
  externalUrl,
  title,
}: Props) {
  const enabled = open && !!orgId && transactionId != null

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['conta', 'ehf-preview', orgId, transactionId],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      fetchContaEhfPreview({
        orgId: orgId!,
        transactionId: transactionId!,
        get: (path) => contaClient.get(path),
      }),
  })

  const isEhf = isContaEhfTransactionSource(data?.transactionSourceType)
  const heading =
    title?.trim() ||
    data?.description ||
    (data?.transactionNoYear
      ? `Bilag ${data.transactionNoYear}`
      : 'Conta EHF preview')

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="720px"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <Dialog.Title>{heading}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          Received Conta EHF / bookkeeping transaction details.
        </Dialog.Description>

        {!enabled ? (
          <Text size="2" color="gray">
            Missing Conta organization or transaction id.
          </Text>
        ) : isLoading || isFetching ? (
          <Flex align="center" gap="2" py="4">
            <Spinner size="2" />
            <Text size="2">Loading Conta transaction…</Text>
          </Flex>
        ) : error ? (
          <Text size="2" color="red">
            {error instanceof Error
              ? error.message
              : 'Could not load Conta transaction.'}
          </Text>
        ) : data ? (
          <ScrollArea type="auto" scrollbars="vertical" style={{ flex: 1 }}>
            <Flex direction="column" gap="4" pr="2">
              <Flex gap="2" wrap="wrap" align="center">
                {isEhf ? (
                  <Badge color="green" variant="soft">
                    EHF
                  </Badge>
                ) : (
                  <Badge color="gray" variant="soft">
                    {data.transactionSourceType || 'Transaction'}
                  </Badge>
                )}
                {data.transactionNoYear ? (
                  <Badge variant="outline">
                    Bilag {data.transactionNoYear}
                  </Badge>
                ) : null}
                {data.paymentType ? (
                  <Badge variant="soft">{data.paymentType}</Badge>
                ) : null}
              </Flex>

              <Box
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                {field('Date', formatDate(data.date))}
                {field('Created', formatDate(data.createdAt))}
                {field('Description', data.description)}
                {field('Transaction id', data.transactionId)}
                {field('EHF received id', data.ehfReceivedId)}
                {field('Invoice id', data.invoiceId)}
                {field('Source type', data.transactionSourceType)}
                {field('Attachments', data.attachments.length || null)}
              </Box>

              <Box>
                <Heading size="3" mb="2">
                  Lines ({data.lines.length})
                </Heading>
                {data.lines.length === 0 ? (
                  <Text size="2" color="gray">
                    No transaction lines returned.
                  </Text>
                ) : (
                  <Table.Root variant="surface" size="1">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>
                          Description
                        </Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Account</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>VAT</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Invoice</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell align="right">
                          Amount
                        </Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {data.lines.map((line, index) => {
                        const account =
                          line.bookkeepingAccountNo ||
                          [
                            line.debitBookkeepingAccountNo
                              ? `D ${line.debitBookkeepingAccountNo}`
                              : null,
                            line.creditBookkeepingAccountNo
                              ? `C ${line.creditBookkeepingAccountNo}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' / ') ||
                          '—'
                        return (
                          <Table.Row key={`${line.kind}-${line.id ?? index}`}>
                            <Table.Cell>{formatDate(line.date)}</Table.Cell>
                            <Table.Cell>
                              <Flex direction="column" gap="0">
                                <Text size="2">{line.description || '—'}</Text>
                                {line.kind === 'advanced' ? (
                                  <Text size="1" color="gray">
                                    Advanced line
                                  </Text>
                                ) : null}
                              </Flex>
                            </Table.Cell>
                            <Table.Cell>{account}</Table.Cell>
                            <Table.Cell>{line.vatCode || '—'}</Table.Cell>
                            <Table.Cell>{line.invoiceNo || '—'}</Table.Cell>
                            <Table.Cell align="right">
                              {formatAmount(line.amount)}
                            </Table.Cell>
                          </Table.Row>
                        )
                      })}
                    </Table.Body>
                  </Table.Root>
                )}
              </Box>
            </Flex>
          </ScrollArea>
        ) : null}

        <Flex gap="2" mt="4" justify="end" wrap="wrap">
          {externalUrl ? (
            <Button asChild variant="soft">
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                Open in Conta
              </a>
            </Button>
          ) : null}
          <Dialog.Close>
            <Button variant="solid">Close</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
