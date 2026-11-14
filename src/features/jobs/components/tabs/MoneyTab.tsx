// src/features/jobs/components/tabs/MoneyTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  IconButton,
  SegmentedControl,
  Table,
  Text,
} from '@radix-ui/themes'
import {
  CheckCircle,
  Edit,
  Plus,
  Trash,
  WarningTriangle,
  XmarkCircle,
} from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  ChartTypeSelector,
  IncomeExpensesChart,
} from '@shared/ui/components/IncomeExpensesChart'
import { contaClient } from '@shared/api/conta/client'
import { findContaProjectId } from '../../utils/contaProjects'
import { formatOfferNumberDisplay } from '../../utils/offerNumber'
import {
  deleteJobMoneyItem,
  insertJobMoneyItem,
  jobMoneyItemsQuery,
} from '../../api/moneyQueries'
import {
  jobSubcontractorQuotesQuery,
  jobSubcontractorsQuery,
} from '../../api/subcontractorQueries'
import MoneyItemEditDialog from '../dialogs/MoneyItemEditDialog'
import {
  DEFAULT_TRANSPORT_COST_PER_KM,
  buildContaExpenseSuggestions,
  buildPrimaryIncomeSuggestions,
  buildTransportCostSuggestion,
  categoryForSource,
  hasPrimaryIncomeSource,
} from '../../utils/moneySuggestions'
import {
  MONEY_ARCHETYPE_BLURBS,
  MONEY_ARCHETYPE_LABELS,
  buildMoneyCompletenessHints,
  buildSubcontractorQuoteSuggestions,
  detectMoneyArchetype,
  filterHighConfidenceSuggestions,
  sumOfferTransportKm,
} from '../../utils/moneyArchetypes'
import {
  CONTA_CONFIDENCE_COLOR,
  CONTA_CONFIDENCE_LABEL,
  contaLedgerDateRange,
  resolveContaLinkStatus,
} from '../../utils/moneyConta'
import MoneyTransportKmCard from './MoneyTransportKmCard'
import MoneyContaPanel from './MoneyContaPanel'
import MoneyItemsFilter from './MoneyItemsFilter'
import type { ContaDatePadOption } from '../../utils/moneyConta'
import type { MoneySuggestion } from '../../utils/moneySuggestions'
import type {
  JobMoneyItem,
  JobMoneyItemCategory,
  JobMoneyItemSource,
} from '../../api/moneyQueries'
import type { JobOffer } from '../../types'

type ContaLedgerLine = {
  id?: number
  date?: string
  dueDate?: string
  description?: string
  amount?: number
  invoiceNo?: string
  projectId?: number
  bookkeepingAccountName?: string
  supplierName?: string
}

type Suggestion = MoneySuggestion

