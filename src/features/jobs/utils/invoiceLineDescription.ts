// src/features/jobs/utils/invoiceLineDescription.ts
import type { BookingInvoiceLine } from '../api/invoiceQueries'

export type DescriptionToken =
  | { kind: 'custom'; text: string }
  | { kind: 'job' }
  | { kind: 'date' }
  | { kind: 'crew' }
  | { kind: 'equipment' }
  | { kind: 'transport' }
  | { kind: 'timePeriod' }
  | { kind: 'type' }

export type DescriptionTemplate = {
  tokens: Array<DescriptionToken>
  separator?: string
}

export type InvoiceLineDescriptionScope =
  | 'all'
  | 'equipment'
  | 'crew'
  | 'transport'

export type InvoiceLineTemplateStore = {
  all?: DescriptionTemplate
  equipment?: DescriptionTemplate
  crew?: DescriptionTemplate
  transport?: DescriptionTemplate
}

const DEFAULT_SEPARATOR = ' - '

function formatDateRange(startAt: string, endAt: string): string {
  if (!startAt && !endAt) return ''
  const fmt = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const day = d.getDate().toString().padStart(2, '0')
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const year = d.getFullYear()
    return `${day}.${month}.${year}`
  }
  const start = fmt(startAt)
  const end = fmt(endAt)
  if (start && end && start !== end) return `${start} – ${end}`
  return start || end
}

function formatJobLabel(line: BookingInvoiceLine): string {
  const title = line.jobTitle?.trim()
  const jobnr = line.jobnr
  if (title && jobnr != null) {
    return `${title} (#${String(jobnr).padStart(6, '0')})`
  }
  if (title) return title
  if (jobnr != null) return `#${String(jobnr).padStart(6, '0')}`
  return ''
}

function resolveEquipmentText(line: BookingInvoiceLine): string {
  if (line.groupName) return `${line.groupName} (Group)`
  const brandModel = [line.brandName, line.model].filter(Boolean).join(' ')
  if (brandModel) return brandModel
  if (line.itemName) return line.itemName
  return 'Equipment'
}

function resolveTypeLabel(type: BookingInvoiceLine['type']): string {
  if (type === 'equipment') return 'Equipment'
  if (type === 'crew') return 'Crew'
  return 'Transport'
}

function resolveTokenValue(
  token: DescriptionToken,
  line: BookingInvoiceLine,
): string {
  switch (token.kind) {
    case 'custom':
      return token.text.trim()
    case 'job':
      return formatJobLabel(line)
    case 'date':
      return formatDateRange(line.startAt, line.endAt)
    case 'crew':
      return line.roleLabel?.trim() || 'technician'
    case 'equipment':
      return resolveEquipmentText(line)
    case 'transport':
      return line.vehicleName?.trim() || 'Vehicle'
    case 'timePeriod':
      return line.timePeriodTitle?.trim() || ''
    case 'type':
      return resolveTypeLabel(line.type)
    default:
      return ''
  }
}

export function buildInvoiceLineDescription(
  line: BookingInvoiceLine,
  template: DescriptionTemplate,
): string {
  const separator = template.separator ?? DEFAULT_SEPARATOR
  const parts = template.tokens
    .map((token) => resolveTokenValue(token, line))
    .filter((part) => part.length > 0)
  return parts.join(separator)
}

export function defaultTemplateForLineType(
  type: BookingInvoiceLine['type'],
  unit?: 'day' | 'hour',
): DescriptionTemplate {
  const unitLabel = unit === 'hour' ? 'per hour' : 'per day'
  switch (type) {
    case 'equipment':
      return { tokens: [{ kind: 'equipment' }] }
    case 'crew':
      return {
        tokens: [
          { kind: 'custom', text: 'Crew' },
          { kind: 'crew' },
          { kind: 'custom', text: unitLabel },
        ],
      }
    case 'transport':
      return {
        tokens: [
          { kind: 'custom', text: 'Transport' },
          { kind: 'transport' },
          { kind: 'custom', text: 'per day' },
        ],
      }
    default:
      return { tokens: [{ kind: 'equipment' }] }
  }
}

export function defaultDescriptionForLine(line: BookingInvoiceLine): string {
  return buildInvoiceLineDescription(
    line,
    defaultTemplateForLineType(line.type, line.unit),
  )
}

export function getTemplateForLine(
  line: BookingInvoiceLine,
  store: InvoiceLineTemplateStore,
): DescriptionTemplate {
  const scoped = store[line.type]
  if (scoped) return scoped
  if (store.all) return store.all
  return defaultTemplateForLineType(line.type, line.unit)
}

export function applyTemplatesToLines(
  lines: Array<BookingInvoiceLine>,
  store: InvoiceLineTemplateStore,
  manualOverrides: Set<string>,
  scope: InvoiceLineDescriptionScope = 'all',
): Array<BookingInvoiceLine> {
  return lines.map((line) => {
    if (manualOverrides.has(line.id)) return line
    if (scope !== 'all' && line.type !== scope) return line
    const template = getTemplateForLine(line, store)
    return {
      ...line,
      description: buildInvoiceLineDescription(line, template),
    }
  })
}

/** Lines that would receive a new description when applying for the given scope. */
export function getLinesAffectedByScope(
  lines: Array<BookingInvoiceLine>,
  manualOverrides: Set<string>,
  scope: InvoiceLineDescriptionScope,
): Array<BookingInvoiceLine> {
  return lines.filter((line) => {
    if (manualOverrides.has(line.id)) return false
    if (scope !== 'all' && line.type !== scope) return false
    return true
  })
}

export function countLinesByScope(
  lines: Array<BookingInvoiceLine>,
  manualOverrides: Set<string>,
): Record<InvoiceLineDescriptionScope, number> {
  return {
    all: getLinesAffectedByScope(lines, manualOverrides, 'all').length,
    equipment: getLinesAffectedByScope(lines, manualOverrides, 'equipment')
      .length,
    crew: getLinesAffectedByScope(lines, manualOverrides, 'crew').length,
    transport: getLinesAffectedByScope(lines, manualOverrides, 'transport')
      .length,
  }
}

export function countChangedDescriptions(
  before: Array<BookingInvoiceLine>,
  after: Array<BookingInvoiceLine>,
): number {
  const beforeById = new Map(before.map((line) => [line.id, line.description]))
  let changed = 0
  for (const line of after) {
    if (beforeById.get(line.id) !== line.description) changed += 1
  }
  return changed
}

const STORAGE_KEY_PREFIX = 'invoice-line-templates:'

export function loadInvoiceLineTemplates(
  companyId: string,
): InvoiceLineTemplateStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${companyId}`)
    if (!raw) return {}
    return JSON.parse(raw) as InvoiceLineTemplateStore
  } catch {
    return {}
  }
}

export function saveInvoiceLineTemplates(
  companyId: string,
  store: InvoiceLineTemplateStore,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${companyId}`,
      JSON.stringify(store),
    )
  } catch {
    // ignore quota / private mode
  }
}
