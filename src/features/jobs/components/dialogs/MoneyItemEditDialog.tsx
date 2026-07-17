import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  SegmentedControl,
  Text,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { insertJobMoneyItem, updateJobMoneyItem } from '../../api/moneyQueries'
import type {
  JobMoneyItem,
  JobMoneyItemInsert,
  JobMoneyItemSource,
  JobMoneyItemType,
} from '../../api/moneyQueries'

const defaultValues = {
  type: 'income' as JobMoneyItemType,
  description: '',
  amount: '',
  date: '',
  reference: '',
}

const schema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().trim().min(1, 'Description is required'),
  amount: z.string().refine((value) => {
    const parsed = parseFloat(value)
    return !Number.isNaN(parsed) && parsed > 0
  }, 'Amount must be greater than 0'),
  date: z.string(),
  reference: z.string(),
})

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

function buildValuesFromExisting(item: JobMoneyItem): typeof defaultValues {
  return {
    type: item.type,
    description: item.description,
    amount: String(item.amount),
    date: item.date ? item.date.slice(0, 10) : '',
    reference: item.reference ?? '',
  }
}

function buildValuesFromInitial(
  initialData: NonNullable<Props['initialData']>,
): typeof defaultValues {
  return {
    type: initialData.type,
    description: initialData.description,
    amount: String(initialData.amount),
    date: initialData.date ? initialData.date.slice(0, 10) : '',
    reference: initialData.reference ?? '',
  }
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

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      if (mode === 'edit') {
        await updateMutation.mutateAsync(value)
      } else {
        await insertMutation.mutateAsync(value)
      }
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && existingItem) {
      form.reset(buildValuesFromExisting(existingItem), {
        keepDefaultValues: true,
      })
    } else if (initialData) {
      form.reset(buildValuesFromInitial(initialData), {
        keepDefaultValues: true,
      })
    } else {
      form.reset(defaultValues, { keepDefaultValues: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [
    open,
    mode,
    existingItem?.id,
    initialData?.description,
    initialData?.amount,
  ])

  const insertMutation = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      const amountNum = parseFloat(value.amount)
      const payload: JobMoneyItemInsert = {
        job_id: jobId,
        company_id: companyId,
        type: value.type,
        description: value.description.trim(),
        amount: amountNum,
        date: value.date ? `${value.date}T00:00:00Z` : null,
        reference: value.reference.trim() || null,
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
    mutationFn: async (value: typeof defaultValues) => {
      if (!existingItem) throw new Error('No item to update')
      const amountNum = parseFloat(value.amount)
      await updateJobMoneyItem(existingItem.id, {
        description: value.description.trim(),
        amount: amountNum,
        date: value.date ? `${value.date}T00:00:00Z` : null,
        reference: value.reference.trim() || null,
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

  const isPending = insertMutation.isPending || updateMutation.isPending

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>
          {mode === 'edit' ? 'Edit item' : 'Add item'}
        </Dialog.Title>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              {mode === 'add' && !initialData && (
                <form.AppField name="type">
                  {(field) => (
                    <Box>
                      <Text as="div" size="2" mb="1" weight="medium">
                        Type
                      </Text>
                      <SegmentedControl.Root
                        value={field.state.value}
                        onValueChange={(v) =>
                          field.handleChange(v as JobMoneyItemType)
                        }
                        size="2"
                        disabled={isPending}
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
                </form.AppField>
              )}

              <form.AppField name="description">
                {(field) => (
                  <field.TextField
                    label="Description"
                    placeholder="Description"
                    disabled={isPending}
                  />
                )}
              </form.AppField>

              <form.AppField name="amount">
                {(field) => (
                  <field.TextField
                    label="Amount (NOK)"
                    placeholder="0.00"
                    disabled={isPending}
                    type="number"
                  />
                )}
              </form.AppField>

              <form.AppField name="date">
                {(field) => (
                  <field.TextField
                    label="Date (optional)"
                    disabled={isPending}
                    type="date"
                  />
                )}
              </form.AppField>

              <form.AppField name="reference">
                {(field) => (
                  <field.TextField
                    label="Reference (optional)"
                    placeholder="e.g. invoice number"
                    disabled={isPending}
                  />
                )}
              </form.AppField>
            </Flex>

            <Flex justify="end" gap="2" mt="4">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton
                label={mode === 'edit' ? 'Save' : 'Add'}
                pendingLabel="Saving…"
                disabled={isPending}
              />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
