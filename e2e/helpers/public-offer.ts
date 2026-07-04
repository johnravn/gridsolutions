import { expect, type Page } from '@playwright/test'

export async function openPublicOfferAction(
  page: Page,
  action: 'Accept Offer' | 'Reject Offer' | 'Revise Offer',
) {
  const actionsButton = page.getByRole('button', { name: 'Offer actions' })
  await actionsButton.scrollIntoViewIfNeeded()
  await expect(actionsButton).toBeVisible({ timeout: 15_000 })
  await actionsButton.click()
  await page.getByRole('menuitem', { name: action }).click()
}
