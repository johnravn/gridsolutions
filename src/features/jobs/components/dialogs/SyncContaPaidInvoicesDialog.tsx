import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Progress,
  ScrollArea,
  Text,
} from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import { contaClient } from '@shared/api/conta/client'
import { supabase } from '@shared/api/supabase'
import { syncInvoicePaidStatusForOrganization } from '@shared/conta/invoicePaidSyncCore'
import type { InvoicePaidSyncResult } from '@shared/conta/invoicePaidSyncCore'

type Step = 'confirm' | 'running' | 'done' | 'error'

export default function SyncContaPaidInvoicesDialog({
  open,
  onOpenChange,
  organizationId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
}) {
  const queryClient = useQueryClient()
  const [step, setStep] = React.useState<Step>('confirm')
  const [result, setResult] = React.useState<InvoicePaidSyncResult | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [paidExpanded, setPaidExpanded] = React.useState(false)
  const [progress, setProgress] = React.useState({ current: 0, total: 0 })

  React.useEffect(() => {
    if (!open) return
    setStep('confirm')
    setResult(null)
    setErrorMessage(null)
    setPaidExpanded(false)
    setProgress({ current: 0, total: 0 })
  }, [open])

  const syncMutation = useMutation({
    mutationFn: async () =>
      syncInvoicePaidStatusForOrganization(
        organizationId,
        contaClient,
        supabase,
        {
          onProgress: (next) => setProgress(next),
        },
      ),
    onMutate: () => {
      setStep('running')
      setErrorMessage(null)
      setProgress({ current: 0, total: 0 })
    },
    onSuccess: async (syncResult) => {
      setResult(syncResult)
      setStep('done')
      await queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (err: unknown) => {
      setErrorMessage(err instanceof Error ? err.message : 'Sync failed')
      setStep('error')
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (syncMutation.isPending) return
    onOpenChange(next)
  }

  const paidCount = result?.paidInvoices.length ?? 0
  const progressPercent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content maxWidth="440px">
        {step === 'confirm' && (
          <>
            <Dialog.Title>Sync paid invoices from Conta?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Grid will check unpaid Conta-linked invoices for this company and
              mark any that Conta has already recorded as paid. Nothing is sent
              to Conta.
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button onClick={() => syncMutation.mutate()}>Sync</Button>
            </Flex>
          </>
        )}

        {step === 'running' && (
          <>
            <Dialog.Title>Checking Conta…</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Fetching invoice status from Conta. This may take a moment if you
              have many open invoices.
            </Dialog.Description>
            <Box py="2">
              <Progress value={progressPercent} size="2" />
              <Text size="2" color="gray" mt="2" style={{ display: 'block' }}>
                {progress.total === 0
                  ? 'Preparing…'
                  : `Checking ${progress.current} of ${progress.total}`}
              </Text>
            </Box>
          </>
        )}

        {step === 'error' && (
          <>
            <Dialog.Title>Sync failed</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              {errorMessage ?? 'Something went wrong while talking to Conta.'}
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button
                variant="soft"
                color="gray"
                onClick={() => setStep('confirm')}
              >
                Try again
              </Button>
              <Dialog.Close>
                <Button>Close</Button>
              </Dialog.Close>
            </Flex>
          </>
        )}

        {step === 'done' && result && (
          <>
            <Dialog.Title>Sync complete</Dialog.Title>
            <Dialog.Description size="2" mb="3">
              Checked {result.checked} Conta invoice
              {result.checked === 1 ? '' : 's'}. Updated{' '}
              {result.invoicesMarkedPaid} Grid invoice
              {result.invoicesMarkedPaid === 1 ? '' : 's'} to paid
              {result.jobsMarkedPaid > 0
                ? ` (${result.jobsMarkedPaid} job${
                    result.jobsMarkedPaid === 1 ? '' : 's'
                  })`
                : ''}
              .
            </Dialog.Description>

            {paidCount > 0 && (
              <Box mb="3">
                <Button
                  type="button"
                  variant="ghost"
                  color="gray"
                  size="2"
                  onClick={() => setPaidExpanded((v) => !v)}
                  style={{ paddingLeft: 0 }}
                >
                  <Flex align="center" gap="1">
                    {paidExpanded ? (
                      <NavArrowDown width={14} height={14} />
                    ) : (
                      <NavArrowRight width={14} height={14} />
                    )}
                    <Text size="2">
                      {paidExpanded ? 'Hide' : 'Show'} paid invoices (
                      {paidCount})
                    </Text>
                  </Flex>
                </Button>
                {paidExpanded && (
                  <ScrollArea
                    type="auto"
                    scrollbars="vertical"
                    style={{ maxHeight: 200, marginTop: 8 }}
                  >
                    <Box
                      p="2"
                      style={{
                        border: '1px solid var(--gray-a6)',
                        borderRadius: 6,
                      }}
                    >
                      <Flex direction="column" gap="2">
                        {result.paidInvoices.map((item) => (
                          <Flex
                            key={item.jobInvoiceId}
                            justify="between"
                            align="center"
                            gap="2"
                          >
                            <Text size="2">
                              Conta #{item.contaInvoiceId ?? '—'}
                            </Text>
                            <Text size="1" color="gray">
                              {item.newlyMarkedPaid
                                ? item.jobsMarkedPaid > 0
                                  ? `Marked paid · ${item.jobsMarkedPaid} job${
                                      item.jobsMarkedPaid === 1 ? '' : 's'
                                    }`
                                  : 'Marked paid'
                                : 'Already paid in Conta'}
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                    </Box>
                  </ScrollArea>
                )}
              </Box>
            )}

            {result.errors.length > 0 && (
              <Box mb="3">
                <Text
                  size="1"
                  color="orange"
                  mb="1"
                  style={{ display: 'block' }}
                >
                  {result.errors.length} warning
                  {result.errors.length === 1 ? '' : 's'} during sync:
                </Text>
                <ScrollArea
                  type="auto"
                  scrollbars="vertical"
                  style={{ maxHeight: 120 }}
                >
                  <Box
                    p="2"
                    style={{
                      border: '1px solid var(--orange-a6)',
                      borderRadius: 6,
                    }}
                  >
                    <Flex direction="column" gap="1">
                      {result.errors.slice(0, 8).map((err, i) => (
                        <Text
                          key={`${i}-${err.slice(0, 24)}`}
                          size="1"
                          color="gray"
                        >
                          {err}
                        </Text>
                      ))}
                      {result.errors.length > 8 && (
                        <Text size="1" color="gray">
                          …and {result.errors.length - 8} more
                        </Text>
                      )}
                    </Flex>
                  </Box>
                </ScrollArea>
              </Box>
            )}

            <Flex gap="3" justify="end">
              <Dialog.Close>
                <Button>Done</Button>
              </Dialog.Close>
            </Flex>
          </>
        )}
      </Dialog.Content>
    </Dialog.Root>
  )
}
