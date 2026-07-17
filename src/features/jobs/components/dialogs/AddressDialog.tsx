import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  ScrollArea,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { EditPencil, Plus, Search, Trash, Xmark } from 'iconoir-react'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import MapEmbed from '@shared/maps/MapEmbed'
import { addressIndexQuery } from '@features/jobs/api/queries'
import { NorwayZipCodeField } from '@shared/lib/NorwayZipCodeField'
import type { JobDetail, UUID } from '../../types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: UUID
  mode?: 'create' | 'edit'
  initialData?: JobDetail
  onSaved?: (id: UUID) => void
}

type AddressRow = {
  id: string
  name: string | null
  address_line: string | null
  zip_code: string | null
  city: string | null
  country: string | null
  deleted?: boolean | null
  is_personal?: boolean | null
}

type PanelMode = 'view' | 'edit' | 'create'

const emptyForm = {
  id: null as string | null,
  name: '',
  address_line: '',
  zip_code: '',
  city: '',
  country: 'Norway',
}

const schema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  address_line: z.string().trim().min(1, 'Address line is required'),
  zip_code: z.string().trim().min(1, 'ZIP is required'),
  city: z.string().trim().min(1, 'City is required'),
  country: z.string().trim().min(1, 'Country is required'),
})

function rowToFormValues(row: AddressRow) {
  return {
    id: row.id,
    name: row.name ?? '',
    address_line: row.address_line ?? '',
    zip_code: row.zip_code ?? '',
    city: row.city ?? '',
    country: row.country ?? '',
  }
}

