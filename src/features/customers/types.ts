export type CrewPricingLevelInfo = {
  id: string
  name: string
  crew_rate_per_day: number | null
  crew_rate_per_hour: number | null
}

export type CustomerRow = {
  id: string
  company_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  vat_number: string | null
  is_partner: boolean
  logo_path: string | null
  accent_color?: string | null
  accent_color_custom?: string | null
  crew_pricing_level_id: string | null
  discount_percent: number | null
  crew_pricing_level?: CrewPricingLevelInfo | null
  created_at: string
  conta_customer_id?: number | null
  conta_days_until_payment_reminder?: number | null
  conta_days_until_estimate_overdue?: number | null
  conta_invoice_delivery_method?: string | null
  conta_invoice_count?: number | null
  conta_total_invoiced?: number | null
  conta_total_unpaid?: number | null
  conta_last_synced_at?: string | null
}

export type ContactRow = {
  id: string
  customer_id: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  notes: string | null
  created_at: string
}
