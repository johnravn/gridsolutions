import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { Refresh } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useRegisterShortcutAction } from '@shared/hotkeys'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import {
  MobileSplitSkeleton,
  MobileSplitView,
  useMobileInspectorDrawer,
} from '@app/layout/mobile'
import {
  SPLIT_LEFT_WIDTH,
  SplitPage,
  SplitPageSkeleton,
  useSplitLayout,
} from '@app/layout/split'
import { syncCustomersWithConta } from '../api/contaCustomerSync'
import CustomerTable from '../components/CustomerTable'
import CustomerInspector from '../components/CustomerInspector'
import { customersIndexQuery } from '../api/queries'

export default function CustomerPage() {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const { isLarge, hasSlots } = useSplitLayout()
  const createCustomerShortcutRef = React.useRef<(() => void) | null>(null)
  useRegisterShortcutAction(
    'create.customer',
    () => createCustomerShortcutRef.current?.(),
    canWrite,
  )
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      openDrawer()
    },
    [openDrawer],
  )

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
    enabled: !!companyId,
  })

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !accountingConfig?.accounting_organization_id)
        throw new Error('Accounting not configured')
      if (accountingConfig.accounting_software !== 'conta')
        throw new Error('Only Conta is supported')
      return syncCustomersWithConta(
        companyId,
        accountingConfig.accounting_organization_id,
      )
    },
    onSuccess: (res) => {
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'customer-detail'],
        exact: false,
      })
      qc.invalidateQueries({
        queryKey: ['company', companyId, 'customers-index'],
        exact: false,
      })
      const msg = [
        res.updated && `${res.updated} updated`,
        res.created && `${res.created} created in Conta`,
        res.skipped && `${res.skipped} skipped`,
      ]
        .filter(Boolean)
        .join(', ')
      success('Sync complete', msg || 'No changes.')
      if (res.errors.length > 0) {
        toastError('Some errors', res.errors.slice(0, 3).join('; '))
      }
    },
    onError: (e: unknown) => {
      const message = e instanceof Error ? e.message : 'Please try again.'
      toastError('Sync failed', message)
    },
  })

  const { isLoading: customersIndexLoading } = useQuery({
    ...customersIndexQuery({
      companyId: companyId ?? '__none__',
      search: '',
      showRegular: true,
      showPartner: true,
    }),
    enabled: !!companyId,
  })
  const showInitialSkeleton = useInitialPageLoad(customersIndexLoading)

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.customers}
        title="Customers"
      />
    )
  }

  if (showInitialSkeleton && !isLarge) return <MobileSplitSkeleton />

  if (showInitialSkeleton && !hasSlots) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.customers}
        title="Customers"
      />
    )
  }

  const syncButton =
    accountingConfig?.accounting_software === 'conta' &&
    accountingConfig.accounting_organization_id ? (
      <Button
        size="2"
        variant="soft"
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
      >
        <Refresh width={14} height={14} />
        {syncMutation.isPending ? 'Syncing…' : 'Sync with Conta'}
      </Button>
    ) : null

  const table = (
    <CustomerTable
      createShortcutRef={createCustomerShortcutRef}
      selectedId={selectedId}
      onSelect={isLarge ? setSelectedId : handleSelect}
      showRegular={true}
      showPartner={true}
      toolbarExtra={isLarge ? undefined : syncButton}
    />
  )

  const inspector = (
    <CustomerInspector id={selectedId} onDeleted={() => setSelectedId(null)} />
  )

  if (!isLarge) {
    return (
      <MobileSplitView
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onToggle={toggleDrawer}
        inspector={inspector}
      >
        {table}
      </MobileSplitView>
    )
  }

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.customers}
      title="Customers"
      leftToolbar={syncButton}
      left={table}
      leftBodyStyle={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      right={inspector}
    />
  )
}
