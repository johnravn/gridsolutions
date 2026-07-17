import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Grid,
  Text,
  TextField,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Xmark } from 'iconoir-react'
import { createMatter } from '../api/queries'

type CompanyRole = 'owner' | 'employee' | 'freelancer' | 'super_user'
type PersonWithRole = {
  user_id: string
  display_name: string | null
  email: string
  role: CompanyRole | null
}

const defaultValues = {
  title: '',
  content: '',
  createdAsCompany: false,
}

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  content: z.string(),
  createdAsCompany: z.boolean(),
})

export default function CreateMatterDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { companyId } = useCompany()
  const { companyRole, isGlobalSuperuser } = useAuthz()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [search, setSearch] = React.useState('')
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [selectedFiles, setSelectedFiles] = React.useState<Array<File>>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      if (selectedIds.size === 0) {
        toastError(
          'Failed to create matter',
          'Please select at least one recipient',
        )
        return
      }
      await create.mutateAsync(value)
    },
  })

  // Responsive layout
  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : false,
  )

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  // Check if user can see group selection buttons (any company member)
  const canUseGroupSelection = !!companyRole

  // Search for users in the company with their roles
  const { data: people = [], isFetching } = useQuery({
    queryKey: ['company-users-with-roles', companyId, search],
    enabled: open && !!companyId,
    queryFn: async () => {
      if (!companyId) return []

      // Use company_user_profiles view which includes role
      let q = supabase
        .from('company_user_profiles')
        .select('user_id, display_name, email, role')
        .eq('company_id', companyId)
        .limit(50)

      if (search.trim()) {
        q = q.or(
          `display_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`,
        )
      }

      const { data, error } = await q
      if (error) throw error
      return data as Array<PersonWithRole>
    },
  })

  // Group users by role for easy selection
  const usersByRole = React.useMemo(() => {
    const groups: Record<string, Array<PersonWithRole>> = {
      employee: [],
      owner: [],
      freelancer: [],
      super_user: [],
      other: [],
    }

    for (const person of people) {
      const role = person.role
      if (role) {
        if (role in groups) {
          groups[role].push(person)
        } else {
          groups.other.push(person)
        }
      } else {
        groups.other.push(person)
      }
    }

    return groups
  }, [people])

  // Get all employees (includes owners and super_users)
  const allEmployees = React.useMemo(() => {
    return [
      ...usersByRole.employee,
      ...usersByRole.owner,
      ...usersByRole.super_user,
    ]
  }, [usersByRole])

  const allFreelancers = React.useMemo(() => {
    return usersByRole.freelancer
  }, [usersByRole])

  // Check if all employees are selected
  const allEmployeesSelected = React.useMemo(() => {
    if (allEmployees.length === 0) return false
    return allEmployees.every((p) => selectedIds.has(p.user_id))
  }, [allEmployees, selectedIds])

  // Check if all freelancers are selected
  const allFreelancersSelected = React.useMemo(() => {
    if (allFreelancers.length === 0) return false
    return allFreelancers.every((p) => selectedIds.has(p.user_id))
  }, [allFreelancers, selectedIds])

  // Check if all users are selected
  const allSelected = React.useMemo(() => {
    if (people.length === 0) return false
    return people.every((p) => selectedIds.has(p.user_id))
  }, [people, selectedIds])

  // Toggle employees selection (add if not all selected, remove all if all selected)
  const toggleEmployees = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allEmployeesSelected) {
        // Unselect all employees
        for (const person of allEmployees) {
          next.delete(person.user_id)
        }
      } else {
        // Add all employees
        for (const person of allEmployees) {
          next.add(person.user_id)
        }
      }
      return next
    })
  }

  // Toggle freelancers selection
  const toggleFreelancers = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFreelancersSelected) {
        // Unselect all freelancers
        for (const person of allFreelancers) {
          next.delete(person.user_id)
        }
      } else {
        // Add all freelancers
        for (const person of allFreelancers) {
          next.add(person.user_id)
        }
      }
      return next
    })
  }

  // Toggle all selection
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        // Unselect all
        return new Set()
      } else {
        // Select all
        for (const person of people) {
          next.add(person.user_id)
        }
        return next
      }
    })
  }

  const getRoleBadge = (role: CompanyRole | null) => {
    if (!role) return null
    const variants: Record<CompanyRole, { color: string; label: string }> = {
      owner: { color: 'purple', label: 'Owner' },
      employee: { color: 'blue', label: 'Employee' },
      freelancer: { color: 'green', label: 'Freelancer' },
      super_user: { color: 'amber', label: 'Super' },
    }
    const v = variants[role]
    return (
      <Badge radius="full" size="1" color={v.color as any}>
        {v.label}
      </Badge>
    )
  }

  const toggleSelection = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const create = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!companyId) throw new Error('No company selected')

      await createMatter({
        company_id: companyId,
        matter_type: 'announcement',
        title: value.title.trim(),
        content: value.content.trim() || null,
        recipient_user_ids: Array.from(selectedIds),
        allow_custom_responses: true,
        created_as_company:
          companyRole === 'owner' || isGlobalSuperuser
            ? value.createdAsCompany
            : undefined,
        files: selectedFiles.length > 0 ? selectedFiles : undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matters'] })
      success(
        'Announcement sent',
        'Recipients were notified in the app (and by email when enabled).',
      )
      form.reset(defaultValues)
      setSelectedIds(new Set())
      setSearch('')
      setSelectedFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      onOpenChange(false)
    },
    onError: (e: Error) => {
      toastError('Failed to create matter', e.message || 'Please try again.')
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles((prev) => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  React.useEffect(() => {
    if (!open) {
      form.reset(defaultValues)
      setSelectedIds(new Set())
      setSearch('')
      setSelectedFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog closes
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}
      >
        <Dialog.Title>New announcement</Dialog.Title>
        <Dialog.Description>
          Updates in the inbox are created automatically (offers, invites, and
          similar). Use this only for a manual broadcast to selected people.
        </Dialog.Description>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Grid columns={isLarge ? '1fr 1.5fr' : '1fr'} gap="4">
              {/* Left column: Matter details */}
              <Box>
                <Box my="4">
                  <form.AppField name="title">
                    {(field) => (
                      <field.TextField
                        label="Title *"
                        placeholder="Enter a title…"
                      />
                    )}
                  </form.AppField>
                </Box>

                <Box my="4">
                  <form.AppField name="content">
                    {(field) => (
                      <field.TextArea
                        label="Description (optional)"
                        placeholder="Provide more context..."
                        rows={4}
                      />
                    )}
                  </form.AppField>
                </Box>

                {(companyRole === 'owner' || isGlobalSuperuser) && (
                  <Box my="4">
                    <form.AppField name="createdAsCompany">
                      {(field) => (
                        <field.Checkbox label="Create as company (will show company name instead of your name)" />
                      )}
                    </form.AppField>
                  </Box>
                )}

                <Box my="4">
                  <Text
                    size="2"
                    weight="medium"
                    mb="1"
                    style={{ display: 'block' }}
                  >
                    Attach Files (optional)
                  </Text>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <Flex gap="2" align="center">
                    <Button
                      type="button"
                      size="2"
                      variant="soft"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose Files
                    </Button>
                    {selectedFiles.length > 0 && (
                      <Text size="2" color="gray">
                        {selectedFiles.length} file
                        {selectedFiles.length !== 1 ? 's' : ''} selected
                      </Text>
                    )}
                  </Flex>
                  {selectedFiles.length > 0 && (
                    <Box
                      mt="2"
                      p="2"
                      style={{
                        border: '1px solid var(--gray-a6)',
                        borderRadius: 8,
                        background: 'var(--gray-a2)',
                      }}
                    >
                      {selectedFiles.map((file, index) => (
                        <Flex
                          key={index}
                          align="center"
                          justify="between"
                          gap="2"
                          mb={
                            index < selectedFiles.length - 1 ? '2' : undefined
                          }
                        >
                          <Text size="2" truncate style={{ flex: 1 }}>
                            {file.name}
                          </Text>
                          <Button
                            type="button"
                            size="1"
                            variant="ghost"
                            color="red"
                            onClick={() => removeFile(index)}
                          >
                            <Xmark width={14} height={14} />
                          </Button>
                        </Flex>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Right column: Recipients */}
              <Box>
                <Box my="4">
                  <Text
                    size="2"
                    weight="medium"
                    mb="2"
                    style={{ display: 'block' }}
                  >
                    Select Recipients *
                  </Text>
                  <Flex gap="2" wrap="wrap" mb="2">
                    <Button
                      type="button"
                      size="1"
                      variant="soft"
                      onClick={toggleAll}
                    >
                      {allSelected ? 'Unselect All' : 'Select All'}
                    </Button>
                    {canUseGroupSelection && (
                      <>
                        <Button
                          type="button"
                          size="1"
                          variant="soft"
                          onClick={toggleEmployees}
                          disabled={allEmployees.length === 0}
                        >
                          {allEmployeesSelected
                            ? 'Unselect Employees'
                            : 'Select Employees'}
                        </Button>
                        <Button
                          type="button"
                          size="1"
                          variant="soft"
                          onClick={toggleFreelancers}
                          disabled={allFreelancers.length === 0}
                        >
                          {allFreelancersSelected
                            ? 'Unselect Freelancers'
                            : 'Select Freelancers'}
                        </Button>
                      </>
                    )}
                  </Flex>
                  <TextField.Root
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    mb="2"
                  />
                  <Box
                    style={{
                      maxHeight: 400,
                      overflowY: 'auto',
                      border: '1px solid var(--gray-a6)',
                      borderRadius: 8,
                      padding: 8,
                    }}
                  >
                    {isFetching && (
                      <Text size="2" color="gray">
                        Searching…
                      </Text>
                    )}
                    {!isFetching && people.length === 0 && (
                      <Text size="2" color="gray">
                        No users found
                      </Text>
                    )}
                    {!isFetching &&
                      people.map((p) => {
                        const isSelected = selectedIds.has(p.user_id)
                        return (
                          <Box
                            key={p.user_id}
                            p="2"
                            style={{
                              cursor: 'pointer',
                              borderRadius: 6,
                              background: isSelected
                                ? 'var(--blue-a3)'
                                : 'transparent',
                            }}
                            onClick={() => toggleSelection(p.user_id)}
                          >
                            <Flex align="center" gap="2" justify="between">
                              <Flex align="center" gap="2">
                                <Checkbox checked={isSelected} />
                                <div>
                                  <Flex align="center" gap="2">
                                    <Text weight="medium">
                                      {p.display_name || p.email}
                                    </Text>
                                    {getRoleBadge(p.role)}
                                  </Flex>
                                  {p.display_name && (
                                    <Text
                                      size="1"
                                      color="gray"
                                      style={{ display: 'block' }}
                                    >
                                      {p.email}
                                    </Text>
                                  )}
                                </div>
                              </Flex>
                            </Flex>
                          </Box>
                        )
                      })}
                  </Box>
                  {selectedIds.size > 0 && (
                    <Text size="2" color="gray" mt="2">
                      {selectedIds.size} recipient
                      {selectedIds.size !== 1 ? 's' : ''} selected
                    </Text>
                  )}
                </Box>
              </Box>
            </Grid>

            <Flex mt="4" gap="2" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Cancel
                </Button>
              </Dialog.Close>
              <form.Subscribe selector={(state) => state.values.title}>
                {(title) => (
                  <form.SubmitButton
                    label="Send announcement"
                    pendingLabel="Sending…"
                    disabled={!title.trim() || selectedIds.size === 0}
                  />
                )}
              </form.Subscribe>
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
