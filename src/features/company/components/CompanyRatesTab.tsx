// src/features/company/components/CompanyRatesTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'

import type { RentalFactorConfig } from '../api/queries'

type CompanyRates = {
  crew_rate_per_day: number | null
  crew_rate_per_hour: number | null
  vehicle_daily_rate: number | null
  vehicle_distance_rate: number | null
  vehicle_distance_increment: number | null
  customer_discount_percent: number | null
  partner_discount_percent: number | null
  rental_factor_config: RentalFactorConfig | null
  fixed_rate_start_day: number | null
  fixed_rate_per_day: number | null
}

export default function CompanyRatesTab() {
  const { companyId } = useCompany()

  // Fetch company expansion with rates
  const { data: expansion, isLoading } = useQuery({
    queryKey: ['company', companyId, 'expansion'] as const,
    enabled: !!companyId,
    queryFn: async (): Promise<CompanyRates | null> => {
      if (!companyId) return null
      const { data, error } = await supabase
        .from('company_expansions')
        .select(
          'crew_rate_per_day, crew_rate_per_hour, vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment, customer_discount_percent, partner_discount_percent, rental_factor_config, fixed_rate_start_day, fixed_rate_per_day',
        )
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      // Parse rental_factor_config if it's a string
      const rawData = data as any
      let rentalFactorConfig = rawData.rental_factor_config
      if (typeof rentalFactorConfig === 'string') {
        try {
          rentalFactorConfig = JSON.parse(rentalFactorConfig)
        } catch {
          rentalFactorConfig = null
        }
      }

      return {
        crew_rate_per_day: rawData.crew_rate_per_day ?? null,
        crew_rate_per_hour: rawData.crew_rate_per_hour ?? null,
        vehicle_daily_rate: rawData.vehicle_daily_rate ?? null,
        vehicle_distance_rate: rawData.vehicle_distance_rate ?? null,
        vehicle_distance_increment: rawData.vehicle_distance_increment ?? 150,
        customer_discount_percent: rawData.customer_discount_percent ?? null,
        partner_discount_percent: rawData.partner_discount_percent ?? null,
        rental_factor_config: rentalFactorConfig,
        fixed_rate_start_day: rawData.fixed_rate_start_day ?? null,
        fixed_rate_per_day: rawData.fixed_rate_per_day ?? null,
      } as CompanyRates
    },
  })

  if (!companyId) return <div>No company selected.</div>

  if (isLoading) {
    return (
      <Flex align="center" justify="center" p="6">
        <Spinner size="3" />
      </Flex>
    )
  }

  return (
    <Box style={{ height: '100%', overflowY: 'auto', minHeight: 0 }}>
      <Flex direction="column" gap="4" p="4">
        <Heading size="4" mb="2">
          Standard Rates & Discounts
        </Heading>
        <Text size="2" color="gray" mb="4">
          Set default rates for crew and transport (per day and per hour), and
          standard discounts for customers and partners. These will be used as
          defaults in technical offers, but can be overridden when creating
          offers.
        </Text>

        <CrewRatesCard
          companyId={companyId}
          initialRates={{
            crew_rate_per_day: expansion?.crew_rate_per_day ?? null,
            crew_rate_per_hour: expansion?.crew_rate_per_hour ?? null,
          }}
        />

        <VehicleRatesCard
          companyId={companyId}
          initialRates={{
            vehicle_daily_rate: expansion?.vehicle_daily_rate ?? null,
            vehicle_distance_rate: expansion?.vehicle_distance_rate ?? null,
            vehicle_distance_increment:
              expansion?.vehicle_distance_increment ?? 150,
          }}
        />

        <DiscountsCard
          companyId={companyId}
          initialDiscounts={{
            customer_discount_percent:
              expansion?.customer_discount_percent ?? null,
            partner_discount_percent:
              expansion?.partner_discount_percent ?? null,
          }}
        />

        <RentalFactorsCard
          companyId={companyId}
          initialConfig={{
            rental_factor_config: expansion?.rental_factor_config ?? null,
            fixed_rate_start_day: expansion?.fixed_rate_start_day ?? null,
            fixed_rate_per_day: expansion?.fixed_rate_per_day ?? null,
          }}
        />
      </Flex>
    </Box>
  )
}

