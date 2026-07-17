// src/features/inventory/components/AddItemDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Button,
  Dialog,
  Flex,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { supabase } from '@shared/api/supabase'
import { Plus, Sparks } from 'iconoir-react'
import BrandAutocomplete from './BrandAutocomplete'
import type { InventoryItemKind } from '../api/queries'

type FormValues = {
  name: string
  categoryId: string | null
  brandId: string | null
  model: string
  allow_individual_booking: boolean
  total_quantity: number
  active: boolean
  notes: string
  nicknames: string
  price: number | null
  item_kind: InventoryItemKind
}

const defaultValues: FormValues = {
  name: '',
  categoryId: null,
  brandId: null,
  model: '',
  allow_individual_booking: true,
  total_quantity: 0,
  active: true,
  notes: '',
  nicknames: '',
  price: null,
  item_kind: 'stock',
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  categoryId: z.string().nullable(),
  brandId: z.string().nullable(),
  model: z.string(),
  allow_individual_booking: z.boolean(),
  total_quantity: z.number().min(0),
  active: z.boolean(),
  notes: z.string(),
  nicknames: z.string(),
  price: z.number().nullable(),
  item_kind: z.enum(['stock', 'subrental']),
})

type Option = { id: string; name: string }

type EditInitialData = {
  id: string
  name: string
  categoryName: string | null
  brandName: string | null
  model?: string
  allow_individual_booking: boolean
  total_quantity: number
  active: boolean
  notes?: string | null
  nicknames?: string | null
  price: number | null
  item_kind: InventoryItemKind
}

function buildEditValues(
  initialData: EditInitialData,
  categories: Array<Option>,
): FormValues {
  const catId =
    categories.find((c) => c.name === initialData.categoryName)?.id ?? null
  return {
    name: initialData.name,
    categoryId: catId,
    brandId: null,
    model: initialData.model ?? '',
    allow_individual_booking: initialData.allow_individual_booking,
    total_quantity: initialData.total_quantity,
    active: initialData.active,
    notes: initialData.notes ?? '',
    nicknames: initialData.nicknames ?? '',
    price: initialData.price,
    item_kind: initialData.item_kind,
  }
}

