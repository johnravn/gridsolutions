import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Heading,
  SegmentedControl,
  Select,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  applySeriesAccountingAutofill,
  fetchCompanyGeneralRates,
  fetchCrewBookingsForJobs,
  fetchExistingMoneyItemsForJobs,
} from '../../api/seriesAccountingAutofill'
import {
  
  
  buildCrewRateAutofillPreview,
  buildFixedAutofillPreview,
  previewLinesToInserts
} from '../../utils/seriesAccountingAutofill'
import type {AutofillFixedLine, AutofillPreview} from '../../utils/seriesAccountingAutofill';
import type { RecurringJobAccountingEntry } from '../../types'

type Mode = 'fixed' | 'crew'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurringJobId: string
  selectedEntries: Array<RecurringJobAccountingEntry>
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function newFixedLine(): AutofillFixedLine {
  return {
    key: crypto.randomUUID().slice(0, 8),
    type: 'expense',
    description: '',
    amount: 0,
  }
}

function formatJobLabel(entry: RecurringJobAccountingEntry) {
  if (entry.jobnr != null) {
    return `${entry.job_title} (#${String(entry.jobnr).padStart(6, '0')})`
  }
  return entry.job_title
}

export default function RecurringAccountingAutofillDialog({
  open,
  onOpenChange,
  recurringJobId,
  selectedEntries,
}: Props) {
  const { companyId } = useCompany()
  const { success, error: showError } = useToast()
  const qc = useQueryClient()

  const [mode, setMode] = React.useState<Mode>('crew')
  const [billingUnit, setBillingUnit] = React.useState<'hour' | 'day'>('hour')
  const [replaceMatching, setReplaceMatching] = React.useState(false)
  const [fixedLines, setFixedLines] = React.useState<Array<AutofillFixedLine>>(
    () => [newFixedLine()],
  )
  const [step, setStep] = React.useState<'configure' | 'preview'>('configure')
  const [preview, setPreview] = React.useState<AutofillPreview | null>(null)
  const [building, setBuilding] = React.useState(false)

  const jobIds = React.useMemo(
    () => selectedEntries.map((e) => e.job_id),
    [selectedEntries],
  )

  const jobDates = React.useMemo(() => {
    const map = new Map<string, string | null>()
    for (const entry of selectedEntries) {
      map.set(entry.job_id, entry.start_at)
    }
    return map
  }, [selectedEntries])

  React.useEffect(() => {
    if (!open) {
      setStep('configure')
      setPreview(null)
      setBuilding(false)
      setReplaceMatching(false)
      setMode('crew')
      setFixedLines([newFixedLine()])
    }
  }, [open])

  const { data: companyRates } = useQuery({
    queryKey: ['company', companyId, 'general-rates'] as const,
    enabled: !!companyId && open,
    queryFn: () => fetchCompanyGeneralRates(companyId!),
  })

  const buildPreview = async () => {
    if (!companyId || jobIds.length === 0) return
    setBuilding(true)
    try {
      const existingItems = await fetchExistingMoneyItemsForJobs(jobIds)
      let next: AutofillPreview
      if (mode === 'fixed') {
        next = buildFixedAutofillPreview({
          jobIds,
          jobDates,
          lines: fixedLines,
          existingItems,
          replaceMatching,
        })
      } else {
        const bookings = await fetchCrewBookingsForJobs({
          companyId,
          jobIds,
        })
        next = buildCrewRateAutofillPreview({
          jobIds,
          bookings,
          companyRates,
          billingUnit,
          existingItems,
          replaceMatching,
        })
      }
      setPreview(next)
      setStep('preview')
    } catch (err) {
      showError(
        'Could not build preview',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setBuilding(false)
    }
  }

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !preview) throw new Error('Nothing to apply')
      const { deletes, inserts } = previewLinesToInserts(
        preview.lines,
        companyId,
      )
      if (inserts.length === 0) {
        throw new Error('No lines to write — all skipped or empty.')
      }
      return applySeriesAccountingAutofill({ deletes, inserts })
    },
    onSuccess: (result) => {
      success(
        'Autofill applied',
        `${result.inserted} line${result.inserted === 1 ? '' : 's'} written${
          result.deleted > 0 ? ` · ${result.deleted} replaced` : ''
        }.`,
      )
      void qc.invalidateQueries({
        queryKey: ['recurring-jobs-accounting', recurringJobId],
      })
      void qc.invalidateQueries({ queryKey: ['jobs'] })
      void qc.invalidateQueries({ queryKey: ['reporting'] })
      onOpenChange(false)
    },
    onError: (err: Error) => {
      showError('Autofill failed', err.message)
    },
  })

  const jobTitleById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of selectedEntries) {
      map.set(entry.job_id, formatJobLabel(entry))
    }
    return map
  }, [selectedEntries])

  const validFixed =
    mode === 'crew' ||
    fixedLines.some((l) => l.description.trim() && l.amount > 0)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="720px"
        style={{ maxHeight: '90vh', overflow: 'auto' }}
      >
        <Dialog.Title>Autofill Accounting</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          Apply the same money pattern to {selectedEntries.length} selected
          occurrence
          {selectedEntries.length !== 1 ? 's' : ''}. Preview before writing —
          existing matching lines are skipped unless you choose replace.
        </Dialog.Description>

        {step === 'configure' ? (
          <Flex direction="column" gap="4">
            <Box>
              <Text
                size="2"
                weight="medium"
                mb="2"
                style={{ display: 'block' }}
              >
                Mode
              </Text>
              <SegmentedControl.Root
                value={mode}
                onValueChange={(value) => setMode(value as Mode)}
              >
                <SegmentedControl.Item value="crew">
                  Crew rates
                </SegmentedControl.Item>
                <SegmentedControl.Item value="fixed">
                  Fixed lines
                </SegmentedControl.Item>
              </SegmentedControl.Root>
            </Box>

            {mode === 'crew' ? (
              <Box>
                <Text size="2" color="gray" mb="2" style={{ display: 'block' }}>
                  Derive crew expenses from each job’s bookings and rates (same
                  billing-rate path as job Accounting). Conta matching is not
                  included in series autofill.
                </Text>
                <Flex align="center" gap="2">
                  <Text size="2">Billing unit</Text>
                  <Select.Root
                    value={billingUnit}
                    onValueChange={(value) =>
                      setBillingUnit(value as 'hour' | 'day')
                    }
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="hour">Hourly</Select.Item>
                      <Select.Item value="day">Daily</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Flex>
              </Box>
            ) : (
              <Flex direction="column" gap="3">
                <Text size="2" color="gray">
                  Template lines are copied onto each selected job (date = job
                  start).
                </Text>
                {fixedLines.map((line, index) => (
                  <Flex key={line.key} gap="2" align="end" wrap="wrap">
                    <Box style={{ flex: '1 1 160px' }}>
                      <TextField.Root
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => {
                          const description = e.target.value
                          setFixedLines((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, description } : row,
                            ),
                          )
                        }}
                      />
                    </Box>
                    <Box style={{ width: 110 }}>
                      <TextField.Root
                        type="number"
                        min={0}
                        step="1"
                        placeholder="Amount"
                        value={line.amount || ''}
                        onChange={(e) => {
                          const amount = Number(e.target.value) || 0
                          setFixedLines((prev) =>
                            prev.map((row, i) =>
                              i === index ? { ...row, amount } : row,
                            ),
                          )
                        }}
                      />
                    </Box>
                    <Select.Root
                      value={line.type}
                      onValueChange={(value) => {
                        const type = value as 'income' | 'expense'
                        setFixedLines((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, type } : row,
                          ),
                        )
                      }}
                    >
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Item value="expense">Expense</Select.Item>
                        <Select.Item value="income">Income</Select.Item>
                      </Select.Content>
                    </Select.Root>
                    <Button
                      size="2"
                      variant="soft"
                      color="gray"
                      disabled={fixedLines.length <= 1}
                      onClick={() =>
                        setFixedLines((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </Flex>
                ))}
                <Button
                  size="2"
                  variant="soft"
                  onClick={() =>
                    setFixedLines((prev) => [...prev, newFixedLine()])
                  }
                >
                  Add line
                </Button>
              </Flex>
            )}

            <Flex align="center" gap="2">
              <Checkbox
                checked={replaceMatching}
                onCheckedChange={(checked) =>
                  setReplaceMatching(checked === true)
                }
                id="replace-matching"
              />
              <Text
                as="label"
                size="2"
                htmlFor="replace-matching"
                style={{ cursor: 'pointer' }}
              >
                Replace existing lines with the same source id
              </Text>
            </Flex>

            <Flex justify="end" gap="2">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                onClick={() => void buildPreview()}
                disabled={
                  building || jobIds.length === 0 || !validFixed || !companyId
                }
              >
                {building ? 'Building preview…' : 'Preview…'}
              </Button>
            </Flex>
          </Flex>
        ) : (
          <Flex direction="column" gap="3">
            <Flex justify="between" align="center" gap="2" wrap="wrap">
              <Heading size="3">Preview</Heading>
              <Text size="2" color="gray">
                {preview
                  ? `${preview.insertCount} new · ${preview.replaceCount} replace · ${preview.skipCount} skip`
                  : null}
              </Text>
            </Flex>

            {!preview || preview.lines.length === 0 ? (
              <Box
                p="4"
                style={{
                  border: '2px dashed var(--gray-a6)',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                <Text size="2" color="gray">
                  Nothing to write for these jobs. Check crew bookings/rates or
                  template amounts.
                </Text>
              </Box>
            ) : (
              <Box className="mobile-hscroll">
                <Table.Root
                  size="1"
                  variant="surface"
                  style={{ minWidth: 560 }}
                >
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Job</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Line</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell style={{ textAlign: 'right' }}>
                        Amount
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {preview.lines.map((line) => (
                      <Table.Row key={`${line.job_id}-${line.source_id}`}>
                        <Table.Cell>
                          <Text size="1">
                            {jobTitleById.get(line.job_id) ?? line.job_id}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="1">{line.description}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text size="1">{line.type}</Text>
                        </Table.Cell>
                        <Table.Cell style={{ textAlign: 'right' }}>
                          <Text size="1">{formatCurrency(line.amount)}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text
                            size="1"
                            color={
                              line.action === 'skip'
                                ? 'gray'
                                : line.action === 'replace'
                                  ? 'orange'
                                  : 'green'
                            }
                          >
                            {line.action}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            )}

            <Flex justify="between" gap="2" wrap="wrap">
              <Button
                variant="soft"
                color="gray"
                onClick={() => {
                  setStep('configure')
                  setPreview(null)
                }}
              >
                Back
              </Button>
              <Flex gap="2">
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button
                  disabled={
                    applyMutation.isPending ||
                    !preview ||
                    preview.insertCount + preview.replaceCount === 0
                  }
                  onClick={() => applyMutation.mutate()}
                >
                  {applyMutation.isPending
                    ? 'Applying…'
                    : `Apply ${
                        (preview?.insertCount ?? 0) +
                        (preview?.replaceCount ?? 0)
                      } line${
                        (preview?.insertCount ?? 0) +
                          (preview?.replaceCount ?? 0) ===
                        1
                          ? ''
                          : 's'
                      }`}
                </Button>
              </Flex>
            </Flex>
          </Flex>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
