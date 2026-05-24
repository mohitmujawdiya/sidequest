import { useMemo, useState, type ComponentType, type FormEvent } from 'react'
import { useMutations, useQuery, useUser } from 'deepspace'
import { Inbox, MessageCircle, Send, Sparkles, Wrench } from 'lucide-react'
import { Badge, Button, Input, Textarea, cn, useToast } from '../components/ui'
import {
  FEEDBACK_TYPES,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  feedbackTypeLabels,
  validateFeedback,
  type FeedbackRecord,
  type FeedbackType,
} from '../lib/feedback'

const typeIcons: Record<FeedbackType, ComponentType<{ className?: string }>> = {
  sidequest: Sparkles,
  improvement: Wrench,
}

const chipBase =
  'sidequest-touch-choice inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] px-4 py-2 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const chipActive = 'bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] sidequest-chip-shadow'

export default function FeedbackPage() {
  const { user } = useUser()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />
      <div className="relative mx-auto w-full max-w-3xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {isAdmin ? <FeedbackAdmin /> : <FeedbackForm />}
      </div>
    </div>
  )
}

function FeedbackForm({ compact = false }: { compact?: boolean }) {
  const { success, error } = useToast()
  const mutations = useMutations<FeedbackRecord>('feedback')
  const [type, setType] = useState<FeedbackType>('sidequest')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [touched, setTouched] = useState(false)

  const trimmed = message.trim()
  const validation = validateFeedback({ message })
  const showError = touched && !validation.ok
  const remaining = MAX_MESSAGE_LENGTH - trimmed.length

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!validateFeedback({ message }).ok) return

    setPending(true)
    try {
      const payload: FeedbackRecord = {
        type,
        message: trimmed,
        createdAt: new Date().toISOString(),
      }
      const trimmedName = name.trim()
      if (trimmedName) payload.name = trimmedName
      await mutations.create(payload)
      success(
        'Thanks, it landed.',
        type === 'sidequest' ? 'We read every sidequest pitch.' : 'We read every note.',
      )
      setType('sidequest')
      setMessage('')
      setName('')
      setTouched(false)
    } catch (err) {
      error('Could not send that', getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="sidequest-panel bg-[oklch(0.98_0.025_93)] p-5 sm:p-7">
      {!compact && (
        <>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
            <MessageCircle className="h-4 w-4" aria-hidden />
            Feedback
          </div>
          <h1
            data-testid="feedback-heading"
            className="sidequest-display max-w-[14ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
          >
            Pitch a sidequest.
          </h1>
          <p className="mt-4 max-w-xl text-base font-bold leading-7 text-[oklch(0.39_0.055_240)]">
            Got a sidequest the deck needs, or something to fix? Send it over. No account needed.
          </p>
        </>
      )}

      <form
        data-testid="feedback-form"
        onSubmit={handleSubmit}
        className={cn('grid gap-5', compact ? '' : 'mt-7')}
      >
        <div>
          <span
            id="feedback-type-label"
            className="mb-2 block text-sm font-black uppercase tracking-normal text-[oklch(0.30_0.06_240)]"
          >
            What kind?
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="feedback-type-label">
            {FEEDBACK_TYPES.map((value) => {
              const active = value === type
              const Icon = typeIcons[value]
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setType(value)}
                  className={cn(chipBase, active ? chipActive : 'sidequest-choice-neutral')}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {feedbackTypeLabels[value]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="feedback-message"
            className="mb-2 flex items-center justify-between gap-3 text-sm font-black uppercase tracking-normal text-[oklch(0.30_0.06_240)]"
          >
            <span>{type === 'sidequest' ? 'Your sidequest idea' : 'What should we fix?'}</span>
            <span
              className={cn(
                'font-bold tabular-nums normal-case tracking-normal',
                remaining < 0 ? 'text-[oklch(0.55_0.16_28)]' : 'text-muted-foreground',
              )}
            >
              {remaining}
            </span>
          </label>
          <Textarea
            id="feedback-message"
            data-testid="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={5}
            aria-invalid={showError ? true : undefined}
            aria-describedby={showError ? 'feedback-message-error' : undefined}
            placeholder={
              type === 'sidequest'
                ? 'e.g. Leave a kind note for a stranger and walk away before they read it.'
                : 'e.g. The shuffle button could use a keyboard shortcut.'
            }
            className="min-h-[120px] rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card text-base font-bold text-[oklch(0.24_0.06_240)] shadow-none placeholder:font-semibold placeholder:text-[oklch(0.55_0.04_240)] focus-visible:ring-2 focus-visible:ring-ring"
          />
          {showError && (
            <p
              id="feedback-message-error"
              className="mt-2 text-sm font-bold text-[oklch(0.50_0.16_28)]"
            >
              {validation.error}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="feedback-name"
            className="mb-2 block text-sm font-black uppercase tracking-normal text-[oklch(0.30_0.06_240)]"
          >
            Name{' '}
            <span className="font-bold normal-case tracking-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            id="feedback-name"
            data-testid="feedback-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_NAME_LENGTH}
            placeholder="So we know who to thank"
            className="h-11 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card text-base font-bold text-[oklch(0.24_0.06_240)] shadow-none placeholder:font-semibold placeholder:text-[oklch(0.55_0.04_240)] focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            data-testid="feedback-submit"
            size="lg"
            loading={pending}
            className="sidequest-button bg-[oklch(0.88_0.14_338)] text-[oklch(0.22_0.08_338)] hover:bg-[oklch(0.84_0.15_338)]"
          >
            <Send className="h-4 w-4" aria-hidden />
            Send it
          </Button>
        </div>
      </form>
    </section>
  )
}

function FeedbackAdmin() {
  const [view, setView] = useState<'responses' | 'submit'>('responses')
  const views: Array<['responses' | 'submit', string]> = [
    ['responses', 'Responses'],
    ['submit', 'Write one'],
  ]

  return (
    <div className="grid gap-5">
      <section className="sidequest-panel bg-[oklch(0.98_0.025_93)] p-5 sm:p-7">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
          <Inbox className="h-4 w-4" aria-hidden />
          Feedback inbox
        </div>
        <h1
          data-testid="feedback-heading"
          className="sidequest-display max-w-[14ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
        >
          What people are saying.
        </h1>
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Feedback view">
          {views.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === view}
              onClick={() => setView(value)}
              className={cn(chipBase, value === view ? chipActive : 'sidequest-choice-neutral')}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {view === 'responses' ? <FeedbackResponses /> : <FeedbackForm compact />}
    </div>
  )
}

function FeedbackResponses() {
  const { records, status } = useQuery<FeedbackRecord>('feedback', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const [filter, setFilter] = useState<FeedbackType | 'all'>('all')

  const sorted = useMemo(
    () => [...records].sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt)),
    [records],
  )
  const filtered = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((record) => record.data.type === filter)),
    [filter, sorted],
  )
  const counts = useMemo(
    () => ({
      all: sorted.length,
      sidequest: sorted.filter((record) => record.data.type === 'sidequest').length,
      improvement: sorted.filter((record) => record.data.type === 'improvement').length,
    }),
    [sorted],
  )

  const filters: Array<[FeedbackType | 'all', string]> = [
    ['all', 'All'],
    ['sidequest', 'Sidequest ideas'],
    ['improvement', 'Improvements'],
  ]

  return (
    <section className="sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter feedback">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === filter}
              onClick={() => setFilter(value)}
              className={cn(
                'sidequest-touch-choice inline-flex items-center rounded-full border-2 border-[oklch(0.31_0.07_240)] px-3.5 py-1.5 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                value === filter ? chipActive : 'sidequest-choice-neutral',
              )}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{counts[value]}</span>
            </button>
          ))}
        </div>
        <Badge className="w-fit shrink-0 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1 text-[oklch(0.22_0.06_240)]">
          {status === 'ready' ? `${filtered.length} shown` : 'Syncing'}
        </Badge>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card">
        {status !== 'ready' ? (
          <FeedbackEmpty>Syncing feedback.</FeedbackEmpty>
        ) : filtered.length === 0 ? (
          <FeedbackEmpty>No feedback yet. Share the board and ideas will land here.</FeedbackEmpty>
        ) : (
          filtered.map((record) => {
            const Icon = typeIcons[record.data.type] ?? Sparkles
            const submitter = record.data.name?.trim()
            return (
              <div
                key={record.recordId}
                className="grid gap-2 border-b-2 border-[oklch(0.31_0.07_240)] p-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className="gap-1.5 rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.92_0.055_205)] px-2.5 py-1 text-[oklch(0.22_0.06_240)]">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {feedbackTypeLabels[record.data.type] ?? 'Feedback'}
                  </Badge>
                  <span className="text-xs font-black tabular-nums text-muted-foreground">
                    {formatRelativeTime(record.data.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-base font-bold leading-7 text-[oklch(0.25_0.06_240)]">
                  {record.data.message}
                </p>
                <p className="text-sm font-black text-[oklch(0.34_0.055_240)]">
                  {submitter || 'Anonymous'}
                </p>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function FeedbackEmpty({ children }: { children: string }) {
  return (
    <div className="m-3 rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.91_0.12_88)] p-4 text-sm font-bold leading-6 text-[oklch(0.32_0.055_240)]">
      {children}
    </div>
  )
}

function formatRelativeTime(value: string) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 'Unknown'
  const diff = Date.now() - time
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'Just now'
  if (diff < hour) {
    const n = Math.floor(diff / minute)
    return `${n} minute${n === 1 ? '' : 's'} ago`
  }
  if (diff < day) {
    const n = Math.floor(diff / hour)
    return `${n} hour${n === 1 ? '' : 's'} ago`
  }
  if (diff < 7 * day) {
    const n = Math.floor(diff / day)
    return `${n} day${n === 1 ? '' : 's'} ago`
  }
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value))
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return 'Something went wrong. Try again in a moment.'
}
