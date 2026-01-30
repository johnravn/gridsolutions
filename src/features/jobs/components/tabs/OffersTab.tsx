// src/features/jobs/components/tabs/OffersTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Heading,
  RadioCards,
  Separator,
  Table,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import {
  Calendar,
  Copy,
  Download,
  Edit,
  Eye,
  Import,
  Link,
  Lock,
  Plus,
  Refresh,
  Trash,
} from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { CopyIconButton } from '@shared/lib/CopyIconButton'
import { createMatter } from '@features/matters/api/queries'
import {
  createBookingsFromOffer,
  createTechnicalOfferFromBookings,
  deleteOffer,
  duplicateOffer,
  exportOfferPDF,
  jobOffersQuery,
  lockOffer,
  syncBookingsFromOffer,
} from '../../api/offerQueries'
import TechnicalOfferEditor from '../dialogs/TechnicalOfferEditor'
import PrettyOfferEditor from '../dialogs/PrettyOfferEditor'
import type { JobOffer, OfferType } from '../../types'

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
  return offer.revision_requested_at ? 'wants revision' : offer.status
}

function getOfferTypeLabel(type: OfferType) {
  return type === 'technical' ? 'Technical' : 'Pretty'
}

function isOfferSyncedToBookings(offer: JobOffer) {
  if (!offer.bookings_synced_at) return false
  return (
    new Date(offer.bookings_synced_at).getTime() >=
    new Date(offer.updated_at).getTime()
  )
}

