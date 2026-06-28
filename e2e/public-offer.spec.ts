import { test, expect, TEST_OFFER_TOKENS } from './fixtures'

test.describe('Public offer', () => {
  test('displays a sent offer to customers', async ({ page }) => {
    await page.goto(`/offer/${TEST_OFFER_TOKENS.sent}`)
    await expect(page.getByText(/Test microphone/i)).toBeVisible({
      timeout: 15_000,
    })
  })

  test('customer can accept a sent offer', async ({ page }) => {
    await page.goto(`/offer/${TEST_OFFER_TOKENS.accept}`)

    await expect(page.getByText(/Test microphone/i)).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: 'Accept Offer' }).click()

    await page.getByPlaceholder('First name').fill('Playwright')
    await page.getByPlaceholder('Last name').fill('Customer')
    await page.getByPlaceholder('Enter phone number').fill('91234567')
    await page.getByRole('button', { name: 'Accept', exact: true }).click()

    await expect(page.getByText('Offer Accepted').first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('customer can reject a sent offer', async ({ page }) => {
    await page.goto(`/offer/${TEST_OFFER_TOKENS.reject}`)

    await expect(page.getByText(/Test microphone/i)).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: 'Reject Offer' }).click()
    await page.getByPlaceholder('First name').fill('Playwright')
    await page.getByPlaceholder('Last name').fill('Rejecter')
    await page.getByPlaceholder('Enter phone number').fill('91234567')
    await page
      .getByPlaceholder('Please explain why you are rejecting this offer...')
      .fill('Price too high for our budget')
    await page.locator('button:enabled', { hasText: 'Reject Offer' }).click()

    await expect(page.getByText('Offer Rejected').first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('customer can request revision on a sent offer', async ({ page }) => {
    await page.goto(`/offer/${TEST_OFFER_TOKENS.revision}`)

    await expect(page.getByText(/Test microphone/i)).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: 'Revise Offer' }).click()
    await page.getByPlaceholder('First name').fill('Playwright')
    await page.getByPlaceholder('Last name').fill('Reviser')
    await page.getByPlaceholder('Enter phone number').fill('91234567')
    await page
      .getByPlaceholder(
        'Please describe what you would like changed in the offer...',
      )
      .fill('Please adjust the equipment list')
    await page.getByRole('button', { name: 'Ask for a New Offer' }).click()

    await expect(page.getByText('Revision Requested').first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
