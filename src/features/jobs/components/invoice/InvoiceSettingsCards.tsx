// src/features/jobs/components/invoice/InvoiceSettingsCards.tsx
import { Box, Card, Flex, Switch, Text } from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import InvoiceDescriptionTemplateEditor from './InvoiceDescriptionTemplateEditor'
import type { BookingInvoiceLine } from '../../api/invoiceQueries'

type Props = {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void

  companyId: string | null
  lines: Array<BookingInvoiceLine>
  manualOverrides: Set<string>
  onApplyDescriptionTemplate: (lines: Array<BookingInvoiceLine>) => void
  onHighlightChange?: (lineIds: ReadonlySet<string>) => void

  /** When false, the offer-lines switch stays visible but cannot be turned on. */
  offerLinesEnabled: boolean
  expandOfferLines: boolean
  onExpandOfferLinesChange: (value: boolean) => void
}

export default function InvoiceSettingsCards({
  expanded,
  onExpandedChange,
  companyId,
  lines,
  manualOverrides,
  onApplyDescriptionTemplate,
  onHighlightChange,
  offerLinesEnabled,
  expandOfferLines,
  onExpandOfferLinesChange,
}: Props) {
  return (
    <Card
      size="1"
      mb="3"
      style={{
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => onExpandedChange(!expanded)}
        style={{
          cursor: 'pointer',
          padding: 'var(--space-2) var(--space-3)',
          userSelect: 'none',
        }}
      >
        <Flex align="center" gap="2">
          {expanded ? (
            <NavArrowDown width={14} height={14} />
          ) : (
            <NavArrowRight width={14} height={14} />
          )}
          <Text size="2" weight="medium">
            Settings
          </Text>
        </Flex>
      </Box>
      {expanded && (
        <Box px="3" pb="3" style={{ borderTop: '1px solid var(--gray-a5)' }}>
          <div className="invoice-settings-modules">
            <Box
              style={{
                opacity: offerLinesEnabled ? 1 : 0.55,
              }}
            >
              <Text size="2" weight="medium" as="p" mb="2">
                Offer line items
              </Text>
              <Flex align="center" justify="between" gap="3">
                <Text size="2">
                  Show individual equipment, crew, and transport lines from the
                  offer instead of a single summary line.
                </Text>
                <Switch
                  size="2"
                  checked={expandOfferLines}
                  disabled={!offerLinesEnabled}
                  onCheckedChange={(checked) =>
                    onExpandOfferLinesChange(checked === true)
                  }
                />
              </Flex>
              {!offerLinesEnabled ? (
                <Text size="1" color="gray" as="p" mt="2">
                  Only when invoicing from a technical offer
                </Text>
              ) : null}
            </Box>

            {companyId && (
              <Box>
                <Text size="2" weight="medium" as="p" mb="2">
                  Line description pattern
                </Text>
                <InvoiceDescriptionTemplateEditor
                  embedded
                  companyId={companyId}
                  lines={lines}
                  manualOverrides={manualOverrides}
                  onApply={onApplyDescriptionTemplate}
                  onHighlightChange={onHighlightChange}
                />
              </Box>
            )}
          </div>
        </Box>
      )}
    </Card>
  )
}
