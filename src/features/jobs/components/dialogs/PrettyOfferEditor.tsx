// src/features/jobs/components/dialogs/PrettyOfferEditor.tsx
import * as React from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  IconButton,
  Separator,
  Tabs,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Download, Eye, Lock, NavArrowDown, NavArrowRight } from 'iconoir-react'
import { companyExpansionQuery } from '@features/company/api/queries'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import { PrettyOfferBetaBadge } from '../PrettyOfferBetaBadge'
import {
  exportOfferPDF,
  lockOffer,
  offerDetailQuery,
} from '../../api/offerQueries'
import {
  createEmptyDraftPrettyOffer,
  jobSubcontractorQuotesQuery,
  prettyOfferDetailQuery,
  savePrettyOffer,
} from '../../api/prettyOfferQueries'
import {
  jobOfferBasesQuery,
  offerBasisDetailQuery,
} from '../../api/offerBasisQueries'
import { canEditOffer, canLockOffer } from '../../utils/offerValidation'
import {
  getPrettyOfferModuleCompletionStats,
  resolveSubcontractorMarkupPercent,
  validatePrettyOfferModules,
} from '../../utils/prettyOfferCalculations'
import { useOfferEditorAutosave } from '../../hooks/useOfferEditorAutosave'
import { ModulesSection } from './pretty-offer-editor/ModulesSection'
import { PreviewSection } from './pretty-offer-editor/PreviewSection'
import { AppearanceSection } from './pretty-offer-editor/AppearanceSection'
import { PricingBasisSection } from './pretty-offer-editor/PricingBasisSection'
import { TotalsSection } from './pretty-offer-editor/TotalsSection'
import { PrettyOfferCompletionIndicator } from './pretty-offer-editor/PrettyOfferCompletionIndicator'
import { SubcontractorMarkupField } from './pretty-offer-editor/SubcontractorMarkupField'
import {
  OFFER_EDITOR_DIALOG_CLASS,
  offerEditorDialogContentStyle,
} from './offerEditorDialogStyles'
import { UnsavedChangesCloseGuard } from './UnsavedChangesCloseGuard'
import type { RentalFactorConfig } from '../../utils/offerCalculations'
import type {
  OfferBasisDetail,
  OfferDetail,
  PrettyOfferDetail,
} from '../../types'
import type {
  LocalPrettyModule,
  LocalPricingBasis,
} from './pretty-offer-editor/types'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: string
  companyId: string
  offerId?: string | null
  offerBasisId?: string
  onSaved?: (offerId: string) => void
}

function toLocalModules(
  modules: PrettyOfferDetail['modules'],
): Array<LocalPrettyModule> {
  return (modules ?? []).map((module) => ({
    ...module,
    module_type: module.module_type ?? 'standard',
    content_blocks: (module.content_blocks ?? []).map((block) => ({
      ...block,
      items: block.items ?? [],
    })),
    timeline_items: module.timeline_items ?? [],
  }))
}

function toLocalPricingBases(
  bases: PrettyOfferDetail['pricing_bases'],
): Array<LocalPricingBasis> {
  return (bases ?? []).map((basis) => ({
    ...basis,
    apply_subcontractor_markup: basis.apply_subcontractor_markup ?? true,
    splits: (basis.splits ?? []).map((split) => ({ ...split })),
  }))
}

function serializePrettyOfferEditorState(state: {
  title: string
  prettyIntroText: string
  prettySubcontractorMarkupPercent: number | null
  showPricePerLine: boolean
  prettyUseCustomerBrandColors: boolean
  modules: Array<LocalPrettyModule>
  pricingBases: Array<LocalPricingBasis>
}) {
  return JSON.stringify({
    title: state.title.trim(),
    prettyIntroText: state.prettyIntroText.trim(),
    prettySubcontractorMarkupPercent: state.prettySubcontractorMarkupPercent,
    showPricePerLine: state.showPricePerLine,
    prettyUseCustomerBrandColors: state.prettyUseCustomerBrandColors,
    modules: state.modules,
    pricingBases: state.pricingBases,
  })
}

