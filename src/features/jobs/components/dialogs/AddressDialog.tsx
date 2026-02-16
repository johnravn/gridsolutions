// src/features/jobs/components/dialogs/JobDialog.tsx
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
  SegmentedControl,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Check, EditPencil, Plus, Search, Trash, Xmark } from 'iconoir-react'
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

type AddressForm = {
  id: string | null
  name: string
  address_line: string
  zip_code: string
  city: string
  country: string
}

type PanelMode = 'view' | 'edit' | 'create'

export default function AddressDialog({
  open,
  onOpenChange,
  companyId,
  mode = 'create',
  initialData,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()

  // ── List state
  const [search, setSearch] = React.useState('')
  const { data: rows = [], isFetching } = useQuery({
    ...addressIndexQuery({ companyId, search }),
    enabled: !!companyId && open,
  })

  // ── Selection + panel mode
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [panelMode, setPanelMode] = React.useState<PanelMode>('view')

  const selectedRow = React.useMemo(
    () => rows.find((x) => x.id === selectedId) ?? null,
    [rows, selectedId],
  )

  // ── Working form (used for view/edit/create + live map)
  const emptyForm = React.useMemo<AddressForm>(
    () => ({
      id: null,
      name: '',
      address_line: '',
      zip_code: '',
      city: '',
      country: 'Norway',
    }),
    [],
  )
  const [form, setForm] = React.useState<AddressForm>(emptyForm)
  const setFormVal = <TKey extends keyof AddressForm>(
    k: TKey,
    v: AddressForm[TKey],
  ) => setForm((s) => ({ ...s, [k]: (v ?? '') as any }))

  // ── Seed selection/form when dialog opens or initialData changes
  React.useEffect(() => {
    if (!open) return
    // Prefer job’s current address if editing a job that already has one
    const init = initialData?.address
    if (init?.id) {
      setSelectedId(init.id)
      setPanelMode('view')
      setForm({
        id: init.id,
        name: init.name,
        address_line: init.address_line,
        zip_code: init.zip_code,
        city: init.city,
        country: init.country,
      })
    } else {
      // default—no preselection
      setSelectedId(null)
      setPanelMode('view')
      setForm(emptyForm)
    }
  }, [
    open,
    initialData?.address?.id,
    initialData?.address?.name,
    initialData?.address?.address_line,
    initialData?.address?.zip_code,
    initialData?.address?.city,
    initialData?.address?.country,
    emptyForm,
  ])

  // ── When user selects from the list, switch to view mode and populate form
  React.useEffect(() => {
    if (!selectedId) return
    const r = rows.find((x) => x.id === selectedId)
    if (!r) return
    setPanelMode('view')
    setForm({
      id: r.id,
      name: r.name ?? '',
      address_line: r.address_line,
      zip_code: r.zip_code,
      city: r.city,
      country: r.country,
    })
  }, [selectedId, rows])

  // ── Map query string (live)
  const mapQuery = React.useMemo(() => {
    const parts = [form.address_line, form.zip_code, form.city, form.country]
      .filter(Boolean)
      .join(', ')
    return parts
  }, [form.address_line, form.zip_code, form.city, form.country])

  // ── Mutations
  // ── Link selected address to the calling job
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
      // Refresh addresses + this job’s detail
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['address', companyId, 'address-index'],
        }),
        qc.invalidateQueries({ queryKey: ['jobs-detail', initialData?.id] }),
      ])
      success('Address set on job')
      onOpenChange(false)
      // onSaved?.(initialData!.id)
    },
    onError: (e: any) => {
      toastError(
        'Failed to set address on job',
        e?.message ?? 'Please try again.',
      )
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name || null,
        address_line: form.address_line || null,
        zip_code: form.zip_code || null,
        city: form.city || null,
        country: form.country || null,
        company_id: companyId,
      }

      if (panelMode === 'edit' && form.id) {
        if (selectedRow?.is_personal) {
          throw new Error('Personal addresses cannot be edited')
        }
        const { error } = await supabase
          .from('addresses')
          .update(payload)
          .eq('id', form.id)
        if (error) throw error
        return form.id
      }

      // create
      const { data, error } = await supabase
        .from('addresses')
        .insert([payload]) // created addresses default to is_personal=false unless you set it
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
    onError: (e: any) => {
      toastError('Failed to save address', e?.message ?? 'Please try again.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!form.id) throw new Error('Nothing selected to delete')
      if (selectedRow?.is_personal)
        throw new Error('Personal addresses cannot be deleted')

      const { error } = await supabase
        .from('addresses')
        .update({ deleted: true }) // ⬅️ soft delete
        .eq('id', form.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['address', companyId, 'address-index'],
      })
      setSelectedId(null)
      setForm(emptyForm)
      setPanelMode('view')
      info('Address deleted')
    },
    onError: (e: any) => {
      toastError('Failed to delete', e?.message ?? 'Please try again.')
    },
  })

  const canSave =
    (panelMode === 'edit' || panelMode === 'create') &&
    !!form.address_line &&
    !!form.city &&
    !!form.zip_code &&
    !!form.country

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
          {/* ── Column 1: List + Search */}
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

          {/* ── Column 2: Details / Editor */}
          <Flex direction="column" style={{ minHeight: 0 }}>
            <Flex justify="between" align="center" mb="2" gap="2">
              <Text weight="medium">Details</Text>
              {panelMode === 'view' ? (
                <Button
                  variant="soft"
                  size="2"
                  onClick={() => {
                    setPanelMode('create')
                    setForm(emptyForm)
                    setSelectedId(null)
                  }}
                >
                  <Plus /> Add new address
                </Button>
              ) : null}
            </Flex>

            {/* Content area (fills available height, scrolls if needed) */}
            <Flex
              direction="column"
              gap="3"
              style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
            >
              {panelMode === 'view' ? (
                <DetailFieldGroup form={form} />
              ) : (
                <EditFieldGroup form={form} setFormVal={setFormVal} />
              )}
            </Flex>

            {/* Footer actions */}
            <Flex justify="end" gap="2" mt="3">
              {panelMode === 'view' ? (
                <>
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
                </>
              ) : (
                <>
                  <Button
                    variant="soft"
                    onClick={() => {
                      // cancel edit/create -> back to view (or clear)
                      if (selectedId) {
                        setPanelMode('view')
                        // reset form to selected
                        const r = rows.find((x) => x.id === selectedId)
                        if (r) {
                          setForm({
                            id: r.id,
                            name: r.name ?? '',
                            address_line: r.address_line,
                            zip_code: r.zip_code,
                            city: r.city,
                            country: r.country,
                          })
                        }
                      } else {
                        setPanelMode('view')
                        setForm(emptyForm)
                      }
                    }}
                  >
                    <Xmark /> Cancel
                  </Button>
                  <Button
                    variant="classic"
                    disabled={!canSave || saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                  >
                    <Check /> Save address
                  </Button>
                </>
              )}
            </Flex>
          </Flex>

          {/* ── Column 3: Map */}
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
        </Grid>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Close</Button>
          </Dialog.Close>
          {/* ➕ New: Use button */}
          <Button
            variant="classic"
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

// ───────────────────────────────── helpers/components
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

function DetailFieldGroup({ form }: { form: AddressForm }) {
  return (
    <Flex direction="column" gap="2">
      <KV label="Name">{form.name || '—'}</KV>
      <KV label="Address">{form.address_line || '—'}</KV>
      <Flex gap="3" wrap="wrap">
        <KV label="ZIP">{form.zip_code || '—'}</KV>
        <KV label="City">{form.city || '—'}</KV>
      </Flex>
      <KV label="Country">{form.country || '—'}</KV>
    </Flex>
  )
}

function EditFieldGroup({
  form,
  setFormVal,
}: {
  form: AddressForm
  setFormVal: <TKey extends keyof AddressForm>(
    k: TKey,
    v: AddressForm[TKey],
  ) => void
}) {
  return (
    <Flex direction="column" gap="3">
      <Field label="Name">
        <TextField.Root
          value={form.name}
          onChange={(e) => setFormVal('name', e.target.value)}
          placeholder="e.g., Hotel Plaza"
        />
      </Field>
      <Field label="Address line">
        <TextField.Root
          value={form.address_line}
          onChange={(e) => setFormVal('address_line', e.target.value)}
          placeholder="Street and number"
        />
      </Field>
      <Flex gap="3" wrap="wrap">
        <Field label="ZIP">
          <NorwayZipCodeField
            value={form.zip_code}
            onChange={(val) => setFormVal('zip_code', val)}
            autoCompleteCity={(city) => setFormVal('city', city)}
          />
        </Field>
        <Field label="City">
          <TextField.Root
            value={form.city}
            onChange={(e) => setFormVal('city', e.target.value)}
            placeholder="e.g., Oslo"
          />
        </Field>
      </Flex>
      <Field label="Country">
        <TextField.Root
          value={form.country}
          onChange={(e) => setFormVal('country', e.target.value)}
        />
      </Field>
    </Flex>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ minWidth: 160 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
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
