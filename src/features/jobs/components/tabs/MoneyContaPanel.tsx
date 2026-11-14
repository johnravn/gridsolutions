import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Text,
} from '@radix-ui/themes'
import { InfoCircle } from 'iconoir-react'
import {
  CONTA_CONFIDENCE_COLOR,
  CONTA_CONFIDENCE_LABEL,
  CONTA_DATE_PAD_OPTIONS,
  contaLinkStatusMessage,
} from '../../utils/moneyConta'
import type {
  ContaDatePadOption,
  ContaLinkStatus,
  ContaMatchConfidence,
} from '../../utils/moneyConta'

export default function MoneyContaPanel({
  status,
  datePad,
  onDatePadChange,
  onSync,
  isSyncing,
  projectId,
  expenseCount,
  incomeCount,
  lastError,
}: {
  status: ContaLinkStatus
  datePad: ContaDatePadOption
  onDatePadChange: (next: ContaDatePadOption) => void
  onSync: () => void
  isSyncing: boolean
  projectId: number | null
  expenseCount: number
  incomeCount: number
  lastError?: string | null
}) {
  if (status === 'not_configured') {
    return (
      <Card mb="4" style={{ background: 'var(--blue-a2)' }}>
        <Flex gap="3" align="start">
          <Box style={{ paddingTop: '2px' }}>
            <InfoCircle width={20} height={20} color="var(--blue-9)" />
          </Box>
          <Box style={{ flex: 1 }}>
            <Heading size="3" mb="1">
              Conta not connected
            </Heading>
            <Text size="2" color="gray">
              {contaLinkStatusMessage(status)} Sales invoice income will fall
              back to accepted offers (ex MVA). Supplier cost suggestions stay
              unavailable until Conta is linked in Company settings.
            </Text>
          </Box>
        </Flex>
      </Card>
    )
  }

  const statusColor =
    status === 'configured_with_project'
      ? 'green'
      : status === 'configured_jobnr_only'
        ? 'amber'
        : 'orange'

  return (
    <Card mb="4">
      <Flex direction="column" gap="3">
        <Flex justify="between" align="start" gap="3" wrap="wrap">
          <Box>
            <Flex align="center" gap="2" mb="1" wrap="wrap">
              <Heading size="3">Conta</Heading>
              <Badge color={statusColor} variant="soft" size="1">
                {status === 'configured_with_project'
                  ? 'Project linked'
                  : status === 'configured_jobnr_only'
                    ? 'Job # match'
                    : 'No match key'}
              </Badge>
              {projectId != null && (
                <Badge color="gray" variant="outline" size="1">
                  Project {projectId}
                </Badge>
              )}
            </Flex>
            <Text size="2" color="gray">
              {contaLinkStatusMessage(status)}
            </Text>
          </Box>
          <Button
            size="2"
            variant="soft"
            onClick={onSync}
            disabled={isSyncing || status === 'configured_no_project'}
          >
            {isSyncing ? 'Syncing…' : 'Sync Conta costs'}
          </Button>
        </Flex>

        <Box>
          <Text size="2" weight="medium" mb="1" as="div">
            Cost date window
          </Text>
          <SegmentedControl.Root
            value={datePad}
            onValueChange={(v) => onDatePadChange(v as ContaDatePadOption)}
            size="1"
          >
            {CONTA_DATE_PAD_OPTIONS.map((opt) => (
              <SegmentedControl.Item key={opt.value} value={opt.value}>
                {opt.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <Text size="1" color="gray" mt="1" as="div">
            {CONTA_DATE_PAD_OPTIONS.find((o) => o.value === datePad)?.hint}.
            Widen if supplier invoices were booked outside the job window.
          </Text>
        </Box>

        <Flex gap="3" wrap="wrap">
          <Text size="2" color="gray">
            Sales invoice suggestions:{' '}
            <Text weight="medium">{incomeCount}</Text>
          </Text>
          <Text size="2" color="gray">
            Supplier cost suggestions:{' '}
            <Text weight="medium">{expenseCount}</Text>
          </Text>
        </Flex>

        <Flex gap="2" wrap="wrap" align="center">
          <Text size="1" color="gray">
            Confidence:
          </Text>
          {(['high', 'medium', 'low'] as Array<ContaMatchConfidence>).map(
            (c) => (
              <Badge
                key={c}
                size="1"
                variant="soft"
                color={CONTA_CONFIDENCE_COLOR[c]}
              >
                {CONTA_CONFIDENCE_LABEL[c]}
              </Badge>
            ),
          )}
          <Text size="1" color="gray">
            Review Conta amounts before confirm — ledger lines may be incl. MVA.
          </Text>
        </Flex>

        {lastError && (
          <Text size="2" color="red">
            Conta sync error: {lastError}
          </Text>
        )}

        {status === 'configured_no_project' && (
          <Text size="2" color="orange">
            Assign a job number or create a Conta sales invoice so costs can be
            matched.
          </Text>
        )}

        {status !== 'configured_no_project' &&
          expenseCount === 0 &&
          !isSyncing && (
            <Text size="2" color="gray">
              No supplier ledger lines in this window. Try widening the date
              range, or confirm the Conta project / job number tagging.
            </Text>
          )}

        {incomeCount === 0 && (
          <Text size="2" color="gray">
            No Conta sales invoice on this job yet — income suggestions will use
            the accepted offer (ex MVA) when available. Create/send a Conta
            invoice from the Invoice tab to prefer Conta net income.
          </Text>
        )}
      </Flex>
    </Card>
  )
}
