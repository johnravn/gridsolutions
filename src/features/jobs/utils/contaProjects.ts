import {
  contaClient,
  contaPostForResponse,
  formatContaApiError,
} from '@shared/api/conta/client'

type ContaProject = {
  id?: number
  name?: string
  description?: string
}

type ContaProjectSearchResponse =
  | { hits?: Array<ContaProject> }
  | { data?: Array<ContaProject> }
  | Array<ContaProject>
  | null
  | undefined

type ContaProjectSearchBody = {
  hits?: Array<ContaProject>
  hitCount?: number
  pageCount?: number
}

type ContaProjectInput = {
  jobTitle: string
  jobnr?: number | null
  jobId: string
  customerId?: number | null
}

const formatJobNumber = (jobnr?: number | null, jobId?: string) => {
  if (jobnr) return `#${String(jobnr).padStart(6, '0')}`
  return jobId ? `#${jobId}` : '#unknown'
}

export const buildContaJobProjectName = ({
  jobTitle,
  jobnr,
  jobId,
}: ContaProjectInput) => {
  const jobLabel = formatJobNumber(jobnr, jobId)
  return `Job ${jobLabel} - ${jobTitle}`
}

const extractProjectHits = (response: ContaProjectSearchResponse) => {
  if (!response) return [] as Array<ContaProject>
  if (Array.isArray(response)) return response
  if ('hits' in response && Array.isArray(response.hits)) return response.hits
  if ('data' in response && Array.isArray(response.data)) return response.data
  return []
}

const asSearchBody = (response: unknown): ContaProjectSearchBody =>
  response && typeof response === 'object' ? (response as ContaProjectSearchBody) : {}

/** Conta supports a per-page `hits` cap; use a high value so we do not miss matches. */
const SEARCH_HITS = 500
const CATALOG_PAGE_SIZE = 200

function normalizeForCompare(s: string): string {
  return s
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

async function searchProjects(
  organizationId: string,
  q: string,
  hits: number = SEARCH_HITS,
): Promise<Array<ContaProject>> {
  const params = new URLSearchParams()
  params.set('q', q)
  params.set('hits', String(hits))
  const response = (await contaClient.get(
    `/invoice/organizations/${organizationId}/projects?${params.toString()}`,
  )) as ContaProjectSearchResponse
  return extractProjectHits(response)
}

/**
 * Page through project search without a filter term (when the API allows it).
 * Used after 409 duplicate to locate an existing project the search index did not return for our `q` strings.
 */
async function fetchProjectsCatalog(
  organizationId: string,
  maxPages = 30,
): Promise<Array<ContaProject>> {
  const merged: Array<ContaProject> = []
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams()
    params.set('hits', String(CATALOG_PAGE_SIZE))
    params.set('page', String(page))
    let response: unknown
    try {
      response = await contaClient.get(
        `/invoice/organizations/${organizationId}/projects?${params.toString()}`,
      )
    } catch {
      break
    }
    const hits = extractProjectHits(response as ContaProjectSearchResponse)
    merged.push(...hits)
    const body = asSearchBody(response)
    const pageCount = body.pageCount ?? 1
    if (page >= pageCount - 1) break
    if (hits.length < CATALOG_PAGE_SIZE) break
  }
  return mergeHitsById(merged)
}

function mergeHitsById(hits: Array<ContaProject>): Array<ContaProject> {
  const byId = new Map<number, ContaProject>()
  for (const hit of hits) {
    if (hit.id == null) continue
    const id = Number(hit.id)
    if (!Number.isFinite(id)) continue
    if (!byId.has(id)) byId.set(id, hit)
  }
  return [...byId.values()]
}

