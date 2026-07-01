// src/features/jobs/components/dialogs/PrettyOfferEditor.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  Flex,
  Select,
  Separator,
  Tabs,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Download, Eye, Lock } from 'iconoir-react'
import { PrettyOfferBetaBadge } from '../PrettyOfferBetaBadge'
import { companyExpansionQuery } from '@features/company/api/queries'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { sendOfferByEmail } from '@shared/email/supabaseEdgeEmail'
import {
  exportOfferPDF,
  lockOffer,
  offerDetailQuery,
} from '../../api/offerQueries'
import {
  createEmptyDraftPrettyOffer,
  jobTechnicalOffersQuery,
  prettyOfferDetailQuery,
  savePrettyOffer,
} from '../../api/prettyOfferQueries'
import { canEditOffer, canLockOffer } from '../../utils/offerValidation'
import { ModulesSection } from './pretty-offer-editor/ModulesSection'
import { PreviewSection } from './pretty-offer-editor/PreviewSection'
import { AppearanceSection } from './pretty-offer-editor/AppearanceSection'
import { SubcontractorSection } from './pretty-offer-editor/SubcontractorSection'
import { TechnicalBasisSection } from './pretty-offer-editor/TechnicalBasisSection'
import { TotalsSection } from './pretty-offer-editor/TotalsSection'
import type { RentalFactorConfig } from '../../utils/offerCalculations'
import type { PrettyOfferDetail } from '../../types'
import type {
  LocalPrettyModule,
  LocalSubcontractorQuote,
} from './pretty-offer-editor/types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null
  onSaved?: (offerId: string) => void
}

function toLocalModules(
  modules: PrettyOfferDetail['modules'],
): Array<LocalPrettyModule> {
  return (modules ?? []).map((module) => ({
    ...module,
    manual_fields: module.manual_fields ?? [],
    category_mappings: module.category_mappings ?? [],
    content_blocks: (module.content_blocks ?? []).map((block) => ({
      ...block,
      items: block.items ?? [],
    })),
  }))
}

function toLocalQuotes(
  quotes: PrettyOfferDetail['subcontractor_quotes'],
): Array<LocalSubcontractorQuote> {
  return (quotes ?? []).map((quote) => ({
    ...quote,
    allocations: quote.allocations ?? [],
  }))
}

