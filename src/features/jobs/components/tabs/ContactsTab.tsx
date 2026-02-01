import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Table,
  Text,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { prettyPhone } from '@shared/phone/phone'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { CopyIconButton } from '@shared/lib/CopyIconButton'
import { Edit, NavArrowDown, Plus, Trash } from 'iconoir-react'
import AddContactDialog, {
  EditContactDialog,
} from '../dialogs/AddContactDialog'

const categoryColors = [
  'violet',
  'cyan',
  'orange',
  'red',
  'green',
  'yellow',
  'blue',
  'pink',
  'teal',
] as const

type CategoryColor = (typeof categoryColors)[number]

const getCategoryColor = (category: string): CategoryColor => {
  const normalized = category.trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % categoryColors.length
  }
  return categoryColors[Math.abs(hash) % categoryColors.length]
}

export default function ContactsTab({
  jobId,
  companyId,
}: {
  jobId: string
  companyId: string
}) {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [addOpen, setAddOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState<{
    link: any
    contact: any
  } | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
  const [pendingDeleteContactId, setPendingDeleteContactId] = React.useState<
    string | null
  >(null)
  const [pendingDeleteContactName, setPendingDeleteContactName] =
    React.useState<string>('')
  const [expandedContactId, setExpandedContactId] = React.useState<
    string | null
  >(null)

  // Fetch project lead
  const { data: projectLeadData } = useQuery({
    queryKey: ['jobs.project-lead', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          `project_lead_user_id, project_lead:project_lead_user_id ( user_id, display_name, email, phone )`,
        )
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
      return data as {
        project_lead_user_id: string | null
        project_lead?: {
          user_id: string
          display_name: string | null
          email: string
          phone: string | null
        } | null
      } | null
    },
    enabled: !!jobId,
  })

  // Fetch customer main contact (same as in OverviewTab)
  const { data: customerContactData } = useQuery({
    queryKey: ['jobs.customer-contact', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          `
          customer_contact_id,
          customer_contact:customer_contact_id ( id, name, email, phone, title )
        `,
        )
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
      return data as {
        customer_contact_id: string | null
        customer_contact?: {
          id: string
          name: string | null
          email: string | null
          phone: string | null
          title: string | null
        } | null
      } | null
    },
    enabled: !!jobId,
  })

  const { data } = useQuery({
    queryKey: ['jobs.contacts', jobId],
    queryFn: async () => {
      const [{ data: jc, error: e1 }, { data: res, error: e2 }] =
        await Promise.all([
          supabase
            .from('job_contacts')
            .select(
              `
            contact_id, role, notes,
            contact:contact_id ( id, name, email, phone, title, company_text )
          `,
            )
            .eq('job_id', jobId),
          supabase
            .from('time_periods')
            .select('id, title, role_category')
            .eq('job_id', jobId)
            .eq('category', 'crew'),
        ])
      if (e1) throw e1
      if (e2) throw e2
      const resIds =
        (res as Array<{ id: string }> | null)?.map((r) => r.id) ?? []
      const roleByTimePeriodId = new Map<string, { title: string; category: string | null }>()
      for (const tp of (res as Array<{
        id: string
        title: string | null
        role_category: string | null
      }> | null) ?? []) {
        roleByTimePeriodId.set(tp.id, {
          title: tp.title ?? '—',
          category: tp.role_category ?? null,
        })
      }

      let crew: Array<{
        name: string
        email: string
        phone: string | null
        roles: Array<string>
        categories: Array<string>
      }> = []
      if (resIds.length) {
        const { data: rows, error } = await supabase
          .from('reserved_crew')
          .select(
            'time_period_id, status, placeholder_name, user_id, user:user_id ( display_name, email, phone )',
          )
          .eq('status', 'confirmed')
          .in('time_period_id', resIds)
        if (error) throw error
        const uniq = new Map<
          string,
          {
            name: string
            email: string
            phone: string | null
            roles: Set<string>
            categories: Set<string>
          }
        >()
        for (const r of rows as Array<any>) {
          const key =
            (r.user_id as string | null) ??
            (r.placeholder_name as string | null) ??
            (r.id as string)
          const role =
            roleByTimePeriodId.get(r.time_period_id as string) ?? null
          const roleTitle = role?.title ?? '—'
          const roleCategory = role?.category ?? null

          const existing = uniq.get(key)
          if (existing) {
            if (roleTitle) existing.roles.add(roleTitle)
            if (roleCategory) existing.categories.add(roleCategory)
            continue
          }

          uniq.set(key, {
            name: r.user?.display_name ?? r.placeholder_name ?? '—',
            email: r.user?.email ?? '—',
            phone: r.user?.phone ?? null,
            roles: new Set(roleTitle ? [roleTitle] : []),
            categories: new Set(roleCategory ? [roleCategory] : []),
          })
        }
        crew = Array.from(uniq.values()).map((v) => ({
          name: v.name,
          email: v.email,
          phone: v.phone,
          roles: Array.from(v.roles),
          categories: Array.from(v.categories),
        }))
      }
      return { jobContacts: jc, crew }
    },
  })

  const deleteContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('job_contacts')
        .delete()
        .eq('job_id', jobId)
        .eq('contact_id', contactId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.contacts', jobId] })
      success('Deleted', 'Contact removed from job')
      setDeleteConfirmOpen(false)
      setPendingDeleteContactId(null)
      setPendingDeleteContactName('')
    },
    onError: (e: any) =>
      toastError('Failed to delete', e?.message ?? 'Please try again.'),
  })

  return (
    <Box>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Heading size="3">Contacts</Heading>
        {!isReadOnly && (
          <Button size="2" onClick={() => setAddOpen(true)}>
            <Plus /> Add contact
          </Button>
        )}

        <AddContactDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          jobId={jobId}
          companyId={companyId}
        />

        {editOpen && (
          <EditContactDialog
            open={!!editOpen}
            onOpenChange={(v) => !v && setEditOpen(null)}
            jobId={jobId}
            link={editOpen.link}
            contact={editOpen.contact}
          />
        )}
      </div>

      <Heading size="2" mb="2">
        Project lead
      </Heading>
      {projectLeadData?.project_lead ? (
        <Box
          p="3"
          mb="4"
          style={{
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            background: 'var(--gray-a2)',
          }}
        >
          <Grid columns="2" gap="3">
            <Box>
              <Flex direction="column" gap="0">
                <Text size="1" color="gray" mb="1">
                  Name
                </Text>
                <Text size="2" weight="medium">
                  {projectLeadData.project_lead.display_name ?? '—'}
                </Text>
              </Flex>
            </Box>
            <Box>
              <Flex direction="column" gap="0">
                <Text size="1" color="gray" mb="1">
                  Email
                </Text>
                {projectLeadData.project_lead.email ? (
                  <a
                    href={`mailto:${projectLeadData.project_lead.email}`}
                    style={{
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <Text size="2">{projectLeadData.project_lead.email}</Text>
                  </a>
                ) : (
                  <Text size="2">—</Text>
                )}
              </Flex>
            </Box>
            {projectLeadData.project_lead.phone && (
              <Box style={{ gridColumn: 'span 2' }}>
                <Text size="1" color="gray" mb="1">
                  Phone
                </Text>
                <Flex align="center" gap="2">
                  <a
                    href={`tel:${projectLeadData.project_lead.phone}`}
                    style={{
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <Text size="2">
                      {prettyPhone(projectLeadData.project_lead.phone)}
                    </Text>
                  </a>
                  <CopyIconButton text={projectLeadData.project_lead.phone} />
                </Flex>
              </Box>
            )}
          </Grid>
        </Box>
      ) : (
        <Text size="2" color="gray" mb="4">
          No project lead assigned
        </Text>
      )}

      <Heading size="2" mb="2" mt="4">
        Customer main contact
      </Heading>
      {customerContactData?.customer_contact ? (
        <Box
          p="3"
          mb="4"
          style={{
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            background: 'var(--gray-a2)',
          }}
        >
          <Grid columns="2" gap="3">
            <Box>
              <Flex direction="column" gap="0">
                <Text size="1" color="gray" mb="1">
                  Name
                </Text>
                <Text size="2" weight="medium">
                  {customerContactData.customer_contact.name ?? '—'}
                </Text>
                {customerContactData.customer_contact.title && (
                  <Text size="1" color="gray">
                    {customerContactData.customer_contact.title}
                  </Text>
                )}
              </Flex>
            </Box>
            <Box>
              <Flex direction="column" gap="0">
                <Text size="1" color="gray" mb="1">
                  Email
                </Text>
                {customerContactData.customer_contact.email ? (
                  <a
                    href={`mailto:${customerContactData.customer_contact.email}`}
                    style={{
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <Text size="2">{customerContactData.customer_contact.email}</Text>
                  </a>
                ) : (
                  <Text size="2">—</Text>
                )}
              </Flex>
            </Box>
            {customerContactData.customer_contact.phone && (
              <Box style={{ gridColumn: 'span 2' }}>
                <Text size="1" color="gray" mb="1">
                  Phone
                </Text>
                <Flex align="center" gap="2">
                  <a
                    href={`tel:${customerContactData.customer_contact.phone}`}
                    style={{
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <Text size="2">
                      {prettyPhone(customerContactData.customer_contact.phone)}
                    </Text>
                  </a>
                  <CopyIconButton text={customerContactData.customer_contact.phone} />
                </Flex>
              </Box>
            )}
          </Grid>
        </Box>
      ) : (
        <Text size="2" color="gray" mb="4">
          No customer contact set
        </Text>
      )}

      <Heading size="2" mb="2" mt="4">
        From job
      </Heading>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Company</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.jobContacts ?? []).map((r: any) => {
            const isExpanded = expandedContactId === r.contact_id
            return (
              <React.Fragment key={r.contact_id}>
                <Table.Row
                  style={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => {
                    setExpandedContactId(isExpanded ? null : r.contact_id)
                  }}
                >
                  <Table.Cell>{r.contact?.name ?? '—'}</Table.Cell>
                  <Table.Cell>{r.contact?.company_text ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <Flex align="center" justify="between" width="100%">
                      <Text>{r.role ?? '—'}</Text>
                      <NavArrowDown
                        width={16}
                        height={16}
                        style={{
                          transform: isExpanded
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                          color: 'var(--gray-11)',
                          flexShrink: 0,
                        }}
                      />
                    </Flex>
                  </Table.Cell>
                </Table.Row>
                {isExpanded && (
                  <Table.Row>
                    <Table.Cell colSpan={3}>
                      <Box py="3" px="2">
                        <Grid columns="2" gap="3">
                          <Box>
                            <Text size="1" color="gray" mb="1">
                              Email
                            </Text>
                            <Text size="2">
                              {r.contact?.email ? (
                                <a
                                  href={`mailto:${r.contact.email}`}
                                  style={{
                                    color: 'inherit',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {r.contact.email}
                                </a>
                              ) : (
                                '—'
                              )}
                            </Text>
                          </Box>
                          <Box>
                            <Text size="1" color="gray" mb="1">
                              Phone
                            </Text>
                            {r.contact?.phone ? (
                              <Flex align="center" gap="2">
                                <a
                                  href={`tel:${r.contact.phone}`}
                                  style={{
                                    color: 'inherit',
                                    textDecoration: 'none',
                                  }}
                                >
                                  <Text size="2">
                                    {prettyPhone(r.contact.phone)}
                                  </Text>
                                </a>
                                <CopyIconButton text={r.contact.phone} />
                              </Flex>
                            ) : (
                              <Text size="2">—</Text>
                            )}
                          </Box>
                          <Box>
                            <Text size="1" color="gray" mb="1">
                              Title
                            </Text>
                            <Text size="2">{r.contact?.title ?? '—'}</Text>
                          </Box>
                          <Box>
                            <Text size="1" color="gray" mb="1">
                              Company
                            </Text>
                            <Text size="2">
                              {r.contact?.company_text ?? '—'}
                            </Text>
                          </Box>
                          {r.notes && (
                            <Box style={{ gridColumn: 'span 2' }}>
                              <Text size="1" color="gray" mb="1">
                                Notes
                              </Text>
                              <Text size="2">{r.notes}</Text>
                            </Box>
                          )}
                        </Grid>
                        {!isReadOnly && (
                          <Flex gap="2" mt="3" justify="end">
                            <Button
                              size="2"
                              variant="soft"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditOpen({
                                  link: {
                                    contact_id: r.contact_id,
                                    role: r.role,
                                    notes: r.notes,
                                  },
                                  contact: r.contact,
                                })
                              }}
                            >
                              <Edit width={16} height={16} /> Edit
                            </Button>
                            <Button
                              size="2"
                              variant="soft"
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPendingDeleteContactId(r.contact_id)
                                setPendingDeleteContactName(
                                  r.contact?.name ?? 'contact',
                                )
                                setDeleteConfirmOpen(true)
                              }}
                              disabled={deleteContact.isPending}
                            >
                              <Trash width={16} height={16} /> Remove
                            </Button>
                          </Flex>
                        )}
                      </Box>
                    </Table.Cell>
                  </Table.Row>
                )}
              </React.Fragment>
            )
          })}
          {(data?.jobContacts ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={3}>
                <Text color="gray">No job contacts</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>

      {/* Delete confirmation dialog */}
      <AlertDialog.Root
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Remove contact from job?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will remove <b>{pendingDeleteContactName}</b> from this job.
            The contact will still exist in your contacts list.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft" disabled={deleteContact.isPending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                variant="solid"
                onClick={() => {
                  if (pendingDeleteContactId) {
                    deleteContact.mutate(pendingDeleteContactId)
                  }
                }}
                disabled={deleteContact.isPending || !pendingDeleteContactId}
              >
                {deleteContact.isPending ? 'Removing…' : 'Yes, remove'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <Heading size="2" mb="2" mt="4">
        Crew involved
      </Heading>
      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Phone</Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {(data?.crew ?? []).map((c, i) => (
            <Table.Row key={i}>
              <Table.Cell>{c.name}</Table.Cell>
              <Table.Cell>
                {c.categories.length ? (
                  <Flex gap="1" wrap="wrap">
                    {c.categories.map((cat) => (
                      <Badge
                        key={cat}
                        size="1"
                        variant="outline"
                        color={getCategoryColor(cat)}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {cat}
                      </Badge>
                    ))}
                  </Flex>
                ) : (
                  '—'
                )}
              </Table.Cell>
              <Table.Cell>{c.roles.length ? c.roles.join(', ') : '—'}</Table.Cell>
              <Table.Cell>
                {c.email && c.email !== '—' ? (
                  <a href={`mailto:${c.email}`} style={{ color: 'inherit' }}>
                    {c.email}
                  </a>
                ) : (
                  '—'
                )}
              </Table.Cell>
              <Table.Cell>
                {c.phone ? (
                  <Flex align="center" gap="2">
                    <a href={`tel:${c.phone}`} style={{ color: 'inherit' }}>
                      {prettyPhone(c.phone)}
                    </a>
                    <CopyIconButton text={c.phone} />
                  </Flex>
                ) : (
                  '—'
                )}
              </Table.Cell>
            </Table.Row>
          ))}
          {(data?.crew ?? []).length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={5}>
                <Text color="gray">No confirmed crew</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
