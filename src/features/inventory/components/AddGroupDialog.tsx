// src/features/inventory/components/AddGroupDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Grid,
  IconButton,
  Select,
  Separator,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Plus, Sparks, Trash } from 'iconoir-react'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import type { InventoryItemKind } from '../api/queries'

type Option = { id: string; name: string }
type PickerItem = {
  id: string
  name: string
  current_price: number | null
  on_hand: number | null
  type: 'item' | 'group'
  category_name?: string | null
  brand_name?: string | null
  model?: string | null
  description?: string | null
  nicknames?: string | null
}
type Part = {
  item_id: string | null
  child_group_id: string | null
  item_name: string
  quantity: number
  unit_price: number | null
  part_type: 'item' | 'group'
}
type ScalarFormValues = {
  name: string
  categoryId: string | null
  description: string
  active: boolean
  price: number | null
  item_kind: InventoryItemKind
}

type FormState = ScalarFormValues & { parts: Array<Part> }

const defaultValues: ScalarFormValues = {
  name: '',
  categoryId: null,
  description: '',
  active: true,
  price: null,
  item_kind: 'stock',
}

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  categoryId: z.string().nullable(),
  description: z.string(),
  active: z.boolean(),
  price: z.number().nullable(),
  item_kind: z.enum(['stock', 'subrental']),
})

type EditInitialData = {
  id: string
  name: string
  categoryName: string | null
  description: string | null
  active: boolean
  price: number | null
  parts: Array<{
    item_id: string | null
    child_group_id: string | null
    item_name: string
    quantity: number
    item_current_price: number | null
    part_type: 'item' | 'group'
  }>
  item_kind: InventoryItemKind
}

