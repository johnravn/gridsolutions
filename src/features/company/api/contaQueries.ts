// src/features/company/api/contaQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { contaClient } from '@shared/api/conta/client'
import { supabase } from '@shared/api/supabase'

export type IncomeAndExpensesData = {
  sumIncome?: number
  sumExpenses?: number
  sumResult?: number
  income?: Array<string> // Monthly income values
  expenses?: Array<string> // Monthly expenses values
  result?: Array<string> // Monthly result values
}

/**
 * Get available organizations from Conta API
 * @returns Array of organizations with their IDs
 */
export async function getAvailableOrganizations(): Promise<
  Array<{ id: string; name?: string }>
> {
  const organizations = await contaClient.get('/invoice/organizations')

  // Handle array response
  const orgs = Array.isArray(organizations) ? organizations : [organizations]

  // Extract organization IDs from the response
  // Try common field names
  const result: Array<{ id: string; name?: string }> = []
  for (const org of orgs) {
    const orgId =
      org.id ||
      org.opContextOrgId ||
      org.organizationId ||
      org.orgId ||
      org.opContext?.orgId ||
      null

    if (orgId) {
      const name =
        org.name ||
        org.organizationName ||
        org.orgName ||
        org.displayName ||
        undefined
      result.push({
        id: String(orgId),
        name,
      })
    }
  }
  return result
}

/**
 * Get the organization ID from database (user's selected organization)
 * The organization ID must be configured in Company Settings
 * @param companyId - Company ID to look up in database
 */
async function getOrganizationId(
  companyId?: string | null,
): Promise<string | null> {
  if (!companyId) return null

  const { data: expansion, error: expError } = await supabase
    .from('company_expansions')
    .select('accounting_organization_id')
    .eq('company_id', companyId)
    .maybeSingle()

  if (expError) throw expError

  return expansion?.accounting_organization_id ?? null
}

/**
 * Fetch income and expenses data for a given year from Conta API
 * @param companyId - The company ID to look up organization ID for (optional)
 * @param organizationId - The Conta organization ID (optional, will be fetched if not provided)
 * @param year - The year to fetch data for (e.g., 2024)
 */
export function incomeAndExpensesQuery(
  companyId: string | null,
  organizationId: string | null,
  year: number,
) {
  return queryOptions<IncomeAndExpensesData | null>({
    queryKey: [
      'conta',
      'income-expenses',
      companyId,
      organizationId,
      year,
    ] as const,
    queryFn: async () => {
      // If organizationId is not provided, try to get it
      let orgId = organizationId
      if (!orgId) {
        orgId = await getOrganizationId(companyId)
        if (!orgId) return null
      }

      return (await contaClient.get(
        `/accounting/organizations/${orgId}/income-and-expenses/${year}`,
      )) as IncomeAndExpensesData
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
