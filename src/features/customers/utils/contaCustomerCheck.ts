import { contaClient } from '@shared/api/conta/client'

export type ContaCustomerCheckResult = {
  exists: boolean
  contaCustomerId?: number
  contaCustomerName?: string
  searchedBy: 'orgNo'
  error?: string
}

/**
 * Check if a customer exists in Conta by organization number only.
 * Uses the Conta customers search API. Always searches by orgNo.
 */
export async function checkContaCustomerExists(
  organizationId: string,
  customer: {
    name?: string | null
    vat_number?: string | null
  },
): Promise<ContaCustomerCheckResult> {
  const orgNo = customer.vat_number?.replace(/\D/g, '').trim()

  if (!orgNo || orgNo.length < 6) {
    return {
      exists: false,
      searchedBy: 'orgNo',
      error: 'Organization number is required to search in Conta. Add a VAT/org number to the customer.',
    }
  }

  try {
    const orgSearch = (await contaClient.get(
      `/invoice/organizations/${organizationId}/customers?q=${encodeURIComponent(orgNo)}`,
    )) as { hits?: Array<{ id?: number; name?: string; orgNo?: string }> }
    const hits = Array.isArray(orgSearch?.hits) ? orgSearch.hits : []
    const match = hits.find(
      (h) => (h.orgNo || '').replace(/\D/g, '') === orgNo,
    )
    if (match?.id) {
      return {
        exists: true,
        contaCustomerId: match.id,
        contaCustomerName: match.name ?? undefined,
        searchedBy: 'orgNo',
      }
    }

    return {
      exists: false,
      searchedBy: 'orgNo',
    }
  } catch (error: any) {
    return {
      exists: false,
      searchedBy: 'orgNo',
      error: error?.message ?? 'Failed to check Conta.',
    }
  }
}
