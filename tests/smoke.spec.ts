import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Wait for the React app to mount. The app shows either:
 * - "Loading..." while auth initializes
 * - The navigation bar once ready
 */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('app loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    expect(errors).toEqual([])
  })

  test('navigation is visible', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('app-navigation')).toBeVisible()
  })

  test('navigation aligns with the app content rail', async ({ page }) => {
    await page.goto('/quest-log')
    await waitForApp(page)

    const navBox = await page.getByTestId('app-navigation-bar').boundingBox()
    const panelBox = await page.locator('.sidequest-panel').first().boundingBox()

    expect(navBox).not.toBeNull()
    expect(panelBox).not.toBeNull()
    expect(Math.abs((navBox?.x ?? 0) - (panelBox?.x ?? 0))).toBeLessThanOrEqual(1)
    expect(Math.abs(((navBox?.x ?? 0) + (navBox?.width ?? 0)) - ((panelBox?.x ?? 0) + (panelBox?.width ?? 0)))).toBeLessThanOrEqual(1)
  })

  test('mobile nav closes when tapping page content', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/quest-log')
    await waitForApp(page)

    const menuToggle = page.getByRole('button', { name: 'Toggle menu' })
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false')

    await menuToggle.click()
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true')

    await page.getByTestId('quest-log-heading').click()
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('home renders the real sidequest surface', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)

    await expect(page.getByTestId('home-heading')).toContainText('Bored? Accept a sidequest.')
    await expect(page.getByText('Your DeepSpace app is running')).toHaveCount(0)
    await expect(page.getByText('Get started')).toHaveCount(0)
    await expect(page.getByTestId('draw-quest-button')).toBeVisible()
    await expect(page.getByTestId('ritual-trail')).toContainText('Browse')
    await expect(page.getByTestId('ritual-trail')).toContainText('Accept')
    await expect(page.getByTestId('ritual-trail')).toContainText('Do')
    await expect(page.getByTestId('ritual-trail')).toContainText('Remember')
    await expect(page.locator('[data-testid="auth-overlay"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Log' })).toHaveCount(0)
    await expect(page.getByText(/Vote #|Trending #|Trending x/)).toHaveCount(0)
  })

  test('logged-out board surfaces the quest card on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await waitForApp(page)

    await expect(page.getByTestId('active-quest-card')).toBeInViewport()
    await expect(page.getByTestId('accept-quest-button')).toBeVisible()
  })

  test('quest log renders as its own nav page', async ({ page }) => {
    await page.goto('/quest-log')
    await waitForApp(page)

    await expect(page.getByTestId('quest-log-heading')).toContainText('Log')
    await expect(page.getByRole('link', { name: 'Log' })).toBeVisible()
    await expect(page.getByText('Your log is waiting.')).toBeVisible()
  })

  test('community renders as its own nav page', async ({ page }) => {
    await page.goto('/community')
    await waitForApp(page)

    await expect(page.getByTestId('community-heading')).toContainText('Tiny stories from real sidequests.')
    await expect(page.getByRole('link', { name: 'Community' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Community category' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favorites' })).toBeVisible()
  })

  test('leaderboard renders as its own nav page', async ({ page }) => {
    await page.goto('/leaderboard')
    await waitForApp(page)

    await expect(page.getByTestId('leaderboard-heading')).toContainText('XP for touching grass.')
    await expect(page.getByText(/public completions counted|Syncing public completions/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Leaderboard' })).toBeVisible()
  })

  test('analytics is hidden from logged-out navigation', async ({ page }) => {
    await page.goto('/analytics')
    await waitForApp(page)

    await expect(page.getByRole('link', { name: 'Analytics' })).toHaveCount(0)
    await expect(page.getByText('Admin only')).toBeVisible()
  })

  test('draw quest changes the active quest', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)

    const title = page.getByTestId('quest-title')
    const before = await title.textContent()
    await page.getByTestId('draw-quest-button').click()
    await expect(title).not.toHaveText(before ?? '')
  })

  test('deck preview selection keeps the preview order stable', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)

    const cards = page.getByTestId('deck-preview-card')
    await expect(cards).toHaveCount(9)

    const beforeOrder = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-quest-id')),
    )
    const selectedTitle = await cards.nth(1).getAttribute('data-quest-title')

    await cards.nth(1).click()

    const afterOrder = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-quest-id')),
    )
    expect(afterOrder).toEqual(beforeOrder)
    await expect(page.getByTestId('quest-title')).toHaveText(selectedTitle ?? '')
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true')

    const nextTitle = await cards.nth(3).getAttribute('data-quest-title')
    await cards.nth(2).click()
    await cards.nth(3).click()

    const selectedStates = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('aria-pressed')),
    )
    expect(selectedStates.filter((state) => state === 'true')).toHaveLength(1)
    await expect(cards.nth(3)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('quest-title')).toHaveText(nextTitle ?? '')
  })

  test('filter chips keep a single selected state after rapid switching', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)

    const difficultyGroup = page.locator('[role="group"][aria-label="Difficulty"]')
    const difficulty = difficultyGroup.getByRole('button')
    await difficultyGroup.getByRole('button', { name: 'Easy' }).click()
    await difficultyGroup.getByRole('button', { name: 'Medium' }).click()
    await difficultyGroup.getByRole('button', { name: 'Hard' }).click()

    const difficultyStates = await difficulty.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('aria-pressed')),
    )
    expect(difficultyStates.filter((state) => state === 'true')).toHaveLength(1)
    await expect(difficultyGroup.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/community')
    await waitForApp(page)

    const communityCategoryGroup = page.locator('[role="group"][aria-label="Community category"]')
    const communityCategory = communityCategoryGroup.getByRole('button')
    await communityCategoryGroup.getByRole('button', { name: 'Favorites' }).click()
    await communityCategoryGroup.getByRole('button', { name: 'All' }).click()

    const communityStates = await communityCategory.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('aria-pressed')),
    )
    expect(communityStates.filter((state) => state === 'true')).toHaveLength(1)
    await expect(communityCategoryGroup.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('empty filter combinations show a no-match state', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)

    await page.locator('[role="group"][aria-label="Difficulty"]').getByRole('button', { name: 'Hard' }).click()
    await page.locator('[role="group"][aria-label="Realm"]').getByRole('button', { name: 'Care' }).click()
    await page.locator('[role="group"][aria-label="Time"]').getByRole('button', { name: '15 min' }).click()

    await expect(page.getByText(/0 fresh of \d+ cards in play\./)).toBeVisible()
    await expect(page.getByText('No cards in this corner of the map.')).toBeVisible()
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible()
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
