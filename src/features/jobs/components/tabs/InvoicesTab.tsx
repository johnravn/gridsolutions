// src/features/jobs/components/tabs/InvoicesTab.tsx
import { Box, Card, Flex, Heading, Text } from '@radix-ui/themes'
import { CheckCircle, XmarkCircle } from 'iconoir-react'
import { makeWordPresentable } from '@shared/lib/generalFunctions'
import InvoiceHistory from '../invoice/InvoiceHistory'
import type { JobDetail } from '../../types'

type Props = {
  jobId: string
  job: JobDetail
}

export default function InvoicesTab({ jobId, job }: Props) {
  const isInvoiced = job.status === 'invoiced' || job.status === 'paid'
  const isCompleted = job.status === 'completed'

  return (
    <Box style={{ overflowX: 'hidden', maxWidth: '100%' }}>
      <Heading size="3" mb="4">
        Invoices
      </Heading>

      <Card mb="4">
        <Flex justify="between" align="center">
          <Box>
            <Heading size="4" mb="1">
              Job invoice status
            </Heading>
            <Text size="2" color="gray">
              Current status: {makeWordPresentable(job.status)}
            </Text>
          </Box>
          <Box>
            {isInvoiced ? (
              <Flex align="center" gap="2">
                <CheckCircle width={24} height={24} color="var(--green-9)" />
                <Text size="3" weight="medium" color="green">
                  {job.status === 'paid' ? 'Paid' : 'Invoiced'}
                </Text>
              </Flex>
            ) : (
              <Flex align="center" gap="2">
                <XmarkCircle width={24} height={24} color="var(--orange-9)" />
                <Text size="3" weight="medium" color="orange">
                  Not invoiced
                </Text>
              </Flex>
            )}
          </Box>
        </Flex>
        {!isInvoiced && isCompleted && (
          <Box
            mt="3"
            p="3"
            style={{
              background: 'var(--orange-a2)',
              borderRadius: 8,
              border: '1px solid var(--orange-a6)',
            }}
          >
            <Text size="2" color="gray">
              This job is completed and ready to be invoiced. Use the Invoice
              tab to create an invoice.
            </Text>
          </Box>
        )}
      </Card>

      <InvoiceHistory jobId={jobId} />
    </Box>
  )
}
