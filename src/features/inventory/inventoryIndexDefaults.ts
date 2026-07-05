import type { SortBy, SortDir } from './api/queries'

export const INVENTORY_INDEX_DEFAULTS = {
  page: 1,
  pageSize: 200,
  search: '',
  showActive: true,
  showInactive: false,
  showStock: true,
  showSubrental: true,
  showGroupOnlyItems: false,
  showGroups: false,
  showItems: true,
  category: null as string | null,
  sortBy: 'name' as SortBy,
  sortDir: 'asc' as SortDir,
}
