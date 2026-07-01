import { Box, Flex, Separator, Text } from '@radix-ui/themes'
import {
  calculateModuleCost,
  calculatePrettyOfferTotals,
} from '../../../utils/prettyOfferCalculations'
import type { LocalPrettyModule, LocalSubcontractorQuote } from './types'
import type { OfferDetail } from '../../../types'
import type { RentalFactorConfig } from '../../../utils/offerCalculations'

type Props = {
  modules: Array<LocalPrettyModule>
  quotes: Array<LocalSubcontractorQuote>
  technicalOffer: OfferDetail | null
  vatPercent: number
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
}

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

export function TotalsSection({
  modules,
  quotes,
  technicalOffer,
  vatPercent,
  rentalFactorConfig,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
  vehicleDailyRate,
}: Props) {
  const modulesWithCost = modules.map((module) => ({
    ...module,
    computed_cost: calculateModuleCost(module, quotes, technicalOffer, {
      rentalFactorConfig,
      vehicleDistanceRate,
      vehicleDistanceIncrement,
      vehicleDailyRate,
    }),
  }))

  const totals = calculatePrettyOfferTotals(modulesWithCost, vatPercent)
  const customerDisplayTotal = modulesWithCost.reduce((sum, module) => {
    if (module.show_price && module.display_price != null) {
      return sum + module.display_price
    }
    return sum
  }, 0)

  return (
    <Box>
      <Text size="2" weight="bold" mb="3" as="div">
        Cost summary
      </Text>

      <Flex direction="column" gap="2" mb="4">
        {modulesWithCost.map((module) => (
          <Flex key={module.id} justify="between" align="center">
            <Box>
              <Text size="2" weight="medium">
                {module.title || 'Untitled module'}
              </Text>
              {module.show_price && module.display_price != null && (
                <Text size="1" color="gray" as="div">
                  Customer price: {formatMoney(module.display_price)}
                </Text>
              )}
            </Box>
            <Text size="2">{formatMoney(module.computed_cost)}</Text>
          </Flex>
        ))}
        {modulesWithCost.length === 0 && (
          <Text size="2" color="gray">
            Add modules to see cost breakdown.
          </Text>
        )}
      </Flex>

      <Separator size="4" mb="3" />

      <Flex direction="column" gap="2">
        <Flex justify="between">
          <Text size="2">Internal subtotal</Text>
          <Text size="2" weight="medium">
            {formatMoney(totals.totalBeforeDiscount)}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text size="2">VAT ({vatPercent}%)</Text>
          <Text size="2" weight="medium">
            {formatMoney(totals.totalWithVat - totals.totalAfterDiscount)}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text size="3" weight="bold">
            Total incl. VAT
          </Text>
          <Text size="3" weight="bold">
            {formatMoney(totals.totalWithVat)}
          </Text>
        </Flex>
        {customerDisplayTotal > 0 && (
          <Flex justify="between">
            <Text size="2" color="gray">
              Sum of customer module prices
            </Text>
            <Text size="2" color="gray">
              {formatMoney(customerDisplayTotal)}
            </Text>
          </Flex>
        )}
      </Flex>
    </Box>
  )
}
