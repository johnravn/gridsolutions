// src/features/super/pages/SuperPage.tsx
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertDialog, Box, Button, Flex, Tabs, Text } from '@radix-ui/themes'
import { Plus } from 'iconoir-react'
import {
  getModShortcutLabel,
  useModKeyShortcut,
  useTabKeyboardScopeProps,
  useTabKeyboardShortcuts,
} from '@shared/lib/keyboardShortcuts'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { adminDeleteCompany, adminDeleteUser } from '../api/adminDeletes'
import CompaniesTable from '../components/CompaniesTable'
import CompanyDialog from '../components/CompanyDialog'
import CompanyInspector from '../components/CompanyInspector'
import UsersTable from '../components/UsersTable'
import UserDialog from '../components/UserDialog'
import UserInspector from '../components/UserInspector'
import SuperEmailTab from '../components/SuperEmailTab'
import SuperMonitorTab from '../components/SuperMonitorTab'
import SuperCalendarSubscriptionsTab from '../components/SuperCalendarSubscriptionsTab'
import MergeUsersDialog from '../components/MergeUsersDialog'
import { SuperMasterDetailSplit } from '../components/SuperMasterDetailSplit'
import { useLocalSplitPane } from '../hooks/useLocalSplitPane'
import { errorMessage } from '../lib/errorMessage'
import type { CompanyIndexRow } from '@features/company/api/queries'
import type { UserIndexRow } from '../api/queries'

const SUPER_TABS = [
  'monitor',
  'companies',
  'users',
  'calendar',
  'email',
] as const

