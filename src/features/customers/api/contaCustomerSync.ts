/**
 * Sync Subb customers with Conta.
 * - READ from Conta: match existing customers, update read-only fields
 * - WRITE to Conta: create new customers only (never update Conta)
 */

import { supabase } from '@shared/api/supabase'
import { contaClient } from '@shared/api/conta/client'
import {
  buildContaCustomerCreateBody,
  makeContaFetch,
  syncCustomersWithContaCore,
} from '@shared/conta/customerSyncCore'
import type {
  ContaClientOptions,
  SyncResult,
} from '@shared/conta/customerSyncCore'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@shared/types/database.types'

export type { ContaClientOptions, SyncResult }

type ContaCustomerHit = {
  id?: number
  name?: string
  customerName?: string
  orgNo?: string
  daysUntilPaymentReminder?: number
  daysUntilEstimateOverdue?: number
  invoiceDeliveryMethod?: string
  numberOfInvoices?: number
  sumTotalInvoiced?: number
  sumRemainingInvoices?: number
}

/**
 * Sync customers for a company with Conta.
 * - Matches by orgNo, existing Conta id, or unique email
 * - Updates read-only fields from Conta for matched customers
 * - Creates organisations in Conta when they have an org number and don't exist
 * - Private customers without an org number are linked in the customer dialog
 * @param contaOpt - When provided, use this for Conta API (cron/server). Otherwise use session-based contaClient.
 * @param supabaseClient - When provided (cron), use this; otherwise use session supabase.
 */
export async function syncCustomersWithConta(
  companyId: string,
  organizationId: string,
  contaOpt?: ContaClientOptions,
  supabaseClient?: SupabaseClient<Database>,
): Promise<SyncResult> {
  const db = supabaseClient ?? supabase
  const conta = contaOpt
    ? makeContaFetch(contaOpt)
    : {
        get: (path: string) => contaClient.get(path),
        post: (path: string, data?: unknown) => contaClient.post(path, data),
      }
  return syncCustomersWithContaCore(companyId, organizationId, conta, db)
}

/**
 * Fetch Conta customer data and sync to our DB (conta_customer_id and read-only fields).
 * Use when a customer exists in Conta and you want to pull their data into Subb.
 */
export type FetchFromContaResult = { ok: true } | { ok: false; error: string }

export async function fetchAndSyncContaCustomer(
  companyId: string,
  organizationId: string,
  subbCustomerId: string,
  contaCustomerId: number,
): Promise<FetchFromContaResult> {
  try {
    const full = (await contaClient.get(
      `/invoice/organizations/${organizationId}/customers/${contaCustomerId}`,
    )) as ContaCustomerHit

    if (!full?.id) return { ok: false, error: 'Customer not found in Conta.' }

    const { data: alreadyLinked, error: linkedError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('conta_customer_id', full.id)
      .neq('id', subbCustomerId)
      .or('deleted.is.null,deleted.eq.false')
      .maybeSingle()
    if (linkedError) return { ok: false, error: linkedError.message }
    if (alreadyLinked) {
      return {
        ok: false,
        error: `Already linked to ${alreadyLinked.name || 'another Grid customer'}.`,
      }
    }

    let invoiceCount: number | null = full.numberOfInvoices ?? null
    if (invoiceCount == null) {
      try {
        const invRes = (await contaClient.get(
          `/invoice/organizations/${organizationId}/invoices?customerId=${full.id}&hits=1`,
        )) as { totalHits?: number }
        invoiceCount = invRes?.totalHits ?? null
      } catch {
        // Ignore
      }
    }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('customers')
      .update({
        conta_customer_id: full.id,
        conta_days_until_payment_reminder:
          full.daysUntilPaymentReminder ?? null,
        conta_days_until_estimate_overdue:
          full.daysUntilEstimateOverdue ?? null,
        conta_invoice_delivery_method: full.invoiceDeliveryMethod ?? null,
        conta_invoice_count: invoiceCount,
        conta_total_invoiced:
          full.sumTotalInvoiced != null ? full.sumTotalInvoiced : null,
        conta_total_unpaid:
          full.sumRemainingInvoices != null ? full.sumRemainingInvoices : null,
        conta_last_synced_at: now,
      })
      .eq('id', subbCustomerId)
      .eq('company_id', companyId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Failed to fetch from Conta.'
    return { ok: false, error: message }
  }
}

/**
 * Create a single customer in Conta and link in our DB.
 * Organisations need an org number; private (INDIVIDUAL) customers do not.
 * A complete address is required either way.
 */
export type CreateInContaResult =
  | { ok: true; contaCustomerId: number }
  | { ok: false; error: string }

export async function createCustomerInConta(
  companyId: string,
  organizationId: string,
  customer: {
    id: string
    name: string | null
    address: string | null
    vat_number: string | null
    email: string | null
    phone: string | null
  },
): Promise<CreateInContaResult> {
  const createdBody = buildContaCustomerCreateBody(customer)
  if (!createdBody.ok) return { ok: false, error: createdBody.error }

  try {
    const created = (await contaClient.post(
      `/invoice/organizations/${organizationId}/customers`,
      createdBody.body,
    )) as { id?: number }

    const newId = created?.id
    if (!newId)
      return { ok: false, error: 'Conta did not return a customer ID.' }

    const { error } = await supabase
      .from('customers')
      .update({
        conta_customer_id: newId,
        conta_last_synced_at: new Date().toISOString(),
      })
      .eq('id', customer.id)
      .eq('company_id', companyId)

    if (error) return { ok: false, error: error.message }
    return { ok: true, contaCustomerId: newId }
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Failed to create in Conta.'
    return { ok: false, error: message }
  }
}

/**
 * Fetch invoice count for a Conta customer and update our DB
 */
export async function fetchAndStoreInvoiceCount(
  organizationId: string,
  contaCustomerId: number,
  subbCustomerId: string,
  companyId: string,
): Promise<number | null> {
  try {
    const res = (await contaClient.get(
      `/invoice/organizations/${organizationId}/invoices?customerId=${contaCustomerId}&hits=1`,
    )) as { totalHits?: number }
    const count = res?.totalHits ?? 0
    await supabase
      .from('customers')
      .update({ conta_invoice_count: count })
      .eq('id', subbCustomerId)
      .eq('company_id', companyId)
    return count
  } catch {
    return null
  }
}
