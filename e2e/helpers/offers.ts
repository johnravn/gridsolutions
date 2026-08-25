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

function unsavedChangesDialog(page: Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Unsaved changes' }),
  })
}

function offerEditorDialog(page: Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', {
      name: /^(Offer Basis|Technical Offer|Pretty Offer)/i,
    }),
  })
}

/** Close offer editors without reload — reload is blocked by beforeunload. */
export async function closeOfferEditors(page: Page) {
  const unsaved = unsavedChangesDialog(page)
  const editor = offerEditorDialog(page)

  await expect(async () => {
    if (await unsaved.isVisible().catch(() => false)) {
      await unsaved.getByRole('button', { name: 'Discard' }).click()
    } else if (
      await editor
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await page.keyboard.press('Escape')
    }

    if (await unsaved.isVisible().catch(() => false)) {
      throw new Error('Unsaved changes dialog still open')
    }
    if (
      await editor
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      throw new Error('Offer editor still open')
    }
  }).toPass({ timeout: 15_000 })
}

async function headingInViewport(page: Page, jobTitle: string) {
  const heading = page.getByRole('heading', { name: jobTitle })
  if (!(await heading.isVisible().catch(() => false))) return false
  const box = await heading.boundingBox().catch(() => null)
  const viewport = page.viewportSize()
  if (!box || !viewport) return false
  return (
    box.x + box.width > 0 &&
    box.x < viewport.width &&
    box.y + box.height > 0 &&
    box.y < viewport.height
  )
}

export async function returnToOffersTabAfterBasisSave(
  page: Page,
  jobTitle: string,
) {
  await closeOfferEditors(page)

  const openInspector = page.getByRole('button', { name: 'Open inspector' })
  if (
    (await openInspector.isVisible().catch(() => false)) &&
    !(await headingInViewport(page, jobTitle))
  ) {
    await openInspector.click({ force: true })
  }

  if (await headingInViewport(page, jobTitle)) {
    await clickJobTab(page, 'Offers')
    await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
      timeout: 15_000,
    })
    return
  }

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
