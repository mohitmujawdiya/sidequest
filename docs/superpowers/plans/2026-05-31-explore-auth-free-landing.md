# Explore (auth-free landing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, auth-free copy of the Sidequest landing at `/explore` whose conversion target is DeepSpace (a "Made with DeepSpace" header badge + closing card), with analytics parity plus two new tracked actions.

**Architecture:** A new `src/pages/explore.tsx` route reuses the already-presentational sections of `home.tsx` (exported, not duplicated) and adds a no-auth quest card, a minimal brand header, and the DeepSpace CTAs. `src/pages/_app.tsx` gets a route-aware conditional to hide the global `<Navigation/>` on `/explore`. Two new analytics event types (`deepspace_cta_click`, `scroll_depth`) thread through the union, the schema's select options, and the admin dashboard labels.

**Tech Stack:** React + react-router (generouted file routing), Tailwind v4, lucide-react, DeepSpace SDK hooks, Playwright (`tests/smoke.spec.ts`), Vitest, `tsc`.

Spec: `docs/superpowers/specs/2026-05-31-explore-auth-free-landing-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/analytics.ts` | Add `deepspace_cta_click` + `scroll_depth` to the `AnalyticsEventType` union. |
| `src/schemas/analytics-schema.ts` | Add the two new types + the missing `mascot_tap` to the `eventType` select `options`. |
| `src/pages/analytics.tsx` | Add `eventLabels` entries for the new types; surface a "DeepSpace clicks" stat. |
| `src/pages/home.tsx` | Export the auth-agnostic presentational components/helpers; add an optional `subcopy` prop to `SignedOutLanding`. No render/behavior change. |
| `src/pages/_app.tsx` | Hide `<Navigation/>` on `/explore` (route-aware). |
| `src/pages/explore.tsx` | New page: minimal header, hero, no-auth quest card, filters, deck preview, closing DeepSpace card, scroll-depth tracking. |
| `tests/smoke.spec.ts` | Add an "Explore (auth-free landing)" describe block. |

Verification commands used throughout:
- Type check: `npm run type-check` (alias for `tsc --noEmit`).
- Smoke tests: `npx deepspace test smoke` (auto-starts Vite; may require `npx deepspace login` once — run `npx deepspace whoami` to check). Plain alternative once chromium is installed: `npx playwright test smoke.spec --config tests/playwright.config.ts`.

---

## Task 1: Add the two new analytics event types

**Files:**
- Modify: `src/lib/analytics.ts:5-15` (the `AnalyticsEventType` union)
- Modify: `src/schemas/analytics-schema.ts:11-22` (the `eventType` select `options`)
- Modify: `src/pages/analytics.tsx:33-44` (`eventLabels`), `:124-131` (stat grid), `:399-418` (`buildAnalytics` return)

- [ ] **Step 1: Extend the union** in `src/lib/analytics.ts`. Replace the `AnalyticsEventType` union (currently ending at `| 'mascot_tap'`) with:

```ts
export type AnalyticsEventType =
  | 'page_view'
  | 'shuffle_sidequest'
  | 'save_sidequest'
  | 'accept_sidequest'
  | 'complete_sidequest'
  | 'post_memory'
  | 'cheer_memory'
  | 'favorite_memory'
  | 'sign_in_prompt'
  | 'mascot_tap'
  | 'deepspace_cta_click'
  | 'scroll_depth'
```

- [ ] **Step 2: Add the select options** in `src/schemas/analytics-schema.ts`. Replace the `options` array inside the `eventType` column with (note `mascot_tap` was missing and is added here too):

```ts
        options: [
          'page_view',
          'shuffle_sidequest',
          'save_sidequest',
          'accept_sidequest',
          'complete_sidequest',
          'post_memory',
          'cheer_memory',
          'favorite_memory',
          'sign_in_prompt',
          'mascot_tap',
          'deepspace_cta_click',
          'scroll_depth',
        ],
```

- [ ] **Step 3: Add dashboard labels** in `src/pages/analytics.tsx`. In the `eventLabels` object, after the `mascot_tap: 'Mascot tap',` line, add:

```ts
  deepspace_cta_click: 'DeepSpace click',
  scroll_depth: 'Scroll depth',
```

- [ ] **Step 4: Expose a DeepSpace-clicks count** in `buildAnalytics` (`src/pages/analytics.tsx`). In the returned object literal, add a field alongside `totalEvents`:

