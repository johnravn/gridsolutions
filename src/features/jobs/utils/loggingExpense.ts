import { roundMoney } from './offerCalculations'
import { computeCrewBookingRateAmount } from './moneySuggestions'
import type { CompanyGeneralRates } from './moneySuggestions'

/** Stable money-item source_id for a logging (time) entry. */
export function loggingExpenseSourceId(entryId: string): string {
  return `logging-${entryId}`
}

export type LoggingExpenseUserRate = {
  role: string | null
  rate: number | null
  rate_type: string | null
}

/**
 * Amount for a logging→expense add.
 *
 * Always uses **hourly** billing (logging is hour-based): same rate pick as
 * crew expense suggestions — freelancer personal rate (default hourly), else
 * company employee/owner rates via `computeCrewBookingRateAmount`.
 */
export function computeLoggingExpenseAmount(input: {
  startAt: string
  endAt: string
  userRate: LoggingExpenseUserRate | null | undefined
  companyRates: CompanyGeneralRates | null | undefined
}): number | null {
  const amount = computeCrewBookingRateAmount({
    role: input.userRate?.role,
    rate: input.userRate?.rate,
    rate_type: input.userRate?.rate_type,
    start_at: input.startAt,
    end_at: input.endAt,
    billingUnit: 'hour',
    companyRates: input.companyRates,
  })
  if (amount == null || amount <= 0) return null
  return roundMoney(amount)
}

export function loggingExpenseDescription(input: {
  userName: string
  title: string | null | undefined
  hoursLabel: string
}): string {
  const title = input.title?.trim()
  if (title) return `${input.userName}: ${title} (${input.hoursLabel})`
  return `${input.userName}: logging ${input.hoursLabel}`
}
