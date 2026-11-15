import { companyKey } from '@shared/api/queryKeys'
import { supabase } from '@shared/api/supabase'

/** Partner customers for owner / subcontractor pickers (shared query key). */
export function partnerCustomersQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: companyKey(companyId, 'partner-customers'),
    queryFn: async (): Promise<Array<{ id: string; name: string }>> => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('is_partner', true)
        .or('deleted.is.null,deleted.eq.false')
        .order('name', { ascending: true })
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  }
}