// Collapsible Card Component
function CollapsibleCard({
  title,
  summary,
  children,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
}: {
  title: string
  summary: React.ReactNode
  children: React.ReactNode
  defaultExpanded?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}) {
  const [internalExpanded, setInternalExpanded] =
    React.useState(defaultExpanded)
  const isExpanded = expanded !== undefined ? expanded : internalExpanded
  const setIsExpanded = onExpandedChange || setInternalExpanded

  return (
    <Card size="3">
      <Box
        p="4"
        style={{
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Flex justify="between" align="center">
          <Flex align="center" gap="3" style={{ flex: 1 }}>
            {isExpanded ? (
              <NavArrowDown width={18} height={18} />
            ) : (
              <NavArrowRight width={18} height={18} />
            )}
            <Box style={{ flex: 1 }}>
              <Heading size="3" mb="1">
                {title}
              </Heading>
              {!isExpanded && (
                <Text size="2" color="gray">
                  {summary}
                </Text>
              )}
            </Box>
          </Flex>
        </Flex>
      </Box>

      {isExpanded && (
        <Box
          p="4"
          pt="0"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'default' }}
        >
          {children}
        </Box>
      )}
    </Card>
  )
}

// Crew Rates Card
function CrewRatesCard({
  companyId,
  initialRates,
}: {
  companyId: string
  initialRates: {
    crew_rate_per_day: number | null
    crew_rate_per_hour: number | null
  }
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [rates, setRates] = React.useState(initialRates)
  const [isExpanded, setIsExpanded] = React.useState(false)

  React.useEffect(() => {
    setRates(initialRates)
  }, [initialRates])

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'Not set'
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const summary = (
    <Flex gap="4" align="center" wrap="wrap">
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Day:
        </Text>
        <Text size="3" weight="bold">
          {formatCurrency(rates.crew_rate_per_day)}
        </Text>
      </Flex>
      <Text size="1" color="gray">
        •
      </Text>
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Hour:
        </Text>
        <Text size="3" weight="bold">
          {formatCurrency(rates.crew_rate_per_hour)}
        </Text>
      </Flex>
    </Flex>
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: current } = await supabase
        .from('company_expansions')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()

      const { error } = await supabase.from('company_expansions').upsert(
        {
          company_id: companyId,
          crew_rate_per_day: rates.crew_rate_per_day,
          crew_rate_per_hour: rates.crew_rate_per_hour,
          accounting_software: current?.accounting_software ?? 'none',
          accounting_api_key_encrypted:
            current?.accounting_api_key_encrypted ?? null,
          accounting_organization_id:
            (current as any)?.accounting_organization_id ?? null,
          accounting_api_read_only: current?.accounting_api_read_only ?? true,
          latest_feed_open_to_freelancers:
            current?.latest_feed_open_to_freelancers ?? false,
        },
        { onConflict: 'company_id' },
      )

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'expansion'],
      })
      success('Crew rates updated', 'Crew rates have been saved.')
      setIsExpanded(false) // Collapse after save
    },
    onError: (error: any) => {
      toastError(
        'Failed to update crew rates',
        error?.message ?? 'Please try again.',
      )
    },
  })

  return (
    <CollapsibleCard
      title="Crew Rates"
      summary={summary}
      expanded={isExpanded}
      onExpandedChange={setIsExpanded}
    >
      <Flex direction="column" gap="4">
        <Flex gap="4" align="start">
          <Box style={{ flex: 1, maxWidth: 200 }}>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Rate (per day)
            </Text>
            <TextField.Root
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 5000"
              value={
                rates.crew_rate_per_day !== null
                  ? String(rates.crew_rate_per_day)
                  : ''
              }
              onChange={(e) =>
                setRates({
                  ...rates,
                  crew_rate_per_day:
                    e.target.value === '' ? null : Number(e.target.value) || 0,
                })
              }
            />
          </Box>
          <Box style={{ flex: 1, maxWidth: 200 }}>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Rate (per hour)
            </Text>
            <TextField.Root
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 650"
              value={
                rates.crew_rate_per_hour !== null
                  ? String(rates.crew_rate_per_hour)
                  : ''
              }
              onChange={(e) =>
                setRates({
                  ...rates,
                  crew_rate_per_hour:
                    e.target.value === '' ? null : Number(e.target.value) || 0,
                })
              }
            />
          </Box>
        </Flex>
        <Text size="1" color="gray">
          Default rates for crew members in technical offers
        </Text>
        <Flex justify="end">
          <Button
            variant="classic"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Crew Rates'}
          </Button>
        </Flex>
      </Flex>
    </CollapsibleCard>
  )
}

