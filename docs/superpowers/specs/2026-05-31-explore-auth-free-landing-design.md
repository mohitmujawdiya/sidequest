# Auth-free landing copy (`/explore`) with DeepSpace conversion

**Date:** 2026-05-31
**Status:** Approved design, pending implementation plan

## Why

The Sidequest landing (`/home` when signed out) was rejected by r/InternetIsBeautiful
because it surfaces an authentication button. We need a public copy with **zero auth
triggers** to submit there. Rather than push visitors toward Sidequest sign-in, this
copy repurposes the conversion goal: show off a polished, real app and convert visitors
to **DeepSpace** (the platform it was built on) via a "Made with DeepSpace" link.

## Scope

- New public route `src/pages/explore.tsx`, served at `https://sidequest.app.space/explore`.
- A faithful, fully interactive copy of the signed-out landing: hero, Shuffle-able quest
  card, "Tune the deck" filters, deck preview, tappable mascot.
- No authentication anywhere on the page: no nav menu, no "Sign in", no "Accept sidequest"
  button, no "Save" bookmark icon, no `AuthOverlay`.
- DeepSpace conversion via two touchpoints (one persistent, one primary).
- Analytics parity with home + two new tracked actions (DeepSpace click, scroll depth).

Out of scope: a separate deployment, changing `/home` behavior, custom domains.

## Architecture

### Route + chrome
- `src/pages/explore.tsx` is the new route (generouted file-based routing picks it up).
- `src/pages/_app.tsx` gets the **one sanctioned edit** (per the deepspace `landing-design`
  reference): a route-aware conditional that hides the global `<Navigation/>` on `/explore`.
  `<AnalyticsTracker/>` stays mounted for all routes (page views keep flowing).
  ```tsx
  const { pathname } = useLocation()
  const hideChrome = pathname === '/explore'
  ...
  {!hideChrome && <Navigation />}
  ```
- `explore.tsx` renders its own **minimal brand header**: Sidequest compass logo + wordmark,
  left-aligned, no links. On the right, a small persistent "Made with DeepSpace" pill.

### Reuse strategy (avoid duplicating ~1200 lines of `home.tsx`)
The presentational sections of `home.tsx` are already auth-agnostic and take their data via
props. Export them and share between `/home` and `/explore`:
- Extract/export: `SignedOutLanding` (hero), `QuestCompanionCard` (mascot), `ChipGroup`
  (filters), `QuestPool` (deck preview), and atoms `QuestPill`, `StatTile`, `HeroStat`,
  `Checklist`, `QuestTotem`, plus helpers `hashString`, `getStableQuest`, `getDeckPreview`,
  `createDeckSeed`.
- The active quest card on `/explore` is a **slim, no-auth variant**: same visual card, but
  it renders only the **Shuffle** action (no Accept button, no Save icon, no auth panel copy).
  `/home` keeps its existing auth-aware `QuestStage` unchanged.
- `explore.tsx` owns the showcase-only state: deck seed, current quest, filters, preview
  anchor. It does **not** import `useAuth`, `useUser`, `useMutations`, or `AuthOverlay`, and
  does not query `saved_quests` / `quest_completions`.

The live `/home` page keeps its current behavior; the refactor is export-only (no logic
change to home), which keeps regression risk low.

### DeepSpace conversion (placement decided via impeccable, brand register)
Two touchpoints, one primary, both opening in a **new tab** (`target="_blank" rel="noopener"`):

1. **Persistent header badge** — small "Made with DeepSpace" pill in the minimal header,
   where "Sign in" used to be. Attribution for non-scrollers; conventional "Made with X" slot.
2. **Primary: closing "one more sidequest" card** at the bottom, after the deck preview —
   built in the product's own quest-card visual language (chunky-bordered `sidequest-panel`,
   pills) and framed as a meta-quest so it reads as in-world delight, not a bolted-on footer:
   > **One more sidequest** · Build your own.
   > "Sidequest is a real, live app built with DeepSpace. Yours could be next."
   > **[ Made with DeepSpace -> ]**

   Copy is sentence case (per PRODUCT.md), no em dashes, lucide icons only.

**Link target (both):**
`https://deep.space?utm_source=sidequest&utm_medium=made-with-badge&utm_campaign=reddit`

Rejected alternatives: header-badge-only (weak conversion, no CTA moment); placing the CTA
in the quest card's action row where "Accept" was (off-topic, breaks the in-world fiction).

## Analytics

The existing `useAnalytics()` hook works unchanged for anonymous visitors: the
`analytics_events` schema allows `create` for `*`, and `track()` omits user fields when
signed out (falls back to a `localStorage` session id). `page_view` for `/explore` is
captured automatically by `<AnalyticsTracker/>` and appears in the dashboard Routes panel.

**Parity (carried over for free via reused handlers):** `shuffle_sidequest`, `mascot_tap`.
Auth-only events (`save_sidequest`, `accept_sidequest`, `sign_in_prompt`) intentionally do
not fire here.

**Two new event types**, each requiring three coordinated edits:
1. `src/lib/analytics.ts` — add `'deepspace_cta_click'` and `'scroll_depth'` to the
   `AnalyticsEventType` union.
2. `src/schemas/analytics-schema.ts` — add both strings to the `eventType` select `options`.
   Also add the pre-existing-but-missing `'mascot_tap'` to the options (correctness fix).
3. `src/pages/analytics.tsx` — add labels to the `eventLabels` `Record` (TS-enforced);
   surface DeepSpace clicks as an `AnalyticsStat` so the count is visible at a glance.

**Firing on `/explore`:**
- `deepspace_cta_click` — on both DeepSpace links, with
  `metadata: { placement: 'header' | 'closing-card' }`. New-tab navigation guarantees the
  fire-and-forget write completes.
- `scroll_depth` — a rAF-throttled scroll listener fires once per 25/50/75/100% milestone
  per page load, with `metadata: { depth }`. Net-new (home does not track scroll today).

Filter-change and deck-card-select click tracking are deliberately omitted to keep parity
with home; trivial to add later if finer granularity is wanted.

## Files touched

| File | Change |
|---|---|
| `src/pages/explore.tsx` | New. Showcase landing: minimal header, hero, no-auth quest card, filters, deck preview, closing DeepSpace card, scroll-depth tracker. |
| `src/pages/home.tsx` | Export shared presentational components/helpers; no behavior change. |
| `src/pages/_app.tsx` | Route-aware: hide `<Navigation/>` on `/explore`. |
| `src/lib/analytics.ts` | Add `deepspace_cta_click`, `scroll_depth` to the union. |
| `src/schemas/analytics-schema.ts` | Add new event types + `mascot_tap` to select options. |
| `src/pages/analytics.tsx` | Add `eventLabels` entries; DeepSpace-click stat. |

## Testing / verification

- `tsc` clean (the `Record<AnalyticsEventType, string>` forces label completeness).
- Playwright smoke check on `/explore`: page renders, no `nav-sign-in-button`, no
  `accept-quest-button`, Shuffle still changes the quest, both DeepSpace links carry the
  UTM and `target="_blank"`.
- Manual: confirm `page_view` + `deepspace_cta_click` rows appear (admin analytics) after
  visiting/clicking while signed out.

## Success criteria

- `/explore` has no element that can open a sign-in/auth flow.
- The page is visually and interactively a faithful copy of the signed-out landing.
- "Made with DeepSpace" appears persistently (header) and prominently (closing card),
  both linking to the UTM'd `deep.space` URL in a new tab.
- DeepSpace clicks and scroll depth are queryable in the admin analytics dashboard.
