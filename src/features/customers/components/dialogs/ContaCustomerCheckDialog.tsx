import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Download, Plus, Refresh } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { checkContaCustomerExists } from '../../utils/contaCustomerCheck'
import {
  createCustomerInConta,
  fetchAndSyncContaCustomer,
} from '../../api/contaCustomerSync'

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
      customer.vat_number,
    ],
    queryFn: async () => {
      const orgId = accountingConfig?.accounting_organization_id
      if (!orgId) throw new Error('Accounting not configured')
      return checkContaCustomerExists(orgId, {
        name: customer.name,
        vat_number: customer.vat_number,
      })
    },
    enabled:
      open &&
      !!accountingConfig?.accounting_organization_id &&
      accountingConfig?.accounting_software === 'conta',
  })

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
        queryKey: ['conta-customer-check', accountingConfig?.accounting_organization_id, customer.id],
      })
      onCreatedInConta?.()
      success('Created in Conta', 'The customer was created in Conta.')
      onOpenChange(false)
    },
    onError: (e: any) => {
      toastError('Create failed', e?.message ?? 'Could not create in Conta.')
    },
  })

  const fetchFromContaMut = useMutation({
    mutationFn: async () => {
      if (
        !companyId ||
        !accountingConfig?.accounting_organization_id ||
        !checkResult?.contaCustomerId
      )
        throw new Error('Missing config or Conta customer ID')
      const res = await fetchAndSyncContaCustomer(
        companyId,
        accountingConfig.accounting_organization_id,
        customer.id,
        checkResult.contaCustomerId,
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
    onError: (e: any) => {
      toastError('Fetch failed', e?.message ?? 'Could not fetch from Conta.')
    },
  })

  const canCreateInConta =
    canCheck &&
    checkResult &&
    !checkResult.exists &&
    !checkResult.error &&
    customer.vat_number?.replace(/\D/g, '').trim().length >= 6

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="2" style={{ maxWidth: '420px' }}>
        <Dialog.Title>Check in Conta</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Check if this customer exists in your Conta accounting system.
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
                <Text size="2">Checking Conta...</Text>
              </Flex>
            ) : checkResult ? (
              <Box
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
                  <Flex direction="column" gap="2">
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium" color="green">
                        ✓ Customer found in Conta
                      </Text>
                      {checkResult.contaCustomerName && (
                        <Text size="1" color="gray">
                          {checkResult.contaCustomerName}
                        </Text>
                      )}
                      {checkResult.contaCustomerId && (
                        <Text size="1" color="gray">
                          Conta ID: {checkResult.contaCustomerId}
                        </Text>
                      )}
                      <Text size="1" color="gray">
                        Matched by organization number
                      </Text>
                    </Flex>
                    <Button
                      size="2"
                      variant="soft"
                      onClick={() => fetchFromContaMut.mutate()}
                      disabled={fetchFromContaMut.isPending}
                    >
                      {fetchFromContaMut.isPending ? (
                        <Spinner size="1" />
                      ) : (
                        <Download width={14} height={14} />
                      )}
                      Fetch data from Conta
                    </Button>
                  </Flex>
                ) : (
                  <Flex direction="column" gap="2">
                    <Text size="2" weight="medium">
                      Customer not found in Conta
                    </Text>
                    <Text size="1" color="gray">
                      Searched by organization number.
                    </Text>
                    {canCreateInConta && (
                      <Button
                        size="2"
                        onClick={() => createInContaMut.mutate()}
                        disabled={createInContaMut.isPending}
                      >
                        {createInContaMut.isPending ? (
                          <Spinner size="1" />
                        ) : (
                          <Plus width={14} height={14} />
                        )}
                        Create in Conta
                      </Button>
                    )}
                    {!canCreateInConta &&
                      !checkResult.error &&
                      (customer.vat_number?.replace(/\D/g, '').trim().length ?? 0) < 6 && (
                        <Text size="1" color="gray">
                          Add an organization number to create the customer in Conta.
                        </Text>
                      )}
                  </Flex>
                )}
              </Box>
            ) : null}

            {canCheck && (
              <Button
                variant="soft"
                size="2"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <Refresh width={14} height={14} />
                Check again
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