// Vehicle Rates Card
function VehicleRatesCard({
  companyId,
  initialRates,
}: {
  companyId: string
  initialRates: {
    vehicle_daily_rate: number | null
    vehicle_distance_rate: number | null
    vehicle_distance_increment: number
  }
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [rates, setRates] = React.useState(initialRates)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [distanceIncrementDraft, setDistanceIncrementDraft] = React.useState<
    string | null
  >(null)

  React.useEffect(() => {
    setRates(initialRates)
    setDistanceIncrementDraft(null)
  }, [initialRates])

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'Not set'
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const summary = (
    <Flex gap="4" align="center" wrap="wrap">
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Daily:
        </Text>
        <Text size="3" weight="bold">
          {formatCurrency(rates.vehicle_daily_rate)}
        </Text>
      </Flex>
      <Text size="1" color="gray">
        •
      </Text>
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Distance:
        </Text>
        <Text size="3" weight="bold">
          {formatCurrency(rates.vehicle_distance_rate)} /{' '}
          {rates.vehicle_distance_increment}km
        </Text>
      </Flex>
    </Flex>
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: current } = await supabase
        .from('company_expansions')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()

      const { error } = await supabase.from('company_expansions').upsert(
        {
          company_id: companyId,
          vehicle_daily_rate: rates.vehicle_daily_rate,
          vehicle_distance_rate: rates.vehicle_distance_rate,
          vehicle_distance_increment: rates.vehicle_distance_increment,
          accounting_software: current?.accounting_software ?? 'none',
          accounting_api_key_encrypted:
            current?.accounting_api_key_encrypted ?? null,
          accounting_organization_id:
            (current as any)?.accounting_organization_id ?? null,
          accounting_api_read_only: current?.accounting_api_read_only ?? true,
          latest_feed_open_to_freelancers:
            current?.latest_feed_open_to_freelancers ?? false,
        },
        { onConflict: 'company_id' },
      )

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'expansion'],
      })
      success('Vehicle rates updated', 'Vehicle rates have been saved.')
      setIsExpanded(false) // Collapse after save
    },
    onError: (error: any) => {
      toastError(
        'Failed to update vehicle rates',
        error?.message ?? 'Please try again.',
      )
    },
  })

  return (
    <CollapsibleCard
      title="Vehicle Rates"
      summary={summary}
      expanded={isExpanded}
      onExpandedChange={setIsExpanded}
    >
      <Flex direction="column" gap="4">
        <Flex gap="4" align="start">
          <Box style={{ flex: 1, maxWidth: 200 }}>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Daily Rate
            </Text>
            <TextField.Root
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 3000"
              value={
                rates.vehicle_daily_rate !== null
                  ? String(rates.vehicle_daily_rate)
                  : ''
              }
              onChange={(e) =>
                setRates({
                  ...rates,
                  vehicle_daily_rate:
                    e.target.value === '' ? null : Number(e.target.value) || 0,
                })
              }
            />
          </Box>
          <Box style={{ flex: 1, maxWidth: 200 }}>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Distance Rate (per increment)
            </Text>
            <TextField.Root
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g., 500"
              value={
                rates.vehicle_distance_rate !== null
                  ? String(rates.vehicle_distance_rate)
                  : ''
              }
              onChange={(e) =>
                setRates({
                  ...rates,
                  vehicle_distance_rate:
                    e.target.value === '' ? null : Number(e.target.value) || 0,
                })
              }
            />
          </Box>
          <Box style={{ flex: 1, maxWidth: 200 }}>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Distance Increment (km)
            </Text>
            <TextField.Root
              type="number"
              min="1"
              step="1"
              placeholder="e.g., 150"
              value={
                distanceIncrementDraft ??
                String(rates.vehicle_distance_increment)
              }
              onChange={(e) => {
                const nextValue = e.target.value
                setDistanceIncrementDraft(nextValue)

                if (nextValue === '') return
                const parsed = Number(nextValue)
                if (Number.isNaN(parsed)) return

                setRates({
                  ...rates,
                  vehicle_distance_increment: Math.max(1, parsed),
                })
                setDistanceIncrementDraft(null)
              }}
              onBlur={() => {
                if (distanceIncrementDraft === '') {
                  setDistanceIncrementDraft(null)
                }
              }}
            />
          </Box>
        </Flex>
        <Text size="1" color="gray">
          Fixed daily rate for vehicles, plus distance-based rate calculated per
          increment. Distance is rounded up to the nearest increment.
        </Text>
        <Flex justify="end">
          <Button
            variant="classic"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Vehicle Rates'}
          </Button>
        </Flex>
      </Flex>
    </CollapsibleCard>
  )
}

