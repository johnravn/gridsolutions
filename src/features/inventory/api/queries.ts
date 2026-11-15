import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { postgrestIlikePatterns } from '@shared/api/fuzzySearch'
import {
  enrichGroupDetail,
  enrichItemDetail,
  fetchInventoryIndexRow,
} from './inventoryDetail'

export const inventoryIndexKey = (
  companyId: string,
  page: number,
  pageSize: number,
  search: string,
  showActive: boolean,
  showInactive: boolean,
  showStock: boolean,
  showSubrental: boolean,
  showGroupOnlyItems: boolean,
  showGroups: boolean,
  showItems: boolean,
  category: string | null,
  sortBy: SortBy,
  sortDir: SortDir,
) =>
  [
    'company',
    companyId,
    'inventory-index',
    page,
    pageSize,
    search,
    showActive,
    showInactive,
    showStock,
    showSubrental,
    showGroupOnlyItems,
    showGroups,
    showItems,
    category,
    sortBy,
    sortDir,
  ] as const

export const inventoryDetailKey = (companyId: string, id: string) =>
  ['company', companyId, 'inventory-detail', id] as const

/* ------------ Types (aligned to the views) ------------ */

export type InventoryItemKind = 'stock' | 'subrental'

export type InventoryIndexRow = {
  company_id: string
  id: string
  name: string
  category_name: string | null
  brand_name: string | null
  model: string | null
  nicknames: string | null
  on_hand: number | null
  current_price: number | null
  currency: string // "NOK"
  is_group: boolean
  unique: boolean | null
  allow_individual_booking: boolean | null
  active: boolean // 👈 exists in the view (you filtered by it)
  item_kind: InventoryItemKind
}

export type ItemPriceHistoryRow = {
  id: string
  amount: number

  effective_from: string
  effective_to: string | null
  set_by: string | null
  set_by_name?: string | null
}

export type ItemDetail = {
  id: string
  name: string
  type: 'item'
  category_name: string | null
  brand_name: string | null
  model: string | null
  allow_individual_booking: boolean
  active: boolean
  notes: string | null
  nicknames: string | null
  current_price: number | null
  on_hand: number | null
  price_history: Array<ItemPriceHistoryRow>
  item_kind: InventoryItemKind
}

export type GroupPartRow = {
  item_id: string | null
  child_group_id: string | null
  item_name: string
  quantity: number
  item_current_price: number | null
  part_type: 'item' | 'group'
}

export type GroupDetail = {
  id: string
  name: string
  type: 'group'
  on_hand: number | null
  current_price: number | null
  category_name: string | null
  description: string | null
  active: boolean
  parts: Array<GroupPartRow>
  price_history: Array<ItemPriceHistoryRow>
  item_kind: InventoryItemKind
}

export type InventoryDetail = ItemDetail | GroupDetail

export type SortBy =
  | 'name'
  | 'category_name'
  | 'brand_name'
  | 'on_hand'
  | 'current_price'

export type SortDir = 'asc' | 'desc'

/** One inventory index page after optional client Fuse. */
export type InventoryIndexPageResult = {
  rows: Array<InventoryIndexRow>
  /**
   * Footer-facing count: post-Fuse matched length on this page when searching;
   * otherwise PostgREST exact total (`serverCount`).
   */
  count: number
  /** Rows returned by PostgREST before client Fuse (for infinite stop). */
  fetched: number
  /** Pre-Fuse PostgREST exact total for empty-search footers. */
  serverCount: number
}

// --- Category query keys ---
export const categoryNamesKey = (companyId: string) =>
  ['company', companyId, 'item-categories', 'names'] as const

export const categoryOptionsKey = (companyId: string) =>
  ['company', companyId, 'item-categories', 'options'] as const

// --- Names only (string[]) ---
export const categoryNamesQuery = ({ companyId }: { companyId: string }) =>
  queryOptions<
    Array<string>,
    Error,
    Array<string>,
    ReturnType<typeof categoryNamesKey>
  >({
    queryKey: categoryNamesKey(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      const names = data.map((c: any) => c.name).filter(Boolean)
      return Array.from(new Set(names))
    },
    staleTime: 60_000,
  })

// --- Full options ({ id, name }) ---
export type CategoryOption = { id: string; name: string }

export const categoryOptionsQuery = ({ companyId }: { companyId: string }) =>
  queryOptions<
    Array<CategoryOption>,
    Error,
    Array<CategoryOption>,
    ReturnType<typeof categoryOptionsKey>
  >({
    queryKey: categoryOptionsKey(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
      if (error) throw error
      return data.filter((c: any) => c.name) as Array<CategoryOption>
    },
    staleTime: 60_000,
  })

/* ------------ Index (Items + Groups) ------------ */

