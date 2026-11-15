import { supabase } from '@shared/api/supabase'
import type {
  GroupDetail,
  GroupPartRow,
  InventoryIndexRow,
  ItemDetail,
  ItemPriceHistoryRow,
} from './queries'

export async function fetchInventoryIndexRow({
  companyId,
  id,
}: {
  companyId: string
  id: string
}): Promise<InventoryIndexRow | null> {
  const { data: base, error: baseErr } = await supabase
    .from('inventory_index')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', id)
    .maybeSingle<InventoryIndexRow>()

  if (baseErr) throw baseErr
  return base ?? null
}

export async function enrichItemDetail({
  base,
  companyId,
  id,
}: {
  base: InventoryIndexRow
  companyId: string
  id: string
}): Promise<ItemDetail> {
  // Optional enrich: notes, model, flags from base table (might be RLS'd)
  const { data: itemMeta } = await supabase
    .from('items')
    .select(
      `
              id,
              model,
              notes,
              nicknames,
              allow_individual_booking,
              active
            `,
    )
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle<{
      id: string
      model: string | null
      notes: string | null
      nicknames: string | null
      allow_individual_booking: boolean | null
      active: boolean | null
    }>()

  const { data: hist, error: hErr } = await supabase
    .from('item_price_history_with_profile')
    .select('id, amount, effective_from, effective_to, set_by, set_by_name')
    .eq('company_id', companyId)
    .eq('item_id', id)
    .order('effective_from', { ascending: false })
  if (hErr) throw hErr

  return {
    id: base.id,
    name: base.name,
    type: 'item',
    category_name: base.category_name ?? null,
    brand_name: base.brand_name ?? null,
    model: itemMeta?.model ?? null,
    allow_individual_booking: Boolean(
      itemMeta?.allow_individual_booking ?? base.allow_individual_booking,
    ),
    active: Boolean(itemMeta?.active ?? base.active),
    notes: itemMeta?.notes ?? null,
    nicknames: itemMeta?.nicknames ?? base.nicknames ?? null,
    current_price: base.current_price ?? null,
    on_hand: base.on_hand ?? 0,
    price_history: hist as Array<ItemPriceHistoryRow>,
    item_kind: base.item_kind,
  }
}

export async function enrichGroupDetail({
  base,
  companyId,
  id,
}: {
  base: InventoryIndexRow
  companyId: string
  id: string
}): Promise<GroupDetail> {
  const { data: gmeta } = await supabase
    .from('item_groups')
    .select('id, description, active')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle<{
      id: string
      description: string | null
      active: boolean | null
    }>()

  const { data: roll, error: rErr } = await supabase
    .from('groups_with_rollups')
    .select('on_hand, current_price')
    .eq('id', id)
    .maybeSingle<{
      on_hand: number | null
      current_price: number | null
    }>()
  if (rErr && rErr.code !== 'PGRST116') throw rErr

  const { data: parts, error: pErr } = await supabase
    .from('group_parts')
    .select(
      'item_id, child_group_id, item_name, quantity, item_current_price, part_type',
    )
    .eq('group_id', id)
  if (pErr) throw pErr

  const { data: ghist, error: ghErr } = await supabase
    .from('group_price_history_with_profile')
    .select('id, amount, effective_from, effective_to, set_by, set_by_name')
    .eq('company_id', companyId)
    .eq('group_id', id)
    .order('effective_from', { ascending: false })
  if (ghErr) throw ghErr

  return {
    id: base.id,
    name: base.name,
    type: 'group',
    on_hand: roll?.on_hand ?? base.on_hand ?? 0,
    current_price: roll?.current_price ?? base.current_price ?? null,
    category_name: base.category_name ?? null,
    description: gmeta?.description ?? null,
    active: Boolean(gmeta?.active ?? base.active),
    parts: parts as Array<GroupPartRow>,
    price_history: ghist as Array<ItemPriceHistoryRow>,
    item_kind: base.item_kind,
  }
}
