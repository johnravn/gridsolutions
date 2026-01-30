// src/features/inventory/components/AddInventoryDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Button,
  Dialog,
  Flex,
  Select,
  Switch,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useNavigate } from '@tanstack/react-router'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { Plus, Sparks } from 'iconoir-react'
import { partnerCustomersQuery } from '../api/partners'
import BrandAutocomplete from './BrandAutocomplete'

type FormState = {
  name: string
  categoryId?: string | null
  brandId?: string | null
  model?: string
  allow_individual_booking: boolean
  total_quantity: number
  active: boolean
  notes?: string
  nicknames?: string
  price?: number | null
  internally_owned: boolean
  external_owner_id: string | null
}

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
  internally_owned: boolean
  external_owner_id: string | null
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
  const isOwner = companyRole === 'owner'

  const [form, setForm] = React.useState<FormState>({
    name: '',
    categoryId: null,
    brandId: null,
    model: '',
    allow_individual_booking: true,
    total_quantity: 0,
    active: true,
    notes: '',
    nicknames: '',
    price: undefined,
    internally_owned: true,
    external_owner_id: null,
  })
  const [totalQuantityDraft, setTotalQuantityDraft] = React.useState<
    string | null
  >(null)
  // keep a stable ref of original price for change detection
  const originalPriceRef = React.useRef<number | null>(null)

  const set = <TKey extends keyof FormState>(
    key: TKey,
    value: FormState[TKey],
  ) => setForm((s) => ({ ...s, [key]: value }))

  // Reset form to initial state
  const resetForm = React.useCallback(() => {
    setForm({
      name: '',
      categoryId: null,
      brandId: null,
      model: '',
      allow_individual_booking: true,
      total_quantity: 0,
      active: true,
      notes: '',
      nicknames: '',
      price: undefined,
      internally_owned: true,
      external_owner_id: null,
    })
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

  // Brand name state (for autocomplete)
  const [brandName, setBrandName] = React.useState<string | null>(null)

  const { data: partners = [] } = useQuery({
    ...partnerCustomersQuery({ companyId: companyId }),
    enabled: !!companyId && open,
  })

  /* -------- Reset form in CREATE mode when dialog opens -------- */
  React.useEffect(() => {
    if (open && mode === 'create') {
      resetForm()
    }
  }, [open, mode, resetForm])

  // Prefill on EDIT (only once per dialog open)
  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    // try to map category name to ID once options are loaded
    const catId =
      categories.find((c) => c.name === initialData.categoryName)?.id ?? null

    // Set brand name directly (autocomplete will handle ID lookup)
    setBrandName(initialData.brandName)

    // Try to find brand ID if brand name exists
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
            set('brandId', data.id)
          }
        })
    }

    originalPriceRef.current = initialData.price ?? null

    setForm((prev) => {
      // Only update if values are different (prevents infinite loop)
      if (
        prev.name === initialData.name &&
        prev.categoryId === catId &&
        prev.model === (initialData.model ?? '') &&
        prev.allow_individual_booking ===
          initialData.allow_individual_booking &&
        prev.total_quantity === initialData.total_quantity &&
        prev.active === initialData.active &&
        prev.notes === (initialData.notes ?? '') &&
        prev.nicknames === (initialData.nicknames ?? '') &&
        prev.price === initialData.price
      ) {
        return prev
      }
      return {
        name: initialData.name,
        categoryId: catId,
        brandId: null, // Will be set by autocomplete
        model: initialData.model ?? '',
        allow_individual_booking: initialData.allow_individual_booking,
        total_quantity: initialData.total_quantity,
        active: initialData.active,
        notes: initialData.notes ?? '',
        nicknames: initialData.nicknames ?? '',
        price: initialData.price,
        internally_owned: initialData.internally_owned,
        external_owner_id: initialData.external_owner_id ?? null,
      }
    })
    // Only run this effect when dialog is opened in edit mode, or when categories are loaded
  }, [open, mode, initialData, categories])

  /* ---------------- CREATE ---------------- */
  const createMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')

      // If brand name exists but no brand ID, create or find the brand
      let brandId = f.brandId
      if (brandName && brandName.trim() && !brandId) {
        const brandNameTrimmed = brandName.trim()
        // Try to find existing brand first (case-insensitive)
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
          // Create new brand
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

      const { data: itemId, error } = await supabase.rpc(
        'create_item_with_price',
        {
          p_company_id: companyId,
          p_name: f.name,
          p_category_id: f.categoryId ?? null,
          p_brand_id: brandId ?? null,
          p_model: f.model || null,
          p_allow_individual_booking: f.allow_individual_booking,
          p_total_quantity: f.total_quantity || 0,
          p_active: f.active,
          p_notes: f.notes || null,
          p_nicknames: f.nicknames || null,
          p_price: f.price ?? null,
          p_effective_from: null,
        },
      )
      if (error) throw error

      // Update internally_owned and external_owner_id separately since the function doesn't support them
      if (itemId) {
        const { error: updateError } = await supabase
          .from('items')
          .update({
            internally_owned: f.internally_owned,
            external_owner_id: f.internally_owned ? null : f.external_owner_id,
          })
          .eq('id', itemId)
        if (updateError) throw updateError

        // Log activity
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
          // Don't fail the mutation if logging fails
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
      resetForm()
      onOpenChange(false)
      success('Success!', 'Item was added to inventory')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to create item', e?.message ?? 'Please try again.')
    },
  })

  /* ---------------- EDIT ---------------- */
  const editMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')
      if (!initialData?.id) throw new Error('Missing item id')

      // If brand name exists but no brand ID, create or find the brand
      let brandId = f.brandId
      if (brandName && brandName.trim() && !brandId) {
        const brandNameTrimmed = brandName.trim()
        // Try to find existing brand first (case-insensitive)
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
          // Create new brand
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

      // 1) Update the item row
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
          internally_owned: f.internally_owned,
          external_owner_id: f.internally_owned ? null : f.external_owner_id,
        })
        .eq('company_id', companyId)
        .eq('id', initialData.id)

      if (upErr) throw upErr

      // 2) Price history (only append if changed and provided)
      const newPrice =
        f.price === undefined ? originalPriceRef.current : f.price // if field untouched, treat as unchanged
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

  const loading = catLoading
  const saving =
    mode === 'create' ? createMutation.isPending : editMutation.isPending

  // Confirmation alert for EDIT mode
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const handleSave = () => {
    if (mode === 'edit') {
      setConfirmOpen(true)
    } else {
      createMutation.mutate(form)
    }
  }
  const confirmAndSave = () => {
    setConfirmOpen(false)
    editMutation.mutate(form)
  }

  // Auto-populate function for testing
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

    // Set random category if available
    const randomCategory =
      categories.length > 0
        ? categories[Math.floor(Math.random() * categories.length)]
        : null

    // Set random external owner if available and not internally owned
    const randomPartner =
      partners.length > 0
        ? partners[Math.floor(Math.random() * partners.length)]
        : null
    const isInternal = Math.random() > 0.3 // 70% chance of being internal

    setForm({
      name: randomName,
      categoryId: randomCategory?.id ?? null,
      brandId: null, // Will be set via brandName
      model: randomModel,
      allow_individual_booking: Math.random() > 0.5,
      total_quantity: randomQuantity,
      active: Math.random() > 0.2, // 80% chance of being active
      notes: randomNotes,
      nicknames: '',
      price: randomPrice,
      internally_owned: isInternal,
      external_owner_id: isInternal ? null : (randomPartner?.id ?? null),
    })

    // Set brand name for autocomplete
    setBrandName(randomBrand)
  }

  const title = mode === 'edit' ? 'Edit item' : 'Add item to inventory'
  const actionLabel =
    mode === 'edit'
      ? saving
        ? 'Saving…'
        : 'Save'
      : saving
        ? 'Saving…'
        : 'Create'

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        {/* Only render trigger in CREATE mode when showTrigger is true; in EDIT the parent opens it */}
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

          <Flex direction="column" gap="3" mt="1">
            {/* Name */}
            <Field label="Name">
              <TextField.Root
                placeholder="e.g. XLR 3m"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>

            <Flex gap="3" wrap="wrap">
              {/* Category */}
              <Field label="Category">
                <Select.Root
                  value={form.categoryId ?? undefined}
                  onValueChange={(v) => {
                    if (v === '__new_category__') {
                      navigate({ to: '/company', search: { tab: 'setup' } })
                      onOpenChange(false)
                    } else {
                      set('categoryId', v)
                    }
                  }}
                  disabled={loading}
                >
                  <Select.Trigger
                    placeholder={loading ? 'Loading…' : 'Select category'}
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

              {/* Brand */}
              <Field label="Brand">
                <BrandAutocomplete
                  companyId={companyId}
                  value={brandName}
                  onChange={(name) => {
                    setBrandName(name)
                    if (!name) {
                      set('brandId', null)
                    }
                  }}
                  onBrandIdChange={(id) => set('brandId', id)}
                  disabled={loading}
                  placeholder="Type brand name..."
                />
              </Field>

              {/* Model */}
              <Field label="Model">
                <TextField.Root
                  value={form.model ?? ''}
                  onChange={(e) => set('model', e.target.value)}
                  placeholder="e.g. Pro, Standard, 2024"
                />
              </Field>
              <Field label="Owner">
                <Select.Root
                  value={form.internally_owned ? 'internal' : 'external'}
                  onValueChange={(v: string) => {
                    const internal = v === 'internal'
                    set('internally_owned', internal)
                    if (internal) set('external_owner_id', null)
                  }}
                >
                  <Select.Trigger />
                  <Select.Content style={{ zIndex: 10000 }}>
                    <Select.Item value="internal">Internal</Select.Item>
                    <Select.Item value="external">External</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field>

              <Field label="External owner">
                <Select.Root
                  value={form.external_owner_id ?? undefined}
                  onValueChange={(v) => set('external_owner_id', v)}
                  disabled={form.internally_owned}
                >
                  <Select.Trigger placeholder="Select partner…" />
                  <Select.Content style={{ zIndex: 10000 }}>
                    <Select.Group>
                      {partners.map((p) => (
                        <Select.Item key={p.id} value={p.id}>
                          {p.name}
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Content>
                </Select.Root>
              </Field>
            </Flex>

            <Flex gap="3" wrap="wrap">
              <Field label="Allow individual booking">
                <Switch
                  checked={form.allow_individual_booking}
                  onCheckedChange={(v) =>
                    set('allow_individual_booking', Boolean(v))
                  }
                />
              </Field>

              <Field label="Active">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => set('active', Boolean(v))}
                />
              </Field>

              <Field label="Total quantity">
                <TextField.Root
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={totalQuantityDraft ?? String(form.total_quantity)}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    setTotalQuantityDraft(nextValue)

                    if (nextValue === '') return
                    const parsed = Number(nextValue)
                    if (Number.isNaN(parsed)) return

                    set('total_quantity', Math.max(0, parsed))
                    setTotalQuantityDraft(null)
                  }}
                  onBlur={() => {
                    if (totalQuantityDraft === '') {
                      setTotalQuantityDraft(null)
                    }
                  }}
                />
              </Field>
            </Flex>

            {/* Price */}
            <Flex gap="3" wrap="wrap">
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
                  value={form.price == null ? '' : String(form.price)}
                  onChange={(e) =>
                    set(
                      'price',
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                />
              </Field>
            </Flex>

            <Field label="Notes">
              <TextArea
                rows={3}
                value={form.notes ?? ''}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Optional notes…"
              />
            </Field>

            <Field label="Nicknames (search keywords)">
              <TextArea
                rows={2}
                value={form.nicknames ?? ''}
                onChange={(e) => set('nicknames', e.target.value)}
                placeholder="e.g. audio, cable, xlrf, backup"
              />
            </Field>

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
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              onClick={handleSave}
              disabled={!form.name || saving}
              variant="solid"
            >
              {actionLabel}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* Confirm on edit */}
      <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Save changes?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            You’re about to update this item. If you changed the price, a new
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

/** Small helper for tidy label + control layout */
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
