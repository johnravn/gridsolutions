import * as React from 'react'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  IconButton,
  Select,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import {
  ArrowDown,
  Download,
  InfoCircle,
  NavArrowRight,
  Plus,
  Spark,
  Trash,
  WarningTriangle,
} from 'iconoir-react'
import { useQuery } from '@tanstack/react-query'
import {
  getJobSubcontractorQuotePdfUrl,
  jobSubcontractorQuotesQuery,
  jobSubcontractorsQuery,
} from '../../../api/subcontractorQueries'
import {
  basisSubtotal,
  buildLineItemCategoryOptions,
  calculateSplitAmount,
  getBasisAllocationStatus,
  getPricingEligibleModules,
  lineItemSourceFromOfferBasis,
  resolveModuleIdForCategoryKey,
  validatePricingBases,
} from '../../../utils/prettyOfferCalculations'
import { SplitAmountField } from './SplitAmountField'
import {
  BASIS_TYPE_LABELS,
  createEmptyPricingBasis,
  createEmptySplit,
  createTempId,
} from './types'
import {
  DELETE_ICON_SIZE,
  SPLITS_INFO_TOOLTIP,
  getLatestQuoteBySubcontractorId,
  quotesForSubcontractor,
  resolveSubcontractorIdForBasis,
  splitTitleLabel,
  splitTitlePlaceholder,
  subcontractorIdsWithBasis,
} from './pricingBasisHelpers'
import type { LocalPrettyModule, LocalPricingBasis } from './types'
import type { OfferBasis, OfferBasisDetail } from '../../../types'

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

type Props = {
  jobId: string
  daysOfUse: number
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
  offerBases: Array<OfferBasis>
  linkedOfferBasisId: string | null
  offerBasesById: Map<string, OfferBasisDetail>
  subcontractorMarkupPercent: number
  readOnly: boolean
  onPricingBasesChange: (bases: Array<LocalPricingBasis>) => void
}