export default function AddGroupDialog({
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
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const fmtCurrency = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 2,
      }),
    [],
  )

  const [parts, setParts] = React.useState<Array<Part>>([])
  const [partQuantityDrafts, setPartQuantityDrafts] = React.useState<
    Record<string, string>
  >({})

  const escapeForPostgrestOr = React.useCallback((value: string) => {
    return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
  }, [])

  const originalPriceRef = React.useRef<number | null>(null)

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      const payload: FormState = { ...value, parts }
      if (mode === 'create') {
        await createMutation.mutateAsync(payload)
      } else {
        await editMutation.mutateAsync(payload)
      }
    },
  })

  const resetLocalState = React.useCallback(() => {
    setParts([])
    setPartQuantityDrafts({})
    originalPriceRef.current = null
  }, [])

  /* -------- Categories -------- */
  const { data: categories = [] } = useQuery({
    queryKey: ['company', companyId, 'item_categories'],
    enabled: !!companyId && open,
    queryFn: async (): Promise<Array<Option>> => {
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

  /* -------- Item and Group search (picker) -------- */
  const [search, setSearch] = React.useState('')
  const matchesSearch = React.useCallback((item: PickerItem, term: string) => {
    const normalized = term.trim().toLowerCase()
    if (!normalized) return true
    return [
      item.name,
      item.category_name,
      item.brand_name,
      item.model,
      item.description,
      item.nicknames,
    ].some((value) => value?.toLowerCase().includes(normalized))
  }, [])
  const { data: pickerItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['company', companyId, 'picker-items-groups', search],
    enabled: !!companyId && open,
    queryFn: async (): Promise<Array<PickerItem>> => {
      let brandIds: Array<string> = []
      let categoryIds: Array<string> = []
      if (search) {
        const { data: brandMatches, error: brandErr } = await supabase
          .from('item_brands')
          .select('id')
          .eq('company_id', companyId)
          .ilike('name', `%${search}%`)
          .limit(20)
        if (brandErr) throw brandErr
        brandIds = brandMatches.map((b) => b.id)

        const { data: categoryMatches, error: categoryErr } = await supabase
          .from('item_categories')
          .select('id')
          .eq('company_id', companyId)
          .ilike('name', `%${search}%`)
          .limit(20)
        if (categoryErr) throw categoryErr
        categoryIds = categoryMatches.map((c) => c.id)
      }

      // Fetch items with on_hand from items table
      let itemsQ = supabase
        .from('items')
        .select(
          'id, name, total_quantity, model, notes, nicknames, item_brands(name), item_categories(name)',
        )
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .limit(20)

      if (search) {
        const termSafe = escapeForPostgrestOr(search)
        const filters = [
          `name.ilike.%${termSafe}%`,
          `model.ilike.%${termSafe}%`,
          `notes.ilike.%${termSafe}%`,
          `nicknames.ilike.%${termSafe}%`,
        ]
        if (brandIds.length) {
          filters.push(`brand_id.in.(${brandIds.join(',')})`)
        }
        if (categoryIds.length) {
          filters.push(`category_id.in.(${categoryIds.join(',')})`)
        }
        itemsQ = itemsQ.or(filters.join(','))
      }

      const { data: itemsData, error: itemsError } = await itemsQ
      if (itemsError) throw itemsError

      // Fetch groups (exclude the current group being edited to prevent self-reference)
      let groupsQ = supabase
        .from('item_groups')
        .select('id, name, description')
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .limit(20)

      if (search) {
        const termSafe = escapeForPostgrestOr(search)
        groupsQ = groupsQ.or(
          `name.ilike.%${termSafe}%,description.ilike.%${termSafe}%`,
        )
      }
      if (mode === 'edit' && initialData?.id) {
        groupsQ = groupsQ.neq('id', initialData.id) // Prevent self-reference
      }

      const { data: groupsData, error: groupsError } = await groupsQ
      if (groupsError) throw groupsError

      // Get prices for items
      const itemIds = itemsData.map((r) => r.id)
      let prices: Record<string, number | null> = {}
      if (itemIds.length) {
        const { data: cp, error: cpErr } = await supabase
          .from('item_current_price')
          .select('item_id, current_price')
          .in('item_id', itemIds)
        if (cpErr) throw cpErr
        prices = cp.reduce((acc: Record<string, number | null>, r) => {
          if (r.item_id) {
            acc[r.item_id] = r.current_price
          }
          return acc
        }, {})
      }

      // Get prices for groups
      const groupIds = groupsData.map((r) => r.id)
      let groupPrices: Record<string, number | null> = {}
      if (groupIds.length) {
        const { data: gcp, error: gcpErr } = await supabase
          .from('group_current_price')
          .select('group_id, current_price')
          .in('group_id', groupIds)
        if (gcpErr) throw gcpErr
        groupPrices = gcp.reduce((acc: Record<string, number | null>, r) => {
          if (r.group_id) {
            acc[r.group_id] = r.current_price
          }
          return acc
        }, {})
      }

      // Combine items and groups
      const items = itemsData.map((r) => ({
        id: r.id,
        name: r.name,
        current_price: r.id ? (prices[r.id] ?? null) : null,
        on_hand: r.total_quantity ?? null,
        type: 'item' as const,
        category_name: r.item_categories?.name ?? null,
        brand_name: r.item_brands?.name ?? null,
        model: r.model ?? null,
        description: r.notes ?? null,
        nicknames: r.nicknames ?? null,
      }))

      const groups = groupsData.map((r) => ({
        id: r.id,
        name: r.name,
        current_price: r.id ? (groupPrices[r.id] ?? null) : null,
        on_hand: null, // Groups don't have on_hand in the same way
        type: 'group' as const,
        description: r.description ?? null,
      }))

      return [...items, ...groups]
    },
    staleTime: 15_000,
  })

  /* -------- Reset form in CREATE mode when dialog opens -------- */
  React.useEffect(() => {
    if (!open) return
    if (mode === 'create') {
      form.reset(defaultValues)
      resetLocalState()
      setSearch('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, mode])

  /* -------- Prefill in EDIT mode -------- */
  React.useEffect(() => {
    if (!open || mode !== 'edit' || !initialData) return
    const catId =
      categories.find((c) => c.name === initialData.categoryName)?.id ?? null

    originalPriceRef.current = initialData.price ?? null

    const newParts = initialData.parts.map((p) => ({
      item_id: p.item_id ?? null,
      child_group_id: p.child_group_id ?? null,
      item_name: p.item_name,
      quantity: p.quantity,
      unit_price: p.item_current_price,
      part_type: p.part_type ? p.part_type : p.item_id ? 'item' : 'group',
    }))

    form.reset(
      {
        name: initialData.name,
        categoryId: catId,
        description: initialData.description || '',
        active: initialData.active,
        price: initialData.price,
        item_kind: initialData.item_kind,
      },
      { keepDefaultValues: true },
    )
    setParts(newParts)
    // Depend on stable fields — InventoryInspector rebuilds initialData each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill when edit opens
  }, [
    open,
    mode,
    initialData?.id,
    initialData?.name,
    initialData?.price,
    initialData?.categoryName,
    categories.length,
  ])

  /* -------- Create mutation -------- */
  const createMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')

      let groupId: string | undefined

      // 1) Create or update group row
      if (f.price != null && !Number.isNaN(Number(f.price))) {
        // If price is set, use upsert with price
        const { data: g, error: gErr } = await supabase
          .from('item_groups')
          .insert({
            company_id: companyId,
            name: f.name.trim(),
            category_id: f.categoryId,
            description: f.description || null,
            active: f.active,
            item_kind: f.item_kind,
          })
          .select('id')
          .single()
        if (gErr) throw gErr
        groupId = g.id
      } else {
        // Fallback (rare)
        const { data: g, error: gErr } = await supabase
          .from('item_groups')
          .insert({
            company_id: companyId,
            name: f.name.trim(),
            category_id: f.categoryId,
            description: f.description || null,
            active: f.active,
            item_kind: f.item_kind,
          })
          .select('id')
          .single()
        if (gErr) throw gErr
        groupId = g.id
      }

      if (f.parts.length && groupId) {
        const { error: giErr } = await supabase.from('group_items').insert(
          f.parts.map((p) => ({
            group_id: groupId,
            item_id: p.item_id ?? undefined,
            child_group_id: p.child_group_id ?? undefined,
            quantity: p.quantity,
          })) as any, // Type assertion needed until DB types are regenerated
        )
        if (giErr) {
          await supabase.from('item_groups').delete().eq('id', groupId)
          throw giErr
        }
      }

      if (f.price != null && !Number.isNaN(Number(f.price)) && groupId) {
        const { error: gpErr } = await supabase
          .from('group_price_history')
          .insert({
            company_id: companyId,
            group_id: groupId,
            amount: f.price,
          })
        if (gpErr) {
          await supabase.from('item_groups').delete().eq('id', groupId)
          throw gpErr
        }
      }

      // Log activity
      if (groupId) {
        try {
          const { logActivity } = await import('@features/latest/api/queries')
          await logActivity({
            companyId,
            activityType: 'inventory_group_created',
            metadata: {
              group_id: groupId,
              group_name: f.name.trim(),
              category: f.categoryId
                ? categories.find((c) => c.id === f.categoryId)?.name
                : null,
            },
            title: f.name.trim(),
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
          queryKey: ['company', companyId, 'groups'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
      resetLocalState()
      setSearch('')
      form.reset(defaultValues)
      onOpenChange(false)
      success('Group created', 'Your group was added successfully.')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to create group', e?.message ?? 'Please try again.')
    },
  })

  /* -------- Edit mutation -------- */
  const editMutation = useMutation({
    mutationFn: async (f: FormState) => {
      if (!companyId) throw new Error('No company selected')
      if (!initialData?.id) throw new Error('Missing group id')

      // 1) Update the group row
      const { error: upErr } = await supabase
        .from('item_groups')
        .update({
          name: f.name.trim(),
          category_id: f.categoryId,
          description: f.description || null,
          active: f.active,
          item_kind: f.item_kind,
        })
        .eq('company_id', companyId)
        .eq('id', initialData.id)
      if (upErr) throw upErr

      // 2) Replace parts: delete all then insert current set
      const { error: delErr } = await supabase
        .from('group_items')
        .delete()
        .eq('group_id', initialData.id)
      if (delErr) throw delErr

      if (f.parts.length) {
        const { error: insErr } = await supabase.from('group_items').insert(
          f.parts.map((p) => ({
            group_id: initialData.id,
            item_id: p.item_id ?? undefined,
            child_group_id: p.child_group_id ?? undefined,
            quantity: p.quantity,
          })) as any, // Type assertion needed until DB types are regenerated
        )
        if (insErr) throw insErr
      }

      // 3) Price history when changed
      const newPrice = f.price
      const changed = (newPrice ?? null) !== (originalPriceRef.current ?? null)

      if (changed && newPrice != null) {
        const { error: phErr } = await supabase
          .from('group_price_history')
          .insert({
            company_id: companyId,
            group_id: initialData.id,
            amount: newPrice,
          })
        if (phErr) throw phErr
      }
    },
    onSuccess: async () => {
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
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
      onOpenChange(false)
      success('Group updated', 'Your group was updated successfully.')
      onSaved?.()
    },
    onError: (e: any) => {
      toastError('Failed to update group', e?.message ?? 'Please try again.')
    },
  })

  /* -------- Add part handler -------- */
  const handleAddPart = (selected: PickerItem) => {
    const existing = parts.find(
      (p) =>
        (selected.type === 'item' && p.item_id === selected.id) ||
        (selected.type === 'group' && p.child_group_id === selected.id),
    )
    if (existing) {
      setParts(
        parts.map((p) =>
          p === existing ? { ...p, quantity: p.quantity + 1 } : p,
        ),
      )
    } else {
      setParts([
        ...parts,
        {
          item_id: selected.type === 'item' ? selected.id : null,
          child_group_id: selected.type === 'group' ? selected.id : null,
          item_name: selected.name,
          quantity: 1,
          unit_price: selected.current_price,
          part_type: selected.type,
        },
      ])
    }
    setSearch('')
  }

  /* -------- Remove part handler -------- */
  const handleRemovePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index))
    setPartQuantityDrafts({})
  }

  const partKey = (part: Part, index: number) =>
    `${part.part_type}:${part.item_id ?? part.child_group_id ?? 'row'}:${index}`

  /* -------- Update part quantity -------- */
  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    setParts(parts.map((p, i) => (i === index ? { ...p, quantity } : p)))
  }

  // ===== TESTING ONLY: Auto-populate function =====
  // TODO: Remove this function and button when testing is complete
  const autoPopulateFields = () => {
    const groupNames = [
      'Stage Box 8ch',
      'PA System Basic',
      'Lighting Rig Standard',
      'Video Production Kit',
      'Sound Recording Setup',
      'Streaming Equipment',
      'Conference AV Package',
      'Stage Monitor System',
      'Wireless Mic Package',
      'DJ Equipment Bundle',
    ]
    const descriptions = [
      'Complete stage box setup with 8 channels',
      'Basic PA system for small venues',
      'Standard lighting rig for events',
      'Full video production equipment package',
      'Professional sound recording setup',
      'Complete streaming equipment bundle',
      'Conference AV equipment package',
      'Stage monitor system setup',
      'Wireless microphone package',
      'DJ equipment bundle',
    ]

    const randomName = groupNames[Math.floor(Math.random() * groupNames.length)]
    const randomDescription =
      descriptions[Math.floor(Math.random() * descriptions.length)]
    const randomPrice = Math.floor(Math.random() * 10000) + 1000
    const isStock = Math.random() > 0.3 // 70% chance of being stock

    // Set random category if available
    const randomCategory =
      categories.length > 0
        ? categories[Math.floor(Math.random() * categories.length)]
        : null

    form.reset({
      name: randomName,
      categoryId: randomCategory?.id ?? null,
      description: randomDescription,
      active: Math.random() > 0.2,
      price: randomPrice,
      item_kind: isStock ? 'stock' : 'subrental',
    })
    setParts([])
  }
  // ===== END TESTING ONLY =====

  /* -------- Render -------- */
  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        {/* Only render trigger in CREATE mode when showTrigger is true; in EDIT the parent opens it */}
        {mode === 'create' && showTrigger && (
          <Dialog.Trigger>
            <Button size="2" variant="solid">
              <Plus /> Add group
            </Button>
          </Dialog.Trigger>
        )}

        <Dialog.Content style={{ maxWidth: 1000 }}>
          <Flex align="center" justify="between">
            <Dialog.Title>
              {mode === 'create' ? 'Create Group' : 'Edit Group'}
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
              <Grid columns="2" gap="4" mt="4">
                <Flex direction="column" gap="3">
                  <form.AppField name="name">
                    {(field) => <field.TextField placeholder="Group name" />}
                  </form.AppField>

                  <form.Subscribe selector={(state) => state.values.categoryId}>
                    {(categoryId) => (
                      <Select.Root
                        value={categoryId ?? '__none__'}
                        onValueChange={(value) =>
                          form.setFieldValue(
                            'categoryId',
                            value === '__none__' ? null : value,
                          )
                        }
                      >
                        <Select.Trigger>
                          {categoryId
                            ? categories.find((c) => c.id === categoryId)
                                ?.name || 'Category (optional)'
                            : 'Category (optional)'}
                        </Select.Trigger>
                        <Select.Content style={{ zIndex: 10000 }}>
                          <Select.Item value="__none__">None</Select.Item>
                          {categories.map((cat) => (
                            <Select.Item key={cat.id} value={cat.id}>
                              {cat.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Root>
                    )}
                  </form.Subscribe>

                  <form.AppField name="description">
                    {(field) => (
                      <field.TextArea
                        placeholder="Description (optional)"
                        rows={3}
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="active">
                    {(field) => <field.Checkbox label="Active" />}
                  </form.AppField>

                  <form.AppField name="price">
                    {(field) => (
                      <TextField.Root
                        type="number"
                        placeholder="Price (optional)"
                        value={field.state.value ?? ''}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    )}
                  </form.AppField>

                  <Separator />
                  <Text size="2" weight="bold">
                    Type
                  </Text>
                  <form.AppField name="item_kind">
                    {(field) => (
                      <Select.Root
                        value={field.state.value}
                        onValueChange={(v: string) =>
                          field.handleChange(v as InventoryItemKind)
                        }
                      >
                        <Select.Trigger />
                        <Select.Content style={{ zIndex: 10000 }}>
                          <Select.Item value="stock">Stock</Select.Item>
                          <Select.Item value="subrental">Subrental</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    )}
                  </form.AppField>

                  <Flex gap="2" justify="end" mt="auto">
                    <Button
                      type="button"
                      variant="soft"
                      onClick={() => onOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <form.SubmitButton
                      label={mode === 'create' ? 'Create' : 'Update'}
                      pendingLabel="Saving…"
                    />
                  </Flex>
                </Flex>

                {/* RIGHT COLUMN: Parts Search and List */}
                <Flex direction="column" gap="3">
                  <Text size="2" weight="bold">
                    Parts
                  </Text>

                  {/* Parts Search */}
                  <Flex direction="column" gap="2">
                    <Text size="2" color="gray">
                      Search & Add
                    </Text>
                    <Box style={{ position: 'relative' }}>
                      <Flex gap="2">
                        <TextField.Root
                          placeholder="Search items or groups..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        {itemsLoading && <Spinner />}
                      </Flex>

                      {search && (
                        <Box
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            marginTop: '4px',
                            border: '1px solid var(--gray-a6)',
                            borderRadius: '4px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            backgroundColor: 'var(--gray-1)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                            zIndex: 1000,
                          }}
                        >
                          {pickerItems
                            .filter((item) => matchesSearch(item, search))
                            .map((item) => (
                              <Box
                                key={item.id}
                                onClick={() => handleAddPart(item)}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--gray-a6)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    'var(--gray-a3)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    'transparent'
                                }}
                              >
                                <Flex direction="column" gap="1">
                                  <Flex justify="between" align="center">
                                    <Flex align="center" gap="2">
                                      <Text size="2" weight="medium">
                                        {item.name}
                                      </Text>
                                      {item.type === 'group' && (
                                        <Badge color="blue" size="1">
                                          Group
                                        </Badge>
                                      )}
                                    </Flex>
                                    {item.current_price != null && (
                                      <Text size="1" color="gray">
                                        {fmtCurrency.format(item.current_price)}
                                      </Text>
                                    )}
                                  </Flex>
                                  {item.type === 'item' &&
                                    item.on_hand != null && (
                                      <Text size="1" color="gray">
                                        On hand: {item.on_hand}
                                      </Text>
                                    )}
                                </Flex>
                              </Box>
                            ))}
                        </Box>
                      )}
                    </Box>
                  </Flex>

                  {/* Parts List */}
                  <Flex
                    direction="column"
                    gap="2"
                    style={{ flex: 1, minHeight: 0 }}
                  >
                    <Text size="2" color="gray">
                      Added Parts ({parts.length})
                    </Text>
                    {parts.length > 0 ? (
                      <Box
                        style={{
                          border: '1px solid var(--gray-a6)',
                          borderRadius: '4px',
                          flex: 1,
                          minHeight: 0,
                          overflowY: 'auto',
                        }}
                      >
                        <Table.Root size="1">
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeaderCell>
                                Name
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell>
                                Qty
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {parts.map((part, index) => (
                              <Table.Row key={index}>
                                <Table.Cell>
                                  <Flex direction="column" gap="1">
                                    <Flex align="center" gap="2">
                                      <Text size="2">{part.item_name}</Text>
                                      {part.part_type === 'group' && (
                                        <Badge color="blue" size="1">
                                          Group
                                        </Badge>
                                      )}
                                    </Flex>
                                    {part.unit_price != null && (
                                      <Text size="1" color="gray">
                                        {fmtCurrency.format(part.unit_price)}{' '}
                                        each
                                      </Text>
                                    )}
                                  </Flex>
                                </Table.Cell>
                                <Table.Cell>
                                  <TextField.Root
                                    type="number"
                                    value={
                                      partQuantityDrafts[
                                        partKey(part, index)
                                      ] ?? String(part.quantity)
                                    }
                                    onChange={(e) => {
                                      const nextValue = e.target.value
                                      const key = partKey(part, index)
                                      setPartQuantityDrafts((prev) => ({
                                        ...prev,
                                        [key]: nextValue,
                                      }))

                                      if (nextValue === '') return
                                      const parsed = Number(nextValue)
                                      if (Number.isNaN(parsed)) return

                                      handleUpdateQuantity(
                                        index,
                                        Math.max(1, parsed),
                                      )
                                      setPartQuantityDrafts((prev) => {
                                        const next = { ...prev }
                                        delete next[key]
                                        return next
                                      })
                                    }}
                                    onBlur={() => {
                                      const key = partKey(part, index)
                                      if (partQuantityDrafts[key] === '') {
                                        setPartQuantityDrafts((prev) => {
                                          const next = { ...prev }
                                          delete next[key]
                                          return next
                                        })
                                      }
                                    }}
                                    style={{ width: '60px' }}
                                    size="1"
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <IconButton
                                    size="1"
                                    color="red"
                                    variant="soft"
                                    onClick={() => handleRemovePart(index)}
                                  >
                                    <Trash width={14} height={14} />
                                  </IconButton>
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      </Box>
                    ) : (
                      <Box
                        style={{
                          border: '1px solid var(--gray-a6)',
                          borderRadius: '4px',
                          padding: '24px',
                          textAlign: 'center',
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text size="2" color="gray">
                          No parts added yet.
                          <br />
                          Search and click items to add them.
                        </Text>
                      </Box>
                    )}
                  </Flex>
                </Flex>
              </Grid>
            </form.AppForm>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