export default function MoneyTab({ jobId }: { jobId: string }) {
  const { companyId } = useCompany()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [chartType, setChartType] = React.useState<
    'bar' | 'line' | 'area' | 'composed'
  >('area')
  const [showIncome, setShowIncome] = React.useState(true)
  const [showExpenses, setShowExpenses] = React.useState(true)
  /** User choice for crew expense/income calculation (hour vs day rate) */
  const [crewExpenseBillingUnit, setCrewExpenseBillingUnit] = React.useState<
    'hour' | 'day'
  >('hour')
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editMode, setEditMode] = React.useState<'add' | 'edit'>('add')
  const [editingItem, setEditingItem] = React.useState<JobMoneyItem | null>(
    null,
  )
  const [addSuggestion, setAddSuggestion] = React.useState<Suggestion | null>(
    null,
  )
  const [contaDatePad, setContaDatePad] =
    React.useState<ContaDatePadOption>('job')

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Fetch confirmed money items
  const { data: confirmedItems = [] } = useQuery(jobMoneyItemsQuery(jobId))

  // Fetch accepted offers for suggestions
  const { data: acceptedOffers = [] } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'accepted-offers'],
    queryFn: async (): Promise<Array<JobOffer>> => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'accepted')
        .order('accepted_at', { ascending: false })

      if (error) throw error
      return data as Array<JobOffer>
    },
  })

  const { data: jobInfo } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'job-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, jobnr, start_at, end_at, transport_km_driven')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return {
        id: data.id,
        title: data.title,
        jobnr: data.jobnr,
        start_at: data.start_at,
        end_at: data.end_at,
        transport_km_driven:
          data.transport_km_driven != null
            ? Number(data.transport_km_driven)
            : null,
      }
    },
  })

  const { data: jobSalesInvoices = [] } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'sales-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_invoices')
        .select(
          'id, status, created_at, invoice_data, conta_response, conta_invoice_id',
        )
        .eq('job_id', jobId)
        .in('status', ['created', 'paid'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: transportCostPerKm } = useQuery({
    queryKey: ['company', companyId, 'transport-cost-per-km'],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_expansions')
        .select('transport_cost_per_km')
        .eq('company_id', companyId!)
        .maybeSingle()
      if (error) throw error
      const raw = data?.transport_cost_per_km
      if (raw == null || !Number.isFinite(Number(raw))) {
        return DEFAULT_TRANSPORT_COST_PER_KM
      }
      return Number(raw)
    },
  })

  const { data: plannedOfferKm } = useQuery({
    queryKey: [
      'jobs',
      jobId,
      'money',
      'planned-offer-km',
      acceptedOffers[0]?.offer_basis_id,
    ],
    enabled: !!acceptedOffers[0]?.offer_basis_id,
    queryFn: async () => {
      const basisId = acceptedOffers[0]?.offer_basis_id
      if (!basisId) return null
      const { data, error } = await supabase
        .from('offer_transport_items')
        .select('distance_km')
        .eq('offer_basis_id', basisId)
      if (error) throw error
      return sumOfferTransportKm(data ?? [])
    },
  })

  const { data: subcontractors = [] } = useQuery({
    ...jobSubcontractorsQuery({ jobId }),
    enabled: !!jobId,
  })

  const { data: subcontractorQuotes = [] } = useQuery({
    ...jobSubcontractorQuotesQuery({ jobId }),
    enabled: !!jobId,
  })

  const { data: archetypeSignals } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'archetype-signals'],
    queryFn: async () => {
      const { data: periods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, category')
        .eq('job_id', jobId)
        .eq('deleted', false)
      if (tpErr) throw tpErr

      const byCat = (cat: string) =>
        (periods ?? []).filter((p) => p.category === cat).map((p) => p.id)

      const crewPeriodIds = byCat('crew')
      const equipmentPeriodIds = byCat('equipment')
      const transportPeriodIds = byCat('transport')

      let crewBookingCount = 0
      if (crewPeriodIds.length > 0) {
        const { count, error } = await supabase
          .from('reserved_crew')
          .select('id', { count: 'exact', head: true })
          .in('time_period_id', crewPeriodIds)
        if (error) throw error
        crewBookingCount = count ?? 0
      }

      let stockEquipmentCount = 0
      let subrentalEquipmentCount = 0
      if (equipmentPeriodIds.length > 0) {
        const { data: items, error } = await supabase
          .from('reserved_items')
          .select('id, item:item_id ( item_kind )')
          .in('time_period_id', equipmentPeriodIds)
        if (error) throw error
        for (const row of items ?? []) {
          const item = Array.isArray(row.item) ? row.item[0] : row.item
          if (item?.item_kind === 'subrental') subrentalEquipmentCount += 1
          else stockEquipmentCount += 1
        }
      }

      let transportBookingCount = 0
      if (transportPeriodIds.length > 0) {
        const { count, error } = await supabase
          .from('reserved_vehicles')
          .select('id', { count: 'exact', head: true })
          .in('time_period_id', transportPeriodIds)
        if (error) throw error
        transportBookingCount = count ?? 0
      }

      return {
        crewBookingCount,
        stockEquipmentCount,
        subrentalEquipmentCount,
        transportBookingCount,
      }
    },
  })

  const { data: accountingConfig } = useQuery({
    queryKey: ['company', companyId, 'accounting-config'],
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select('accounting_organization_id, accounting_software')
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) throw error
      return data as {
        accounting_organization_id: string | null
        accounting_software: string | null
      } | null
    },
    enabled: !!companyId,
  })

  const { data: contaProjectId } = useQuery({
    queryKey: [
      'conta',
      'project',
      accountingConfig?.accounting_organization_id,
      jobId,
      jobInfo?.jobnr,
    ],
    queryFn: async () => {
      if (!accountingConfig?.accounting_organization_id || !jobInfo) {
        return null
      }
      return findContaProjectId(accountingConfig.accounting_organization_id, {
        jobTitle: jobInfo.title,
        jobnr: jobInfo.jobnr,
        jobId,
      })
    },
    enabled: !!accountingConfig?.accounting_organization_id && !!jobInfo,
  })

  const jobNumberTokens = React.useMemo(() => {
    if (!jobInfo?.jobnr) return []
    const raw = String(jobInfo.jobnr)
    const padded = String(jobInfo.jobnr).padStart(6, '0')
    return [
      raw,
      padded,
      `#${raw}`,
      `#${padded}`,
      `job ${raw}`,
      `job ${padded}`,
      `job #${raw}`,
      `job #${padded}`,
    ].map((token) => token.toLowerCase())
  }, [jobInfo?.jobnr])

  const matchesJobNumber = React.useCallback(
    (line: ContaLedgerLine) => {
      if (!jobNumberTokens.length) return false
      const haystack =
        `${line.description || ''} ${line.invoiceNo || ''}`.toLowerCase()
      return jobNumberTokens.some((token) => haystack.includes(token))
    },
    [jobNumberTokens],
  )

  const {
    data: contaExpensePull,
    isLoading: isContaExpensesLoading,
    isFetching: isContaExpensesFetching,
    error: contaExpensesError,
    refetch: refetchContaExpenses,
  } = useQuery({
    queryKey: [
      'conta',
      'job-expenses',
      accountingConfig?.accounting_organization_id,
      contaProjectId,
      jobInfo?.jobnr,
      jobInfo?.start_at,
      jobInfo?.end_at,
      contaDatePad,
    ],
    queryFn: async () => {
      if (!accountingConfig?.accounting_organization_id) {
        return {
          lines: [] as Array<ContaLedgerLine>,
          matchMode: 'jobnr' as const,
        }
      }
      if (!contaProjectId && jobNumberTokens.length === 0) {
        return {
          lines: [] as Array<ContaLedgerLine>,
          matchMode: 'jobnr' as const,
        }
      }

      const params = new URLSearchParams({
        includeLedgerLines: 'true',
        includeClosedLedgerLines: 'true',
        includeOldTransactions: 'true',
        maxTransactionsPerPage: '200',
      })

      const matchMode = contaProjectId
        ? ('project' as const)
        : ('jobnr' as const)

      if (contaProjectId) {
        params.set('projectId', String(contaProjectId))
      }

      const range = contaLedgerDateRange(
        jobInfo?.start_at,
        jobInfo?.end_at,
        contaDatePad,
      )
      if (range.startDate) params.set('startDate', range.startDate)
      if (range.endDate) params.set('endDate', range.endDate)

      const report = (await contaClient.get(
        `/accounting/organizations/${accountingConfig.accounting_organization_id}/reports/supplier-ledger?${params.toString()}`,
      )) as {
        bookkeepingAccountLedgers?: Array<{
          name?: string
          ledgerLines?: Array<ContaLedgerLine>
        }>
      }

      const lines = (report.bookkeepingAccountLedgers || []).flatMap((ledger) =>
        (ledger.ledgerLines || []).map((line) => ({
          ...line,
          supplierName: ledger.name,
        })),
      )
      return {
        lines: matchMode === 'project' ? lines : lines.filter(matchesJobNumber),
        matchMode,
      }
    },
    enabled:
      !!accountingConfig?.accounting_organization_id &&
      (!!contaProjectId || jobNumberTokens.length > 0),
  })

  const contaLedgerLines = React.useMemo(
    () => contaExpensePull?.lines ?? [],
    [contaExpensePull?.lines],
  )
  const contaExpenseMatchMode = contaExpensePull?.matchMode ?? 'jobnr'

  const { data: jobCrewPricing } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'crew-pricing'],
    queryFn: async () => {
      const { data: jobData } = await supabase
        .from('jobs')
        .select(
          `customer_id,
          customer:customers!jobs_customer_id_fkey (
            crew_pricing_level_id,
            crew_pricing_level:crew_pricing_level_id (
              crew_rate_per_day,
              crew_rate_per_hour,
              default_crew_billing_unit
            )
          )`,
        )
        .eq('id', jobId)
        .maybeSingle()

      const customer = Array.isArray((jobData as any)?.customer)
        ? (jobData as any)?.customer?.[0]
        : (jobData as any)?.customer
      const crewLevel = Array.isArray(customer?.crew_pricing_level)
        ? customer?.crew_pricing_level?.[0]
        : customer?.crew_pricing_level

      const { data: companyExpansion } = await supabase
        .from('company_expansions')
        .select(
          'crew_rate_per_day, crew_rate_per_hour, default_crew_billing_unit',
        )
        .eq('company_id', companyId!)
        .maybeSingle()

      const billingUnit: 'day' | 'hour' =
        (crewLevel?.default_crew_billing_unit ??
          (companyExpansion as { default_crew_billing_unit?: string })
            ?.default_crew_billing_unit ??
          'hour') === 'hour'
          ? 'hour'
          : 'day'
      const crewRatePerDay =
        crewLevel?.crew_rate_per_day ?? companyExpansion?.crew_rate_per_day ?? 0
      const crewRatePerHour =
        crewLevel?.crew_rate_per_hour ??
        companyExpansion?.crew_rate_per_hour ??
        0

      return {
        crewRatePerDay: Number(crewRatePerDay) || 0,
        crewRatePerHour: Number(crewRatePerHour) || 0,
        crewBillingUnit: billingUnit,
      }
    },
    enabled: !!companyId && !!jobId,
  })

  const { data: companyRates } = useQuery({
    queryKey: ['company', companyId, 'general-rates'] as const,
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('companies')
        .select(
          'employee_daily_rate, employee_hourly_rate, owner_daily_rate, owner_hourly_rate',
        )
        .eq('id', companyId)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: crewBookings } = useQuery({
    queryKey: ['jobs', jobId, 'money', 'crew-expenses'],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: timePeriods, error: tpError } = await supabase
        .from('time_periods')
        .select('id, start_at, end_at')
        .eq('job_id', jobId)
        .eq('category', 'crew')

      if (tpError) throw tpError
      if (!timePeriods || timePeriods.length === 0) return []

      const timePeriodIds = timePeriods.map((tp) => tp.id)
      const { data: reservedCrew, error: crewError } = await supabase
        .from('reserved_crew')
        .select(
          `
          id,
          user_id,
          placeholder_name,
          time_period_id,
          user:user_id (
            user_id,
            display_name,
            email
          )
        `,
        )
        .in('time_period_id', timePeriodIds)

      if (crewError) throw crewError
      if (!reservedCrew || reservedCrew.length === 0) return []

      const userIds = reservedCrew
        .map((rc: any) => rc.user_id)
        .filter((id: string | null): id is string => !!id)

      let companyUsers: Array<any> = []
      if (userIds.length > 0) {
        const { data, error: cuError } = await supabase
          .from('company_user_profiles')
          .select('user_id, role, rate_type, rate')
          .eq('company_id', companyId!)
          .in('user_id', userIds)
        if (cuError) throw cuError
        companyUsers = data || []
      }

      const userRatesMap = new Map(
        (companyUsers || []).map((cu: any) => [cu.user_id, cu]),
      )

      return (reservedCrew || []).map((rc: any) => {
        const timePeriod = timePeriods.find((tp) => tp.id === rc.time_period_id)
        const user = Array.isArray(rc.user) ? rc.user[0] : rc.user
        const companyUser = userRatesMap.get(rc.user_id)
        return {
          id: rc.id,
          user_id: rc.user_id,
          user_name:
            user?.display_name ||
            user?.email ||
            rc.placeholder_name ||
            'Unknown',
          role: companyUser?.role || null,
          rate_type: companyUser?.rate_type || null,
          rate: companyUser?.rate ? Number(companyUser.rate) : null,
          start_at: timePeriod?.start_at || null,
          end_at: timePeriod?.end_at || null,
        }
      })
    },
  })

  const crewExpenseSuggestionsRaw = React.useMemo(() => {
    if (!crewBookings || !companyRates) return []
    return crewBookings
      .map((booking) => {
        if (!booking.start_at || !booking.end_at) return null
        const start = new Date(booking.start_at)
        const end = new Date(booking.end_at)
        const durationHours =
          (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        const durationDays = durationHours / 24

        let rate: number | null = null
        let rateType: 'daily' | 'hourly' | null = null
        if (booking.role === 'freelancer') {
          rate = booking.rate
          rateType = booking.rate_type
        } else if (booking.role === 'employee') {
          const useHourly =
            crewExpenseBillingUnit === 'hour' &&
            companyRates.employee_hourly_rate
          const useDaily =
            crewExpenseBillingUnit === 'day' && companyRates.employee_daily_rate
          if (useHourly) {
            rate = Number(companyRates.employee_hourly_rate)
            rateType = 'hourly'
          } else if (useDaily) {
            rate = Number(companyRates.employee_daily_rate)
            rateType = 'daily'
          } else if (companyRates.employee_daily_rate) {
            rate = Number(companyRates.employee_daily_rate)
            rateType = 'daily'
          } else if (companyRates.employee_hourly_rate) {
            rate = Number(companyRates.employee_hourly_rate)
            rateType = 'hourly'
          }
        } else if (booking.role === 'owner') {
          const useHourly =
            crewExpenseBillingUnit === 'hour' && companyRates.owner_hourly_rate
          const useDaily =
            crewExpenseBillingUnit === 'day' && companyRates.owner_daily_rate
          if (useHourly) {
            rate = Number(companyRates.owner_hourly_rate)
            rateType = 'hourly'
          } else if (useDaily) {
            rate = Number(companyRates.owner_daily_rate)
            rateType = 'daily'
          } else if (companyRates.owner_daily_rate) {
            rate = Number(companyRates.owner_daily_rate)
            rateType = 'daily'
          } else if (companyRates.owner_hourly_rate) {
            rate = Number(companyRates.owner_hourly_rate)
            rateType = 'hourly'
          }
        }
        if (!rate || !rateType) return null
        const amount =
          rateType === 'daily'
            ? rate * Math.ceil(durationDays)
            : rate * durationHours
        return {
          id: `crew-expense-${booking.id}`,
          sourceId: `crew-${booking.id}`,
          type: 'expense' as const,
          description: `${booking.user_name} (${booking.role || 'unknown'})`,
          amount,
          date: booking.start_at,
          reference: undefined as string | undefined,
          source: 'crew' as JobMoneyItemSource,
          category: 'crew' as JobMoneyItemCategory,
        }
      })
      .filter((exp): exp is NonNullable<typeof exp> => exp !== null)
  }, [crewBookings, companyRates, crewExpenseBillingUnit])

  const contaExpenseSuggestionsRaw = React.useMemo(
    () =>
      buildContaExpenseSuggestions({
        lines: contaLedgerLines,
        matchMode: contaExpenseMatchMode,
      }),
    [contaLedgerLines, contaExpenseMatchMode],
  )

  const contaLinkStatus = React.useMemo(
    () =>
      resolveContaLinkStatus({
        hasOrganizationId: !!accountingConfig?.accounting_organization_id,
        contaProjectId: contaProjectId ?? null,
        hasJobnr: !!jobInfo?.jobnr,
      }),
    [
      accountingConfig?.accounting_organization_id,
      contaProjectId,
      jobInfo?.jobnr,
    ],
  )

  const confirmedSourceIds = React.useMemo(
    () =>
      new Set(
        confirmedItems
          .filter((i) => i.source_id)
          .map((i) => i.source_id as string),
      ),
    [confirmedItems],
  )

  const suppressCrewIncome = React.useMemo(
    () =>
      hasPrimaryIncomeSource({
        invoices: jobSalesInvoices,
        acceptedOffers: acceptedOffers.map((o) => ({
          total_after_discount: Number(o.total_after_discount) || 0,
        })),
      }),
    [jobSalesInvoices, acceptedOffers],
  )

  const crewIncomeSuggestionsRaw = React.useMemo<Array<Suggestion>>(() => {
    // When offer or Conta sales invoice income exists, do not suggest per-crew income
    // (avoids double-counting crew revenue already in the primary income total).
    if (suppressCrewIncome) return []
    if (!crewBookings || !jobCrewPricing) return []
    const { crewRatePerDay, crewRatePerHour } = jobCrewPricing
    if (crewRatePerDay <= 0 && crewRatePerHour <= 0) return []

    return crewBookings
      .map((booking) => {
        if (!booking.start_at || !booking.end_at) return null
        const start = new Date(booking.start_at)
        const end = new Date(booking.end_at)
        const durationHours =
          (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        const durationDays = durationHours / 24

        const unitPrice =
          crewExpenseBillingUnit === 'hour' ? crewRatePerHour : crewRatePerDay
        const amount =
          crewExpenseBillingUnit === 'hour'
            ? unitPrice * durationHours
            : unitPrice * Math.ceil(durationDays)

        if (amount <= 0) return null

        return {
          id: `crew-income-${booking.id}`,
          sourceId: `crew-income-${booking.id}`,
          type: 'income' as const,
          description: `${booking.user_name} – income (customer rate)`,
          amount,
          date: booking.start_at,
          reference: undefined as string | undefined,
          source: 'crew' as JobMoneyItemSource,
          category: 'crew' as JobMoneyItemCategory,
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
  }, [suppressCrewIncome, crewBookings, jobCrewPricing, crewExpenseBillingUnit])

  const primaryIncomeSuggestionsRaw = React.useMemo(
    () =>
      buildPrimaryIncomeSuggestions({
        invoices: jobSalesInvoices,
        acceptedOffers: acceptedOffers.map((o) => ({
          id: o.id,
          offernr: o.offernr,
          title: o.title,
          version_number: o.version_number,
          total_after_discount: Number(o.total_after_discount) || 0,
          accepted_at: o.accepted_at,
        })),
        formatOfferLabel: (offer) =>
          [
            formatOfferNumberDisplay(offer.offernr),
            offer.title || `Offer v${offer.version_number}`,
            'ex MVA',
          ]
            .filter(Boolean)
            .join(' — '),
      }),
    [jobSalesInvoices, acceptedOffers],
  )

  const transportSuggestionRaw = React.useMemo(
    () =>
      buildTransportCostSuggestion({
        kmDriven: jobInfo?.transport_km_driven,
        costPerKm: transportCostPerKm ?? DEFAULT_TRANSPORT_COST_PER_KM,
        date: jobInfo?.start_at ?? null,
      }),
    [jobInfo?.transport_km_driven, jobInfo?.start_at, transportCostPerKm],
  )

  const quoteSuggestionsRaw = React.useMemo(() => {
    const names: Record<string, string> = {}
    for (const s of subcontractors) {
      names[s.id] = s.customer?.name ?? 'Subcontractor'
    }
    return buildSubcontractorQuoteSuggestions({
      quotes: subcontractorQuotes,
      subcontractorNames: names,
    })
  }, [subcontractors, subcontractorQuotes])

  const incomeSuggestions = React.useMemo<Array<Suggestion>>(() => {
    const primary = primaryIncomeSuggestionsRaw.filter(
      (s) => !confirmedSourceIds.has(s.sourceId),
    )
    const crew = crewIncomeSuggestionsRaw.filter(
      (s) => !confirmedSourceIds.has(s.sourceId),
    )
    return [...primary, ...crew]
  }, [
    primaryIncomeSuggestionsRaw,
    crewIncomeSuggestionsRaw,
    confirmedSourceIds,
  ])

  const expenseSuggestions = React.useMemo<Array<Suggestion>>(() => {
    const crew = crewExpenseSuggestionsRaw
      .filter((e) => !confirmedSourceIds.has(e.sourceId))
      .map((e) => ({
        ...e,
        category: categoryForSource(e.source, e.type, 'crew'),
      }))
    const quotes = quoteSuggestionsRaw.filter(
      (e) => !confirmedSourceIds.has(e.sourceId),
    )
    const conta = contaExpenseSuggestionsRaw
      .filter((e) => !confirmedSourceIds.has(e.sourceId))
      .map((e) => ({
        ...e,
        category: categoryForSource(e.source, e.type, 'conta'),
      }))
    const transport =
      transportSuggestionRaw &&
      !confirmedSourceIds.has(transportSuggestionRaw.sourceId)
        ? [transportSuggestionRaw]
        : []
    return [...crew, ...quotes, ...conta, ...transport]
  }, [
    crewExpenseSuggestionsRaw,
    quoteSuggestionsRaw,
    contaExpenseSuggestionsRaw,
    transportSuggestionRaw,
    confirmedSourceIds,
  ])

  const suggestions: Array<Suggestion> = React.useMemo(
    () => [...incomeSuggestions, ...expenseSuggestions],
    [incomeSuggestions, expenseSuggestions],
  )

  const highConfidenceSuggestions = React.useMemo(
    () => filterHighConfidenceSuggestions(suggestions),
    [suggestions],
  )

  const moneyArchetype = React.useMemo(
    () =>
      detectMoneyArchetype({
        crewBookingCount: archetypeSignals?.crewBookingCount ?? 0,
        stockEquipmentCount: archetypeSignals?.stockEquipmentCount ?? 0,
        subrentalEquipmentCount: archetypeSignals?.subrentalEquipmentCount ?? 0,
        hasSubcontractors: subcontractors.length > 0,
        hasSubcontractorQuotes: quoteSuggestionsRaw.length > 0,
        transportBookingCount: archetypeSignals?.transportBookingCount ?? 0,
        plannedOfferKm: plannedOfferKm ?? null,
        transportKmDriven: jobInfo?.transport_km_driven ?? null,
      }),
    [
      archetypeSignals,
      subcontractors.length,
      quoteSuggestionsRaw.length,
      plannedOfferKm,
      jobInfo?.transport_km_driven,
    ],
  )

  const hasTransportSignal =
    (archetypeSignals?.transportBookingCount ?? 0) > 0 ||
    (plannedOfferKm != null && plannedOfferKm > 0) ||
    (jobInfo?.transport_km_driven != null && jobInfo.transport_km_driven > 0) ||
    moneyArchetype === 'transport_heavy'

  const completenessHints = React.useMemo(
    () =>
      buildMoneyCompletenessHints({
        confirmed: confirmedItems,
        hasPrimaryIncomeSuggestion: primaryIncomeSuggestionsRaw.length > 0,
        transportKmDriven: jobInfo?.transport_km_driven ?? null,
        plannedOfferKm: plannedOfferKm ?? null,
        hasTransportSignal,
        unconfirmedHighConfidenceCount: highConfidenceSuggestions.length,
        hasQuoteSuggestions: quoteSuggestionsRaw.some(
          (q) => !confirmedSourceIds.has(q.sourceId),
        ),
      }),
    [
      confirmedItems,
      primaryIncomeSuggestionsRaw.length,
      jobInfo?.transport_km_driven,
      plannedOfferKm,
      hasTransportSignal,
      highConfidenceSuggestions.length,
      quoteSuggestionsRaw,
      confirmedSourceIds,
    ],
  )

  const confirmedIncomeItems = confirmedItems.filter((i) => i.type === 'income')
  const confirmedExpenseItems = confirmedItems.filter(
    (i) => i.type === 'expense',
  )
  const visibleConfirmedItems = React.useMemo(
    () =>
      confirmedItems.filter(
        (i) =>
          (i.type === 'income' && showIncome) ||
          (i.type === 'expense' && showExpenses),
      ),
    [confirmedItems, showIncome, showExpenses],
  )
  const visibleSuggestions = React.useMemo(
    () =>
      suggestions.filter(
        (s) =>
          (s.type === 'income' && showIncome) ||
          (s.type === 'expense' && showExpenses),
      ),
    [suggestions, showIncome, showExpenses],
  )

  const totalIncome = confirmedIncomeItems.reduce((sum, i) => sum + i.amount, 0)
  const totalExpenses = confirmedExpenseItems.reduce(
    (sum, i) => sum + i.amount,
    0,
  )
  const profitLoss = totalIncome - totalExpenses

  const crewIncomeItems = confirmedIncomeItems.filter(
    (i) => i.source === 'crew',
  )
  const crewExpenseItems = confirmedExpenseItems.filter(
    (i) => i.source === 'crew',
  )
  const crewMargin =
    crewIncomeItems.reduce((s, i) => s + i.amount, 0) -
    crewExpenseItems.reduce((s, i) => s + i.amount, 0)
  const hasCrewItems = crewIncomeItems.length > 0 || crewExpenseItems.length > 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const chartData = React.useMemo(() => {
    const monthlyData = new Map<string, { income: number; expenses: number }>()
    confirmedItems.forEach((item) => {
      const d = item.date || item.created_at
      const date = new Date(d)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { income: 0, expenses: 0 })
      }
      const data = monthlyData.get(monthKey)!
      if (item.type === 'income') data.income += item.amount
      else data.expenses += item.amount
    })
    return Array.from(monthlyData.entries())
      .map(([key, data]) => {
        const [year, month] = key.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return {
          month: date.toLocaleDateString('nb-NO', {
            month: 'short',
            year: 'numeric',
          }),
          income: data.income,
          expenses: data.expenses,
        }
      })
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [confirmedItems])

  const deleteMutation = useMutation({
    mutationFn: deleteJobMoneyItem,
    onSuccess: () => {
      success('Item removed')
      void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'money-items'] })
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to remove item',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const addAllHighConfidenceMutation = useMutation({
    mutationFn: async (items: Array<Suggestion>) => {
      if (!companyId) throw new Error('No company')
      for (const s of items) {
        await insertJobMoneyItem({
          job_id: jobId,
          company_id: companyId,
          type: s.type,
          description: s.description,
          amount: s.amount,
          date: s.date,
          reference: s.reference ?? null,
          source: s.source,
          source_id: s.sourceId,
          category: s.category,
        })
      }
      return items.length
    },
    onSuccess: (count) => {
      success(
        'Suggestions added',
        `${count} high-confidence item${count === 1 ? '' : 's'} confirmed.`,
      )
      void qc.invalidateQueries({ queryKey: ['jobs', jobId, 'money-items'] })
    },
    onError: (e: unknown) => {
      toastError(
        'Failed to add suggestions',
        e instanceof Error ? e.message : 'Please try again.',
      )
    },
  })

  const handleAddFromSuggestion = (s: Suggestion) => {
    setAddSuggestion(s)
    setEditMode('add')
    setEditingItem(null)
    setEditDialogOpen(true)
  }

  const handleAddCustom = () => {
    setAddSuggestion(null)
    setEditMode('add')
    setEditingItem(null)
    setEditDialogOpen(true)
  }

  const handleEditItem = (item: JobMoneyItem) => {
    setAddSuggestion(null)
    setEditMode('edit')
    setEditingItem(item)
    setEditDialogOpen(true)
  }

  const getSourceBadgeColor = (s: Suggestion | JobMoneyItem) => {
    const source = s.source
    if ('source_id' in s && s.source_id?.startsWith('quote-')) return 'orange'
    if ('sourceId' in s && s.sourceId?.startsWith('quote-')) return 'orange'
    if (s.category === 'transport') return 'amber'
    if (source === 'offer') return 'green'
    if (source === 'crew') return 'red'
    if (source === 'conta') return 'blue'
    return 'gray'
  }
  const getSourceLabel = (s: Suggestion | JobMoneyItem) => {
    if ('source_id' in s && s.source_id?.startsWith('quote-')) return 'Quote'
    if ('sourceId' in s && s.sourceId?.startsWith('quote-')) return 'Quote'
    if (s.category === 'transport') return 'Transport'
    if (s.source === 'offer') return 'Offer'
    if (s.source === 'crew') return 'Crew'
    if (s.source === 'conta') return 'Conta'
    return 'Manual'
  }

  return (
    <Box style={{ maxWidth: '100%', minWidth: 0 }}>
      <Flex justify="between" align="center" mb="3" gap="3" wrap="wrap">
        <Heading size="3">Money</Heading>
        <Flex align="center" gap="2" wrap="wrap">
          {highConfidenceSuggestions.length > 0 && (
            <Button
              size="2"
              variant="soft"
              disabled={addAllHighConfidenceMutation.isPending}
              onClick={() =>
                addAllHighConfidenceMutation.mutate(highConfidenceSuggestions)
              }
            >
              {addAllHighConfidenceMutation.isPending
                ? 'Adding…'
                : `Add all high-confidence (${highConfidenceSuggestions.length})`}
            </Button>
          )}
          {chartData.length > 0 && (
            <ChartTypeSelector
              chartType={chartType}
              onChartTypeChange={setChartType}
            />
          )}
        </Flex>
      </Flex>

      <Card mb="3" style={{ background: 'var(--gray-a2)' }}>
        <Flex direction="column" gap="1">
          <Flex align="center" gap="2" wrap="wrap">
            <Text size="2" weight="bold">
              Job type
            </Text>
            <Badge variant="soft" size="1">
              {MONEY_ARCHETYPE_LABELS[moneyArchetype]}
            </Badge>
          </Flex>
          <Text size="2" color="gray">
            {MONEY_ARCHETYPE_BLURBS[moneyArchetype]}
          </Text>
        </Flex>
      </Card>

      {completenessHints.length > 0 && (
        <Card mb="3" style={{ background: 'var(--yellow-a2)' }}>
          <Flex direction="column" gap="2">
            <Flex align="center" gap="2">
              <WarningTriangle width={16} height={16} />
              <Text size="2" weight="bold">
                Completeness
              </Text>
            </Flex>
            {completenessHints.map((hint) => (
              <Text
                key={hint.id}
                size="2"
                color={hint.severity === 'warn' ? 'orange' : 'gray'}
              >
                {hint.message}
              </Text>
            ))}
          </Flex>
        </Card>
      )}

      <MoneyTransportKmCard
        jobId={jobId}
        kmDriven={jobInfo?.transport_km_driven ?? null}
        costPerKm={transportCostPerKm ?? DEFAULT_TRANSPORT_COST_PER_KM}
        plannedOfferKm={plannedOfferKm ?? null}
        prominent={moneyArchetype === 'transport_heavy' || hasTransportSignal}
      />

      <MoneyContaPanel
        status={contaLinkStatus}
        datePad={contaDatePad}
        onDatePadChange={setContaDatePad}
        onSync={() => {
          void refetchContaExpenses()
        }}
        isSyncing={isContaExpensesLoading || isContaExpensesFetching}
        projectId={contaProjectId ?? null}
        expenseCount={
          contaExpenseSuggestionsRaw.filter(
            (s) => !confirmedSourceIds.has(s.sourceId),
          ).length
        }
        incomeCount={
          primaryIncomeSuggestionsRaw.filter(
            (s) => s.source === 'conta' && !confirmedSourceIds.has(s.sourceId),
          ).length
        }
        lastError={
          contaExpensesError instanceof Error
            ? contaExpensesError.message
            : contaExpensesError
              ? String(contaExpensesError)
              : null
        }
      />

      {/* Financial Summary Cards - from confirmed items only */}
      <Flex
        gap="3"
        mb="4"
        wrap="wrap"
        style={{ minWidth: 0, maxWidth: '100%' }}
      >
        <Card style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%' }}>
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Total Income
            </Text>
            <Heading size="6" color="green">
              {formatCurrency(totalIncome)}
            </Heading>
            <Text size="1" color="gray">
              {confirmedIncomeItems.length} item
              {confirmedIncomeItems.length !== 1 ? 's' : ''}
            </Text>
          </Flex>
        </Card>
        <Card style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%' }}>
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Total Expenses
            </Text>
            <Heading size="6" color="red">
              {formatCurrency(totalExpenses)}
            </Heading>
            <Text size="1" color="gray">
              {confirmedExpenseItems.length} item
              {confirmedExpenseItems.length !== 1 ? 's' : ''}
            </Text>
          </Flex>
        </Card>
        <Card style={{ flex: '1 1 200px', minWidth: 0, maxWidth: '100%' }}>
          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Net Profit/Loss
            </Text>
            <Heading size="6" color={profitLoss >= 0 ? 'green' : 'red'}>
              {formatCurrency(profitLoss)}
            </Heading>
            <Flex align="center" gap="1">
              {profitLoss >= 0 ? (
                <CheckCircle width={14} height={14} color="var(--green-9)" />
              ) : (
                <XmarkCircle width={14} height={14} color="var(--red-9)" />
              )}
              <Text size="1" color={profitLoss >= 0 ? 'green' : 'red'}>
                {profitLoss >= 0 ? 'Profit' : 'Loss'}
              </Text>
            </Flex>
            {hasCrewItems && (
              <Text size="1" color="gray" mt="1">
                Crew margin: {formatCurrency(crewMargin)}
              </Text>
            )}
          </Flex>
        </Card>
      </Flex>

      {/* Suggestions section */}
      {suggestions.length > 0 && (
        <Card mb="4">
          <Flex justify="between" align="center" mb="3" wrap="wrap" gap="3">
            <Heading size="4">
              Suggestions{' '}
              <Badge size="1" variant="soft">
                {visibleSuggestions.length}
              </Badge>
            </Heading>
            {(crewExpenseSuggestionsRaw.length > 0 ||
              crewIncomeSuggestionsRaw.length > 0) && (
              <Flex align="center" gap="2">
                <Text size="2" color="gray">
                  Crew rates:
                </Text>
                <SegmentedControl.Root
                  value={crewExpenseBillingUnit}
                  onValueChange={(v) =>
                    setCrewExpenseBillingUnit(v as 'hour' | 'day')
                  }
                  size="1"
                >
                  <SegmentedControl.Item value="day">
                    Day rate
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="hour">
                    Hour rate
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              </Flex>
            )}
          </Flex>
          <Text size="2" color="gray" mb="3">
            Add items from real events. You can edit before adding. Conta lines
            show match confidence — review amounts (may be inkl. MVA).
          </Text>
          <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Table.Root variant="surface" size="1">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Source</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Confidence</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell align="right">
                    Amount
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: 80 }} />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {visibleSuggestions.map((s) => (
                  <Table.Row key={s.id}>
                    <Table.Cell>
                      <Badge
                        size="1"
                        variant="soft"
                        color={s.type === 'income' ? 'green' : 'red'}
                      >
                        {s.type === 'income' ? 'Income' : 'Expense'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex direction="column" gap="1">
                        <Text size="2">{s.description}</Text>
                        {s.confidenceReason && (
                          <Text size="1" color="gray">
                            {s.confidenceReason}
                          </Text>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>{formatDate(s.date)}</Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={getSourceBadgeColor(s)}
                        variant="soft"
                        size="1"
                      >
                        {getSourceLabel(s)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {s.confidence ? (
                        <Badge
                          size="1"
                          variant="soft"
                          color={CONTA_CONFIDENCE_COLOR[s.confidence]}
                          title={s.confidenceReason ?? undefined}
                        >
                          {CONTA_CONFIDENCE_LABEL[s.confidence]}
                        </Badge>
                      ) : (
                        <Text size="1" color="gray">
                          —
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell align="right">
                      <Text
                        weight="medium"
                        size="2"
                        color={s.type === 'income' ? 'green' : 'red'}
                      >
                        {formatCurrency(s.amount)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        size="1"
                        variant="soft"
                        onClick={() => handleAddFromSuggestion(s)}
                      >
                        Add
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card>
      )}

      {/* Confirmed Items */}
      <Card mb="4">
        <Flex justify="between" align="center" mb="3" gap="3" wrap="wrap">
          <Heading size="4">Items</Heading>
          <Flex align="center" gap="2" wrap="wrap">
            <Button size="2" variant="soft" onClick={handleAddCustom}>
              <Plus width={16} height={16} />
              Add item
            </Button>
            <MoneyItemsFilter
              showIncome={showIncome}
              showExpenses={showExpenses}
              onShowIncomeChange={setShowIncome}
              onShowExpensesChange={setShowExpenses}
            />
          </Flex>
        </Flex>

        {visibleConfirmedItems.length === 0 ? (
          <Text size="2" color="gray">
            No items yet. Add from suggestions or add item.
          </Text>
        ) : (
          <Box style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Description</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Reference</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Source</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell align="right">
                    Amount
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell style={{ width: 90 }} />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {visibleConfirmedItems.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>
                      <Badge
                        size="1"
                        variant="soft"
                        color={item.type === 'income' ? 'green' : 'red'}
                      >
                        {item.type === 'income' ? 'Income' : 'Expense'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{item.description}</Table.Cell>
                    <Table.Cell>{formatDate(item.date)}</Table.Cell>
                    <Table.Cell>{item.reference || '—'}</Table.Cell>
                    <Table.Cell>
                      <Badge color={getSourceBadgeColor(item)} variant="soft">
                        {getSourceLabel(item)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell align="right">
                      <Text
                        weight="medium"
                        color={item.type === 'income' ? 'green' : 'red'}
                      >
                        {formatCurrency(item.amount)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="2">
                        <IconButton
                          size="1"
                          variant="ghost"
                          color="gray"
                          onClick={() => handleEditItem(item)}
                        >
                          <Edit width={14} height={14} />
                        </IconButton>
                        <IconButton
                          size="1"
                          variant="ghost"
                          color="red"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash width={14} height={14} />
                        </IconButton>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        )}
      </Card>

      {/* Chart */}
      {chartData.length > 0 ? (
        <Card mb="4">
          <Heading size="4" mb="3">
            Income vs Expenses
          </Heading>
          <Box
            style={{
              height: 400,
              width: '100%',
              minWidth: 0,
              overflowX: 'auto',
            }}
          >
            <IncomeExpensesChart
              data={chartData}
              height={400}
              chartType={chartType}
              onChartTypeChange={setChartType}
            />
          </Box>
        </Card>
      ) : (
        <Card mb="4">
          <Flex
            direction="column"
            align="center"
            justify="center"
            gap="3"
            style={{ minHeight: 300, padding: '40px' }}
          >
            <Text size="3" color="gray" align="center">
              No financial data yet
            </Text>
            <Text size="2" color="gray" align="center">
              Add income and expense items from suggestions or manually. Totals
              and chart will update.
            </Text>
          </Flex>
        </Card>
      )}

      <MoneyItemEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        jobId={jobId}
        companyId={companyId ?? ''}
        mode={editMode}
        initialData={
          addSuggestion
            ? {
                type: addSuggestion.type,
                description: addSuggestion.description,
                amount: addSuggestion.amount,
                date: addSuggestion.date,
                reference: addSuggestion.reference,
                source: addSuggestion.source,
                sourceId: addSuggestion.sourceId,
                category: addSuggestion.category,
              }
            : undefined
        }
        existingItem={editingItem}
        onSaved={() => {
          setAddSuggestion(null)
          setEditingItem(null)
        }}
      />
    </Box>
  )
}
