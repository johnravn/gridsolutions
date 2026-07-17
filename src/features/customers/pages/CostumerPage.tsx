import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { Refresh } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useRegisterShortcutAction } from '@shared/hotkeys'
import ScrollToTopButton from '@shared/ui/components/ScrollToTopButton'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import { SPLIT_LEFT_WIDTH, SplitPage, SplitPageSkeleton, useSplitLayout } from '@app/layout/split'
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
  const inspectorRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLElement>(null)

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
      const message =
        e instanceof Error ? e.message : 'Please try again.'
      toastError('Sync failed', message)
    },
  })

  React.useEffect(() => {
    if (!isLarge && selectedId != null && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }, [isLarge, selectedId])

  const clearSelection = React.useCallback(() => {
    setSelectedId(null)
  }, [])

  useMobileDetailBack(!isLarge, selectedId != null, clearSelection)

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

  if (!companyId || (showInitialSkeleton && !hasSlots)) {
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

  return (
    <SplitPage
      defaultLeftWidth={SPLIT_LEFT_WIDTH.customers}
      title="Customers"
      leftToolbar={syncButton}
      left={
        <CustomerTable
          createShortcutRef={createCustomerShortcutRef}
          selectedId={selectedId}
          onSelect={setSelectedId}
          showRegular={true}
          showPartner={true}
        />
      }
      leftBodyStyle={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      right={
        <CustomerInspector
          id={selectedId}
          onDeleted={() => setSelectedId(null)}
        />
      }
      mobileLeftCardStyle={{ height: MOBILE_CARD_HEIGHT, minWidth: 0 }}
      mobileLeftBodyStyle={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      mobileRightCardStyle={{
        height: MOBILE_CARD_HEIGHT,
        overflow: 'hidden',
        maxWidth: '100%',
      }}
      mobileRightBodyStyle={{
        overflowY: 'auto',
        overflowX: 'hidden',
        minWidth: 0,
        maxWidth: '100%',
      }}
      mobileSectionRef={listRef}
      mobileRightWrapper={(card) => (
        <div
          ref={inspectorRef}
          style={{
            minHeight: 0,
            minWidth: 0,
            maxWidth: '100%',
            width: '100%',
            height: MOBILE_CARD_HEIGHT,
            overflow: 'hidden',
          }}
        >
          {card}
        </div>
      )}
      mobileFooter={
        <ScrollToTopButton
          listRef={listRef}
          inspectorRef={inspectorRef}
          visible={!isLarge && selectedId != null}
        />
      }
    />
  )
}