```ts
    deepspaceClicks: eventCounts.get('deepspace_cta_click') ?? 0,
```

- [ ] **Step 5: Render the stat.** In `AnalyticsDashboard`'s stat grid (the `<div className="grid gap-3 sm:grid-cols-2">` block), add one more `AnalyticsStat` after the "Complete rate" one. Reuse the already-imported `MousePointerClick` icon:

```tsx
            <AnalyticsStat label="DeepSpace clicks" value={analytics.deepspaceClicks.toString()} icon={MousePointerClick} />
```

- [ ] **Step 6: Type-check.**

Run: `npm run type-check`
Expected: PASS, no errors. (The `eventLabels` `Record<AnalyticsEventType, string>` forces a label for each new union member; if you missed one, `tsc` fails here pointing at `eventLabels`.)

- [ ] **Step 7: Commit.**

```bash
git add src/lib/analytics.ts src/schemas/analytics-schema.ts src/pages/analytics.tsx
git commit -m "$(cat <<'EOF'
feat(analytics): add deepspace_cta_click and scroll_depth event types

Also adds the pre-existing mascot_tap to the eventType select options
and surfaces a DeepSpace-clicks stat in the admin dashboard.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Export the shared presentational pieces from `home.tsx`

These components/helpers already take their data via props and have no auth concerns. Add `export` so `/explore` can reuse them; this is an export-only change with one tiny additive prop. The live `/home` render and behavior stay identical (verified by the existing smoke suite in Step 4).

**Files:**
- Modify: `src/pages/home.tsx` (line 1 import; functions `SignedOutLanding`, `QuestCompanionCard`, `EmptyQuestStage`, `ChipGroup`, `QuestPool`, `QuestPill`, `StatTile`, `Checklist`, `createDeckSeed`, `getStableQuest`)

- [ ] **Step 1: Import `ReactNode`.** On line 1 of `src/pages/home.tsx`, add `type ReactNode` to the existing react import so it reads:

```ts
import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
```

- [ ] **Step 2: Add `export` to the two helpers.** Change `function createDeckSeed()` to `export function createDeckSeed()` and `function getStableQuest(` to `export function getStableQuest(`. Leave their bodies unchanged. (`hashString` and `getDeckPreview` stay private — they are only used inside this file.)

- [ ] **Step 3: Add `export` to the presentational components.** Prefix each of these declarations with `export` (bodies unchanged):
  - `function QuestCompanionCard(` → `export function QuestCompanionCard(`
  - `function EmptyQuestStage(` → `export function EmptyQuestStage(`
  - `function ChipGroup(` → `export function ChipGroup(`
  - `function QuestPool(` → `export function QuestPool(`
  - `function QuestPill(` → `export function QuestPill(`
  - `function StatTile(` → `export function StatTile(`
  - `function Checklist(` → `export function Checklist(`

- [ ] **Step 4: Export `SignedOutLanding` and give it an optional `subcopy`.** Replace the `SignedOutLanding` function signature and its subcopy `<p>` so the default text is preserved but overridable. Change:

```tsx
function SignedOutLanding() {
```
to:
```tsx
export function SignedOutLanding({ subcopy }: { subcopy?: ReactNode }) {
```

and replace the existing subcopy paragraph:

```tsx
        <p className="mt-5 max-w-xl text-base font-bold leading-7 text-[oklch(0.39_0.055_240)] sm:text-lg sm:leading-8">
          Browse a fresh real-world prompt from {quests.length} community-sourced cards. Sign in only when a memory is worth keeping.
        </p>
```
with:
```tsx
        <p className="mt-5 max-w-xl text-base font-bold leading-7 text-[oklch(0.39_0.055_240)] sm:text-lg sm:leading-8">
          {subcopy ?? (
            <>Browse a fresh real-world prompt from {quests.length} community-sourced cards. Sign in only when a memory is worth keeping.</>
          )}
        </p>
```

The existing call site `<SignedOutLanding />` (in the signed-out branch of `HomePage`) still compiles — `subcopy` is optional and defaults to the original copy.

- [ ] **Step 5: Type-check.**

Run: `npm run type-check`
Expected: PASS, no errors.

- [ ] **Step 6: Verify `/home` is unchanged behaviorally.**

Run: `npx deepspace test smoke`
Expected: PASS — all existing home/board/deck/filter tests still green (proves the export refactor changed nothing on `/home`). If login is needed, run `npx deepspace login`, then re-run.

- [ ] **Step 7: Commit.**

```bash
git add src/pages/home.tsx
git commit -m "$(cat <<'EOF'
refactor(home): export presentational quest sections for reuse

Export the auth-agnostic landing/quest/deck components and two deck
helpers so the new /explore page can compose them without duplication.
Adds an optional subcopy prop to SignedOutLanding; default copy and the
/home render are unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Hide global navigation on `/explore`

**Files:**
- Modify: `src/pages/_app.tsx:8-9` (imports), `:18-38` (the `App` component)

- [ ] **Step 1: Import `useLocation`.** Change the react-router import line in `src/pages/_app.tsx` from:

```tsx
import { Outlet } from 'react-router-dom'
```
to:
```tsx
import { Outlet, useLocation } from 'react-router-dom'
```

- [ ] **Step 2: Make the shell route-aware.** Replace the `App` component body so it hides `<Navigation/>` on `/explore` only (everything else unchanged, `<AnalyticsTracker/>` stays mounted so `/explore` page views keep flowing):

```tsx
export default function App() {
  const { pathname } = useLocation()
  const hideChrome = pathname === '/explore'

  return (
    <ToastProvider>
      <DeepSpaceAuthProvider>
        <AuthBoot>
          {/* data-testid="app-root" is the canonical "app shell mounted" hook
              every test relies on. Don't rename without updating templates/tests. */}
          <div data-testid="app-root" className="flex h-screen flex-col bg-background overflow-hidden">
            {!hideChrome && <Navigation />}
            <AnalyticsTracker />
            <main className="flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]">
              <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
                <Outlet />
              </Suspense>
            </main>
          </div>
        </AuthBoot>
      </DeepSpaceAuthProvider>
    </ToastProvider>
  )
}
```

- [ ] **Step 3: Type-check.**

Run: `npm run type-check`
Expected: PASS, no errors.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/_app.tsx
git commit -m "$(cat <<'EOF'
feat(app): hide global navigation on the /explore route

Route-aware shell so the public /explore landing owns the viewport with
no nav and no sign-in button. AnalyticsTracker stays mounted.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Write the failing smoke tests for `/explore`

Write the tests first; they fail because `/explore` does not exist yet (route renders the 404 catch-all, so the explore selectors are absent).

**Files:**
- Modify: `tests/smoke.spec.ts` (add a describe block inside the existing top-level `test.describe('Smoke tests', ...)`, or as a sibling describe — either is fine; place it before the final closing `})`).

- [ ] **Step 1: Add the explore describe block** to `tests/smoke.spec.ts`:

```tsx
test.describe('Explore (auth-free landing)', () => {
  async function waitForExplore(page: import('@playwright/test').Page) {
    await page.waitForSelector('[data-testid="explore-root"]', { timeout: 15000 })
  }

  test('explore renders the landing with zero auth triggers', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/explore')
    await waitForExplore(page)

    await expect(page.getByTestId('home-heading')).toContainText('Bored? Accept a sidequest.')
    await expect(page.getByTestId('draw-quest-button')).toBeVisible()
    await expect(page.getByTestId('app-navigation')).toHaveCount(0)
    await expect(page.getByTestId('nav-sign-in-button')).toHaveCount(0)
    await expect(page.getByTestId('accept-quest-button')).toHaveCount(0)
    await expect(page.locator('[data-testid="auth-overlay"]')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('explore shuffles the quest without auth', async ({ page }) => {
    await page.goto('/explore')
    await waitForExplore(page)

    const title = page.getByTestId('quest-title')
    const before = await title.textContent()
    await page.getByTestId('draw-quest-button').click()
    await expect(title).not.toHaveText(before ?? '')
  })

  test('explore Made-with-DeepSpace links carry the UTM url and open in a new tab', async ({ page }) => {
    await page.goto('/explore')
    await waitForExplore(page)

    const badge = page.getByTestId('explore-made-with-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveAttribute('href', /^https:\/\/deep\.space\?utm_source=sidequest/)
    await expect(badge).toHaveAttribute('target', '_blank')

    const cta = page.getByTestId('explore-deepspace-cta').getByRole('link')
    await expect(cta).toHaveAttribute('href', /utm_campaign=reddit/)
    await expect(cta).toHaveAttribute('target', '_blank')
  })
})
```

- [ ] **Step 2: Run the explore tests to confirm they fail.**

Run: `npx deepspace test smoke`
Expected: the three new `Explore (auth-free landing)` tests FAIL (timeout waiting for `[data-testid="explore-root"]`, because `/explore` renders the 404 page). Existing tests still pass.

- [ ] **Step 3: Commit the failing tests.**

```bash
git add tests/smoke.spec.ts
git commit -m "$(cat <<'EOF'
test(smoke): add failing explore landing assertions

No auth triggers, working shuffle, and UTM/new-tab Made-with-DeepSpace
links. Red until the /explore route lands.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Build `src/pages/explore.tsx`

Build the page so Task 4's tests pass. Steps add the file incrementally, but the file does not type-check or render until Step 5 (full compose). Run the verification after Step 5.

**Files:**
- Create: `src/pages/explore.tsx`

- [ ] **Step 1: Create the file with imports, constants, and the scroll-depth hook:**

```tsx
/**
 * Explore — public, auth-free copy of the landing for sharing (e.g. r/InternetIsBeautiful).
 *
 * Same interactive quest deck as the signed-out /home, with every auth trigger removed
 * (no nav, no Sign in, no Accept, no Save). The conversion target is DeepSpace: a persistent
 * "Made with DeepSpace" badge in the header plus a closing in-world quest card.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ArrowUpRight, Clock3, Compass, Dices, Map, RefreshCcw, Sparkles, Trophy } from 'lucide-react'
import { Button, cn } from '../components/ui'
import { useAnalytics } from '../lib/analytics'
import {
  Checklist,
  ChipGroup,
  EmptyQuestStage,
  QuestCompanionCard,
  QuestPill,
  QuestPool,
  SignedOutLanding,
  StatTile,
  createDeckSeed,
  getStableQuest,
} from './home'
import {
  categoryLabels,
  difficultyLabels,
  getRandomQuest,
  modeLabels,
  quests,
  timeLabels,
  type QuestCategory,
  type QuestDifficulty,
  type QuestMode,
  type QuestTime,
  type SideQuest,
} from '../data/quests'
import { categoryStyles, difficultyStyles } from '../lib/quest-progress'

type FilterValue<T extends string> = T | 'any'

const DEEPSPACE_URL =
  'https://deep.space?utm_source=sidequest&utm_medium=made-with-badge&utm_campaign=reddit'

/** Fires scroll_depth once per 25/50/75/100% milestone. The scroll container is the
 *  <main> in _app.tsx (overflow-y-auto), not window — so listen on the nearest <main>. */
function useScrollDepthTracking(
  rootRef: RefObject<HTMLElement | null>,
  track: ReturnType<typeof useAnalytics>,
) {
  const firedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    const root = rootRef.current
    const scroller =
      (root?.closest('main') as HTMLElement | null) ??
      (document.scrollingElement as HTMLElement | null)
    if (!scroller) return

    const milestones = [25, 50, 75, 100]
    let frame = 0
    const measure = () => {
      frame = 0
      const scrollable = scroller.scrollHeight - scroller.clientHeight
      if (scrollable <= 0) return
      const depth = (scroller.scrollTop / scrollable) * 100
      for (const milestone of milestones) {
        if (depth >= milestone && !firedRef.current.has(milestone)) {
          firedRef.current.add(milestone)
          track('scroll_depth', { metadata: { depth: milestone } })
        }
      }
    }
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [rootRef, track])
}
```

- [ ] **Step 2: Add the minimal brand header and the closing DeepSpace card** (append to the file):

```tsx
function ExploreHeader({ onDeepSpaceClick }: { onDeepSpaceClick: () => void }) {
  return (
    <header className="relative">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-primary text-primary-foreground">
            <Compass className="h-4 w-4" aria-hidden />
          </span>
          <span className="sidequest-display text-xl font-black tracking-normal text-foreground">
            Sidequest
          </span>
        </div>
        <a
          data-testid="explore-made-with-badge"
          href={DEEPSPACE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDeepSpaceClick}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-card px-3 py-1.5 text-sm font-black text-foreground transition-transform hover:-translate-y-0.5 sidequest-mini-shadow"
        >
          Made with DeepSpace
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </header>
  )
}

function DeepSpaceQuestCard({ onClick }: { onClick: () => void }) {
  return (
    <section
      data-testid="explore-deepspace-cta"
      className="sidequest-panel mt-5 overflow-hidden bg-[oklch(0.88_0.14_338)] p-5 sm:p-7"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
            <Sparkles className="h-4 w-4" aria-hidden />
            One more sidequest
          </div>
          <h2 className="sidequest-display max-w-[16ch] text-4xl font-black leading-[0.95] tracking-normal text-[oklch(0.20_0.07_338)] sm:text-5xl">
            Build your own.
          </h2>
          <p className="mt-4 max-w-xl text-base font-bold leading-7 text-[oklch(0.28_0.07_338)]">
            Sidequest is a real, live app built with DeepSpace. Yours could be next.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="sidequest-button shrink-0 bg-[oklch(0.985_0.018_93)] text-[oklch(0.22_0.08_338)] hover:bg-[oklch(0.95_0.03_338)]"
        >
          <a href={DEEPSPACE_URL} target="_blank" rel="noopener noreferrer" onClick={onClick}>
            Made with DeepSpace
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </a>
        </Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Add the no-auth quest card** (append to the file). Same visual card as home's `QuestStage`, but only the Shuffle action — no Save icon, no Accept button, no auth panel:

```tsx
function ShowcaseQuestStage({
  quest,
  stageRef,
  onDraw,
}: {
  quest: SideQuest
  stageRef: RefObject<HTMLElement | null>
  onDraw: () => void
}) {
  const Icon = quest.icon

  return (
    <section
      ref={stageRef}
      data-testid="active-quest-card"
      className="sidequest-panel overflow-hidden bg-[oklch(0.97_0.025_100)]"
    >
      <div className="min-h-[520px] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <QuestPill className={categoryStyles[quest.category]}>{categoryLabels[quest.category]}</QuestPill>
          <QuestPill className={difficultyStyles[quest.difficulty]}>{difficultyLabels[quest.difficulty]}</QuestPill>
          <QuestPill>{modeLabels[quest.mode]}</QuestPill>
          <QuestPill>{timeLabels[quest.time]}</QuestPill>
        </div>

        <div className="flex min-w-0 items-start gap-4">
          <div
            className={cn(
              'sidequest-icon-tile flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2',
              categoryStyles[quest.category],
            )}
          >
            <Icon className="h-10 w-10" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2
              data-testid="quest-title"
              className="sidequest-display text-4xl font-black leading-none tracking-normal text-[oklch(0.21_0.06_240)] sm:text-5xl"
            >
              {quest.title}
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatTile icon={Trophy} label="Reward" value={`${quest.xp} XP`} />
          <StatTile icon={Clock3} label="Time" value={quest.estimate} />
          <StatTile icon={Map} label="Place" value={quest.setting} />
        </div>

        <div className="mt-4 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] p-4 sidequest-mini-shadow">
          <p className="text-base font-extrabold leading-7 text-[oklch(0.25_0.06_240)]">{quest.prompt}</p>
        </div>

        <div className="mt-4 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.985_0.018_93)] p-4 sidequest-mini-shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="sidequest-display text-2xl font-black leading-none text-[oklch(0.22_0.06_240)]">
              Ready to run it?
            </h3>
            <Button
              data-testid="draw-quest-button"
              size="lg"
              onClick={onDraw}
              className="sidequest-button bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]"
            >
              <Dices className="h-4 w-4" aria-hidden />
              Shuffle
            </Button>
          </div>
          <p className="mt-3 text-sm font-bold leading-6 text-[oklch(0.40_0.05_240)]">
            Free to browse, no account needed. Shuffle for another, or head out and do this one.
          </p>
        </div>
      </div>

      <div className="grid gap-5 border-t-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.985_0.018_93)] p-4 sm:p-5 lg:grid-cols-2">
        <Checklist title="Rules" items={quest.rules} />
        <Checklist title="Photo ideas" items={quest.proof} />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Add the default-exported page component** (append to the file). It owns deck state, filters, shuffle, and the DeepSpace/scroll tracking:

```tsx
export default function ExplorePage() {
  const track = useAnalytics()
  const [difficulty, setDifficulty] = useState<FilterValue<QuestDifficulty>>('any')
  const [category, setCategory] = useState<FilterValue<QuestCategory>>('any')
  const [mode, setMode] = useState<FilterValue<QuestMode>>('any')
  const [time, setTime] = useState<FilterValue<QuestTime>>('any')
  const [currentId, setCurrentId] = useState(() => getRandomQuest(quests).id)
  const [previewAnchorId, setPreviewAnchorId] = useState(currentId)
  const [deckSeed, setDeckSeed] = useState(() => createDeckSeed())
  const stageRef = useRef<HTMLElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useScrollDepthTracking(rootRef, track)

  const activePool = useMemo(() => {
    return quests.filter((quest) => {
      if (difficulty !== 'any' && quest.difficulty !== difficulty) return false
      if (category !== 'any' && quest.category !== category) return false
      if (mode !== 'any' && quest.mode !== mode && quest.mode !== 'either') return false
      if (time !== 'any' && quest.time !== time) return false
      return true
    })
  }, [category, difficulty, mode, time])

  const hasActiveFilters =
    difficulty !== 'any' || category !== 'any' || mode !== 'any' || time !== 'any'
  const noMatches = activePool.length === 0
  const currentQuest = useMemo(
    () => activePool.find((quest) => quest.id === currentId) ?? getStableQuest(activePool, currentId) ?? quests[0],
    [activePool, currentId],
  )

  useEffect(() => {
    if (activePool.length === 0) return
    if (currentQuest.id !== currentId) {
      setCurrentId(currentQuest.id)
      setPreviewAnchorId(currentQuest.id)
      return
    }
    if (!activePool.some((quest) => quest.id === previewAnchorId)) {
      setPreviewAnchorId(currentQuest.id)
    }
  }, [activePool, currentId, currentQuest.id, previewAnchorId])

  function drawQuest() {
    if (activePool.length === 0) return
    const next = getRandomQuest(activePool, currentQuest.id)
    setCurrentId(next.id)
    setPreviewAnchorId(next.id)
    setDeckSeed(createDeckSeed())
    track('shuffle_sidequest', {
      category: next.category,
      difficulty: next.difficulty,
      questId: next.id,
      questTitle: next.title,
      xp: next.xp,
    })
  }

  function resetFilters() {
    setDifficulty('any')
    setCategory('any')
    setMode('any')
    setTime('any')
  }

  function trackDeepSpaceClick(placement: 'header' | 'closing-card') {
    track('deepspace_cta_click', { metadata: { placement } })
  }

  return (
    <div ref={rootRef} data-testid="explore-root" className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />
      <ExploreHeader onDeepSpaceClick={() => trackDeepSpaceClick('header')} />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-2 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,1.12fr)] lg:items-start">
          <div className="grid gap-5 lg:content-start">
            <SignedOutLanding
              subcopy={`Browse a fresh real-world prompt from ${quests.length} community-sourced cards. Pick one, head out, and come back for the next.`}
            />
            <QuestCompanionCard category={currentQuest.category} />
          </div>

          {noMatches ? (
            <EmptyQuestStage
              reason="filters"
              showReset={hasActiveFilters}
              stageRef={stageRef}
              onReset={resetFilters}
            />
          ) : (
            <ShowcaseQuestStage quest={currentQuest} stageRef={stageRef} onDraw={drawQuest} />
          )}
        </section>

        <section className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
                Tune the deck
              </h2>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {`${activePool.length} fresh of ${quests.length} cards in play.`}
              </p>
            </div>
            <Button
              type="button"
              onClick={resetFilters}
              className="sidequest-button bg-[oklch(0.89_0.14_88)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)]"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden />
              Reset filters
            </Button>
          </div>

          <div className="mt-5 grid gap-5">
            <ChipGroup
              label="Difficulty"
              options={[['any', 'Any'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]}
              value={difficulty}
              onChange={(value) => setDifficulty(value as FilterValue<QuestDifficulty>)}
            />
            <ChipGroup
              label="Realm"
              options={[['any', 'Any'], ['outside', 'Outside'], ['people', 'People'], ['craft', 'Craft'], ['motion', 'Motion'], ['mind', 'Mind'], ['care', 'Care']]}
              value={category}
              onChange={(value) => setCategory(value as FilterValue<QuestCategory>)}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <ChipGroup
                label="Party"
                options={[['any', 'Any'], ['solo', 'Solo'], ['social', 'Social'], ['either', 'Either']]}
                value={mode}
                onChange={(value) => setMode(value as FilterValue<QuestMode>)}
              />
              <ChipGroup
                label="Time"
                options={[['any', 'Any'], ['quick', '15 min'], ['short', '30 min'], ['long', '60+ min']]}
                value={time}
                onChange={(value) => setTime(value as FilterValue<QuestTime>)}
              />
            </div>
          </div>
        </section>

        <QuestPool
          activePool={activePool}
          currentQuest={currentQuest}
          deckSeed={deckSeed}
          deckReady={true}
          freshDeckCount={activePool.length}
          previewAnchorId={previewAnchorId}
          onSelect={(questId) => setCurrentId(questId)}
        />

        <DeepSpaceQuestCard onClick={() => trackDeepSpaceClick('closing-card')} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Type-check.**

Run: `npm run type-check`
Expected: PASS. If `tsc` complains about a missing import from `./home`, re-check Task 2 exports match the names imported here.

- [ ] **Step 6: Run the explore smoke tests — they should now pass.**

Run: `npx deepspace test smoke`
Expected: PASS — the three `Explore (auth-free landing)` tests are green, and every pre-existing test still passes.

- [ ] **Step 7: (Optional) Eyeball it.** With a dev server running (`npx deepspace dev`):

Run: `npx deepspace screenshot http://localhost:5173/explore /tmp/explore.png --full-page`
Expected: a screenshot showing the minimal header with the "Made with DeepSpace" badge, the hero, the shuffleable quest card (no Accept/Save), filters, deck preview, and the closing pink "Build your own." DeepSpace card. No nav bar, no sign-in.

- [ ] **Step 8: Commit.**

```bash
git add src/pages/explore.tsx
git commit -m "$(cat <<'EOF'
feat(explore): add auth-free landing copy with DeepSpace conversion

Public /explore route: faithful interactive landing (hero, shuffle,
filters, deck, mascot) with no nav, sign-in, accept, or save. Persistent
header badge + closing in-world card both link to deep.space with UTM in
a new tab. Tracks shuffle, deepspace_cta_click, and scroll_depth.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full type-check.**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 2: Full smoke suite.**

Run: `npx deepspace test smoke`
Expected: PASS — all tests, including the explore block and the unchanged home/board/deck/filter tests.

- [ ] **Step 3: Unit tests (guards against incidental breakage).**

Run: `npm run test:unit`
Expected: PASS (no unit tests were touched; this confirms nothing regressed).

- [ ] **Step 4: Confirm the working tree is clean and all work is committed.**

Run: `git status`
Expected: clean tree on branch `explore-auth-free-landing`.

---

## Self-Review

**Spec coverage:**
- New `/explore` route → Task 5. ✓
- Route-aware nav hide in `_app.tsx` → Task 3. ✓
- Minimal brand header (logo only) → `ExploreHeader`, Task 5 Step 2. ✓
- Remove every auth trigger (Accept, Save, AuthOverlay, Sign in) → `ShowcaseQuestStage` has only Shuffle; `explore.tsx` imports no auth hooks; nav hidden. Tests assert `accept-quest-button`/`nav-sign-in-button`/`auth-overlay` counts are 0 (Task 4). ✓
- Faithful interactive copy (hero, shuffle, filters, deck, mascot) → reused exports + `ShowcaseQuestStage`, Task 5. ✓
- DeepSpace header badge + closing card → `ExploreHeader` + `DeepSpaceQuestCard`, Task 5. ✓
- Link target = `deep.space` + UTM, opens new tab → `DEEPSPACE_URL` + `target="_blank"`, asserted in Task 4. ✓
- Analytics parity (page_view auto, shuffle, mascot) → page_view via `AnalyticsTracker` (kept mounted, Task 3); shuffle via `drawQuest`; mascot via reused `QuestCompanionCard`. ✓
- New events `deepspace_cta_click` + `scroll_depth` → Task 1 (types/options/labels) + Task 5 (firing). ✓
- `mascot_tap` select-options fix → Task 1 Step 2. ✓
- Admin dashboard surfaces new data → labels + DeepSpace-clicks stat, Task 1. ✓
- Tests for the new route → Task 4 (public-route auth assertions per the deepspace testing checklist). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `createDeckSeed`/`getStableQuest` exported in Task 2 and imported in Task 5. `ShowcaseQuestStage({ quest, stageRef, onDraw })`, `ExploreHeader({ onDeepSpaceClick })`, `DeepSpaceQuestCard({ onClick })`, and `useScrollDepthTracking(rootRef, track)` signatures match their call sites. `FilterValue<T>` is redefined locally in `explore.tsx` (not imported), avoiding a cross-file type export. `track` typed as `ReturnType<typeof useAnalytics>`. ✓
