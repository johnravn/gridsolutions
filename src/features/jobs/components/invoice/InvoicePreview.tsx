// src/features/jobs/components/invoice/InvoicePreview.tsx
import * as React from 'react'
import {
  Badge,
  Box,
  Card,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import type { JobOffer } from '../../types'
import type { BookingsForInvoice } from '../../api/invoiceQueries'

type InvoicePreviewProps =
  | {
      basis: 'offer'
      offer: JobOffer
      customerName: string
    }
  | {
      basis: 'bookings'
      bookings: BookingsForInvoice
      customerName: string
    }

export default function InvoicePreview(props: InvoicePreviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const invoiceDate = new Date().toISOString().split('T')[0]
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  if (props.basis === 'offer') {
    const { offer, customerName } = props
    const subtotal = offer.total_after_discount
    const vatAmount = (subtotal * offer.vat_percent) / 100
    const total = subtotal + vatAmount

    return (
      <Card>
        <Heading size="4" mb="3">
          Invoice Preview
        </Heading>
        <Flex direction="column" gap="3">
          <Box>
            <Text size="2" color="gray" weight="medium">
              Customer
            </Text>
            <Text size="3">{customerName}</Text>
          </Box>
          <Box>
            <Flex gap="4">
              <Box>
                <Text size="2" color="gray" weight="medium">
                  Invoice Date
                </Text>
                <Text size="3">{formatDate(invoiceDate)}</Text>
              </Box>
              <Box>
                <Text size="2" color="gray" weight="medium">
                  Due Date
                </Text>
                <Text size="3">{formatDate(dueDate)}</Text>
              </Box>
            </Flex>
          </Box>
          <Separator />
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Quantity
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Unit Price
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Discount
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Total (ex VAT)
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <Table.Row>
                <Table.Cell>
                  <Text weight="medium">
                    {offer.title ||
                      `Invoice for Offer v${offer.version_number}`}
                  </Text>
                </Table.Cell>
                <Table.Cell style={{ textAlign: 'right' }}>
                  <Text>1</Text>
                </Table.Cell>
                <Table.Cell style={{ textAlign: 'right' }}>
                  <Text>{formatCurrency(offer.total_after_discount)}</Text>
                </Table.Cell>
                <Table.Cell style={{ textAlign: 'right' }}>
                  {offer.discount_percent > 0 ? (
                    <Badge color="orange">{offer.discount_percent}%</Badge>
                  ) : (
                    <Text color="gray">—</Text>
                  )}
                </Table.Cell>
                <Table.Cell style={{ textAlign: 'right' }}>
                  <Text weight="medium">{formatCurrency(subtotal)}</Text>
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
          <Separator />
          <Flex direction="column" gap="2" style={{ alignItems: 'flex-end' }}>
            <Flex
              justify="between"
              style={{ width: '100%', maxWidth: '300px' }}
            >
              <Text size="2" color="gray">
                Subtotal (ex VAT)
              </Text>
              <Text>{formatCurrency(subtotal)}</Text>
            </Flex>
            <Flex
              justify="between"
              style={{ width: '100%', maxWidth: '300px' }}
            >
              <Text size="2" color="gray">
                VAT ({offer.vat_percent}%)
              </Text>
              <Text>{formatCurrency(vatAmount)}</Text>
            </Flex>
            <Separator />
            <Flex
              justify="between"
              style={{ width: '100%', maxWidth: '300px' }}
            >
              <Text size="3" weight="bold">
                Total (incl. VAT)
              </Text>
              <Text size="4" weight="bold">
                {formatCurrency(total)}
              </Text>
            </Flex>
          </Flex>
        </Flex>
      </Card>
    )
  }

  // Bookings basis
  const { bookings, customerName } = props

  return (
    <Card>
      <Heading size="4" mb="3">
        Invoice Preview
      </Heading>
      <Flex direction="column" gap="3">
        <Box>
          <Text size="2" color="gray" weight="medium">
            Customer
          </Text>
          <Text size="3">{customerName}</Text>
        </Box>
        <Box>
          <Flex gap="4">
            <Box>
              <Text size="2" color="gray" weight="medium">
                Invoice Date
              </Text>
              <Text size="3">{formatDate(invoiceDate)}</Text>
            </Box>
            <Box>
              <Text size="2" color="gray" weight="medium">
                Due Date
              </Text>
              <Text size="3">{formatDate(dueDate)}</Text>
            </Box>
          </Flex>
        </Box>
        <Separator />
        <Box style={{ overflowX: 'auto' }}>
          <Table.Root style={{ width: '100%', minWidth: 720 }}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Brand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Quantity
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Unit Price
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Total (ex VAT)
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {bookings.all.map((line) => (
                <Table.Row key={line.id}>
                  <Table.Cell>
                    <Text>{line.brandName || '—'}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{line.model || '—'}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{line.description}</Text>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Text>
                      {line.type === 'crew' || line.type === 'transport'
                        ? `${line.quantity} day${line.quantity !== 1 ? 's' : ''}`
                        : line.quantity}
                    </Text>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Text>{formatCurrency(line.unitPrice)}</Text>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Text weight="medium">
                      {formatCurrency(line.totalPrice)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
        <Separator />
        <Flex direction="column" gap="2" style={{ alignItems: 'flex-end' }}>
          <Flex justify="between" style={{ width: '100%', maxWidth: '300px' }}>
            <Text size="2" color="gray">
              Subtotal (ex VAT)
            </Text>
            <Text>{formatCurrency(bookings.totalExVat)}</Text>
          </Flex>
          <Flex justify="between" style={{ width: '100%', maxWidth: '300px' }}>
            <Text size="2" color="gray">
              VAT (25%)
            </Text>
            <Text>{formatCurrency(bookings.totalVat)}</Text>
          </Flex>
          <Separator />
          <Flex justify="between" style={{ width: '100%', maxWidth: '300px' }}>
            <Text size="3" weight="bold">
              Total (incl. VAT)
            </Text>
            <Text size="4" weight="bold">
              {formatCurrency(bookings.totalWithVat)}
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Card>
  )
}
