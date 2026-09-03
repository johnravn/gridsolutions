import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  RadioGroup,
  ScrollArea,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Download, Plus, Refresh } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { hasCompleteContaAddress } from '@shared/conta/customerSyncCore'
import { resolveContaCustomerType } from '@shared/conta/contaCustomerMatch'
import {
  checkContaCustomerExists,
  contaCustomerTypeLabel,
  contaMatchReasonLabel,
} from '../../utils/contaCustomerCheck'
import {
  createCustomerInConta,
  fetchAndSyncContaCustomer,
} from '../../api/contaCustomerSync'
import type { ContaCustomerMatch } from '../../utils/contaCustomerCheck'

function searchedByLabel(fields: Array<string>) {
  const labels: Record<string, string> = {
    orgNo: 'organisation number',
    email: 'email',
    name: 'name',
    phone: 'phone',
  }
  return fields.map((field) => labels[field] ?? field).join(', ')
}

function matchDetailLine(match: ContaCustomerMatch) {
  const parts = [
    contaCustomerTypeLabel(match.customerType),
    match.email,
    match.orgNo,
  ].filter(Boolean)
  return parts.join(' · ')
}

export default function ContaCustomerCheckDialog({
  open,
  onOpenChange,
  companyId,
  customer,
  onCreatedInConta,
  onFetchedFromConta,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string | null
  customer: {
    id: string
    name: string | null
    vat_number: string | null
    address?: string | null
    email?: string | null
    phone?: string | null
  }
  onCreatedInConta?: () => void
  onFetchedFromConta?: () => void
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [selectedId, setSelectedId] = React.useState('')

  const { data: accountingConfig } = useQuery({
    queryKey: ['company', companyId, 'accounting-config'],
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select('accounting_organization_id, accounting_software')
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) throw error
      return data as {
        accounting_organization_id: string | null
        accounting_software: string | null
      } | null
    },
    enabled: open && !!companyId,
  })

  const {
    data: checkResult,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'conta-customer-check',
      accountingConfig?.accounting_organization_id,
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      customer.vat_number,
    ],
    queryFn: async () => {
      const orgId = accountingConfig?.accounting_organization_id
      if (!orgId) throw new Error('Accounting not configured')
      return checkContaCustomerExists(
        orgId,
        {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          vat_number: customer.vat_number,
        },
        { companyId },
      )
    },
    enabled:
      open &&
      !!accountingConfig?.accounting_organization_id &&
      accountingConfig?.accounting_software === 'conta',
  })

  React.useEffect(() => {
    const matches = checkResult?.matches ?? []
    const linkedHere = matches.find(
      (match) => match.linkedGridCustomer?.id === customer.id,
    )
    if (linkedHere) {
      setSelectedId(String(linkedHere.id))
      return
    }
    const available = matches.find(
      (match) =>
        !match.linkedGridCustomer ||
        match.linkedGridCustomer.id === customer.id,
    )
    setSelectedId(available ? String(available.id) : '')
  }, [checkResult, customer.id])

  const canCheck =
    accountingConfig?.accounting_software === 'conta' &&
    !!accountingConfig?.accounting_organization_id

  const createInContaMut = useMutation({
    mutationFn: async () => {
      if (!companyId || !accountingConfig?.accounting_organization_id)
        throw new Error('Missing company or accounting config')
      const res = await createCustomerInConta(
        companyId,
        accountingConfig.accounting_organization_id,
        {
          id: customer.id,
          name: customer.name,
          address: customer.address ?? null,
          vat_number: customer.vat_number,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
        },
      )
      if (!res.ok) throw new Error(res.error)
      return res.contaCustomerId
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [
          'conta-customer-check',
          accountingConfig?.accounting_organization_id,
          customer.id,
        ],
      })
      onCreatedInConta?.()
      success('Created in Conta', 'The customer was created in Conta.')
      onOpenChange(false)
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error ? e.message : 'Could not create in Conta.'
      toastError('Create failed', message)
    },
  })

  const fetchFromContaMut = useMutation({
    mutationFn: async (contaCustomerId: number) => {
      if (!companyId || !accountingConfig?.accounting_organization_id)
        throw new Error('Missing config or Conta customer ID')
      const res = await fetchAndSyncContaCustomer(
        companyId,
        accountingConfig.accounting_organization_id,
        customer.id,
        contaCustomerId,
      )
      if (!res.ok) throw new Error(res.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [
          'conta-customer-check',
          accountingConfig?.accounting_organization_id,
          customer.id,
        ],
      })
      onFetchedFromConta?.()
      success('Data fetched', 'Conta customer data synced to this customer.')
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error ? e.message : 'Could not fetch from Conta.'
      toastError('Fetch failed', message)
    },
  })

  const createType = resolveContaCustomerType(customer.vat_number)
  const alreadyLinkedHere = (checkResult?.matches ?? []).some(
    (match) => match.linkedGridCustomer?.id === customer.id,
  )
  const canCreateInConta =
    canCheck &&
    checkResult &&
    !checkResult.error &&
    !alreadyLinkedHere &&
    hasCompleteContaAddress(customer.address)
  const selectedMatch = (checkResult?.matches ?? []).find(
    (match) => String(match.id) === selectedId,
  )
  const selectedLinkedToOther =
    selectedMatch?.linkedGridCustomer != null &&
    selectedMatch.linkedGridCustomer.id !== customer.id

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="3" style={{ maxWidth: '520px' }}>
        <Dialog.Title>Sync with Conta</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Search Conta by name, email, or organisation number. If several
          customers match, pick which one to link.
        </Dialog.Description>

        {!canCheck && (
          <Box p="3" style={{ background: 'var(--gray-a2)', borderRadius: 8 }}>
            <Text size="2" color="gray">
              Configure Conta in Company settings and connect your accounting
              organization to use this feature.
            </Text>
          </Box>
        )}

        {canCheck && (
          <Flex direction="column" gap="3">
            {isLoading || isFetching ? (
              <Flex align="center" gap="2">
                <Spinner size="1" />
                <Text size="2">Searching Conta...</Text>
              </Flex>
            ) : checkResult ? (
              <Flex
                direction="column"
                gap="3"
                p="3"
                style={{
                  background: checkResult.exists
                    ? 'var(--green-a2)'
                    : checkResult.error
                      ? 'var(--red-a2)'
                      : 'var(--gray-a2)',
                  borderRadius: 8,
                  border: `1px solid ${checkResult.exists ? 'var(--green-a6)' : checkResult.error ? 'var(--red-a6)' : 'var(--gray-a6)'}`,
                }}
              >
                {checkResult.error ? (
                  <Text size="2" color="red">
                    {checkResult.error}
                  </Text>
                ) : checkResult.exists ? (
                  <Flex direction="column" gap="3">
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium" color="green">
                        {checkResult.matches.length === 1
                          ? 'Customer found in Conta'
                          : `${checkResult.matches.length} possible matches in Conta`}
                      </Text>
                      <Text size="1" color="gray">
                        Searched by {searchedByLabel(checkResult.searchedBy)}.
                      </Text>
                    </Flex>
                    <ScrollArea
                      type="auto"
                      scrollbars="vertical"
                      style={{ maxHeight: 240 }}
                    >
                      <RadioGroup.Root
                        value={selectedId}
                        onValueChange={setSelectedId}
                      >
                        <Flex direction="column" gap="2">
                          {checkResult.matches.map((match) => {
                            const linkedToOther =
                              match.linkedGridCustomer != null &&
                              match.linkedGridCustomer.id !== customer.id
                            const linkedHere =
                              match.linkedGridCustomer?.id === customer.id
                            return (
                              <Text as="label" size="2" key={match.id}>
                                <Flex align="start" gap="2">
                                  <RadioGroup.Item
                                    value={String(match.id)}
                                    disabled={linkedToOther}
                                  />
                                  <Flex
                                    direction="column"
                                    gap="1"
                                    style={{ minWidth: 0 }}
                                  >
                                    <Flex align="center" gap="2" wrap="wrap">
                                      <Text size="2" weight="medium">
                                        {match.name}
                                      </Text>
                                      {linkedHere && (
                                        <Badge size="1" color="green">
                                          Linked to this customer
                                        </Badge>
                                      )}
                                      {linkedToOther && (
                                        <Badge size="1" color="amber">
                                          Linked to{' '}
                                          {match.linkedGridCustomer?.name}
                                        </Badge>
                                      )}
                                    </Flex>
                                    <Text size="1" color="gray">
                                      {matchDetailLine(match)}
                                    </Text>
                                    {match.reasons.length > 0 && (
                                      <Text size="1" color="gray">
                                        Matched by{' '}
                                        {match.reasons
                                          .map(contaMatchReasonLabel)
                                          .join(', ')}
                                      </Text>
                                    )}
                                  </Flex>
                                </Flex>
                              </Text>
                            )
                          })}
                        </Flex>
                      </RadioGroup.Root>
                    </ScrollArea>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => {
                        if (!selectedMatch || selectedLinkedToOther) return
                        fetchFromContaMut.mutate(selectedMatch.id)
                      }}
                      disabled={
                        !selectedMatch ||
                        selectedLinkedToOther ||
                        fetchFromContaMut.isPending
                      }
                    >
                      {fetchFromContaMut.isPending ? (
                        <Spinner size="1" />
                      ) : (
                        <Download width={14} height={14} />
                      )}
                      {selectedMatch?.linkedGridCustomer?.id === customer.id
                        ? 'Refresh from Conta'
                        : 'Link selected'}
                    </Button>
                  </Flex>
                ) : (
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="medium">
                      Customer not found in Conta
                    </Text>
                    <Text size="1" color="gray">
                      Searched by {searchedByLabel(checkResult.searchedBy)}.
                    </Text>
                  </Flex>
                )}
                {canCreateInConta && (
                  <Button
                    size="2"
                    variant={checkResult.exists ? 'soft' : 'solid'}
                    onClick={() => createInContaMut.mutate()}
                    disabled={createInContaMut.isPending}
                  >
                    {createInContaMut.isPending ? (
                      <Spinner size="1" />
                    ) : (
                      <Plus width={14} height={14} />
                    )}
                    {createType === 'INDIVIDUAL'
                      ? 'Create private customer in Conta'
                      : 'Create organisation in Conta'}
                  </Button>
                )}
                {!canCreateInConta &&
                  !checkResult.error &&
                  !alreadyLinkedHere &&
                  !hasCompleteContaAddress(customer.address) && (
                    <Text size="1" color="gray">
                      Add a street address, postal code, and city to create this
                      customer in Conta.
                    </Text>
                  )}
              </Flex>
            ) : null}

            {canCheck && (
              <Button
                variant="soft"
                size="2"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <Refresh width={14} height={14} />
                Search again
              </Button>
            )}
          </Flex>
        )}

        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