// Discounts Card
function DiscountsCard({
  companyId,
  initialDiscounts,
}: {
  companyId: string
  initialDiscounts: {
    customer_discount_percent: number | null
    partner_discount_percent: number | null
  }
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [discounts, setDiscounts] = React.useState(initialDiscounts)
  const [isExpanded, setIsExpanded] = React.useState(false)

  React.useEffect(() => {
    setDiscounts(initialDiscounts)
  }, [initialDiscounts])

  const formatPercent = (value: number | null) => {
    if (value === null) return 'Not set'
    return `${value}%`
  }

  const summary = (
    <Flex gap="4" align="center" wrap="wrap">
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Customer:
        </Text>
        <Text size="3" weight="bold">
          {formatPercent(discounts.customer_discount_percent)}
        </Text>
      </Flex>
      <Text size="1" color="gray">
        •
      </Text>
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Partner:
        </Text>
        <Text size="3" weight="bold">
          {formatPercent(discounts.partner_discount_percent)}
        </Text>
      </Flex>
    </Flex>
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: current } = await supabase
        .from('company_expansions')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()

      const { error } = await supabase.from('company_expansions').upsert(
        {
          company_id: companyId,
          customer_discount_percent: discounts.customer_discount_percent,
          partner_discount_percent: discounts.partner_discount_percent,
          accounting_software: current?.accounting_software ?? 'none',
          accounting_api_key_encrypted:
            current?.accounting_api_key_encrypted ?? null,
          accounting_organization_id:
            (current as any)?.accounting_organization_id ?? null,
          accounting_api_read_only: current?.accounting_api_read_only ?? true,
          latest_feed_open_to_freelancers:
            current?.latest_feed_open_to_freelancers ?? false,
        },
        { onConflict: 'company_id' },
      )

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'expansion'],
      })
      success('Discounts updated', 'Discounts have been saved.')
      setIsExpanded(false) // Collapse after save
    },
    onError: (error: any) => {
      toastError(
        'Failed to update discounts',
        error?.message ?? 'Please try again.',
      )
    },
  })

  return (
    <CollapsibleCard
      title="Standard Discounts"
      summary={summary}
      expanded={isExpanded}
      onExpandedChange={setIsExpanded}
    >
      <Flex direction="column" gap="4">
        <Flex gap="4" align="start">
          <Box style={{ flex: 1, maxWidth: 200 }}>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Customer Discount (%)
            </Text>
            <TextField.Root
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g., 5"
              value={
                discounts.customer_discount_percent !== null
                  ? String(discounts.customer_discount_percent)
                  : ''
              }
              onChange={(e) =>
                setDiscounts({
                  ...discounts,
                  customer_discount_percent:
                    e.target.value === ''
                      ? null
                      : Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                })
              }
            />
          </Box>
          <Box style={{ flex: 1, maxWidth: 200 }}>
            <Text
              as="label"
              size="2"
              color="gray"
              style={{ display: 'block', marginBottom: 6 }}
            >
              Partner Discount (%)
            </Text>
            <TextField.Root
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g., 10"
              value={
                discounts.partner_discount_percent !== null
                  ? String(discounts.partner_discount_percent)
                  : ''
              }
              onChange={(e) =>
                setDiscounts({
                  ...discounts,
                  partner_discount_percent:
                    e.target.value === ''
                      ? null
                      : Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                })
              }
            />
          </Box>
        </Flex>
        <Text size="1" color="gray">
          Default discount percentages for customers and partners
        </Text>
        <Flex justify="end">
          <Button
            variant="classic"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Discounts'}
          </Button>
        </Flex>
      </Flex>
    </CollapsibleCard>
  )
}

