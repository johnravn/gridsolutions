// src/features/jobs/utils/invoiceLineDescription.ts
import type { BookingInvoiceLine } from '../api/invoiceQueries'

export type DescriptionTokenKind =
  | 'custom'
  | 'name'
  | 'itemName'
  | 'brand'
  | 'model'
  | 'job'
  | 'date'
  | 'time'
  | 'crew'
  | 'crewName'
  | 'equipment'
  | 'transport'
  | 'vehicleName'
  | 'timePeriod'
  | 'type'
  | 'unit'
  | 'days'

export type DescriptionToken =
  | { kind: 'custom'; text: string }
  | { kind: Exclude<DescriptionTokenKind, 'custom'> }

export type DescriptionTemplate = {
  tokens: Array<DescriptionToken>
  separator?: string
}

export type InvoiceLineDescriptionScope =
  | 'other'
  | 'equipment'
  | 'crew'
  | 'transport'

export type InvoiceLineTemplateStore = {
  other?: DescriptionTemplate
  equipment?: DescriptionTemplate
  crew?: DescriptionTemplate
  transport?: DescriptionTemplate
}

export type TokenOption = {
  value: DescriptionTokenKind
  label: string
}

const DEFAULT_SEPARATOR = ' - '

export const COMMON_TOKEN_OPTIONS: Array<TokenOption> = [
  { value: 'custom', label: 'Custom' },
  { value: 'job', label: 'Job' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'timePeriod', label: 'Time period' },
  { value: 'type', label: 'Type' },
]

export const SCOPE_SPECIFIC_TOKEN_OPTIONS: Record<
  InvoiceLineDescriptionScope,
  Array<TokenOption>
> = {
  other: [{ value: 'name', label: 'Name' }],
  equipment: [
    { value: 'days', label: 'Days' },
    { value: 'itemName', label: 'Item name' },
    { value: 'brand', label: 'Brand' },
    { value: 'model', label: 'Model' },
  ],
  crew: [
    { value: 'crew', label: 'Role' },
    { value: 'crewName', label: 'Crew name' },
    { value: 'unit', label: 'Unit' },
  ],
  transport: [
    { value: 'vehicleName', label: 'Transport name' },
    { value: 'unit', label: 'Unit' },
  ],
}

const ALL_TOKEN_LABELS: Record<DescriptionTokenKind, string> = {
  custom: 'Custom',
  name: 'Name',
  itemName: 'Item name',
  brand: 'Brand',
  model: 'Model',
  job: 'Job',
  date: 'Date',
  time: 'Time',
  crew: 'Role',
  crewName: 'Crew name',
  equipment: 'Item name',
  transport: 'Transport name',
  vehicleName: 'Transport name',
  timePeriod: 'Time period',
  type: 'Type',
  unit: 'Unit',
  days: 'Days',
}

export function tokenOptionsForScope(
  scope: InvoiceLineDescriptionScope,
): Array<TokenOption> {
  return [...SCOPE_SPECIFIC_TOKEN_OPTIONS[scope], ...COMMON_TOKEN_OPTIONS]
}

export function tokenLabel(token: DescriptionToken): string {
  if (token.kind === 'custom') {
    const t = token.text.trim()
    return t ? `"${t}"` : 'Custom'
  }
  return ALL_TOKEN_LABELS[token.kind] ?? token.kind
}

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

function formatTimeRange(startAt: string, endAt: string): string {
  if (!startAt && !endAt) return ''
  const fmt = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
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

function resolveItemName(line: BookingInvoiceLine): string {
  if (line.groupName) return `${line.groupName} (Group)`
  return line.itemName?.trim() || ''
}

function resolveName(line: BookingInvoiceLine): string {
  if (line.type === 'equipment') {
    return resolveItemName(line) || 'Equipment'
  }
  if (line.type === 'crew') {
    return line.roleLabel?.trim() || 'technician'
  }
  return line.vehicleName?.trim() || 'Vehicle'
}

function resolveUnitLabel(line: BookingInvoiceLine): string {
  if (line.unit === 'hour') return 'per hour'
  if (line.unit === 'day') return 'per day'
  return ''
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
    case 'name':
      return resolveName(line)
    case 'itemName':
    case 'equipment':
      return (
        resolveItemName(line) || (line.type === 'equipment' ? 'Equipment' : '')
      )
    case 'brand':
      return line.brandName?.trim() || ''
    case 'model':
      return line.model?.trim() || ''
    case 'job':
      return formatJobLabel(line)
    case 'date':
      return formatDateRange(line.startAt, line.endAt)
    case 'time':
      return formatTimeRange(line.startAt, line.endAt)
    case 'crew':
      return (
        line.roleLabel?.trim() || (line.type === 'crew' ? 'technician' : '')
      )
    case 'crewName':
      return line.crewName?.trim() || ''
    case 'transport':
    case 'vehicleName':
      return (
        line.vehicleName?.trim() || (line.type === 'transport' ? 'Vehicle' : '')
      )
    case 'timePeriod':
      return line.timePeriodTitle?.trim() || ''
    case 'type':
      return resolveTypeLabel(line.type)
    case 'unit':
      return resolveUnitLabel(line)
    case 'days':
      return formatRentalDays(line.rentalDays)
    default:
      return ''
  }
}

