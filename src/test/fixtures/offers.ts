import type { JobOffer, OfferDetail } from '@features/jobs/types'

const baseOffer: JobOffer = {
  id: '00000000-0000-4000-8000-000000000001',
  job_id: '00000000-0000-4000-8000-000000000002',
  company_id: '00000000-0000-4000-8000-000000000003',
  offer_type: 'technical',
  version_number: 1,
  offernr: 42,
  status: 'draft',
  access_token: 'test-access-token',
  title: 'Test Offer',
  days_of_use: 3,
  discount_percent: 10,
  vat_percent: 25,
  show_price_per_line: true,
  equipment_subtotal: 1000,
  crew_subtotal: 500,
  transport_subtotal: 200,
  total_before_discount: 1700,
  total_after_discount: 1600,
  total_with_vat: 2000,
  based_on_offer_id: null,
  locked: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  bookings_synced_at: null,
  sent_at: null,
  viewed_at: null,
  accepted_at: null,
  accepted_by_name: null,
  accepted_by_email: null,
  accepted_by_phone: null,
  rejected_at: null,
  rejected_by_name: null,
  rejected_by_phone: null,
  rejection_comment: null,
  revision_requested_at: null,
  revision_requested_by_name: null,
  revision_requested_by_phone: null,
  revision_comment: null,
}

export function makeJobOffer(overrides: Partial<JobOffer> = {}): JobOffer {
  return { ...baseOffer, ...overrides }
}

export function makeOfferDetail(
  overrides: Partial<OfferDetail> = {},
): OfferDetail {
  return {
    ...makeJobOffer(),
    groups: [
      {
        id: '00000000-0000-4000-8000-000000000010',
        offer_id: baseOffer.id,
        group_name: 'Equipment',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        items: [
          {
            id: '00000000-0000-4000-8000-000000000011',
            offer_group_id: '00000000-0000-4000-8000-000000000010',
            item_id: null,
            group_id: null,
            quantity: 1,
            unit_price: 100,
            total_price: 100,
            is_internal: true,
            sort_order: 0,
          },
        ],
      },
    ],
    crew_items: [],
    transport_items: [],
    ...overrides,
  }
}