export default function AddItemDialog({
  open,
  onOpenChange,
  companyId,
  mode = 'create',
  initialData,
  onSaved,
  showTrigger = true,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
  mode?: 'create' | 'edit'
  initialData?: EditInitialData
  onSaved?: () => void
  showTrigger?: boolean
}) {
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { companyRole } = useAuthz()
  const { canWrite } = useCompanyWriteAccess()
  const isOwner = companyRole === 'owner' && canWrite

  const [brandName, setBrandName] = React.useState<string | null>(null)
  const [totalQuantityDraft, setTotalQuantityDraft] = React.useState<
    string | null
  >(null)
  const originalPriceRef = React.useRef<number | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      if (mode === 'edit') {
        setConfirmOpen(true)
      } else {
        await createMutation.mutateAsync(value)
      }
    },
  })

  const resetLocalState = React.useCallback(() => {
    setBrandName(null)
    setTotalQuantityDraft(null)
    originalPriceRef.current = null
  }, [])

  // ---- Load categories / brands for this company ----
  const {
    data: categories = [],
    isLoading: catLoading,
    error: catErr,
  } = useQuery({
    queryKey: ['company', companyId, 'item_categories'],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data as Array<Option>
    },
    staleTime: 60_000,
  })

  React.useEffect(() => {
    if (!open) return
    if (mode === 'create') {
      form.reset(defaultValues)
      resetLocalState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, mode])

  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return

    setBrandName(initialData.brandName)
    originalPriceRef.current = initialData.price ?? null

    if (initialData.brandName) {
      supabase
        .from('item_brands')
        .select('id, name')
        .eq('company_id', companyId)
        .ilike('name', initialData.brandName)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error('Failed to preload brand:', error)
            return
          }
          if (data) {
            form.setFieldValue('brandId', data.id)
          }
        })
    }

    form.reset(buildEditValues(initialData, categories), {
      keepDefaultValues: true,
    })
    // Depend on stable fields — InventoryInspector rebuilds initialData each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill when edit opens
  }, [
    open,
    mode,
    initialData?.id,
    initialData?.name,
    initialData?.price,
    initialData?.brandName,
    initialData?.categoryName,
    categories.length,
  ])

  const resolveBrandId = async (
    f: FormValues,
    currentBrandName: string | null,
  ) => {
    let brandId = f.brandId
    if (currentBrandName && currentBrandName.trim() && !brandId) {
      const brandNameTrimmed = currentBrandName.trim()
      const { data: existing, error: existingError } = await supabase
        .from('item_brands')
        .select('id')
        .eq('company_id', companyId)
        .ilike('name', brandNameTrimmed)
        .maybeSingle()
      if (existingError) throw existingError

      if (existing) {
        brandId = existing.id
      } else {
        const { data: newBrand, error: brandError } = await supabase
          .from('item_brands')
          .insert({
            company_id: companyId,
            name: brandNameTrimmed,
          })
          .select('id')
          .single()
        if (brandError) throw brandError
        brandId = newBrand.id
      }
    }
    return brandId
  }

  const createMutation = useMutation({
    mutationFn: async (f: FormValues) => {
      if (!companyId) throw new Error('No company selected')

      const brandId = await resolveBrandId(f, brandName)

      const { data: itemId, error } = await supabase.rpc(
        'create_item_with_price',
        {
          p_company_id: companyId,
          p_name: f.name,
          p_category_id: f.categoryId ?? undefined,
          p_brand_id: brandId ?? undefined,
          p_model: f.model || undefined,
          p_allow_individual_booking: f.allow_individual_booking,
          p_total_quantity: f.total_quantity || 0,
          p_active: f.active,
          p_notes: f.notes || undefined,
          p_nicknames: f.nicknames || undefined,
          p_price: f.price ?? undefined,
          p_effective_from: undefined,
        },
      )
      if (error) throw error

      if (itemId) {
        const { error: updateError } = await supabase
          .from('items')
          .update({ item_kind: f.item_kind })
          .eq('id', itemId)
        if (updateError) throw updateError

        try {
          const { logActivity } = await import('@features/latest/api/queries')
          await logActivity({
            companyId,
            activityType: 'inventory_item_created',
            metadata: {
              item_id: itemId,
              item_name: f.name,
              category: f.categoryId
                ? categories.find((c) => c.id === f.categoryId)?.name
                : null,
            },
            title: f.name,
          })
        } catch (logErr) {
          console.error('Failed to log activity:', logErr)
        }
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'items'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'item_brands'],
          exact: false,
        }),
      ])
      form.reset(defaultValues)
      resetLocalState()
      onOpenChange(false)
      success('Success!', 'Item was added to inventory')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to create item', e?.message ?? 'Please try again.')
    },
  })

  const editMutation = useMutation({
    mutationFn: async (f: FormValues) => {
      if (!companyId) throw new Error('No company selected')
      if (!initialData?.id) throw new Error('Missing item id')

      const brandId = await resolveBrandId(f, brandName)

      const { error: upErr } = await supabase
        .from('items')
        .update({
          name: f.name,
          category_id: f.categoryId ?? null,
          brand_id: brandId ?? null,
          model: f.model || null,
          allow_individual_booking: f.allow_individual_booking,
          total_quantity: f.total_quantity || 0,
          active: f.active,
          notes: f.notes || null,
          nicknames: f.nicknames || null,
          item_kind: f.item_kind,
        })
        .eq('company_id', companyId)
        .eq('id', initialData.id)

      if (upErr) throw upErr

      const newPrice =
        f.price === undefined ? originalPriceRef.current : f.price
      const changed = newPrice !== originalPriceRef.current

      if (changed && newPrice != null) {
        const { error: phErr } = await supabase
          .from('item_price_history')
          .insert({
            company_id: companyId,
            item_id: initialData.id,
            amount: newPrice,
          })
        if (phErr) throw phErr
      }
    },
    onSuccess: async () => {
      setBrandName(null)
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'inventory-detail'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'items'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'item_brands'],
          exact: false,
        }),
      ])
      onOpenChange(false)
      success('Saved', 'Item was updated.')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to update item', e?.message ?? 'Please try again.')
    },
  })

  const confirmAndSave = () => {
    setConfirmOpen(false)
    editMutation.mutate(form.state.values)
  }

  const autoPopulateFields = () => {
    const itemNames = [
      'XLR Cable 3m',
      'HDMI Cable 5m',
      'DMX Cable 10m',
      'Power Cable 2m',
      'USB-C Cable 1m',
      'Ethernet Cable 15m',
      'Audio Interface',
      'Microphone Stand',
      'Speaker Stand',
      'Light Stand',
      'Gobo Holder',
      'Color Gel',
      'Fog Machine',
      'Wireless Mic',
      'DI Box',
    ]
    const brands = [
      'Neutrik',
      'Mogami',
      'Canare',
      'Shure',
      'Sennheiser',
      'Yamaha',
      'Behringer',
      'Audio-Technica',
      'Rode',
      'Manfrotto',
    ]
    const models = [
      'Pro',
      'Standard',
      'Premium',
      'Elite',
      'X1',
      'X2',
      '2024',
      'Classic',
      'Plus',
      'Ultra',
    ]
    const notes = [
      'Test item for inventory management',
      'Used for production testing',
      'Standard equipment item',
      'Backup item in stock',
      'Primary equipment',
      'Reserve stock item',
    ]

    const randomName = itemNames[Math.floor(Math.random() * itemNames.length)]
    const randomBrand = brands[Math.floor(Math.random() * brands.length)]
    const randomModel = models[Math.floor(Math.random() * models.length)]
    const randomNotes = notes[Math.floor(Math.random() * notes.length)]
    const randomQuantity = Math.floor(Math.random() * 50) + 1
    const randomPrice = Math.floor(Math.random() * 5000) + 100
    const randomCategory =
      categories.length > 0
        ? categories[Math.floor(Math.random() * categories.length)]
        : null
    const isStock = Math.random() > 0.3

    form.reset({
      name: randomName,
      categoryId: randomCategory?.id ?? null,
      brandId: null,
      model: randomModel,
      allow_individual_booking: Math.random() > 0.5,
      total_quantity: isStock ? randomQuantity : 0,
      active: Math.random() > 0.2,
      notes: randomNotes,
      nicknames: '',
      price: randomPrice,
      item_kind: isStock ? 'stock' : 'subrental',
    })
    setBrandName(randomBrand)
  }

  const title = mode === 'edit' ? 'Edit item' : 'Add item to inventory'

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        {mode === 'create' && showTrigger && (
          <Dialog.Trigger>
            <Button size="2" variant="solid">
              <Plus /> Add item
            </Button>
          </Dialog.Trigger>
        )}

        <Dialog.Content maxWidth="640px">
          <Flex align="center" justify="between">
            <Dialog.Title>{title}</Dialog.Title>
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
          </Flex>
          <Dialog.Description size="2" color="gray" mt="1">
            Add item details, including category, brand, and pricing.
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Flex direction="column" gap="3" mt="1">
                <form.AppField name="name">
                  {(field) => (
                    <field.TextField label="Name" placeholder="e.g. XLR 3m" />
                  )}
                </form.AppField>

                <Flex gap="3" wrap="wrap">
                  <form.AppField name="categoryId">
                    {(field) => (
                      <Field label="Category">
                        <Select.Root
                          value={field.state.value ?? undefined}
                          onValueChange={(v) => {
                            if (v === '__new_category__') {
                              navigate({
                                to: '/company',
                                search: { tab: 'setup' },
                              })
                              onOpenChange(false)
                            } else {
                              field.handleChange(v)
                            }
                          }}
                          disabled={catLoading}
                        >
                          <Select.Trigger
                            placeholder={
                              catLoading ? 'Loading…' : 'Select category'
                            }
                            style={{ width: '100%' }}
                          />
                          <Select.Content style={{ zIndex: 10000 }}>
                            <Select.Group>
                              {categories.map((c: Option) => (
                                <Select.Item key={c.id} value={c.id}>
                                  {c.name}
                                </Select.Item>
                              ))}
                              {isOwner && (
                                <>
                                  <Select.Separator />
                                  <Select.Item value="__new_category__">
                                    + New category
                                  </Select.Item>
                                </>
                              )}
                            </Select.Group>
                          </Select.Content>
                        </Select.Root>
                      </Field>
                    )}
                  </form.AppField>

                  <Field label="Brand">
                    <BrandAutocomplete
                      companyId={companyId}
                      value={brandName}
                      onChange={(name) => {
                        setBrandName(name)
                        if (!name) {
                          form.setFieldValue('brandId', null)
                        }
                      }}
                      onBrandIdChange={(id) =>
                        form.setFieldValue('brandId', id)
                      }
                      disabled={catLoading}
                      placeholder="Type brand name..."
                    />
                  </Field>

                  <form.AppField name="model">
                    {(field) => (
                      <field.TextField
                        label="Model"
                        placeholder="e.g. Pro, Standard, 2024"
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="item_kind">
                    {(field) => (
                      <Field label="Type">
                        <Select.Root
                          value={field.state.value}
                          onValueChange={(v: string) =>
                            field.handleChange(v as InventoryItemKind)
                          }
                        >
                          <Select.Trigger />
                          <Select.Content style={{ zIndex: 10000 }}>
                            <Select.Item value="stock">Stock</Select.Item>
                            <Select.Item value="subrental">
                              Subrental
                            </Select.Item>
                          </Select.Content>
                        </Select.Root>
                      </Field>
                    )}
                  </form.AppField>
                </Flex>

                <Flex gap="3" wrap="wrap">
                  <form.AppField name="allow_individual_booking">
                    {(field) => (
                      <field.Switch label="Allow individual booking" />
                    )}
                  </form.AppField>

                  <form.AppField name="active">
                    {(field) => <field.Switch label="Active" />}
                  </form.AppField>

                  <form.Subscribe
                    selector={(state) => state.values.total_quantity}
                  >
                    {(totalQuantity) => (
                      <Field label="Total quantity">
                        <TextField.Root
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={totalQuantityDraft ?? String(totalQuantity)}
                          onChange={(e) => {
                            const nextValue = e.target.value
                            setTotalQuantityDraft(nextValue)
                            if (nextValue === '') return
                            const parsed = Number(nextValue)
                            if (Number.isNaN(parsed)) return
                            form.setFieldValue(
                              'total_quantity',
                              Math.max(0, parsed),
                            )
                            setTotalQuantityDraft(null)
                          }}
                          onBlur={() => {
                            if (totalQuantityDraft === '') {
                              setTotalQuantityDraft(null)
                            }
                          }}
                        />
                      </Field>
                    )}
                  </form.Subscribe>
                </Flex>

                <Flex gap="3" wrap="wrap">
                  <form.AppField name="price">
                    {(field) => (
                      <Field
                        label={
                          mode === 'edit'
                            ? 'Price (creates history if changed)'
                            : 'Price'
                        }
                      >
                        <TextField.Root
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 199.00"
                          value={
                            field.state.value == null
                              ? ''
                              : String(field.state.value)
                          }
                          onChange={(e) =>
                            field.handleChange(
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </Field>
                    )}
                  </form.AppField>
                </Flex>

                <form.AppField name="notes">
                  {(field) => (
                    <field.TextArea
                      label="Notes"
                      rows={3}
                      placeholder="Optional notes…"
                    />
                  )}
                </form.AppField>

                <form.AppField name="nicknames">
                  {(field) => (
                    <field.TextArea
                      label="Nicknames (search keywords)"
                      rows={2}
                      placeholder="e.g. audio, cable, xlrf, backup"
                    />
                  )}
                </form.AppField>

                {(catErr || createMutation.isError || editMutation.isError) && (
                  <Text color="red">
                    {catErr?.message ||
                      createMutation.error?.message ||
                      editMutation.error?.message ||
                      'Failed'}
                  </Text>
                )}
              </Flex>

              <Flex gap="2" mt="4" justify="end">
                <Dialog.Close>
                  <Button type="button" variant="soft">
                    Cancel
                  </Button>
                </Dialog.Close>
                <form.SubmitButton
                  label={mode === 'edit' ? 'Save' : 'Create'}
                  pendingLabel="Saving…"
                />
              </Flex>
            </form.AppForm>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Save changes?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            You're about to update this item. If you changed the price, a new
            price history entry will be added. Are you sure you want to
            continue?
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button variant="solid" onClick={confirmAndSave}>
                Yes, save
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
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
    <div style={{ flex: '1 1', minWidth: 160 }}>
      <Text
        as="label"
        size="2"
        color="gray"
        style={{ display: 'block', marginBottom: 6 }}
      >
        {label}
      </Text>
      {children}
    </div>
  )
}
