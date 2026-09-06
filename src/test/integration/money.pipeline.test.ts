import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  equipmentDiscountOverridesFromOffer,
  offerLinesToBookings,
} from '@features/jobs/utils/offerLinesToBookings'
import {
  buildBookingsForInvoiceSendPayload,
  offerToBookingsForInvoice,
} from '@features/jobs/utils/invoiceSendPayload'
import { roundMoney } from '@features/jobs/utils/offerCalculations'
import {
  MONEY_PIPELINE,
  moneyPipelineExpected,
} from '@features/jobs/utils/moneyPipeline.fixture'
import type { JobOffer, OfferDetail } from '@features/jobs/types'
import {
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const TEST_COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const TEST_ITEM_ID = 'ffffffff-ffff-4fff-8fff-fffffffffff1'
const TEST_ITEM_PRICE_ID = 'ffffffff-ffff-4fff-8fff-fffffffffff2'
const CONTA_CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4'

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('money pipeline', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('seeds Test Seeded Item list price 1000 and Conta-ready customer', async () => {
    const admin = createServiceClient()

    const { data: price, error: priceError } = await admin
      .from('item_price_history')
      .select('amount, effective_to')
      .eq('id', TEST_ITEM_PRICE_ID)
      .single()

    expect(priceError).toBeNull()
    expect(Number(price?.amount)).toBe(1000)
    expect(price?.effective_to).toBeNull()

    const { data: item } = await admin
      .from('items')
      .select('name')
      .eq('id', TEST_ITEM_ID)
      .single()
    expect(item?.name).toBe('Test Seeded Item')

    const { data: customer } = await admin
      .from('customers')
      .select('name, conta_customer_id')
      .eq('id', CONTA_CUSTOMER_ID)
      .single()
    expect(customer?.name).toBe(MONEY_PIPELINE.contaCustomerName)
    expect(customer?.conta_customer_id).toBe(424242)

    const { data: expansion } = await admin
      .from('company_expansions')
      .select('accounting_software, accounting_organization_id')
      .eq('company_id', TEST_COMPANY_ID)
      .single()
    expect(expansion?.accounting_software).toBe('conta')
    expect(expansion?.accounting_organization_id).toBe('e2e-test-org')
  })

  it('offer detail → offerLinesToBookings → send payload matches job_offers money', async () => {
    const admin = createServiceClient()
    const { session } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const ownerId = session!.user.id

    const jobId = randomUUID()
    const basisId = randomUUID()
    const offerId = randomUUID()
    const groupId = randomUUID()
    const equipmentItemId = randomUUID()
    const accessToken = `money-pipeline-${offerId.slice(0, 8)}`

    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 14)
    const endAt = new Date(startAt)
    endAt.setDate(endAt.getDate() + 2)

    const { error: jobError } = await admin.from('jobs').insert({
      id: jobId,
      company_id: TEST_COMPANY_ID,
      title: `Money pipeline ${offerId.slice(0, 8)}`,
      status: 'planned',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      project_lead_user_id: ownerId,
      customer_id: CONTA_CUSTOMER_ID,
      jobnr: 990_000 + Math.floor(Math.random() * 1000),
    })
    expect(jobError).toBeNull()

    const { error: basisError } = await admin.from('offer_bases').insert({
      id: basisId,
      job_id: jobId,
      company_id: TEST_COMPANY_ID,
      title: 'Money pipeline basis',
      days_of_use: MONEY_PIPELINE.daysOfUse,
      discount_percent: MONEY_PIPELINE.discountPercent,
      vat_percent: MONEY_PIPELINE.vatPercent,
    })
    expect(basisError).toBeNull()

    const { error: groupError } = await admin
      .from('offer_equipment_groups')
      .insert({
        id: groupId,
        offer_basis_id: basisId,
        group_name: MONEY_PIPELINE.equipmentGroupName,
        sort_order: 0,
      })
    expect(groupError).toBeNull()

    const { error: itemError } = await admin
      .from('offer_equipment_items')
      .insert({
        id: equipmentItemId,
        offer_group_id: groupId,
        quantity: MONEY_PIPELINE.quantity,
        unit_price: MONEY_PIPELINE.dailyUnitPrice,
        total_price: moneyPipelineExpected.equipmentLineTotalPrice,
        is_internal: true,
        sort_order: 0,
        custom_line_description: MONEY_PIPELINE.customLineDescription,
      })
    expect(itemError).toBeNull()

    const { error: offerError } = await admin.from('job_offers').insert({
      id: offerId,
      job_id: jobId,
      company_id: TEST_COMPANY_ID,
      offer_basis_id: basisId,
      offer_type: 'technical',
      version_number: 1,
      status: 'accepted',
      access_token: accessToken,
      title: 'Money pipeline offer',
      days_of_use: MONEY_PIPELINE.daysOfUse,
      discount_percent: MONEY_PIPELINE.discountPercent,
      vat_percent: MONEY_PIPELINE.vatPercent,
      equipment_subtotal: moneyPipelineExpected.equipmentSubtotal,
      crew_subtotal: 0,
      transport_subtotal: 0,
      total_before_discount: moneyPipelineExpected.totalBeforeDiscount,
      total_after_discount: moneyPipelineExpected.totalAfterDiscount,
      total_with_vat: moneyPipelineExpected.totalWithVat,
      locked: true,
      sent_at: new Date().toISOString(),
      show_price_per_line: true,
    })
    expect(offerError).toBeNull()

    try {
      const { data: offerRow, error: loadError } = await admin
        .from('job_offers')
        .select('*')
        .eq('id', offerId)
        .single()
      expect(loadError).toBeNull()

      const { data: groups } = await admin
        .from('offer_equipment_groups')
        .select('*')
        .eq('offer_basis_id', basisId)

      const { data: items } = await admin
        .from('offer_equipment_items')
        .select('*')
        .eq('offer_group_id', groupId)

      const detail = {
        ...(offerRow as JobOffer),
        job_title: 'Money pipeline',
        groups: (groups ?? []).map((g) => ({
          ...g,
          items: (items ?? []).filter((i) => i.offer_group_id === g.id),
        })),
        crew_items: [],
        transport_items: [],
        transport_groups: [],
      } as OfferDetail

      expect(Number(detail.total_after_discount)).toBe(
        moneyPipelineExpected.totalAfterDiscount,
      )
      expect(Number(detail.total_with_vat)).toBe(
        moneyPipelineExpected.totalWithVat,
      )

      const expanded = offerLinesToBookings(detail)
      const overrides = equipmentDiscountOverridesFromOffer(detail)
      expect(expanded.all).toHaveLength(1)
      expect(expanded.all[0]?.totalPrice).toBe(
        moneyPipelineExpected.equipmentLineTotalPrice,
      )
      expect(overrides[equipmentItemId]).toBe(MONEY_PIPELINE.discountPercent)

      const expandedSend = buildBookingsForInvoiceSendPayload(
        expanded,
        expanded.all,
        overrides,
        true,
      )
      expect(roundMoney(expandedSend.totalExVat)).toBe(
        moneyPipelineExpected.totalAfterDiscount,
      )
      expect(roundMoney(expandedSend.totalWithVat)).toBe(
        moneyPipelineExpected.totalWithVat,
      )

      const summary = offerToBookingsForInvoice(detail as JobOffer)
      const summarySend = buildBookingsForInvoiceSendPayload(
        summary,
        summary.all,
        {},
        true,
      )
      expect(roundMoney(summarySend.totalExVat)).toBe(
        roundMoney(expandedSend.totalExVat),
      )
      expect(roundMoney(summarySend.totalWithVat)).toBe(
        roundMoney(expandedSend.totalWithVat),
      )
      expect(summarySend.all).toHaveLength(1)
      expect(expandedSend.all[0]?.id).toBe(equipmentItemId)
    } finally {
      await admin.from('job_offers').delete().eq('id', offerId)
      await admin
        .from('offer_equipment_items')
        .delete()
        .eq('id', equipmentItemId)
      await admin.from('offer_equipment_groups').delete().eq('id', groupId)
      await admin.from('offer_bases').delete().eq('id', basisId)
      await admin.from('jobs').delete().eq('id', jobId)
    }
  })
})
