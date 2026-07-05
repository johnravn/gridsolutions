/**
 * Conta customer sync core — no path aliases or browser-only imports.
 * Safe for Vercel serverless (api/cron) and the app (via contaCustomerSync wrapper).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

export type ContaClientOptions = {
  apiKey: string
  baseUrl?: string
}

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

export type ContaFetch = {
  get: (path: string) => Promise<unknown>
  post: (path: string, data?: unknown) => Promise<unknown>
}

export type SyncResult = {
  updated: number
  created: number
  skipped: number
  errors: Array<string>
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

export function makeContaFetch(opt: ContaClientOptions): ContaFetch {
  const base = opt.baseUrl || 'https://api.gateway.conta.no'
  return {
    get: async (path: string) => {
      const r = await fetch(`${base}${path}`, {
        headers: { apiKey: opt.apiKey, Accept: 'application/json' },
      })
      if (!r.ok) throw new Error(`Conta ${r.status}: ${await r.text()}`)
      return r.json()
    },
    post: async (path: string, data?: unknown) => {
      const r = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          apiKey: opt.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      })
      if (!r.ok) throw new Error(`Conta ${r.status}: ${await r.text()}`)
      return r.json()
    },
  }
}

async function resolveContaHit(
  conta: ContaFetch,
  organizationId: string,
  contaHit: ContaCustomerHit | null,
  contaId: number | null,
): Promise<ContaCustomerHit | null> {
  if (!contaHit?.id && contaId) {
    try {
      const full = (await conta.get(
        `/invoice/organizations/${organizationId}/customers/${contaId}`,
      )) as ContaCustomerHit
      if (full?.id) return full
    } catch {
      // Customer may have been deleted in Conta
    }
    return null
  }

  if (contaHit?.id && contaHit.daysUntilPaymentReminder == null && contaId) {
    try {
      const full = (await conta.get(
        `/invoice/organizations/${organizationId}/customers/${contaId}`,
      )) as ContaCustomerHit
      if (full?.id) {
        return {
          ...contaHit,
          daysUntilPaymentReminder: full.daysUntilPaymentReminder,
          daysUntilEstimateOverdue: full.daysUntilEstimateOverdue,
          invoiceDeliveryMethod: full.invoiceDeliveryMethod,
        }
      }
    } catch {
      // Fall back to list hit
    }
  }

  return contaHit
}

export async function syncCustomersWithContaCore(
  companyId: string,
  organizationId: string,
  conta: ContaFetch,
  db: SupabaseClient<Database>,
): Promise<SyncResult> {
  const result: SyncResult = { updated: 0, created: 0, skipped: 0, errors: [] }

  const contaCustomersByOrgNo = new Map<string, ContaCustomerHit>()
  let page = 0
  const hitsPerPage = 100
  let hasMore = true
  while (hasMore) {
    const res = (await conta.get(
      `/invoice/organizations/${organizationId}/customers?hits=${hitsPerPage}&page=${page}`,
    )) as { hits?: Array<ContaCustomerHit>; totalHits?: number }
    const hits = Array.isArray(res?.hits) ? res.hits : []
    for (const h of hits) {
      const orgNo = (h.orgNo || '').replace(/\D/g, '').trim()
      if (orgNo && h.id) {
        contaCustomersByOrgNo.set(orgNo, {
          ...h,
          name: h.name ?? h.customerName,
        })
      }
    }
    const total = res?.totalHits ?? 0
    hasMore = (page + 1) * hitsPerPage < total
    page++
    if (hits.length === 0) break
  }

  const { data: subbCustomers, error: subbErr } = await db
    .from('customers')
    .select('id, name, email, phone, address, vat_number, conta_customer_id')
    .eq('company_id', companyId)
    .or('deleted.is.null,deleted.eq.false')

  if (subbErr) {
    result.errors.push(subbErr.message)
    return result
  }

  const now = new Date().toISOString()

  for (const c of subbCustomers ?? []) {
    const orgNo = (c.vat_number || '').replace(/\D/g, '').trim()
    if (!orgNo) {
      result.skipped++
      continue
    }

    const contaId = c.conta_customer_id ?? null
    let contaHit = contaCustomersByOrgNo.get(orgNo) ?? null
    contaHit = await resolveContaHit(conta, organizationId, contaHit, contaId)

    if (contaHit?.id) {
      try {
        let invoiceCount: number | null = contaHit.numberOfInvoices ?? null
        if (invoiceCount == null) {
          try {
            const invRes = (await conta.get(
              `/invoice/organizations/${organizationId}/invoices?customerId=${contaHit.id}&hits=1`,
            )) as { totalHits?: number }
            invoiceCount = invRes?.totalHits ?? null
          } catch {
            // Ignore invoice count fetch errors
          }
        }
        const { error } = await db
          .from('customers')
          .update({
            conta_customer_id: contaHit.id,
            conta_days_until_payment_reminder:
              contaHit.daysUntilPaymentReminder ?? null,
            conta_days_until_estimate_overdue:
              contaHit.daysUntilEstimateOverdue ?? null,
            conta_invoice_delivery_method:
              contaHit.invoiceDeliveryMethod ?? null,
            conta_invoice_count: invoiceCount,
            conta_total_invoiced:
              contaHit.sumTotalInvoiced != null
                ? contaHit.sumTotalInvoiced
                : null,
            conta_total_unpaid:
              contaHit.sumRemainingInvoices != null
                ? contaHit.sumRemainingInvoices
                : null,
            conta_last_synced_at: now,
          })
          .eq('id', c.id)
          .eq('company_id', companyId)
        if (error) result.errors.push(`${c.name}: ${error.message}`)
        else result.updated++
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Update failed'
        result.errors.push(`${c.name}: ${message}`)
      }
    } else {
      const addr = parseCustomerAddress(c.address || '')
      if (!addr.addressLine1 || !addr.addressPostcode || !addr.addressCity) {
        result.skipped++
        result.errors.push(`${c.name}: Missing address for Conta create`)
        continue
      }
      try {
        const created = (await conta.post(
          `/invoice/organizations/${organizationId}/customers`,
          {
            name: c.name?.trim() || 'Customer',
            customerType: 'ORGANIZATION',
            orgNo: orgNo,
            emailAddress: c.email?.trim() || undefined,
            phoneNo: c.phone?.trim() || undefined,
            customerAddressLine1: addr.addressLine1,
            customerAddressPostcode: addr.addressPostcode,
            customerAddressCity: addr.addressCity,
            customerAddressCountry: addr.addressCountry || undefined,
          },
        )) as { id?: number }
        const newId = created?.id
        if (newId) {
          const { error } = await db
            .from('customers')
            .update({
              conta_customer_id: newId,
              conta_last_synced_at: now,
            })
            .eq('id', c.id)
            .eq('company_id', companyId)
          if (error) result.errors.push(`${c.name}: ${error.message}`)
          else result.created++
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Create failed'
        result.errors.push(`${c.name}: ${message}`)
      }
    }
  }

  return result
}
