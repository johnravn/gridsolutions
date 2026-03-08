// src/features/jobs/components/invoice/InvoicePreview.tsx
import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Separator,
  Switch,
  Table,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { SearchableSelect } from '@shared/ui/components/SearchableSelect'
import { Plus, Trash } from 'iconoir-react'
import type { JobDetail, JobOffer } from '../../types'
import type {
  BookingsForInvoice,
  BookingInvoiceLine,
} from '../../api/invoiceQueries'

function parseAddress(addr: string | null): { line1: string; line2: string } {
  if (!addr || !addr.trim()) return { line1: '', line2: '' }
  const parts = addr
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const line1 = parts[0] || ''
  const rest = parts.slice(1).join(', ')
  return { line1, line2: rest }
}

function formatDdMmYyyy(date: Date): string {
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  return `${d}.${m}.${y}`
}

type InvoicePreviewProps =
  | {
      basis: 'offer'
      offer: JobOffer
      customerName: string
      daysUntilDue?: number
    }
  | {
      basis: 'bookings'
      bookings: BookingsForInvoice
      daysUntilDue?: number
      customerName: string
      customerAddress: string | null
      companyName: string
      companyAddress: string | null
      job: Pick<
        JobDetail,
        'title' | 'jobnr' | 'start_at' | 'end_at' | 'project_lead' | 'customer_contact'
      >
      employees: Array<{ user_id: string; display_name: string | null }>
      contacts: Array<{ id: string; name: string }>
      vatIncluded: boolean
      onVatIncludedChange: (value: boolean) => void
      message: string
      onMessageChange: (value: string) => void
      ourRef: string
      onOurRefChange: (value: string) => void
      theirRef: string
      onTheirRefChange: (value: string) => void
      lineDiscountOverrides?: Record<string, number>
      onLineDiscountChange?: (lineId: string, discountPercent: number) => void
      editedLines?: Array<BookingInvoiceLine>
      onLineChange?: (
        lineId: string,
        updates: {
          description?: string
          unitPrice?: number
          quantity?: number
        },
      ) => void
      onAddLine?: () => void
      onRemoveLine?: (lineId: string) => void
      /** Element (or getter) inside the dialog to portal ref dropdowns into. Required for dropdown to work inside Dialog. */
      refFieldPortalContainer?: HTMLElement | null | (() => HTMLElement | null)
    }

