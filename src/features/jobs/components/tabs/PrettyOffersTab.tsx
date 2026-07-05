// src/features/jobs/components/tabs/PrettyOffersTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  DropdownMenu,
  Flex,
  Heading,
  IconButton,
  Table,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import {
  Copy,
  Download,
  Edit,
  Eye,
  Link,
  Lock,
  Plus,
  Trash,
} from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { CopyIconButton } from '@shared/lib/CopyIconButton'
import {
  deleteOffer,
  duplicateOffer,
  exportOfferPDF,
  lockOffer,
} from '../../api/offerQueries'
import {
  createEmptyDraftPrettyOffer,
  jobPrettyOffersQuery,
} from '../../api/prettyOfferQueries'
import PrettyOfferEditor from '../dialogs/PrettyOfferEditor'
import { PrettyOfferBetaBadge } from '../PrettyOfferBetaBadge'
import { formatOfferNumberDisplay } from '../../utils/offerNumber'
import type { JobOffer } from '../../types'

function getOfferStatusBadgeColor(offer: JobOffer) {
  if (offer.revision_requested_at) return 'orange'
  switch (offer.status) {
    case 'draft':
      return 'gray'
    case 'sent':
      return 'blue'
    case 'viewed':
      return 'purple'
    case 'accepted':
      return 'green'
    case 'rejected':
      return 'red'
    case 'superseded':
      return 'orange'
    default:
      return 'gray'
  }
}

function getOfferStatusLabel(offer: JobOffer) {
  if (offer.revision_requested_at) return 'Revision requested'
  return offer.status.charAt(0).toUpperCase() + offer.status.slice(1)
}

export default function PrettyOffersTab({
  jobId,
  companyId,
  isActive = true,
}: {
  jobId: string
  companyId: string
  isActive?: boolean
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingOfferId, setEditingOfferId] = React.useState<string | null>(
    null,
  )

  const { data: offers = [], isLoading } = useQuery({
    ...jobPrettyOffersQuery(jobId),
    enabled: isActive,
  })

  const createMutation = useMutation({
    mutationFn: () => createEmptyDraftPrettyOffer({ jobId, companyId }),
    onSuccess: (newOfferId) => {
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      setEditingOfferId(newOfferId)
      setEditorOpen(true)
      success('Offer created', 'Add modules and save your proposal.')
    },
    onError: (err: Error) => {
      toastError('Failed to create offer', err.message)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: duplicateOffer,
    onSuccess: (newOfferId) => {
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      setEditingOfferId(newOfferId)
      setEditorOpen(true)
      success('Offer duplicated', 'A new draft version was created.')
    },
    onError: (err: Error) => {
      toastError('Duplicate failed', err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      success('Offer deleted', 'The offer was removed.')
    },
    onError: (err: Error) => {
      toastError('Delete failed', err.message)
    },
  })

  const lockMutation = useMutation({
    mutationFn: lockOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      success('Offer locked', 'The offer is ready to send.')
    },
    onError: (err: Error) => {
      toastError('Lock failed', err.message)
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: exportOfferPDF,
    onSuccess: () => success('PDF exported', 'The offer has been exported.'),
    onError: (err: Error) => {
      toastError('Export failed', err.message)
    },
  })

  const getOfferLink = (offer: JobOffer) =>
    `${window.location.origin}/offer/${offer.access_token}`

  const openEditor = (offerId: string) => {
    setEditingOfferId(offerId)
    setEditorOpen(true)
  }

  if (isLoading) return <Text>Loading pretty offers…</Text>

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Flex align="center" gap="2">
          <Heading size="4">Pretty Offers</Heading>
          <PrettyOfferBetaBadge />
        </Flex>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          <Plus width={16} height={16} />
          Create pretty offer
        </Button>
      </Flex>

      {offers.length === 0 ? (
        <Text color="gray">
          No pretty offers yet. Create a modular customer proposal with
          subcontractor quotes and rich media.
        </Text>
      ) : (
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Offer</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {offers.map((offer) => (
              <Table.Row key={offer.id}>
                <Table.Cell>
                  <Text weight="medium">{offer.title}</Text>
                  <Text size="1" color="gray" as="div">
                    {formatOfferNumberDisplay(offer.offernr) ?? '—'}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge color={getOfferStatusBadgeColor(offer)}>
                    {getOfferStatusLabel(offer)}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  {offer.total_with_vat.toLocaleString('nb-NO', {
                    style: 'currency',
                    currency: 'NOK',
                    maximumFractionDigits: 0,
                  })}
                </Table.Cell>
                <Table.Cell>
                  <Flex gap="1" align="center">
                    <Tooltip content="Edit">
                      <IconButton
                        size="1"
                        variant="ghost"
                        onClick={() => openEditor(offer.id)}
                      >
                        {offer.locked ? (
                          <Eye width={16} height={16} />
                        ) : (
                          <Edit width={16} height={16} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Copy public link">
                      <CopyIconButton
                        text={getOfferLink(offer)}
                        copyLabel="Copy offer link"
                      />
                    </Tooltip>
                    <Tooltip content="Open public page">
                      <IconButton
                        size="1"
                        variant="ghost"
                        onClick={() =>
                          window.open(getOfferLink(offer), '_blank')
                        }
                      >
                        <Link width={16} height={16} />
                      </IconButton>
                    </Tooltip>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger>
                        <Button size="1" variant="ghost">
                          More
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        {!offer.locked && offer.status === 'draft' && (
                          <DropdownMenu.Item
                            onClick={() => lockMutation.mutate(offer.id)}
                          >
                            <Lock width={14} height={14} />
                            Lock & send
                          </DropdownMenu.Item>
                        )}
                        <DropdownMenu.Item
                          onClick={() => duplicateMutation.mutate(offer.id)}
                        >
                          <Copy width={14} height={14} />
                          Duplicate
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onClick={() => exportPdfMutation.mutate(offer.id)}
                        >
                          <Download width={14} height={14} />
                          Export PDF
                        </DropdownMenu.Item>
                        {offer.status === 'draft' && !offer.locked && (
                          <DropdownMenu.Item
                            color="red"
                            onClick={() => deleteMutation.mutate(offer.id)}
                          >
                            <Trash width={14} height={14} />
                            Delete
                          </DropdownMenu.Item>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </Flex>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}

      {editorOpen && (
        <PrettyOfferEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={(id) => {
            setEditingOfferId(id)
            qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
          }}
        />
      )}
    </Box>
  )
}
