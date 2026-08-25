// src/features/jobs/components/dialogs/RecurringInvoiceJobPickerDialog.tsx
import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Table,
  Text,
} from '@radix-ui/themes'
import { format } from 'date-fns'
import { nb } from 'date-fns/locale'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import { getJobStatusColor } from '../../utils/statusColors'
import type { JobListRow, RecurringJobInvoiceEntry } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobs: Array<JobListRow>
  invoiceSummary: Array<RecurringJobInvoiceEntry>
  onContinue: (selectedJobIds: Array<string>) => void
}

function defaultSelectedIds(
  jobs: Array<JobListRow>,
  invoiceSummary: Array<RecurringJobInvoiceEntry>,
): Set<string> {
  const invMap = new Map(invoiceSummary.map((i) => [i.job_id, i]))
  return new Set(
    jobs
      .filter((j) => {
        if (j.archived) return false
        if (j.status !== 'completed') return false
        const inv = invMap.get(j.id)
        return !inv || inv.invoice_count === 0
      })
      .map((j) => j.id),
  )
}

export default function RecurringInvoiceJobPickerDialog({
  open,
  onOpenChange,
  jobs,
  invoiceSummary,
  onContinue,
}: Props) {
  const invMap = React.useMemo(
    () => new Map(invoiceSummary.map((i) => [i.job_id, i])),
    [invoiceSummary],
  )

  const [selected, setSelected] = React.useState<Set<string>>(() =>
    defaultSelectedIds(jobs, invoiceSummary),
  )
  const [confirmReinvoice, setConfirmReinvoice] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setSelected(defaultSelectedIds(jobs, invoiceSummary))
      setConfirmReinvoice(false)
    }
  }, [open, jobs, invoiceSummary])

  const selectedJobs = jobs.filter((j) => selected.has(j.id))
  const customerIds = new Set(
    selectedJobs.map((j) => j.customer?.id).filter(Boolean),
  )
  const mixedCustomers = customerIds.size > 1
  const hasAlreadyInvoiced = selectedJobs.some((j) => {
    const inv = invMap.get(j.id)
    return (
      inv &&
      (inv.invoice_count > 0 || j.status === 'invoiced' || j.status === 'paid')
    )
  })

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(jobs.map((j) => j.id)))
  const selectNone = () => setSelected(new Set())

  const handleContinue = () => {
    if (selected.size === 0 || mixedCustomers) return
    if (hasAlreadyInvoiced && !confirmReinvoice) {
      setConfirmReinvoice(true)
      return
    }
    onContinue([...selected])
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="3" style={{ maxWidth: 720 }}>
        <Dialog.Title>Create invoice from recurring job</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Select which member jobs to include on one invoice. All selected jobs
          must share the same customer.
        </Dialog.Description>

        <Flex gap="2" mb="3">
          <Button size="1" variant="soft" onClick={selectAll}>
            Select all
          </Button>
          <Button size="1" variant="soft" onClick={selectNone}>
            Select none
          </Button>
        </Flex>

        <Box style={{ overflowX: 'auto', maxHeight: 360 }}>
          <Table.Root size="2" variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell style={{ width: 40 }} />
                <Table.ColumnHeaderCell>Job</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Invoices</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {jobs.map((job) => {
                const inv = invMap.get(job.id)
                const alreadyInvoiced =
                  inv &&
                  (inv.invoice_count > 0 ||
                    job.status === 'invoiced' ||
                    job.status === 'paid')
                return (
                  <Table.Row key={job.id}>
                    <Table.Cell>
                      <Checkbox
                        checked={selected.has(job.id)}
                        onCheckedChange={() => toggle(job.id)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Text weight="medium">{job.title}</Text>
                      {job.jobnr != null && (
                        <Text size="1" color="gray">
                          {' '}
                          #{job.jobnr}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {job.start_at
                        ? format(new Date(job.start_at), 'd. MMM yyyy', {
                            locale: nb,
                          })
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={getJobStatusColor(job.status)}
                        variant="soft"
                        size="1"
                      >
                        {makeWordPresentable(job.status)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {alreadyInvoiced ? (
                        <Badge color="orange" variant="soft" size="1">
                          Already invoiced
                        </Badge>
                      ) : inv && inv.invoice_count > 0 ? (
                        `${inv.invoice_count} invoice${inv.invoice_count !== 1 ? 's' : ''}`
                      ) : (
                        '—'
                      )}
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table.Root>
        </Box>

        {mixedCustomers && selected.size > 0 && (
          <Text size="2" color="red" mt="3" as="p">
            Selected jobs belong to different customers. Choose jobs with the
            same customer to continue.
          </Text>
        )}

        {confirmReinvoice && hasAlreadyInvoiced && (
          <Box
            mt="3"
            p="3"
            style={{
              borderRadius: 8,
              background: 'var(--orange-a2)',
              border: '1px solid var(--orange-a6)',
            }}
          >
            <Text size="2" weight="medium" color="orange">
              Some selected jobs were already invoiced
            </Text>
            <Text size="2" color="gray" mt="1" as="p">
              Continuing may double-bill. Click Continue again to proceed
              anyway.
            </Text>
          </Box>
        )}

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            onClick={handleContinue}
            disabled={selected.size === 0 || mixedCustomers}
          >
            Continue ({selected.size})
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
