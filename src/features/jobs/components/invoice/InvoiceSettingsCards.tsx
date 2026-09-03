// src/features/jobs/components/invoice/InvoiceSettingsCards.tsx
import * as React from 'react'
import { Box, Card, Flex, Switch, Text } from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import InvoiceDescriptionTemplateEditor from './InvoiceDescriptionTemplateEditor'
import type { BookingInvoiceLine } from '../../api/invoiceQueries'

type SettingsCardId = 'description' | 'offerLines'

type Props = {
  /** Which card is currently expanded (null = all collapsed). */
  expandedCard: SettingsCardId | null
  onExpandedCardChange: (card: SettingsCardId | null) => void

  companyId: string | null
  lines: Array<BookingInvoiceLine>
  manualOverrides: Set<string>
  onApplyDescriptionTemplate: (lines: Array<BookingInvoiceLine>) => void
  onHighlightChange?: (lineIds: ReadonlySet<string>) => void

  /** When false, the offer-lines card stays visible but cannot be opened. */
  offerLinesEnabled: boolean
  expandOfferLines: boolean
  onExpandOfferLinesChange: (value: boolean) => void
}

export default function InvoiceSettingsCards({
  expandedCard,
  onExpandedCardChange,
  companyId,
  lines,
  manualOverrides,
  onApplyDescriptionTemplate,
  onHighlightChange,
  offerLinesEnabled,
  expandOfferLines,
  onExpandOfferLinesChange,
}: Props) {
  const toggle = (id: SettingsCardId) => {
    if (id === 'offerLines' && !offerLinesEnabled) return
    onExpandedCardChange(expandedCard === id ? null : id)
  }

  const offerLinesExpanded = offerLinesEnabled && expandedCard === 'offerLines'

  return (
    <Flex direction="column" gap="2" mb="3">
      <SettingsCard
        title="Offer line items"
        expanded={offerLinesExpanded}
        disabled={!offerLinesEnabled}
        disabledHint="Only when invoicing from a technical offer"
        onToggle={() => toggle('offerLines')}
      >
        <Flex align="center" justify="between" gap="3" py="1">
          <Text size="2">
            Show individual equipment, crew, and transport lines from the offer
            instead of a single summary line.
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
      </SettingsCard>

      {companyId && (
        <SettingsCard
          title="Line description pattern"
          expanded={expandedCard === 'description'}
          onToggle={() => toggle('description')}
        >
          <InvoiceDescriptionTemplateEditor
            embedded
            companyId={companyId}
            lines={lines}
            manualOverrides={manualOverrides}
            onApply={onApplyDescriptionTemplate}
            onHighlightChange={onHighlightChange}
          />
        </SettingsCard>
      )}
    </Flex>
  )
}

function SettingsCard({
  title,
  expanded,
  onToggle,
  children,
  disabled = false,
  disabledHint,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  disabled?: boolean
  disabledHint?: string
}) {
  return (
    <Card
      size="1"
      style={{
        padding: 0,
        overflow: 'hidden',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Box
        onClick={disabled ? undefined : onToggle}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 'var(--space-2) var(--space-3)',
          userSelect: 'none',
        }}
      >
        <Flex align="center" gap="2" justify="between">
          <Flex align="center" gap="2">
            {expanded ? (
              <NavArrowDown width={14} height={14} />
            ) : (
              <NavArrowRight width={14} height={14} />
            )}
            <Text size="2" weight="medium">
              {title}
            </Text>
          </Flex>
          {disabled && disabledHint ? (
            <Text size="1" color="gray">
              {disabledHint}
            </Text>
          ) : null}
        </Flex>
      </Box>
      {expanded && (
        <Box px="3" pb="3" style={{ borderTop: '1px solid var(--gray-a5)' }}>
          {children}
        </Box>
      )}
    </Card>
  )
}
