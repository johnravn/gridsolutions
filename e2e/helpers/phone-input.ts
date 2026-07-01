import { expect, type Locator, type Page } from '@playwright/test'

export function phoneInputRoot(page: Page) {
  return page.locator('.radix-phone').first()
}

export function phoneNumberInput(page: Page) {
  return phoneInputRoot(page).locator('input[type="tel"]')
}

export function phoneCountrySelect(page: Page) {
  return phoneInputRoot(page).locator('.PhoneInputCountrySelect')
}

export async function openProfilePhoneInput(page: Page) {
  await page.goto('/profile')
  await expect(phoneNumberInput(page)).toBeVisible({ timeout: 15_000 })
}

export async function pasteIntoPhoneInput(
  _page: Page,
  input: Locator,
  text: string,
) {
  await input.click()
  await input.evaluate((el, pastedText) => {
    const data = new DataTransfer()
    data.setData('text/plain', pastedText)
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    )
  }, text)
}

/** react-phone-number-input shows the country calling code in the tel input when international. */
export async function expectPastedPhoneInput(
  page: Page,
  {
    country,
    e164Digits,
  }: {
    country: string
    e164Digits: string
  },
) {
  const input = phoneNumberInput(page)
  await expect(phoneCountrySelect(page)).toHaveValue(country)
  await expect
    .poll(async () => (await input.inputValue()).replace(/\D/g, ''))
    .toBe(e164Digits)
  await expect(input).toHaveValue(/^\+/)
  await expect(page.locator('.radix-phone-error')).toBeHidden()
}