function pickProjectIdFromHits(
  hits: Array<ContaProject>,
  input: ContaProjectInput,
  options: { allowSingleHitFallback: boolean },
): number | null {
  if (!hits.length) return null

  const normalizedJobnr = input.jobnr ? String(input.jobnr) : null
  const paddedJobnr = input.jobnr ? String(input.jobnr).padStart(6, '0') : null
  const normalizedJobId = input.jobId.toLowerCase()
  const expectedNameRaw = buildContaJobProjectName(input)
  const expectedName = normalizeForCompare(expectedNameRaw)
  const descMarker = `subb job ${input.jobId}`.toLowerCase()

  const exactName = hits.find(
    (hit) => normalizeForCompare(hit.name || '') === expectedName,
  )
  if (exactName?.id != null) return Number(exactName.id)

  const match = hits.find((hit) => {
    const name = (hit.name || '').toLowerCase()
    const desc = (hit.description || '').toLowerCase()
    if (!name && !desc) return false
    if (normalizeForCompare(hit.name || '') === expectedName) return true
    if (normalizedJobnr && name.includes(normalizedJobnr)) return true
    if (paddedJobnr && name.includes(paddedJobnr)) return true
    if (normalizedJobId && name.includes(normalizedJobId)) return true
    if (normalizedJobId && desc.includes(normalizedJobId)) return true
    if (desc.includes(descMarker)) return true
    return false
  })
  if (match?.id != null) return Number(match.id)

  if (options.allowSingleHitFallback && hits.length === 1 && hits[0].id != null) {
    return Number(hits[0].id)
  }
  return null
}

function collectPrimarySearchQueries(input: ContaProjectInput): string[] {
  const queries: string[] = []
  const fullName = buildContaJobProjectName(input)
  queries.push(fullName)
  queries.push(`Subb job ${input.jobId}`)
  if (input.jobnr !== null && input.jobnr !== undefined) {
    queries.push(String(input.jobnr))
    queries.push(String(input.jobnr).padStart(6, '0'))
  }
  const title = input.jobTitle?.trim()
  if (title) queries.push(title)
  queries.push(input.jobId)
  return [...new Set(queries.filter((q) => q.length > 0))]
}

export async function findContaProjectId(
  organizationId: string,
  input: ContaProjectInput,
): Promise<number | null> {
  const merged: Array<ContaProject> = []
  for (const q of collectPrimarySearchQueries(input)) {
    try {
      merged.push(...(await searchProjects(organizationId, q)))
    } catch {
      // ignore failed search term
    }
  }
  const hits = mergeHitsById(merged)
  return pickProjectIdFromHits(hits, input, { allowSingleHitFallback: true })
}

function isLikelyDuplicateProjectError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  const m = msg.toLowerCase()
  // Conta can return 409 + "already being used by the system" for FK violations
  // (ForeignKeyViolationDatabaseToolException) — not a duplicate project.
  if (
    m.includes('being used by the system') &&
    !m.includes('project') &&
    !m.includes('visma') &&
    !m.includes('alreadyexists')
  ) {
    return false
  }
  if (m.includes('could not attach this job to the linked customer')) return false
  return (
    m.includes('409') ||
    m.includes('already') ||
    m.includes('duplicate') ||
    m.includes('being used')
  )
}

function coerceFiniteId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Conta may include `properties.projectId` when create fails because a project
 * already exists (e.g. duplicate Visma number — see OpenAPI
 * `alreadyExistsProjectWithSameVismaNoException`).
 */
function pickProjectIdFromContaErrorBody(body: unknown): number | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Record<string, unknown>

  if (
    b.properties &&
    typeof b.properties === 'object' &&
    !Array.isArray(b.properties)
  ) {
    const fromProps = coerceFiniteId(
      (b.properties as Record<string, unknown>).projectId,
    )
    if (fromProps != null) return fromProps
  }

  const top = coerceFiniteId(b.projectId)
  if (top != null) return top

  const errs = b.errors
  if (Array.isArray(errs)) {
    for (const err of errs) {
      if (!err || typeof err !== 'object' || Array.isArray(err)) continue
      const e = err as Record<string, unknown>
      if (
        e.properties &&
        typeof e.properties === 'object' &&
        !Array.isArray(e.properties)
      ) {
        const id = coerceFiniteId(
          (e.properties as Record<string, unknown>).projectId,
        )
        if (id != null) return id
      }
      const id2 = coerceFiniteId(e.projectId)
      if (id2 != null) return id2
    }
  }
  return null
}

