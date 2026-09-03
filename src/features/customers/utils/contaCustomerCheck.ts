import { contaClient } from '@shared/api/conta/client'
import { supabase } from '@shared/api/supabase'
import {
  hitDisplayName,
  rankContaCustomerMatches,
} from '@shared/conta/contaCustomerMatch'
import type { ContaMatchReason } from '@shared/conta/contaCustomerMatch'

export type ContaSearchField = 'orgNo' | 'email' | 'name' | 'phone'

export type ContaLinkedGridCustomer = {
  id: string
  name: string
}

export type ContaCustomerMatch = {
  id: number
  name: string
  orgNo?: string
  email?: string
  customerType?: string
  score: number
  reasons: Array<ContaMatchReason>
  linkedGridCustomer: ContaLinkedGridCustomer | null
}

export type ContaCustomerCheckResult = {
  exists: boolean
  matches: Array<ContaCustomerMatch>
  searchedBy: Array<ContaSearchField>
  contaCustomerId?: number
  contaCustomerName?: string
  error?: string
}

type ContaSearchHit = {
  id?: number
  name?: string
  customerName?: string
  orgNo?: string
  emailAddress?: string
  customerType?: string
}

export function contaMatchReasonLabel(reason: ContaMatchReason): string {
  if (reason === 'orgNo') return 'organisation number'
  if (reason === 'email') return 'email'
  return 'name'
}

export function contaCustomerTypeLabel(type?: string): string {
  if (type === 'INDIVIDUAL') return 'Private'
  if (type === 'ORGANIZATION') return 'Organisation'
  return 'Conta customer'
}

async function searchContaCustomers(
  organizationId: string,
  q: string,
): Promise<Array<ContaSearchHit>> {
  const orgSearch = (await contaClient.get(
    `/invoice/organizations/${organizationId}/customers?q=${encodeURIComponent(q)}&hits=25`,
  )) as { hits?: Array<ContaSearchHit> }
  return Array.isArray(orgSearch?.hits) ? orgSearch.hits : []
}

function searchTermsFor(customer: {
  name?: string | null
  email?: string | null
  phone?: string | null
  vat_number?: string | null
}): Array<{ field: ContaSearchField; q: string }> {
  const terms: Array<{ field: ContaSearchField; q: string }> = []
  const orgNo = customer.vat_number?.replace(/\D/g, '').trim()
  if (orgNo && orgNo.length >= 6) terms.push({ field: 'orgNo', q: orgNo })
  const email = customer.email?.trim()
  if (email) terms.push({ field: 'email', q: email })
  const name = customer.name?.trim()
  if (name && name.length >= 2) terms.push({ field: 'name', q: name })
  const phone = customer.phone?.replace(/\D/g, '').trim()
  if (phone && phone.length >= 8) terms.push({ field: 'phone', q: phone })
  return terms
}

async function loadLinkedGridCustomers(
  companyId: string,
  contaIds: Array<number>,
): Promise<Map<number, ContaLinkedGridCustomer>> {
  const linked = new Map<number, ContaLinkedGridCustomer>()
  if (contaIds.length === 0) return linked
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, conta_customer_id')
    .eq('company_id', companyId)
    .in('conta_customer_id', contaIds)
    .or('deleted.is.null,deleted.eq.false')
  if (error) throw error
  for (const row of data ?? []) {
    if (row.conta_customer_id == null) continue
    linked.set(row.conta_customer_id, { id: row.id, name: row.name })
  }
  return linked
}

/**
 * Search Conta for customers matching name, email, phone, or org number.
 * Returns ranked candidates and which Grid customer (if any) already linked them.
 */
export async function checkContaCustomerExists(
  organizationId: string,
  customer: {
    name?: string | null
    email?: string | null
    phone?: string | null
    vat_number?: string | null
  },
  options?: { companyId?: string | null },
): Promise<ContaCustomerCheckResult> {
  const terms = searchTermsFor(customer)
  if (terms.length === 0) {
    return {
      exists: false,
      matches: [],
      searchedBy: [],
      error: 'Add a name, email, or organization number to search in Conta.',
    }
  }

  try {
    const hitLists = await Promise.all(
      terms.map((term) => searchContaCustomers(organizationId, term.q)),
    )
    const ranked = rankContaCustomerMatches(customer, hitLists.flat())
    const linked = options?.companyId
      ? await loadLinkedGridCustomers(
          options.companyId,
          ranked.map((hit) => hit.id).filter((id): id is number => id != null),
        )
      : new Map<number, ContaLinkedGridCustomer>()

    const matches: Array<ContaCustomerMatch> = ranked.flatMap((hit) => {
      if (!hit.id) return []
      return [
        {
          id: hit.id,
          name: hitDisplayName(hit) || `Conta customer ${hit.id}`,
          orgNo: hit.orgNo || undefined,
          email: hit.emailAddress || undefined,
          customerType: hit.customerType || undefined,
          score: hit.score,
          reasons: hit.reasons,
          linkedGridCustomer: linked.get(hit.id) ?? null,
        },
      ]
    })

    const top = matches[0]
    return {
      exists: matches.length > 0,
      matches,
      searchedBy: terms.map((term) => term.field),
      contaCustomerId: top?.id,
      contaCustomerName: top?.name,
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to check Conta.'
    return {
      exists: false,
      matches: [],
      searchedBy: terms.map((term) => term.field),
      error: message,
    }
  }
}