export default function InvoicePreview(props: InvoicePreviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const invoiceDate = new Date()
  const daysUntilDue = props.daysUntilDue ?? 14
  const dueDate = new Date(
    Date.now() + daysUntilDue * 24 * 60 * 60 * 1000,
  )
  const deliveryDateStr = formatDdMmYyyy(invoiceDate)
  const invoiceDateStr = formatDdMmYyyy(invoiceDate)
  const dueDateStr = formatDdMmYyyy(dueDate)

  if (props.basis === 'offer') {
    const { offer, customerName } = props
    const subtotal = offer.total_after_discount
    const vatAmount = (subtotal * offer.vat_percent) / 100
    const total = subtotal + vatAmount
    const formatDate = (d: Date) =>
      d.toLocaleDateString('nb-NO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })

    return (
      <Card>
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
                <Table.Cell style={{ textAlign: 'right' }}>1</Table.Cell>
                <Table.Cell style={{ textAlign: 'right' }}>
                  {formatCurrency(offer.total_after_discount)}
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

  // Bookings basis – invoice-like layout
  const {
    bookings,
    customerName,
    customerAddress,
    companyName,
    companyAddress,
    job,
    employees,
    contacts,
    vatIncluded,
    onVatIncludedChange,
    message,
    onMessageChange,
    ourRef,
    onOurRefChange,
    theirRef,
    onTheirRefChange,
    lineDiscountOverrides = {},
    onLineDiscountChange,
    editedLines,
    onLineChange,
    onAddLine,
    onRemoveLine,
    refFieldPortalContainer,
  } = props

  const displayLines = editedLines ?? bookings.all

  const custAddr = parseAddress(customerAddress)
  const compAddr = parseAddress(companyAddress)

  const numberInputStyle = {
    width: 56,
    minWidth: 56,
    textAlign: 'right' as const,
    paddingLeft: 6,
    paddingRight: 6,
    boxSizing: 'border-box' as const,
    MozAppearance: 'textfield' as const,
    WebkitAppearance: 'none' as any,
  }

  const renderDiscountCell = (line: BookingInvoiceLine) => {
    const discount = lineDiscountOverrides[line.id] ?? 0
    if (onLineDiscountChange) {
      return (
        <Flex align="center" gap="1" justify="end">
          <TextField.Root
            type="number"
            size="1"
            min={0}
            max={100}
            value={String(discount)}
            style={{
              ...numberInputStyle,
              width: 48,
              minWidth: 48,
            }}
            onChange={(e) => {
            const raw = e.target.value
            if (raw === '' || raw === '-') {
              onLineDiscountChange(line.id, 0)
              return
            }
            const v = parseFloat(raw)
            if (!isNaN(v) && v >= 0 && v <= 100) {
              onLineDiscountChange(line.id, v)
            }
          }}
          onBlur={(e) => {
            const v = parseFloat((e.target as HTMLInputElement).value)
            if (isNaN(v) || v < 0) onLineDiscountChange(line.id, 0)
            else if (v > 100) onLineDiscountChange(line.id, 100)
          }}
        />
          <Text size="2" color="gray">%</Text>
        </Flex>
      )
    }
    return <Text color="gray">{discount}%</Text>
  }

  const getLineTotalPrice = (line: BookingInvoiceLine) => {
    const discount = lineDiscountOverrides[line.id] ?? 0
    return line.totalPrice * (1 - discount / 100)
  }

  const { subtotal, vatAmount, total } = React.useMemo(() => {
    let exVat = 0
    for (const line of displayLines) {
      exVat += getLineTotalPrice(line)
    }
    const vat = vatIncluded
      ? displayLines.reduce(
          (sum, line) =>
            sum + (getLineTotalPrice(line) * line.vatPercent) / 100,
          0,
        )
      : 0
    return {
      subtotal: exVat,
      vatAmount: vat,
      total: exVat + vat,
    }
  }, [displayLines, lineDiscountOverrides, vatIncluded])

  return (
    <Card>
      <Flex direction="column" gap="4">
        {/* Top: Customer (left) | Company (right) */}
        <Flex justify="between" gap="6" wrap="wrap">
          <Flex direction="column" gap="1">
            <Text size="3" weight="bold">
              {customerName}
            </Text>
            {custAddr.line1 && (
              <Text size="2" color="gray">
                {custAddr.line1}
              </Text>
            )}
            {custAddr.line2 && (
              <Text size="2" color="gray">
                {custAddr.line2}
              </Text>
            )}
          </Flex>
          <Flex direction="column" gap="1" style={{ textAlign: 'right' }}>
            <Text size="3" weight="bold">
              {companyName}
            </Text>
            {compAddr.line1 && (
              <Text size="2" color="gray">
                {compAddr.line1}
              </Text>
            )}
            {compAddr.line2 && (
              <Text size="2" color="gray">
                {compAddr.line2}
              </Text>
            )}
          </Flex>
        </Flex>

        {/* VAT toggle */}
        <Flex align="center" gap="2">
          <Text size="2" color="gray">
            Invoice with VAT:
          </Text>
          <Switch
            checked={vatIncluded}
            onCheckedChange={(c) => onVatIncludedChange(c === true)}
          />
          <Text size="2">{vatIncluded ? 'Yes' : 'No'}</Text>
        </Flex>

        {/* our ref | their ref - SearchableSelect (search + suggestions) */}
        <Flex
          direction="column"
          gap="2"
          style={{ width: 'fit-content', minWidth: 220 }}
        >
          <Flex direction="column" gap="1">
            <Text size="2" color="gray">
              Our ref:
            </Text>
            <SearchableSelect
              options={employees.map((e) => ({
                value: e.user_id,
                label: e.display_name ?? e.user_id,
              }))}
              value={
                employees.find(
                  (e) => (e.display_name ?? e.user_id) === ourRef,
                )?.user_id ?? ''
              }
              onValueChange={(v) => {
                const opt = employees.find((e) => e.user_id === v)
                onOurRefChange(opt ? (opt.display_name ?? opt.user_id) : '')
              }}
              placeholder="Search project lead or employee…"
              emptyMessage="No employees found"
              dropdownMaxWidth={280}
              style={{ minWidth: 220 }}
              portalContainer={refFieldPortalContainer}
            />
          </Flex>
          <Flex direction="column" gap="1">
            <Text size="2" color="gray">
              Their ref:
            </Text>
            <SearchableSelect
              options={contacts.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              value={
                contacts.find((c) => c.name === theirRef)?.id ?? ''
              }
              onValueChange={(v) => {
                const opt = contacts.find((c) => c.id === v)
                onTheirRefChange(opt ? opt.name : '')
              }}
              placeholder="Search contact…"
              emptyMessage="No contacts found"
              dropdownMaxWidth={280}
              style={{ minWidth: 220 }}
              portalContainer={refFieldPortalContainer}
            />
          </Flex>
        </Flex>

        {/* Delivery date */}
        <Flex align="center" gap="2">
          <Text size="2" color="gray">
            Delivery date:
          </Text>
          <Text size="2">{deliveryDateStr}</Text>
        </Flex>

        {/* Delivered to */}
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">
            Delivered to:
          </Text>
          <Text size="2">
            {custAddr.line1 || custAddr.line2
              ? [custAddr.line1, custAddr.line2].filter(Boolean).join(', ')
              : '—'}
          </Text>
        </Flex>

        {/* Invoice date, due date, number */}
        <Flex gap="6" wrap="wrap">
          <Flex align="center" gap="2">
            <Text size="2" color="gray">
              Invoice date:
            </Text>
            <Text size="2">{invoiceDateStr}</Text>
          </Flex>
          <Flex align="center" gap="2">
            <Text size="2" color="gray">
              Due date:
            </Text>
            <Text size="2">{dueDateStr}</Text>
          </Flex>
          <Flex align="center" gap="2">
            <Text size="2" color="gray">
              Invoice no:
            </Text>
            <Text size="2" color="gray">
              —
            </Text>
          </Flex>
        </Flex>

        <Separator />

        {/* Message to receiver */}
        <Box>
          <Text size="2" color="gray" as="div" mb="1">
            Message
          </Text>
          <TextField.Root
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Job name, dates, reference..."
            size="2"
            style={{ width: '100%' }}
          />
        </Box>

        <Separator />

        {/* Line items - Conta-style: description, price, qty, discount, vat, total */}
        <Box style={{ overflowX: 'auto' }}>
          {onAddLine && (
            <Flex justify="end" mb="2">
              <Button size="2" variant="soft" onClick={onAddLine}>
                <Plus width={14} height={14} />
                Add line
              </Button>
            </Flex>
          )}
          <Table.Root style={{ width: '100%', minWidth: 640 }} data-invoice-lines>
            <Table.Header>
              <Table.Row>
                {onRemoveLine && (
                  <Table.ColumnHeaderCell style={{ width: 40 }} />
                )}
                <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Price
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Qty
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Discount
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  VAT
                </Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                  Total
                </Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {displayLines.length === 0 && onAddLine ? (
                <Table.Row>
                  <Table.Cell colSpan={onRemoveLine ? 7 : 6}>
                    <Text size="2" color="gray" style={{ fontStyle: 'italic' }}>
                      No lines. Click Add line to add invoice lines.
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ) : null}
              {displayLines.map((line) => {
                const discountedPrice = getLineTotalPrice(line)
                const lineVat = vatIncluded
                  ? (discountedPrice * line.vatPercent) / 100
                  : 0
                const lineTotal = discountedPrice + lineVat
                return (
                  <Table.Row key={line.id}>
                    {onRemoveLine && (
                      <Table.Cell style={{ width: 40, paddingLeft: 12, verticalAlign: 'top' }}>
                        <IconButton
                          size="1"
                          variant="ghost"
                          color="red"
                          onClick={() => onRemoveLine(line.id)}
                          title="Remove line"
                        >
                          <Trash width={14} height={14} />
                        </IconButton>
                      </Table.Cell>
                    )}
                    <Table.Cell style={{ minWidth: 200, maxWidth: 400 }}>
                      {onLineChange ? (
                        <TextArea
                          size="1"
                          value={line.description}
                          onChange={(e) =>
                            onLineChange(line.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Description"
                          style={{
                            width: '100%',
                            height: 28,
                            minHeight: 28,
                            resize: 'vertical',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                          }}
                          rows={1}
                        />
                      ) : (
                        <Text as="div" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {line.description}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right', width: 80 }}>
                      {onLineChange ? (
                        <TextField.Root
                          type="number"
                          size="1"
                          value={String(line.unitPrice)}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v >= 0) {
                              onLineChange(line.id, {
                                unitPrice: v,
                                quantity: line.quantity,
                              })
                            }
                          }}
                          style={numberInputStyle}
                        />
                      ) : (
                        <Text>{formatCurrency(line.unitPrice)}</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right', width: 64 }}>
                      {onLineChange ? (
                        <TextField.Root
                          type="number"
                          size="1"
                          min={0.01}
                          value={String(line.quantity)}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            if (!isNaN(v) && v > 0) {
                              onLineChange(line.id, {
                                unitPrice: line.unitPrice,
                                quantity: v,
                              })
                            }
                          }}
                          style={numberInputStyle}
                        />
                      ) : (
                        <Text>{line.quantity}</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right' }}>
                      {renderDiscountCell(line)}
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right' }}>
                      <Text>
                        {vatIncluded ? `${line.vatPercent}%` : '0%'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell style={{ textAlign: 'right' }}>
                      <Text weight="medium">
                        {formatCurrency(lineTotal)}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table.Root>
        </Box>

        <Separator />

        <Flex direction="column" gap="2" style={{ alignItems: 'flex-end' }}>
          <Flex justify="between" style={{ width: '100%', maxWidth: '300px' }}>
            <Text size="2" color="gray">
              Subtotal (ex VAT)
            </Text>
            <Text>{formatCurrency(subtotal)}</Text>
          </Flex>
          <Flex justify="between" style={{ width: '100%', maxWidth: '300px' }}>
            <Text size="2" color="gray">
              VAT ({vatIncluded ? '25%' : '0%'})
            </Text>
            <Text>{formatCurrency(vatAmount)}</Text>
          </Flex>
          <Separator />
          <Flex justify="between" style={{ width: '100%', maxWidth: '300px' }}>
            <Text size="3" weight="bold">
              Total
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