function contaParsedExceptionName(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const name = (body as Record<string, unknown>).name
  return typeof name === 'string' ? name : null
}

async function postContaJobProject(
  organizationId: string,
  payload: { name: string; description: string; customerId?: number },
): Promise<number> {
  const endpoint = `/invoice/organizations/${organizationId}/projects`
  const response = await contaPostForResponse(endpoint, payload)
  const rawText = await response.text()
  let parsed: unknown = null
  if (rawText) {
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = null
    }
  }
  if (response.ok) {
    const created = parsed as { id?: number }
    if (created?.id == null) {
      throw new Error(
        formatContaApiError(
          response.status,
          response.statusText,
          parsed,
          rawText,
        ),
      )
    }
    return Number(created.id)
  }

  const conflictId = pickProjectIdFromContaErrorBody(parsed)
  if (
    conflictId != null &&
    (response.status === 409 || response.status === 422)
  ) {
    return conflictId
  }

  if (contaParsedExceptionName(parsed) === 'ForeignKeyViolationDatabaseToolException') {
    throw new Error(
      'Conta could not attach this job to the linked customer (invalid reference or customer from another Conta organization). Re-sync or re-link the customer with Conta from customer settings, then try again.',
    )
  }

  throw new Error(
    formatContaApiError(response.status, response.statusText, parsed, rawText),
  )
}

/** Broader search after create returned duplicate / in-use (Conta 409). */
async function findContaProjectIdAfterDuplicateConflict(
  organizationId: string,
  input: ContaProjectInput,
): Promise<number | null> {
  const merged: Array<ContaProject> = []
  const queries = [
    buildContaJobProjectName(input),
    `Subb job ${input.jobId}`,
    input.jobId,
  ]
  for (const q of [...new Set(queries.filter(Boolean))]) {
    try {
      merged.push(...(await searchProjects(organizationId, q, SEARCH_HITS)))
    } catch {
      // ignore
    }
  }
  let hits = mergeHitsById(merged)
  let picked = pickProjectIdFromHits(hits, input, { allowSingleHitFallback: false })
  if (picked) return picked

  try {
    const catalog = await fetchProjectsCatalog(organizationId)
    picked = pickProjectIdFromHits(catalog, input, { allowSingleHitFallback: false })
    if (picked) return picked
  } catch {
    // catalog not supported or failed
  }

  return null
}

export async function ensureContaProjectId(
  organizationId: string,
  input: ContaProjectInput,
): Promise<number | null> {
  const existingId = await findContaProjectId(organizationId, input)
  if (existingId) return existingId

  const name = buildContaJobProjectName(input)
  const description = `Subb job ${input.jobId}`
  const createPayload = {
    name,
    description,
    ...(input.customerId ? { customerId: input.customerId } : {}),
  }

  try {
    return await postContaJobProject(organizationId, createPayload)
  } catch (error) {
    if (!isLikelyDuplicateProjectError(error)) throw error
    const recovered = await findContaProjectIdAfterDuplicateConflict(
      organizationId,
      input,
    )
    if (recovered) return recovered

    // Conta rejected the canonical name but search did not return the row: create a disambiguated project so invoicing can proceed.
    const fallbackName = `${name} (${input.jobId.slice(0, 8)})`
    try {
      return await postContaJobProject(
        organizationId,
        {
          name: fallbackName,
          description,
          ...(input.customerId ? { customerId: input.customerId } : {}),
        },
      )
    } catch {
      // fall through
    }

    throw error
  }
}