function formatRentalDays(days: number | null | undefined): string {
  if (days == null || !(days > 0)) return ''
  const whole = Number.isInteger(days) ? days : roundDaysLabel(days)
  return `${whole} day${whole === 1 ? '' : 's'}`
}

function roundDaysLabel(days: number): number {
  return Math.round(days * 10) / 10
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
): DescriptionTemplate {
  switch (type) {
    case 'equipment':
      return {
        tokens: [
          { kind: 'days' },
          { kind: 'itemName' },
          { kind: 'brand' },
          { kind: 'model' },
        ],
      }
    case 'crew':
      return {
        tokens: [{ kind: 'crew' }, { kind: 'crewName' }, { kind: 'time' }],
      }
    case 'transport':
      return {
        tokens: [
          { kind: 'custom', text: 'Transport' },
          { kind: 'vehicleName' },
        ],
      }
    default:
      return { tokens: [{ kind: 'itemName' }] }
  }
}

export function defaultTemplateForScope(
  scope: InvoiceLineDescriptionScope,
): DescriptionTemplate {
  if (scope === 'other') return { tokens: [{ kind: 'name' }] }
  return defaultTemplateForLineType(scope)
}

export function defaultDescriptionForLine(line: BookingInvoiceLine): string {
  return buildInvoiceLineDescription(
    line,
    defaultTemplateForLineType(line.type),
  )
}

export function getTemplateForLine(
  line: BookingInvoiceLine,
  store: InvoiceLineTemplateStore,
): DescriptionTemplate {
  const scoped = store[line.type]
  if (scoped) return scoped
  if (store.other) return store.other
  return defaultTemplateForLineType(line.type)
}

function hasTypeSpecificTemplate(
  store: InvoiceLineTemplateStore,
  type: BookingInvoiceLine['type'],
): boolean {
  return store[type] != null
}

export function applyTemplatesToLines(
  lines: Array<BookingInvoiceLine>,
  store: InvoiceLineTemplateStore,
  manualOverrides: Set<string>,
  scope: InvoiceLineDescriptionScope = 'other',
): Array<BookingInvoiceLine> {
  return lines.map((line) => {
    if (manualOverrides.has(line.id)) return line
    if (isOfferDiscountInvoiceLine(line.id)) return line
    if (scope === 'other') {
      if (hasTypeSpecificTemplate(store, line.type)) return line
    } else if (line.type !== scope) {
      return line
    }
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
  store: InvoiceLineTemplateStore = {},
): Array<BookingInvoiceLine> {
  return lines.filter((line) => {
    if (manualOverrides.has(line.id)) return false
    if (isOfferDiscountInvoiceLine(line.id)) return false
    if (scope === 'other') {
      return !hasTypeSpecificTemplate(store, line.type)
    }
    return line.type === scope
  })
}

export function countLinesByScope(
  lines: Array<BookingInvoiceLine>,
  manualOverrides: Set<string>,
  store: InvoiceLineTemplateStore = {},
): Record<InvoiceLineDescriptionScope, number> {
  return {
    other: getLinesAffectedByScope(lines, manualOverrides, 'other', store)
      .length,
    equipment: getLinesAffectedByScope(
      lines,
      manualOverrides,
      'equipment',
      store,
    ).length,
    crew: getLinesAffectedByScope(lines, manualOverrides, 'crew', store).length,
    transport: getLinesAffectedByScope(
      lines,
      manualOverrides,
      'transport',
      store,
    ).length,
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

function isOfferDiscountInvoiceLine(lineId: string): boolean {
  return lineId.endsWith('-offer-discount')
}

function migrateToken(token: DescriptionToken): DescriptionToken {
  if (token.kind === 'equipment') return { kind: 'itemName' }
  if (token.kind === 'transport') return { kind: 'vehicleName' }
  return token
}

function migrateTemplate(
  template: DescriptionTemplate | undefined,
): DescriptionTemplate | undefined {
  if (!template) return undefined
  return {
    ...template,
    tokens: template.tokens.map(migrateToken),
  }
}

type StoredTemplateStore = InvoiceLineTemplateStore & {
  all?: DescriptionTemplate
}

export function normalizeInvoiceLineTemplateStore(
  raw: StoredTemplateStore,
): InvoiceLineTemplateStore {
  return {
    other: migrateTemplate(raw.other ?? raw.all),
    equipment: migrateTemplate(raw.equipment),
    crew: migrateTemplate(raw.crew),
    transport: migrateTemplate(raw.transport),
  }
}

export function loadInvoiceLineTemplates(
  companyId: string,
): InvoiceLineTemplateStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${companyId}`)
    if (!raw) return {}
    return normalizeInvoiceLineTemplateStore(
      JSON.parse(raw) as StoredTemplateStore,
    )
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
      JSON.stringify(normalizeInvoiceLineTemplateStore(store)),
    )
  } catch {
    // ignore quota / private mode
  }
}