// Rental Factors Card
function RentalFactorsCard({
  companyId,
  initialConfig,
}: {
  companyId: string
  initialConfig: {
    rental_factor_config: RentalFactorConfig | null
    fixed_rate_start_day: number | null
    fixed_rate_per_day: number | null
  }
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [config, setConfig] = React.useState(initialConfig)
  const [isExpanded, setIsExpanded] = React.useState(false)

  React.useEffect(() => {
    setConfig(initialConfig)
  }, [initialConfig])

  const summary = config.fixed_rate_start_day ? (
    <Flex gap="4" align="center" wrap="wrap">
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Starts at day:
        </Text>
        <Text size="3" weight="bold">
          {config.fixed_rate_start_day}
        </Text>
      </Flex>
      <Text size="1" color="gray">
        •
      </Text>
      <Flex align="center" gap="2">
        <Text size="1" color="gray">
          Multiplier:
        </Text>
        <Text size="3" weight="bold">
          {config.fixed_rate_per_day !== null
            ? `0.${String(config.fixed_rate_per_day).replace('0.', '')}`
            : 'not set'}
        </Text>
      </Flex>
    </Flex>
  ) : (
    <Text size="2" color="gray" style={{ fontStyle: 'italic' }}>
      No fixed rate configured
    </Text>
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: current } = await supabase
        .from('company_expansions')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle()

      const { error } = await supabase.from('company_expansions').upsert(
        {
          company_id: companyId,
          rental_factor_config: config.rental_factor_config
            ? JSON.stringify(config.rental_factor_config)
            : null,
          fixed_rate_start_day: config.fixed_rate_start_day,
          fixed_rate_per_day: config.fixed_rate_per_day,
          accounting_software: current?.accounting_software ?? 'none',
          accounting_api_key_encrypted:
            current?.accounting_api_key_encrypted ?? null,
          accounting_organization_id:
            (current as any)?.accounting_organization_id ?? null,
          accounting_api_read_only: current?.accounting_api_read_only ?? true,
          latest_feed_open_to_freelancers:
            current?.latest_feed_open_to_freelancers ?? false,
        },
        { onConflict: 'company_id' },
      )

      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'expansion'],
      })
      success('Rental factors updated', 'Rental factors have been saved.')
      setIsExpanded(false) // Collapse after save
    },
    onError: (error: any) => {
      toastError(
        'Failed to update rental factors',
        error?.message ?? 'Please try again.',
      )
    },
  })

  return (
    <CollapsibleCard
      title="Rental Factors"
      summary={summary}
      expanded={isExpanded}
      onExpandedChange={setIsExpanded}
    >
      <Flex direction="column" gap="4">
        <Text size="2" color="gray">
          Configure rental factors based on days of use. These multipliers
          adjust pricing based on rental duration. If not set, default factors
          will be used.
        </Text>

        {/* Fixed Rate Configuration */}
        <Box p="3" style={{ background: 'var(--gray-a2)', borderRadius: 8 }}>
          <Flex direction="column" gap="3">
            <Heading size="2">Fixed Rate Configuration</Heading>
            <Flex gap="4" align="start">
              <Box style={{ flex: 1, maxWidth: 200 }}>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Start fixed rates at day
                </Text>
                <TextField.Root
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g., 30"
                  value={
                    config.fixed_rate_start_day !== null
                      ? String(config.fixed_rate_start_day)
                      : ''
                  }
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      fixed_rate_start_day:
                        e.target.value === ''
                          ? null
                          : Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
                <Text size="1" color="gray" mt="1">
                  Rental factors table will show days up to this value
                </Text>
              </Box>
              <Box style={{ flex: 1, maxWidth: 200 }}>
                <Text
                  as="label"
                  size="2"
                  color="gray"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  {config.fixed_rate_start_day
                    ? `Fixed rate multiplier (after day ${config.fixed_rate_start_day})`
                    : 'Fixed rate multiplier'}
                </Text>
                <Flex align="center" gap="1">
                  <Text size="3" style={{ userSelect: 'none' }}>
                    0.
                  </Text>
                  <TextField.Root
                    type="text"
                    placeholder="3"
                    inputMode="numeric"
                    maxLength={1}
                    value={
                      config.fixed_rate_per_day !== null
                        ? String(config.fixed_rate_per_day).replace('0.', '')
                        : ''
                    }
                    onChange={(e) => {
                      // Only allow digits 0-9
                      const value = e.target.value.replace(/[^0-9]/g, '')
                      if (value === '') {
                        setConfig({
                          ...config,
                          fixed_rate_per_day: null,
                        })
                        return
                      }
                      // Take only first digit and convert to decimal
                      const digit = Math.min(
                        9,
                        Math.max(0, parseInt(value.slice(0, 1), 10)),
                      )
                      const decimalValue = digit / 10
                      setConfig({
                        ...config,
                        fixed_rate_per_day: decimalValue,
                      })
                    }}
                    style={{ width: 60 }}
                  />
                </Flex>
                <Text size="1" color="gray" mt="1">
                  Enter a digit 0-9 (e.g., 3 = 0.3 = 30% of daily rate)
                </Text>
              </Box>
            </Flex>
            <Text size="1" color="gray">
              After the specified day, rental factors will be replaced with this
              fixed multiplier
            </Text>
          </Flex>
        </Box>

        <RentalFactorsEditor
          config={config.rental_factor_config}
          onChange={(rentalConfig) =>
            setConfig({ ...config, rental_factor_config: rentalConfig })
          }
          maxDays={config.fixed_rate_start_day}
        />

        <Flex justify="end">
          <Button
            variant="classic"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Rental Factors'}
          </Button>
        </Flex>
      </Flex>
    </CollapsibleCard>
  )
}

