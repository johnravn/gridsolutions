// src/features/jobs/pages/PublicOfferPage.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { useParams } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Download, NavArrowDown, NavArrowRight } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import LazyImage from '@shared/ui/components/LazyImage'
import { AnimatedBackground } from '@shared/ui/components/AnimatedBackground'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { prettyPhone } from '@shared/phone/phone'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  acceptOffer,
  markOfferViewed,
  publicOfferQuery,
  rejectOffer,
  requestOfferRevision,
} from '../api/offerQueries'
import {
  buildDeckGradientCss,
  resolvePrettyOfferTheme,
} from '../utils/prettyOfferTheme'
import { formatOfferNumberDisplay } from '../utils/offerNumber'
import { exportOfferAsPDF } from '../utils/offerPdfExport'
import { normalizeTransportGroups } from '../utils/transportGroups'
import PublicPrettyOfferPage from './PublicPrettyOfferPage'
import type {
  GroupContentEntry,
  OfferAcceptance,
  OfferEquipmentItem,
  OfferRejection,
  OfferRevisionRequest,
} from '../types'

const SUBTLE_ANIMATED_BACKGROUND = {
  intensity: 0.1,
  shapeType: 'circles' as const,
  speed: 0.5,
  boostLightContrast: false,
}

function readDocumentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function EquipmentItemRows({
  item,
  offerGroupId,
  showPrices,
  formatCurrency,
  expandedItemGroupKeys,
  onToggleExpanded,
  rowKeyPrefix,
}: {
  item: OfferEquipmentItem
  offerGroupId: string
  showPrices: boolean
  formatCurrency: (n: number) => string
  expandedItemGroupKeys: Set<string>
  onToggleExpanded: (key: string) => void
  rowKeyPrefix?: string
}) {
  const baseKey = rowKeyPrefix ?? `${offerGroupId}-${item.id}`
  const isCustomLine = !item.item && !item.group
  const isGroup = !!item.group
  const hasContents =
    isGroup && item.group_contents && item.group_contents.length > 0
  const isExpanded = hasContents && expandedItemGroupKeys.has(baseKey)

  return (
    <>
      <Table.Row key={item.id}>
        <Table.Cell>
          {isCustomLine ? (
            <Text color={item.custom_line_description ? undefined : 'gray'}>
              {item.custom_line_description?.trim() || 'Custom line'}
            </Text>
          ) : isGroup ? (
            <Flex align="center" gap="2">
              {hasContents ? (
                <Box
                  style={{ cursor: 'pointer' }}
                  onClick={() => onToggleExpanded(baseKey)}
                >
                  {isExpanded ? (
                    <NavArrowDown width={16} height={16} />
                  ) : (
                    <NavArrowRight width={16} height={16} />
                  )}
                </Box>
              ) : null}
              <Text color={hasContents ? undefined : 'gray'}>
                {item.group?.name ?? 'Group'} (Group)
              </Text>
            </Flex>
          ) : (
            item.item?.name || 'Unknown Item'
          )}
        </Table.Cell>
        <Table.Cell>
          {isCustomLine
            ? item.custom_line_brand?.trim() || '—'
            : (item.item?.brand?.name ?? '—')}
        </Table.Cell>
        <Table.Cell>
          {isCustomLine
            ? item.custom_line_model?.trim() || '—'
            : (item.item?.model ?? '—')}
        </Table.Cell>
        <Table.Cell style={{ textAlign: 'right' }}>{item.quantity}</Table.Cell>
        {showPrices && (
          <>
            <Table.Cell style={{ textAlign: 'right' }}>
              {formatCurrency(item.unit_price)}
            </Table.Cell>
            <Table.Cell style={{ textAlign: 'right' }}>
              {formatCurrency(item.total_price)}
            </Table.Cell>
          </>
        )}
        {!showPrices && <Table.Cell style={{ textAlign: 'right' }} />}
      </Table.Row>
      {isGroup && isExpanded && item.group_contents && (
        <GroupContentsRows
          entries={item.group_contents}
          parentQuantity={item.quantity}
          showPrices={showPrices}
          formatCurrency={formatCurrency}
          expandedItemGroupKeys={expandedItemGroupKeys}
          onToggleExpanded={onToggleExpanded}
          rowKeyPrefix={baseKey}
        />
      )}
    </>
  )
}

