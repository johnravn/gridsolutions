// src/features/jobs/utils/offerValidation.ts
import type { JobOffer, OfferDetail } from '../types'

export type ValidationResult = {
  valid: boolean
  errors: Array<string>
}

export function validateOffer(offer: OfferDetail): ValidationResult {
  const errors: Array<string> = []

  // Check if offer has at least one item in one category
  const hasEquipment =
    offer.groups && offer.groups.some((g) => g.items && g.items.length > 0)
  const hasCrew = offer.crew_items && offer.crew_items.length > 0
  const hasTransport = offer.transport_items && offer.transport_items.length > 0

  if (!hasEquipment && !hasCrew && !hasTransport) {
    errors.push(
      'Offer must have at least one item (equipment, crew, or transport)',
    )
  }

  // Check for required fields
  if (!offer.title || offer.title.trim() === '') {
    errors.push('Offer title is required')
  }

  if (!offer.access_token || offer.access_token.trim() === '') {
    errors.push('Access token is required')
  }

  // Validate days of use
  if (offer.days_of_use < 1) {
    errors.push('Days of use must be at least 1')
  }

  // Validate discount
  if (offer.discount_percent < 0 || offer.discount_percent > 100) {
    errors.push('Discount must be between 0 and 100 percent')
  }

  // Validate VAT
  if (offer.vat_percent !== 0 && offer.vat_percent !== 25) {
    errors.push('VAT must be either 0 or 25 percent')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function canLockOffer(offer: JobOffer): boolean {
  // Can lock if:
  // 1. Not already locked
  // 2. Status is draft
  return !offer.locked && offer.status === 'draft'
}

export function canEditOffer(offer: JobOffer): boolean {
  // Can edit if:
  // 1. Not locked
  // 2. Status is draft or sent (can modify sent offers until accepted)
  return !offer.locked && (offer.status === 'draft' || offer.status === 'sent')
}

export function canAcceptOffer(offer: JobOffer): boolean {
  // Can accept if status is 'sent' and not already accepted/rejected
  return offer.status === 'sent'
}

export function canDuplicateOffer(offer: JobOffer): boolean {
  // Can duplicate any offer regardless of status
  return true
}

export function canCreatePrettyOffer(offer: JobOffer): boolean {
  // Can create pretty offer if this is a technical offer
  return offer.offer_type === 'technical'
}