export const inventoryIndexQuery = ({
  companyId,
  page,
  pageSize,
  search,
  showActive,
  showInactive,
  showStock,
  showSubrental,
  showGroupOnlyItems,
  showGroups,
  showItems,
  category,
  sortBy,
  sortDir,
}: {
  companyId: string
  page: number
  pageSize: number
  search: string
  showActive: boolean
  showInactive: boolean
  showStock: boolean
  showSubrental: boolean
  showGroupOnlyItems: boolean
  showGroups: boolean
  showItems: boolean
  category: string | null
  sortBy: SortBy
  sortDir: SortDir
}) =>
  queryOptions<
    InventoryIndexPageResult,
    Error,
    InventoryIndexPageResult,
    ReturnType<typeof inventoryIndexKey>
  >({
    queryKey: inventoryIndexKey(
      companyId,
      page,
      pageSize,
      search,
      showActive,
      showInactive,
      showStock,
      showSubrental,
      showGroupOnlyItems,
      showGroups,
      showItems,
      category,
      sortBy,
      sortDir,
    ),
    queryFn: async () => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      let q = supabase
        .from('inventory_index')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)

      // exclude deleted rows
      q = q.or('deleted.is.null,deleted.eq.false')

      // Filter by active status
      if (showActive && !showInactive) {
        q = q.eq('active', true)
      } else if (!showActive && showInactive) {
        q = q.eq('active', false)
      }
      // If both are selected or both are unselected, show all (no filter)

      // Filter by item kind
      if (showStock && !showSubrental) {
        q = q.eq('item_kind', 'stock')
      } else if (!showStock && showSubrental) {
        q = q.eq('item_kind', 'subrental')
      }
      // If both are selected or both are unselected, show all (no filter)

      // Build type filters: groups, items (bookable individually), group-only items
      // PostgREST .or() limitation: commas mean OR, can't easily express AND within OR
      // Strategy: Use patterns that work with PostgREST, filter client-side if needed

      if (!showGroups && !showItems && !showGroupOnlyItems) {
        // If no type filters are selected, return empty result
        q = q.eq('id', '__never_match__')
      } else if (showGroups && showItems && showGroupOnlyItems) {
        // All types selected - no type filter needed
      } else if (showGroups && !showItems && !showGroupOnlyItems) {
        // Only groups
        q = q.eq('is_group', true)
      } else if (!showGroups && showItems && !showGroupOnlyItems) {
        // Only items that allow individual booking
        q = q.eq('is_group', false).eq('allow_individual_booking', true)
      } else if (!showGroups && !showItems && showGroupOnlyItems) {
        // Only group-only items
        q = q.eq('is_group', false).eq('allow_individual_booking', false)
      } else if (showGroups && showItems && !showGroupOnlyItems) {
        // Groups + items (bookable individually)
        // Pattern from BookItemsDialog: groups OR items with allow_individual_booking
        q = q.or('is_group.eq.true,allow_individual_booking.eq.true')
      } else if (showGroups && !showItems && showGroupOnlyItems) {
        // Groups + group-only items
        // Filter: groups OR (non-groups with allow_individual_booking=false)
        // PostgREST limitation: can't easily express AND within OR
        // Solution: fetch groups + all non-groups, filter client-side
        q = q.or('is_group.eq.true,is_group.eq.false')
        // Note: We'll filter client-side in the return to exclude items with allow_individual_booking=true
      } else if (!showGroups && showItems && showGroupOnlyItems) {
        // Items (bookable) + group-only items
        // Both are non-groups, so just filter is_group=false
        q = q.eq('is_group', false)
      } else {
        // Fallback: show all
      }

      if (category && category !== 'all') q = q.eq('category_name', category)

      if (search && search.trim()) {
        const patterns = postgrestIlikePatterns(search)
        const conditions = patterns.flatMap((pattern) => [
          `name.ilike.${pattern}`,
          `category_name.ilike.${pattern}`,
          `brand_name.ilike.${pattern}`,
          `model.ilike.${pattern}`,
          `nicknames.ilike.${pattern}`,
        ])

        if (conditions.length > 0) {
          q = q.or(conditions.join(','))
        }
      }

      // Server-side sort + stable tiebreaker for pagination
      q = q
        .order(sortBy, {
          ascending: sortDir === 'asc',
          nullsFirst: false,
        })
        .order('id', { ascending: true }) // 👈 stable secondary sort

      const { data, count, error } = await q.range(from, to)
      if (error) throw error

      const fetched = (data as Array<InventoryIndexRow>).length
      const serverCount = count ?? 0
      let filteredRows = data as Array<InventoryIndexRow>

      // Client-side filtering for complex type combinations that PostgREST can't handle
      if (showGroups && !showItems && showGroupOnlyItems) {
        // Filter: keep groups OR items with allow_individual_booking=false
        filteredRows = filteredRows.filter(
          (row) => row.is_group || !row.allow_individual_booking,
        )
      }

      // Apply client-side fuzzy matching for better typo tolerance
      // This handles cases where database ilike patterns aren't fuzzy enough
      // (e.g., "unaktive" should match "unactive" despite k vs c substitution)
      const searching = Boolean(search && search.trim())
      if (searching) {
        const { fuzzySearch } = await import('@shared/lib/generalFunctions')
        filteredRows = fuzzySearch(
          filteredRows,
          search,
          [
            (row) => row.name,
            (row) => row.category_name || '',
            (row) => row.brand_name || '',
            (row) => row.model || '',
            (row) => row.nicknames || '',
          ],
          0.25, // Lower threshold since we already filtered with ilike
        )
      }

      return {
        rows: filteredRows,
        // When Fuse shrinks the page, do not report the pre-Fuse server total.
        count: searching ? filteredRows.length : serverCount,
        fetched,
        serverCount,
      }
    },
    staleTime: 10_000,
  })

/* ------------ Detail (DRIVEN BY inventory_index) ------------ */
/* If a row is visible in the index, detail will render. We enrich from
   base tables/views (notes, model, parts, history). If those are not
   visible due to RLS, we still return a complete shape using the index row. */

export const inventoryDetailQuery = ({
  companyId,
  id,
}: {
  companyId: string
  id: string
}) =>
  queryOptions<
    InventoryDetail | null,
    Error,
    InventoryDetail | null,
    ReturnType<typeof inventoryDetailKey>
  >({
    queryKey: inventoryDetailKey(companyId, id),
    // Keep retries low; data either exists (by index) or doesn't
    retry: (failCount) => failCount < 2,
    queryFn: async () => {
      const base = await fetchInventoryIndexRow({ companyId, id })
      if (!base) return null

      if (!base.is_group) {
        return enrichItemDetail({ base, companyId, id })
      }
      return enrichGroupDetail({ base, companyId, id })
    },
  })
