import { test, expect, TEST_OFFER_TOKENS } from './fixtures'
import {
  expectPastedPhoneInput,
  openProfilePhoneInput,
  pasteIntoPhoneInput,
  phoneNumberInput,
} from './helpers/phone-input'

test.describe('Phone input country code paste', () => {
  test.beforeEach(async ({ authedPage: page }) => {
    await openProfilePhoneInput(page)
  })

  test('pastes E.164 number and sets Norway in country picker', async ({
    authedPage: page,
  }) => {
    await pasteIntoPhoneInput(page, phoneNumberInput(page), '+4791234567')
    await expectPastedPhoneInput(page, {
      country: 'NO',
      e164Digits: '4791234567',
    })
  })

  test('pastes 00 international prefix and sets Norway in country picker', async ({
    authedPage: page,
  }) => {
    await pasteIntoPhoneInput(page, phoneNumberInput(page), '004791234567')
    await expectPastedPhoneInput(page, {
      country: 'NO',
      e164Digits: '4791234567',
    })
  })

  test('pastes foreign country code and switches country picker', async ({
    authedPage: page,
  }) => {
    await pasteIntoPhoneInput(page, phoneNumberInput(page), '+46701234567')
    await expectPastedPhoneInput(page, {
      country: 'SE',
      e164Digits: '46701234567',
    })
  })
})

test.describe('Phone input on public offer', () => {
  test('accepts pasted E.164 number in customer form', async ({ page }) => {
    await page.goto(`/offer/${TEST_OFFER_TOKENS.sent}`)
    await expect(page.getByText(/Test microphone/i)).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('button', { name: 'Accept Offer' }).click()

    await pasteIntoPhoneInput(page, phoneNumberInput(page), '+4791234567')
    await expectPastedPhoneInput(page, {
      country: 'NO',
      e164Digits: '4791234567',
    })

    await page.getByPlaceholder('First name').fill('Playwright')
    await page.getByPlaceholder('Last name').fill('Paste')
    await expect(
      page.getByRole('button', { name: 'Accept', exact: true }),
    ).toBeEnabled()
  })
})
