/**
 * Sync Subb customers with Conta.
 * - READ from Conta: match existing customers, update read-only fields
 * - WRITE to Conta: create new customers only (never update Conta)
 */

import { supabase } from '@shared/api/supabase'
import { contaClient } from '@shared/api/conta/client'
import {
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

function parseCustomerAddress(address: string) {
  const normalized = address.replace(/\r/g, '').trim()
  let addressLine1 = ''
  let addressPostcode = ''
  let addressCity = ''
  let addressCountry = ''

  const postcodeMatch = normalized.match(/\b(\d{4,5})\b/)
  if (postcodeMatch && postcodeMatch.index !== undefined) {
    addressPostcode = postcodeMatch[1]
    const before = normalized.slice(0, postcodeMatch.index).trim()
    const after = normalized
      .slice(postcodeMatch.index + postcodeMatch[1].length)
      .trim()
    const beforeParts = before
      .split(/[,\n]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    addressLine1 = beforeParts[0] || before
    const afterParts = after
      .split(/[,\n]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    addressCity = afterParts[0] || ''
    if (afterParts.length > 1)
      addressCountry = afterParts[afterParts.length - 1] || ''
  } else {
    const parts = normalized
      .split(/[,\n]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    addressLine1 = parts[0] || ''
    const zipPart = parts.find((p) => /\d{4,5}/.test(p))
    if (zipPart) {
      const m = zipPart.match(/\b(\d{4,5})\b/)
      if (m) {
        addressPostcode = m[1]
        addressCity = zipPart.replace(m[1], '').trim()
      }
    }
    if (!addressCity && parts.length > 1) addressCity = parts[1] || ''
    if (parts.length > 2) addressCountry = parts[parts.length - 1] || ''
  }
  return { addressLine1, addressPostcode, addressCity, addressCountry }
}

/**
 * Sync customers for a company with Conta.
 * - Matches by orgNo (VAT)
 * - Updates read-only fields from Conta for matched customers
 * - Creates in Conta only when customer doesn't exist
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
 * Requires org number and valid address.
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
  const orgNo = (customer.vat_number || '').replace(/\D/g, '').trim()
  if (!orgNo || orgNo.length < 6) {
    return {
      ok: false,
      error: 'Organization number is required to create in Conta.',
    }
  }

  const addr = parseCustomerAddress(customer.address || '')
  if (!addr.addressLine1 || !addr.addressPostcode || !addr.addressCity) {
    return {
      ok: false,
      error:
        'Valid address (street, postal code, city) is required to create in Conta.',
    }
  }

  try {
    const created = (await contaClient.post(
      `/invoice/organizations/${organizationId}/customers`,
      {
        name: customer.name?.trim() || 'Customer',
        customerType: 'ORGANIZATION',
        orgNo,
        emailAddress: customer.email?.trim() || undefined,
        phoneNo: customer.phone?.trim() || undefined,
        customerAddressLine1: addr.addressLine1,
        customerAddressPostcode: addr.addressPostcode,
        customerAddressCity: addr.addressCity,
        customerAddressCountry: addr.addressCountry || undefined,
      },
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
