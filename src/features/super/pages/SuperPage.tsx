// src/features/super/pages/SuperPage.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  IconButton,
  Separator,
  Tabs,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import { Plus, Sparks, TransitionLeft } from 'iconoir-react'
import {
  getModShortcutLabel,
  useModKeyShortcut,
} from '@shared/lib/keyboardShortcuts'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import CompaniesTable from '../components/CompaniesTable'
import CompanyDialog from '../components/CompanyDialog'
import CompanyInspector from '../components/CompanyInspector'
import UsersTable from '../components/UsersTable'
import UserDialog from '../components/UserDialog'
import UserInspector from '../components/UserInspector'
import { createDummyCompany } from '../api/queries'
import type { CompanyIndexRow } from '@features/company/api/queries'
import type { UserIndexRow } from '../api/queries'

export default function SuperPage() {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingCompany, setEditingCompany] =
    React.useState<CompanyIndexRow | null>(null)
  const [deletingCompany, setDeletingCompany] =
    React.useState<CompanyIndexRow | null>(null)

  // User-specific state
  const [userDialogOpen, setUserDialogOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserIndexRow | null>(
    null,
  )
  const [deletingUser, setDeletingUser] = React.useState<UserIndexRow | null>(
    null,
  )

  // Track active tab to clear selection when switching
  const [activeTab, setActiveTab] = React.useState<string>('companies')

  // match JobsPage behavior for responsive layout
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Resize state for Companies tab: default 40% for 2fr/3fr ratio
  const [companiesLeftWidth, setCompaniesLeftWidth] = React.useState<number>(40)
  const [isCompaniesMinimized, setIsCompaniesMinimized] = React.useState(false)
  const [companiesSavedWidth, setCompaniesSavedWidth] =
    React.useState<number>(40)
  const [isResizingCompanies, setIsResizingCompanies] = React.useState(false)
  const companiesContainerRef = React.useRef<HTMLDivElement>(null)

  // Resize state for Users tab: default 50% for 1fr/1fr ratio
  const [usersLeftWidth, setUsersLeftWidth] = React.useState<number>(50)
  const [isUsersMinimized, setIsUsersMinimized] = React.useState(false)
  const [usersSavedWidth, setUsersSavedWidth] = React.useState<number>(50)
  const [isResizingUsers, setIsResizingUsers] = React.useState(false)
  const usersContainerRef = React.useRef<HTMLDivElement>(null)

  const toggleCompaniesMinimize = React.useCallback(() => {
    if (isCompaniesMinimized) {
      setCompaniesLeftWidth(companiesSavedWidth || 40)
      setIsCompaniesMinimized(false)
    } else {
      setCompaniesSavedWidth(companiesLeftWidth)
      setIsCompaniesMinimized(true)
    }
  }, [companiesLeftWidth, companiesSavedWidth, isCompaniesMinimized])

  const handleCompaniesGlowingBarClick = React.useCallback(() => {
    if (isCompaniesMinimized) {
      setCompaniesLeftWidth(companiesSavedWidth || 40)
      setIsCompaniesMinimized(false)
    }
  }, [companiesSavedWidth, isCompaniesMinimized])

  const toggleUsersMinimize = React.useCallback(() => {
    if (isUsersMinimized) {
      setUsersLeftWidth(usersSavedWidth || 50)
      setIsUsersMinimized(false)
    } else {
      setUsersSavedWidth(usersLeftWidth)
      setIsUsersMinimized(true)
    }
  }, [isUsersMinimized, usersLeftWidth, usersSavedWidth])

  const handleUsersGlowingBarClick = React.useCallback(() => {
    if (isUsersMinimized) {
      setUsersLeftWidth(usersSavedWidth || 50)
      setIsUsersMinimized(false)
    }
  }, [isUsersMinimized, usersSavedWidth])

  const collapseShortcutLabel = getModShortcutLabel('B')
  const toggleActiveMinimize = React.useCallback(() => {
    if (activeTab === 'companies') toggleCompaniesMinimize()
    else toggleUsersMinimize()
  }, [activeTab, toggleCompaniesMinimize, toggleUsersMinimize])
  useModKeyShortcut({
    key: 'b',
    enabled: isLarge,
    onTrigger: toggleActiveMinimize,
  })

  // Handle mouse move for resizing Companies tab
  React.useEffect(() => {
    if (!isResizingCompanies) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!companiesContainerRef.current) return
      const containerRect =
        companiesContainerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const mouseX = e.clientX - containerRect.left
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )
      setCompaniesLeftWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizingCompanies(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingCompanies])

  // Handle mouse move for resizing Users tab
  React.useEffect(() => {
    if (!isResizingUsers) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!usersContainerRef.current) return
      const containerRect = usersContainerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width
      const mouseX = e.clientX - containerRect.left
      const minWidth = 25
      const maxWidth = 75
      const newWidthPercent = Math.max(
        minWidth,
        Math.min(maxWidth, (mouseX / containerWidth) * 100),
      )
      setUsersLeftWidth(newWidthPercent)
    }

    const handleMouseUp = () => {
      setIsResizingUsers(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingUsers])

  const handleCreate = () => {
    setEditingCompany(null)
    setDialogOpen(true)
  }

  const handleEdit = (company: CompanyIndexRow) => {
    setEditingCompany(company)
    setDialogOpen(true)
  }

  const handleDelete = (company: CompanyIndexRow) => {
    setDeletingCompany(company)
  }

  const handleEditUser = (user: UserIndexRow) => {
    setEditingUser(user)
    setUserDialogOpen(true)
  }

  const handleDeleteUser = (user: UserIndexRow) => {
    setDeletingUser(user)
  }

  const deleteMutation = useMutation({
    mutationFn: async (companyId: string) => {
      // Delete related records first to avoid foreign key constraint violations
      // Order matters: delete child records before parent records

      // 1. Delete reserved_items, reserved_crew, reserved_vehicles (depend on time_periods)
      // First, get all time_periods for this company's jobs
      const { data: timePeriods } = await supabase
        .from('time_periods')
        .select('id')
        .eq('company_id', companyId)

      const timePeriodIds = timePeriods?.map((tp) => tp.id) ?? []

      if (timePeriodIds.length > 0) {
        const { error: riError } = await supabase
          .from('reserved_items')
          .delete()
          .in('time_period_id', timePeriodIds)
        if (riError) throw riError

        const { error: rcError } = await supabase
          .from('reserved_crew')
          .delete()
          .in('time_period_id', timePeriodIds)
        if (rcError) throw rcError

        const { error: rvError } = await supabase
          .from('reserved_vehicles')
          .delete()
          .in('time_period_id', timePeriodIds)
        if (rvError) throw rvError
      }

      // 2. Get all jobs for this company first (needed for time_periods and job-related data)
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('company_id', companyId)

      const jobIds = jobs?.map((j) => j.id) ?? []

      // 3. Delete time_periods (depend on jobs and company_id)
      // Must delete before jobs to avoid broken foreign key references
      const { error: tpError } = await supabase
        .from('time_periods')
        .delete()
        .eq('company_id', companyId)
      if (tpError) throw tpError

      // 4. Delete job-related data (depend on jobs)
      if (jobIds.length > 0) {
        const { error: jnError } = await supabase
          .from('job_notes')
          .delete()
          .in('job_id', jobIds)
        if (jnError) throw jnError

        const { error: jfError } = await supabase
          .from('job_files')
          .delete()
          .in('job_id', jobIds)
        if (jfError) throw jfError

        const { error: jcError } = await supabase
          .from('job_contacts')
          .delete()
          .in('job_id', jobIds)
        if (jcError) throw jcError

        const { error: jshError } = await supabase
          .from('job_status_history')
          .delete()
          .in('job_id', jobIds)
        if (jshError) throw jshError

        const { error: jiError } = await supabase
          .from('job_invoices')
          .delete()
          .in('job_id', jobIds)
        if (jiError) throw jiError
      }

      // 5. Delete jobs (depend on company_id, customers, contacts, addresses)
      const { error: jobsError } = await supabase
        .from('jobs')
        .delete()
        .eq('company_id', companyId)
      if (jobsError) throw jobsError

      // 6. Delete contacts (depend on company_id and customers)
      const { error: contactsError } = await supabase
        .from('contacts')
        .delete()
        .eq('company_id', companyId)
      if (contactsError) throw contactsError

      // 7. Delete customers (depend on company_id)
      const { error: customersError } = await supabase
        .from('customers')
        .delete()
        .eq('company_id', companyId)
      if (customersError) throw customersError

      // 8. Delete addresses (depend on company_id)
      const { error: addressesError } = await supabase
        .from('addresses')
        .delete()
        .eq('company_id', companyId)
      if (addressesError) throw addressesError

      // 9. Delete vehicles (depend on company_id)
      const { error: vehiclesError } = await supabase
        .from('vehicles')
        .delete()
        .eq('company_id', companyId)
      if (vehiclesError) throw vehiclesError

      // 10. Delete group_price_history (depends on company_id and item_groups)
      // Note: item_groups will be cascade deleted, but we need to delete price history first
      const { error: gphError } = await supabase
        .from('group_price_history')
        .delete()
        .eq('company_id', companyId)
      if (gphError) throw gphError

      // 11. Set nullable foreign keys to null
      // profiles.selected_company_id
      const { error: profilesError } = await supabase
        .from('profiles')
        .update({ selected_company_id: null })
        .eq('selected_company_id', companyId)
      if (profilesError) throw profilesError

      // 12. Finally, delete the company
      // This will cascade delete:
      // - activity_log (ON DELETE CASCADE)
      // - company_expansions (ON DELETE CASCADE)
      // - company_users (ON DELETE CASCADE)
      // - item_brands (ON DELETE CASCADE)
      // - item_categories (ON DELETE CASCADE)
      // - item_groups (ON DELETE CASCADE)
      // - items (ON DELETE CASCADE)
      // - job_offers (ON DELETE CASCADE)
      // - matters (ON DELETE CASCADE)
      // - pending_invites (ON DELETE CASCADE)
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId)

      if (error) throw error
    },
    onMutate: async (companyId: string) => {
      // Clear the selected ID immediately to prevent the inspector from trying to load the deleted company
      if (selectedId === companyId) {
        setSelectedId(null)
      }
      // Remove the company from query cache to prevent loading attempts
      await qc.removeQueries({ queryKey: ['company', companyId] })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await qc.invalidateQueries({ queryKey: ['company'] })
      setDeletingCompany(null)
      success('Success!', 'Company was deleted')
    },
    onError: (e: any) => {
      toastError('Failed to delete company', e?.message ?? 'Please try again.')
    },
  })

  const createDummyCompanyMutation = useMutation({
    mutationFn: createDummyCompany,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await qc.invalidateQueries({ queryKey: ['company'] })
      success(
        'Dummy company created!',
        `Created "${result.companyName}" with ${result.itemsCreated} items, ${result.groupsCreated} groups, ${result.vehiclesCreated} vehicles, ${result.customersCreated} customers, and ${result.jobsCreated} jobs.`,
      )
    },
    onError: (e: any) => {
      toastError(
        'Failed to create dummy company',
        e?.message ?? 'Please try again.',
      )
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete related records first to avoid foreign key constraint violations
      // Order matters: delete child records before parent records

      // 1. Delete reserved_crew records (non-nullable foreign key)
      const { error: rcError } = await supabase
        .from('reserved_crew')
        .delete()
        .eq('user_id', userId)
      if (rcError) throw rcError

      // 2. Delete company_users records (user's company memberships)
      const { error: cuError } = await supabase
        .from('company_users')
        .delete()
        .eq('user_id', userId)
      if (cuError) throw cuError

      // 3. Delete matters created by the user first (created_by_user_id is NOT NULL)
      // This should cascade delete related records (matter_files, matter_messages, etc.)
      // if foreign keys are set up with CASCADE
      const { error: matError } = await supabase
        .from('matters')
        .delete()
        .eq('created_by_user_id', userId)
      if (matError) throw matError

      // 3b. Delete other matter-related records that reference the user
      // (These might not be cascade-deleted if the user is not the creator)
      const { error: mfError } = await supabase
        .from('matter_files')
        .delete()
        .eq('uploaded_by_user_id', userId)
      if (mfError) throw mfError

      const { error: mmError } = await supabase
        .from('matter_messages')
        .delete()
        .eq('user_id', userId)
      if (mmError) throw mmError

      const { error: mrError } = await supabase
        .from('matter_recipients')
        .delete()
        .eq('user_id', userId)
      if (mrError) throw mrError

      const { error: mrespError } = await supabase
        .from('matter_responses')
        .delete()
        .eq('user_id', userId)
      if (mrespError) throw mrespError

      // 4. Delete job_notes records
      const { error: jnError } = await supabase
        .from('job_notes')
        .delete()
        .eq('author_user_id', userId)
      if (jnError) throw jnError

      // 5. Set nullable foreign keys to null
      // These won't prevent deletion but should be cleaned up
      await supabase
        .from('job_files')
        .update({ uploaded_by_user_id: null })
        .eq('uploaded_by_user_id', userId)

      await supabase
        .from('jobs')
        .update({ project_lead_user_id: null })
        .eq('project_lead_user_id', userId)

      await supabase
        .from('companies')
        .update({ contact_person_id: null })
        .eq('contact_person_id', userId)

      await supabase
        .from('time_periods')
        .update({ reserved_by_user_id: null })
        .eq('reserved_by_user_id', userId)

      await supabase
        .from('time_periods')
        .update({ updated_by_user_id: null })
        .eq('updated_by_user_id', userId)

      // 6. Finally, delete from profiles table
      // Note: In production, you may want to also delete from auth.users via Admin API
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] })
      await qc.invalidateQueries({ queryKey: ['users', 'detail'] })
      await qc.invalidateQueries({ queryKey: ['companies'] })
      await qc.invalidateQueries({ queryKey: ['company'] })
      setDeletingUser(null)
      if (selectedId === deletingUser?.user_id) {
        setSelectedId(null)
      }
      success('Success!', 'User was deleted')
    },
    onError: (e: any) => {
      toastError('Failed to delete user', e?.message ?? 'Please try again.')
    },
  })

  return (
    <section
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Tabs.Root
        defaultValue="companies"
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab)
          setSelectedId(null) // Clear selection when switching tabs
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <Tabs.List>
          <Tabs.Trigger value="companies">Companies</Tabs.Trigger>
          <Tabs.Trigger value="users">Users</Tabs.Trigger>
        </Tabs.List>

        <Box
          pt="4"
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs.Content
            value="companies"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {!isLarge ? (
              <Grid
                columns="1fr"
                gap="4"
                align="stretch"
                style={{
                  height: isLarge ? '100%' : undefined,
                  minHeight: 0,
                  flex: isLarge ? 1 : undefined,
                }}
              >
                {/* LEFT: Companies table */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: isLarge ? '100%' : undefined,
                    minHeight: 0,
                  }}
                >
                  <Flex align="center" justify="between" mb="3">
                    <Heading size="5">Companies</Heading>
                    <Flex gap="2">
                      <Button
                        onClick={() => createDummyCompanyMutation.mutate()}
                        disabled={createDummyCompanyMutation.isPending}
                        variant="soft"
                        color="purple"
                      >
                        <Sparks width={16} height={16} />
                        {createDummyCompanyMutation.isPending
                          ? 'Creating...'
                          : 'Create Dummy'}
                      </Button>
                      <Button onClick={handleCreate}>
                        <Plus width={16} height={16} />
                        Create
                      </Button>
                    </Flex>
                  </Flex>
                  <Separator size="4" mb="3" />
                  <Box
                    style={{
                      flex: isLarge ? 1 : undefined,
                      minHeight: isLarge ? 0 : undefined,
                      overflowY: isLarge ? 'auto' : 'visible',
                    }}
                  >
                    <CompaniesTable
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </Box>
                </Card>

                {/* RIGHT: Inspector */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: isLarge ? '100%' : undefined,
                    maxHeight: isLarge ? '100%' : undefined,
                    overflow: isLarge ? 'hidden' : 'visible',
                    minHeight: 0,
                  }}
                >
                  <Heading size="5" mb="3">
                    Inspector
                  </Heading>
                  <Separator size="4" mb="3" />
                  <Box
                    style={{
                      flex: isLarge ? 1 : undefined,
                      minHeight: isLarge ? 0 : undefined,
                      overflowY: isLarge ? 'auto' : 'visible',
                    }}
                  >
                    <CompanyInspector
                      id={selectedId}
                      onDeleted={() => setSelectedId(null)}
                      onEdit={() => {
                        if (selectedId) {
                          const companies = qc.getQueryData<
                            Array<CompanyIndexRow>
                          >(['companies', 'index'])
                          const company = companies?.find(
                            (c) => c.id === selectedId,
                          )
                          if (company) {
                            setEditingCompany(company)
                            setDialogOpen(true)
                          }
                        }
                      }}
                      onDelete={() => {
                        if (selectedId) {
                          const companies = qc.getQueryData<
                            Array<CompanyIndexRow>
                          >(['companies', 'index'])
                          const company = companies?.find(
                            (c) => c.id === selectedId,
                          )
                          if (company) {
                            setDeletingCompany(company)
                          }
                        }
                      }}
                    />
                  </Box>
                </Card>
              </Grid>
            ) : (
              <Flex
                ref={companiesContainerRef}
                gap="2"
                align="stretch"
                style={{
                  height: isLarge ? '100%' : undefined,
                  minHeight: 0,
                  position: 'relative',
                  flex: isLarge ? 1 : undefined,
                }}
              >
                {/* LEFT: Companies table */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: isCompaniesMinimized
                      ? '60px'
                      : `${companiesLeftWidth}%`,
                    height: isLarge ? '100%' : undefined,
                    minWidth: isCompaniesMinimized ? '60px' : '300px',
                    maxWidth: isCompaniesMinimized ? '60px' : '75%',
                    minHeight: 0,
                    flexShrink: 0,
                    transition: isResizingCompanies
                      ? 'none'
                      : 'width 0.1s ease-out',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isCompaniesMinimized ? (
                    <Box
                      onClick={handleCompaniesGlowingBarClick}
                      onMouseEnter={(e) => {
                        const bar = e.currentTarget.querySelector(
                          '[data-glowing-bar]',
                        ) as HTMLElement
                        if (bar) bar.style.width = '24px'
                      }}
                      onMouseLeave={(e) => {
                        const bar = e.currentTarget.querySelector(
                          '[data-glowing-bar]',
                        ) as HTMLElement
                        if (bar) bar.style.width = '12px'
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        cursor: 'pointer',
                        zIndex: 1,
                      }}
                    >
                      <Box
                        data-glowing-bar
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '20px',
                          bottom: '20px',
                          transform: 'translateX(-50%)',
                          width: '12px',
                          borderRadius: '4px',
                          background:
                            'linear-gradient(180deg, var(--accent-9), var(--accent-6))',
                          pointerEvents: 'none',
                          zIndex: 5,
                          transition: 'all 0.2s ease-out',
                          animation: 'glow-pulse 5s ease-in-out infinite',
                        }}
                      />
                      <style>{`
                        @keyframes glow-pulse {
                          0%, 100% {
                            box-shadow: 0 0 8px var(--accent-a5), 0 0 12px var(--accent-a4);
                          }
                          50% {
                            box-shadow: 0 0 12px var(--accent-a6), 0 0 18px var(--accent-a5);
                          }
                        }
                      `}</style>
                    </Box>
                  ) : (
                    <>
                      <Flex align="center" justify="between" mb="3">
                        <Heading size="5">Companies</Heading>
                        <Flex align="center" gap="2">
                          <Flex gap="2">
                            <Button
                              onClick={() =>
                                createDummyCompanyMutation.mutate()
                              }
                              disabled={createDummyCompanyMutation.isPending}
                              variant="soft"
                              color="purple"
                            >
                              <Sparks width={16} height={16} />
                              {createDummyCompanyMutation.isPending
                                ? 'Creating...'
                                : 'Create Dummy'}
                            </Button>
                            <Button onClick={handleCreate}>
                              <Plus width={16} height={16} />
                              Create
                            </Button>
                          </Flex>
                          <Tooltip
                            content={`Collapse sidebar (${collapseShortcutLabel})`}
                          >
                            <IconButton
                              size="3"
                              variant="ghost"
                              onClick={toggleCompaniesMinimize}
                              style={{ flexShrink: 0 }}
                            >
                              <TransitionLeft width={22} height={22} />
                            </IconButton>
                          </Tooltip>
                        </Flex>
                      </Flex>
                      <Separator size="4" mb="3" />
                      <Box
                        style={{
                          flex: isLarge ? 1 : undefined,
                          minHeight: isLarge ? 0 : undefined,
                          overflowY: isLarge ? 'auto' : 'visible',
                        }}
                      >
                        <CompaniesTable
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      </Box>
                    </>
                  )}
                </Card>

                {/* RESIZER */}
                {!isCompaniesMinimized && (
                  <Box
                    className="section-resizer"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsResizingCompanies(true)
                    }}
                    style={{
                      width: '6px',
                      height: '20%',
                      cursor: 'col-resize',
                      backgroundColor: 'var(--gray-a4)',
                      borderRadius: '4px',
                      flexShrink: 0,
                      alignSelf: 'center',
                      userSelect: 'none',
                      margin: '0 -4px',
                      zIndex: 10,
                      transition: isResizingCompanies
                        ? 'none'
                        : 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isResizingCompanies) {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
                        e.currentTarget.style.cursor = 'col-resize'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isResizingCompanies) {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
                      }
                    }}
                  />
                )}

                {/* RIGHT: Inspector */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    height: isLarge ? '100%' : undefined,
                    maxHeight: isLarge ? '100%' : undefined,
                    overflow: isLarge ? 'hidden' : 'visible',
                    minWidth: '300px',
                    minHeight: 0,
                    transition: isResizingCompanies
                      ? 'none'
                      : 'flex-basis 0.1s ease-out',
                  }}
                >
                  <Heading size="5" mb="3">
                    Inspector
                  </Heading>
                  <Separator size="4" mb="3" />
                  <Box
                    style={{
                      flex: isLarge ? 1 : undefined,
                      minHeight: isLarge ? 0 : undefined,
                      overflowY: isLarge ? 'auto' : 'visible',
                    }}
                  >
                    <CompanyInspector
                      id={selectedId}
                      onDeleted={() => setSelectedId(null)}
                      onEdit={() => {
                        if (selectedId) {
                          const companies = qc.getQueryData<
                            Array<CompanyIndexRow>
                          >(['companies', 'index'])
                          const company = companies?.find(
                            (c) => c.id === selectedId,
                          )
                          if (company) {
                            setEditingCompany(company)
                            setDialogOpen(true)
                          }
                        }
                      }}
                      onDelete={() => {
                        if (selectedId) {
                          const companies = qc.getQueryData<
                            Array<CompanyIndexRow>
                          >(['companies', 'index'])
                          const company = companies?.find(
                            (c) => c.id === selectedId,
                          )
                          if (company) {
                            setDeletingCompany(company)
                          }
                        }
                      }}
                    />
                  </Box>
                </Card>
              </Flex>
            )}
          </Tabs.Content>

          <Tabs.Content
            value="users"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {!isLarge ? (
              <Grid
                columns="1fr"
                gap="4"
                align="stretch"
                style={{
                  height: isLarge ? '100%' : undefined,
                  minHeight: 0,
                  flex: isLarge ? 1 : undefined,
                }}
              >
                {/* LEFT: Users table */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: isLarge ? '100%' : undefined,
                    minHeight: 0,
                  }}
                >
                  <Flex align="center" justify="between" mb="3">
                    <Heading size="5">Users</Heading>
                  </Flex>
                  <Separator size="4" mb="3" />
                  <Box
                    style={{
                      flex: isLarge ? 1 : undefined,
                      minHeight: isLarge ? 0 : undefined,
                      overflowY: isLarge ? 'auto' : 'visible',
                    }}
                  >
                    <UsersTable
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onEdit={handleEditUser}
                      onDelete={handleDeleteUser}
                    />
                  </Box>
                </Card>

                {/* RIGHT: Inspector */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: isLarge ? '100%' : undefined,
                    maxHeight: isLarge ? '100%' : undefined,
                    overflow: isLarge ? 'hidden' : 'visible',
                    minHeight: 0,
                  }}
                >
                  <Heading size="5" mb="3">
                    Inspector
                  </Heading>
                  <Separator size="4" mb="3" />
                  <Box
                    style={{
                      flex: isLarge ? 1 : undefined,
                      minHeight: isLarge ? 0 : undefined,
                      overflowY: isLarge ? 'auto' : 'visible',
                    }}
                  >
                    <UserInspector
                      id={selectedId}
                      onDeleted={() => setSelectedId(null)}
                      onEdit={() => {
                        if (selectedId) {
                          const users = qc.getQueryData<Array<UserIndexRow>>([
                            'users',
                            'index',
                          ])
                          const user = users?.find(
                            (u) => u.user_id === selectedId,
                          )
                          if (user) {
                            setEditingUser(user)
                            setUserDialogOpen(true)
                          }
                        }
                      }}
                      onDelete={() => {
                        if (selectedId) {
                          const users = qc.getQueryData<Array<UserIndexRow>>([
                            'users',
                            'index',
                          ])
                          const user = users?.find(
                            (u) => u.user_id === selectedId,
                          )
                          if (user) {
                            setDeletingUser(user)
                          }
                        }
                      }}
                    />
                  </Box>
                </Card>
              </Grid>
            ) : (
              <Flex
                ref={usersContainerRef}
                gap="2"
                align="stretch"
                style={{
                  height: isLarge ? '100%' : undefined,
                  minHeight: 0,
                  position: 'relative',
                  flex: isLarge ? 1 : undefined,
                }}
              >
                {/* LEFT: Users table */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: isUsersMinimized ? '60px' : `${usersLeftWidth}%`,
                    height: isLarge ? '100%' : undefined,
                    minWidth: isUsersMinimized ? '60px' : '300px',
                    maxWidth: isUsersMinimized ? '60px' : '75%',
                    minHeight: 0,
                    flexShrink: 0,
                    transition: isResizingUsers
                      ? 'none'
                      : 'width 0.1s ease-out',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isUsersMinimized ? (
                    <Box
                      onClick={handleUsersGlowingBarClick}
                      onMouseEnter={(e) => {
                        const bar = e.currentTarget.querySelector(
                          '[data-glowing-bar]',
                        ) as HTMLElement
                        if (bar) bar.style.width = '24px'
                      }}
                      onMouseLeave={(e) => {
                        const bar = e.currentTarget.querySelector(
                          '[data-glowing-bar]',
                        ) as HTMLElement
                        if (bar) bar.style.width = '12px'
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        cursor: 'pointer',
                        zIndex: 1,
                      }}
                    >
                      <Box
                        data-glowing-bar
                        style={{
                          position: 'absolute',
                          left: '50%',
                          top: '20px',
                          bottom: '20px',
                          transform: 'translateX(-50%)',
                          width: '12px',
                          borderRadius: '4px',
                          background:
                            'linear-gradient(180deg, var(--accent-9), var(--accent-6))',
                          pointerEvents: 'none',
                          zIndex: 5,
                          transition: 'all 0.2s ease-out',
                          animation: 'glow-pulse 5s ease-in-out infinite',
                        }}
                      />
                      <style>{`
                        @keyframes glow-pulse {
                          0%, 100% {
                            box-shadow: 0 0 8px var(--accent-a5), 0 0 12px var(--accent-a4);
                          }
                          50% {
                            box-shadow: 0 0 12px var(--accent-a6), 0 0 18px var(--accent-a5);
                          }
                        }
                      `}</style>
                    </Box>
                  ) : (
                    <>
                      <Flex align="center" justify="between" mb="3">
                        <Heading size="5">Users</Heading>
                        <Tooltip
                          content={`Collapse sidebar (${collapseShortcutLabel})`}
                        >
                          <IconButton
                            size="3"
                            variant="ghost"
                            onClick={toggleUsersMinimize}
                            style={{ flexShrink: 0 }}
                          >
                            <TransitionLeft width={22} height={22} />
                          </IconButton>
                        </Tooltip>
                      </Flex>
                      <Separator size="4" mb="3" />
                      <Box
                        style={{
                          flex: isLarge ? 1 : undefined,
                          minHeight: isLarge ? 0 : undefined,
                          overflowY: isLarge ? 'auto' : 'visible',
                        }}
                      >
                        <UsersTable
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          onEdit={handleEditUser}
                          onDelete={handleDeleteUser}
                        />
                      </Box>
                    </>
                  )}
                </Card>

                {/* RESIZER */}
                {!isUsersMinimized && (
                  <Box
                    className="section-resizer"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsResizingUsers(true)
                    }}
                    style={{
                      width: '6px',
                      height: '20%',
                      cursor: 'col-resize',
                      backgroundColor: 'var(--gray-a4)',
                      borderRadius: '4px',
                      flexShrink: 0,
                      alignSelf: 'center',
                      userSelect: 'none',
                      margin: '0 -4px',
                      zIndex: 10,
                      transition: isResizingUsers
                        ? 'none'
                        : 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isResizingUsers) {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a6)'
                        e.currentTarget.style.cursor = 'col-resize'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isResizingUsers) {
                        e.currentTarget.style.backgroundColor = 'var(--gray-a4)'
                      }
                    }}
                  />
                )}

                {/* RIGHT: Inspector */}
                <Card
                  size="3"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    height: isLarge ? '100%' : undefined,
                    maxHeight: isLarge ? '100%' : undefined,
                    overflow: isLarge ? 'hidden' : 'visible',
                    minWidth: '300px',
                    minHeight: 0,
                    transition: isResizingUsers
                      ? 'none'
                      : 'flex-basis 0.1s ease-out',
                  }}
                >
                  <Heading size="5" mb="3">
                    Inspector
                  </Heading>
                  <Separator size="4" mb="3" />
                  <Box
                    style={{
                      flex: isLarge ? 1 : undefined,
                      minHeight: isLarge ? 0 : undefined,
                      overflowY: isLarge ? 'auto' : 'visible',
                    }}
                  >
                    <UserInspector
                      id={selectedId}
                      onDeleted={() => setSelectedId(null)}
                      onEdit={() => {
                        if (selectedId) {
                          const users = qc.getQueryData<Array<UserIndexRow>>([
                            'users',
                            'index',
                          ])
                          const user = users?.find(
                            (u) => u.user_id === selectedId,
                          )
                          if (user) {
                            setEditingUser(user)
                            setUserDialogOpen(true)
                          }
                        }
                      }}
                      onDelete={() => {
                        if (selectedId) {
                          const users = qc.getQueryData<Array<UserIndexRow>>([
                            'users',
                            'index',
                          ])
                          const user = users?.find(
                            (u) => u.user_id === selectedId,
                          )
                          if (user) {
                            setDeletingUser(user)
                          }
                        }
                      }}
                    />
                  </Box>
                </Card>
              </Flex>
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      {/* Create/Edit Dialog */}
      <CompanyDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingCompany(null)
          }
        }}
        mode={editingCompany ? 'edit' : 'create'}
        initialData={
          editingCompany
            ? {
                id: editingCompany.id,
                name: editingCompany.name,
                general_email: editingCompany.general_email,
                address: editingCompany.address,
                vat_number: editingCompany.vat_number,
                contact_person_id: editingCompany.contact_person_id,
              }
            : undefined
        }
        onSaved={() => {
          setDialogOpen(false)
          setEditingCompany(null)
          qc.invalidateQueries({ queryKey: ['companies'] })
          qc.invalidateQueries({ queryKey: ['company'] })
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog.Root
        open={!!deletingCompany}
        onOpenChange={(open) => {
          if (!open) setDeletingCompany(null)
        }}
      >
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Delete Company?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will permanently delete the company{' '}
            <b>{deletingCompany?.name}</b>. This action cannot be undone.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                variant="solid"
                color="red"
                onClick={() => {
                  if (deletingCompany) {
                    deleteMutation.mutate(deletingCompany.id)
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      {/* User Dialog */}
      <UserDialog
        open={userDialogOpen}
        onOpenChange={(open) => {
          setUserDialogOpen(open)
          if (!open) {
            setEditingUser(null)
          }
        }}
        initialData={
          editingUser
            ? {
                user_id: editingUser.user_id,
                email: editingUser.email,
                display_name: editingUser.display_name,
                first_name: editingUser.first_name,
                last_name: editingUser.last_name,
                phone: editingUser.phone,
                superuser: editingUser.superuser,
              }
            : undefined
        }
        onSaved={() => {
          setUserDialogOpen(false)
          setEditingUser(null)
          qc.invalidateQueries({ queryKey: ['users'] })
        }}
      />

      {/* Delete User Confirmation Dialog */}
      <AlertDialog.Root
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null)
        }}
      >
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Delete User?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            <Text as="div" mb="3">
              This will permanently delete the user{' '}
              <b>{deletingUser?.display_name || deletingUser?.email}</b>. This
              action cannot be undone.
            </Text>
            <Text as="div" color="red" weight="bold" size="2">
              Warning: Deleting a user will remove all their data including:
            </Text>
            <Box mt="2" ml="3">
              <Text as="div" size="2" color="gray">
                • Their profile and personal information
              </Text>
              <Text as="div" size="2" color="gray">
                • Company memberships and roles
              </Text>
              <Text as="div" size="2" color="gray">
                • Associated jobs, assignments, and work history
              </Text>
              <Text as="div" size="2" color="gray">
                • All other user-related data
              </Text>
            </Box>
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                variant="solid"
                color="red"
                onClick={() => {
                  if (deletingUser) {
                    deleteUserMutation.mutate(deletingUser.user_id)
                  }
                }}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </section>
  )
}
