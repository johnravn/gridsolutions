import * as React from 'react'
import {
  Box,
  Flex,
  Heading,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { AnimatedQuickSuggestions } from '@shared/ui/components/AnimatedQuickSuggestions'
import {
  calculateModuleCostFromSplits,
  calculateModuleMarkupFromSplits,
  calculateSplitAmountBeforeMarkup,
} from '../../../utils/prettyOfferCalculations'
import { ContentBlocksSection } from './ContentBlocksSection'
import {
  ModuleHeroMediaEditor,
  ModuleStoryFields,
} from './ModuleHeroMediaEditor'
import type { PrettyOfferPricingOptions } from '../../../utils/prettyOfferCalculations'
import type { LocalPrettyModule, LocalPricingBasis } from './types'

type Props = {
  module: LocalPrettyModule
  jobId: string
  companyId: string
  offerId: string
  pricingBases: Array<LocalPricingBasis>
  splitCalculationOptions: PrettyOfferPricingOptions
  titleSuggestions?: Array<string>
  readOnly: boolean
  fieldErrors?: Record<string, string>
  onChange: (module: LocalPrettyModule) => void
}

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

export function ModuleEditor({
  module,
  jobId: _jobId,
  companyId,
  offerId,
  pricingBases,
  splitCalculationOptions,
  titleSuggestions = [],
  readOnly,
  fieldErrors = {},
  onChange,
}: Props) {
  const [titleFieldHovered, setTitleFieldHovered] = React.useState(false)

  const update = (patch: Partial<LocalPrettyModule>) => {
    onChange({ ...module, ...patch })
  }

  const connectedSplits = React.useMemo(
    () =>
      pricingBases.flatMap((basis) =>
        (basis.splits ?? [])
          .filter((split) => split.module_id === module.id)
          .map((split) => ({
            id: split.id,
            basisTitle: basis.title || basis.basis_type,
            splitTitle: split.title,
            amount: calculateSplitAmountBeforeMarkup(
              split,
              basis,
              splitCalculationOptions,
            ),
          })),
      ),
    [module.id, pricingBases, splitCalculationOptions],
  )

  const moduleMarkupAmount = React.useMemo(
    () =>
      calculateModuleMarkupFromSplits(
        module.id,
        pricingBases,
        splitCalculationOptions,
      ),
    [module.id, pricingBases, splitCalculationOptions],
  )

  const moduleTotal = React.useMemo(
    () =>
      calculateModuleCostFromSplits(
        module.id,
        pricingBases,
        splitCalculationOptions,
      ),
    [module.id, pricingBases, splitCalculationOptions],
  )

  const markupPercent = splitCalculationOptions.subcontractorMarkupPercent ?? 0

  return (
    <Box>
      <Flex direction="column" gap="3">
        <Heading size="4" mb="1">
          Module story
        </Heading>

        <Box
          onMouseEnter={() => setTitleFieldHovered(true)}
          onMouseLeave={() => setTitleFieldHovered(false)}
        >
          <Text size="2" weight="medium" mb="1" as="div">
            Title <Text color="red">*</Text>
          </Text>
          {fieldErrors.title && (
            <Text size="1" color="red" mb="1" as="div">
              {fieldErrors.title}
            </Text>
          )}
          <TextField.Root
            value={module.title}
            disabled={readOnly}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Audio"
          />
          {!readOnly && titleSuggestions.length > 0 && (
            <AnimatedQuickSuggestions
              suggestions={titleSuggestions}
              open={titleFieldHovered}
              staticOpen={!module.title.trim()}
              showLabel
              label="Title suggestions:"
              onSelect={(suggestion) => update({ title: suggestion })}
              onAfterSelect={() => setTitleFieldHovered(false)}
            />
          )}
        </Box>

        <ModuleStoryFields
          module={module}
          readOnly={readOnly}
          fieldErrors={fieldErrors}
          onChange={update}
        />

        <ModuleHeroMediaEditor
          module={module}
          companyId={companyId}
          offerId={offerId}
          readOnly={readOnly}
          fieldErrors={fieldErrors}
          onChange={update}
        />

        <ContentBlocksSection
          moduleId={module.id}
          jobId={_jobId}
          companyId={companyId}
          offerId={offerId}
          blocks={module.content_blocks}
          readOnly={readOnly}
          onChange={(content_blocks) => update({ content_blocks })}
        />

        <Separator size="4" />

        <Box>
          <Heading size="4" mb="1">
            Module cost
          </Heading>
          <Text size="1" color="gray" mb="3" as="div">
            Internal breakdown from connected pricing splits. Whether the
            customer sees module prices is controlled by the offer setting
            above.
          </Text>

          {connectedSplits.length === 0 ? (
            <Text size="2" color="gray">
              No pricing splits connected. Assign splits on the Pricing basis
              tab.
            </Text>
          ) : (
            <Flex direction="column" gap="1" mb="3">
              {connectedSplits.map((split) => (
                <Flex key={split.id} justify="between" gap="3">
                  <Text size="2" color="gray">
                    {split.basisTitle} — {split.splitTitle}
                  </Text>
                  <Text size="2">{formatMoney(split.amount)}</Text>
                </Flex>
              ))}
              {moduleMarkupAmount > 0 && (
                <Flex justify="between" gap="3">
                  <Text size="2" color="gray">
                    Subcontractor markup
                    {markupPercent > 0 ? ` (${markupPercent}%)` : ''}
                  </Text>
                  <Text size="2">{formatMoney(moduleMarkupAmount)}</Text>
                </Flex>
              )}
            </Flex>
          )}

          <Box
            p="3"
            style={{
              borderRadius: 8,
              background: 'var(--gray-a2)',
              border: '1px solid var(--gray-a4)',
            }}
          >
            <Flex justify="between" align="center" gap="2">
              <Text size="2" weight="medium">
                Module total
              </Text>
              <Text size="3" weight="bold">
                {formatMoney(moduleTotal)}
              </Text>
            </Flex>
          </Box>
        </Box>
      </Flex>
    </Box>
  )
}
