// src/features/super/components/CompanyInspector.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  Grid,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import { Edit, Plus, Trash } from 'iconoir-react'
import InspectorSkeleton from '@shared/ui/components/InspectorSkeleton'
import { companyDetailQuery } from '@features/company/api/queries'
import { fmtVAT } from '@shared/lib/generalFunctions'
import { prettyPhone } from '@shared/phone/phone'
import MapEmbed from '@shared/maps/MapEmbed'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  
  companyUsersQuery,
  removeUserFromCompany
} from '../api/queries'
import AssignUserToCompanyDialog from './AssignUserToCompanyDialog'
import type {CompanyUserRow} from '../api/queries';

export default function CompanyInspector({
  id,
  onDeleted,
  onEdit,
  onDelete,
}: {
  id: string | null
  onDeleted?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { data, isLoading, isError, error } = useQuery({
    ...companyDetailQuery({ companyId: id ?? '__none__' }),
    enabled: !!id,
  })

  const { data: companyUsers = [], isLoading: usersLoading } = useQuery({
    ...companyUsersQuery({ companyId: id ?? '__none__' }),
    enabled: !!id,
  })

  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [assignDialogOpen, setAssignDialogOpen] = React.useState(false)
  const [userToRemove, setUserToRemove] = React.useState<CompanyUserRow | null>(
    null,
  )

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!id) throw new Error('No company selected')
      return await removeUserFromCompany({ companyId: id, userId })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['companies', id, 'users'],
      })
      await qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'company' &&
          q.queryKey[1] === id &&
          q.queryKey[2] === 'crew-index',
      })
      setUserToRemove(null)
      success('Success!', 'User removed from company')
    },
    onError: (e: any) => {
      toastError('Failed to remove user', e?.message ?? 'Please try again.')
    },
  })

  // If query returns no data or error (company was deleted), clear selection
  React.useEffect(() => {
    if (id && !isLoading) {
      // Check if error is a "not found" or "single row" error (company was deleted)
      const errorMessage = (error as any)?.message || ''
      const isNotFoundError =
        errorMessage.includes('Cannot coerce') ||
        errorMessage.includes('JSON object') ||
        errorMessage.includes('No rows returned') ||
        errorMessage.includes('PGRST116')

      if ((!data && !isError) || (isError && isNotFoundError)) {
        onDeleted?.()
      }
    }
  }, [id, isLoading, data, isError, error, onDeleted])

  if (!id) return <Text color="gray">Select a company to view details.</Text>

  if (isLoading) return <InspectorSkeleton />

  // If error is a "not found" error (company was deleted), clear selection
  const errorMessage = (error as any)?.message || ''
  const isNotFoundError =
    errorMessage.includes('Cannot coerce') ||
    errorMessage.includes('JSON object') ||
    errorMessage.includes('No rows returned') ||
    errorMessage.includes('PGRST116')

  if (isError && isNotFoundError) {
    // Clear selection and show "select a company" message
    // The useEffect will handle clearing the id, but we need to render something now
    return <Text color="gray">Select a company to view details.</Text>
  }

  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )

  if (!data) return <Text color="gray">Not found.</Text>

  const company = data
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2" mb="3">
        <Text as="div" size="4" weight="bold">
          {company.name}
        </Text>
        <Flex gap="2" align="center">
          <Button
            size="2"
            variant="soft"
            onClick={() => {
              onEdit?.()
            }}
          >
            <Edit />
          </Button>
          <Button
            size="2"
            variant="surface"
            color="red"
            onClick={() => {
              onDelete?.()
            }}
          >
            <Trash />
          </Button>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* Company Details */}
      <Flex direction="column" gap="3">
        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            Company ID
          </Text>
          <Text size="2">{company.id}</Text>
        </div>

        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            Created
          </Text>
          <Text size="2">{fmtDate(company.created_at)}</Text>
        </div>

        <div>
          <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
            VAT number
          </Text>
          <Text size="2">{fmtVAT(company.vat_number)}</Text>
        </div>

        {company.general_email && (
          <div>
            <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
              General email
            </Text>
            <Text size="2">
              <a
                href={`mailto:${company.general_email}`}
                style={{ color: 'inherit' }}
              >
                {company.general_email}
              </a>
            </Text>
          </div>
        )}
      </Flex>

      <Separator my="3" />

      {/* Address section */}
      <Text as="div" size="2" weight="bold" mb="2">
        Address
      </Text>
      {company.address ? (
        (() => {
          // Parse the address string (stored as comma-separated: address_line, zip_code, city, country)
          const parts = company.address
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
          const parsed = {
            address_line: parts[0] || '',
            zip_code: parts[1] || '',
            city: parts[2] || '',
            country: parts[3] || '',
          }

          return (
            <Grid columns={{ initial: '1', sm: '2' }} gap="4" mb="3">
              {/* Left column: Address fields */}
              <Flex direction="column" gap="2">
                <div>
                  <Text
                    as="div"
                    size="1"
                    color="gray"
                    style={{ marginBottom: 4 }}
                  >
                    Street
                  </Text>
                  <Text size="2">{parsed.address_line || '—'}</Text>
                </div>
                <div>
                  <Text
                    as="div"
                    size="1"
                    color="gray"
                    style={{ marginBottom: 4 }}
                  >
                    City
                  </Text>
                  <Text size="2">
                    {parsed.zip_code || parsed.city
                      ? `${parsed.zip_code} ${parsed.city}`.trim() || '—'
                      : '—'}
                  </Text>
                </div>
                <div>
                  <Text
                    as="div"
                    size="1"
                    color="gray"
                    style={{ marginBottom: 4 }}
                  >
                    Country
                  </Text>
                  <Text size="2">{parsed.country || '—'}</Text>
                </div>
              </Flex>
              {/* Right column: Map */}
              <Box>
                <Text as="div" size="2" color="gray" mb="2">
                  Location
                </Text>
                <MapEmbed
                  query={company.address}
                  zoom={15}
                  style={{ maxWidth: '100%' }}
                />
              </Box>
            </Grid>
          )
        })()
      ) : (
        <Text size="2" color="gray" mb="3">
          No address on file
        </Text>
      )}

      <Separator my="3" />

      {/* Contact person section */}
      <Box>
        <Text as="div" size="2" weight="bold" mb="2">
          Contact person
        </Text>
        <Text as="div" size="1" color="gray" mb="3">
          For system owner to contact this company
        </Text>
        {company.contact_person ? (
          <Flex
            direction="column"
            gap="2"
            style={{
              padding: 12,
              background: 'var(--gray-a2)',
              borderRadius: 6,
            }}
          >
            <div>
              <Text as="div" size="2" weight="medium">
                {company.contact_person.display_name || 'No name'}
              </Text>
            </div>
            {company.contact_person.email && (
              <div>
                <Text
                  as="div"
                  size="1"
                  color="gray"
                  style={{ marginBottom: 2 }}
                >
                  Email
                </Text>
                <Text as="div" size="2">
                  <a
                    href={`mailto:${company.contact_person.email}`}
                    style={{ color: 'inherit' }}
                  >
                    {company.contact_person.email}
                  </a>
                </Text>
              </div>
            )}
            {company.contact_person.phone && (
              <div>
                <Text
                  as="div"
                  size="1"
                  color="gray"
                  style={{ marginBottom: 2 }}
                >
                  Phone
                </Text>
                <Text as="div" size="2">
                  <a
                    href={`tel:${company.contact_person.phone}`}
                    style={{ color: 'inherit' }}
                  >
                    {prettyPhone(company.contact_person.phone)}
                  </a>
                </Text>
              </div>
            )}
          </Flex>
        ) : (
          <Text size="2" color="gray">
            No contact person assigned
          </Text>
        )}
      </Box>

      <Separator my="3" />

      {/* Company Users Section */}
      <Box>
        <Flex align="center" justify="between" mb="2">
          <Text as="div" size="2" weight="bold">
            Company Users
          </Text>
          <Button
            size="2"
            variant="soft"
            onClick={() => setAssignDialogOpen(true)}
            disabled={!id}
          >
            <Plus width={14} height={14} />
            Add User
          </Button>
        </Flex>
        <Text as="div" size="1" color="gray" mb="3">
          Manage users and their roles in this company
        </Text>
        {usersLoading ? (
          <Text size="2" color="gray">
            Loading users...
          </Text>
        ) : companyUsers.length === 0 ? (
          <Text size="2" color="gray">
            No users assigned to this company
          </Text>
        ) : (
          <Table.Root variant="surface" size="1">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>User</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell
                  style={{ width: 80, textAlign: 'right' }}
                />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {companyUsers.map((user) => (
                <Table.Row key={user.user_id}>
                  <Table.Cell>
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium">
                        {user.display_name ||
                          [user.first_name, user.last_name]
                            .filter(Boolean)
                            .join(' ') ||
                          user.email}
                      </Text>
                      {user.display_name && (
                        <Text size="1" color="gray">
                          {user.email}
                        </Text>
                      )}
                      {user.superuser && (
                        <Badge size="1" color="purple" variant="soft">
                          Superuser
                        </Badge>
                      )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      size="1"
                      color={
                        user.role === 'owner'
                          ? 'purple'
                          : user.role === 'super_user'
                            ? 'blue'
                            : user.role === 'employee'
                              ? 'green'
                              : 'gray'
                      }
                    >
                      {user.role === 'super_user'
                        ? 'Super User'
                        : user.role.charAt(0).toUpperCase() +
                          user.role.slice(1)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Button
                      size="1"
                      variant="ghost"
                      color="red"
                      onClick={() => setUserToRemove(user)}
                      disabled={removeUserMutation.isPending}
                    >
                      <Trash width={14} height={14} />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Box>

      {/* Assign User Dialog */}
      <AssignUserToCompanyDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        companyId={id ?? ''}
        onAssigned={async () => {
          await qc.invalidateQueries({
            queryKey: ['companies', id, 'users'],
          })
          await qc.invalidateQueries({
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              q.queryKey[0] === 'company' &&
              q.queryKey[1] === id &&
              q.queryKey[2] === 'crew-index',
          })
        }}
      />

      {/* Remove User Confirmation */}
      {userToRemove && (
        <Box
          p="3"
          style={{
            border: '1px solid var(--red-a6)',
            borderRadius: 8,
            background: 'var(--red-a2)',
            marginTop: 16,
          }}
        >
          <Text size="2" weight="medium" mb="2">
            Remove {userToRemove.display_name || userToRemove.email}?
          </Text>
          <Text size="1" color="gray" mb="3">
            This will remove them from the company. They will lose access to
            company resources.
          </Text>
          <Flex gap="2">
            <Button
              size="2"
              variant="soft"
              onClick={() => setUserToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              size="2"
              variant="solid"
              color="red"
              onClick={() => {
                removeUserMutation.mutate(userToRemove.user_id)
              }}
              disabled={removeUserMutation.isPending}
            >
              {removeUserMutation.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </Flex>
        </Box>
      )}
    </Box>
  )
}
