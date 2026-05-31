import { useMemo, useState, type ComponentType } from 'react'
import { AuthOverlay, useAuth, useQuery, useUser, type RecordData } from 'deepspace'
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Compass,
  Lock,
  MessageCircle,
  MousePointerClick,
  Route,
  Sparkles,
  Trophy,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { Badge, Button } from '../components/ui'
import type { AnalyticsEventRecord, AnalyticsEventType } from '../lib/analytics'

type EventRecord = RecordData<AnalyticsEventRecord>
type UserRecord = RecordData<AnalyticsUserRecord>

interface AnalyticsUserRecord {
  createdAt?: string
  email?: string
  imageUrl?: string
  lastSeenAt?: string
  name?: string
  role?: string
}

const eventLabels: Record<AnalyticsEventType, string> = {
  page_view: 'Page view',
  shuffle_sidequest: 'Shuffle',
  save_sidequest: 'Save',
  accept_sidequest: 'Accept',
  complete_sidequest: 'Complete',
  post_memory: 'Post',
  cheer_memory: 'Cheer',
  favorite_memory: 'Favorite',
  sign_in_prompt: 'Sign-in prompt',
  mascot_tap: 'Mascot tap',
  deepspace_cta_click: 'DeepSpace click',
  scroll_depth: 'Scroll depth',
}

const funnelEvents: Array<{ event: AnalyticsEventType; label: string; icon: ComponentType<{ className?: string }> }> = [
  { event: 'page_view', label: 'Views', icon: Activity },
  { event: 'shuffle_sidequest', label: 'Shuffles', icon: Sparkles },
  { event: 'accept_sidequest', label: 'Accepts', icon: Compass },
  { event: 'complete_sidequest', label: 'Completes', icon: BadgeCheck },
  { event: 'post_memory', label: 'Posts', icon: MessageCircle },
]

export default function AnalyticsPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const [authOpen, setAuthOpen] = useState(false)
  const isAdmin = user?.role === 'admin'

  if (!isSignedIn || !isAdmin) {
    return (
      <div className="min-h-full bg-background text-foreground">
        <div className="sidequest-skyline" aria-hidden />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
          <section className="sidequest-panel bg-[oklch(0.98_0.025_93)] p-5 sm:p-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
              <Lock className="h-4 w-4" aria-hidden />
              Admin only
            </div>
            <h1 className="sidequest-display max-w-[12ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl">
              Analytics
            </h1>
            <p className="mt-4 max-w-xl text-base font-bold leading-7 text-muted-foreground">
              This page is only visible to admins.
            </p>
            {!isSignedIn && (
              <Button
                onClick={() => setAuthOpen(true)}
                className="sidequest-button mt-5 bg-primary px-5 text-primary-foreground"
              >
                Sign in
              </Button>
            )}
          </section>
        </div>
        {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
      </div>
    )
  }

  return <AnalyticsDashboard />
}

