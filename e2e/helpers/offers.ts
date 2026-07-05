import { expect, type Page } from '@playwright/test'
import { clickJobTab, openJobsPage } from './navigation'

export function offerBasisEditor(page: Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /Offer basis/i }),
  })
}

export async function expectOfferBasisSaved(page: Page) {
  await expect(
    page
      .getByText('Offer basis updated', { exact: true })
      .or(page.getByText('Offer basis created', { exact: true })),
  ).toBeVisible({ timeout: 15_000 })
}

export async function returnToOffersTabAfterBasisSave(
  page: Page,
  jobTitle: string,
) {
  await page.reload()
  await openJobsPage(page)

  const search = page.getByPlaceholder('Search')
  await search.fill(jobTitle)
  const jobRow = page.getByText(jobTitle, { exact: true }).first()
  await expect(jobRow).toBeVisible({ timeout: 15_000 })
  await jobRow.click()
  await expect(page.getByRole('heading', { name: jobTitle })).toBeVisible({
    timeout: 15_000,
  })

  await clickJobTab(page, 'Offers')
  await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
    timeout: 15_000,
  })
}
