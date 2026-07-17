import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, Flex, Progress, Select, Text } from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import LazyImage from '@shared/ui/components/LazyImage'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { Camera, Sparks } from 'iconoir-react'
import { crewIndexQuery } from '@features/crew/api/queries'
import { partnerCustomersQuery, upsertVehicle } from '../../api/queries'
import type { FuelType, VehicleCategory } from '../../api/queries'
import type { VehicleOwnerKind } from '../../lib/ownership'

type Mode = 'create' | 'edit'
type Initial = {
  id: string
  name: string
  registration_no: string
  fuel: FuelType | null
  vehicle_category: VehicleCategory | null
  internally_owned: boolean
  external_owner_id: string | null
  owner_user_id: string | null
  image_path: string | null
  notes: string
}

const fuelOptions: Array<FuelType> = ['electric', 'diesel', 'petrol']

const categoryOptions: Array<{ value: VehicleCategory; label: string }> = [
  { value: 'passenger_car_small', label: 'Passenger Car - Small' },
  { value: 'passenger_car_medium', label: 'Passenger Car - Medium' },
  { value: 'passenger_car_big', label: 'Passenger Car - Big' },
  { value: 'van_small', label: 'Van - Small' },
  { value: 'van_medium', label: 'Van - Medium' },
  { value: 'van_big', label: 'Van - Big' },
  { value: 'C1', label: 'C1' },
  { value: 'C1E', label: 'C1E' },
  { value: 'C', label: 'C' },
  { value: 'CE', label: 'CE' },
]

const defaultValues = {
  name: '',
  registration_no: '',
  fuel: null as FuelType | null,
  vehicle_category: null as VehicleCategory | null,
  ownerType: 'company' as VehicleOwnerKind,
  external_owner_id: null as string | null,
  owner_user_id: null as string | null,
  image_path: null as string | null,
  notes: '',
}

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    registration_no: z.string(),
    fuel: z.enum(['electric', 'diesel', 'petrol']).nullable(),
    vehicle_category: z
      .enum([
        'passenger_car_small',
        'passenger_car_medium',
        'passenger_car_big',
        'van_small',
        'van_medium',
        'van_big',
        'C1',
        'C1E',
        'C',
        'CE',
      ])
      .nullable(),
    ownerType: z.enum(['company', 'partner', 'person']),
    external_owner_id: z.string().nullable(),
    owner_user_id: z.string().nullable(),
    image_path: z.string().nullable(),
    notes: z.string(),
  })
  .refine((v) => v.ownerType !== 'partner' || !!v.external_owner_id, {
    message: 'Select a partner',
    path: ['external_owner_id'],
  })
  .refine((v) => v.ownerType !== 'person' || !!v.owner_user_id, {
    message: 'Select a person',
    path: ['owner_user_id'],
  })

