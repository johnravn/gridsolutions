import { supabase } from '@shared/api/supabase'
import { fuzzySearch } from '@shared/lib/generalFunctions'
import { postgrestIlikePatterns } from '../components/dialogs/technical-offer-editor/utils'

export type InventorySearchHit = {
  id: string
  name: string
  is_group: boolean
  on_hand: number | null
  price: number | null
  item_kind: 'stock' | 'subrental'
  brand_name: string | null
  model: string | null
  nicknames?: string | null
  category_name?: string | null
}

export type InventorySearchOptions = {
  subrentalOnly?: boolean
  categoryName?: string | null
}

export async function searchInventoryItems(
  companyId: string,
  term: string,
  options: InventorySearchOptions = {},
): Promise<Array<InventorySearchHit>> {
  const query = term.trim()
  if (!query) return []

  const patterns = postgrestIlikePatterns(query)
  const conditions = patterns.flatMap((pattern) => [
    `name.ilike.${pattern}`,
    `category_name.ilike.${pattern}`,
    `brand_name.ilike.${pattern}`,
    `model.ilike.${pattern}`,
    `nicknames.ilike.${pattern}`,
  ])

  let q = supabase
    .from('inventory_index')
    .select(
      `
      id,
      name,
      is_group,
      on_hand,
      current_price,
      item_kind,
      brand_name,
      model,
      nicknames,
      category_name
    `,
    )
    .eq('company_id', companyId)
    .eq('active', true)
    .or('deleted.is.null,deleted.eq.false')
    .or('is_group.eq.true,allow_individual_booking.eq.true')

  if (options.subrentalOnly) q = q.eq('item_kind', 'subrental')
  if (options.categoryName) q = q.eq('category_name', options.categoryName)

  const { data, error } = await q.or(conditions.join(',')).limit(50)

  if (error) throw error

  const mapped: Array<InventorySearchHit> = (data ?? [])
    .filter((row) => !!row.id && !!row.name)
    .map((row) => ({
      id: row.id as string,
      name: row.name as string,
      is_group: !!row.is_group,
      on_hand: row.on_hand != null ? Number(row.on_hand) : null,
      price: row.current_price ?? null,
      item_kind: row.item_kind ?? 'stock',
      brand_name: row.brand_name ?? null,
      model: row.model ?? null,
      nicknames: row.nicknames ?? null,
      category_name: row.category_name ?? null,
    }))

  return fuzzySearch(
    mapped,
    query,
    [
      (item) => item.name,
      (item) => item.category_name,
      (item) => item.brand_name,
      (item) => item.model,
      (item) => item.nicknames,
    ],
    0.25,
  ).slice(0, 20)
}
