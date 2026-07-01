import * as React from 'react'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Select,
  Table,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Download, Plus, Trash } from 'iconoir-react'
import {
  getSubcontractorQuotePdfUrl,
  uploadSubcontractorQuotePdf,
} from '../../../api/prettyOfferQueries'
import {
  allocationAmountForModule,
  validateSubcontractorAllocations,
} from '../../../utils/prettyOfferCalculations'
import { createEmptyAllocation, createEmptyQuote } from './types'
import type { LocalPrettyModule, LocalSubcontractorQuote } from './types'

type Props = {
  offerId: string
  companyId: string
  modules: Array<LocalPrettyModule>
  quotes: Array<LocalSubcontractorQuote>
  readOnly: boolean
  onQuotesChange: (quotes: Array<LocalSubcontractorQuote>) => void
}

export function SubcontractorSection({
  offerId,
  companyId,
  modules,
  quotes,
  readOnly,
  onQuotesChange,
}: Props) {
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string | null>(
    quotes[0]?.id ?? null,
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploadingQuoteId, setUploadingQuoteId] = React.useState<string | null>(
    null,
  )

  const sortedQuotes = [...quotes].sort((a, b) => a.sort_order - b.sort_order)
  const selectedQuote =
    sortedQuotes.find((q) => q.id === selectedQuoteId) ??
    sortedQuotes[0] ??
    null

  React.useEffect(() => {
    if (!selectedQuoteId && sortedQuotes[0]) {
      setSelectedQuoteId(sortedQuotes[0].id)
    }
  }, [selectedQuoteId, sortedQuotes])

  const setQuotes = (next: Array<LocalSubcontractorQuote>) => {
    onQuotesChange(
      next.map((quote, index) => ({ ...quote, sort_order: index })),
    )
  }

  const addQuote = () => {
    const next = [...sortedQuotes, createEmptyQuote(sortedQuotes.length)]
    setQuotes(next)
    setSelectedQuoteId(next[next.length - 1].id)
  }

  const updateQuote = (quote: LocalSubcontractorQuote) => {
    setQuotes(sortedQuotes.map((q) => (q.id === quote.id ? quote : q)))
  }

  const removeQuote = (quoteId: string) => {
    const next = sortedQuotes.filter((q) => q.id !== quoteId)
    setQuotes(next)
    setSelectedQuoteId(next[0]?.id ?? null)
  }

  const ensureAllocations = (quote: LocalSubcontractorQuote) => {
    const existing = new Map(
      quote.allocations.map((a) => [a.module_id, a] as const),
    )
    return modules.map((module) => {
      const found = existing.get(module.id)
      if (found) return found
      return createEmptyAllocation(quote.id, module.id, 'percent')
    })
  }

  const updateAllocation = (
    quote: LocalSubcontractorQuote,
    moduleId: string,
    patch: Partial<LocalSubcontractorQuote['allocations'][number]>,
  ) => {
    const allocations = ensureAllocations(quote).map((alloc) =>
      alloc.module_id === moduleId ? { ...alloc, ...patch } : alloc,
    )
    updateQuote({ ...quote, allocations })
  }

  const handleUploadPdf = async (
    quote: LocalSubcontractorQuote,
    file: File,
  ) => {
    setUploadingQuoteId(quote.id)
    try {
      const uploaded = await uploadSubcontractorQuotePdf({
        companyId,
        offerId,
        file,
      })
      updateQuote({
        ...quote,
        pdf_path: uploaded.path,
        pdf_filename: uploaded.filename,
        mime_type: uploaded.mimeType,
        size_bytes: uploaded.sizeBytes,
      })
    } finally {
      setUploadingQuoteId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const validationIssues = validateSubcontractorAllocations(quotes)

  return (
    <Flex direction="column" gap="3">
      <Flex justify="between" align="center">
        <Text size="2" weight="bold">
          Subcontractor quotes
        </Text>
        {!readOnly && (
          <Button size="1" onClick={addQuote}>
            <Plus width={14} height={14} />
            Add quote
          </Button>
        )}
      </Flex>

      <Flex gap="3" wrap="wrap">
        {sortedQuotes.map((quote) => (
          <Button
            key={quote.id}
            size="1"
            variant={selectedQuote?.id === quote.id ? 'solid' : 'soft'}
            onClick={() => setSelectedQuoteId(quote.id)}
          >
            {quote.vendor_name || 'Untitled vendor'}
          </Button>
        ))}
      </Flex>

      {selectedQuote ? (
        <Box
          p="3"
          style={{ border: '1px solid var(--gray-a5)', borderRadius: 8 }}
        >
          <Flex justify="between" align="center" mb="3">
            <Text size="2" weight="medium">
              Quote details
            </Text>
            {!readOnly && (
              <IconButton
                size="1"
                variant="ghost"
                color="red"
                onClick={() => removeQuote(selectedQuote.id)}
              >
                <Trash width={14} height={14} />
              </IconButton>
            )}
          </Flex>

          <Flex direction="column" gap="3">
            <TextField.Root
              value={selectedQuote.vendor_name}
              disabled={readOnly}
              placeholder="Vendor name"
              onChange={(e) =>
                updateQuote({ ...selectedQuote, vendor_name: e.target.value })
              }
            />
            <TextArea
              value={selectedQuote.note ?? ''}
              disabled={readOnly}
              placeholder="Note"
              rows={2}
              onChange={(e) =>
                updateQuote({ ...selectedQuote, note: e.target.value })
              }
            />
            <TextField.Root
              type="number"
              value={selectedQuote.total_amount}
              disabled={readOnly}
              placeholder="Total amount"
              onChange={(e) =>
                updateQuote({
                  ...selectedQuote,
                  total_amount: Number(e.target.value) || 0,
                })
              }
            />

            <Flex gap="2" align="center" wrap="wrap">
              {!readOnly && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleUploadPdf(selectedQuote, file)
                    }}
                  />
                  <Button
                    size="1"
                    variant="soft"
                    disabled={uploadingQuoteId === selectedQuote.id}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedQuote.pdf_filename ? 'Replace PDF' : 'Upload PDF'}
                  </Button>
                </>
              )}
              {selectedQuote.pdf_filename && (
                <Text size="2">{selectedQuote.pdf_filename}</Text>
              )}
              {selectedQuote.pdf_path && (
                <Button
                  size="1"
                  variant="ghost"
                  onClick={() =>
                    void getSubcontractorQuotePdfUrl(
                      selectedQuote.pdf_path!,
                    ).then((url) => window.open(url, '_blank'))
                  }
                >
                  <Download width={14} height={14} />
                  View PDF
                </Button>
              )}
            </Flex>

            {modules.length > 0 && (
              <Box>
                <Flex justify="between" align="center" mb="2">
                  <Text size="2" weight="medium">
                    Module allocations
                  </Text>
                  {!readOnly && ensureAllocations(selectedQuote).length > 0 && (
                    <Select.Root
                      value={
                        ensureAllocations(selectedQuote)[0]?.allocation_mode ??
                        'percent'
                      }
                      onValueChange={(mode) => {
                        updateQuote({
                          ...selectedQuote,
                          allocations: ensureAllocations(selectedQuote).map(
                            (alloc) => ({
                              ...alloc,
                              allocation_mode: mode as 'percent' | 'amount',
                              allocation_value: 0,
                            }),
                          ),
                        })
                      }}
                    >
                      <Select.Trigger placeholder="Allocation mode" />
                      <Select.Content style={{ zIndex: 10000 }}>
                        <Select.Item value="percent">Percent</Select.Item>
                        <Select.Item value="amount">Fixed amount</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  )}
                </Flex>

                <Table.Root variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Module</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>
                        {ensureAllocations(selectedQuote)[0]
                          ?.allocation_mode === 'amount'
                          ? 'Amount'
                          : 'Percent'}
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Allocated</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {ensureAllocations(selectedQuote).map((alloc) => {
                      const module = modules.find(
                        (m) => m.id === alloc.module_id,
                      )
                      return (
                        <Table.Row key={alloc.module_id}>
                          <Table.Cell>{module?.title || 'Module'}</Table.Cell>
                          <Table.Cell>
                            <TextField.Root
                              type="number"
                              size="1"
                              disabled={readOnly}
                              value={alloc.allocation_value}
                              onChange={(e) =>
                                updateAllocation(
                                  selectedQuote,
                                  alloc.module_id,
                                  {
                                    allocation_value:
                                      Number(e.target.value) || 0,
                                  },
                                )
                              }
                            />
                          </Table.Cell>
                          <Table.Cell>
                            {allocationAmountForModule(
                              selectedQuote,
                              alloc.module_id,
                            ).toLocaleString('nb-NO', {
                              style: 'currency',
                              currency: 'NOK',
                              maximumFractionDigits: 0,
                            })}
                          </Table.Cell>
                        </Table.Row>
                      )
                    })}
                  </Table.Body>
                </Table.Root>
              </Box>
            )}
          </Flex>
        </Box>
      ) : (
        <Text size="2" color="gray">
          Add subcontractor quotes and split them across modules.
        </Text>
      )}

      {validationIssues.length > 0 && (
        <Box p="2" style={{ background: 'var(--orange-a3)', borderRadius: 8 }}>
          {validationIssues.map((issue) => (
            <Text key={issue.quoteId} size="2" color="orange" as="div">
              {issue.message}
            </Text>
          ))}
        </Box>
      )}
    </Flex>
  )
}
