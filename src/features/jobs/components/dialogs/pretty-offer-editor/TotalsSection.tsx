import { Box, Flex, Separator, Text } from '@radix-ui/themes'
import {
  applyComputedCostsToModules,
  basisSubtotal,
  calculatePrettyOfferTotals,
  calculateSplitAmount,
} from '../../../utils/prettyOfferCalculations'
import type { LocalPrettyModule, LocalPricingBasis } from './types'
import type { JobSubcontractorQuote, OfferDetail } from '../../../types'
import type { RentalFactorConfig } from '../../../utils/offerCalculations'

type Props = {
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
  technicalOffersById: Map<string, OfferDetail>
  jobQuotesById: Map<string, JobSubcontractorQuote>
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
  pricingBases,
  technicalOffersById,
  jobQuotesById,
  vatPercent,
  rentalFactorConfig,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
  vehicleDailyRate,
}: Props) {
  const technicalContext = {
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
  }

  const modulesWithCost = applyComputedCostsToModules(modules, pricingBases, {
    technicalOffersById,
    jobQuotesById,
    technicalContext,
  })

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

      {pricingBases.length > 0 && (
        <Box mb="4">
          <Text size="2" weight="medium" mb="2" as="div">
            By pricing basis
          </Text>
          <Flex direction="column" gap="3">
            {pricingBases.map((basis) => (
              <Box key={basis.id}>
                <Flex justify="between" mb="1">
                  <Text size="2" weight="medium">
                    {basis.title || basis.basis_type}
                  </Text>
                  <Text size="2">
                    {formatMoney(
                      basisSubtotal(basis, {
                        technicalOffersById,
                        jobQuotesById,
                        technicalContext,
                      }),
                    )}
                  </Text>
                </Flex>
                {(basis.splits ?? []).map((split) => {
                  const module = modulesWithCost.find(
                    (m) => m.id === split.module_id,
                  )
                  return (
                    <Flex
                      key={split.id}
                      justify="between"
                      pl="3"
                      style={{ opacity: 0.9 }}
                    >
                      <Text size="1" color="gray">
                        {split.title} → {module?.title || 'Module'}
                      </Text>
                      <Text size="1">
                        {formatMoney(
                          calculateSplitAmount(split, basis, {
                            technicalOffersById,
                            jobQuotesById,
                            technicalContext,
                          }),
                        )}
                      </Text>
                    </Flex>
                  )
                })}
              </Box>
            ))}
          </Flex>
          <Separator size="4" my="3" />
        </Box>
      )}

      <Text size="2" weight="medium" mb="2" as="div">
        By module
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
            No modules yet.
          </Text>
        )}
      </Flex>

      <Separator size="4" mb="3" />

      <Flex direction="column" gap="2">
        <Flex justify="between">
          <Text size="2">Subtotal (internal cost)</Text>
          <Text size="2" weight="medium">
            {formatMoney(totals.totalBeforeDiscount)}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text size="2">VAT ({vatPercent}%)</Text>
          <Text size="2">
            {formatMoney(totals.totalWithVat - totals.totalAfterDiscount)}
          </Text>
        </Flex>
        <Flex justify="between">
          <Text size="2" weight="bold">
            Total with VAT
          </Text>
          <Text size="2" weight="bold">
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