export default function OffersTab({
  jobId,
  companyId,
}: {
  jobId: string
  companyId: string
}) {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const [deleteOpen, setDeleteOpen] = React.useState<JobOffer | null>(null)
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingOfferId, setEditingOfferId] = React.useState<string | null>(
    null,
  )
  const [linkDialogOpen, setLinkDialogOpen] = React.useState<JobOffer | null>(
    null,
  )
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [responseDialogOpen, setResponseDialogOpen] =
    React.useState<JobOffer | null>(null)
  const [responseType, setResponseType] = React.useState<
    'accepted' | 'rejected' | 'revision'
  >('accepted')
  const [responseComment, setResponseComment] = React.useState('')
  const [revisionMessageOffer, setRevisionMessageOffer] =
    React.useState<JobOffer | null>(null)

  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()
  const invalidateBookingQueries = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
    qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
    qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
  }, [qc, jobId])

  const { data: offers = [], isLoading } = useQuery({
    ...jobOffersQuery(jobId),
  })

  const deleteOfferMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success('Offer deleted', 'The offer has been deleted.')
      setDeleteOpen(null)
    },
    onError: (err: any) => {
      toastError('Failed to delete offer', err?.message || 'Please try again.')
    },
  })

  const duplicateOfferMutation = useMutation({
    mutationFn: duplicateOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success(
        'Offer duplicated',
        'A new version of the offer has been created.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to duplicate offer',
        err?.message || 'Please try again.',
      )
    },
  })

  const lockOfferMutation = useMutation({
    mutationFn: async (offer: JobOffer) => {
      await lockOffer(offer.id)
      return offer
    },
    onSuccess: (offer) => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      // Show the link dialog with the offer (access_token is already available)
      setLinkDialogOpen(offer)
      success('Offer locked', 'The offer has been locked and sent.')
    },
    onError: (err: any) => {
      toastError('Failed to lock offer', err?.message || 'Please try again.')
    },
  })

  // Get current user ID for booking creation
  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const createBookingsMutation = useMutation({
    mutationFn: async (offerId: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      await createBookingsFromOffer(offerId, user.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      // Invalidate calendar queries to show new bookings
      qc.invalidateQueries({ queryKey: ['job-calendar', jobId] })
      qc.invalidateQueries({ queryKey: ['time-periods', jobId] })
      invalidateBookingQueries()
      success(
        'Bookings created',
        'Time periods and reservations have been created from the offer.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to create bookings',
        err?.message || 'Please try again.',
      )
    },
  })

  const syncBookingsMutation = useMutation({
    mutationFn: async (offerId: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      return await syncBookingsFromOffer(offerId, user.id)
    },
    onSuccess: (warnings) => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      qc.invalidateQueries({ queryKey: ['job-calendar', jobId] })
      qc.invalidateQueries({ queryKey: ['time-periods', jobId] })
      invalidateBookingQueries()
      success('Bookings synced', 'Bookings were synced from the offer.')
      if (warnings.length) {
        info('Booking warnings', warnings.join('\n'), 6000)
      }
    },
    onError: (err: any) => {
      toastError('Failed to sync bookings', err?.message || 'Please try again.')
    },
  })

  const setOfferResponseMutation = useMutation({
    mutationFn: async (payload: {
      offerId: string
      offerTitle: string
      responseType: 'accepted' | 'rejected' | 'revision'
      comment: string
    }) => {
      const now = new Date().toISOString()
      const comment = payload.comment.trim()
      const recordedBy = 'Project lead'

      let jobData: {
        id: string
        title: string | null
        project_lead_user_id: string | null
      } | null = null

      if (payload.responseType === 'revision') {
        const { data, error: jobError } = await supabase
          .from('jobs')
          .select('id, title, project_lead_user_id')
          .eq('id', jobId)
          .single()
        if (jobError) throw jobError
        jobData = data
        if (!jobData.project_lead_user_id) {
          throw new Error(
            'Project lead is missing. Assign a project lead to send the revision matter.',
          )
        }
      }

      const baseUpdate = {
        accepted_at: null,
        accepted_by_name: null,
        accepted_by_phone: null,
        accepted_by_email: null,
        rejected_at: null,
        rejected_by_name: null,
        rejected_by_phone: null,
        rejection_comment: null,
        revision_requested_at: null,
        revision_requested_by_name: null,
        revision_requested_by_phone: null,
        revision_comment: null,
      }

      let update: Record<string, any> = baseUpdate

      if (payload.responseType === 'accepted') {
        update = {
          ...baseUpdate,
          status: 'accepted',
          accepted_at: now,
          accepted_by_name: recordedBy,
          accepted_by_phone: null,
        }
      } else if (payload.responseType === 'rejected') {
        update = {
          ...baseUpdate,
          status: 'rejected',
          rejected_at: now,
          rejected_by_name: recordedBy,
          rejected_by_phone: null,
          rejection_comment: null,
        }
      } else {
        update = {
          ...baseUpdate,
          status: 'viewed',
          revision_requested_at: now,
          revision_requested_by_name: recordedBy,
          revision_requested_by_phone: null,
          revision_comment: comment || null,
        }
      }

      const { error } = await supabase
        .from('job_offers')
        .update(update)
        .eq('id', payload.offerId)

      if (error) throw error

      if (payload.responseType === 'revision') {
        const projectLeadId = jobData?.project_lead_user_id as string
        const jobTitle = jobData?.title?.trim() || 'Job'
        const jobLink = `${window.location.origin}/jobs?jobId=${jobId}`
        const message = comment || 'No message provided.'
        const content = [
          `Customer requested a revision on offer "${payload.offerTitle}".`,
          `Message: ${message}`,
          `Job: ${jobTitle}`,
          `Go to job: ${jobLink}`,
        ].join('\n')

        await createMatter({
          company_id: companyId,
          matter_type: 'update',
          title: `Offer revision requested: ${jobTitle}`,
          content,
          job_id: jobId,
          recipient_user_ids: [projectLeadId],
          created_as_company: true,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success('Offer response updated', 'The offer response has been set.')
      setResponseDialogOpen(null)
    },
    onError: (err: any) => {
      toastError(
        'Failed to set offer response',
        err?.message || 'Please try again.',
      )
    },
  })

  const createOfferFromBookingsMutation = useMutation({
    mutationFn: async () => {
      return await createTechnicalOfferFromBookings({ jobId, companyId })
    },
    onSuccess: (newOfferId) => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      setEditorType('technical')
      setEditingOfferId(newOfferId)
      setEditorOpen(true)
      success(
        'Offer created',
        'A technical offer was created from the current bookings.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to create offer from bookings',
        err?.message || 'Please try again.',
      )
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: exportOfferPDF,
    onSuccess: () => {
      success('PDF exported', 'The offer has been exported as PDF.')
    },
    onError: (err: any) => {
      toastError('Failed to export PDF', err?.message || 'Please try again.')
    },
  })

  const [editorType, setEditorType] = React.useState<'technical' | 'pretty'>(
    'technical',
  )

  const handleCreateTechnicalOffer = () => {
    setEditingOfferId(null)
    setEditorType('technical')
    setEditorOpen(true)
  }

  const handleCreatePrettyOffer = () => {
    setEditingOfferId(null)
    setEditorType('pretty')
    setEditorOpen(true)
  }

  const handleCreateOfferFromBookings = () => {
    createOfferFromBookingsMutation.mutate()
  }

  const handleEditOffer = (offer: JobOffer) => {
    if (offer.locked || offer.status !== 'draft') {
      toastError(
        'Cannot edit offer',
        'Only draft offers can be edited. Locked or sent offers cannot be modified.',
      )
      return
    }
    setEditingOfferId(offer.id)
    setEditorOpen(true)
  }

  const handleViewOffer = (offer: JobOffer) => {
    // Open the editor in view mode (read-only)
    setEditingOfferId(offer.id)
    setEditorOpen(true)
  }

  const handleDuplicateOffer = (offer: JobOffer) => {
    duplicateOfferMutation.mutate(offer.id)
  }

  const handleLockOffer = (offer: JobOffer) => {
    lockOfferMutation.mutate(offer)
  }

  const getOfferLink = (offer: JobOffer) => {
    return `${window.location.origin}/offer/${offer.access_token}`
  }

  const handleCopyLink = (offer: JobOffer) => {
    const link = getOfferLink(offer)
    navigator.clipboard
      .writeText(link)
      .then(() => {
        success(
          'Link copied',
          'The offer link has been copied to your clipboard.',
        )
      })
      .catch((err) => {
        toastError('Failed to copy link', err?.message || 'Please try again.')
      })
  }

  const handleCreateBookings = (offer: JobOffer) => {
    if (!user?.id) {
      toastError('Authentication required', 'Please log in to create bookings.')
      return
    }
    createBookingsMutation.mutate(offer.id)
  }

  const handleSyncBookings = (offer: JobOffer) => {
    if (!user?.id) {
      toastError('Authentication required', 'Please log in to sync bookings.')
      return
    }
    syncBookingsMutation.mutate(offer.id)
  }

  const handleExportPDF = (offer: JobOffer) => {
    exportPdfMutation.mutate(offer.id)
  }

  const openResponseDialog = (offer: JobOffer) => {
    setResponseDialogOpen(offer)
    setResponseType('accepted')
    setResponseComment('')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Box>
      <Flex mb="3" justify="between" align="center">
        <Heading size="3">Offers</Heading>
        {!isReadOnly && (
          <Flex gap="2">
            <Button
              size="2"
              variant="outline"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus width={16} height={16} /> New Offer
            </Button>
          </Flex>
        )}
      </Flex>

      {isLoading ? (
        <Text>Loading offers...</Text>
      ) : offers.length === 0 && !isReadOnly ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 100ms',
          }}
          onClick={() => setCreateDialogOpen(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
            e.currentTarget.style.background = 'var(--gray-a2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Flex direction="column" align="center" gap="2">
            <Plus width={24} height={24} />
            <Text size="2" color="gray">
              Create your first offer
            </Text>
          </Flex>
        </Box>
      ) : offers.length === 0 && isReadOnly ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="3" color="gray">
            No offers yet
          </Text>
        </Box>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <Table.Root variant="surface" style={{ minWidth: 1060 }}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Version</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Synced</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {offers.map((offer) => (
                <Table.Row key={offer.id}>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <Text>v{offer.version_number}</Text>
                      {offer.locked && (
                        <Lock width={14} height={14} color="var(--orange-9)" />
                      )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft">
                      {getOfferTypeLabel(offer.offer_type)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex direction="column" gap="1">
                      <Badge
                        radius="full"
                        color={getOfferStatusBadgeColor(offer)}
                        highContrast
                      >
                        {getOfferStatusLabel(offer)}
                      </Badge>
                      {offer.revision_requested_at && (
                        <Button
                          size="1"
                          variant="ghost"
                          onClick={() => setRevisionMessageOffer(offer)}
                        >
                          Show message
                        </Button>
                      )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge
                      variant="soft"
                      color={isOfferSyncedToBookings(offer) ? 'green' : 'gray'}
                      title={
                        offer.bookings_synced_at
                          ? `Last synced: ${formatDate(offer.bookings_synced_at)}`
                          : 'Not synced'
                      }
                    >
                      {isOfferSyncedToBookings(offer) ? 'Synced' : 'Not synced'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text weight="medium">{offer.title}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>
                      {offer.total_with_vat && offer.total_with_vat > 0
                        ? formatCurrency(offer.total_with_vat)
                        : '—'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatDate(offer.created_at)}</Text>
                  </Table.Cell>
                  <Table.Cell style={{ minWidth: 320 }}>
                    <Flex gap="2" wrap="wrap" align="center">
                      {offer.offer_type === 'technical' ? (
                        <>
                          {offer.locked ? (
                            <Button
                              size="1"
                              variant="soft"
                              onClick={() => {
                                setEditorType('technical')
                                handleViewOffer(offer)
                              }}
                            >
                              <Eye width={14} height={14} /> View
                            </Button>
                          ) : (
                            !isReadOnly && (
                              <Button
                                size="1"
                                variant="soft"
                                onClick={() => {
                                  setEditorType('technical')
                                  handleEditOffer(offer)
                                }}
                              >
                                <Edit width={14} height={14} /> Edit
                              </Button>
                            )
                          )}
                        </>
                      ) : (
                        <>
                          {offer.locked ? (
                            <Button
                              size="1"
                              variant="soft"
                              onClick={() => {
                                setEditorType('pretty')
                                handleViewOffer(offer)
                              }}
                            >
                              <Eye width={14} height={14} /> View
                            </Button>
                          ) : (
                            !isReadOnly && (
                              <Button
                                size="1"
                                variant="soft"
                                onClick={() => {
                                  setEditorType('pretty')
                                  handleEditOffer(offer)
                                }}
                              >
                                <Edit width={14} height={14} /> Edit
                              </Button>
                            )
                          )}
                        </>
                      )}
                      {offer.locked && offer.status !== 'draft' && (
                        <Button
                          size="1"
                          variant="soft"
                          onClick={() => handleCopyLink(offer)}
                          title="Copy offer link"
                        >
                          <Link width={14} height={14} /> Copy Link
                        </Button>
                      )}
                      {!isReadOnly && (
                        <>
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() => handleDuplicateOffer(offer)}
                            disabled={duplicateOfferMutation.isPending}
                          >
                            <Copy width={14} height={14} />
                            Duplicate
                          </Button>
                          {!offer.locked && (
                            <Button
                              size="1"
                              variant="soft"
                              onClick={() => handleLockOffer(offer)}
                              disabled={lockOfferMutation.isPending}
                            >
                              <Lock width={14} height={14} /> Lock & Send
                            </Button>
                          )}
                          {offer.status === 'accepted' && (
                            <Button
                              size="1"
                              variant="soft"
                              color="green"
                              onClick={() => handleCreateBookings(offer)}
                              disabled={createBookingsMutation.isPending}
                            >
                              <Calendar width={14} height={14} /> Create
                              Bookings
                            </Button>
                          )}
                          {offer.offer_type === 'technical' && (
                            <Button
                              size="1"
                              variant="soft"
                              onClick={() => handleSyncBookings(offer)}
                              disabled={syncBookingsMutation.isPending}
                            >
                              <Refresh width={14} height={14} /> Sync Bookings
                            </Button>
                          )}
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() => handleExportPDF(offer)}
                            disabled={exportPdfMutation.isPending}
                          >
                            <Download width={14} height={14} /> Export PDF
                          </Button>
                          <Button
                            size="1"
                            variant="soft"
                            onClick={() => openResponseDialog(offer)}
                          >
                            <Edit width={14} height={14} />
                            Set Response
                          </Button>
                          <Button
                            size="1"
                            variant="soft"
                            color="red"
                            onClick={() => setDeleteOpen(offer)}
                          >
                            <Trash width={14} height={14} />
                          </Button>
                        </>
                      )}
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteOpen && (
        <Dialog.Root
          open={!!deleteOpen}
          onOpenChange={(v) => !v && setDeleteOpen(null)}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Offer?</Dialog.Title>
            <Separator my="3" />
            <Text size="2">
              Are you sure you want to delete this offer? This action cannot be
              undone.
            </Text>
            <Box
              mt="3"
              p="3"
              style={{
                background: 'var(--gray-a2)',
                borderRadius: 8,
              }}
            >
              <Flex direction="column" gap="1">
                <Text size="2">
                  <strong>Title:</strong> {deleteOpen.title}
                </Text>
                <Text size="2">
                  <strong>Type:</strong>{' '}
                  {getOfferTypeLabel(deleteOpen.offer_type)}
                </Text>
                <Text size="2">
                  <strong>Status:</strong> {deleteOpen.status}
                </Text>
                <Text size="2">
                  <strong>Version:</strong> {deleteOpen.version_number}
                </Text>
              </Flex>
            </Box>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" disabled={deleteOfferMutation.isPending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                color="red"
                onClick={() => deleteOfferMutation.mutate(deleteOpen.id)}
                disabled={deleteOfferMutation.isPending}
              >
                {deleteOfferMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Create Offer Dialog */}
      {!isReadOnly && (
        <Dialog.Root
          open={createDialogOpen}
          onOpenChange={(v) => setCreateDialogOpen(v)}
        >
          <Dialog.Content maxWidth="500px">
            <Dialog.Title>Create New Offer</Dialog.Title>
            <Separator my="3" />
            <Text size="2" mb="3">
              Choose how you want to create the offer:
            </Text>
            <Flex direction="column" gap="2">
              <Box
                p="3"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCreateDialogOpen(false)
                  handleCreateTechnicalOffer()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCreateDialogOpen(false)
                    handleCreateTechnicalOffer()
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a8)'
                  e.currentTarget.style.background = 'var(--gray-a2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a6)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Flex align="center" gap="2" mb="1">
                  <Plus width={16} height={16} />
                  <Text weight="medium">Create Technical Offer</Text>
                </Flex>
                <Text size="2" color="gray">
                  Build a detailed technical offer from scratch.
                </Text>
              </Box>
              <Box
                p="3"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  cursor: createOfferFromBookingsMutation.isPending
                    ? 'not-allowed'
                    : 'pointer',
                  opacity: createOfferFromBookingsMutation.isPending ? 0.6 : 1,
                  transition: 'all 100ms',
                }}
                role="button"
                tabIndex={createOfferFromBookingsMutation.isPending ? -1 : 0}
                onClick={() => {
                  if (createOfferFromBookingsMutation.isPending) return
                  setCreateDialogOpen(false)
                  handleCreateOfferFromBookings()
                }}
                onKeyDown={(e) => {
                  if (createOfferFromBookingsMutation.isPending) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCreateDialogOpen(false)
                    handleCreateOfferFromBookings()
                  }
                }}
                onMouseEnter={(e) => {
                  if (createOfferFromBookingsMutation.isPending) return
                  e.currentTarget.style.borderColor = 'var(--gray-a8)'
                  e.currentTarget.style.background = 'var(--gray-a2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a6)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Flex align="center" gap="2" mb="1">
                  <Import width={16} height={16} />
                  <Text weight="medium">Create Offer from Bookings</Text>
                </Flex>
                <Text size="2" color="gray">
                  Creates a technical offer based on the current bookings.
                </Text>
              </Box>
              <Box
                p="3"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCreateDialogOpen(false)
                  handleCreatePrettyOffer()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCreateDialogOpen(false)
                    handleCreatePrettyOffer()
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a8)'
                  e.currentTarget.style.background = 'var(--gray-a2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a6)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Flex align="center" gap="2" mb="1">
                  <Plus width={16} height={16} />
                  <Text weight="medium">Create Pretty Offer</Text>
                </Flex>
                <Text size="2" color="gray">
                  Create a customer-friendly offer with a polished layout.
                </Text>
              </Box>
            </Flex>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Close</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Offer Link Dialog */}
      {linkDialogOpen && (
        <Dialog.Root
          open={!!linkDialogOpen}
          onOpenChange={(v) => !v && setLinkDialogOpen(null)}
        >
          <Dialog.Content maxWidth="500px">
            <Dialog.Title>Offer Link Ready</Dialog.Title>
            <Separator my="3" />
            <Text size="2" mb="3">
              The offer has been locked and is ready to share. Copy the link
              below to send it to your customer:
            </Text>
            <Flex gap="2" align="center">
              <TextField.Root
                readOnly
                value={getOfferLink(linkDialogOpen)}
                style={{ flex: 1 }}
              />
              <CopyIconButton text={getOfferLink(linkDialogOpen)} />
            </Flex>
            <Text size="1" color="gray" mt="2">
              This link allows anyone to view and accept the offer without
              logging in.
            </Text>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Close</Button>
              </Dialog.Close>
              <Button
                onClick={() => {
                  window.open(getOfferLink(linkDialogOpen), '_blank')
                }}
              >
                Open in New Tab
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Offer Editor */}
      {editorOpen && editorType === 'technical' && (
        <TechnicalOfferEditor
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) {
              setEditingOfferId(null)
            }
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
          }}
        />
      )}
      {editorOpen && editorType === 'pretty' && (
        <PrettyOfferEditor
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) {
              setEditingOfferId(null)
            }
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
          }}
        />
      )}

      {/* Set Offer Response Dialog */}
      {!isReadOnly && responseDialogOpen && (
        <Dialog.Root
          open={!!responseDialogOpen}
          onOpenChange={(open) => {
            setResponseDialogOpen(open ? responseDialogOpen : null)
            if (!open) {
              setResponseType('accepted')
              setResponseComment('')
            }
          }}
        >
          <Dialog.Content maxWidth="520px">
            <Dialog.Title>Set offer response</Dialog.Title>
            <Separator my="3" />
            <Flex direction="column" gap="3">
              <Box>
                <Text size="2" weight="medium" mb="1">
                  Response
                </Text>
                <RadioCards.Root
                  value={responseType}
                  onValueChange={(value) =>
                    setResponseType(
                      value as 'accepted' | 'rejected' | 'revision',
                    )
                  }
                >
                  <Flex gap="3" wrap="wrap">
                    <RadioCards.Item value="accepted">
                      <Text weight="medium">Accepted</Text>
                    </RadioCards.Item>
                    <RadioCards.Item value="rejected">
                      <Text weight="medium">Rejected</Text>
                    </RadioCards.Item>
                    <RadioCards.Item value="revision">
                      <Text weight="medium">Wants revision</Text>
                    </RadioCards.Item>
                  </Flex>
                </RadioCards.Root>
                <Text size="1" color="gray" mt="2">
                  Recorded by the project lead.
                </Text>
              </Box>
              {responseType === 'revision' && (
                <Box>
                  <Text size="2" weight="medium" mb="1">
                    Message to customer
                  </Text>
                  <TextArea
                    placeholder="Add the revision request message..."
                    rows={4}
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                  />
                </Box>
              )}
            </Flex>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Cancel</Button>
              </Dialog.Close>
              <Button
                onClick={() => {
                  setOfferResponseMutation.mutate({
                    offerId: responseDialogOpen.id,
                    offerTitle: responseDialogOpen.title,
                    responseType,
                    comment: responseComment,
                  })
                }}
                disabled={setOfferResponseMutation.isPending}
              >
                {setOfferResponseMutation.isPending
                  ? 'Saving...'
                  : 'Set response'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
      {revisionMessageOffer && (
        <Dialog.Root
          open={!!revisionMessageOffer}
          onOpenChange={(open) => !open && setRevisionMessageOffer(null)}
        >
          <Dialog.Content maxWidth="520px">
            <Dialog.Title>Revision request</Dialog.Title>
            <Separator my="3" />
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Signed by
              </Text>
              <Text size="2" weight="medium">
                {revisionMessageOffer.revision_requested_by_name || '—'}
              </Text>
              <Box
                mt="2"
                p="3"
                style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
              >
                <Text size="1" color="gray" mb="1">
                  Revision text
                </Text>
                <br />
                <Text size="2">
                  {revisionMessageOffer.revision_comment?.trim() ||
                    'No message provided.'}
                </Text>
              </Box>
            </Flex>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Close</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}