export default function SuperPage() {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingCompany, setEditingCompany] =
    React.useState<CompanyIndexRow | null>(null)
  const [deletingCompany, setDeletingCompany] =
    React.useState<CompanyIndexRow | null>(null)

  const [userDialogOpen, setUserDialogOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserIndexRow | null>(
    null,
  )
  const [deletingUser, setDeletingUser] = React.useState<UserIndexRow | null>(
    null,
  )
  const [mergingUser, setMergingUser] = React.useState<UserIndexRow | null>(
    null,
  )

  const [activeTab, setActiveTab] = React.useState<string>('monitor')

  const handleTabChange = React.useCallback((tab: string) => {
    setActiveTab(tab)
    setSelectedId(null)
  }, [])

  const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
  useTabKeyboardShortcuts({
    scopeRef,
    tabs: SUPER_TABS,
    activeTab,
    onTabChange: handleTabChange,
  })

  const isLarge = useMediaQuery('(min-width: 1024px)')
  const companiesPane = useLocalSplitPane({ defaultWidthPercent: 40 })
  const usersPane = useLocalSplitPane({ defaultWidthPercent: 50 })

  const collapseShortcutLabel = getModShortcutLabel('B')
  const toggleCompaniesMinimize = companiesPane.toggleMinimize
  const toggleUsersMinimize = usersPane.toggleMinimize
  const toggleActiveMinimize = React.useCallback(() => {
    if (activeTab === 'companies') toggleCompaniesMinimize()
    else if (activeTab === 'users') toggleUsersMinimize()
  }, [activeTab, toggleCompaniesMinimize, toggleUsersMinimize])
  useModKeyShortcut({
    key: 'b',
    enabled: isLarge,
    onTrigger: toggleActiveMinimize,
  })

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

  const findCompany = React.useCallback(
    (id: string) => {
      const companies = qc.getQueryData<Array<CompanyIndexRow>>([
        'companies',
        'index',
      ])
      return companies?.find((c) => c.id === id) ?? null
    },
    [qc],
  )

  const findUser = React.useCallback(
    (id: string) => {
      const users = qc.getQueryData<Array<UserIndexRow>>(['users', 'index'])
      return users?.find((u) => u.user_id === id) ?? null
    },
    [qc],
  )

  const deleteMutation = useMutation({
    mutationFn: adminDeleteCompany,
    onMutate: async (companyId: string) => {
      if (selectedId === companyId) {
        setSelectedId(null)
      }
      await qc.removeQueries({ queryKey: ['company', companyId] })
    },
    onSuccess: () => {
      setDeletingCompany(null)
      success('Success!', 'Company was deleted')
      void Promise.all([
        qc.invalidateQueries({ queryKey: ['companies'] }),
        qc.invalidateQueries({ queryKey: ['company'] }),
      ])
    },
    onError: (e: unknown) => {
      toastError('Failed to delete company', errorMessage(e))
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: adminDeleteUser,
    onSuccess: () => {
      setDeletingUser(null)
      if (selectedId === deletingUser?.user_id) {
        setSelectedId(null)
      }
      success('Success!', 'User was deleted')
      void Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['users', 'detail'] }),
        qc.invalidateQueries({ queryKey: ['companies'] }),
        qc.invalidateQueries({ queryKey: ['company'] }),
      ])
    },
    onError: (e: unknown) => {
      toastError('Failed to delete user', errorMessage(e))
    },
  })

  const tabContentStyle = {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  } as const

  return (
    <section
      {...scopeProps}
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Tabs.Root
        defaultValue="monitor"
        value={activeTab}
        onValueChange={handleTabChange}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <AnimatedTabsList>
          <Tabs.Trigger value="monitor">Monitor</Tabs.Trigger>
          <Tabs.Trigger value="companies">Companies</Tabs.Trigger>
          <Tabs.Trigger value="users">Users</Tabs.Trigger>
          <Tabs.Trigger value="calendar">Calendar tokens</Tabs.Trigger>
          <Tabs.Trigger value="email">Email</Tabs.Trigger>
        </AnimatedTabsList>

        <Box
          pt="4"
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs.Content value="companies" style={tabContentStyle}>
            <SuperMasterDetailSplit
              isLarge={isLarge}
              title="Companies"
              collapseShortcutLabel={collapseShortcutLabel}
              pane={companiesPane}
              listHeaderActions={
                <Button onClick={handleCreate}>
                  <Plus width={16} height={16} />
                  Create
                </Button>
              }
              list={
                <CompaniesTable
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              }
              inspector={
                <CompanyInspector
                  id={selectedId}
                  onDeleted={() => setSelectedId(null)}
                  onEdit={() => {
                    if (!selectedId) return
                    const company = findCompany(selectedId)
                    if (company) {
                      setEditingCompany(company)
                      setDialogOpen(true)
                    }
                  }}
                  onDelete={() => {
                    if (!selectedId) return
                    const company = findCompany(selectedId)
                    if (company) setDeletingCompany(company)
                  }}
                />
              }
            />
          </Tabs.Content>

          <Tabs.Content value="users" style={tabContentStyle}>
            <SuperMasterDetailSplit
              isLarge={isLarge}
              title="Users"
              collapseShortcutLabel={collapseShortcutLabel}
              pane={usersPane}
              list={
                <UsersTable
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                />
              }
              inspector={
                <UserInspector
                  id={selectedId}
                  onDeleted={() => setSelectedId(null)}
                  onEdit={() => {
                    if (!selectedId) return
                    const user = findUser(selectedId)
                    if (user) {
                      setEditingUser(user)
                      setUserDialogOpen(true)
                    }
                  }}
                  onDelete={() => {
                    if (!selectedId) return
                    const user = findUser(selectedId)
                    if (user) setDeletingUser(user)
                  }}
                  onMerge={() => {
                    if (!selectedId) return
                    const user = findUser(selectedId)
                    if (user) setMergingUser(user)
                  }}
                />
              }
            />
          </Tabs.Content>

          <Tabs.Content value="calendar" style={tabContentStyle}>
            <SuperCalendarSubscriptionsTab />
          </Tabs.Content>

          <Tabs.Content value="email" style={tabContentStyle}>
            <SuperEmailTab />
          </Tabs.Content>

          <Tabs.Content value="monitor" style={tabContentStyle}>
            <SuperMonitorTab />
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      <CompanyDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingCompany(null)
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

      <UserDialog
        open={userDialogOpen}
        onOpenChange={(open) => {
          setUserDialogOpen(open)
          if (!open) setEditingUser(null)
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

      <MergeUsersDialog
        open={!!mergingUser}
        onOpenChange={(open) => {
          if (!open) setMergingUser(null)
        }}
        absorbUserId={mergingUser?.user_id ?? null}
        absorbLabel={
          mergingUser
            ? mergingUser.display_name ||
              [mergingUser.first_name, mergingUser.last_name]
                .filter(Boolean)
                .join(' ') ||
              mergingUser.email
            : null
        }
      />
    </section>
  )
}
