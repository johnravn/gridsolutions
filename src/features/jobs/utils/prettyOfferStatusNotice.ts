import { prettyPhone } from '@shared/phone/phone'
import { formatPublicOfferDate } from '../hooks/usePublicOfferResponse'
import type { OfferDetail } from '../types'

export type PrettyOfferStatusKind =
  | 'superseded'
  | 'accepted'
  | 'rejected'
  | 'revision'

export type PrettyOfferStatusNotice = {
  kind: PrettyOfferStatusKind
  title: string
  lines: Array<string>
}

export function resolvePrettyOfferStatusNotice(
  offer: OfferDetail,
): PrettyOfferStatusNotice | null {
  if (offer.status === 'superseded') {
    return {
      kind: 'superseded',
      title: 'Offer superseded',
      lines: [
        'A newer version of this offer has been sent. Please refer to the latest version for acceptance.',
      ],
    }
  }

  if (offer.status === 'accepted') {
    const lines: Array<string> = []
    if (offer.accepted_by_name) {
      let line = `Accepted by ${offer.accepted_by_name}`
      if (offer.accepted_by_phone) {
        line += ` · ${prettyPhone(offer.accepted_by_phone)}`
      }
      lines.push(line)
    }
    if (offer.accepted_at) {
      lines.push(`Accepted on ${formatPublicOfferDate(offer.accepted_at)}`)
    }
    return { kind: 'accepted', title: 'Offer accepted', lines }
  }

  if (offer.status === 'rejected') {
    const lines: Array<string> = []
    if (offer.rejected_by_name) {
      let line = `Rejected by ${offer.rejected_by_name}`
      if (offer.rejected_by_phone) {
        line += ` · ${prettyPhone(offer.rejected_by_phone)}`
      }
      lines.push(line)
    }
    if (offer.rejection_comment) {
      lines.push(`Comment: ${offer.rejection_comment}`)
    }
    if (offer.rejected_at) {
      lines.push(`Rejected on ${formatPublicOfferDate(offer.rejected_at)}`)
    }
    return { kind: 'rejected', title: 'Offer rejected', lines }
  }

  if (offer.revision_requested_at) {
    const lines: Array<string> = []
    if (offer.revision_requested_by_name) {
      let line = `Requested by ${offer.revision_requested_by_name}`
      if (offer.revision_requested_by_phone) {
        line += ` · ${prettyPhone(offer.revision_requested_by_phone)}`
      }
      lines.push(line)
    }
    if (offer.revision_comment) {
      lines.push(`Requested changes: ${offer.revision_comment}`)
    }
    lines.push(
      `Requested on ${formatPublicOfferDate(offer.revision_requested_at)}`,
    )
    return { kind: 'revision', title: 'Revision requested', lines }
  }

  return null
}

export function hasPrettyOfferStatusNotice(offer: OfferDetail): boolean {
  return resolvePrettyOfferStatusNotice(offer) != null
}
