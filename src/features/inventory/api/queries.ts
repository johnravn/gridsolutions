import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

export const inventoryIndexKey = (
  companyId: string,
  page: number,
  pageSize: number,
  search: string,
  showActive: boolean,
  showInactive: boolean,
  showInternal: boolean,
  showExternal: boolean,
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
    showInternal,
    showExternal,
    showGroupOnlyItems,
    showGroups,
    showItems,
    category,
    sortBy,
    sortDir,
  ] as const

export const inventoryDetailKey = (companyId: string, id: string) =>
  ['company', companyId, 'inventory-detail', id] as const

function escapeForPostgrestOr(value: string) {
  // PostgREST uses commas and parentheses to separate conditions.
  // Strip or space them out so user input can't break the expression.
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

/* ------------ Types (aligned to the views) ------------ */

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
  // 👇 NEW
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
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
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
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
  internally_owned: boolean
  external_owner_id: string | null
  external_owner_name: string | null
}

export type InventoryDetail = ItemDetail | GroupDetail

export type SortBy =
  | 'name'
  | 'category_name'
  | 'brand_name'
  | 'on_hand'
  | 'current_price'

export type SortDir = 'asc' | 'desc'

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
  showInternal,
  showExternal,
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
  showInternal: boolean
  showExternal: boolean
  showGroupOnlyItems: boolean
  showGroups: boolean
  showItems: boolean
  category: string | null
  sortBy: SortBy
  sortDir: SortDir
}) =>
  queryOptions<
    { rows: Array<InventoryIndexRow>; count: number },
    Error,
    { rows: Array<InventoryIndexRow>; count: number },
    ReturnType<typeof inventoryIndexKey>
  >({
    queryKey: inventoryIndexKey(
      companyId,
      page,
      pageSize,
      search,
      showActive,
      showInactive,
      showInternal,
      showExternal,
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

      // Filter by ownership
      if (showInternal && !showExternal) {
        q = q.eq('internally_owned', true)
      } else if (!showInternal && showExternal) {
        q = q.eq('internally_owned', false)
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
        const term = search.trim()
        // Fuzzy search: use multiple patterns for better matching
        const patterns: Array<string> = [
          `%${escapeForPostgrestOr(term)}%`,
          term.length > 2
            ? `%${escapeForPostgrestOr(term.split('').join('%'))}%`
            : null,
        ].filter((p): p is string => p !== null)

        // Build OR conditions for all columns with all patterns
        const conditions: Array<string> = []
        patterns.forEach((pattern) => {
          conditions.push(`name.ilike.${pattern}`)
          conditions.push(`category_name.ilike.${pattern}`)
          conditions.push(`brand_name.ilike.${pattern}`)
          conditions.push(`model.ilike.${pattern}`)
          conditions.push(`nicknames.ilike.${pattern}`)
        })

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
      if (search && search.trim()) {
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
        count: count ?? 0, // Total count from server (before client-side filtering)
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
    retry: (failCount, _err: any) => failCount < 2,
    queryFn: async () => {
      const TAG = 'inventoryDetailQuery'
      const RUN = `${TAG}#${performance.now().toFixed(3)}`
      const t = (s: string) => `[${RUN}] ${s}`

      console.groupCollapsed(t('start'), { companyId, id })
      console.time(t('total'))
      const safeEnd = () => {
        try {
          console.timeEnd(t('total'))
        } catch {}
        try {
          console.groupEnd()
        } catch {}
      }
      const logSb = <T>(label: string, res: { data: T | null; error: any }) => {
        if (res.error) {
          console.error(t(`${label} ERROR`), {
            code: res.error?.code,
            details: res.error?.details,
            hint: res.error?.hint,
            message: res.error?.message,
          })
        }
      }

      try {
        // 1) Always read the base row from the SAME view the list uses
        console.time(t('INDEX base'))
        const { data: base, error: baseErr } = await supabase
          .from('inventory_index')
          .select('*')
          .eq('company_id', companyId)
          .eq('id', id)
          .maybeSingle<InventoryIndexRow>()
        logSb('INDEX base', { data: base, error: baseErr })
        console.timeEnd(t('INDEX base'))

        if (baseErr) {
          safeEnd()
          throw baseErr
        }
        if (!base) {
          // If it isn't even in the index, it's truly not visible to this user
          safeEnd()
          return null
        }

        // 2) Branch by type (using is_group from index)
        if (!base.is_group) {
          // ----- ITEM -----
          // Optional enrich: notes, model, flags from base table (might be RLS'd)
          console.time(t('ITEM enrich'))
          const { data: itemMeta, error: itemErr } = await supabase
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
          logSb('ITEM enrich', { data: itemMeta, error: itemErr })
          console.timeEnd(t('ITEM enrich'))
          // Do NOT throw on itemErr — just fall back to index row

          // Price history (view; usually RLS-safe)
          console.time(t('ITEM history'))
          const { data: hist, error: hErr } = await supabase
            .from('item_price_history_with_profile')
            .select(
              'id, amount, effective_from, effective_to, set_by, set_by_name',
            )
            .eq('company_id', companyId)
            .eq('item_id', id)
            .order('effective_from', { ascending: false })
          logSb('ITEM history', { data: hist, error: hErr })
          console.timeEnd(t('ITEM history'))
          if (hErr) {
            safeEnd()
            throw hErr
          }

          const result: ItemDetail = {
            id: base.id,
            name: base.name,
            type: 'item',
            category_name: base.category_name ?? null,
            brand_name: base.brand_name ?? null,
            model: itemMeta?.model ?? null,
            allow_individual_booking: Boolean(
              itemMeta?.allow_individual_booking ??
                base.allow_individual_booking,
            ),
            active: Boolean(itemMeta?.active ?? base.active),
            notes: itemMeta?.notes ?? null,
            nicknames: itemMeta?.nicknames ?? base.nicknames ?? null,
            current_price: base.current_price ?? null,
            on_hand: base.on_hand ?? 0,
            price_history: hist as Array<ItemPriceHistoryRow>,
            internally_owned: base.internally_owned,
            external_owner_id: base.external_owner_id,
            external_owner_name: base.external_owner_name,
          }

          safeEnd()
          return result
        } else {
          // ----- GROUP -----
          // Optional enrich: description/active from base table (may be RLS'd)
          console.time(t('GROUP enrich'))
          const { data: gmeta, error: gErr } = await supabase
            .from('item_groups')
            .select('id, description, active')
            .eq('id', id)
            .eq('company_id', companyId)
            .maybeSingle<{
              id: string
              description: string | null
              active: boolean | null
            }>()
          logSb('GROUP enrich', { data: gmeta, error: gErr })
          console.timeEnd(t('GROUP enrich'))
          // No throw on gErr — we can fall back to index

          // Rollups (or fall back to index)
          console.time(t('GROUP rollups'))
          const { data: roll, error: rErr } = await supabase
            .from('groups_with_rollups')
            .select('on_hand, current_price')
            .eq('id', id)
            .maybeSingle<{
              on_hand: number | null
              current_price: number | null
            }>()
          logSb('GROUP rollups', { data: roll, error: rErr })
          console.timeEnd(t('GROUP rollups'))
          if (rErr && rErr.code !== 'PGRST116') {
            safeEnd()
            throw rErr
          }

          // Parts (view; usually RLS-safe) - now includes nested groups
          console.time(t('GROUP parts'))
          const { data: parts, error: pErr } = await supabase
            .from('group_parts')
            .select(
              'item_id, child_group_id, item_name, quantity, item_current_price, part_type',
            )
            .eq('group_id', id)
          logSb('GROUP parts', { data: parts, error: pErr })
          console.timeEnd(t('GROUP parts'))
          if (pErr) {
            safeEnd()
            throw pErr
          }

          // History (view)
          console.time(t('GROUP history'))
          const { data: ghist, error: ghErr } = await supabase
            .from('group_price_history_with_profile')
            .select(
              'id, amount, effective_from, effective_to, set_by, set_by_name',
            )
            .eq('company_id', companyId)
            .eq('group_id', id)
            .order('effective_from', { ascending: false })
          logSb('GROUP history', { data: ghist, error: ghErr })
          console.timeEnd(t('GROUP history'))
          if (ghErr) {
            safeEnd()
            throw ghErr
          }

          const result: GroupDetail = {
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
            internally_owned: base.internally_owned,
            external_owner_id: base.external_owner_id,
            external_owner_name: base.external_owner_name,
          }

          safeEnd()
          return result
        }
      } catch (e: any) {
        console.error(t('THROW'), {
          name: e?.name,
          message: e?.message,
          code: e?.code,
          details: e?.details,
          hint: e?.hint,
        })
        safeEnd()
        throw e
      }
    },
  })
