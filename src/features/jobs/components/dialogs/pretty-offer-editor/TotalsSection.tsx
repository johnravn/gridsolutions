import { Box, Flex, Separator, Text } from '@radix-ui/themes'
import {
  applyComputedCostsToModules,
  basisMarkupAmount,
  basisSubtotal,
  calculatePrettyOfferTotals,
  calculateSplitAmount,
  calculateSplitAmountBeforeMarkup,
} from '../../../utils/prettyOfferCalculations'
import {
  calculateOptionsSubtotal,
  collectOfferOptions,
  resolveDefaultSelectedOptionIds,
} from '../../../utils/prettyOfferOptions'
import type { LocalPrettyModule, LocalPricingBasis } from './types'
import type {
  JobSubcontractorQuote,
  OfferBasisDetail,
  OfferDetail,
} from '../../../types'
import type { RentalFactorConfig } from '../../../utils/offerCalculations'

type Props = {
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
  technicalOffersById: Map<string, OfferDetail>
  offerBasesById: Map<string, OfferBasisDetail>
  jobQuotesById: Map<string, JobSubcontractorQuote>
  vatPercent: number
  daysOfUse: number
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
  subcontractorMarkupPercent?: number
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
  offerBasesById,
  jobQuotesById,
  vatPercent,
  daysOfUse,
  rentalFactorConfig,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
  vehicleDailyRate,
  subcontractorMarkupPercent = 0,
}: Props) {
  const technicalContext = {
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
    daysOfUse,
  }

  const pricingOptions = {
    technicalOffersById,
    offerBasesById,
    jobQuotesById,
    technicalContext,
    subcontractorMarkupPercent,
  }

  const modulesWithCost = applyComputedCostsToModules(
    modules,
    pricingBases,
    pricingOptions,
  )

  const totals = calculatePrettyOfferTotals(modulesWithCost, vatPercent)
  const offerOptions = collectOfferOptions(modulesWithCost)
  const defaultSelectedOptionIds = resolveDefaultSelectedOptionIds(offerOptions)
  const previewOptionsSubtotal = calculateOptionsSubtotal(
    defaultSelectedOptionIds,
    offerOptions,
  )
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
            {pricingBases.map((basis) => {
              const markupAmount = basisMarkupAmount(basis, pricingOptions)
              const splitAmount = (split: (typeof basis.splits)[number]) =>
                markupAmount > 0
                  ? calculateSplitAmountBeforeMarkup(
                      split,
                      basis,
                      pricingOptions,
                    )
                  : calculateSplitAmount(split, basis, pricingOptions)
              return (
                <Box key={basis.id}>
                  <Flex justify="between" mb="1">
                    <Text size="2" weight="medium">
                      {basis.title || basis.basis_type}
                    </Text>
                    <Text size="2">
                      {formatMoney(basisSubtotal(basis, pricingOptions))}
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
                        <Text size="1">{formatMoney(splitAmount(split))}</Text>
                      </Flex>
                    )
                  })}
                  {markupAmount > 0 && (
                    <Flex justify="between" pl="3" style={{ opacity: 0.9 }}>
                      <Text size="1" color="gray">
                        Subcontractor markup ({subcontractorMarkupPercent}%)
                      </Text>
                      <Text size="1">{formatMoney(markupAmount)}</Text>
                    </Flex>
                  )}
                </Box>
              )
            })}
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

      {offerOptions.length > 0 && (
        <Box mb="4">
          <Separator size="4" my="3" />
          <Text size="2" weight="medium" mb="1" as="div">
            Optional add-ons
          </Text>
          <Text size="1" color="gray" mb="2" as="div">
            Base total excludes options. The customer total depends on their
            selections.
          </Text>
          <Flex direction="column" gap="2">
            {offerOptions.map((option) => (
              <Flex key={option.optionId} justify="between" align="center">
                <Box>
                  <Text size="2">{option.label || 'Untitled option'}</Text>
                  {option.groupTitle && (
                    <Text size="1" color="gray" as="div">
                      {option.groupTitle}
                      {option.selectionMode === 'single'
                        ? ' · choose one'
                        : ' · checkbox'}
                    </Text>
                  )}
                </Box>
                <Text size="2">{formatMoney(option.price)}</Text>
              </Flex>
            ))}
          </Flex>
          {previewOptionsSubtotal > 0 && (
            <Flex justify="between" mt="2">
              <Text size="2" color="gray">
                Default selections add
              </Text>
              <Text size="2" color="gray">
                {formatMoney(previewOptionsSubtotal)}
              </Text>
            </Flex>
          )}
        </Box>
      )}

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
