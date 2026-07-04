import {
  Box,
  Checkbox,
  Flex,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes'
import { calculateSplitAmount } from '../../../utils/prettyOfferCalculations'
import { ContentBlocksSection } from './ContentBlocksSection'
import type { LocalPrettyModule, LocalPricingBasis } from './types'

type Props = {
  module: LocalPrettyModule
  jobId: string
  companyId: string
  offerId: string
  pricingBases: Array<LocalPricingBasis>
  readOnly: boolean
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
  jobId,
  companyId,
  offerId,
  pricingBases,
  readOnly,
  onChange,
}: Props) {
  const update = (patch: Partial<LocalPrettyModule>) => {
    onChange({ ...module, ...patch })
  }

  const connectedSplits = pricingBases.flatMap((basis) =>
    (basis.splits ?? [])
      .filter((split) => split.module_id === module.id)
      .map((split) => ({
        basisTitle: basis.title || basis.basis_type,
        splitTitle: split.title,
        amount: calculateSplitAmount(split, basis),
      })),
  )

  const connectedTotal = connectedSplits.reduce((sum, s) => sum + s.amount, 0)

  return (
    <Box>
      <Flex direction="column" gap="3">
        <Box>
          <Text size="2" weight="medium" mb="1" as="div">
            Title
          </Text>
          <TextField.Root
            value={module.title}
            disabled={readOnly}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Audio"
          />
        </Box>

        <Flex gap="3" align="end" wrap="wrap">
          <Flex align="center" gap="2" style={{ minWidth: 160 }}>
            <Checkbox
              checked={module.show_price}
              disabled={readOnly}
              onCheckedChange={(checked) =>
                update({ show_price: checked === true })
              }
            />
            <Text size="2">Show price to customer</Text>
          </Flex>

          {module.show_price && (
            <Box style={{ flex: 1, minWidth: 140 }}>
              <Text size="2" weight="medium" mb="1" as="div">
                Customer price (footer)
              </Text>
              <TextField.Root
                type="number"
                value={module.display_price ?? ''}
                disabled={readOnly}
                onChange={(e) =>
                  update({
                    display_price: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                placeholder="Optional"
              />
            </Box>
          )}
        </Flex>

        <Box>
          <Text size="2" weight="medium" mb="2" as="div">
            Connected pricing splits
          </Text>
          {connectedSplits.length === 0 ? (
            <Text size="2" color="gray">
              No pricing splits connected. Assign splits on the Pricing basis
              tab.
            </Text>
          ) : (
            <Flex direction="column" gap="1">
              {connectedSplits.map((split, index) => (
                <Flex key={index} justify="between">
                  <Text size="2" color="gray">
                    {split.basisTitle} — {split.splitTitle}
                  </Text>
                  <Text size="2">{formatMoney(split.amount)}</Text>
                </Flex>
              ))}
              <Flex justify="between" mt="1">
                <Text size="2" weight="medium">
                  Internal cost total
                </Text>
                <Text size="2" weight="medium">
                  {formatMoney(connectedTotal)}
                </Text>
              </Flex>
            </Flex>
          )}
        </Box>

        <Separator size="4" />

        <ContentBlocksSection
          moduleId={module.id}
          jobId={jobId}
          companyId={companyId}
          offerId={offerId}
          blocks={module.content_blocks}
          readOnly={readOnly}
          onChange={(content_blocks) => update({ content_blocks })}
        />
      </Flex>
    </Box>
  )
}
