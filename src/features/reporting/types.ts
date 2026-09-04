export type JobProfitabilityRow = {
  job_id: string
  job_number: string
  title: string
  customer_id: string | null
  customer_name: string | null
  start_at: string | null
  end_at: string | null
  income: number
  expenses: number
  profit: number
  margin_pct: number | null
}

export type CustomerProfitabilityRow = {
  customer_id: string | null
  customer_name: string | null
  income: number
  expenses: number
  profit: number
  margin_pct: number | null
  job_count: number
}

export type UtilizationRow = {
  user_id: string
  display_name: string | null
  booked_hours: number
  capacity_hours: number
  utilization_pct: number | null
}

export type MonthlyTrendRow = {
  month_key: string
  month_label: string
  income: number
  expenses: number
  profit: number
}

export type InvoicePipelineBucket =
  | 'active'
  | 'ready'
  | 'invoiced'
  | 'paid'
  | 'canceled'

export type InvoicePipelineJobRow = {
  job_id: string
  job_number: string
  title: string
  customer_name: string | null
  status: string
  bucket: InvoicePipelineBucket
  start_at: string | null
  end_at: string | null
  income: number
}

export type InvoicePipelineSummary = {
  bucket: InvoicePipelineBucket
  label: string
  job_count: number
  income: number
}

export type InvoicePipelineResult = {
  summaries: Array<InvoicePipelineSummary>
  jobs: Array<InvoicePipelineJobRow>
}

export type ReportSegment =
  | 'jobs'
  | 'customers'
  | 'utilization'
  | 'low-margin'
  | 'monthly'
  | 'invoice'

export type MarginThreshold = 0 | 10 | 15 | 25

export type SortDir = 'asc' | 'desc'
