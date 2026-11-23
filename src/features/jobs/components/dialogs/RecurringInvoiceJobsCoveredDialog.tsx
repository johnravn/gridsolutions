// src/features/jobs/components/dialogs/RecurringInvoiceJobsCoveredDialog.tsx
import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'
import type { RecurringSeriesInvoiceJob } from '../../types'

function formatJobLabel(job: { title: string; jobnr: number | null }): string {
  if (job.jobnr != null) {
    return `${job.title} (#${String(job.jobnr).padStart(6, '0')})`
  }
  return job.title
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobs: Array<RecurringSeriesInvoiceJob>
  onSelectJob: (jobId: string) => void
}

export default function RecurringInvoiceJobsCoveredDialog({
  open,
  onOpenChange,
  jobs,
  onSelectJob,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Jobs covered</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          {jobs.length} job{jobs.length !== 1 ? 's' : ''} on this invoice
        </Dialog.Description>

        {jobs.length === 0 ? (
          <Text size="2" color="gray">
            No jobs linked to this invoice.
          </Text>
        ) : (
          <Box
            style={{
              maxHeight: 'min(60vh, 420px)',
              overflowY: 'auto',
            }}
          >
            <Flex gap="1" wrap="wrap">
              {jobs.map((job) => (
                <Button
                  key={job.id}
                  size="1"
                  variant="soft"
                  color="gray"
                  onClick={() => {
                    onSelectJob(job.id)
                    onOpenChange(false)
                  }}
                >
                  {formatJobLabel(job)}
                </Button>
              ))}
            </Flex>
          </Box>
        )}

        <Flex justify="end" mt="4">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
