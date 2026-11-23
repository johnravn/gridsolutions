import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  deleteJobMoneyItemsBySourceId,
  updateJobTransportKmDriven,
  upsertJobMoneyItemBySourceId,
} from '../../api/moneyQueries'
import {
  TRANSPORT_KM_SOURCE_ID,
  computeTransportKmExpenseAmount,
  resolveTransportCostPerKm,
  transportKmExpenseDescription,
} from '../../utils/transportKmExpense'

export default function MoneyTransportKmCard({
  jobId,
  companyId,
  kmDriven,
  costPerKm,
  plannedOfferKm,
  expenseDate = null,
  prominent = false,
}: {
  jobId: string
  companyId: string
  kmDriven: number | null
  costPerKm: number
  plannedOfferKm: number | null
  /** Job start date (YYYY-MM-DD or ISO) for the money item date. */
  expenseDate?: string | null
  /** Emphasize for transport-heavy jobs */
  prominent?: boolean
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [draft, setDraft] = React.useState(
    kmDriven != null ? String(kmDriven) : '',
  )
  const [seededFromOffer, setSeededFromOffer] = React.useState(false)

  React.useEffect(() => {
    setDraft(kmDriven != null ? String(kmDriven) : '')
    setSeededFromOffer(false)
  }, [kmDriven])

  const rate = resolveTransportCostPerKm(costPerKm)

  const parsedKm = React.useMemo(() => {
    if (draft.trim() === '') return null
    const n = Number(draft)
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }, [draft])

  const previewCost = computeTransportKmExpenseAmount(parsedKm, rate)

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)

  const saveMutation = useMutation({
    mutationFn: async (next: number | null) => {
      await updateJobTransportKmDriven(jobId, next)

      const amount = computeTransportKmExpenseAmount(next, rate)
      if (amount == null) {
        await deleteJobMoneyItemsBySourceId(jobId, TRANSPORT_KM_SOURCE_ID)
        return 'cleared' as const
      }

      const date =
        expenseDate != null && expenseDate.length >= 10
          ? expenseDate.slice(0, 10)
          : null

      const result = await upsertJobMoneyItemBySourceId({
        jobId,
        companyId,
        sourceId: TRANSPORT_KM_SOURCE_ID,
        type: 'expense',
        description: transportKmExpenseDescription(Number(next), rate),
        amount,
        date,
        reference: `${Number(next)} km`,
        source: 'manual',
        category: 'transport',
      })
      return result
    },
    onSuccess: async (result) => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['jobs', jobId, 'money', 'job-info'],
        }),
        qc.invalidateQueries({ queryKey: ['jobs', jobId, 'money-items'] }),
        qc.invalidateQueries({
          queryKey: ['jobs', jobId, 'money-verification'],
        }),
      ])
      if (result === 'cleared') {
        success('Km cleared', 'Transport expense removed.')
      } else if (result === 'updated') {
        success('Km saved', 'Transport expense updated.')
      } else {
        success('Km saved', 'Transport expense added.')
      }
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to save km',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const dirty =
    (parsedKm == null && kmDriven != null) ||
    (parsedKm != null && kmDriven == null) ||
    (parsedKm != null && kmDriven != null && parsedKm !== kmDriven)

  const canSave =
    !saveMutation.isPending &&
    dirty &&
    !(draft.trim() !== '' && parsedKm == null)

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!canSave) return
    saveMutation.mutate(parsedKm)
  }

  return (
    <Card
      mb="4"
      style={
        prominent
          ? { background: 'var(--amber-a2)', borderColor: 'var(--amber-6)' }
          : undefined
      }
    >
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center" gap="2" wrap="wrap">
          <Text size="3" weight="bold">
            Km driven
          </Text>
          {seededFromOffer && (
            <Badge color="amber" variant="soft" size="1">
              From offer — adjust to actual
            </Badge>
          )}
          {!seededFromOffer &&
            kmDriven == null &&
            plannedOfferKm != null &&
            plannedOfferKm > 0 && (
              <Badge color="gray" variant="soft" size="1">
                Offer plans {plannedOfferKm} km
              </Badge>
            )}
        </Flex>
        <Text size="2" color="gray">
          Save km adds a transport expense = km × {rate} kr/km (company Money
          rate). Conta fuel/toll suggestions stay separate.
        </Text>
        <form onSubmit={handleSave}>
          <Flex gap="3" align="end" wrap="wrap">
            <Box style={{ minWidth: 140, maxWidth: 200 }}>
              <TextField.Root
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 120"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saveMutation.isPending}
              >
                <TextField.Slot side="right">km</TextField.Slot>
              </TextField.Root>
            </Box>
            <Button type="submit" size="2" variant="soft" disabled={!canSave}>
              {saveMutation.isPending ? 'Saving…' : 'Save km'}
            </Button>
            {plannedOfferKm != null &&
              plannedOfferKm > 0 &&
              (kmDriven == null || kmDriven === 0) && (
                <Button
                  type="button"
                  size="2"
                  variant="outline"
                  disabled={saveMutation.isPending}
                  onClick={() => {
                    setDraft(String(plannedOfferKm))
                    setSeededFromOffer(true)
                    saveMutation.mutate(plannedOfferKm)
                  }}
                >
                  Use offer {plannedOfferKm} km
                </Button>
              )}
          </Flex>
        </form>
        {previewCost != null && (
          <Text size="2">
            Expense:{' '}
            <Text weight="bold" color="red">
              {formatCurrency(previewCost)}
            </Text>{' '}
            <Text color="gray">
              ({parsedKm} × {rate} kr)
            </Text>
          </Text>
        )}
      </Flex>
    </Card>
  )
}
