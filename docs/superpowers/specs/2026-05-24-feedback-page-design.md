# Feedback page — design spec

**Date:** 2026-05-24
**Status:** Approved (design); pending implementation plan

## Goal

Let anyone suggest new sidequests or report improvements/bugs without logging in,
and let the admin (you) read every submission. Consistent with the existing
quest-board UI and built on the DeepSpace SDK.

## Decisions (confirmed with user)

1. **Who can submit:** anyone, no login required, with an optional name field.
2. **Form shape:** a type toggle (Sidequest idea / Improvement or bug), one message
   textarea, an optional name field.
3. **Admin view:** a single role-aware `/feedback` page. Visitors and signed-in
   non-admins see the submission form; the admin sees the responses inbox on the
   same page. One nav item, visible to everyone.

## Data model

New file `src/schemas/feedback-schema.ts`, registered in the `schemas` array in
`src/schemas.ts`.

```
collection: feedback
columns:
  type:      text  select ['sidequest','improvement']  required, default 'sidequest'
  message:   text  plain                                required
  name:      text  plain                                optional
  createdAt: text  datetime                             required
permissions:
  '*'    : { read: false, create: true,  update: false, delete: false }   // anonymous submit
  viewer : { read: false, create: true,  update: false, delete: false }
  member : { read: false, create: true,  update: false, delete: false }
  admin  : { read: true,  create: true,  update: true,  delete: true }
```

- No `ownerField`: submitters never read feedback back; the admin reads all via
  `useQuery('feedback')`, the same way `analytics.tsx` reads `analytics_events`.
- Anonymous writes use the `'*'` wildcard key the SDK provides for unauthenticated
  connections (per the deepspace schemas reference; there is no built-in
  `anonymous` role).

## Shared logic

New file `src/lib/feedback.ts`:

- `FeedbackRecord` type (for `useQuery` / `useMutations` typing).
- `FEEDBACK_TYPES` and labels; `MAX_MESSAGE_LENGTH = 1000`.
- `validateFeedback({ message })` pure helper returning `{ ok: boolean; error?: string }`,
  enforcing trimmed non-empty message and the length cap. Unit-tested.

## UI

New page `src/pages/feedback.tsx` (generouted file route `/feedback`). Nav entry
added to `src/nav.ts` as `{ path: '/feedback', label: 'Feedback' }` with no `roles`
(visible to everyone).

Reuses the established design language: `sidequest-panel` (2px `oklch(0.31 0.07 240)`
border + hard offset shadow), cream panel fills, `sidequest-display` (Baloo 2)
headings, `sidequest-button` pills, existing `Textarea` / `Input` / `Badge` / `Button`
/ `useToast` components. Sentence case per PRODUCT.md copy rules; no em dashes.

**Submission form (visitors + non-admins):**
- Badge chip, display headline, short subcopy.
- Two-option segmented toggle (Sidequest idea / Improvement or bug), styled like the
  board's filter chips (`sidequest-touch-choice`, active = cyan `oklch(0.68 0.18 205)`).
- `Textarea` message field with a live character count toward `MAX_MESSAGE_LENGTH`.
- Optional name `Input`.
- "Send it" submit button (`sidequest-button`); disabled while empty or pending,
  shows the loading spinner like other actions.
- On success: success toast, reset the form to defaults.
- On error: error toast (same pattern as `handleSave` in `home.tsx`).

**Responses inbox (admin only):**
- Mirrors `analytics.tsx`: hero panel + admin badge, then a list.
- Newest-first list (`useQuery('feedback', { orderBy: 'createdAt', orderDir: 'desc' })`),
  each row: type badge, message, name or "Anonymous", relative timestamp.
- Type filter chips (All / Sidequest ideas / Improvements) and a count badge.
- On-brand syncing and empty states (reuse the analytics empty-state styling).

## Error handling and edges

- Client-side validation via `validateFeedback`; whitespace-only blocked, length capped.
- Anonymous spam is the accepted tradeoff of no-login; v1 relies on client-side
  length guards. Server-side rate limiting / captcha is noted as a future add.
- Admin query covers `status === 'ready'` (list), syncing, and empty.

## Testing

- Unit (`vitest`): `validateFeedback` — empty, whitespace-only, over-length, valid.
- Smoke (`tests/smoke.spec.ts`, logged-out): the "Feedback" nav link is visible;
  `/feedback` renders the form; the type toggle switches; filling the message and
  submitting shows the success toast. Use `data-testid`s consistent with existing tests.

## Out of scope (YAGNI for v1)

- Admin "mark as reviewed / added to deck" status workflow.
- Contact/email field beyond the optional name.
- Captcha or server-side rate limiting.

## Files touched

- `src/schemas/feedback-schema.ts` (new)
- `src/schemas.ts` (register `feedbackSchema`)
- `src/lib/feedback.ts` (new: type, constants, `validateFeedback`)
- `src/pages/feedback.tsx` (new: role-aware page)
- `src/nav.ts` (add Feedback entry)
- `tests/feedback.test.ts` (new unit test, alongside the existing `tests/actions.test.ts`)
- `tests/smoke.spec.ts` (add logged-out feedback test)
