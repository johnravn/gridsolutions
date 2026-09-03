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
import MatterList from '../components/MatterList'
import MatterDetail from '../components/MatterDetail'
import CreateMatterDialog from '../components/CreateMatterDialog'
import MattersFilter from '../components/MattersFilter'
import { mattersIndexQueryAll } from '../api/queries'
import type { MatterType } from '../types'

export default function MattersPage() {
  const { companyId } = useCompany()
  const { companyRole, isGlobalSuperuser, userId } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const { isLarge, hasSlots } = useSplitLayout()
  const canCreateAnnouncement =
    canWrite &&
    (companyRole === 'owner' || companyRole === 'employee' || isGlobalSuperuser)
  const search = useSearch({ strict: false })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const { drawerOpen, setDrawerOpen, openDrawer, toggleDrawer } =
    useMobileInspectorDrawer(isLarge)
  const [createMatterOpen, setCreateMatterOpen] = React.useState(false)
  useRegisterShortcutAction(
    'create.matter',
    () => setCreateMatterOpen(true),
    canCreateAnnouncement,
  )
  const [unreadFilter, setUnreadFilter] = React.useState(false)
  const [companyFilter, setCompanyFilter] = React.useState<Array<string>>([])
  const [typeFilter, setTypeFilter] = React.useState<Array<MatterType>>([])

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

  const openedFromUrlRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!search.matterId || isLarge) return
    if (openedFromUrlRef.current === search.matterId) return
    openedFromUrlRef.current = search.matterId
    openDrawer()
  }, [search.matterId, isLarge, openDrawer])

  const handleSelect = React.useCallback(
    (id: string | null) => {
      setSelectedId(id)
      if (id) openDrawer()
    },
    [openDrawer],
  )

  const { isLoading: mattersIndexLoading } = useQuery({
    ...mattersIndexQueryAll(userId),
  })
  const showInitialSkeleton = useInitialPageLoad(mattersIndexLoading)

  if (!companyId) {
    if (!isLarge) return <MobileSplitSkeleton />
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.matters}
        title="Matters"
        rightTitle="Detail"
      />
    )
  }

  if (showInitialSkeleton && !isLarge) return <MobileSplitSkeleton />

  if (showInitialSkeleton && !hasSlots) {
    return (
      <SplitPageSkeleton
        defaultLeftWidth={SPLIT_LEFT_WIDTH.matters}
        title="Matters"
        rightTitle="Detail"
      />
    )
  }

  const detail = selectedId ? (
    <MatterDetail matterId={selectedId} onDeleted={() => setSelectedId(null)} />
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

  const filter = (
    <MattersFilter
      unreadFilter={unreadFilter}
      onUnreadFilterChange={setUnreadFilter}
      companyFilter={companyFilter}
      onCompanyFilterChange={setCompanyFilter}
      typeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
      companies={companies || []}
    />
  )

  const list = (
    <MatterList
      selectedId={selectedId}
      onSelect={isLarge ? setSelectedId : handleSelect}
      unreadFilter={unreadFilter}
      onUnreadFilterChange={setUnreadFilter}
      companyFilter={companyFilter}
      typeFilter={typeFilter}
      companies={companies || []}
      onCreateMatter={() => setCreateMatterOpen(true)}
      toolbarExtra={isLarge ? undefined : filter}
    />
  )

  return (
    <>
      {isLarge ? (
        <SplitPage
          defaultLeftWidth={SPLIT_LEFT_WIDTH.matters}
          title="Matters"
          leftToolbar={filter}
          left={list}
          leftBodyStyle={{
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          rightTitle="Detail"
          right={detail}
        />
      ) : (
        <MobileSplitView
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onToggle={toggleDrawer}
          drawerTitle="Detail"
          inspector={detail}
        >
          {list}
        </MobileSplitView>
      )}
      <CreateMatterDialog
        open={createMatterOpen}
        onOpenChange={setCreateMatterOpen}
      />
    </>
  )
}
