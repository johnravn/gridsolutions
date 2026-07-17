// src/features/inventory/components/EditCategoriesDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Dialog,
  Flex,
  IconButton,
  Separator,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { z } from 'zod'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import { Check, Edit, Trash, Xmark } from 'iconoir-react'

const defaultValues = { name: '' }

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
})

type ItemCategory = {
  id: string
  company_id: string
  name: string
}

export default function EditCategoriesDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  companyId: string
}) {
  const qc = useQueryClient()
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editingName, setEditingName] = React.useState<string>('')

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value)
    },
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  /* ---------- Load categories ---------- */
  const categoriesQueryKey = ['company', companyId, 'item-categories'] as const

  const {
    data: categories,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: categoriesQueryKey,
    enabled: !!companyId && open,
    queryFn: async (): Promise<Array<ItemCategory>> => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, company_id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    staleTime: 5_000,
  })

  /* ---------- Create ---------- */
  const createMutation = useMutation({
    mutationFn: async (f: typeof defaultValues) => {
      if (!companyId) throw new Error('No company selected')
      const { error } = await supabase.from('item_categories').insert({
        company_id: companyId,
        name: f.name.trim(),
      })
      if (error) throw error
    },
    onSuccess: async () => {
      form.reset(defaultValues)
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  /* ---------- Update (rename) ---------- */
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; name: string }) => {
      const { error } = await supabase
        .from('item_categories')
        .update({ name: payload.name.trim() })
        .eq('id', payload.id)
        .eq('company_id', companyId)
      if (error) throw error
    },
    onSuccess: async () => {
      setEditingId(null)
      setEditingName('')
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  /* ---------- Delete ---------- */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('item_categories')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: categoriesQueryKey })
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'inventory-index'],
        exact: false,
      })
    },
  })

  /* ---------- Render ---------- */
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger>
        <Button size="2" variant="outline">
          <Edit /> Edit categories
        </Button>
      </Dialog.Trigger>

      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Edit Categories</Dialog.Title>

        {/* List */}
        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            border: '1px solid var(--gray-a6)',
            borderRadius: 8,
            padding: 8,
            marginTop: 12,
          }}
        >
          {isLoading ? (
            <Flex align="center" justify="center" p="4">
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner size="2" />
              </Flex>
            </Flex>
          ) : isError ? (
            <Text color="red">
              {(error as any)?.message ?? 'Failed to load'}
            </Text>
          ) : (categories?.length ?? 0) === 0 ? (
            <Text color="gray">No categories yet.</Text>
          ) : (
            categories!.map((c, idx) => (
              <React.Fragment key={c.id}>
                {idx > 0 && <Separator my="2" />}
                <Flex align="center" gap="2" py="1">
                  {editingId === c.id ? (
                    <>
                      <TextField.Root
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        style={{ flex: 1 }}
                        autoFocus
                      />
                      <IconButton
                        size="2"
                        variant="soft"
                        title="Save"
                        disabled={
                          updateMutation.isPending ||
                          editingName.trim().length === 0
                        }
                        onClick={() =>
                          updateMutation.mutate({ id: c.id, name: editingName })
                        }
                      >
                        <Check />
                      </IconButton>
                      <IconButton
                        size="2"
                        variant="ghost"
                        title="Cancel"
                        onClick={() => {
                          setEditingId(null)
                          setEditingName('')
                        }}
                      >
                        <Xmark />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Text style={{ flex: 1 }}>{c.name}</Text>
                      <IconButton
                        size="2"
                        variant="soft"
                        title="Edit name"
                        onClick={() => {
                          setEditingId(c.id)
                          setEditingName(c.name)
                        }}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="2"
                        color="red"
                        variant="soft"
                        title="Delete"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(c.id)}
                      >
                        <Trash />
                      </IconButton>
                    </>
                  )}
                </Flex>
              </React.Fragment>
            ))
          )}
        </div>

        {/* Create */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <form.AppForm>
            <Flex direction="column" gap="3" mt="3">
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    label="New category name"
                    placeholder="e.g. Audio"
                  />
                )}
              </form.AppField>

              {(createMutation.isError ||
                updateMutation.isError ||
                deleteMutation.isError) && (
                <Text color="red">
                  {(createMutation.error as any)?.message ||
                    (updateMutation.error as any)?.message ||
                    (deleteMutation.error as any)?.message ||
                    'Something went wrong'}
                </Text>
              )}
            </Flex>

            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button type="button" variant="soft">
                  Close
                </Button>
              </Dialog.Close>
              <form.SubmitButton label="Create" pendingLabel="Saving…" />
            </Flex>
          </form.AppForm>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
