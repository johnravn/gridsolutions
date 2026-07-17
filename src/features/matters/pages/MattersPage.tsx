import * as React from 'react'
import { Box, Heading } from '@radix-ui/themes'
import { useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useAuthz } from '@shared/auth/useAuthz'
import { useRegisterShortcutAction } from '@shared/hotkeys'
import { useInitialPageLoad } from '@shared/ui/hooks/useInitialPageLoad'
import ScrollToTopButton from '@shared/ui/components/ScrollToTopButton'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'
import { useMobileDetailBack } from '@app/hooks/useMobileDetailBack'
import { SPLIT_LEFT_WIDTH, SplitPage, SplitPageSkeleton, useSplitLayout } from '@app/layout/split'
import MatterList from '../components/MatterList'
import MatterDetail from '../components/MatterDetail'
import CreateMatterDialog from '../components/CreateMatterDialog'
import MattersFilter from '../components/MattersFilter'
import { mattersIndexQueryAll } from '../api/queries'
import type { MatterType } from '../types'

export default function MattersPage() {
  const { companyId } = useCompany()
  const { companyRole, isGlobalSuperuser } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const { isLarge, hasSlots } = useSplitLayout()
  const canCreateAnnouncement =
    canWrite &&
    (companyRole === 'owner' || companyRole === 'employee' || isGlobalSuperuser)
  const search = useSearch({ strict: false })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createMatterOpen, setCreateMatterOpen] = React.useState(false)
  useRegisterShortcutAction(
    'create.matter',
    () => setCreateMatterOpen(true),
    canCreateAnnouncement,
  )
  const [unreadFilter, setUnreadFilter] = React.useState(false)
  const [companyFilter, setCompanyFilter] = React.useState<Array<string>>([])
  const [typeFilter, setTypeFilter] = React.useState<Array<MatterType>>([])
  const inspectorRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLElement>(null)

  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => (await supabase.auth.getUser()).data.user ?? null,
  })

  const { data: companies } = useQuery({
    queryKey: ['my-companies', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('superuser')
        .eq('user_id', user!.id)
        .maybeSingle()

      const isSuperuser = profile?.superuser ?? false

      if (isSuperuser) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name')
          .order('name', { ascending: true })
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('company_users')
          .select('companies ( id, name )')
          .eq('user_id', user!.id)
        if (error) throw error
        return (data as Array<{ companies: { id: string; name: string } }>)
          .map((r) => r.companies)
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name))
      }
    },
  })

  React.useEffect(() => {
    if (search.matterId) {
      setSelectedId(search.matterId)
    }
  }, [search.matterId])

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

  const { isLoading: mattersIndexLoading } = useQuery({
    ...mattersIndexQueryAll(),
  })
  const showInitialSkeleton = useInitialPageLoad(mattersIndexLoading)

  if (!companyId || (showInitialSkeleton && !hasSlots)) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.matters}
        title="Matters"
        rightTitle="Detail"
      />
    )
  }

  const detail = selectedId ? (
    <MatterDetail
      matterId={selectedId}
      onDeleted={() => setSelectedId(null)}
    />
  ) : (
    <Box p="4">
      <Box style={{ textAlign: 'center' }}>
        <Heading size="4" mb="2">
          Select a matter
        </Heading>
        <p style={{ color: 'var(--gray-11)' }}>
          Choose a matter from the list to read announcements, automatic
          updates, and invitations.
        </p>
      </Box>
    </Box>
  )

  return (
    <>
      <SplitPage
        defaultLeftWidth={SPLIT_LEFT_WIDTH.matters}
        title="Matters"
        leftToolbar={
          <MattersFilter
            unreadFilter={unreadFilter}
            onUnreadFilterChange={setUnreadFilter}
            companyFilter={companyFilter}
            onCompanyFilterChange={setCompanyFilter}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            companies={companies || []}
          />
        }
        left={
          <MatterList
            selectedId={selectedId}
            onSelect={setSelectedId}
            unreadFilter={unreadFilter}
            companyFilter={companyFilter}
            typeFilter={typeFilter}
            companies={companies || []}
            onCreateMatter={() => setCreateMatterOpen(true)}
          />
        }
        leftBodyStyle={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        rightTitle="Detail"
        right={detail}
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
        mobileSectionRef={listRef}
        mobileRightWrapper={(card) => (
          <div
            ref={inspectorRef}
            style={{
              minHeight: 0,
              maxWidth: '100%',
              width: '100%',
              height: MOBILE_CARD_HEIGHT,
            }}
          >
            {card}
          </div>
        )}
        mobileFooter={
          <ScrollToTopButton
            listRef={listRef}
            inspectorRef={inspectorRef}
            visible={!isLarge}
          />
        }
      />
      <CreateMatterDialog
        open={createMatterOpen}
        onOpenChange={setCreateMatterOpen}
      />
    </>
  )
}
