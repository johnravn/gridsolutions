import { parseColumnLayoutColumns } from './columnLayoutStorage'
import { parseOptionsGroups } from './optionsBlockStorage'
import type { OptionGroup, ParsedOfferOption } from './optionsBlockStorage'
import type { PrettyOfferModule, PrettyOfferModuleBlock } from '../types'

export type AcceptedOptionSelection = {
  option_id: string
  block_id: string
  module_id: string
  label: string
  price: number
}

export type OfferTotalsWithOptions = {
  baseSubtotal: number
  optionsSubtotal: number
  totalBeforeDiscount: number
  discountAmount: number
  totalAfterDiscount: number
  vatAmount: number
  totalWithVat: number
}

function collectOptionsFromBlocks(
  blocks: Array<PrettyOfferModuleBlock>,
  moduleId: string,
  results: Array<ParsedOfferOption>,
): void {
  for (const block of blocks) {
    if (block.block_type === 'options') {
      const groups = parseOptionsGroups(block.items)
      for (const group of groups) {
        for (const option of group.options) {
          results.push({
            optionId: option.id,
            blockId: block.id,
            moduleId,
            groupId: group.id,
            groupTitle: group.title,
            selectionMode: group.selectionMode,
            label: option.label,
            price: option.price,
            defaultSelected: option.default_selected === true,
          })
        }
      }
      continue
    }

    if (block.block_type === 'column_layout') {
      const columns = parseColumnLayoutColumns(block.items)
      for (const column of columns) {
        collectOptionsFromBlocks(column.blocks, moduleId, results)
      }
    }
  }
}

export function collectOfferOptions(
  modules: Array<Pick<PrettyOfferModule, 'id' | 'content_blocks' | 'blocks'>>,
): Array<ParsedOfferOption> {
  const results: Array<ParsedOfferOption> = []

  for (const module of modules) {
    const blocks = module.content_blocks ?? module.blocks ?? []
    collectOptionsFromBlocks(blocks, module.id, results)
  }

  return results
}

export function resolveDefaultSelectedOptionIds(
  options: Array<ParsedOfferOption>,
): Set<string> {
  const selected = new Set<string>()
  const groups = new Map<string, Array<ParsedOfferOption>>()

  for (const option of options) {
    const groupKey = `${option.blockId}:${option.groupId}`
    const existing = groups.get(groupKey) ?? []
    existing.push(option)
    groups.set(groupKey, existing)
  }

  for (const groupOptions of groups.values()) {
    const mode = groupOptions[0]?.selectionMode ?? 'multiple'
    const defaults = groupOptions.filter((option) => option.defaultSelected)

    if (mode === 'single') {
      const pick = defaults.at(-1) ?? null
      if (pick) selected.add(pick.optionId)
      continue
    }

    for (const option of defaults) {
      selected.add(option.optionId)
    }
  }

  return selected
}

export function validateOptionSelection(
  selectedIds: Iterable<string>,
  options: Array<ParsedOfferOption>,
): Set<string> {
  const optionById = new Map(options.map((option) => [option.optionId, option]))
  const normalized = new Set<string>()

  for (const id of selectedIds) {
    if (optionById.has(id)) normalized.add(id)
  }

  const groups = new Map<string, Array<ParsedOfferOption>>()
  for (const option of options) {
    const groupKey = `${option.blockId}:${option.groupId}`
    const existing = groups.get(groupKey) ?? []
    existing.push(option)
    groups.set(groupKey, existing)
  }

  for (const groupOptions of groups.values()) {
    const mode = groupOptions[0]?.selectionMode ?? 'multiple'
    if (mode !== 'single') continue

    const selectedInGroup = groupOptions.filter((option) =>
      normalized.has(option.optionId),
    )
    if (selectedInGroup.length <= 1) continue

    const keep = selectedInGroup[selectedInGroup.length - 1]
    for (const option of groupOptions) {
      if (option.optionId !== keep.optionId) {
        normalized.delete(option.optionId)
      }
    }
  }

  return normalized
}

export function calculateOptionsSubtotal(
  selectedIds: Iterable<string>,
  options: Array<ParsedOfferOption>,
): number {
  const valid = validateOptionSelection(selectedIds, options)
  const optionById = new Map(options.map((option) => [option.optionId, option]))
  let sum = 0

  for (const id of valid) {
    sum += optionById.get(id)?.price ?? 0
  }

  return sum
}

export function getSelectedOptionEntries(
  selectedIds: Iterable<string>,
  options: Array<ParsedOfferOption>,
): Array<ParsedOfferOption> {
  const valid = validateOptionSelection(selectedIds, options)
  const optionById = new Map(options.map((option) => [option.optionId, option]))
  return [...valid]
    .map((id) => optionById.get(id))
    .filter((entry): entry is ParsedOfferOption => entry != null)
}

export function applyOptionsToOfferTotals(
  baseSubtotal: number,
  optionsSubtotal: number,
  vatPercent: number,
  discountPercent: number,
): OfferTotalsWithOptions {
  const totalBeforeDiscount = baseSubtotal + optionsSubtotal
  const discountAmount = (totalBeforeDiscount * discountPercent) / 100
  const totalAfterDiscount = totalBeforeDiscount - discountAmount
  const totalWithVat = totalAfterDiscount * (1 + vatPercent / 100)
  const vatAmount = totalWithVat - totalAfterDiscount

  return {
    baseSubtotal,
    optionsSubtotal,
    totalBeforeDiscount,
    discountAmount,
    totalAfterDiscount,
    vatAmount,
    totalWithVat,
  }
}

export function formatOptionGroupLabel(group: OptionGroup): string {
  if (group.title?.trim()) return group.title.trim()
  return group.selectionMode === 'single' ? 'Choose one' : 'Optional add-ons'
}
