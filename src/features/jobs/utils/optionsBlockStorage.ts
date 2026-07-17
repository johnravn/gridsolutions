import type {
  PrettyOfferModuleBlock,
  PrettyOfferModuleBlockItem,
} from '../types'

export type OptionSelectionMode = 'single' | 'multiple'

export type OptionEntry = {
  id: string
  label: string
  price: number
  default_selected?: boolean
  blocks: Array<PrettyOfferModuleBlock>
}

export type OptionGroup = {
  id: string
  title: string | null
  selectionMode: OptionSelectionMode
  options: Array<OptionEntry>
}

export type ParsedOfferOption = {
  optionId: string
  blockId: string
  moduleId: string
  groupId: string
  groupTitle: string | null
  selectionMode: OptionSelectionMode
  label: string
  price: number
  defaultSelected: boolean
}

function createOptionId(): string {
  return `temp-option-${crypto.randomUUID()}`
}

function createGroupId(): string {
  return `temp-option-group-${crypto.randomUUID()}`
}

function parseSelectionMode(
  value: string | null | undefined,
): OptionSelectionMode {
  return value === 'single' ? 'single' : 'multiple'
}

function parseOptionEntry(raw: unknown): OptionEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  const id = typeof entry.id === 'string' ? entry.id : createOptionId()
  const label = typeof entry.label === 'string' ? entry.label : ''
  const priceRaw = entry.price
  const price =
    typeof priceRaw === 'number'
      ? priceRaw
      : typeof priceRaw === 'string'
        ? Number.parseFloat(priceRaw)
        : 0
  const blocks = Array.isArray(entry.blocks)
    ? (entry.blocks as Array<PrettyOfferModuleBlock>).map((block) => ({
        ...block,
        items: block.items ?? [],
      }))
    : []

  return {
    id,
    label,
    price: Number.isFinite(price) ? price : 0,
    default_selected: entry.default_selected === true,
    blocks,
  }
}

function parseGroupOptions(
  detail: string | null | undefined,
): Array<OptionEntry> {
  if (!detail) return []
  try {
    const parsed = JSON.parse(detail) as { options?: Array<unknown> }
    return (parsed.options ?? [])
      .map(parseOptionEntry)
      .filter((entry): entry is OptionEntry => entry != null)
  } catch {
    return []
  }
}

export function parseOptionsGroups(
  items: Array<PrettyOfferModuleBlockItem> = [],
): Array<OptionGroup> {
  return [...items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => ({
      id: item.id,
      title: item.label?.trim() ? item.label.trim() : null,
      selectionMode: parseSelectionMode(item.summary),
      options: parseGroupOptions(item.detail),
    }))
}

export function serializeOptionsGroups(
  blockId: string,
  groups: Array<OptionGroup>,
): Array<PrettyOfferModuleBlockItem> {
  return groups.map((group, index) => ({
    id: group.id,
    block_id: blockId,
    sort_order: index,
    label: group.title ?? '',
    summary: group.selectionMode,
    detail: JSON.stringify({ options: group.options }),
  }))
}

export function createEmptyOptionEntry(): OptionEntry {
  return {
    id: createOptionId(),
    label: '',
    price: 0,
    default_selected: false,
    blocks: [],
  }
}

export function createEmptyOptionGroup(
  selectionMode: OptionSelectionMode = 'multiple',
): OptionGroup {
  return {
    id: createGroupId(),
    title: null,
    selectionMode,
    options: [createEmptyOptionEntry()],
  }
}

export function createOptionsBlockItems(
  blockId: string,
): Array<PrettyOfferModuleBlockItem> {
  return serializeOptionsGroups(blockId, [createEmptyOptionGroup()])
}

export function countOptionsInBlock(
  block: Pick<PrettyOfferModuleBlock, 'items'>,
): number {
  return parseOptionsGroups(block.items).reduce(
    (sum, group) => sum + group.options.length,
    0,
  )
}

export function countOptionGroupsInBlock(
  block: Pick<PrettyOfferModuleBlock, 'items'>,
): number {
  return parseOptionsGroups(block.items).length
}