export function PricingBasisSection({
  jobId,
  daysOfUse,
  modules,
  pricingBases,
  offerBases,
  linkedOfferBasisId,
  offerBasesById,
  subcontractorMarkupPercent,
  readOnly,
  onPricingBasesChange,
}: Props) {
  const [selectedBasisId, setSelectedBasisId] = React.useState<string | null>(
    pricingBases[0]?.id ?? null,
  )
  const [basisPendingDelete, setBasisPendingDelete] =
    React.useState<LocalPricingBasis | null>(null)

  const { data: jobSubcontractors = [] } = useQuery({
    ...jobSubcontractorsQuery({ jobId }),
  })

  const { data: jobQuotes = [] } = useQuery({
    ...jobSubcontractorQuotesQuery({ jobId }),
  })

  const sortedBases = [...pricingBases].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  const pricingModules = React.useMemo(
    () => getPricingEligibleModules(modules),
    [modules],
  )
  const selectedBasis =
    sortedBases.find((b) => b.id === selectedBasisId) ?? sortedBases[0] ?? null

  React.useEffect(() => {
    if (!selectedBasisId && sortedBases[0]) {
      setSelectedBasisId(sortedBases[0].id)
    }
  }, [selectedBasisId, sortedBases])

  React.useEffect(() => {
    if (!linkedOfferBasisId || readOnly) return
    const needsSync = pricingBases.some(
      (basis) =>
        basis.basis_type === 'technical' &&
        basis.source_offer_basis_id !== linkedOfferBasisId,
    )
    if (!needsSync) return
    onPricingBasesChange(
      pricingBases.map((basis) =>
        basis.basis_type === 'technical'
          ? {
              ...basis,
              source_offer_basis_id: linkedOfferBasisId,
              source_technical_offer_id: null,
            }
          : basis,
      ),
    )
  }, [linkedOfferBasisId, readOnly, pricingBases, onPricingBasesChange])

  const linkedOfferBasis = React.useMemo(() => {
    if (!linkedOfferBasisId) return null
    return offerBasesById.get(linkedOfferBasisId) ?? null
  }, [linkedOfferBasisId, offerBasesById])

  const linkedOfferBasisTitle =
    linkedOfferBasis?.title ??
    offerBases.find((basis) => basis.id === linkedOfferBasisId)?.title ??
    'Offer basis'

  const technicalContext = React.useMemo(() => ({ daysOfUse }), [daysOfUse])

  const jobQuotesById = React.useMemo(
    () => new Map(jobQuotes.map((q) => [q.id, q])),
    [jobQuotes],
  )

  const allocationOptions = React.useMemo(
    () => ({
      offerBasesById,
      jobQuotesById,
      technicalContext,
      subcontractorMarkupPercent,
    }),
    [
      offerBasesById,
      jobQuotesById,
      technicalContext,
      subcontractorMarkupPercent,
    ],
  )

  const selectedAllocation = selectedBasis
    ? getBasisAllocationStatus(selectedBasis, allocationOptions)
    : null

  const coveredSubcontractorIds = React.useMemo(
    () => subcontractorIdsWithBasis(sortedBases, jobQuotes, jobSubcontractors),
    [sortedBases, jobQuotes, jobSubcontractors],
  )

  const missingSubcontractorCount = jobSubcontractors.filter(
    (sub) => !coveredSubcontractorIds.has(sub.id),
  ).length

  const selectedSubcontractorId = selectedBasis
    ? resolveSubcontractorIdForBasis(
        selectedBasis,
        jobQuotes,
        jobSubcontractors,
      )
    : null

  const quotesForSelectedBasis = React.useMemo(
    () => quotesForSubcontractor(jobQuotes, selectedSubcontractorId),
    [jobQuotes, selectedSubcontractorId],
  )

  const setBases = (next: Array<LocalPricingBasis>) => {
    onPricingBasesChange(
      next.map((basis, index) => ({ ...basis, sort_order: index })),
    )
  }

  const updateBasis = (basis: LocalPricingBasis) => {
    setBases(sortedBases.map((b) => (b.id === basis.id ? basis : b)))
  }

  const addBasis = (type: LocalPricingBasis['basis_type']) => {
    const basis = createEmptyPricingBasis(sortedBases.length, type)
    if (type === 'technical' && linkedOfferBasisId) {
      const linkedBasis = offerBases.find((b) => b.id === linkedOfferBasisId)
      basis.source_offer_basis_id = linkedOfferBasisId
      if (linkedBasis?.title) {
        basis.title = linkedBasis.title
      }
    }
    const next = [...sortedBases, basis]
    setBases(next)
    setSelectedBasisId(next[next.length - 1].id)
  }

  const addMissingSubcontractorBases = () => {
    const latestBySub = getLatestQuoteBySubcontractorId(jobQuotes)
    const next = [...sortedBases]
    let addedId: string | null = null

    for (const sub of jobSubcontractors) {
      if (coveredSubcontractorIds.has(sub.id)) continue
      const quote = latestBySub.get(sub.id)
      const basis = createEmptyPricingBasis(next.length, 'subcontractor')
      basis.title = sub.customer.name
      basis.source_job_subcontractor_id = sub.id
      if (quote) {
        basis.job_subcontractor_quote_id = quote.id
      }
      next.push(basis)
      addedId ??= basis.id
    }

    if (next.length === sortedBases.length) return
    setBases(next)
    if (addedId) setSelectedBasisId(addedId)
  }

  const removeBasis = (basisId: string) => {
    const next = sortedBases.filter((b) => b.id !== basisId)
    setBases(next)
    if (selectedBasisId === basisId) {
      setSelectedBasisId(next[0]?.id ?? null)
    }
  }

  const addSplit = (basis: LocalPricingBasis) => {
    const defaultModuleId = pricingModules[0]?.id ?? ''
    if (!defaultModuleId) return
    updateBasis({
      ...basis,
      splits: [
        ...basis.splits,
        createEmptySplit(basis.id, defaultModuleId, basis.splits.length),
      ],
    })
  }

  const autoSplitFromBasis = (basis: LocalPricingBasis) => {
    if (!linkedOfferBasis || pricingModules.length === 0) return
    const options = buildLineItemCategoryOptions(
      lineItemSourceFromOfferBasis(linkedOfferBasis),
    )
    const defaultModuleId = pricingModules[0].id
    const existingKeys = new Set(
      basis.splits.map((s) => `${s.category_type}:${s.category_key}`),
    )
    const newSplits = options
      .filter(
        (opt) => !existingKeys.has(`${opt.category_type}:${opt.category_key}`),
      )
      .map((opt, index) => ({
        id: createTempId('split'),
        basis_id: basis.id,
        module_id:
          resolveModuleIdForCategoryKey(opt.category_key, modules) ??
          defaultModuleId,
        title: opt.label,
        amount: 0,
        sort_order: basis.splits.length + index,
        category_type: opt.category_type,
        category_key: opt.category_key,
      }))
    updateBasis({ ...basis, splits: [...basis.splits, ...newSplits] })
  }

  const validationIssues = validatePricingBases(
    pricingBases,
    modules,
    jobQuotesById,
  )

  const showAmountField = selectedBasis?.basis_type !== 'technical'
  const splitsHeading =
    selectedBasis?.basis_type === 'subcontractor'
      ? 'Quote allocation'
      : 'Module allocations'

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center" wrap="wrap" gap="2">
        <Text size="2" weight="bold">
          Pricing basis
        </Text>
        {!readOnly && (
          <Flex gap="2" wrap="wrap">
            <Button
              size="1"
              variant="soft"
              onClick={() => addBasis('technical')}
            >
              <Plus width={14} height={14} />
              Offer basis
            </Button>
            <Button
              size="1"
              variant="soft"
              disabled={missingSubcontractorCount === 0}
              onClick={addMissingSubcontractorBases}
            >
              <Plus width={14} height={14} />
              Subcontractors
              {missingSubcontractorCount > 0 && (
                <Badge size="1" ml="1">
                  {missingSubcontractorCount}
                </Badge>
              )}
            </Button>
            <Button size="1" variant="soft" onClick={() => addBasis('custom')}>
              <Plus width={14} height={14} />
              Custom
            </Button>
          </Flex>
        )}
      </Flex>

      {sortedBases.length > 0 && (
        <Flex gap="2" wrap="wrap">
          {sortedBases.map((basis) => {
            const isSelected = selectedBasis?.id === basis.id
            const allocation = getBasisAllocationStatus(
              basis,
              allocationOptions,
            )
            const showAllocationWarning =
              allocation != null && !allocation.isFullyAllocated
            return (
              <Box
                key={basis.id}
                className={`pretty-offer-basis-tab${isSelected ? ' pretty-offer-basis-tab--selected' : ''}`}
              >
                <button
                  type="button"
                  className="pretty-offer-basis-tab__main"
                  onClick={() => setSelectedBasisId(basis.id)}
                >
                  <Text
                    size="2"
                    weight={isSelected ? 'medium' : 'regular'}
                    className="pretty-offer-basis-tab__title"
                  >
                    {basis.title || BASIS_TYPE_LABELS[basis.basis_type]}
                  </Text>
                </button>
                <Flex
                  align="center"
                  className="pretty-offer-basis-tab__trailing"
                >
                  {showAllocationWarning && (
                    <Tooltip
                      content={
                        allocation.remaining > 0
                          ? `${formatMoney(allocation.remaining)} not assigned to a split.`
                          : `${formatMoney(Math.abs(allocation.remaining))} over-allocated across splits.`
                      }
                    >
                      <WarningTriangle
                        width={14}
                        height={14}
                        className="pretty-offer-basis-tab__warning"
                        aria-label="Not all costs are assigned to splits"
                      />
                    </Tooltip>
                  )}
                  <span className="pretty-offer-basis-tab__amount">
                    {formatMoney(basisSubtotal(basis, allocationOptions))}
                  </span>
                  {!readOnly && (
                    <IconButton
                      size="2"
                      variant="ghost"
                      color="red"
                      className="pretty-offer-basis-tab__delete"
                      aria-label={`Remove ${basis.title || BASIS_TYPE_LABELS[basis.basis_type]}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setBasisPendingDelete(basis)
                      }}
                    >
                      <Trash
                        width={DELETE_ICON_SIZE}
                        height={DELETE_ICON_SIZE}
                      />
                    </IconButton>
                  )}
                </Flex>
              </Box>
            )
          })}
        </Flex>
      )}

      {selectedBasis ? (
        <Box
          p="3"
          style={{ border: '1px solid var(--gray-a5)', borderRadius: 8 }}
        >
          <Flex align="center" gap="2" mb="3">
            <Badge color="gray">
              {BASIS_TYPE_LABELS[selectedBasis.basis_type]}
            </Badge>
            <Text size="2" weight="medium">
              Basis details
            </Text>
          </Flex>

          <Flex direction="column" gap="3">
            <Flex align="center" gap="3" wrap="wrap">
              <Box style={{ flex: '1 1 180px', minWidth: 180 }}>
                <TextField.Root
                  value={selectedBasis.title}
                  disabled={readOnly}
                  placeholder="Basis title"
                  onChange={(e) =>
                    updateBasis({ ...selectedBasis, title: e.target.value })
                  }
                />
              </Box>

              <Flex align="center" gap="2" style={{ flex: '0 0 auto' }}>
                <Checkbox
                  checked={selectedBasis.apply_subcontractor_markup ?? true}
                  disabled={readOnly}
                  onCheckedChange={(checked) =>
                    updateBasis({
                      ...selectedBasis,
                      apply_subcontractor_markup: checked === true,
                    })
                  }
                />
                <Text
                  size="2"
                  as="label"
                  style={{ cursor: readOnly ? 'default' : 'pointer' }}
                >
                  Apply subcontractor markup
                  {subcontractorMarkupPercent > 0
                    ? ` (${subcontractorMarkupPercent}%)`
                    : ''}
                </Text>
              </Flex>

              {selectedBasis.basis_type === 'subcontractor' && (
                <Box style={{ flex: '1 1 220px', minWidth: 220 }}>
                  <Select.Root
                    value={selectedBasis.job_subcontractor_quote_id ?? 'none'}
                    disabled={readOnly}
                    onValueChange={(v) => {
                      const quote =
                        v === 'none'
                          ? null
                          : jobQuotes.find((entry) => entry.id === v)
                      updateBasis({
                        ...selectedBasis,
                        job_subcontractor_quote_id: v === 'none' ? null : v,
                        source_job_subcontractor_id:
                          quote?.job_subcontractor_id ??
                          selectedSubcontractorId ??
                          selectedBasis.source_job_subcontractor_id ??
                          null,
                      })
                    }}
                  >
                    <Select.Trigger placeholder="Select quote version" />
                    <Select.Content style={{ zIndex: 10000 }}>
                      <Select.Item value="none">None</Select.Item>
                      {quotesForSelectedBasis.map((quote) => (
                        <Select.Item key={quote.id} value={quote.id}>
                          v{quote.version_number} (
                          {formatMoney(quote.total_amount)})
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
              )}
            </Flex>

            {selectedBasis.basis_type === 'technical' && (
              <Flex justify="between" align="center" gap="3" wrap="wrap">
                <Box style={{ minWidth: 0 }}>
                  <Text size="1" color="gray" mb="1" as="div">
                    Source offer basis
                  </Text>
                  <Text size="2" weight="medium">
                    {linkedOfferBasisId
                      ? linkedOfferBasisTitle
                      : 'No linked offer basis'}
                  </Text>
                </Box>
                {!readOnly && linkedOfferBasis && pricingModules.length > 0 && (
                  <Button
                    size="2"
                    variant="soft"
                    onClick={() => autoSplitFromBasis(selectedBasis)}
                  >
                    <Spark width={14} height={14} />
                    Get splits from categories
                  </Button>
                )}
              </Flex>
            )}

            {selectedBasis.basis_type === 'subcontractor' && (
              <Box>
                {selectedSubcontractorId && (
                  <Text size="1" color="gray" as="div">
                    {jobSubcontractors.find(
                      (s) => s.id === selectedSubcontractorId,
                    )?.customer.name ?? 'Subcontractor'}
                  </Text>
                )}
                {selectedBasis.job_subcontractor_quote_id && (
                  <Flex gap="2" align="center" mt="2" wrap="wrap">
                    {(() => {
                      const quote = jobQuotesById.get(
                        selectedBasis.job_subcontractor_quote_id,
                      )
                      if (!quote?.pdf_path) return null
                      return (
                        <Button
                          size="1"
                          variant="ghost"
                          onClick={() =>
                            void getJobSubcontractorQuotePdfUrl(
                              quote.pdf_path!,
                            ).then((url) => window.open(url, '_blank'))
                          }
                        >
                          <Download width={14} height={14} />
                          View quote PDF
                        </Button>
                      )
                    })()}
                    <Text size="1" color="gray">
                      Add quote versions on the job Subcontractors tab.
                    </Text>
                  </Flex>
                )}
              </Box>
            )}

            <Box>
              <Flex justify="between" align="center" gap="2" mb="1">
                <Flex align="center" gap="1">
                  <Text size="2" weight="medium">
                    {splitsHeading}
                  </Text>
                  {selectedBasis.basis_type === 'subcontractor' && (
                    <Tooltip content={SPLITS_INFO_TOOLTIP}>
                      <IconButton
                        size="1"
                        variant="ghost"
                        color="gray"
                        aria-label="How quote splits work"
                        style={{ cursor: 'help' }}
                      >
                        <InfoCircle width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Flex>
                {!readOnly &&
                  pricingModules.length > 0 &&
                  selectedBasis.basis_type !== 'technical' && (
                    <Button size="1" onClick={() => addSplit(selectedBasis)}>
                      <Plus width={14} height={14} />
                      Add split
                    </Button>
                  )}
              </Flex>
              <Text size="1" color="gray" mb="3" as="div">
                {selectedBasis.basis_type === 'subcontractor'
                  ? 'Split the subcontractor quote across modules. Each amount is the share of the quote assigned to that module.'
                  : 'Connect cost lines to modules so each module total is calculated correctly. Amounts are excl. VAT and use stored offer basis line prices.'}
              </Text>

              {pricingModules.length === 0 && (
                <Text size="2" color="gray">
                  Add a standard module first, then connect pricing splits to it.
                  Timeline modules cannot receive cost splits.
                </Text>
              )}

              {pricingModules.length > 0 && selectedBasis.splits.length === 0 && (
                <Text size="2" color="gray">
                  No splits yet for this basis.
                </Text>
              )}

              {pricingModules.length > 0 && selectedBasis.splits.length > 0 && (
                <Flex direction="column" gap="0">
                  {selectedBasis.splits.map((split, index) => (
                    <React.Fragment key={split.id}>
                      {index > 0 && (
                        <Box className="pretty-offer-split-flow__connector">
                          <ArrowDown width={14} height={14} />
                        </Box>
                      )}
                      <Box className="pretty-offer-split-row">
                        <Box className="pretty-offer-split-row__fields">
                          <Box className="pretty-offer-split-row__field pretty-offer-split-row__field--grow">
                            <Text size="1" color="gray" as="div">
                              {splitTitleLabel(selectedBasis.basis_type)}
                            </Text>
                            <TextField.Root
                              size="2"
                              value={split.title}
                              disabled={
                                readOnly ||
                                selectedBasis.basis_type === 'technical'
                              }
                              placeholder={splitTitlePlaceholder(
                                selectedBasis.basis_type,
                              )}
                              onChange={(e) =>
                                updateBasis({
                                  ...selectedBasis,
                                  splits: selectedBasis.splits.map((s) =>
                                    s.id === split.id
                                      ? { ...s, title: e.target.value }
                                      : s,
                                  ),
                                })
                              }
                            />
                          </Box>

                          {showAmountField && (
                            <>
                              <Box
                                className="pretty-offer-split-row__arrow"
                                aria-hidden
                              >
                                <NavArrowRight width={14} height={14} />
                              </Box>
                              <Box className="pretty-offer-split-row__field pretty-offer-split-row__field--amount">
                                <Text size="1" color="gray" as="div">
                                  Amount
                                </Text>
                                <SplitAmountField
                                  value={split.amount}
                                  disabled={readOnly}
                                  onChange={(amount) =>
                                    updateBasis({
                                      ...selectedBasis,
                                      splits: selectedBasis.splits.map((s) =>
                                        s.id === split.id
                                          ? { ...s, amount }
                                          : s,
                                      ),
                                    })
                                  }
                                />
                              </Box>
                            </>
                          )}

                          <Box
                            className="pretty-offer-split-row__arrow"
                            aria-hidden
                          >
                            <NavArrowRight width={14} height={14} />
                          </Box>
                          <Box className="pretty-offer-split-row__field pretty-offer-split-row__field--module">
                            <Text size="1" color="gray" as="div">
                              Module
                            </Text>
                            <Select.Root
                              value={split.module_id}
                              disabled={readOnly}
                              onValueChange={(moduleId) =>
                                updateBasis({
                                  ...selectedBasis,
                                  splits: selectedBasis.splits.map((s) =>
                                    s.id === split.id
                                      ? { ...s, module_id: moduleId }
                                      : s,
                                  ),
                                })
                              }
                            >
                              <Select.Trigger placeholder="Select module" />
                              <Select.Content style={{ zIndex: 10000 }}>
                                {pricingModules.map((module) => (
                                  <Select.Item
                                    key={module.id}
                                    value={module.id}
                                  >
                                    {module.title || 'Untitled module'}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select.Root>
                          </Box>

                          <Box
                            className="pretty-offer-split-row__arrow"
                            aria-hidden
                          >
                            <NavArrowRight width={14} height={14} />
                          </Box>
                          <Box className="pretty-offer-split-row__field pretty-offer-split-row__field--cost">
                            <Text size="1" color="gray" as="div">
                              {selectedBasis.basis_type === 'technical'
                                ? 'Cost (excl. VAT)'
                                : 'Cost'}
                            </Text>
                            <Text size="2" weight="medium">
                              {formatMoney(
                                calculateSplitAmount(split, selectedBasis, {
                                  offerBasesById,
                                  jobQuotesById,
                                  technicalContext,
                                  subcontractorMarkupPercent,
                                }),
                              )}
                            </Text>
                          </Box>

                          {!readOnly && (
                            <Box className="pretty-offer-split-row__delete-wrap">
                              <IconButton
                                size="2"
                                variant="ghost"
                                color="red"
                                className="pretty-offer-split-row__delete"
                                aria-label="Remove split"
                                onClick={() =>
                                  updateBasis({
                                    ...selectedBasis,
                                    splits: selectedBasis.splits.filter(
                                      (s) => s.id !== split.id,
                                    ),
                                  })
                                }
                              >
                                <Trash
                                  width={DELETE_ICON_SIZE}
                                  height={DELETE_ICON_SIZE}
                                />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </React.Fragment>
                  ))}
                </Flex>
              )}

              {selectedAllocation && (
                <Box
                  mt="3"
                  p="2"
                  style={{
                    borderRadius: 8,
                    background: selectedAllocation.isFullyAllocated
                      ? 'var(--green-a3)'
                      : 'var(--gray-a2)',
                  }}
                >
                  <Flex direction="column" gap="1">
                    <Flex justify="between" wrap="wrap" gap="2">
                      <Text size="2">
                        Assigned
                        {selectedAllocation.amountsExcludeVat
                          ? ' (excl. VAT)'
                          : ''}
                        :{' '}
                        <Text weight="medium" as="span">
                          {formatMoney(selectedAllocation.assignedTotal)}
                        </Text>
                      </Text>
                      <Text size="2">
                        {selectedAllocation.sourceTotalLabel}:{' '}
                        <Text weight="medium" as="span">
                          {formatMoney(selectedAllocation.sourceTotal)}
                        </Text>
                      </Text>
                    </Flex>
                    {selectedAllocation.amountsExcludeVat &&
                      selectedAllocation.vatPercent > 0 && (
                        <Flex justify="between" wrap="wrap" gap="2">
                          <Text size="1" color="gray">
                            Assigned incl. VAT ({selectedAllocation.vatPercent}
                            %):{' '}
                            {formatMoney(
                              selectedAllocation.assignedTotalWithVat,
                            )}
                          </Text>
                          <Text size="1" color="gray">
                            Basis incl. VAT:{' '}
                            {formatMoney(selectedAllocation.sourceTotalWithVat)}
                          </Text>
                        </Flex>
                      )}
                    {selectedAllocation.discountPercent > 0 && (
                      <Text size="1" color="gray">
                        Equipment discount ({selectedAllocation.discountPercent}
                        %) is applied proportionally to equipment splits.
                      </Text>
                    )}
                    <Text
                      size="2"
                      color={
                        selectedAllocation.isFullyAllocated
                          ? 'green'
                          : selectedAllocation.remaining > 0
                            ? 'orange'
                            : 'red'
                      }
                    >
                      {selectedAllocation.isFullyAllocated
                        ? 'Fully allocated — all costs are assigned to splits.'
                        : selectedAllocation.remaining > 0
                          ? `${formatMoney(selectedAllocation.remaining)} not assigned to a split.`
                          : `${formatMoney(Math.abs(selectedAllocation.remaining))} over the ${selectedAllocation.sourceTotalLabel.toLowerCase()} — reduce split amounts.`}
                    </Text>
                  </Flex>
                </Box>
              )}
            </Box>
          </Flex>
        </Box>
      ) : (
        <Text size="2" color="gray">
          Add pricing basises and split them across modules. Every split must
          connect to a module.
        </Text>
      )}

      {validationIssues.length > 0 && (
        <Box p="2" style={{ background: 'var(--orange-a3)', borderRadius: 8 }}>
          {validationIssues.map((issue) => (
            <Text
              key={`${issue.basisId}-${issue.message}`}
              size="2"
              color="orange"
              as="div"
            >
              {issue.message}
            </Text>
          ))}
        </Box>
      )}

      <AlertDialog.Root
        open={basisPendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setBasisPendingDelete(null)
        }}
      >
        <AlertDialog.Content maxWidth="440px" style={{ zIndex: 10001 }}>
          <AlertDialog.Title>Remove pricing basis?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            {basisPendingDelete
              ? `Remove "${basisPendingDelete.title || BASIS_TYPE_LABELS[basisPendingDelete.basis_type]}" and all of its splits? This cannot be undone until you save the offer.`
              : 'Remove this pricing basis and all of its splits?'}
          </AlertDialog.Description>
          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                onClick={() => {
                  if (basisPendingDelete) {
                    removeBasis(basisPendingDelete.id)
                  }
                  setBasisPendingDelete(null)
                }}
              >
                Remove
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Flex>
  )
}