export default function PrettyOfferEditor({
  open,
  onOpenChange,
  jobId,
  companyId,
  offerId,
  offerBasisId,
  onSaved,
}: Props) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [activeOfferId, setActiveOfferId] = React.useState<string | null>(
    offerId ?? null,
  )
  const [title, setTitle] = React.useState('')
  const [prettyIntroText, setPrettyIntroText] = React.useState('')
  const [
    prettySubcontractorMarkupPercent,
    setPrettySubcontractorMarkupPercent,
  ] = React.useState<number | null>(null)
  const [showPricePerLine, setShowPricePerLine] = React.useState(false)
  const [modules, setModules] = React.useState<Array<LocalPrettyModule>>([])
  const [pricingBases, setPricingBases] = React.useState<
    Array<LocalPricingBasis>
  >([])
  const [selectedModuleId, setSelectedModuleId] = React.useState<string | null>(
    null,
  )
  const [activeTab, setActiveTab] = React.useState('modules')
  const [prettyUseCustomerBrandColors, setPrettyUseCustomerBrandColors] =
    React.useState(false)
  const [closeGuardOpen, setCloseGuardOpen] = React.useState(false)
  const closeGuardActionRef = React.useRef(false)
  const [offerMetadataExpanded, setOfferMetadataExpanded] = React.useState(true)
  const [baselineSerialized, setBaselineSerialized] = React.useState<
    string | null
  >(null)
  const initializedOfferIdRef = React.useRef<string | null>(null)
  const editorFormRef = React.useRef({
    title: '',
    prettyIntroText: '',
    prettySubcontractorMarkupPercent: null as number | null,
    showPricePerLine: false,
    prettyUseCustomerBrandColors: false,
    modules: [] as Array<LocalPrettyModule>,
    pricingBases: [] as Array<LocalPricingBasis>,
  })

  editorFormRef.current = {
    title,
    prettyIntroText,
    prettySubcontractorMarkupPercent,
    showPricePerLine,
    prettyUseCustomerBrandColors,
    modules,
    pricingBases,
  }

  React.useEffect(() => {
    if (offerId) setActiveOfferId(offerId)
  }, [offerId])

  React.useEffect(() => {
    if (!open) {
      setBaselineSerialized(null)
      setCloseGuardOpen(false)
      setOfferMetadataExpanded(true)
      initializedOfferIdRef.current = null
    }
  }, [open])

  const { data: offer, isLoading } = useQuery({
    ...prettyOfferDetailQuery(activeOfferId ?? ''),
    enabled: open && !!activeOfferId,
  })

  const linkedBasisId = offer?.offer_basis_id ?? offerBasisId ?? null
  const { data: linkedBasisDetail } = useQuery({
    ...offerBasisDetailQuery(linkedBasisId ?? ''),
    enabled: open && !!linkedBasisId,
  })

  const basisPricing = React.useMemo(
    () => ({
      daysOfUse: linkedBasisDetail?.days_of_use ?? 1,
      vatPercent: linkedBasisDetail?.vat_percent ?? 25,
    }),
    [linkedBasisDetail],
  )

  const { data: offerBasesRows = [] } = useQuery({
    ...jobOfferBasesQuery(jobId),
    enabled: open,
  })

  const offerBases = React.useMemo(
    () => offerBasesRows.map(({ offers: _o, ...basis }) => basis),
    [offerBasesRows],
  )

  const { data: jobQuotes = [] } = useQuery({
    ...jobSubcontractorQuotesQuery({ jobId }),
    enabled: open,
  })

  const offerBasisIds = React.useMemo(
    () => [
      ...new Set(
        pricingBases
          .map((b) => b.source_offer_basis_id)
          .filter((id): id is string => !!id),
      ),
    ],
    [pricingBases],
  )

  const offerBasisResults = useQueries({
    queries: offerBasisIds.map((id) => ({
      ...offerBasisDetailQuery(id),
      enabled: open && !!id,
    })),
  })

  const offerBasesById = React.useMemo(() => {
    const map = new Map<string, OfferBasisDetail>()
    offerBasisIds.forEach((id, index) => {
      const data = offerBasisResults[index]?.data
      if (data) map.set(id, data)
    })
    if (linkedBasisId && linkedBasisDetail) {
      map.set(linkedBasisId, linkedBasisDetail)
    }
    return map
  }, [offerBasisIds, offerBasisResults, linkedBasisId, linkedBasisDetail])

  const technicalOfferIds = React.useMemo(
    () => [
      ...new Set(
        pricingBases
          .map((b) => b.source_technical_offer_id)
          .filter((id): id is string => !!id),
      ),
    ],
    [pricingBases],
  )

  const technicalOfferResults = useQueries({
    queries: technicalOfferIds.map((id) => ({
      ...offerDetailQuery(id),
      enabled: open && !!id,
    })),
  })

  const technicalOffersById = React.useMemo(() => {
    const map = new Map<string, OfferDetail>()
    technicalOfferIds.forEach((id, index) => {
      const data = technicalOfferResults[index]?.data
      if (data) map.set(id, data)
    })
    return map
  }, [technicalOfferIds, technicalOfferResults])

  const jobQuotesById = React.useMemo(
    () => new Map(jobQuotes.map((q) => [q.id, q])),
    [jobQuotes],
  )

  const { data: companyExpansion } = useQuery({
    ...companyExpansionQuery({ companyId }),
    enabled: open && !!companyId,
  })

  React.useEffect(() => {
    if (!open || !offer || !activeOfferId) return
    if (initializedOfferIdRef.current === activeOfferId) return
    initializedOfferIdRef.current = activeOfferId

    const localModules = toLocalModules(offer.modules)
    const localPricingBases = toLocalPricingBases(offer.pricing_bases)
    const useCustomerBrandColors = Boolean(
      offer.pretty_use_customer_accent || offer.pretty_use_customer_background,
    )

    setTitle(offer.title)
    setPrettyIntroText(offer.pretty_intro_text ?? '')
    setPrettySubcontractorMarkupPercent(
      offer.pretty_subcontractor_markup_percent ?? null,
    )
    setShowPricePerLine(offer.show_price_per_line)
    setPrettyUseCustomerBrandColors(useCustomerBrandColors)
    setModules(localModules)
    setPricingBases(localPricingBases)
    setBaselineSerialized(
      serializePrettyOfferEditorState({
        title: offer.title,
        prettyIntroText: offer.pretty_intro_text ?? '',
        prettySubcontractorMarkupPercent:
          offer.pretty_subcontractor_markup_percent ?? null,
        showPricePerLine: offer.show_price_per_line,
        prettyUseCustomerBrandColors: useCustomerBrandColors,
        modules: localModules,
        pricingBases: localPricingBases,
      }),
    )
  }, [open, offer, activeOfferId])

  const readOnly = offer ? !canEditOffer(offer) : false
  const canLock = offer ? canLockOffer(offer) : false
  const moduleValidationIssues = React.useMemo(
    () => validatePrettyOfferModules(modules),
    [modules],
  )
  const moduleCompletionStats = React.useMemo(
    () => getPrettyOfferModuleCompletionStats(modules),
    [modules],
  )
  const modulesReadyToLock = moduleValidationIssues.length === 0

  const expansionContext = {
    rentalFactorConfig: (companyExpansion?.rental_factor_config ??
      null) as RentalFactorConfig | null,
    vehicleDistanceRate: companyExpansion?.vehicle_distance_rate ?? null,
    vehicleDistanceIncrement:
      companyExpansion?.vehicle_distance_increment ?? null,
    vehicleDailyRate: companyExpansion?.vehicle_daily_rate ?? null,
  }

  const subcontractorMarkupPercent = resolveSubcontractorMarkupPercent(
    prettySubcontractorMarkupPercent,
    companyExpansion?.subcontractor_markup_percent,
  )

  const splitCalculationOptions = React.useMemo(
    () => ({
      technicalOffersById,
      offerBasesById,
      jobQuotesById,
      technicalContext: {
        ...expansionContext,
        daysOfUse: basisPricing.daysOfUse,
      },
      subcontractorMarkupPercent,
    }),
    [
      technicalOffersById,
      offerBasesById,
      jobQuotesById,
      expansionContext,
      basisPricing.daysOfUse,
      subcontractorMarkupPercent,
    ],
  )

  const createMutation = useMutation({
    mutationFn: () =>
      createEmptyDraftPrettyOffer({ jobId, companyId, offerBasisId }),
    onSuccess: (newOfferId) => {
      setActiveOfferId(newOfferId)
      onSaved?.(newOfferId)
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      qc.invalidateQueries({ queryKey: ['job-offer-bases', jobId] })
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

  const persistOffer = async () => {
    if (!activeOfferId) throw new Error('No offer to save')

    const offersById = new Map(technicalOffersById)
    for (const id of technicalOfferIds) {
      if (offersById.has(id)) continue
      const detail = await (
        offerDetailQuery(id).queryFn as () => Promise<OfferDetail | null>
      )()
      if (detail) offersById.set(id, detail)
    }

    await savePrettyOffer({
      offerId: activeOfferId,
      jobId,
      title,
      prettyIntroText,
      prettySubcontractorMarkupPercent,
      showPricePerLine,
      prettyUseCustomerBrandColors,
      modules,
      pricingBases,
      technicalOffersById: offersById,
      offerBasesById,
      ...expansionContext,
      companySubcontractorMarkupPercent:
        companyExpansion?.subcontractor_markup_percent ?? null,
    })
  }

  const hasUnsavedChanges = React.useCallback(() => {
    if (!open || readOnly) return false
    if (baselineSerialized === null) return false
    const current = editorFormRef.current
    return (
      serializePrettyOfferEditorState({
        title: current.title,
        prettyIntroText: current.prettyIntroText,
        prettySubcontractorMarkupPercent:
          current.prettySubcontractorMarkupPercent,
        showPricePerLine: current.showPricePerLine,
        prettyUseCustomerBrandColors: current.prettyUseCustomerBrandColors,
        modules: current.modules,
        pricingBases: current.pricingBases,
      }) !== baselineSerialized
    )
  }, [
    open,
    readOnly,
    baselineSerialized,
    title,
    prettyIntroText,
    showPricePerLine,
    prettyUseCustomerBrandColors,
    modules,
    pricingBases,
  ])

  const isDirty = hasUnsavedChanges()

  React.useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const saveMutation = useMutation({
    mutationFn: async (payload?: {
      closeAfterSave?: boolean
      autosave?: boolean
    }) => {
      await persistOffer()
      return {
        closeAfterSave: payload?.closeAfterSave === true,
        autosave: payload?.autosave === true,
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['pretty-offer-detail', activeOfferId] })
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      qc.invalidateQueries({ queryKey: ['job-offer-bases', jobId] })
      const current = editorFormRef.current
      setBaselineSerialized(
        serializePrettyOfferEditorState({
          title: current.title,
          prettyIntroText: current.prettyIntroText,
          prettySubcontractorMarkupPercent:
            current.prettySubcontractorMarkupPercent,
          showPricePerLine: current.showPricePerLine,
          prettyUseCustomerBrandColors: current.prettyUseCustomerBrandColors,
          modules: current.modules,
          pricingBases: current.pricingBases,
        }),
      )
      if (!result.autosave) {
        success('Saved', 'Pretty offer saved.')
      }
      onSaved?.(activeOfferId!)
      if (result.closeAfterSave) {
        onOpenChange(false)
      }
    },
    onError: (err: Error) => {
      toastError('Save failed', err.message)
    },
  })

  useOfferEditorAutosave({
    enabled: open && !readOnly && !isLoading && !!activeOfferId,
    hasUnsavedChanges,
    isSaving: saveMutation.isPending,
    canSave: () => !!activeOfferId,
    save: () => saveMutation.mutate({ autosave: true }),
  })

  const lockMutation = useMutation({
    mutationFn: async () => {
      if (!activeOfferId || !offer) throw new Error('No offer')
      const issues = validatePrettyOfferModules(modules)
      if (issues.length > 0) {
        throw new Error(issues[0].message)
      }
      await persistOffer()
      await lockOffer(activeOfferId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pretty-offer-detail', activeOfferId] })
      qc.invalidateQueries({ queryKey: ['job-pretty-offers', jobId] })
      qc.invalidateQueries({ queryKey: ['job-offer-bases', jobId] })
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      onSaved?.(activeOfferId!)
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

  const handleOfferDialogOpenChange = (next: boolean) => {
    if (next) return
    if (closeGuardOpen) return
    if (!readOnly && hasUnsavedChanges()) {
      setCloseGuardOpen(true)
      return
    }
    onOpenChange(false)
  }

  const saveFromCloseGuardAndExit = async () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    closeGuardActionRef.current = true
    try {
      await saveMutation.mutateAsync({ closeAfterSave: true })
      setCloseGuardOpen(false)
    } catch {
      // mutation shows error
    } finally {
      closeGuardActionRef.current = false
    }
  }

  const discardFromCloseGuard = () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    setCloseGuardOpen(false)
    onOpenChange(false)
  }

  const keepEditingFromCloseGuard = () => {
    if (closeGuardActionRef.current || saveMutation.isPending) return
    setCloseGuardOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOfferDialogOpenChange}>
      <Dialog.Content
        align="center"
        maxWidth="1280px"
        className={OFFER_EDITOR_DIALOG_CLASS}
        style={offerEditorDialogContentStyle}
        onPointerDownOutside={(event) => {
          if (closeGuardOpen) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (closeGuardOpen) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (closeGuardOpen) {
            event.preventDefault()
            return
          }
          if (!readOnly && hasUnsavedChanges()) {
            event.preventDefault()
            setCloseGuardOpen(true)
          }
        }}
      >
        <Flex
          direction="column"
          gap="3"
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <Flex align="center" gap="3" wrap="wrap">
            <Dialog.Title style={{ margin: 0, flexShrink: 0 }}>
              <Flex align="center" gap="2" as="span" display="inline-flex">
                Pretty Offer
                <PrettyOfferBetaBadge />
              </Flex>
            </Dialog.Title>
            {!readOnly && !isLoading && !createMutation.isPending && (
              <PrettyOfferCompletionIndicator stats={moduleCompletionStats} />
            )}
            <Flex gap="2" wrap="wrap" style={{ marginLeft: 'auto' }}>
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
              {canLock && (
                <Button
                  size="2"
                  onClick={() => lockMutation.mutate()}
                  disabled={lockMutation.isPending || !modulesReadyToLock}
                  title={
                    modulesReadyToLock
                      ? undefined
                      : 'Complete all module story fields before locking'
                  }
                >
                  <Lock width={16} height={16} />
                  Lock & send
                </Button>
              )}
              {!readOnly && (
                <Button
                  size="2"
                  onClick={() => {
                    if (saveMutation.isPending) return
                    saveMutation.mutate({})
                  }}
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
              <Box style={{ flexShrink: 0 }}>
                {offerMetadataExpanded ? (
                  <Flex direction="column" gap="3">
                    <Flex gap="3" wrap="wrap" align="end">
                      <Box style={{ flex: '2 1 220px', minWidth: 0 }}>
                        <Text size="2" weight="medium" mb="1" as="div">
                          Title
                        </Text>
                        <TextField.Root
                          value={title}
                          disabled={readOnly}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                      </Box>

                      <Flex
                        align="center"
                        gap="2"
                        style={{ flexShrink: 0, minHeight: 32 }}
                      >
                        <Checkbox
                          checked={showPricePerLine}
                          onCheckedChange={(checked) =>
                            setShowPricePerLine(checked === true)
                          }
                          disabled={readOnly}
                        />
                        <Text size="2" as="label" style={{ cursor: 'pointer' }}>
                          Show price per module to customer
                        </Text>
                        <IconButton
                          size="2"
                          variant="ghost"
                          color="gray"
                          style={{ flexShrink: 0 }}
                          aria-label="Collapse offer metadata"
                          aria-expanded
                          onClick={() => setOfferMetadataExpanded(false)}
                        >
                          <NavArrowDown width={18} height={18} />
                        </IconButton>
                      </Flex>
                    </Flex>

                    <Flex gap="3" align="start" wrap="wrap">
                      <Box style={{ flex: '2 1 280px', minWidth: 0 }}>
                        <Text size="2" weight="medium" mb="1" as="div">
                          Intro text
                        </Text>
                        <TextArea
                          value={prettyIntroText}
                          disabled={readOnly}
                          rows={2}
                          placeholder="Opening pitch shown under the title on the public offer"
                          onChange={(e) => setPrettyIntroText(e.target.value)}
                        />
                      </Box>
                      <SubcontractorMarkupField
                        companyMarkupPercent={
                          companyExpansion?.subcontractor_markup_percent
                        }
                        offerMarkupPercent={prettySubcontractorMarkupPercent}
                        readOnly={readOnly}
                        onChange={setPrettySubcontractorMarkupPercent}
                      />
                    </Flex>
                  </Flex>
                ) : (
                  <button
                    type="button"
                    className="pretty-offer-metadata-collapsed"
                    aria-expanded={false}
                    aria-label={`Expand offer metadata: ${title.trim() || 'Untitled offer'}`}
                    onClick={() => setOfferMetadataExpanded(true)}
                  >
                    <Text
                      size="2"
                      weight="medium"
                      truncate
                      className="pretty-offer-metadata-collapsed__title"
                    >
                      {title.trim() || 'Untitled offer'}
                    </Text>
                    <span
                      className="pretty-offer-metadata-collapsed__icon"
                      aria-hidden
                    >
                      <NavArrowRight width={18} height={18} />
                    </span>
                  </button>
                )}
              </Box>

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
                <AnimatedTabsList>
                  <Tabs.Trigger value="modules">Modules</Tabs.Trigger>
                  <Tabs.Trigger value="pricing">Pricing basis</Tabs.Trigger>
                  <Tabs.Trigger value="totals">Totals</Tabs.Trigger>
                  <Tabs.Trigger value="preview">
                    <Eye width={14} height={14} />
                    Preview
                  </Tabs.Trigger>
                </AnimatedTabsList>

                <Box
                  pt="3"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Tabs.Content
                    value="modules"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <ModulesSection
                      jobId={jobId}
                      companyId={companyId}
                      offerId={activeOfferId ?? ''}
                      modules={modules}
                      pricingBases={pricingBases}
                      offerBasisDetail={linkedBasisDetail}
                      splitCalculationOptions={splitCalculationOptions}
                      selectedModuleId={selectedModuleId}
                      readOnly={readOnly}
                      onModulesChange={setModules}
                      onSelectModule={setSelectedModuleId}
                    />
                  </Tabs.Content>
                  <Tabs.Content
                    value="pricing"
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
                  >
                    <PricingBasisSection
                      jobId={jobId}
                      daysOfUse={basisPricing.daysOfUse}
                      modules={modules}
                      pricingBases={pricingBases}
                      offerBases={offerBases}
                      linkedOfferBasisId={linkedBasisId}
                      offerBasesById={offerBasesById}
                      subcontractorMarkupPercent={subcontractorMarkupPercent}
                      readOnly={readOnly}
                      onPricingBasesChange={setPricingBases}
                    />
                  </Tabs.Content>
                  <Tabs.Content
                    value="totals"
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
                  >
                    <TotalsSection
                      modules={modules}
                      pricingBases={pricingBases}
                      technicalOffersById={technicalOffersById}
                      offerBasesById={offerBasesById}
                      jobQuotesById={jobQuotesById}
                      vatPercent={basisPricing.vatPercent}
                      daysOfUse={basisPricing.daysOfUse}
                      subcontractorMarkupPercent={subcontractorMarkupPercent}
                      {...expansionContext}
                    />
                  </Tabs.Content>
                  <Tabs.Content
                    value="preview"
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
                  >
                    <AppearanceSection
                      useCustomerBrandColors={prettyUseCustomerBrandColors}
                      hasCustomerColor={Boolean(
                        offer?.customer?.accent_color_custom ||
                          offer?.customer?.accent_color,
                      )}
                      customerName={offer?.customer?.name}
                      readOnly={readOnly}
                      onChange={setPrettyUseCustomerBrandColors}
                    />
                    <PreviewSection
                      modules={modules}
                      pricingBases={pricingBases}
                      technicalOffersById={technicalOffersById}
                      offerBasesById={offerBasesById}
                      jobQuotesById={jobQuotesById}
                      daysOfUse={basisPricing.daysOfUse}
                      vatPercent={basisPricing.vatPercent}
                      discountPercent={linkedBasisDetail?.discount_percent ?? 0}
                      subcontractorMarkupPercent={subcontractorMarkupPercent}
                      {...expansionContext}
                      offer={
                        offer
                          ? {
                              ...offer,
                              title,
                              pretty_intro_text: prettyIntroText,
                            }
                          : null
                      }
                      prettyUseCustomerBrandColors={
                        prettyUseCustomerBrandColors
                      }
                      showPricePerLine={showPricePerLine}
                    />
                  </Tabs.Content>
                </Box>
              </Tabs.Root>
            </Flex>
          )}
        </Flex>
      </Dialog.Content>

      <UnsavedChangesCloseGuard
        open={closeGuardOpen}
        isSaving={saveMutation.isPending}
        canSave={!!activeOfferId}
        onKeepEditing={keepEditingFromCloseGuard}
        onDiscard={discardFromCloseGuard}
        onSaveAndClose={() => void saveFromCloseGuardAndExit()}
      />
    </Dialog.Root>
  )
}
