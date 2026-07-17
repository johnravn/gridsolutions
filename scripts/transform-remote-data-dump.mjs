#!/usr/bin/env node
/**
 * Transform a remote Supabase data dump for local schema ahead of production.
 *
 * Remote may still expose:
 * - items/item_groups ownership columns (internally_owned, …) while local uses item_kind
 * - companies.theme_scaling while local has dropped that column
 *
 * Rewrites INSERT statements and returns SQL to backfill
 * reserved_items.subcontractor_id from subrental items.
 */

const ITEMS_OLD_HEADER =
  'INSERT INTO "public"."items" ("id", "company_id", "name", "category_id", "brand_id", "model", "allow_individual_booking", "total_quantity", "active", "notes", "deleted", "internal_owner_company_id", "external_owner_id", "internally_owned", "nicknames")'
const ITEMS_NEW_HEADER =
  'INSERT INTO "public"."items" ("id", "company_id", "name", "category_id", "brand_id", "model", "allow_individual_booking", "total_quantity", "active", "notes", "deleted", "nicknames", "item_kind")'

const ITEM_GROUPS_OLD_HEADER =
  'INSERT INTO "public"."item_groups" ("id", "company_id", "name", "description", "active", "category_id", "deleted", "unique", "internally_owned", "external_owner_id", "group_type")'
const ITEM_GROUPS_NEW_HEADER =
  'INSERT INTO "public"."item_groups" ("id", "company_id", "name", "description", "active", "category_id", "deleted", "unique", "item_kind", "group_type")'

const COMPANIES_OLD_HEADER =
  'INSERT INTO "public"."companies" ("id", "name", "created_at", "address", "vat_number", "general_email", "contact_person_id", "accent_color", "job_number_counter", "theme_radius", "theme_gray_color", "theme_panel_background", "theme_scaling", "terms_and_conditions_type", "terms_and_conditions_text", "terms_and_conditions_pdf_path", "logo_path", "logo_light_path", "logo_dark_path", "employee_daily_rate", "employee_hourly_rate", "owner_daily_rate", "owner_hourly_rate", "offer_number_counter", "is_demo")'
const COMPANIES_NEW_HEADER =
  'INSERT INTO "public"."companies" ("id", "name", "created_at", "address", "vat_number", "general_email", "contact_person_id", "accent_color", "job_number_counter", "theme_radius", "theme_gray_color", "theme_panel_background", "terms_and_conditions_type", "terms_and_conditions_text", "terms_and_conditions_pdf_path", "logo_path", "logo_light_path", "logo_dark_path", "employee_daily_rate", "employee_hourly_rate", "owner_daily_rate", "owner_hourly_rate", "offer_number_counter", "is_demo")'

/** @type {Map<string, string>} item_id -> subcontractor customer_id */
const subrentalItemOwners = new Map()

/**
 * @param {string} inner
 * @returns {Array<string | boolean | null>}
 */
function parsePgTuple(inner) {
  const values = []
  let i = 0

  while (i < inner.length) {
    while (i < inner.length && /[\s,]/.test(inner[i])) i += 1
    if (i >= inner.length) break

    if (inner.startsWith('NULL', i)) {
      values.push(null)
      i += 4
      continue
    }

    if (
      inner.startsWith('true', i) &&
      !/[a-zA-Z0-9_]/.test(inner[i + 4] ?? '')
    ) {
      values.push(true)
      i += 4
      continue
    }

    if (
      inner.startsWith('false', i) &&
      !/[a-zA-Z0-9_]/.test(inner[i + 5] ?? '')
    ) {
      values.push(false)
      i += 5
      continue
    }

    if (inner[i] === "'") {
      i += 1
      let str = ''
      while (i < inner.length) {
        if (inner[i] === "'") {
          if (inner[i + 1] === "'") {
            str += "'"
            i += 2
            continue
          }
          i += 1
          break
        }
        str += inner[i]
        i += 1
      }
      values.push(str)
      continue
    }

    let j = i
    while (j < inner.length && inner[j] !== ',') j += 1
    const token = inner.slice(i, j).trim()
    if (token === '') {
      values.push(null)
    } else if (/^-?\d+$/.test(token)) {
      values.push(Number(token))
    } else if (/^-?\d+\.\d+$/.test(token)) {
      values.push(Number(token))
    } else {
      values.push(token)
    }
    i = j
  }

  return values
}

