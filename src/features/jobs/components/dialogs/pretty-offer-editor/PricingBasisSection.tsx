import * as React from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Download, Plus, Spark, Trash } from 'iconoir-react'
import { useQuery } from '@tanstack/react-query'
import {
  getJobSubcontractorQuotePdfUrl,
  jobSubcontractorQuotesQuery,
  jobSubcontractorsQuery,
} from '../../../api/subcontractorQueries'
import {
  basisSubtotal,
  buildTechnicalCategoryOptions,
  calculateSplitAmount,
  validatePricingBases,
} from '../../../utils/prettyOfferCalculations'
import { offerDetailQuery } from '../../../api/offerQueries'
import {
  BASIS_TYPE_LABELS,
  createEmptyPricingBasis,
  createEmptySplit,
  createTempId,
} from './types'
import type { LocalPrettyModule, LocalPricingBasis } from './types'
import type { JobOffer, OfferDetail } from '../../../types'

function formatMoney(value: number) {
  return value.toLocaleString('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  })
}

type Props = {
  jobId: string
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
  technicalOffers: Array<JobOffer>
  readOnly: boolean
  onPricingBasesChange: (bases: Array<LocalPricingBasis>) => void
}

export function PricingBasisSection({
  jobId,
  modules,
  pricingBases,
  technicalOffers,
  readOnly,
  onPricingBasesChange,
}: Props) {
  const [selectedBasisId, setSelectedBasisId] = React.useState<string | null>(
    pricingBases[0]?.id ?? null,
  )

  const { data: jobSubcontractors = [] } = useQuery({
    ...jobSubcontractorsQuery({ jobId }),
  })

  const { data: jobQuotes = [] } = useQuery({
    ...jobSubcontractorQuotesQuery({ jobId }),
  })

  const sortedBases = [...pricingBases].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  const selectedBasis =
    sortedBases.find((b) => b.id === selectedBasisId) ?? sortedBases[0] ?? null

  React.useEffect(() => {
    if (!selectedBasisId && sortedBases[0]) {
      setSelectedBasisId(sortedBases[0].id)
    }
  }, [selectedBasisId, sortedBases])

  const technicalOfferId = selectedBasis?.source_technical_offer_id
  const { data: selectedTechnicalOffer } = useQuery({
    ...offerDetailQuery(technicalOfferId ?? ''),
    enabled: !!technicalOfferId,
  })

  const technicalOffersById = React.useMemo(() => {
    const map = new Map<string, OfferDetail>()
    if (selectedTechnicalOffer && technicalOfferId) {
      map.set(technicalOfferId, selectedTechnicalOffer)
    }
    return map
  }, [selectedTechnicalOffer, technicalOfferId])

  const jobQuotesById = React.useMemo(
    () => new Map(jobQuotes.map((q) => [q.id, q])),
    [jobQuotes],
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
    const next = [
      ...sortedBases,
      createEmptyPricingBasis(sortedBases.length, type),
    ]
    setBases(next)
    setSelectedBasisId(next[next.length - 1].id)
  }

  const removeBasis = (basisId: string) => {
    const next = sortedBases.filter((b) => b.id !== basisId)
    setBases(next)
    if (selectedBasisId === basisId) {
      setSelectedBasisId(next[0]?.id ?? null)
    }
  }

  const addSplit = (basis: LocalPricingBasis) => {
    const defaultModuleId = modules[0]?.id ?? ''
    if (!defaultModuleId) return
    updateBasis({
      ...basis,
      splits: [
        ...basis.splits,
        createEmptySplit(basis.id, defaultModuleId, basis.splits.length),
      ],
    })
  }

  const autoSplitTechnical = (basis: LocalPricingBasis) => {
    if (!selectedTechnicalOffer || modules.length === 0) return
    const options = buildTechnicalCategoryOptions(selectedTechnicalOffer)
    const defaultModuleId = modules[0].id
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
        module_id: defaultModuleId,
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
              Technical
            </Button>
            <Button
              size="1"
              variant="soft"
              onClick={() => addBasis('subcontractor')}
            >
              <Plus width={14} height={14} />
              Subcontractor
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
          {sortedBases.map((basis) => (
            <Button
              key={basis.id}
              size="1"
              variant={selectedBasis?.id === basis.id ? 'solid' : 'soft'}
              onClick={() => setSelectedBasisId(basis.id)}
            >
              {basis.title || BASIS_TYPE_LABELS[basis.basis_type]}
              <Badge size="1" ml="2">
                {formatMoney(
                  basisSubtotal(basis, { technicalOffersById, jobQuotesById }),
                )}
              </Badge>
            </Button>
          ))}
        </Flex>
      )}

      {selectedBasis ? (
        <Box
          p="3"
          style={{ border: '1px solid var(--gray-a5)', borderRadius: 8 }}
        >
          <Flex justify="between" align="center" mb="3">
            <Flex align="center" gap="2">
              <Badge>{BASIS_TYPE_LABELS[selectedBasis.basis_type]}</Badge>
              <Text size="2" weight="medium">
                Basis details
              </Text>
            </Flex>
            {!readOnly && (
              <IconButton
                size="1"
                variant="ghost"
                color="red"
                onClick={() => removeBasis(selectedBasis.id)}
              >
                <Trash width={14} height={14} />
              </IconButton>
            )}
          </Flex>

          <Flex direction="column" gap="3">
            <TextField.Root
              value={selectedBasis.title}
              disabled={readOnly}
              placeholder="Basis title"
              onChange={(e) =>
                updateBasis({ ...selectedBasis, title: e.target.value })
              }
            />

            {selectedBasis.basis_type === 'technical' && (
              <Box>
                <Text size="2" weight="medium" mb="1" as="div">
                  Source technical offer
                </Text>
                <Select.Root
                  value={selectedBasis.source_technical_offer_id ?? 'none'}
                  disabled={readOnly}
                  onValueChange={(v) =>
                    updateBasis({
                      ...selectedBasis,
                      source_technical_offer_id: v === 'none' ? null : v,
                      splits: [],
                    })
                  }
                >
                  <Select.Trigger placeholder="Select technical offer" />
                  <Select.Content style={{ zIndex: 10000 }}>
                    <Select.Item value="none">None</Select.Item>
                    {technicalOffers.map((offer) => (
                      <Select.Item key={offer.id} value={offer.id}>
                        v{offer.version_number} — {offer.title}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                {!readOnly && selectedTechnicalOffer && (
                  <Button
                    size="1"
                    variant="soft"
                    mt="2"
                    onClick={() => autoSplitTechnical(selectedBasis)}
                  >
                    <Spark width={14} height={14} />
                    Auto-split by categories
                  </Button>
                )}
              </Box>
            )}

            {selectedBasis.basis_type === 'subcontractor' && (
              <Box>
                <Text size="2" weight="medium" mb="1" as="div">
                  Subcontractor quote version
                </Text>
                <Select.Root
                  value={selectedBasis.job_subcontractor_quote_id ?? 'none'}
                  disabled={readOnly}
                  onValueChange={(v) =>
                    updateBasis({
                      ...selectedBasis,
                      job_subcontractor_quote_id: v === 'none' ? null : v,
                    })
                  }
                >
                  <Select.Trigger placeholder="Select quote version" />
                  <Select.Content style={{ zIndex: 10000 }}>
                    <Select.Item value="none">None</Select.Item>
                    {jobQuotes.map((quote) => {
                      const sub = jobSubcontractors.find(
                        (s) => s.id === quote.job_subcontractor_id,
                      )
                      return (
                        <Select.Item key={quote.id} value={quote.id}>
                          {sub?.customer.name ?? 'Subcontractor'} — v
                          {quote.version_number} (
                          {formatMoney(quote.total_amount)})
                        </Select.Item>
                      )
                    })}
                  </Select.Content>
                </Select.Root>
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

            <Flex justify="between" align="center">
              <Text size="2" weight="medium">
                Splits
              </Text>
              {!readOnly && modules.length > 0 && (
                <Button size="1" onClick={() => addSplit(selectedBasis)}>
                  <Plus width={14} height={14} />
                  Add split
                </Button>
              )}
            </Flex>

            {modules.length === 0 && (
              <Text size="2" color="gray">
                Add modules first, then connect pricing splits to them.
              </Text>
            )}

            {selectedBasis.splits.map((split) => (
              <Box
                key={split.id}
                p="2"
                style={{
                  border: '1px solid var(--gray-a4)',
                  borderRadius: 6,
                }}
              >
                <Flex gap="2" wrap="wrap" align="end">
                  <Box style={{ flex: 2, minWidth: 140 }}>
                    <Text size="1" color="gray" mb="1" as="div">
                      Title
                    </Text>
                    <TextField.Root
                      size="1"
                      value={split.title}
                      disabled={
                        readOnly || selectedBasis.basis_type === 'technical'
                      }
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
                  {selectedBasis.basis_type !== 'technical' && (
                    <Box style={{ width: 120 }}>
                      <Text size="1" color="gray" mb="1" as="div">
                        Amount
                      </Text>
                      <TextField.Root
                        size="1"
                        type="number"
                        value={split.amount}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateBasis({
                            ...selectedBasis,
                            splits: selectedBasis.splits.map((s) =>
                              s.id === split.id
                                ? {
                                    ...s,
                                    amount: Number(e.target.value) || 0,
                                  }
                                : s,
                            ),
                          })
                        }
                      />
                    </Box>
                  )}
                  <Box style={{ flex: 2, minWidth: 140 }}>
                    <Text size="1" color="gray" mb="1" as="div">
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
                      <Select.Trigger />
                      <Select.Content style={{ zIndex: 10000 }}>
                        {modules.map((module) => (
                          <Select.Item key={module.id} value={module.id}>
                            {module.title || 'Untitled module'}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Box>
                  <Box style={{ width: 100 }}>
                    <Text size="1" color="gray" mb="1" as="div">
                      Cost
                    </Text>
                    <Text size="2">
                      {formatMoney(
                        calculateSplitAmount(split, selectedBasis, {
                          technicalOffersById,
                          jobQuotesById,
                        }),
                      )}
                    </Text>
                  </Box>
                  {!readOnly && (
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="red"
                      onClick={() =>
                        updateBasis({
                          ...selectedBasis,
                          splits: selectedBasis.splits.filter(
                            (s) => s.id !== split.id,
                          ),
                        })
                      }
                    >
                      <Trash width={14} height={14} />
                    </IconButton>
                  )}
                </Flex>
              </Box>
            ))}

            {selectedBasis.basis_type === 'subcontractor' &&
              selectedBasis.job_subcontractor_quote_id && (
                <Text size="1" color="gray">
                  Split total:{' '}
                  {formatMoney(
                    selectedBasis.splits.reduce((sum, s) => sum + s.amount, 0),
                  )}{' '}
                  / Quote total:{' '}
                  {formatMoney(
                    jobQuotesById.get(selectedBasis.job_subcontractor_quote_id)
                      ?.total_amount ?? 0,
                  )}
                </Text>
              )}
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
    </Flex>
  )
}
