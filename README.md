# Sidequest

**Bored? Accept a sidequest.**

A curated quest board for the boring middle of a normal day. Browse a real-world prompt, accept it, do it, remember it. No AI filler — every card is hand-curated and safety-filtered before it lands in the deck.

🌐 **Live:** [sidequest.app.space](https://sidequest.app.space)

---

## What it is

Sidequest takes a short list of categorized real-world prompts ("Find the loudest bird on your street", "Send a postcard to a stranger") and turns them into a tiny ritual:

> **Browse → Accept → Do → Remember**

Anonymous visitors can browse and shuffle. Signed-in players can save, accept, complete, attach a memory photo, post to community, and earn XP. The whole thing runs in real-time over WebSockets via the [DeepSpace](https://www.npmjs.com/package/deepspace) SDK.

## Stack

| Layer            | Choice                                                                       |
| ---------------- | ---------------------------------------------------------------------------- |
| Runtime          | Cloudflare Workers + Durable Objects (deployed via `npx deepspace deploy`)   |
| Backend          | [DeepSpace](https://www.npmjs.com/package/deepspace) SDK on top of [Hono](https://hono.dev/) |
| Real-time data   | DeepSpace `RecordRoom` DOs (SQLite-backed, per-collection RBAC)              |
| Frontend         | React 19 + Vite + Tailwind v4 + Radix UI primitives                          |
| Routing          | File-based via [`@generouted/react-router`](https://github.com/oedotme/generouted) |
| Icons / motion   | `lucide-react`, `framer-motion`                                              |
| AI               | Vercel AI SDK (Anthropic + OpenAI) through the DeepSpace proxy               |
| Storage          | R2 (memory photos) via the DeepSpace platform proxy                          |
| Testing          | Playwright (smoke / api / e2e), Vitest (unit)                                |

---

## Features

### Core loop — `src/pages/home.tsx`

The "Sidequest board": filter chips (difficulty / realm / party / time), a featured card, shuffle button, deck preview grid, save / accept actions. Anonymous users can browse freely; saving and accepting prompts sign-in via `AuthOverlay`.

### Quest log — `src/pages/quest-log.tsx`

Three sections: **Saved** (queued), **Ongoing** (accepted), **Memories** (completed). Completing a sidequest runs the `complete-sidequest` server action (`src/actions/index.ts`) which atomically writes the `quest_completions` record, transitions the `saved_quests` row to `completed`, and optionally posts to `community_posts` with a memory photo. Photos are uploaded to R2 via `useR2Files`.

### Community — `src/pages/community.tsx`

A feed of completed sidequests with photos. Cheer + favorite reactions via `community_reactions`. Filterable by realm or by your own favorites.

### Leaderboard — `src/pages/leaderboard.tsx`

XP rankings aggregated from `community_posts`. Only players who post a memory show up — sharing is the leaderboard ticket.

### Settings — `src/pages/(protected)/settings.tsx`

Auth-gated profile screen.

### Analytics — `src/pages/analytics.tsx` *(admin only)*

Privacy-light dashboard:

- Visitors / 7-day active
- Signups (total, today, last 7d)
- Funnel: views → shuffles → accepts → completes → posts
- Accept-rate / complete-rate
- Top sidequests, top routes, recent events

Tracked via `useAnalytics()` (`src/lib/analytics.ts`) — anyone (including anonymous) can `create` on the `analytics_events` collection, but only `admin` can read it (`src/schemas/analytics-schema.ts`). Page views are auto-tracked by the `<AnalyticsTracker/>` component in `_app.tsx`; action events are fired explicitly from each page. The nav entry is hidden unless `user.role === 'admin'`.

### AI chat (scaffolded)

`src/ai/chat-routes.ts` exposes `POST /api/ai/chat` for streamed assistant turns with tool-use against the record collections. Models allow-listed: `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, plus OpenAI chat-completions-compatible variants. No UI surface is wired up yet — the routes are ready when needed.

---

## Project layout

```
sidequest/
├── worker.ts                   Cloudflare Worker entry. Declares DO classes
│                                (RecordRoom, YjsRoom, CanvasRoom, PresenceRoom,
│                                CronRoom, JobRoom), auth/integration proxies,
│                                WebSocket routes, R2 proxy, cron + jobs.
├── wrangler.toml               Worker config. 6 SQLite-backed DO bindings.
├── src/
│   ├── main.tsx                React entry → Generouted <Routes/>
│   ├── pages/                  File-based routing
│   │   ├── _app.tsx            Shell: providers → auth gate → nav + outlet
│   │   ├── index.tsx           → /home
│   │   ├── home.tsx            The sidequest board (anonymous + signed-in)
│   │   ├── quest-log.tsx       Saved / Ongoing / Memories
│   │   ├── community.tsx       Feed of posted memories with reactions
│   │   ├── leaderboard.tsx     XP leaderboard from community posts
│   │   ├── analytics.tsx       Admin-only dashboard
│   │   └── (protected)/
│   │       ├── _layout.tsx     AuthGate
│   │       └── settings.tsx    Profile / sign-out
│   ├── components/
│   │   ├── Navigation.tsx      Top nav + role-gated nav items + mobile drawer
│   │   ├── DeleteConfirmDialog.tsx
│   │   └── ui/                 Full Radix-wrapped kit (Button, Dialog, Toast,
│   │                            Tabs, Select, Progress, Tooltip, …)
│   ├── data/
│   │   ├── quests.ts           Quest types, label maps, runtime pool
│   │   └── origin-quests.generated.ts   Curated + safety-filtered source data
│   ├── schemas/                Collection definitions (single source of truth)
│   │   ├── users-schema.ts
│   │   ├── admin-schema.ts                 (settings)
│   │   ├── analytics-schema.ts
│   │   └── quest-progress-schema.ts        (saved + completions + community
│   │                                         + reactions)
│   ├── schemas.ts              Aggregates all schemas → exported to worker + UI
│   ├── lib/
│   │   ├── analytics.ts        useAnalytics(), <AnalyticsTracker/>
│   │   └── quest-progress.ts   Record types + style maps + photo helpers
│   ├── actions/index.ts        Server actions (complete-sidequest)
│   ├── ai/
│   │   ├── chat-routes.ts      Streaming AI chat endpoints
│   │   └── tools.ts            DeepSpace BUILT_IN_TOOLS → Vercel AI tool set
│   ├── cron.ts                 (empty stub — add tasks here)
│   ├── jobs.ts                 (empty stub — add background jobs here)
│   ├── integrations.ts         Per-integration billing config (google = user)
│   ├── products.ts             One-time products (empty)
│   ├── subscriptions.ts        Stripe plans: free + pro ($9/mo, $90/yr)
│   ├── constants.ts            APP_NAME, SCOPE_ID, re-exported roles
│   ├── nav.ts                  Nav config (analytics is admin-gated here)
│   ├── router.ts               Generated by Generouted — do not edit
│   ├── themes.ts / themes.css  15 themes shipped; "sidequest" is active
│   └── styles.css              Custom sidequest panel / button / dice styles
├── scripts/scrape-origin-quests.mjs   Pulls + filters origin data → quests.gen
├── tests/
│   ├── smoke.spec.ts           Playwright smoke
│   ├── api.spec.ts             API tests
│   ├── collab.spec.ts          Real-time collaboration test
│   ├── actions.test.ts         Vitest — complete-sidequest action
│   └── helpers/                Test setup + console-error capture
├── public/audio/               Mascot sounds (mascot-01..05.m4a)
├── artifacts/                  Design iteration screenshots
└── index.html                  data-theme="sidequest"
```

---

## Data model

All collections are defined in `src/schemas/` and aggregated in `src/schemas.ts`. RBAC is enforced at the DO layer — the worker can't accidentally leak data because every read/write goes through `permissions` declared on the schema.

| Collection             | Owned by   | Reads          | Writes                            |
| ---------------------- | ---------- | -------------- | --------------------------------- |
| `users`                | platform   | members + admin | own (self) / admin (any)         |
| `settings`             | admin      | admin only     | admin only                       |
| `saved_quests`         | userId     | own only       | own (member, admin)               |
| `quest_completions`    | userId     | own only       | own (member, admin)               |
| `community_posts`      | userId     | anyone         | own (create/update/delete)        |
| `community_reactions`  | userId     | anyone         | own create/delete (no update)     |
| `analytics_events`     | platform   | **admin only** | anyone (write-only event capture) |

`saved_quests` and `quest_completions` have `uniqueOn: ['userId', 'questId']` so a sidequest can't be double-saved or double-completed. `community_reactions` has `uniqueOn: ['userId', 'postId', 'kind']` (one cheer + one favorite per post).

---

## Quests

There are six **realms** (`mind`, `craft`, `outside`, `people`, `motion`, `care`), three **difficulties** (easy/medium/hard), three **party modes** (solo/social/either), and three **time buckets** (15min / 30min / 60+min). Each card has an `xp` reward, a one-line `prompt`, a list of `rules`, and `proof` (photo ideas).

The pool ships ~200+ curated cards in `src/data/origin-quests.generated.ts`, scraped from a public quest-prompt site and filtered through `scripts/scrape-origin-quests.mjs` with a long block-list of unsafe patterns (theft, trespass, violence, stalking, unsafe stunts, sleep deprivation, etc.) before any prompt makes it into the deck.

To re-scrape and refresh the pool:

```sh
npm run scrape:origin-quests
```

---

## Local development

### Prereqs

- Node 20+ and either `bun` or `npm`
- A [DeepSpace](https://www.npmjs.com/package/deepspace) account (`npx deepspace login`)

### Run

```sh
bun install                  # or: npm install
npx deepspace login          # one-time
npx deepspace dev            # vite + miniflare on :8780
```

The CLI writes `.dev.vars` (auth keys, owner JWT, debug flag) on first run. **That file is gitignored — never commit it.**

### Build / typecheck

```sh
npm run build                # vite build → dist/
npm run type-check           # tsc --noEmit
```

### Tests

```sh
npm run test                 # all suites (smoke + api + e2e + unit) via deepspace test
npm run test:unit            # vitest only
npm run test:smoke           # playwright smoke
npm run test:api             # playwright api
npm run test:e2e             # playwright end-to-end
```

The `complete-sidequest` server action has a dedicated Vitest suite in `tests/actions.test.ts` that mocks the DO `tools` interface and exercises the dedupe / rollback paths.

### Deploy

```sh
npm run deploy               # deepspace deploy
```

DeepSpace builds locally, validates DO bindings, then uploads to its shared Workers-for-Platforms namespace under `<app>.app.space`. Subscription plans in `src/subscriptions.ts` sync to Stripe on every deploy.

---

## Auth + roles

Auth is handled by the DeepSpace auth-worker (cookie-based sessions, social OAuth). The worker proxies `/api/auth/*` so cookies stay same-origin.

Roles (from the SDK, re-exported in `src/constants.ts`):

- `anonymous` — browse + shuffle only
- `viewer` — read public collections
- `member` — full sidequest loop
- `admin` — can read `users`, `analytics_events`, all of `settings`; sees the **Analytics** nav item

Promotion happens via the auth-worker / DeepSpace dashboard. To impersonate roles locally, the `.dev.vars` file enables `/api/debug/set-role` (gated by `ALLOW_DEBUG_ROUTES=true`, never set in production).

---

## Theming

15 named themes live in `src/themes.ts` + `src/themes.css`. Switch by changing the `data-theme` attribute on `<html>` in `index.html`. This app ships with `data-theme="sidequest"` — warm pastels (cream / berry / mint / sky) with the custom `sidequest-panel`, `sidequest-display`, `sidequest-button`, and `sidequest-dice-icon` styles in `src/styles.css`.

Design principles (full text in `PRODUCT.md`):

- The quest is the product — make the prompt feel tangible.
- Playfulness should reduce friction, not add chores.
- Curated beats generated.
- Sign-in enhances the loop, but browsing works without an account.

Anti-references: pixel-art nostalgia, neon-on-black game UI, emoji-as-icons, dense gamification, AI-generated quest copy.

---

## Acknowledgements

The original quest pool was sourced from a community vote/trending site referenced in `scripts/scrape-origin-quests.mjs`, then heavily filtered for safety before inclusion. Credit to the community of contributors who voted these into existence; the Sidequest app curates rather than generates.

---

## Status

Beta. Live at [sidequest.app.space](https://sidequest.app.space). Opening the doors to early players — analytics is in to track the real acquisition + activation funnel.