/** @param {string | boolean | null} value */
function formatPgValue(value) {
  if (value === null) return 'NULL'
  if (value === true) return 'true'
  if (value === false) return 'false'
  if (typeof value === 'number') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

/** @param {Array<string | boolean | null>} values */
function formatPgTuple(values) {
  return `(${values.map(formatPgValue).join(', ')})`
}

/** @param {Array<string | boolean | null>} values */
function transformItemRow(values) {
  if (values.length === 13) {
    return values
  }

  if (values.length !== 15) {
    throw new Error(`Unexpected items row column count: ${values.length}`)
  }

  const itemId = String(values[0])
  const externalOwnerId = values[12]
  const internallyOwned = values[13]
  const itemKind =
    internallyOwned === false || internallyOwned === 'false'
      ? 'subrental'
      : 'stock'

  if (itemKind === 'subrental' && externalOwnerId) {
    subrentalItemOwners.set(itemId, String(externalOwnerId))
  }

  return [...values.slice(0, 11), values[14], itemKind]
}

/** @param {Array<string | boolean | null>} values */
function transformItemGroupRow(values) {
  if (values.length === 9) {
    return values
  }

  if (values.length !== 11) {
    throw new Error(`Unexpected item_groups row column count: ${values.length}`)
  }

  const internallyOwned = values[8]
  const itemKind =
    internallyOwned === false || internallyOwned === 'false'
      ? 'subrental'
      : 'stock'

  return [...values.slice(0, 8), itemKind, values[10]]
}

/** Drop theme_scaling (index 12) when present; leave already-stripped rows alone. */
/** @param {Array<string | boolean | null>} values */
function transformCompanyRow(values) {
  if (values.length === 24) {
    return values
  }

  if (values.length !== 25) {
    throw new Error(`Unexpected companies row column count: ${values.length}`)
  }

  return [...values.slice(0, 12), ...values.slice(13)]
}

/**
 * @param {string} sql
 * @param {string} oldHeader
 * @param {string} newHeader
 * @param {(values: Array<string | boolean | null>) => Array<string | boolean | null>} transformRow
 * @param {{ onConflict?: string }} [options]
 */
function transformInsertBlock(
  sql,
  oldHeader,
  newHeader,
  transformRow,
  options = {},
) {
  if (!sql.includes(oldHeader)) {
    return sql
  }

  const headerIdx = sql.indexOf(oldHeader)
  const valuesIdx = sql.indexOf('VALUES', headerIdx)
  if (valuesIdx === -1) {
    throw new Error(`Missing VALUES clause after ${oldHeader}`)
  }

  const prefix = sql.slice(0, headerIdx)
  const afterValuesStart = valuesIdx + 'VALUES'.length
  let endIdx = afterValuesStart
  let inString = false
  let parenDepth = 0

  for (let i = afterValuesStart; i < sql.length; i += 1) {
    const char = sql[i]
    if (inString) {
      if (char === "'") {
        if (sql[i + 1] === "'") {
          i += 1
          continue
        }
        inString = false
      }
      continue
    }

    if (char === "'") {
      inString = true
      continue
    }

    if (char === '(') parenDepth += 1
    if (char === ')') parenDepth -= 1
    if (char === ';' && parenDepth === 0) {
      endIdx = i + 1
      break
    }
  }

  const valuesBody = sql.slice(afterValuesStart, endIdx).replace(/;\s*$/, '')
  const suffix = sql.slice(endIdx)

  const tuples = []
  let searchFrom = 0
  while (searchFrom < valuesBody.length) {
    const start = valuesBody.indexOf('(', searchFrom)
    if (start === -1) break

    let depth = 0
    let inString = false
    let end = -1

    for (let i = start; i < valuesBody.length; i += 1) {
      const char = valuesBody[i]
      if (inString) {
        if (char === "'") {
          if (valuesBody[i + 1] === "'") {
            i += 1
            continue
          }
          inString = false
        }
        continue
      }

      if (char === "'") {
        inString = true
        continue
      }

      if (char === '(') depth += 1
      if (char === ')') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }

    if (end === -1) {
      throw new Error('Unterminated tuple in INSERT VALUES block')
    }

    const tupleText = valuesBody.slice(start + 1, end)
    const row = transformRow(parsePgTuple(tupleText))
    tuples.push(formatPgTuple(row))
    searchFrom = end + 1
  }

  const conflict = options.onConflict ? `\n${options.onConflict}` : ''
  return (
    prefix +
    newHeader +
    ' VALUES\n\t' +
    tuples.join(',\n\t') +
    conflict +
    ';' +
    suffix
  )
}

/**
 * Seed/migration already inserts Demo Company. Remote dumps include it in the
 * same multi-row INSERT — without ON CONFLICT the whole statement fails and
 * every other company is skipped.
 *
 * @param {string} sql
 */
function ensureCompaniesOnConflict(sql) {
  const marker = 'INSERT INTO "public"."companies"'
  const start = sql.indexOf(marker)
  if (start === -1) return { sql, changed: false }

  const statement = sql.slice(start)
  if (/ON CONFLICT/i.test(statement.slice(0, statement.indexOf(';') + 1))) {
    return { sql, changed: false }
  }

  let inString = false
  let parenDepth = 0
  let endIdx = -1
  for (let i = 0; i < statement.length; i += 1) {
    const char = statement[i]
    if (inString) {
      if (char === "'") {
        if (statement[i + 1] === "'") {
          i += 1
          continue
        }
        inString = false
      }
      continue
    }
    if (char === "'") {
      inString = true
      continue
    }
    if (char === '(') parenDepth += 1
    if (char === ')') parenDepth -= 1
    if (char === ';' && parenDepth === 0) {
      endIdx = i
      break
    }
  }

  if (endIdx === -1) {
    throw new Error('Unterminated companies INSERT statement')
  }

  const rewritten =
    sql.slice(0, start) +
    statement.slice(0, endIdx) +
    '\nON CONFLICT (id) DO NOTHING;' +
    statement.slice(endIdx + 1)

  return { sql: rewritten, changed: true }
}

export function buildSubrentalBackfillSql() {
  if (subrentalItemOwners.size === 0) {
    return ''
  }

  const valueRows = [...subrentalItemOwners.entries()]
    .map(
      ([itemId, subcontractorId]) =>
        `  ('${itemId}'::uuid, '${subcontractorId}'::uuid)`,
    )
    .join(',\n')

  return `-- Backfill subcontractor_id on reservations from legacy item ownership
UPDATE public.reserved_items ri
SET subcontractor_id = mapping.subcontractor_id
FROM (
  VALUES
${valueRows}
) AS mapping(item_id, subcontractor_id)
WHERE ri.item_id = mapping.item_id
  AND ri.subcontractor_id IS NULL;

INSERT INTO public.job_subcontractors (job_id, customer_id, created_at)
SELECT DISTINCT tp.job_id, ri.subcontractor_id, now()
FROM public.reserved_items ri
JOIN public.time_periods tp ON tp.id = ri.time_period_id
WHERE ri.subcontractor_id IS NOT NULL
ON CONFLICT (job_id, customer_id) DO NOTHING;
`
}

/**
 * @param {string} dumpSql
 * @returns {{ sql: string, transformed: boolean, subrentalItems: number, droppedThemeScaling: boolean, companiesOnConflict: boolean }}
 */
export function transformRemoteDataDump(dumpSql) {
  subrentalItemOwners.clear()

  let sql = dumpSql
  let transformed = false
  let droppedThemeScaling = false
  let companiesOnConflict = false

  if (sql.includes(ITEMS_OLD_HEADER)) {
    sql = transformInsertBlock(
      sql,
      ITEMS_OLD_HEADER,
      ITEMS_NEW_HEADER,
      transformItemRow,
    )
    transformed = true
  }

  if (sql.includes(ITEM_GROUPS_OLD_HEADER)) {
    sql = transformInsertBlock(
      sql,
      ITEM_GROUPS_OLD_HEADER,
      ITEM_GROUPS_NEW_HEADER,
      transformItemGroupRow,
    )
    transformed = true
  }

  if (sql.includes(COMPANIES_OLD_HEADER)) {
    sql = transformInsertBlock(
      sql,
      COMPANIES_OLD_HEADER,
      COMPANIES_NEW_HEADER,
      transformCompanyRow,
      { onConflict: 'ON CONFLICT (id) DO NOTHING' },
    )
    droppedThemeScaling = true
    companiesOnConflict = true
    transformed = true
  } else {
    const result = ensureCompaniesOnConflict(sql)
    sql = result.sql
    if (result.changed) {
      companiesOnConflict = true
      transformed = true
    }
  }

  return {
    sql,
    transformed,
    subrentalItems: subrentalItemOwners.size,
    droppedThemeScaling,
    companiesOnConflict,
  }
}