export default function AddEditVehicleDialog({
  open,
  onOpenChange,
  mode = 'create',
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode?: Mode
  initial?: Initial
  onSaved?: () => void
}) {
  const { companyId } = useCompany()
  const { success, info, error } = useToast()
  const qc = useQueryClient()

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await mut.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initial) {
      const ownerType: VehicleOwnerKind = initial.internally_owned
        ? 'company'
        : initial.owner_user_id
          ? 'person'
          : 'partner'
      form.reset(
        {
          name: initial.name,
          registration_no: initial.registration_no,
          fuel: initial.fuel,
          vehicle_category: initial.vehicle_category ?? null,
          ownerType,
          external_owner_id: initial.external_owner_id ?? null,
          owner_user_id: initial.owner_user_id ?? null,
          image_path: initial.image_path ?? null,
          notes: initial.notes,
        },
        { keepDefaultValues: true },
      )
      return
    }
    if (mode === 'create') {
      form.reset(defaultValues, { keepDefaultValues: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, mode, initial?.id])

  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId: companyId ?? '__none__' }),
    enabled: !!companyId && open,
  })

  const { data: crew = [] } = useQuery({
    ...crewIndexQuery({ companyId: companyId ?? '__none__', kind: 'all' }),
    enabled: !!companyId && open,
  })

  const [uploading, setUploading] = React.useState(false)

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const fileName = `${Date.now()}.${ext}`
      const path = `${companyId}/${fileName}`

      const { error: upErr } = await supabase.storage
        .from('vehicle_images')
        .upload(path, file, { upsert: false, cacheControl: '3600' })

      if (upErr) throw upErr

      form.setFieldValue('image_path', path)
      info('Photo uploaded', 'Remember to Save to apply.')
      return path
    } finally {
      setUploading(false)
    }
  }

  function getImageUrl(imagePath: string | null) {
    if (!imagePath) return null
    const { data } = supabase.storage
      .from('vehicle_images')
      .getPublicUrl(imagePath)
    return data.publicUrl
  }

  const mut = useMutation({
    mutationFn: async (value: typeof defaultValues) => {
      if (!companyId) throw new Error('No company selected')
      const payload = {
        company_id: companyId,
        id: initial?.id,
        name: value.name.trim(),
        registration_no: value.registration_no.trim() || null,
        fuel: value.fuel,
        vehicle_category: value.vehicle_category,
        internally_owned: value.ownerType === 'company',
        external_owner_id:
          value.ownerType === 'partner' ? value.external_owner_id : null,
        owner_user_id:
          value.ownerType === 'person' ? value.owner_user_id : null,
        image_path: value.image_path,
        notes: value.notes.trim() || null,
      }
      const vehicleId = await upsertVehicle(payload)

      if (mode === 'create') {
        try {
          const { logActivity } = await import('@features/latest/api/queries')
          await logActivity({
            companyId,
            activityType: 'vehicle_added',
            metadata: {
              vehicle_id: vehicleId,
              vehicle_name: value.name.trim(),
              license_plate: value.registration_no.trim() || null,
            },
            title: value.name.trim(),
          })
        } catch (logErr) {
          console.error('Failed to log activity:', logErr)
        }
      }

      return vehicleId
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicles-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicle-detail'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
      success(
        mode === 'edit' ? 'Saved' : 'Vehicle created',
        mode === 'edit' ? 'Vehicle updated.' : 'Vehicle added.',
      )
      onOpenChange(false)
      onSaved?.()
    },
    onError: (e: Error) => error('Failed', e.message ?? 'Please try again.'),
  })

  // ===== TESTING ONLY: Auto-populate function =====
  // TODO: Remove this function and button when testing is complete
  const autoPopulateFields = () => {
    const vehicleNames = [
      'Mercedes Sprinter',
      'Ford Transit',
      'Volkswagen Crafter',
      'Iveco Daily',
      'Renault Master',
      'Peugeot Boxer',
      'Fiat Ducato',
      'Toyota Hiace',
      'Nissan NV400',
      'Opel Movano',
    ]
    const regNumbers = [
      'AB12345',
      'CD67890',
      'EF11111',
      'GH22222',
      'IJ33333',
      'KL44444',
      'MN55555',
      'OP66666',
      'QR77777',
      'ST88888',
    ]
    const fuels: Array<FuelType> = ['diesel', 'petrol', 'electric']
    const categories: Array<VehicleCategory> = [
      'passenger_car_small',
      'passenger_car_medium',
      'van_small',
      'van_medium',
      'van_big',
    ]
    const notes = [
      'Test vehicle for inventory management',
      'Standard company vehicle',
      'Backup vehicle in fleet',
      'Primary transport vehicle',
      'Reserve vehicle',
    ]

    const randomName =
      vehicleNames[Math.floor(Math.random() * vehicleNames.length)]
    const randomReg = regNumbers[Math.floor(Math.random() * regNumbers.length)]
    const randomFuel = fuels[Math.floor(Math.random() * fuels.length)]
    const randomCategory =
      categories[Math.floor(Math.random() * categories.length)]
    const randomNotes = notes[Math.floor(Math.random() * notes.length)]
    const ownerRoll = Math.random()
    const ownerType: VehicleOwnerKind =
      ownerRoll > 0.55 ? 'company' : ownerRoll > 0.25 ? 'partner' : 'person'
    const randomPartner =
      partners.length > 0
        ? partners[Math.floor(Math.random() * partners.length)]
        : null
    const randomCrew =
      crew.length > 0 ? crew[Math.floor(Math.random() * crew.length)] : null

    form.reset(
      {
        name: randomName,
        registration_no: randomReg,
        fuel: randomFuel,
        vehicle_category: randomCategory,
        ownerType:
          ownerType === 'partner' && !randomPartner
            ? 'company'
            : ownerType === 'person' && !randomCrew
              ? 'company'
              : ownerType,
        external_owner_id:
          ownerType === 'partner' ? (randomPartner?.id ?? null) : null,
        owner_user_id:
          ownerType === 'person' ? (randomCrew?.user_id ?? null) : null,
        image_path: null,
        notes: randomNotes,
      },
      { keepDefaultValues: true },
    )
  }
  // ===== END TESTING ONLY =====

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="680px">
        <Flex align="center" justify="between">
          <Dialog.Title>
            {mode === 'edit' ? 'Edit vehicle' : 'Add vehicle'}
          </Dialog.Title>
          {/* ===== TESTING ONLY: Auto-fill button ===== */}
          {mode === 'create' && (
            <Button
              size="2"
              variant="soft"
              onClick={autoPopulateFields}
              type="button"
              style={{ marginLeft: 'auto' }}
            >
              <Sparks width={16} height={16} />
              Auto-fill
            </Button>
          )}
          {/* ===== END TESTING ONLY ===== */}
        </Flex>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <Flex gap="3" wrap="wrap">
                <form.AppField name="name">
                  {(field) => (
                    <field.TextField
                      label="Name *"
                      placeholder="Enter vehicle name"
                      style={{ flex: '1 1', minWidth: 220 }}
                    />
                  )}
                </form.AppField>
                <form.AppField name="registration_no">
                  {(field) => (
                    <field.TextField
                      label="Reg number"
                      placeholder="Enter registration number"
                      style={{ flex: '1 1', minWidth: 220 }}
                    />
                  )}
                </form.AppField>
              </Flex>

              <Flex gap="3" wrap="wrap">
                <Field label="Fuel">
                  <form.AppField name="fuel">
                    {(field) => (
                      <Select.Root
                        value={field.state.value ?? ''}
                        onValueChange={(v) =>
                          field.handleChange((v || null) as FuelType | null)
                        }
                        size="3"
                      >
                        <Select.Trigger
                          placeholder="Select fuel"
                          style={{ minHeight: 'var(--space-7)' }}
                        />
                        <Select.Content style={{ zIndex: 10000 }}>
                          {fuelOptions.map((fuel) => (
                            <Select.Item key={fuel} value={fuel}>
                              {fuel}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    )}
                  </form.AppField>
                </Field>

                <Field label="Vehicle Category">
                  <form.AppField name="vehicle_category">
                    {(field) => (
                      <Select.Root
                        value={field.state.value ?? ''}
                        onValueChange={(v) =>
                          field.handleChange(
                            (v || null) as VehicleCategory | null,
                          )
                        }
                        size="3"
                      >
                        <Select.Trigger
                          placeholder="Select category"
                          style={{ minHeight: 'var(--space-7)' }}
                        />
                        <Select.Content style={{ zIndex: 10000 }}>
                          {categoryOptions.map((opt) => (
                            <Select.Item key={opt.value} value={opt.value}>
                              {opt.label}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    )}
                  </form.AppField>
                </Field>

                <Field label="Owner">
                  <form.AppField name="ownerType">
                    {(field) => (
                      <Select.Root
                        value={field.state.value}
                        onValueChange={(v) => {
                          const ownerType = v as VehicleOwnerKind
                          field.handleChange(ownerType)
                          if (ownerType !== 'partner') {
                            form.setFieldValue('external_owner_id', null)
                          }
                          if (ownerType !== 'person') {
                            form.setFieldValue('owner_user_id', null)
                          }
                        }}
                        size="3"
                      >
                        <Select.Trigger
                          placeholder="Select owner type"
                          style={{ minHeight: 'var(--space-7)' }}
                        />
                        <Select.Content style={{ zIndex: 10000 }}>
                          <Select.Item value="company">Company</Select.Item>
                          <Select.Item value="partner">Partner</Select.Item>
                          <Select.Item value="person">
                            Employee / freelancer / owner
                          </Select.Item>
                        </Select.Content>
                      </Select.Root>
                    )}
                  </form.AppField>
                </Field>

                <form.Subscribe selector={(state) => state.values.ownerType}>
                  {(ownerType) => (
                    <>
                      {ownerType === 'partner' && (
                        <Field label="Partner">
                          <form.AppField name="external_owner_id">
                            {(field) => (
                              <Select.Root
                                value={field.state.value ?? ''}
                                onValueChange={(v) =>
                                  field.handleChange(v || null)
                                }
                                size="3"
                              >
                                <Select.Trigger
                                  placeholder="Select partner"
                                  style={{ minHeight: 'var(--space-7)' }}
                                />
                                <Select.Content style={{ zIndex: 10000 }}>
                                  {partners.map((p) => (
                                    <Select.Item key={p.id} value={p.id}>
                                      {p.name}
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Root>
                            )}
                          </form.AppField>
                        </Field>
                      )}

                      {ownerType === 'person' && (
                        <Field label="Person">
                          <form.AppField name="owner_user_id">
                            {(field) => (
                              <Select.Root
                                value={field.state.value ?? ''}
                                onValueChange={(v) =>
                                  field.handleChange(v || null)
                                }
                                size="3"
                              >
                                <Select.Trigger
                                  placeholder="Select person"
                                  style={{ minHeight: 'var(--space-7)' }}
                                />
                                <Select.Content style={{ zIndex: 10000 }}>
                                  {crew.map((member) => (
                                    <Select.Item
                                      key={member.user_id}
                                      value={member.user_id}
                                    >
                                      {member.display_name ?? member.email}
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Root>
                            )}
                          </form.AppField>
                        </Field>
                      )}
                    </>
                  )}
                </form.Subscribe>
              </Flex>

              <form.Subscribe selector={(state) => state.values.image_path}>
                {(imagePath) => {
                  const imageUrl = getImageUrl(imagePath)
                  return (
                    <Field label="Image">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            await uploadImage(file)
                          } catch (err: unknown) {
                            error(
                              'Upload failed',
                              err instanceof Error
                                ? err.message
                                : 'Try another image.',
                            )
                          } finally {
                            e.currentTarget.value = ''
                          }
                        }}
                      />

                      <div
                        style={{
                          width: 320,
                          height: 180,
                          borderRadius: 8,
                          border: '1px solid var(--gray-a6)',
                          background: '(--gray-a11)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          marginBottom: 8,
                        }}
                      >
                        {imageUrl ? (
                          <LazyImage
                            src={imageUrl}
                            alt="Vehicle"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <Text
                            size="2"
                            color="gray"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <Camera width={18} height={18} />
                            No image
                          </Text>
                        )}
                      </div>

                      <Flex gap="2" align="center" wrap="wrap">
                        <Button
                          type="button"
                          size="2"
                          variant="soft"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Flex gap="2" align="center">
                            <Camera width={16} height={16} />
                            {uploading
                              ? 'Uploading…'
                              : imageUrl
                                ? 'Change photo'
                                : 'Add photo'}
                          </Flex>
                        </Button>

                        {imagePath ? (
                          <Button
                            type="button"
                            size="2"
                            variant="ghost"
                            color="red"
                            onClick={() =>
                              form.setFieldValue('image_path', null)
                            }
                            disabled={uploading}
                          >
                            Remove photo
                          </Button>
                        ) : null}
                      </Flex>

                      {uploading && (
                        <div style={{ width: 220, marginTop: 8 }}>
                          <Progress />
                        </div>
                      )}
                    </Field>
                  )
                }}
              </form.Subscribe>

              <form.AppField name="notes">
                {(field) => (
                  <field.TextArea
                    label="Notes"
                    rows={3}
                    placeholder="Add notes about this vehicle..."
                  />
                )}
              </form.AppField>
            </Flex>

            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button
                  type="button"
                  variant="soft"
                  disabled={mut.isPending || uploading}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <form.SubmitButton
                label={mode === 'edit' ? 'Save' : 'Create'}
                pendingLabel="Saving…"
                disabled={uploading}
              />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
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
    <div style={{ flex: '1 1', minWidth: 220 }}>
      <Text as="div" size="2" color="gray" style={{ marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </div>
  )
}
