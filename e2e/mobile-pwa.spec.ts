import { test, expect } from './fixtures'

test.describe('Mobile PWA layout', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('dashboard has no horizontal overflow on mobile viewport', async ({
    page,
  }) => {
    await page.goto('/login')
    await page
      .getByPlaceholder('you@company.com')
      .fill(process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local')
    await page
      .getByPlaceholder('••••••••')
      .fill(process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL('**/dashboard**', { timeout: 30_000 })

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1
    })

    expect(hasHorizontalOverflow).toBe(false)
  })
})
