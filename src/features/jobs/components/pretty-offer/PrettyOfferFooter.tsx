import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Flex,
  Heading,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes'
import { Download } from 'iconoir-react'
import { prettyPhone } from '@shared/phone/phone'
import { PhoneInputField } from '@shared/phone/PhoneInputField'
import { formatPublicOfferCurrency } from '../../hooks/usePublicOfferResponse'
import { resolveModuleCustomerPrice } from '../../utils/prettyOfferCalculations'
import { hasPrettyOfferStatusNotice } from '../../utils/prettyOfferStatusNotice'
import { PrettyOfferResourceSummary } from './PrettyOfferResourceSummary'
import { PrettyOfferStatusNotice } from './PrettyOfferStatusNotice'
import type { OfferDetail, PublicPrettyOfferModule } from '../../types'
import type { usePublicOfferResponse } from '../../hooks/usePublicOfferResponse'

type ResponseState = ReturnType<typeof usePublicOfferResponse>

type Props = {
  offer: OfferDetail
  modules: Array<PublicPrettyOfferModule>
  showPricePerLine: boolean
  preview?: boolean
  canAccept?: boolean
  response?: ResponseState | null
}

function PricingRow({
  label,
  value,
  emphasis = false,
  total = false,
  muted = false,
  valueColor,
}: {
  label: string
  value: string
  emphasis?: boolean
  total?: boolean
  muted?: boolean
  valueColor?: 'green'
}) {
  return (
    <Flex
      justify="between"
      align="baseline"
      gap="3"
      className={[
        'pretty-deck-price-row',
        emphasis ? 'pretty-deck-price-row--emphasis' : '',
        total ? 'pretty-deck-price-row--total' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text
        size={total ? '3' : '2'}
        weight={total ? 'bold' : undefined}
        color={muted ? 'gray' : undefined}
      >
        {label}
      </Text>
      <Text
        size={total ? '5' : '2'}
        weight={total || emphasis ? 'bold' : 'medium'}
        color={valueColor}
      >
        {value}
      </Text>
    </Flex>
  )
}

function PrettyOfferResponseSection({
  offer,
  canAccept,
  response,
}: Pick<Props, 'offer' | 'canAccept' | 'response'>) {
  const {
    acceptanceForm,
    setAcceptanceForm,
    rejectionForm,
    setRejectionForm,
    revisionForm,
    setRevisionForm,
    showAcceptForm,
    showRejectForm,
    showRevisionForm,
    hasTerms,
    acceptMutation,
    rejectMutation,
    revisionMutation,
    toggleResponseAction,
    responseActionsDisabled,
    has8Digits,
    setShowAcceptForm,
    setShowRejectForm,
    setShowRevisionForm,
  } = response

  const isAccepted = offer.status === 'accepted'
  const isRejected = offer.status === 'rejected'
  const showStatusNotice = hasPrettyOfferStatusNotice(offer)

  if (!canAccept && !showStatusNotice) return null

  return (
    <Box mt="5" ref={response.responseSectionRef}>
      {canAccept && (
        <>
          <Heading size="5" mb="3">
            Ready to move forward?
          </Heading>
          <Flex gap="2" wrap="wrap">
            <Button
              size="3"
              variant={showRejectForm ? 'solid' : 'soft'}
              color="red"
              onClick={() => toggleResponseAction('reject')}
              disabled={responseActionsDisabled}
            >
              Reject
            </Button>
            <Button
              size="3"
              variant={showRevisionForm ? 'solid' : 'soft'}
              onClick={() => toggleResponseAction('revision')}
              disabled={responseActionsDisabled}
            >
              Request changes
            </Button>
            <Button
              size="3"
              variant={showAcceptForm ? 'solid' : 'soft'}
              onClick={() => toggleResponseAction('accept')}
              disabled={responseActionsDisabled}
            >
              Accept offer
            </Button>
          </Flex>
        </>
      )}

      {canAccept && !isAccepted && showAcceptForm && (
        <Box mt="4" pt="4" style={{ borderTop: '1px solid var(--accent-a4)' }}>
          <Flex direction="column" gap="3">
            <Flex gap="3" wrap="wrap">
              <Box style={{ flex: 1, minWidth: 180 }}>
                <Text size="2" weight="medium" mb="1" as="label">
                  First name *
                </Text>
                <TextField.Root
                  value={acceptanceForm.first_name}
                  onChange={(e) =>
                    setAcceptanceForm((f) => ({
                      ...f,
                      first_name: e.target.value,
                    }))
                  }
                />
              </Box>
              <Box style={{ flex: 1, minWidth: 180 }}>
                <Text size="2" weight="medium" mb="1" as="label">
                  Last name *
                </Text>
                <TextField.Root
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
                Phone *
              </Text>
              <PhoneInputField
                value={acceptanceForm.phone}
                onChange={(val) =>
                  setAcceptanceForm((f) => ({ ...f, phone: val ?? '' }))
                }
                defaultCountry="NO"
              />
            </Box>
            {hasTerms && (
              <Flex align="start" gap="2">
                <Checkbox
                  checked={acceptanceForm.terms_accepted}
                  onCheckedChange={(checked) =>
                    setAcceptanceForm((f) => ({
                      ...f,
                      terms_accepted: checked === true,
                    }))
                  }
                />
                <Text size="2" as="label">
                  I accept the terms and conditions *
                </Text>
              </Flex>
            )}
            <Flex gap="2">
              <Button
                size="3"
                onClick={() => acceptMutation.mutate()}
                disabled={
                  !acceptanceForm.first_name ||
                  !acceptanceForm.last_name ||
                  !has8Digits(acceptanceForm.phone) ||
                  (hasTerms && !acceptanceForm.terms_accepted) ||
                  acceptMutation.isPending
                }
              >
                {acceptMutation.isPending ? 'Accepting…' : 'Confirm acceptance'}
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

      {canAccept && !isAccepted && showRejectForm && (
        <Box mt="4" pt="4" style={{ borderTop: '1px solid var(--accent-a4)' }}>
          <Flex direction="column" gap="3">
            <Flex gap="3" wrap="wrap">
              <Box style={{ flex: 1, minWidth: 180 }}>
                <TextField.Root
                  placeholder="First name *"
                  value={rejectionForm.first_name}
                  onChange={(e) =>
                    setRejectionForm((f) => ({
                      ...f,
                      first_name: e.target.value,
                    }))
                  }
                />
              </Box>
              <Box style={{ flex: 1, minWidth: 180 }}>
                <TextField.Root
                  placeholder="Last name *"
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
            <PhoneInputField
              value={rejectionForm.phone}
              onChange={(val) =>
                setRejectionForm((f) => ({ ...f, phone: val ?? '' }))
              }
              defaultCountry="NO"
            />
            <TextArea
              placeholder="Comment (optional)"
              value={rejectionForm.comment}
              onChange={(e) =>
                setRejectionForm((f) => ({ ...f, comment: e.target.value }))
              }
              rows={3}
            />
            <Flex gap="2">
              <Button
                color="red"
                onClick={() => rejectMutation.mutate()}
                disabled={
                  !rejectionForm.first_name ||
                  !rejectionForm.last_name ||
                  !has8Digits(rejectionForm.phone) ||
                  rejectMutation.isPending
                }
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Confirm rejection'}
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

      {canAccept && !isAccepted && !isRejected && showRevisionForm && (
        <Box mt="4" pt="4" style={{ borderTop: '1px solid var(--accent-a4)' }}>
          <Flex direction="column" gap="3">
            <Flex gap="3" wrap="wrap">
              <Box style={{ flex: 1, minWidth: 180 }}>
                <TextField.Root
                  placeholder="First name *"
                  value={revisionForm.first_name}
                  onChange={(e) =>
                    setRevisionForm((f) => ({
                      ...f,
                      first_name: e.target.value,
                    }))
                  }
                />
              </Box>
              <Box style={{ flex: 1, minWidth: 180 }}>
                <TextField.Root
                  placeholder="Last name *"
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
            <PhoneInputField
              value={revisionForm.phone}
              onChange={(val) =>
                setRevisionForm((f) => ({ ...f, phone: val ?? '' }))
              }
              defaultCountry="NO"
            />
            <TextArea
              placeholder="What would you like changed? *"
              value={revisionForm.comment}
              onChange={(e) =>
                setRevisionForm((f) => ({ ...f, comment: e.target.value }))
              }
              rows={4}
            />
            <Flex gap="2">
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
                {revisionMutation.isPending ? 'Sending…' : 'Send request'}
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

      <PrettyOfferStatusNotice offer={offer} variant="card" />
    </Box>
  )
}

export function PrettyOfferFooter(props: Props) {
  const { offer, modules, showPricePerLine } = props
  const preview = props.preview === true
  const canAccept = preview ? false : props.canAccept
  const response = preview ? null : props.response

  const pricedModules = modules
    .map((module) => ({
      module,
      price: resolveModuleCustomerPrice(module),
    }))
    .filter((entry) => entry.price != null)

  const modulePriceSum = pricedModules.reduce(
    (sum, entry) => sum + (entry.price ?? 0),
    0,
  )
  const discountAmount =
    offer.total_before_discount - offer.total_after_discount
  const vatAmount = offer.total_with_vat - offer.total_after_discount

  return (
    <Box className="pretty-deck-footer-wrap">
      <PrettyOfferResourceSummary modules={modules} />
      <Box className="pretty-deck-footer">
        <Box className="pretty-deck-footer__shape" aria-hidden />
        <Box className="pretty-deck-footer__content">
          <Flex justify="between" align="start" gap="3" wrap="wrap" mb="4">
            <Heading size="6">Investment</Heading>
            {!preview && response && (
              <Button
                size="2"
                variant="soft"
                onClick={() => void response.handleDownloadPDF()}
                disabled={response.downloadingPDF}
              >
                <Download width={16} height={16} />
                {response.downloadingPDF
                  ? 'Downloading…'
                  : 'Download offer as PDF'}
              </Button>
            )}
          </Flex>

          <Box mb="4">
            {showPricePerLine && pricedModules.length > 0 && (
              <>
                <Text size="1" weight="bold" color="gray" mb="2" as="div">
                  BY MODULE
                </Text>
                {pricedModules.map(({ module, price }) => (
                  <Box key={module.id} className="pretty-deck-module-price-row">
                    <Text size="3" weight="medium">
                      {module.title}
                    </Text>
                    <Text size="3" weight="bold">
                      {formatPublicOfferCurrency(price!)}
                    </Text>
                  </Box>
                ))}
                {pricedModules.length > 1 && (
                  <PricingRow
                    label="Sum of module prices"
                    value={formatPublicOfferCurrency(modulePriceSum)}
                    emphasis
                  />
                )}
                <Separator my="3" size="4" />
              </>
            )}

            <Text size="1" weight="bold" color="gray" mb="2" as="div">
              SUMMARY
            </Text>
            <PricingRow
              label="Days of use"
              value={String(offer.days_of_use)}
              muted
            />
            <PricingRow
              label="Subtotal"
              value={formatPublicOfferCurrency(offer.total_before_discount)}
            />
            {offer.discount_percent > 0 && (
              <>
                <PricingRow
                  label={`Discount (${offer.discount_percent}%)`}
                  value={`-${formatPublicOfferCurrency(discountAmount)}`}
                  valueColor="green"
                />
                <PricingRow
                  label="After discount"
                  value={formatPublicOfferCurrency(offer.total_after_discount)}
                  emphasis
                />
              </>
            )}
            <PricingRow
              label={`VAT (${offer.vat_percent}%)`}
              value={formatPublicOfferCurrency(vatAmount)}
            />
            <PricingRow
              label="Total incl. VAT"
              value={formatPublicOfferCurrency(offer.total_with_vat)}
              total
            />
          </Box>

          <Separator my="4" size="4" />

          <Flex direction={{ initial: 'column', md: 'row' }} gap="6">
            <Flex direction="column" gap="2" style={{ flex: 1 }}>
              <Text size="1" weight="bold" color="gray">
                FROM
              </Text>
              <Text size="3" weight="medium">
                {offer.company?.name}
              </Text>
              {offer.project_lead?.display_name && (
                <Text size="2" color="gray">
                  {offer.project_lead.display_name}
                </Text>
              )}
            </Flex>
            <Flex direction="column" gap="2" style={{ flex: 1 }}>
              <Text size="1" weight="bold" color="gray">
                TO
              </Text>
              <Text size="3" weight="medium">
                {offer.customer?.name || 'Customer'}
              </Text>
              {offer.customer_contact?.name && (
                <Text size="2" color="gray">
                  {offer.customer_contact.name}
                  {offer.customer_contact.phone
                    ? ` · ${prettyPhone(offer.customer_contact.phone)}`
                    : ''}
                </Text>
              )}
            </Flex>
          </Flex>

          {!preview && response && (
            <>
              {response.hasTerms && (
                <Flex gap="3" wrap="wrap" mt="4">
                  <Button
                    size="2"
                    variant="ghost"
                    onClick={() => response.setShowTermsDialog(true)}
                  >
                    Terms & conditions
                  </Button>
                </Flex>
              )}

              <PrettyOfferResponseSection
                offer={offer}
                canAccept={canAccept}
                response={response}
              />
            </>
          )}
        </Box>
      </Box>

      {!preview && response?.hasTerms && (
        <Dialog.Root
          open={response.showTermsDialog}
          onOpenChange={response.setShowTermsDialog}
        >
          <Dialog.Content maxWidth="800px" style={{ maxHeight: '80vh' }}>
            <Dialog.Title>Terms and Conditions</Dialog.Title>
            <Box style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {offer.company_terms?.type === 'pdf' && response.termsPdfUrl ? (
                <Button
                  variant="outline"
                  onClick={() => window.open(response.termsPdfUrl!, '_blank')}
                >
                  View PDF
                </Button>
              ) : (
                <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                  {offer.company_terms?.text}
                </Text>
              )}
            </Box>
            <Dialog.Close>
              <Button variant="soft" mt="3">
                Close
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}
