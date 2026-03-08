// src/features/jobs/components/dialogs/MoneyItemEditDialog.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  SegmentedControl,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  insertJobMoneyItem,
  updateJobMoneyItem,
  type JobMoneyItem,
  type JobMoneyItemInsert,
  type JobMoneyItemSource,
  type JobMoneyItemType,
} from '../../api/moneyQueries'

type FormState = {
  type: JobMoneyItemType
  description: string
  amount: string
  date: string
  reference: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  companyId: string
  mode: 'add' | 'edit'
  initialData?: {
    type: JobMoneyItemType
    description: string
    amount: number
    date?: string | null
    reference?: string | null
    source: JobMoneyItemSource
    sourceId?: string | null
  }
  existingItem?: JobMoneyItem | null
  onSaved?: () => void
}

const emptyForm: FormState = {
  type: 'income',
  description: '',
  amount: '',
  date: '',
  reference: '',
}

export default function MoneyItemEditDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  mode,
  initialData,
  existingItem,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [form, setForm] = React.useState<FormState>(emptyForm)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && existingItem) {
      setForm({
        type: existingItem.type as JobMoneyItemType,
        description: existingItem.description,
        amount: String(existingItem.amount),
        date: existingItem.date ? existingItem.date.slice(0, 10) : '',
        reference: existingItem.reference ?? '',
      })
    } else if (initialData) {
      setForm({
        type: initialData.type,
        description: initialData.description,
        amount: String(initialData.amount),
        date: initialData.date ? initialData.date.slice(0, 10) : '',
        reference: initialData.reference ?? '',
      })
    } else {
      setForm(emptyForm)
    }
  }, [open, mode, existingItem?.id, initialData?.description, initialData?.amount])

  const amountNum = React.useMemo(() => {
    const parsed = parseFloat(form.amount)
    return Number.isNaN(parsed) ? 0 : parsed
  }, [form.amount])

  const isValid =
    form.description.trim().length > 0 &&
    amountNum > 0

  const insertMutation = useMutation({
    mutationFn: async () => {
      const payload: JobMoneyItemInsert = {
        job_id: jobId,
        company_id: companyId,
        type: form.type,
        description: form.description.trim(),
        amount: amountNum,
        date: form.date ? `${form.date}T00:00:00Z` : null,
        reference: form.reference.trim() || null,
        source: initialData?.source ?? 'manual',
        source_id: initialData?.sourceId ?? null,
      }
      return insertJobMoneyItem(payload)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'money-items'] })
      success('Item added')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to add item',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!existingItem) throw new Error('No item to update')
      await updateJobMoneyItem(existingItem.id, {
        description: form.description.trim(),
        amount: amountNum,
        date: form.date ? `${form.date}T00:00:00Z` : null,
        reference: form.reference.trim() || null,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'money-items'] })
      success('Item updated')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to update item',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const handleSubmit = () => {
    if (!isValid) return
    if (mode === 'edit') {
      updateMutation.mutate()
    } else {
      insertMutation.mutate()
    }
  }

  const isPending = insertMutation.isPending || updateMutation.isPending

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>
          {mode === 'edit' ? 'Edit item' : 'Add item'}
        </Dialog.Title>

        <Flex direction="column" gap="3" mt="3">
          {mode === 'add' && !initialData && (
            <Box>
              <Text as="div" size="2" mb="1" weight="medium">
                Type
              </Text>
              <SegmentedControl.Root
                value={form.type}
                onValueChange={(v) => set('type', v as JobMoneyItemType)}
                size="2"
              >
                <SegmentedControl.Item value="income">
                  Income
                </SegmentedControl.Item>
                <SegmentedControl.Item value="expense">
                  Expense
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </Box>
          )}

          <Box>
            <Text as="div" size="2" mb="1" weight="medium">
              Description
            </Text>
            <TextField.Root
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Description"
              disabled={isPending}
            />
          </Box>

          <Box>
            <Text as="div" size="2" mb="1" weight="medium">
              Amount (NOK)
            </Text>
            <TextField.Root
              type="number"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0.00"
              min={0}
              step={0.01}
              disabled={isPending}
            />
          </Box>

          <Box>
            <Text as="div" size="2" mb="1" weight="medium">
              Date (optional)
            </Text>
            <TextField.Root
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              disabled={isPending}
            />
          </Box>

          <Box>
            <Text as="div" size="2" mb="1" weight="medium">
              Reference (optional)
            </Text>
            <TextField.Root
              value={form.reference}
              onChange={(e) => set('reference', e.target.value)}
              placeholder="e.g. invoice number"
              disabled={isPending}
            />
          </Box>
        </Flex>

        <Flex justify="end" gap="2" mt="4">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
          >
            {mode === 'edit' ? 'Save' : 'Add'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