export default function PrettyOfferEditor({
  open,
  onOpenChange,
  jobId,
  companyId,
  offerId,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [activeOfferId, setActiveOfferId] = React.useState<string | null>(
    offerId ?? null,
  )
  const [title, setTitle] = React.useState('')
  const [daysOfUse, setDaysOfUse] = React.useState(1)
  const [vatPercent, setVatPercent] = React.useState<0 | 25>(25)
  const [sourceTechnicalOfferId, setSourceTechnicalOfferId] = React.useState<
    string | null
  >(null)
  const [modules, setModules] = React.useState<Array<LocalPrettyModule>>([])
  const [quotes, setQuotes] = React.useState<Array<LocalSubcontractorQuote>>([])
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(
    null,
  )
  const [activeTab, setActiveTab] = React.useState('modules')
  const [prettyUseCustomerAccent, setPrettyUseCustomerAccent] =
    React.useState(false)
  const [prettyUseCustomerBackground, setPrettyUseCustomerBackground] =
    React.useState(false)

  React.useEffect(() => {
    if (offerId) setActiveOfferId(offerId)
  }, [offerId])

  const { data: offer, isLoading } = useQuery({
    ...prettyOfferDetailQuery(activeOfferId ?? ''),
    enabled: open && !!activeOfferId,
  })

  const { data: technicalOffers = [] } = useQuery({
    ...jobTechnicalOffersQuery(jobId),
    enabled: open,
  })

  const { data: sourceTechnicalOffer } = useQuery({
    ...offerDetailQuery(sourceTechnicalOfferId ?? ''),
    enabled: open && !!sourceTechnicalOfferId,
  })

  const { data: companyExpansion } = useQuery({
    ...companyExpansionQuery({ companyId }),
    enabled: open && !!companyId,
  })

  React.useEffect(() => {
    if (!offer) return
    setTitle(offer.title)
    setDaysOfUse(offer.days_of_use)
    setVatPercent(offer.vat_percent === 0 ? 0 : 25)
    setSourceTechnicalOfferId(offer.source_technical_offer_id ?? null)
    setPrettyUseCustomerAccent(offer.pretty_use_customer_accent ?? false)
    setPrettyUseCustomerBackground(
      offer.pretty_use_customer_background ?? false,
    )
    setModules(toLocalModules(offer.modules))
    setQuotes(toLocalQuotes(offer.subcontractor_quotes))
  }, [offer])

  const readOnly = offer ? !canEditOffer(offer) : false
  const canLock = offer ? canLockOffer(offer) : false

  const createMutation = useMutation({
    mutationFn: () => createEmptyDraftPrettyOffer({ jobId, companyId }),
    onSuccess: (newOfferId) => {
      setActiveOfferId(newOfferId)
      onSaved?.(newOfferId)
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
    },
    onError: (err: Error) => {
      toastError('Failed to create offer', err.message)
    },
  })

  const shouldBootstrap = open && !offerId && !activeOfferId
  React.useEffect(() => {
    if (
      shouldBootstrap &&
      !createMutation.isPending &&
      !createMutation.isSuccess
    ) {
      createMutation.mutate()
    }
  }, [shouldBootstrap, createMutation.isPending, createMutation.isSuccess])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeOfferId) throw new Error('No offer to save')
      await savePrettyOffer({
        offerId: activeOfferId,
        title,
        daysOfUse,
        vatPercent,
        sourceTechnicalOfferId,
        prettyUseCustomerAccent,
        prettyUseCustomerBackground,
        modules,
        subcontractorQuotes: quotes,
        technicalOffer: sourceTechnicalOffer ?? null,
        rentalFactorConfig: (companyExpansion?.rental_factor_config ??
          null) as RentalFactorConfig | null,
        vehicleDistanceRate: companyExpansion?.vehicle_distance_rate ?? null,
        vehicleDistanceIncrement:
          companyExpansion?.vehicle_distance_increment ?? null,
        vehicleDailyRate: companyExpansion?.vehicle_daily_rate ?? null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pretty-offer-detail', activeOfferId] })
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      success('Saved', 'Pretty offer saved.')
      onSaved?.(activeOfferId!)
    },
    onError: (err: Error) => {
      toastError('Save failed', err.message)
    },
  })

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!activeOfferId || !offer) throw new Error('No offer')
      await savePrettyOffer({
        offerId: activeOfferId,
        title,
        daysOfUse,
        vatPercent,
        sourceTechnicalOfferId,
        prettyUseCustomerAccent,
        prettyUseCustomerBackground,
        modules,
        subcontractorQuotes: quotes,
        technicalOffer: sourceTechnicalOffer ?? null,
        rentalFactorConfig: (companyExpansion?.rental_factor_config ??
          null) as RentalFactorConfig | null,
        vehicleDistanceRate: companyExpansion?.vehicle_distance_rate ?? null,
        vehicleDistanceIncrement:
          companyExpansion?.vehicle_distance_increment ?? null,
        vehicleDailyRate: companyExpansion?.vehicle_daily_rate ?? null,
      })
      await lockOffer(activeOfferId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pretty-offer-detail', activeOfferId] })
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      success('Offer locked', 'The offer is ready to send.')
    },
    onError: (err: Error) => {
      toastError('Lock failed', err.message)
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: () => exportOfferPDF(activeOfferId!),
    onSuccess: () => success('PDF exported', 'The offer PDF was downloaded.'),
    onError: (err: Error) => toastError('Export failed', err.message),
  })

  const handleSendEmail = async () => {
    if (!offer?.customer_contact?.email || !activeOfferId) {
      toastError('Missing email', 'Customer contact email is required.')
      return
    }
    try {
      await sendOfferByEmail({
        offerId: activeOfferId,
        toEmail: offer.customer_contact.email,
      })
      success('Email sent', 'Offer email sent to customer.')
    } catch (err) {
      toastError(
        'Email failed',
        err instanceof Error ? err.message : 'Please try again.',
      )
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="1100px"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '85vh',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
      >
        <Flex
          direction="column"
          gap="3"
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <Flex justify="between" align="center" gap="3" wrap="wrap">
            <Dialog.Title style={{ margin: 0 }}>
              <Flex align="center" gap="2" as="span" display="inline-flex">
                Pretty Offer
                <PrettyOfferBetaBadge />
              </Flex>
            </Dialog.Title>
            <Flex gap="2" wrap="wrap">
              {offer && (
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => exportPdfMutation.mutate()}
                >
                  <Download width={16} height={16} />
                  PDF
                </Button>
              )}
              {offer?.customer_contact?.email && !readOnly && (
                <Button
                  size="2"
                  variant="soft"
                  onClick={() => void handleSendEmail()}
                >
                  Send email
                </Button>
              )}
              {canLock && (
                <Button
                  size="2"
                  onClick={() => lockMutation.mutate()}
                  disabled={lockMutation.isPending}
                >
                  <Lock width={16} height={16} />
                  Lock & send
                </Button>
              )}
              {!readOnly && (
                <Button
                  size="2"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !activeOfferId}
                >
                  Save
                </Button>
              )}
            </Flex>
          </Flex>

          {isLoading || createMutation.isPending ? (
            <Flex align="center" justify="center" style={{ flex: 1 }}>
              <Text>Loading…</Text>
            </Flex>
          ) : (
            <Flex
              direction="column"
              gap="3"
              style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
            >
              <Flex gap="3" wrap="wrap">
                <Box style={{ flex: 2, minWidth: 220 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Title
                  </Text>
                  <TextField.Root
                    value={title}
                    disabled={readOnly}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Box>
                <Box style={{ width: 120 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Days
                  </Text>
                  <TextField.Root
                    type="number"
                    value={daysOfUse}
                    disabled={readOnly}
                    onChange={(e) =>
                      setDaysOfUse(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </Box>
                <Box style={{ width: 120 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    VAT
                  </Text>
                  <Select.Root
                    value={String(vatPercent)}
                    disabled={readOnly}
                    onValueChange={(v) => setVatPercent(v === '0' ? 0 : 25)}
                  >
                    <Select.Trigger />
                    <Select.Content style={{ zIndex: 10000 }}>
                      <Select.Item value="25">25%</Select.Item>
                      <Select.Item value="0">0%</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>
                <Box style={{ flex: 2, minWidth: 220 }}>
                  <Text size="2" weight="medium" mb="1" as="div">
                    Source technical offer
                  </Text>
                  <Select.Root
                    value={sourceTechnicalOfferId ?? 'none'}
                    disabled={readOnly}
                    onValueChange={(v) =>
                      setSourceTechnicalOfferId(v === 'none' ? null : v)
                    }
                  >
                    <Select.Trigger placeholder="None" />
                    <Select.Content style={{ zIndex: 10000 }}>
                      <Select.Item value="none">None</Select.Item>
                      {technicalOffers.map((techOffer) => (
                        <Select.Item key={techOffer.id} value={techOffer.id}>
                          v{techOffer.version_number} — {techOffer.title}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>
              </Flex>

              <Separator size="4" />

              <Tabs.Root
                value={activeTab}
                onValueChange={setActiveTab}
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Tabs.List>
                  <Tabs.Trigger value="modules">Modules</Tabs.Trigger>
                  <Tabs.Trigger value="subcontractors">
                    Subcontractors
                  </Tabs.Trigger>
                  <Tabs.Trigger value="technical">Technical basis</Tabs.Trigger>
                  <Tabs.Trigger value="totals">Totals</Tabs.Trigger>
                  <Tabs.Trigger value="preview">
                    <Eye width={14} height={14} />
                    Preview
                  </Tabs.Trigger>
                </Tabs.List>

                <Box
                  pt="3"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                  }}
                >
                  <Tabs.Content value="modules">
                    <ModulesSection
                      jobId={jobId}
                      companyId={companyId}
                      offerId={activeOfferId ?? ''}
                      modules={modules}
                      selectedModuleId={selectedModuleId}
                      readOnly={readOnly}
                      onModulesChange={setModules}
                      onSelectModule={setSelectedModuleId}
                    />
                  </Tabs.Content>
                  <Tabs.Content value="subcontractors">
                    {activeOfferId && (
                      <SubcontractorSection
                        offerId={activeOfferId}
                        companyId={companyId}
                        modules={modules}
                        quotes={quotes}
                        readOnly={readOnly}
                        onQuotesChange={setQuotes}
                      />
                    )}
                  </Tabs.Content>
                  <Tabs.Content value="technical">
                    <TechnicalBasisSection
                      modules={modules}
                      technicalOffer={sourceTechnicalOffer ?? null}
                      readOnly={readOnly}
                      onModulesChange={setModules}
                    />
                  </Tabs.Content>
                  <Tabs.Content value="totals">
                    <TotalsSection
                      modules={modules}
                      quotes={quotes}
                      technicalOffer={sourceTechnicalOffer ?? null}
                      vatPercent={vatPercent}
                      rentalFactorConfig={
                        (companyExpansion?.rental_factor_config ??
                          null) as RentalFactorConfig | null
                      }
                      vehicleDistanceRate={
                        companyExpansion?.vehicle_distance_rate ?? null
                      }
                      vehicleDistanceIncrement={
                        companyExpansion?.vehicle_distance_increment ?? null
                      }
                      vehicleDailyRate={
                        companyExpansion?.vehicle_daily_rate ?? null
                      }
                    />
                  </Tabs.Content>
                  <Tabs.Content value="preview">
                    <AppearanceSection
                      useCustomerAccent={prettyUseCustomerAccent}
                      useCustomerBackground={prettyUseCustomerBackground}
                      hasCustomerColor={Boolean(
                        offer?.customer?.accent_color_custom ||
                          offer?.customer?.accent_color,
                      )}
                      customerName={offer?.customer?.name}
                      readOnly={readOnly}
                      onChange={(updates) => {
                        if (updates.pretty_use_customer_accent !== undefined) {
                          setPrettyUseCustomerAccent(
                            updates.pretty_use_customer_accent,
                          )
                        }
                        if (
                          updates.pretty_use_customer_background !== undefined
                        ) {
                          setPrettyUseCustomerBackground(
                            updates.pretty_use_customer_background,
                          )
                        }
                      }}
                    />
                    <PreviewSection
                      modules={modules}
                      offer={offer ?? null}
                      prettyUseCustomerAccent={prettyUseCustomerAccent}
                      prettyUseCustomerBackground={prettyUseCustomerBackground}
                    />
                  </Tabs.Content>
                </Box>
              </Tabs.Root>
            </Flex>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