function GroupContentsRows({
  entries,
  parentQuantity,
  showPrices,
  formatCurrency,
  expandedItemGroupKeys,
  onToggleExpanded,
  rowKeyPrefix,
  depth = 0,
}: {
  entries: Array<GroupContentEntry>
  parentQuantity: number
  showPrices: boolean
  formatCurrency: (n: number) => string
  expandedItemGroupKeys: Set<string>
  onToggleExpanded: (key: string) => void
  rowKeyPrefix: string
  depth?: number
}) {
  const paddingLeft = 16 + depth * 16
  return (
    <>
      {entries.map((entry, index) => {
        const key = `${rowKeyPrefix}-${index}`
        if (entry.type === 'item') {
          const qty = entry.quantity * parentQuantity
          return (
            <Table.Row key={key} style={{ background: 'var(--gray-a2)' }}>
              <Table.Cell>
                <Text size="1" color="gray" style={{ paddingLeft }}>
                  {entry.name}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="1" color="gray">
                  {entry.brand_name ?? '—'}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="1" color="gray">
                  {entry.model ?? '—'}
                </Text>
              </Table.Cell>
              <Table.Cell style={{ textAlign: 'right' }}>
                <Text size="1" color="gray">
                  {qty}
                </Text>
              </Table.Cell>
              {showPrices && (
                <>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Text size="1" color="gray">
                      Included
                    </Text>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Text size="1" color="gray">
                      Included
                    </Text>
                  </Table.Cell>
                </>
              )}
              {!showPrices && <Table.Cell style={{ textAlign: 'right' }} />}
            </Table.Row>
          )
        }
        const isNestedExpanded = expandedItemGroupKeys.has(key)
        const hasNested = entry.items.length > 0
        return (
          <React.Fragment key={key}>
            <Table.Row style={{ background: 'var(--gray-a2)' }}>
              <Table.Cell>
                <Flex align="center" gap="2">
                  {hasNested ? (
                    <Box
                      style={{ cursor: 'pointer', paddingLeft }}
                      onClick={() => onToggleExpanded(key)}
                    >
                      {isNestedExpanded ? (
                        <NavArrowDown width={14} height={14} />
                      ) : (
                        <NavArrowRight width={14} height={14} />
                      )}
                    </Box>
                  ) : (
                    <Text size="1" color="gray" style={{ paddingLeft }}>
                      —
                    </Text>
                  )}
                  <Text size="1" color="gray">
                    {entry.name} (Group)
                  </Text>
                </Flex>
              </Table.Cell>
              <Table.Cell>
                <Text size="1" color="gray">
                  —
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Text size="1" color="gray">
                  —
                </Text>
              </Table.Cell>
              <Table.Cell style={{ textAlign: 'right' }}>
                <Text size="1" color="gray">
                  {entry.quantity * parentQuantity}
                </Text>
              </Table.Cell>
              {showPrices && (
                <>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Text size="1" color="gray">
                      Included
                    </Text>
                  </Table.Cell>
                  <Table.Cell style={{ textAlign: 'right' }}>
                    <Text size="1" color="gray">
                      Included
                    </Text>
                  </Table.Cell>
                </>
              )}
              {!showPrices && <Table.Cell style={{ textAlign: 'right' }} />}
            </Table.Row>
            {hasNested && isNestedExpanded && (
              <GroupContentsRows
                entries={entry.items}
                parentQuantity={parentQuantity * entry.quantity}
                showPrices={showPrices}
                formatCurrency={formatCurrency}
                expandedItemGroupKeys={expandedItemGroupKeys}
                onToggleExpanded={onToggleExpanded}
                rowKeyPrefix={key}
                depth={depth + 1}
              />
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

export default function PublicOfferPage() {
  const { accessToken } = useParams({ strict: false })
  const { success, error: toastError } = useToast()
  const qc = useQueryClient()

  // Check if HTML element has dark class (for theme detection)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(readDocumentTheme)
  React.useEffect(() => {
    const checkTheme = () => {
      const htmlEl = document.documentElement
      setTheme(htmlEl.classList.contains('dark') ? 'dark' : 'light')
    }
    checkTheme()
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  const [acceptanceForm, setAcceptanceForm] = React.useState<OfferAcceptance>({
    first_name: '',
    last_name: '',
    phone: '',
    terms_accepted: false,
  })
  const [rejectionForm, setRejectionForm] = React.useState<OfferRejection>({
    first_name: '',
    last_name: '',
    phone: '',
    comment: '',
  })
  const [revisionForm, setRevisionForm] = React.useState<OfferRevisionRequest>({
    first_name: '',
    last_name: '',
    phone: '',
    comment: '',
  })
  const [showAcceptForm, setShowAcceptForm] = React.useState(false)
  const [showRejectForm, setShowRejectForm] = React.useState(false)
  const [showRevisionForm, setShowRevisionForm] = React.useState(false)
  const responseSectionRef = React.useRef<HTMLDivElement>(null)
  const [showTermsDialog, setShowTermsDialog] = React.useState(false)
  const [expandedItemGroupKeys, setExpandedItemGroupKeys] = React.useState<
    Set<string>
  >(new Set())

  const {
    data: offer,
    isLoading,
    error,
  } = useQuery({
    ...publicOfferQuery(accessToken || ''),
    enabled: !!accessToken,
  })

  // Mark offer as viewed when loaded
  React.useEffect(() => {
    if (offer && !offer.viewed_at && accessToken) {
      markOfferViewed(accessToken).catch((err) =>
        console.error('Failed to mark offer as viewed:', err),
      )
    }
  }, [offer, accessToken])

  const acceptMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) throw new Error('Access token is required')
      return acceptOffer(accessToken, acceptanceForm)
    },
    onSuccess: () => {
      success('Offer Accepted', 'Thank you for accepting the offer!')
      // Refresh the offer to show accepted status
      qc.invalidateQueries({ queryKey: ['public-offer', accessToken] })
      setShowAcceptForm(false)
    },
    onError: (err: any) => {
      toastError('Failed to accept offer', err?.message || 'Please try again.')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) throw new Error('Access token is required')
      return rejectOffer(accessToken, rejectionForm)
    },
    onSuccess: () => {
      success('Offer Rejected', 'Your rejection has been recorded.')
      qc.invalidateQueries({ queryKey: ['public-offer', accessToken] })
      setShowRejectForm(false)
    },
    onError: (err: any) => {
      toastError('Failed to reject offer', err?.message || 'Please try again.')
    },
  })

  const revisionMutation = useMutation({
    mutationFn: () => {
      if (!accessToken) throw new Error('Access token is required')
      return requestOfferRevision(accessToken, revisionForm)
    },
    onSuccess: () => {
      success(
        'Revision Requested',
        'Your revision request has been sent. We will get back to you with an updated offer.',
      )
      qc.invalidateQueries({ queryKey: ['public-offer', accessToken] })
      setShowRevisionForm(false)
    },
    onError: (err: any) => {
      toastError(
        'Failed to request revision',
        err?.message || 'Please try again.',
      )
    },
  })

  const [downloadingPDF, setDownloadingPDF] = React.useState(false)

  // Get PDF URL for terms if exists - must be called before conditional returns
  const termsPdfUrl = React.useMemo(() => {
    if (!offer || !offer.company_terms || !offer.company_terms.pdf_path)
      return null
    const { data } = supabase.storage
      .from('company_files')
      .getPublicUrl(offer.company_terms.pdf_path)
    return data.publicUrl
  }, [offer?.company_terms?.pdf_path])

  const hasTerms = React.useMemo(
    () =>
      !!(
        offer &&
        offer.company_terms &&
        offer.company_terms.type &&
        (offer.company_terms.type === 'pdf'
          ? offer.company_terms.pdf_path
          : offer.company_terms.text)
      ),
    [offer?.company_terms],
  )

  React.useEffect(() => {
    if (!showAcceptForm && !showRejectForm && !showRevisionForm) return
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        responseSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        })
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [showAcceptForm, showRejectForm, showRevisionForm])

  const handleDownloadPDF = async () => {
    if (!offer) return
    setDownloadingPDF(true)
    try {
      await exportOfferAsPDF(offer)
      success('PDF downloaded', 'The offer has been downloaded as PDF.')
    } catch (err: any) {
      toastError('Failed to export PDF', err?.message || 'Please try again.')
    } finally {
      setDownloadingPDF(false)
    }
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
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTimeShort = (dateString: string | null) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '—'
    const time = date.toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const datePart = date.toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    return `${time}, ${datePart}`
  }

  const formatDuration = (startString: string, endString: string) => {
    const start = new Date(startString)
    const end = new Date(endString)
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end.getTime() <= start.getTime()
    )
      return '–'

    const diffMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60000)
    const totalMinutes = Math.floor(diffMinutes)
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const minutes = totalMinutes % 60

    const parts: Array<string> = []
    if (days > 0) {
      parts.push(`${days} day${days !== 1 ? 's' : ''}`)
    }
    if (hours > 0) {
      parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`)
    }
    if (minutes > 0 && days === 0) {
      parts.push(`${minutes} min`)
    }

    if (parts.length === 0) {
      return 'Less than 1 hr'
    }

    return parts.join(' ')
  }

  // Check if phone number has 8 digits (national number part)
  const has8Digits = (phone: string) => {
    if (!phone) return false
    const parsed = parsePhoneNumberFromString(phone, 'NO')
    if (!parsed) return false
    return parsed.nationalNumber.length === 8
  }

  if (isLoading) {
    return (
      <Box
        className="public-offer-page"
        p="8"
        style={{
          maxWidth: 900,
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <AnimatedBackground {...SUBTLE_ANIMATED_BACKGROUND} />
        <Card>
          <Box p="6">
            <Flex direction="column" gap="3" align="center">
              <Box style={{ width: '100%', maxWidth: 400 }}>
                <Box
                  style={{
                    width: '100%',
                    height: 6,
                    borderRadius: 3,
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'var(--gray-a4)',
                  }}
                >
                  <motion.div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background:
                        'linear-gradient(90deg, transparent, var(--accent-9), var(--accent-6), var(--accent-9), transparent)',
                      backgroundSize: '200% 100%',
                      borderRadius: 3,
                    }}
                    animate={{
                      backgroundPosition: ['-200% 0', '200% 0'],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                </Box>
              </Box>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                <Text size="3" color="gray" weight="medium">
                  Loading offer...
                </Text>
              </motion.div>
            </Flex>
          </Box>
        </Card>
      </Box>
    )
  }

  if (error || !offer) {
    return (
      <Box p="8" style={{ textAlign: 'center' }}>
        <Heading size="6" mb="2" color="red">
          Offer Not Found
        </Heading>
        <Text color="gray">
          This offer link is invalid or the offer has been removed.
        </Text>
      </Box>
    )
  }

  if (offer.offer_type === 'pretty' && (offer.modules?.length ?? 0) > 0) {
    return (
      <PublicPrettyOfferPage offer={offer} accessToken={accessToken ?? ''} />
    )
  }

  const canAccept = offer.status === 'sent'
  const isAccepted = offer.status === 'accepted'
  const isRejected = offer.status === 'rejected'
  const isSuperseded = offer.status === 'superseded'

  const prettyTheme =
    offer.offer_type === 'pretty' ? resolvePrettyOfferTheme(offer) : null
  const prettyThemeStyle = prettyTheme
    ? buildDeckGradientCss(prettyTheme)
    : undefined
  const responseActionsDisabled =
    acceptMutation.isPending ||
    rejectMutation.isPending ||
    revisionMutation.isPending

  const toggleResponseAction = (action: 'accept' | 'reject' | 'revision') => {
    setShowAcceptForm((current) => (action === 'accept' ? !current : false))
    setShowRejectForm((current) => (action === 'reject' ? !current : false))
    setShowRevisionForm((current) => (action === 'revision' ? !current : false))
  }

  return (
    <Box
      className={[
        'public-offer-page',
        prettyTheme?.useCustomerBrandColors
          ? 'pretty-deck-root pretty-deck-root--customer-brand'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      p={{ initial: '4', sm: '1' }}
      style={{
        maxWidth: 900,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
        ...(prettyThemeStyle ?? {}),
      }}
    >
      <AnimatedBackground {...SUBTLE_ANIMATED_BACKGROUND} />
      <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Card>
            <Box p={{ initial: '4', sm: '1' }}>
              <Flex
                direction={{ initial: 'column', sm: 'row' }}
                justify={{ initial: 'start', sm: 'between' }}
                align="start"
                gap={{ initial: '3', sm: '6' }}
                mb="4"
              >
                <Box>
                  <Heading size="7" mb="2">
                    {offer.title}
                  </Heading>
                  <Flex direction="column" align="start" gap="2">
                    {formatOfferNumberDisplay(offer.offernr) ? (
                      <Badge size="2" variant="soft" color="gray">
                        Offer {formatOfferNumberDisplay(offer.offernr)}
                      </Badge>
                    ) : null}
                    <Text size="3" color="gray">
                      Version {offer.version_number}
                    </Text>
                  </Flex>
                </Box>
                {offer.customer && (
                  <Flex
                    direction="column"
                    align={{ initial: 'start', sm: 'end' }}
                  >
                    {offer.customer.logo_path ? (
                      <Box
                        style={{
                          width: '100%',
                          maxWidth: 200,
                          maxHeight: 80,
                        }}
                      >
                        <LazyImage
                          src={`${
                            supabase.storage
                              .from('logos')
                              .getPublicUrl(offer.customer.logo_path).data
                              .publicUrl
                          }?v=${offer.customer.logo_path}`}
                          alt={offer.customer.name || 'Customer logo'}
                          key={`customer-logo-${offer.customer.id}-${offer.customer.logo_path}`}
                          eager
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            borderRadius: '8px',
                          }}
                        />
                      </Box>
                    ) : (
                      <Text size="3" weight="medium">
                        {offer.customer.name || 'Customer'}
                      </Text>
                    )}
                  </Flex>
                )}
              </Flex>

              {/* Job info section: two columns — start/end times, address */}
              {(offer.job_start_at ||
                offer.job_end_at ||
                offer.job_address) && (
                <Box mt="4">
                  <Flex direction="row" gap="6" wrap="wrap" align="start">
                    <Flex direction="column" gap="2" style={{ minWidth: 0 }}>
                      {offer.job_start_at && (
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray" weight="medium">
                            Start
                          </Text>
                          <Text size="2">
                            {formatDateTimeShort(offer.job_start_at)}
                          </Text>
                        </Flex>
                      )}
                      {offer.job_end_at && (
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray" weight="medium">
                            End
                          </Text>
                          <Text size="2">
                            {formatDateTimeShort(offer.job_end_at)}
                          </Text>
                        </Flex>
                      )}
                    </Flex>
                    {offer.job_address && (
                      <Flex
                        direction="column"
                        gap="1"
                        style={{ minWidth: 0, flex: 1 }}
                      >
                        <Text size="1" color="gray" weight="medium">
                          Address
                        </Text>
                        <Text
                          size="2"
                          as="div"
                          style={{
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {offer.job_address.replace(/, /g, ',\n')}
                        </Text>
                      </Flex>
                    )}
                  </Flex>
                </Box>
              )}

              <Separator my="6" />

              {/* Offer Content */}
              <Box mb="6">
                {/* Legacy pretty offer sections */}
                {offer.offer_type === 'pretty' &&
                  (!offer.modules || offer.modules.length === 0) &&
                  offer.pretty_sections &&
                  offer.pretty_sections.length > 0 && (
                    <Box mb="6">
                      {offer.pretty_sections
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((section) => (
                          <Box key={section.id} mb="6">
                            {section.section_type === 'hero' && (
                              <Box
                                p="6"
                                style={{
                                  background: 'var(--blue-a3)',
                                  borderRadius: 12,
                                  textAlign: 'center',
                                }}
                              >
                                {section.image_url && (
                                  <Box mb="4">
                                    <LazyImage
                                      src={section.image_url}
                                      alt={section.title || 'Hero image'}
                                      style={{
                                        maxWidth: '100%',
                                        borderRadius: 8,
                                        maxHeight: 400,
                                        objectFit: 'cover',
                                      }}
                                    />
                                  </Box>
                                )}
                                {section.title && (
                                  <Heading size="7" mb="3">
                                    {section.title}
                                  </Heading>
                                )}
                                {section.content && (
                                  <Text
                                    size="4"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                  >
                                    {section.content}
                                  </Text>
                                )}
                              </Box>
                            )}

                            {section.section_type === 'problem' && (
                              <Box
                                p="4"
                                style={{ background: 'var(--red-a2)' }}
                              >
                                <Heading size="5" mb="3" color="red">
                                  {section.title || 'The Problem'}
                                </Heading>
                                {section.content && (
                                  <Text
                                    size="3"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                  >
                                    {section.content}
                                  </Text>
                                )}
                                {section.image_url && (
                                  <Box mt="4">
                                    <LazyImage
                                      src={section.image_url}
                                      alt={section.title || 'Problem image'}
                                      style={{
                                        maxWidth: '100%',
                                        borderRadius: 8,
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
                            )}

                            {section.section_type === 'solution' && (
                              <Box
                                p="4"
                                style={{ background: 'var(--blue-a2)' }}
                              >
                                <Heading size="5" mb="3" color="blue">
                                  {section.title || 'Our Solution'}
                                </Heading>
                                {section.content && (
                                  <Text
                                    size="3"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                  >
                                    {section.content}
                                  </Text>
                                )}
                                {section.image_url && (
                                  <Box mt="4">
                                    <LazyImage
                                      src={section.image_url}
                                      alt={section.title || 'Solution image'}
                                      style={{
                                        maxWidth: '100%',
                                        borderRadius: 8,
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
                            )}

                            {section.section_type === 'benefits' && (
                              <Box
                                p="4"
                                style={{ background: 'var(--green-a2)' }}
                              >
                                <Heading size="5" mb="3" color="green">
                                  {section.title || 'Benefits'}
                                </Heading>
                                {section.content && (
                                  <Text
                                    size="3"
                                    style={{ whiteSpace: 'pre-wrap' }}
                                  >
                                    {section.content}
                                  </Text>
                                )}
                                {section.image_url && (
                                  <Box mt="4">
                                    <LazyImage
                                      src={section.image_url}
                                      alt={section.title || 'Benefits image'}
                                      style={{
                                        maxWidth: '100%',
                                        borderRadius: 8,
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
                            )}

                            {section.section_type === 'testimonial' && (
                              <Box
                                p="4"
                                style={{
                                  background: 'var(--gray-a2)',
                                  borderLeft: '4px solid var(--blue-9)',
                                  borderRadius: 4,
                                }}
                              >
                                {section.title && (
                                  <Heading size="4" mb="2">
                                    {section.title}
                                  </Heading>
                                )}
                                {section.content && (
                                  <Text
                                    size="3"
                                    style={{
                                      fontStyle: 'italic',
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    "{section.content}"
                                  </Text>
                                )}
                                {section.image_url && (
                                  <Box mt="4">
                                    <LazyImage
                                      src={section.image_url}
                                      alt={section.title || 'Testimonial image'}
                                      style={{
                                        maxWidth: '100%',
                                        borderRadius: 8,
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
                            )}
                          </Box>
                        ))}
                    </Box>
                  )}

                {/* Equipment Groups (for technical offers) – item groups expandable */}
                {offer.offer_type === 'technical' &&
                  offer.groups &&
                  offer.groups.length > 0 && (
                    <Box mb="6">
                      <Heading size="4" mb="4">
                        Equipment
                      </Heading>
                      {[...offer.groups]
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((group) => {
                          const showPrices = offer.show_price_per_line !== false
                          const groupTotal = group.items.reduce(
                            (sum, item) => sum + item.total_price,
                            0,
                          )
                          return (
                            <Box key={group.id} mb="4">
                              <Heading size="3" mb="3">
                                {group.group_name}
                              </Heading>
                              <Table.Root variant="surface">
                                <Table.Header>
                                  <Table.Row>
                                    <Table.ColumnHeaderCell>
                                      Item
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>
                                      Brand
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>
                                      Model
                                    </Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell
                                      style={{ textAlign: 'right' }}
                                    >
                                      Quantity
                                    </Table.ColumnHeaderCell>
                                    {showPrices && (
                                      <>
                                        <Table.ColumnHeaderCell
                                          style={{ textAlign: 'right' }}
                                        >
                                          Unit Price
                                        </Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell
                                          style={{ textAlign: 'right' }}
                                        >
                                          Total
                                        </Table.ColumnHeaderCell>
                                      </>
                                    )}
                                    {!showPrices && (
                                      <Table.ColumnHeaderCell
                                        style={{ textAlign: 'right' }}
                                      >
                                        Total
                                      </Table.ColumnHeaderCell>
                                    )}
                                  </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                  {[...group.items]
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((item) => (
                                      <EquipmentItemRows
                                        key={item.id}
                                        item={item}
                                        offerGroupId={group.id}
                                        showPrices={showPrices}
                                        formatCurrency={formatCurrency}
                                        expandedItemGroupKeys={
                                          expandedItemGroupKeys
                                        }
                                        onToggleExpanded={(key) => {
                                          setExpandedItemGroupKeys((prev) => {
                                            const next = new Set(prev)
                                            if (next.has(key)) next.delete(key)
                                            else next.add(key)
                                            return next
                                          })
                                        }}
                                      />
                                    ))}
                                  <Table.Row style={{ fontWeight: 'bold' }}>
                                    <Table.Cell colSpan={showPrices ? 5 : 4}>
                                      Total
                                    </Table.Cell>
                                    <Table.Cell style={{ textAlign: 'right' }}>
                                      {formatCurrency(groupTotal)}
                                    </Table.Cell>
                                  </Table.Row>
                                </Table.Body>
                              </Table.Root>
                            </Box>
                          )
                        })}
                    </Box>
                  )}

                {/* Crew Items (for technical offers) */}
                {offer.offer_type === 'technical' &&
                  offer.crew_items &&
                  offer.crew_items.length > 0 && (
                    <Box mb="6">
                      <Heading size="4" mb="4">
                        Crew
                      </Heading>
                      {(() => {
                        const crewItems = [...offer.crew_items].sort(
                          (a, b) => a.sort_order - b.sort_order,
                        )
                        const crewSectionTotal = crewItems.reduce(
                          (sum, item) => sum + item.total_price,
                          0,
                        )

                        return (
                          <Table.Root variant="surface">
                            <Table.Header>
                              <Table.Row>
                                <Table.ColumnHeaderCell>
                                  Role
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell
                                  style={{ textAlign: 'right' }}
                                >
                                  Count
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell>
                                  Schedule
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell
                                  style={{ textAlign: 'right' }}
                                >
                                  Duration
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell
                                  style={{ textAlign: 'right' }}
                                >
                                  Daily Rate
                                </Table.ColumnHeaderCell>
                                <Table.ColumnHeaderCell
                                  style={{ textAlign: 'right' }}
                                >
                                  Total
                                </Table.ColumnHeaderCell>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {crewItems.map((item) => (
                                <Table.Row key={item.id}>
                                  <Table.Cell>{item.role_title}</Table.Cell>
                                  <Table.Cell style={{ textAlign: 'right' }}>
                                    {item.crew_count}
                                  </Table.Cell>
                                  <Table.Cell>
                                    <Flex direction="column" gap="1">
                                      <Text>
                                        {formatDateTimeShort(item.start_date)}
                                      </Text>
                                      <Text size="1" color="gray">
                                        {formatDateTimeShort(item.end_date)}
                                      </Text>
                                    </Flex>
                                  </Table.Cell>
                                  <Table.Cell style={{ textAlign: 'right' }}>
                                    {formatDuration(
                                      item.start_date,
                                      item.end_date,
                                    )}
                                  </Table.Cell>
                                  <Table.Cell style={{ textAlign: 'right' }}>
                                    {formatCurrency(item.daily_rate)}
                                  </Table.Cell>
                                  <Table.Cell style={{ textAlign: 'right' }}>
                                    {formatCurrency(item.total_price)}
                                  </Table.Cell>
                                </Table.Row>
                              ))}
                              <Table.Row style={{ fontWeight: 'bold' }}>
                                <Table.Cell colSpan={5}>Total</Table.Cell>
                                <Table.Cell style={{ textAlign: 'right' }}>
                                  {formatCurrency(crewSectionTotal)}
                                </Table.Cell>
                              </Table.Row>
                            </Table.Body>
                          </Table.Root>
                        )
                      })()}
                    </Box>
                  )}

                {/* Transport Items (for technical offers) */}
                {offer.offer_type === 'technical' &&
                  ((offer.transport_groups &&
                    offer.transport_groups.length > 0) ||
                    (offer.transport_items &&
                      offer.transport_items.length > 0)) && (
                    <Box mb="6">
                      <Heading size="4" mb="4">
                        Transportation
                      </Heading>
                      {(() => {
                        const showPrices = offer.show_price_per_line !== false
                        const formatCategory = (
                          category:
                            | 'passenger_car_small'
                            | 'passenger_car_medium'
                            | 'passenger_car_big'
                            | 'van_small'
                            | 'van_medium'
                            | 'van_big'
                            | 'C1'
                            | 'C1E'
                            | 'C'
                            | 'CE'
                            | null,
                        ): string => {
                          if (!category) return '—'
                          const map: Record<string, string> = {
                            passenger_car_small: 'Passenger Car - Small',
                            passenger_car_medium: 'Passenger Car - Medium',
                            passenger_car_big: 'Passenger Car - Big',
                            van_small: 'Van - Small',
                            van_medium: 'Van - Medium',
                            van_big: 'Van - Big',
                            C1: 'C1',
                            C1E: 'C1E',
                            C: 'C',
                            CE: 'CE',
                          }
                          return map[category] || category
                        }

                        const groups = normalizeTransportGroups(offer)

                        const transportTotal = groups.reduce(
                          (sum, g) =>
                            sum +
                            g.items.reduce(
                              (s: number, it: any) => s + it.total_price,
                              0,
                            ),
                          0,
                        )

                        return (
                          <Flex direction="column" gap="4">
                            {groups.map((group) => {
                              const groupTotal = group.items.reduce(
                                (sum: number, it: any) => sum + it.total_price,
                                0,
                              )
                              return (
                                <Box key={group.id}>
                                  <Flex justify="between" align="center" mb="2">
                                    <Heading size="3">
                                      {group.group_name || 'Transport'}
                                    </Heading>
                                    {showPrices && (
                                      <Text weight="medium">
                                        {formatCurrency(groupTotal)}
                                      </Text>
                                    )}
                                  </Flex>
                                  <Table.Root variant="surface">
                                    <Table.Header>
                                      <Table.Row>
                                        <Table.ColumnHeaderCell>
                                          Vehicle Category
                                        </Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>
                                          Distance (km)
                                        </Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell>
                                          Start Date
                                        </Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell
                                          style={{ textAlign: 'right' }}
                                        >
                                          Days
                                        </Table.ColumnHeaderCell>
                                        <Table.ColumnHeaderCell
                                          style={{ textAlign: 'right' }}
                                        >
                                          Total
                                        </Table.ColumnHeaderCell>
                                      </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                      {group.items.map((item: any) => (
                                        <Table.Row key={item.id}>
                                          <Table.Cell>
                                            {formatCategory(
                                              item.vehicle_category,
                                            )}
                                          </Table.Cell>
                                          <Table.Cell>
                                            {item.distance_km ?? '—'}
                                          </Table.Cell>
                                          <Table.Cell>
                                            {formatDateTimeShort(
                                              item.start_date,
                                            )}
                                          </Table.Cell>
                                          <Table.Cell
                                            style={{ textAlign: 'right' }}
                                          >
                                            {(() => {
                                              const start = new Date(
                                                item.start_date,
                                              )
                                              const end = new Date(
                                                item.end_date,
                                              )
                                              if (
                                                Number.isNaN(start.getTime()) ||
                                                Number.isNaN(end.getTime()) ||
                                                end.getTime() <= start.getTime()
                                              )
                                                return '–'
                                              const days = Math.max(
                                                1,
                                                Math.ceil(
                                                  (end.getTime() -
                                                    start.getTime()) /
                                                    (1000 * 60 * 60 * 24),
                                                ),
                                              )
                                              return `${days} day${
                                                days !== 1 ? 's' : ''
                                              }`
                                            })()}
                                          </Table.Cell>
                                          {showPrices ? (
                                            <Table.Cell
                                              style={{ textAlign: 'right' }}
                                            >
                                              {formatCurrency(item.total_price)}
                                            </Table.Cell>
                                          ) : (
                                            <Table.Cell
                                              style={{ textAlign: 'right' }}
                                            />
                                          )}
                                        </Table.Row>
                                      ))}
                                    </Table.Body>
                                  </Table.Root>
                                </Box>
                              )
                            })}

                            <Flex justify="end">
                              <Text weight="bold">
                                Total: {formatCurrency(transportTotal)}
                              </Text>
                            </Flex>
                          </Flex>
                        )
                      })()}
                    </Box>
                  )}

                <Separator my="6" />

                {/* Pricing Summary */}
                <Box mb="6">
                  <Heading size="4" mb="4">
                    Pricing Summary
                  </Heading>
                  <Flex direction="column" gap="2">
                    <Flex justify="between">
                      <Text>Days of use:</Text>
                      <Text weight="medium">{offer.days_of_use}</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text>Equipment Subtotal:</Text>
                      <Text>{formatCurrency(offer.equipment_subtotal)}</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text>Crew Subtotal:</Text>
                      <Text>{formatCurrency(offer.crew_subtotal)}</Text>
                    </Flex>
                    <Flex justify="between">
                      <Text>Transport Subtotal:</Text>
                      <Text>{formatCurrency(offer.transport_subtotal)}</Text>
                    </Flex>
                    <Separator my="2" />
                    <Flex justify="between">
                      <Text>Subtotal:</Text>
                      <Text>{formatCurrency(offer.total_before_discount)}</Text>
                    </Flex>
                    {offer.discount_percent > 0 && (
                      <Flex justify="between">
                        <Text>Discount ({offer.discount_percent}%):</Text>
                        <Text color="green">
                          -
                          {formatCurrency(
                            offer.total_before_discount -
                              offer.total_after_discount,
                          )}
                        </Text>
                      </Flex>
                    )}
                    <Flex justify="between">
                      <Text>After Discount:</Text>
                      <Text weight="medium">
                        {formatCurrency(offer.total_after_discount)}
                      </Text>
                    </Flex>
                    <Flex justify="between">
                      <Text>VAT ({offer.vat_percent}%):</Text>
                      <Text>
                        {formatCurrency(
                          offer.total_with_vat - offer.total_after_discount,
                        )}
                      </Text>
                    </Flex>
                    <Separator my="2" />
                    <Flex justify="between">
                      <Text size="4" weight="bold">
                        Total:
                      </Text>
                      <Text size="4" weight="bold">
                        {formatCurrency(offer.total_with_vat)}
                      </Text>
                    </Flex>
                  </Flex>
                </Box>

                {/* Acceptance Section */}
                {isSuperseded && (
                  <Box
                    p="4"
                    style={{
                      background: 'var(--orange-a3)',
                      borderRadius: 8,
                      border: '1px solid var(--orange-a6)',
                    }}
                  >
                    <Heading size="4" mb="2" color="orange">
                      Offer Expired
                    </Heading>
                    <Text size="2" color="gray">
                      A newer version of this offer has been sent. Please refer
                      to the latest version for acceptance.
                    </Text>
                  </Box>
                )}
                {isAccepted && (
                  <Box
                    p="4"
                    style={{
                      background: 'var(--green-a3)',
                      borderRadius: 8,
                      border: '1px solid var(--green-a6)',
                    }}
                  >
                    <Heading size="4" mb="2" color="green">
                      Offer Accepted
                    </Heading>
                    <Flex direction="column" gap="2">
                      {offer.accepted_by_name && (
                        <Flex direction="column" gap="1">
                          <Text size="2" color="gray">
                            Accepted by {offer.accepted_by_name}
                          </Text>
                          {offer.accepted_by_phone && (
                            <Text size="2" color="gray">
                              {prettyPhone(offer.accepted_by_phone)}
                            </Text>
                          )}
                        </Flex>
                      )}
                      <Text size="2" color="gray">
                        Accepted on {formatDate(offer.accepted_at)}
                      </Text>
                    </Flex>
                  </Box>
                )}

                {/* Rejection Section */}
                {isRejected && (
                  <Box
                    p="4"
                    style={{
                      background: 'var(--red-a3)',
                      borderRadius: 8,
                      border: '1px solid var(--red-a6)',
                    }}
                  >
                    <Heading size="4" mb="2" color="red">
                      Offer Rejected
                    </Heading>
                    <Flex direction="column" gap="2">
                      {offer.rejected_by_name && (
                        <Flex direction="column" gap="1">
                          <Text size="2" color="gray">
                            Rejected by {offer.rejected_by_name}
                          </Text>
                          {offer.rejected_by_phone && (
                            <Text size="2" color="gray">
                              {prettyPhone(offer.rejected_by_phone)}
                            </Text>
                          )}
                        </Flex>
                      )}
                      {offer.rejection_comment && (
                        <Text size="2" color="gray">
                          Comment: {offer.rejection_comment}
                        </Text>
                      )}
                      <Text size="2" color="gray">
                        Rejected on {formatDate(offer.rejected_at)}
                      </Text>
                    </Flex>
                  </Box>
                )}

                {/* Revision Requested Section */}
                {offer.revision_requested_at && (
                  <Box
                    p="4"
                    style={{
                      background: 'var(--blue-a3)',
                      borderRadius: 8,
                      border: '1px solid var(--blue-a6)',
                    }}
                  >
                    <Heading size="4" mb="2" color="blue">
                      Revision Requested
                    </Heading>
                    <Flex direction="column" gap="2">
                      {offer.revision_requested_by_name && (
                        <Flex direction="column" gap="1">
                          <Text size="2" color="gray">
                            Requested by {offer.revision_requested_by_name}
                          </Text>
                          {offer.revision_requested_by_phone && (
                            <Text size="2" color="gray">
                              {prettyPhone(offer.revision_requested_by_phone)}
                            </Text>
                          )}
                        </Flex>
                      )}
                      {offer.revision_comment && (
                        <Text size="2" color="gray">
                          Requested changes: {offer.revision_comment}
                        </Text>
                      )}
                      <Text size="2" color="gray">
                        Requested on {formatDate(offer.revision_requested_at)}
                      </Text>
                    </Flex>
                  </Box>
                )}
              </Box>

              <Separator my="6" />

              {/* Bottom Section: Two Columns */}
              <Flex direction={{ initial: 'column', md: 'row' }} gap="6" mb="6">
                {/* Left Column: Terms link + Download Button + From/To */}
                <Flex direction="column" gap="4" style={{ flex: 1 }}>
                  {/* Terms and conditions (open without Accept Offer) */}
                  {hasTerms && (
                    <Box>
                      <Button
                        size="1"
                        variant="ghost"
                        color="gray"
                        onClick={() => setShowTermsDialog(true)}
                        style={{
                          cursor: 'pointer',
                          padding: 0,
                          height: 'auto',
                          alignSelf: 'flex-start',
                        }}
                      >
                        <Text
                          size="2"
                          color="gray"
                          style={{ textDecoration: 'underline' }}
                        >
                          View terms and conditions
                        </Text>
                      </Button>
                    </Box>
                  )}
                  {/* Download PDF Button */}
                  <Button
                    size="2"
                    variant="outline"
                    onClick={handleDownloadPDF}
                    disabled={downloadingPDF}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <Download width={16} height={16} />
                    {downloadingPDF ? 'Downloading...' : 'Download PDF'}
                  </Button>

                  {/* From/To sections side by side */}
                  <Flex direction={{ initial: 'column', md: 'row' }} gap="6">
                    {/* From Section */}
                    <Flex direction="column" gap="2">
                      <Text size="2" weight="bold" color="gray">
                        From
                      </Text>
                      {offer.company && (
                        <Flex direction="column" gap="1">
                          <Text size="2" weight="medium">
                            {offer.company.name}
                          </Text>
                          {offer.company.address &&
                            (() => {
                              const parts = offer.company.address
                                .split(',')
                                .map((s) => s.trim())
                              const addressLine = parts[0] || ''
                              const zipCode = parts[1] || ''
                              const city = parts[2] || ''
                              const country = parts[3] || ''
                              const zipAndCity =
                                [zipCode, city].filter(Boolean).join(' ') || ''

                              return (
                                <>
                                  {addressLine && (
                                    <Text size="1" color="gray">
                                      {addressLine}
                                    </Text>
                                  )}
                                  {zipAndCity && (
                                    <Text size="1" color="gray">
                                      {zipAndCity}
                                    </Text>
                                  )}
                                  {country && (
                                    <Text size="1" color="gray">
                                      {country}
                                    </Text>
                                  )}
                                </>
                              )
                            })()}
                        </Flex>
                      )}
                      {offer.project_lead && (
                        <Flex direction="column" gap="1" mt="2">
                          <Text size="2" weight="medium">
                            {offer.project_lead.display_name || 'Project Lead'}
                          </Text>
                          {offer.project_lead.phone && (
                            <Text size="1" color="gray">
                              {prettyPhone(offer.project_lead.phone)}
                            </Text>
                          )}
                        </Flex>
                      )}
                    </Flex>

                    {/* To Section */}
                    <Flex direction="column" gap="2">
                      <Text size="2" weight="bold" color="gray">
                        To
                      </Text>
                      {offer.customer && (
                        <Flex direction="column" gap="1">
                          <Text size="2" weight="medium">
                            {offer.customer.name || 'Customer'}
                          </Text>
                          {offer.customer.address &&
                            (() => {
                              const parts = offer.customer.address
                                .split(',')
                                .map((s) => s.trim())
                              const addressLine = parts[0] || ''
                              const zipCode = parts[1] || ''
                              const city = parts[2] || ''
                              const country = parts[3] || ''
                              const zipAndCity =
                                [zipCode, city].filter(Boolean).join(' ') || ''

                              return (
                                <>
                                  {addressLine && (
                                    <Text size="1" color="gray">
                                      {addressLine}
                                    </Text>
                                  )}
                                  {zipAndCity && (
                                    <Text size="1" color="gray">
                                      {zipAndCity}
                                    </Text>
                                  )}
                                  {country && (
                                    <Text size="1" color="gray">
                                      {country}
                                    </Text>
                                  )}
                                </>
                              )
                            })()}
                        </Flex>
                      )}
                      {offer.customer_contact && (
                        <Flex direction="column" gap="1" mt="2">
                          <Text size="2" weight="medium">
                            {offer.customer_contact.name || 'Contact'}
                          </Text>
                          {offer.customer_contact.phone && (
                            <Text size="1" color="gray">
                              {prettyPhone(offer.customer_contact.phone)}
                            </Text>
                          )}
                        </Flex>
                      )}
                    </Flex>
                  </Flex>
                </Flex>

                {/* Right Column: Company Logo + Action buttons */}
                <Flex
                  direction="column"
                  align="end"
                  style={{ minHeight: '100%' }}
                >
                  {/* Spacer to push logo and buttons down */}
                  <Box style={{ flex: 1 }} />

                  {/* Company Logo - Light/Dark mode (only for technical offers) */}
                  {offer.offer_type === 'technical' &&
                    (() => {
                      const logoPath =
                        theme === 'dark'
                          ? offer.company?.logo_dark_path
                          : offer.company?.logo_light_path

                      // Fallback to light logo if dark logo doesn't exist
                      const finalLogoPath =
                        logoPath ||
                        offer.company?.logo_light_path ||
                        offer.company?.logo_dark_path

                      return finalLogoPath ? (
                        <Box
                          style={{
                            maxWidth: 225,
                            maxHeight: 90,
                            marginBottom: '24px',
                          }}
                        >
                          <LazyImage
                            src={`${
                              supabase.storage
                                .from('logos')
                                .getPublicUrl(finalLogoPath).data.publicUrl
                            }?v=${finalLogoPath}`}
                            alt={offer.company?.name || 'Company logo'}
                            key={`company-logo-${offer.company?.id}-${finalLogoPath}-${theme}`}
                            eager
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                            }}
                          />
                        </Box>
                      ) : null
                    })()}
                </Flex>
              </Flex>

              {canAccept && (
                <Box ref={responseSectionRef}>
                  <Card mb="6">
                    <Box p="5">
                      <Heading size="4" mb="3">
                        Respond to this offer
                      </Heading>
                      <Flex gap="2" wrap="wrap">
                        <Button
                          size="2"
                          variant={showRejectForm ? 'solid' : 'outline'}
                          color="red"
                          onClick={() => toggleResponseAction('reject')}
                          disabled={responseActionsDisabled}
                        >
                          Reject Offer
                        </Button>
                        <Button
                          size="2"
                          variant={showRevisionForm ? 'solid' : 'outline'}
                          onClick={() => toggleResponseAction('revision')}
                          disabled={responseActionsDisabled}
                        >
                          Request Revision
                        </Button>
                        <Button
                          size="2"
                          variant={showAcceptForm ? 'solid' : 'outline'}
                          onClick={() => toggleResponseAction('accept')}
                          disabled={responseActionsDisabled}
                        >
                          Accept Offer
                        </Button>
                      </Flex>

                      {!isAccepted && showAcceptForm && (
                        <Box
                          mt="4"
                          pt="4"
                          style={{ borderTop: '1px solid var(--gray-a5)' }}
                        >
                          <Text size="2" color="gray" mb="4">
                            Please provide your contact information to accept
                            this offer.
                          </Text>
                          <Flex direction="column" gap="3">
                            <Flex gap="3" wrap="wrap">
                              <Box style={{ flex: 1, minWidth: 200 }}>
                                <Text
                                  size="2"
                                  weight="medium"
                                  mb="1"
                                  as="label"
                                >
                                  First Name *
                                </Text>
                                <TextField.Root
                                  placeholder="First name"
                                  value={acceptanceForm.first_name}
                                  onChange={(e) =>
                                    setAcceptanceForm((f) => ({
                                      ...f,
                                      first_name: e.target.value,
                                    }))
                                  }
                                />
                              </Box>
                              <Box style={{ flex: 1, minWidth: 200 }}>
                                <Text
                                  size="2"
                                  weight="medium"
                                  mb="1"
                                  as="label"
                                >
                                  Last Name *
                                </Text>
                                <TextField.Root
                                  placeholder="Last name"
                                  value={acceptanceForm.last_name}
                                  onChange={(e) =>
                                    setAcceptanceForm((f) => ({
                                      ...f,
                                      last_name: e.target.value,
                                    }))
                                  }
                                />
                              </Box>
                            </Flex>
                            <Box>
                              <Text size="2" weight="medium" mb="1" as="label">
                                Phone Number *
                              </Text>
                              <PhoneInputField
                                value={acceptanceForm.phone}
                                onChange={(val) =>
                                  setAcceptanceForm((f) => ({
                                    ...f,
                                    phone: val ?? '',
                                  }))
                                }
                                defaultCountry="NO"
                                placeholder="Enter phone number"
                              />
                            </Box>
                            {hasTerms && (
                              <Box>
                                <Flex align="start" gap="2">
                                  <Checkbox
                                    checked={acceptanceForm.terms_accepted}
                                    onCheckedChange={(checked) =>
                                      setAcceptanceForm((f) => ({
                                        ...f,
                                        terms_accepted: checked === true,
                                      }))
                                    }
                                    required
                                  />
                                  <Flex
                                    direction="column"
                                    gap="1"
                                    style={{ flex: 1 }}
                                  >
                                    <Text
                                      size="2"
                                      as="label"
                                      style={{
                                        cursor: 'pointer',
                                        lineHeight: 1.5,
                                      }}
                                    >
                                      I have read and accept the{' '}
                                      <Button
                                        size="1"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          setShowTermsDialog(true)
                                        }}
                                        style={{
                                          textDecoration: 'underline',
                                          padding: 0,
                                          height: 'auto',
                                          verticalAlign: 'baseline',
                                          display: 'inline',
                                          margin: 0,
                                        }}
                                      >
                                        terms and conditions
                                      </Button>
                                      {' *'}
                                    </Text>
                                  </Flex>
                                </Flex>
                              </Box>
                            )}
                            <Flex gap="2" mt="2">
                              <Button
                                onClick={() => acceptMutation.mutate()}
                                disabled={
                                  !acceptanceForm.first_name ||
                                  !acceptanceForm.last_name ||
                                  !acceptanceForm.phone ||
                                  (hasTerms &&
                                    !acceptanceForm.terms_accepted) ||
                                  acceptMutation.isPending
                                }
                              >
                                {acceptMutation.isPending
                                  ? 'Accepting...'
                                  : 'Accept'}
                              </Button>
                              <Button
                                variant="soft"
                                onClick={() => setShowAcceptForm(false)}
                                disabled={acceptMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </Flex>
                          </Flex>
                        </Box>
                      )}

                      {!isAccepted && !isRejected && showRejectForm && (
                        <Box
                          mt="4"
                          pt="4"
                          style={{ borderTop: '1px solid var(--gray-a5)' }}
                        >
                          <Text size="2" color="gray" mb="4">
                            Please provide your contact information and
                            optionally a comment explaining why you are
                            rejecting this offer.
                          </Text>
                          <Flex direction="column" gap="3">
                            <Flex gap="3" wrap="wrap">
                              <Box style={{ flex: 1, minWidth: 200 }}>
                                <Text
                                  size="2"
                                  weight="medium"
                                  mb="1"
                                  as="label"
                                >
                                  First Name *
                                </Text>
                                <TextField.Root
                                  placeholder="First name"
                                  value={rejectionForm.first_name}
                                  onChange={(e) =>
                                    setRejectionForm((f) => ({
                                      ...f,
                                      first_name: e.target.value,
                                    }))
                                  }
                                />
                              </Box>
                              <Box style={{ flex: 1, minWidth: 200 }}>
                                <Text
                                  size="2"
                                  weight="medium"
                                  mb="1"
                                  as="label"
                                >
                                  Last Name *
                                </Text>
                                <TextField.Root
                                  placeholder="Last name"
                                  value={rejectionForm.last_name}
                                  onChange={(e) =>
                                    setRejectionForm((f) => ({
                                      ...f,
                                      last_name: e.target.value,
                                    }))
                                  }
                                />
                              </Box>
                            </Flex>
                            <Box>
                              <Text size="2" weight="medium" mb="1" as="label">
                                Phone Number *
                              </Text>
                              <PhoneInputField
                                value={rejectionForm.phone}
                                onChange={(val) =>
                                  setRejectionForm((f) => ({
                                    ...f,
                                    phone: val ?? '',
                                  }))
                                }
                                defaultCountry="NO"
                                placeholder="Enter phone number"
                              />
                            </Box>
                            <Box>
                              <Text size="2" weight="medium" mb="1" as="label">
                                Comment
                              </Text>
                              <TextArea
                                placeholder="Please explain why you are rejecting this offer..."
                                value={rejectionForm.comment}
                                onChange={(e) =>
                                  setRejectionForm((f) => ({
                                    ...f,
                                    comment: e.target.value,
                                  }))
                                }
                                style={{ minHeight: 100 }}
                                rows={4}
                              />
                            </Box>
                            <Flex gap="2" mt="2">
                              <Button
                                onClick={() => rejectMutation.mutate()}
                                disabled={
                                  !rejectionForm.first_name ||
                                  !rejectionForm.last_name ||
                                  !has8Digits(rejectionForm.phone) ||
                                  rejectMutation.isPending
                                }
                                color="red"
                              >
                                {rejectMutation.isPending
                                  ? 'Rejecting...'
                                  : 'Reject Offer'}
                              </Button>
                              <Button
                                variant="soft"
                                onClick={() => setShowRejectForm(false)}
                                disabled={rejectMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </Flex>
                          </Flex>
                        </Box>
                      )}

                      {!isAccepted && !isRejected && showRevisionForm && (
                        <Box
                          mt="4"
                          pt="4"
                          style={{ borderTop: '1px solid var(--gray-a5)' }}
                        >
                          <Text size="2" color="gray" mb="4">
                            Please provide your contact information and describe
                            what changes you would like to see in the offer.
                          </Text>
                          <Flex direction="column" gap="3">
                            <Flex gap="3" wrap="wrap">
                              <Box style={{ flex: 1, minWidth: 200 }}>
                                <Text
                                  size="2"
                                  weight="medium"
                                  mb="1"
                                  as="label"
                                >
                                  First Name *
                                </Text>
                                <TextField.Root
                                  placeholder="First name"
                                  value={revisionForm.first_name}
                                  onChange={(e) =>
                                    setRevisionForm((f) => ({
                                      ...f,
                                      first_name: e.target.value,
                                    }))
                                  }
                                />
                              </Box>
                              <Box style={{ flex: 1, minWidth: 200 }}>
                                <Text
                                  size="2"
                                  weight="medium"
                                  mb="1"
                                  as="label"
                                >
                                  Last Name *
                                </Text>
                                <TextField.Root
                                  placeholder="Last name"
                                  value={revisionForm.last_name}
                                  onChange={(e) =>
                                    setRevisionForm((f) => ({
                                      ...f,
                                      last_name: e.target.value,
                                    }))
                                  }
                                />
                              </Box>
                            </Flex>
                            <Box>
                              <Text size="2" weight="medium" mb="1" as="label">
                                Phone Number *
                              </Text>
                              <PhoneInputField
                                value={revisionForm.phone}
                                onChange={(val) =>
                                  setRevisionForm((f) => ({
                                    ...f,
                                    phone: val ?? '',
                                  }))
                                }
                                defaultCountry="NO"
                                placeholder="Enter phone number"
                              />
                            </Box>
                            <Box>
                              <Text size="2" weight="medium" mb="1" as="label">
                                What changes would you like? *
                              </Text>
                              <TextArea
                                placeholder="Please describe what you would like changed in the offer..."
                                value={revisionForm.comment}
                                onChange={(e) =>
                                  setRevisionForm((f) => ({
                                    ...f,
                                    comment: e.target.value,
                                  }))
                                }
                                style={{ minHeight: 100 }}
                                rows={4}
                              />
                            </Box>
                            <Flex gap="2" mt="2">
                              <Button
                                onClick={() => revisionMutation.mutate()}
                                disabled={
                                  !revisionForm.first_name ||
                                  !revisionForm.last_name ||
                                  !revisionForm.phone ||
                                  !revisionForm.comment.trim() ||
                                  revisionMutation.isPending
                                }
                              >
                                {revisionMutation.isPending
                                  ? 'Sending...'
                                  : 'Ask for a New Offer'}
                              </Button>
                              <Button
                                variant="soft"
                                onClick={() => setShowRevisionForm(false)}
                                disabled={revisionMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </Flex>
                          </Flex>
                        </Box>
                      )}
                    </Box>
                  </Card>
                </Box>
              )}
            </Box>
          </Card>
        </motion.div>

      {/* Terms and Conditions Dialog */}
      {hasTerms && (
        <Dialog.Root open={showTermsDialog} onOpenChange={setShowTermsDialog}>
          <Dialog.Content maxWidth="800px" style={{ maxHeight: '80vh' }}>
            <Dialog.Title>Terms and Conditions</Dialog.Title>

            <Box
              style={{
                maxHeight: '60vh',
                overflowY: 'auto',
                marginBottom: 16,
              }}
            >
              {offer.company_terms?.type === 'pdf' && termsPdfUrl ? (
                <Flex direction="column" gap="3">
                  <Text size="2" color="gray">
                    Please review the terms and conditions PDF before accepting
                    this offer.
                  </Text>
                  <Box
                    p="4"
                    style={{
                      border: '1px solid var(--gray-a6)',
                      borderRadius: 8,
                      background: 'var(--gray-a2)',
                      textAlign: 'center',
                    }}
                  >
                    <Button
                      size="3"
                      variant="outline"
                      onClick={() => window.open(termsPdfUrl, '_blank')}
                    >
                      <Download width={16} height={16} />
                      View Terms and Conditions PDF
                    </Button>
                  </Box>
                </Flex>
              ) : offer.company_terms?.type === 'text' &&
                offer.company_terms.text ? (
                <Box
                  p="4"
                  style={{
                    border: '1px solid var(--gray-a6)',
                    borderRadius: 8,
                    background: 'var(--gray-a2)',
                  }}
                >
                  <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                    {offer.company_terms.text}
                  </Text>
                </Box>
              ) : null}
            </Box>

            <Separator my="4" />

            <Box
              p="3"
              style={{
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
                background: 'var(--gray-a2)',
              }}
            >
              <Flex align="start" gap="2">
                <Checkbox
                  checked={acceptanceForm.terms_accepted}
                  onCheckedChange={(checked) =>
                    setAcceptanceForm((f) => ({
                      ...f,
                      terms_accepted: checked === true,
                    }))
                  }
                  required
                />
                <Text
                  size="2"
                  as="label"
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  I have read and accept the terms and conditions *
                </Text>
              </Flex>
            </Box>

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