function AnalyticsDashboard() {
  const { records, status } = useQuery<AnalyticsEventRecord>('analytics_events', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const { records: userRecords, status: userStatus } = useQuery<AnalyticsUserRecord>('users', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const analytics = useMemo(() => buildAnalytics(records, userRecords), [records, userRecords])

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="sidequest-panel grid gap-5 bg-[oklch(0.98_0.025_93)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
              <BarChart3 className="h-4 w-4" aria-hidden />
              Admin analytics
            </div>
            <h1
              data-testid="analytics-heading"
              className="sidequest-display max-w-[12ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
            >
              Sidequest pulse.
            </h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AnalyticsStat label="Visitors" value={analytics.totalSessions.toString()} icon={UsersRound} />
            <AnalyticsStat label="Signups" value={analytics.totalUsers.toString()} icon={UserPlus} />
            <AnalyticsStat label="7-day signups" value={analytics.newUsers7d.toString()} icon={CalendarDays} />
            <AnalyticsStat label="7-day users" value={analytics.activeUsers7d.toString()} icon={Activity} />
            <AnalyticsStat label="Accept rate" value={formatPercent(analytics.acceptRate)} icon={MousePointerClick} />
            <AnalyticsStat label="Complete rate" value={formatPercent(analytics.completeRate)} icon={Trophy} />
            <div className="sm:col-span-2">
              <AnalyticsStat label="DeepSpace clicks" value={analytics.deepspaceClicks.toString()} icon={MousePointerClick} />
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
            <PanelHeading
              title="Last 7 days"
              meta={status === 'ready' ? `${analytics.events7d.length} events` : 'Syncing'}
            />
            <div className="mt-5 grid grid-cols-7 gap-2" aria-label="Last 7 days activity">
              {analytics.daily.map((day) => (
                <div key={day.key} className="min-w-0">
                  <div className="flex h-36 items-end rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.92_0.055_205)] p-2">
                    <div
                      className="w-full rounded-md border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] sidequest-mini-shadow"
                      style={{ height: `${Math.max(8, day.height)}%` }}
                      aria-label={`${day.label}: ${day.events} events`}
                    />
                  </div>
                  <div className="mt-2 truncate text-center text-xs font-black text-[oklch(0.31_0.055_240)]">
                    {day.shortLabel}
                  </div>
                  <div className="text-center text-xs font-bold tabular-nums text-muted-foreground">
                    {day.events}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
            <PanelHeading title="Funnel" meta={`${analytics.totalEvents} total`} />
            <div className="mt-4 space-y-3">
              {funnelEvents.map(({ event, icon: Icon, label }) => {
                const count = analytics.eventCounts.get(event) ?? 0
                const width = analytics.maxFunnelCount > 0 ? (count / analytics.maxFunnelCount) * 100 : 0
                return (
                  <div key={event}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-sm font-black text-[oklch(0.22_0.06_240)]">
                        <Icon className="h-4 w-4" aria-hidden />
                        {label}
                      </span>
                      <span className="text-sm font-black tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.92_0.055_205)]">
                      <div className="h-full rounded-full bg-[oklch(0.68_0.18_205)]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
            <PanelHeading title="Top sidequests" meta="By tracked actions" />
            <div className="mt-4 overflow-hidden rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card">
              {analytics.topQuests.length > 0 ? (
                analytics.topQuests.map((quest, index) => (
                  <div
                    key={quest.key}
                    className="grid gap-3 border-b-2 border-[oklch(0.31_0.07_240)] p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase tracking-normal text-muted-foreground">
                        #{index + 1}
                      </div>
                      <div className="mt-1 truncate text-base font-black text-[oklch(0.22_0.06_240)]">
                        {quest.title}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <MetricPill label="Accept" value={quest.accepts} />
                      <MetricPill label="Complete" value={quest.completes} />
                      <MetricPill label="Post" value={quest.posts} />
                    </div>
                  </div>
                ))
              ) : (
                <AnalyticsEmpty>No sidequest actions yet.</AnalyticsEmpty>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
              <PanelHeading title="Routes" meta="Page views" />
              <div className="mt-4 space-y-2">
                {analytics.routes.length > 0 ? (
                  analytics.routes.map((route) => (
                    <div
                      key={route.route}
                      className="flex items-center justify-between gap-3 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card px-3 py-2"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2 text-sm font-black text-[oklch(0.22_0.06_240)]">
                        <Route className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{route.route}</span>
                      </span>
                      <span className="text-sm font-black tabular-nums text-muted-foreground">
                        {route.count}
                      </span>
                    </div>
                  ))
                ) : (
                  <AnalyticsEmpty>No page views yet.</AnalyticsEmpty>
                )}
              </div>
            </div>

            <div className="sidequest-panel bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
              <PanelHeading
                title="Signups"
                meta={userStatus === 'ready' ? `${analytics.totalUsers} total` : 'Syncing'}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <MetricPill label="Today" value={analytics.newUsersToday} />
                <MetricPill label="7 days" value={analytics.newUsers7d} />
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card">
                {analytics.recentUsers.length > 0 ? (
                  analytics.recentUsers.map((record) => (
                    <div
                      key={record.recordId}
                      className="grid gap-3 border-b-2 border-[oklch(0.31_0.07_240)] p-3 last:border-b-0 sm:grid-cols-[36px_minmax(0,1fr)_84px] sm:items-center"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] text-sm font-black text-[oklch(0.22_0.06_240)]">
                        {getUserInitial(record)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-[oklch(0.22_0.06_240)]">
                          {getUserDisplayName(record)}
                        </div>
                        <div className="truncate text-xs font-bold text-muted-foreground">
                          {record.data.email || 'No email'}
                        </div>
                      </div>
                      <div className="text-xs font-black tabular-nums text-muted-foreground sm:text-right">
                        {formatDate(getUserCreatedAt(record))}
                      </div>
                    </div>
                  ))
                ) : (
                  <AnalyticsEmpty>No signups yet.</AnalyticsEmpty>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
          <PanelHeading title="Recent events" meta={analytics.latestLabel} />
          <div className="mt-4 overflow-hidden rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card">
            {analytics.recent.length > 0 ? (
              analytics.recent.map((record) => (
                <div
                  key={record.recordId}
                  className="grid gap-2 border-b-2 border-[oklch(0.31_0.07_240)] p-3 last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)_120px] md:items-center"
                >
                  <div className="text-sm font-black text-[oklch(0.22_0.06_240)]">
                    {eventLabels[record.data.eventType]}
                  </div>
                  <div className="min-w-0 text-sm font-bold text-muted-foreground">
                    {record.data.questTitle || record.data.route || 'Sidequest'}
                  </div>
                  <div className="text-sm font-black tabular-nums text-muted-foreground md:text-right">
                    {formatTime(record.data.createdAt)}
                  </div>
                </div>
              ))
            ) : (
              <AnalyticsEmpty>Fresh installs start empty. Go browse the app and this will fill in.</AnalyticsEmpty>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function AnalyticsStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card p-3 sidequest-mini-shadow">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-normal text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[oklch(0.31_0.07_240)]" aria-hidden />
      </div>
      <div className="mt-2 sidequest-display text-3xl font-black leading-none text-[oklch(0.22_0.06_240)]">
        {value}
      </div>
    </div>
  )
}

function PanelHeading({ meta, title }: { meta?: string; title: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
        {title}
      </h2>
      {meta && (
        <Badge className="w-fit rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1 text-[oklch(0.22_0.06_240)]">
          {meta}
        </Badge>
      )}
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.92_0.055_205)] px-2.5 py-1 text-xs font-black text-[oklch(0.24_0.06_240)]">
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  )
}

function AnalyticsEmpty({ children }: { children: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.91_0.12_88)] p-4 text-sm font-bold leading-6 text-[oklch(0.32_0.055_240)]">
      {children}
    </div>
  )
}

function buildAnalytics(records: EventRecord[], userRecords: UserRecord[]) {
  const sorted = [...records].sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt))
  const sortedUsers = [...userRecords].sort((a, b) => getTime(getUserCreatedAt(b)) - getTime(getUserCreatedAt(a)))
  const now = new Date()
  const todayStart = startOfDay(now).getTime()
  const sevenDaysAgo = todayStart - 6 * 24 * 60 * 60 * 1000
  const events7d = sorted.filter((record) => getTime(record.data.createdAt) >= sevenDaysAgo)
  const usersToday = sortedUsers.filter((record) => getTime(getUserCreatedAt(record)) >= todayStart)
  const users7d = sortedUsers.filter((record) => getTime(getUserCreatedAt(record)) >= sevenDaysAgo)
  const totalSessions = uniqueCount(sorted.map((record) => record.data.sessionId))
  const activeSessions7d = uniqueCount(events7d.map((record) => record.data.sessionId))
  const activeUsers7d = uniqueCount(events7d.map((record) => record.data.userId))
  const eventCounts = countBy(sorted, (record) => record.data.eventType)
  const visitors = Math.max(1, totalSessions)
  const accepts = eventCounts.get('accept_sidequest') ?? 0
  const completes = eventCounts.get('complete_sidequest') ?? 0
  const acceptRate = accepts / visitors
  const completeRate = accepts > 0 ? completes / accepts : 0
  const daily = buildDaily(events7d, now)
  const maxFunnelCount = Math.max(0, ...funnelEvents.map((item) => eventCounts.get(item.event) ?? 0))
  const topQuests = buildTopQuests(sorted)
  const routes = Array.from(countBy(
    sorted.filter((record) => record.data.eventType === 'page_view'),
    (record) => record.data.route ?? '/',
  ))
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    activeSessions7d,
    activeUsers7d,
    acceptRate,
    completeRate,
    daily,
    eventCounts,
    events7d,
    latestLabel: sorted[0] ? formatDate(sorted[0].data.createdAt) : 'No events',
    maxFunnelCount,
    recent: sorted.slice(0, 12),
    routes,
    topQuests,
    deepspaceClicks: eventCounts.get('deepspace_cta_click') ?? 0,
    totalEvents: sorted.length,
    totalSessions,
    totalUsers: sortedUsers.length,
    newUsersToday: usersToday.length,
    newUsers7d: users7d.length,
    recentUsers: sortedUsers.slice(0, 6),
  }
}

function buildDaily(records: EventRecord[], now: Date) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(new Date(now))
    date.setDate(date.getDate() - (6 - index))
    const key = toDateKey(date)
    return {
      date,
      events: 0,
      key,
      label: formatDate(date.toISOString()),
      shortLabel: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
    }
  })
  const dayMap = new Map(days.map((day) => [day.key, day]))
  for (const record of records) {
    const day = dayMap.get(toDateKey(new Date(record.data.createdAt)))
    if (day) day.events += 1
  }
  const max = Math.max(1, ...days.map((day) => day.events))
  return days.map((day) => ({
    ...day,
    height: (day.events / max) * 100,
  }))
}

function buildTopQuests(records: EventRecord[]) {
  const questMap = new Map<string, { accepts: number; completes: number; key: string; posts: number; title: string }>()
  for (const record of records) {
    if (!record.data.questId && !record.data.questTitle) continue
    if (!['accept_sidequest', 'complete_sidequest', 'post_memory'].includes(record.data.eventType)) continue
    const key = record.data.questId ?? record.data.questTitle ?? 'unknown'
    const existing = questMap.get(key) ?? {
      accepts: 0,
      completes: 0,
      key,
      posts: 0,
      title: record.data.questTitle ?? 'Untitled sidequest',
    }
    if (record.data.eventType === 'accept_sidequest') existing.accepts += 1
    if (record.data.eventType === 'complete_sidequest') existing.completes += 1
    if (record.data.eventType === 'post_memory') existing.posts += 1
    questMap.set(key, existing)
  }
  return Array.from(questMap.values())
    .sort((a, b) => (b.accepts + b.completes * 2 + b.posts * 3) - (a.accepts + a.completes * 2 + a.posts * 3))
    .slice(0, 6)
}

function countBy<T, K>(items: T[], getKey: (item: T) => K) {
  const map = new Map<K, number>()
  for (const item of items) {
    const key = getKey(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function uniqueCount(values: Array<string | undefined>) {
  return new Set(values.filter(Boolean)).size
}

function getUserCreatedAt(record: UserRecord) {
  return record.data.createdAt || record.createdAt || record.data.lastSeenAt || ''
}

function getUserDisplayName(record: UserRecord) {
  return record.data.name || record.data.email || 'Unnamed user'
}

function getUserInitial(record: UserRecord) {
  return getUserDisplayName(record).trim().slice(0, 1).toUpperCase() || '?'
}

function getTime(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function toDateKey(value: Date) {
  if (!Number.isFinite(value.getTime())) return ''
  return value.toISOString().slice(0, 10)
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatDate(value: string) {
  if (!Number.isFinite(new Date(value).getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
