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
import { updateJobTransportKmDriven } from '../../api/moneyQueries'
import {
  DEFAULT_TRANSPORT_COST_PER_KM,
  transportCostAmount,
} from '../../utils/moneySuggestions'

export default function MoneyTransportKmCard({
  jobId,
  kmDriven,
  costPerKm,
  plannedOfferKm,
  prominent = false,
}: {
  jobId: string
  kmDriven: number | null
  costPerKm: number
  plannedOfferKm: number | null
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

  const parsedKm = React.useMemo(() => {
    if (draft.trim() === '') return null
    const n = Number(draft)
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }, [draft])

  const previewCost = transportCostAmount(
    parsedKm,
    costPerKm ?? DEFAULT_TRANSPORT_COST_PER_KM,
  )

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)

  const saveMutation = useMutation({
    mutationFn: async (next: number | null) => {
      await updateJobTransportKmDriven(jobId, next)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['jobs', jobId, 'money', 'job-info'],
      })
      success('Km saved', 'Transport cost suggestion will update.')
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
          Transport cost = km × {costPerKm} kr/km (company Money rate). Conta
          fuel/toll suggestions stay separate.
        </Text>
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
          <Button
            size="2"
            variant="soft"
            disabled={
              saveMutation.isPending ||
              !dirty ||
              (draft.trim() !== '' && parsedKm == null)
            }
            onClick={() => saveMutation.mutate(parsedKm)}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save km'}
          </Button>
          {plannedOfferKm != null &&
            plannedOfferKm > 0 &&
            (kmDriven == null || kmDriven === 0) && (
              <Button
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
        {previewCost != null && (
          <Text size="2">
            Suggested cost:{' '}
            <Text weight="bold" color="red">
              {formatCurrency(previewCost)}
            </Text>{' '}
            <Text color="gray">
              ({parsedKm} × {costPerKm} kr)
            </Text>
          </Text>
        )}
      </Flex>
    </Card>
  )
}