export default function AddressDialog({
  open,
  onOpenChange,
  companyId,
  initialData,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()

  const [search, setSearch] = React.useState('')
  const { data: rows = [], isFetching } = useQuery({
    ...addressIndexQuery({ companyId, search }),
    enabled: !!companyId && open,
  })

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [panelMode, setPanelMode] = React.useState<PanelMode>('view')

  const selectedRow = React.useMemo(
    () => rows.find((x) => x.id === selectedId) ?? null,
    [rows, selectedId],
  )

  const form = useAppForm({
    defaultValues: emptyForm,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await saveMutation.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open) return
    const init = initialData?.address
    if (init?.id) {
      setSelectedId(init.id)
      setPanelMode('view')
      form.reset(
        {
          id: init.id,
          name: init.name,
          address_line: init.address_line,
          zip_code: init.zip_code,
          city: init.city,
          country: init.country,
        },
        { keepDefaultValues: true },
      )
    } else {
      setSelectedId(null)
      setPanelMode('view')
      form.reset(emptyForm, { keepDefaultValues: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [
    open,
    initialData?.address?.id,
    initialData?.address?.name,
    initialData?.address?.address_line,
    initialData?.address?.zip_code,
    initialData?.address?.city,
    initialData?.address?.country,
  ])

  React.useEffect(() => {
    if (!selectedId) return
    const row = rows.find((x) => x.id === selectedId)
    if (!row) return
    setPanelMode('view')
    form.reset(rowToFormValues(row), { keepDefaultValues: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync form when selection changes
  }, [selectedId, rows])

  const useAddressMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Select an address first')
      if (!initialData?.id) throw new Error('Missing job id')

      const { error } = await supabase
        .from('jobs')
        .update({ job_address_id: selectedId })
        .eq('id', initialData.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['address', companyId, 'address-index'],
        }),
        qc.invalidateQueries({ queryKey: ['jobs-detail', initialData?.id] }),
      ])
      success('Address set on job')
      onOpenChange(false)
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to set address on job',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (value: typeof emptyForm) => {
      const payload = {
        name: value.name || null,
        address_line: value.address_line || '',
        zip_code: value.zip_code || '',
        city: value.city || '',
        country: value.country || '',
        company_id: companyId,
      }

      if (panelMode === 'edit' && value.id) {
        if (selectedRow?.is_personal) {
          throw new Error('Personal addresses cannot be edited')
        }
        const { error } = await supabase
          .from('addresses')
          .update(payload)
          .eq('id', value.id)
        if (error) throw error
        return value.id
      }

      const { data, error } = await supabase
        .from('addresses')
        .insert([payload])
        .select('id')
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: async (newId) => {
      await qc.invalidateQueries({
        queryKey: ['address', companyId, 'address-index'],
      })
      setSelectedId(newId)
      setPanelMode('view')
      success('Address saved')
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to save address',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const addressId = form.state.values.id
      if (!addressId) throw new Error('Nothing selected to delete')
      if (selectedRow?.is_personal)
        throw new Error('Personal addresses cannot be deleted')

      const { error } = await supabase
        .from('addresses')
        .update({ deleted: true })
        .eq('id', addressId)

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['address', companyId, 'address-index'],
      })
      setSelectedId(null)
      form.reset(emptyForm, { keepDefaultValues: true })
      setPanelMode('view')
      info('Address deleted')
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to delete',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="1200px"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '80vh',
          overflow: 'hidden',
        }}
      >
        <Dialog.Title>Manage address</Dialog.Title>

        <Grid
          columns={{ initial: '1', sm: '2', md: '3' }}
          gap="4"
          style={{ minHeight: 0, flex: 1, overflow: 'hidden' }}
        >
          <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              flex: 1,
            }}
          >
            <TextField.Root
              placeholder="Search addresses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="3"
            >
              <TextField.Slot side="left">
                <Search />
              </TextField.Slot>
              <TextField.Slot side="right">
                {isFetching && <Spinner />}
              </TextField.Slot>
            </TextField.Root>

            <ScrollArea
              type="auto"
              scrollbars="vertical"
              style={{ flex: 1, minHeight: 0 }}
            >
              <Flex direction="column" gap="1" mt="2" p="1">
                {rows.map((r) => (
                  <ListRow
                    key={r.id}
                    selected={selectedId === r.id}
                    name={r.name}
                    city={r.city}
                    onClick={() => setSelectedId(r.id)}
                    isPersonal={!!r.is_personal}
                  />
                ))}
                {rows.length === 0 && (
                  <Box p="3">
                    <Text color="gray">No addresses found.</Text>
                  </Box>
                )}
              </Flex>
            </ScrollArea>
          </Box>

          <Flex direction="column" style={{ minHeight: 0 }}>
            <Flex justify="between" align="center" mb="2" gap="2">
              <Text weight="medium">Details</Text>
              {panelMode === 'view' ? (
                <Button
                  variant="soft"
                  size="2"
                  onClick={() => {
                    setPanelMode('create')
                    form.reset(emptyForm, { keepDefaultValues: true })
                    setSelectedId(null)
                  }}
                >
                  <Plus /> Add new address
                </Button>
              ) : null}
            </Flex>

            <Flex
              direction="column"
              gap="3"
              style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
            >
              {panelMode === 'view' ? (
                <form.Subscribe selector={(state) => state.values}>
                  {(values) => <DetailFieldGroup values={values} />}
                </form.Subscribe>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    void form.handleSubmit()
                  }}
                >
                  <form.AppForm>
                    <Flex direction="column" gap="3">
                      <form.AppField name="name">
                        {(field) => (
                          <field.TextField
                            label="Name"
                            placeholder="e.g., Hotel Plaza"
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="address_line">
                        {(field) => (
                          <field.TextField
                            label="Address line"
                            placeholder="Street and number"
                          />
                        )}
                      </form.AppField>
                      <Flex gap="3" wrap="wrap">
                        <form.AppField name="zip_code">
                          {(field) => (
                            <Flex
                              direction="column"
                              gap="1"
                              style={{ minWidth: 160 }}
                            >
                              <Text as="label" size="2" weight="medium">
                                ZIP
                              </Text>
                              <NorwayZipCodeField
                                value={field.state.value}
                                onChange={(val) => field.handleChange(val)}
                                autoCompleteCity={(city) =>
                                  form.setFieldValue('city', city)
                                }
                              />
                            </Flex>
                          )}
                        </form.AppField>
                        <form.AppField name="city">
                          {(field) => (
                            <field.TextField
                              label="City"
                              placeholder="e.g., Oslo"
                              style={{ minWidth: 160 }}
                            />
                          )}
                        </form.AppField>
                      </Flex>
                      <form.AppField name="country">
                        {(field) => <field.TextField label="Country" />}
                      </form.AppField>
                    </Flex>

                    <Flex justify="end" gap="2" mt="3">
                      <Button
                        type="button"
                        variant="soft"
                        onClick={() => {
                          if (selectedId) {
                            setPanelMode('view')
                            const row = rows.find((x) => x.id === selectedId)
                            if (row) {
                              form.reset(rowToFormValues(row), {
                                keepDefaultValues: true,
                              })
                            }
                          } else {
                            setPanelMode('view')
                            form.reset(emptyForm, { keepDefaultValues: true })
                          }
                        }}
                      >
                        <Xmark /> Cancel
                      </Button>
                      <form.SubmitButton
                        label="Save address"
                        pendingLabel="Saving…"
                        disabled={saveMutation.isPending}
                      />
                    </Flex>
                  </form.AppForm>
                </form>
              )}
            </Flex>

            {panelMode === 'view' ? (
              <Flex justify="end" gap="2" mt="3">
                <Button
                  variant="ghost"
                  disabled={!selectedId || selectedRow?.is_personal}
                  onClick={() => {
                    if (!selectedRow?.is_personal) setPanelMode('edit')
                  }}
                >
                  <EditPencil /> Edit
                </Button>

                <Button
                  variant="ghost"
                  color="red"
                  disabled={
                    !selectedId ||
                    selectedRow?.is_personal ||
                    deleteMutation.isPending
                  }
                  onClick={() => {
                    if (!selectedRow?.is_personal) deleteMutation.mutate()
                  }}
                >
                  <Trash /> Delete
                </Button>
              </Flex>
            ) : null}
          </Flex>

          <form.Subscribe
            selector={(state) => [
              state.values.address_line,
              state.values.zip_code,
              state.values.city,
              state.values.country,
            ]}
          >
            {([addressLine, zipCode, city, country]) => {
              const mapQuery = [addressLine, zipCode, city, country]
                .filter(Boolean)
                .join(', ')
              return (
                <Box
                  style={{
                    maxWidth: '100%',
                    minHeight: 170,
                    maxHeight: 320,
                    flex: 1,
                    overflow: 'hidden',
                    borderRadius: 8,
                  }}
                >
                  {mapQuery ? <MapEmbed query={mapQuery} zoom={14} /> : null}
                </Box>
              )
            }}
          </form.Subscribe>
        </Grid>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
          <Button
            variant="solid"
            disabled={!selectedId || useAddressMutation.isPending}
            onClick={() => useAddressMutation.mutate()}
          >
            {useAddressMutation.isPending ? 'Saving…' : 'Use'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function ListRow({
  selected,
  name,
  city,
  onClick,
  isPersonal,
}: {
  selected: boolean
  name: string | null
  city: string | null
  onClick: () => void
  isPersonal?: boolean
}) {
  return (
    <Box
      p="2"
      style={{
        borderRadius: 8,
        cursor: 'pointer',
        background: selected ? 'var(--color-panel-solid)' : undefined,
        outline: selected
          ? '2px solid var(--accent-9)'
          : '1px solid var(--gray-5)',
        opacity: isPersonal ? 0.9 : 1,
      }}
      onClick={onClick}
      title={isPersonal ? 'Personal address (view only)' : undefined}
    >
      <Text weight="medium">
        {name || '—'} {isPersonal ? <Badge>personal</Badge> : null}
      </Text>
      <Text size="2" color="gray" as="div">
        {city || '—'}
      </Text>
    </Box>
  )
}

function DetailFieldGroup({ values }: { values: typeof emptyForm }) {
  return (
    <Flex direction="column" gap="2">
      <KV label="Name">{values.name || '—'}</KV>
      <KV label="Address">{values.address_line || '—'}</KV>
      <Flex gap="3" wrap="wrap">
        <KV label="ZIP">{values.zip_code || '—'}</KV>
        <KV label="City">{values.city || '—'}</KV>
      </Flex>
      <KV label="Country">{values.country || '—'}</KV>
    </Flex>
  )
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <Text style={{ display: 'block' }} size="2" color="gray">
        {label}
      </Text>
      <Text>{children}</Text>
    </div>
  )
}
