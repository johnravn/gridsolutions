import { expect, type Page } from '@playwright/test'

export async function openPublicOfferAction(
  page: Page,
  action: 'Accept Offer' | 'Reject Offer' | 'Revise Offer',
) {
  const buttonName = action === 'Revise Offer' ? 'Request Revision' : action
  await expect(page.getByText('Loading offer...')).toHaveCount(0, {
    timeout: 15_000,
  })
  const actionButton = page.getByRole('button', { name: buttonName })
  await expect(actionButton).toBeVisible({ timeout: 15_000 })
  // Public offer chrome can keep animating; a DOM click avoids "not stable".
  await actionButton.evaluate((el) => (el as HTMLElement).click())
}