// Default rental factors (stiffer values)
const DEFAULT_RENTAL_FACTORS: RentalFactorConfig = {
  1: 1.0,
  2: 1.6,
  3: 2.0,
  4: 2.3,
  5: 2.5,
  7: 2.8,
  10: 3.2,
  14: 3.5,
  21: 4.0,
  30: 4.5,
}

function RentalFactorsEditor({
  config,
  onChange,
  maxDays,
}: {
  config: RentalFactorConfig | null
  onChange: (config: RentalFactorConfig | null) => void
  maxDays?: number | null
}) {
  const [localConfig, setLocalConfig] = React.useState<RentalFactorConfig>(
    config || DEFAULT_RENTAL_FACTORS,
  )
  const [isTableExpanded, setIsTableExpanded] = React.useState(false)

  // Update local config when prop changes
  React.useEffect(() => {
    if (config) {
      setLocalConfig(config)
    } else {
      setLocalConfig(DEFAULT_RENTAL_FACTORS)
    }
  }, [config])

  const updateFactor = (days: number, factor: number | null) => {
    const newConfig = { ...localConfig }
    if (factor === null || factor <= 0) {
      delete newConfig[days]
    } else {
      newConfig[days] = factor
    }
    setLocalConfig(newConfig)
    onChange(Object.keys(newConfig).length > 0 ? newConfig : null)
  }

  const resetToDefaults = () => {
    setLocalConfig(DEFAULT_RENTAL_FACTORS)
    onChange(DEFAULT_RENTAL_FACTORS)
  }

  const resolvedMaxDays = React.useMemo(() => {
    if (maxDays && maxDays > 0) return maxDays
    const configDays = Object.keys(localConfig).map((day) => Number(day))
    const maxFromConfig = configDays.length
      ? Math.max(...configDays)
      : Math.max(
          ...Object.keys(DEFAULT_RENTAL_FACTORS).map((day) => Number(day)),
        )
    return Math.max(1, maxFromConfig)
  }, [localConfig, maxDays])

  const daysToShow = React.useMemo(
    () => Array.from({ length: resolvedMaxDays }, (_, index) => index + 1),
    [resolvedMaxDays],
  )

  return (
    <Flex direction="column" gap="4">
      <Box
        p="3"
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          background: 'var(--gray-a2)',
          borderRadius: 8,
        }}
        onClick={() => setIsTableExpanded(!isTableExpanded)}
      >
        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            {isTableExpanded ? (
              <NavArrowDown width={18} height={18} />
            ) : (
              <NavArrowRight width={18} height={18} />
            )}
            <Text size="2" weight="medium">
              Rental Factors Table
            </Text>
          </Flex>
        </Flex>
      </Box>

      {isTableExpanded && (
        <Box onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
          <Table.Root variant="surface" size="2">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Days</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Factor</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {daysToShow.map((days) => (
                <Table.Row key={days}>
                  <Table.Cell>
                    <Text weight="medium">
                      {days} {days === 1 ? 'day' : 'days'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <TextField.Root
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Auto"
                      value={
                        days in localConfig ? String(localConfig[days]) : ''
                      }
                      onChange={(e) =>
                        updateFactor(
                          days,
                          e.target.value === '' ? null : Number(e.target.value),
                        )
                      }
                      style={{ width: 120 }}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>

          <Flex gap="2" align="center" mt="3">
            <Button
              size="2"
              variant="soft"
              onClick={resetToDefaults}
              disabled={
                JSON.stringify(localConfig) ===
                JSON.stringify(DEFAULT_RENTAL_FACTORS)
              }
            >
              Reset to Defaults
            </Button>
            <Text size="1" color="gray">
              Leave blank to use default factors for that day
            </Text>
          </Flex>
        </Box>
      )}
    </Flex>
  )
}
