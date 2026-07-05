import { expect, type Page } from '@playwright/test'

export async function openPublicOfferAction(
  page: Page,
  action: 'Accept Offer' | 'Reject Offer' | 'Revise Offer',
) {
  const buttonName = action === 'Revise Offer' ? 'Request Revision' : action
  const actionButton = page.getByRole('button', { name: buttonName })
  await actionButton.scrollIntoViewIfNeeded()
  await expect(actionButton).toBeVisible({ timeout: 15_000 })
  await actionButton.click()
}
