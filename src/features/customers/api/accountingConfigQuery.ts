import { companyKey } from '@shared/api/queryKeys'
import { supabase } from '@shared/api/supabase'

export type CustomerAccountingConfig = {
  accounting_organization_id: string | null
  accounting_software: string | null
}

/** Shared Conta / accounting expansion row for customer surfaces. */
export function accountingConfigQuery(companyId: string) {
  return {
    queryKey: companyKey(companyId, 'accounting-config'),
    queryFn: async (): Promise<CustomerAccountingConfig | null> => {
      const { data, error } = await supabase
        .from('company_expansions')
        .select('accounting_organization_id, accounting_software')
        .eq('company_id', companyId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}
