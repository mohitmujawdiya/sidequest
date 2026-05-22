import { useMemo, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import {
  BadgeCheck,
  Camera,
  Compass,
  Crown,
  Medal,
  Sparkles,
  Trophy,
  UsersRound,
} from 'lucide-react'
import {
  Badge,
  Button,
} from '../components/ui'
import { formatQuestDate, type CommunityPostRecord } from '../lib/quest-progress'

interface LeaderboardEntry {
  key: string
  playerName: string
  totalXp: number
  completions: number
  photos: number
  latestSharedAt: string
}

export default function LeaderboardPage() {
  const { records: communityRecords, status } = useQuery<CommunityPostRecord>('community_posts', {
    orderBy: 'sharedAt',
    orderDir: 'desc',
  })

  const rows = useMemo(() => {
    const entries = new Map<string, LeaderboardEntry>()

    for (const record of communityRecords) {
      const key = record.data.userId || record.data.playerName || record.recordId
      const current = entries.get(key)
      const playerName = record.data.playerName?.trim() || 'Adventurer'
      const hasPhoto = Boolean(record.data.proofImageKey || record.data.proofImageUrl)

      if (!current) {
        entries.set(key, {
          key,
          playerName,
          totalXp: record.data.xp,
          completions: 1,
          photos: hasPhoto ? 1 : 0,
          latestSharedAt: record.data.sharedAt,
        })
        continue
      }

      current.totalXp += record.data.xp
      current.completions += 1
      current.photos += hasPhoto ? 1 : 0
      if (record.data.sharedAt > current.latestSharedAt) current.latestSharedAt = record.data.sharedAt
    }

    return [...entries.values()].sort((a, b) => {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp
      if (b.completions !== a.completions) return b.completions - a.completions
      return b.latestSharedAt.localeCompare(a.latestSharedAt)
    })
  }, [communityRecords])

  const totalXp = rows.reduce((sum, row) => sum + row.totalXp, 0)
  const totalCompletions = rows.reduce((sum, row) => sum + row.completions, 0)
  const totalPhotos = rows.reduce((sum, row) => sum + row.photos, 0)

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="sidequest-panel grid gap-5 bg-[oklch(0.98_0.025_93)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
              <Crown className="h-4 w-4" aria-hidden />
              Leaderboard
            </div>
            <h1
              data-testid="leaderboard-heading"
              className="sidequest-display max-w-[11ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
            >
              XP for touching grass.
            </h1>
          </div>

          <div className="grid gap-3">
            <BoardStat label="Players" value={rows.length.toString()} icon={UsersRound} />
            <BoardStat label="Shared XP" value={totalXp.toString()} icon={Trophy} />
            <BoardStat label="Memories" value={totalPhotos.toString()} icon={Camera} />
          </div>
        </section>

        <section className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
                Current standings
              </h2>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {status === 'ready' ? `${totalCompletions} public completions counted.` : 'Syncing public completions.'}
              </p>
            </div>
            <Button
              asChild
              className="sidequest-button w-fit bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]"
            >
              <Link to="/community">
                <Sparkles className="h-4 w-4" aria-hidden />
                See memories
              </Link>
            </Button>
          </div>

          {rows.length > 0 ? (
            <div data-testid="leaderboard-list" className="mt-5 grid gap-3">
              {rows.map((row, index) => (
                <LeaderboardRow key={row.key} rank={index + 1} row={row} />
              ))}
            </div>
          ) : (
            <LeaderboardEmptyState isReady={status === 'ready'} />
          )}
        </section>
      </div>
    </div>
  )
}

function LeaderboardRow({ rank, row }: { rank: number; row: LeaderboardEntry }) {
  const podiumClass =
    rank === 1
      ? 'bg-[oklch(0.87_0.13_89)]'
      : rank === 2
        ? 'bg-[oklch(0.92_0.055_205)]'
        : rank === 3
          ? 'bg-[oklch(0.88_0.14_338)]'
          : 'bg-card'

  return (
    <article className={`grid gap-3 rounded-lg border-2 border-[oklch(0.31_0.07_240)] p-4 sidequest-mini-shadow sm:grid-cols-[76px_1fr_auto] sm:items-center ${podiumClass}`}>
      <div className="flex items-center gap-3 sm:block">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.98_0.018_93)] text-[oklch(0.22_0.06_240)] sidequest-mini-shadow">
          {rank <= 3 ? (
            <Medal className="h-7 w-7" aria-hidden />
          ) : (
            <span className="sidequest-display text-2xl font-black">{rank}</span>
          )}
        </div>
        <span className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)] sm:hidden">
          #{rank}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate sidequest-display text-2xl font-black leading-none text-[oklch(0.22_0.06_240)]">
            {row.playerName}
          </h3>
          {rank <= 3 && (
            <Badge className="rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.98_0.018_93)] px-2.5 py-1 text-[oklch(0.22_0.06_240)]">
              #{rank}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm font-bold text-muted-foreground">
          Last shared {formatQuestDate(row.latestSharedAt)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:min-w-[300px]">
        <MiniMetric icon={Trophy} label="Public XP" value={row.totalXp.toString()} />
        <MiniMetric icon={BadgeCheck} label="Completions" value={row.completions.toString()} />
        <MiniMetric icon={Camera} label="Photos" value={row.photos.toString()} />
      </div>
    </article>
  )
}

function LeaderboardEmptyState({ isReady }: { isReady: boolean }) {
  return (
    <div className="mt-5 grid min-h-[360px] place-items-center rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.92_0.055_205)] p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] sidequest-mini-shadow">
          <Trophy className="h-10 w-10 text-[oklch(0.22_0.06_240)]" aria-hidden />
        </div>
        <h3 className="sidequest-display text-3xl font-black leading-none text-[oklch(0.21_0.06_240)]">
          {isReady ? 'No ranked players yet.' : 'Loading the standings.'}
        </h3>
        <Button
          asChild
          className="sidequest-button mt-5 bg-[oklch(0.89_0.14_88)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)]"
        >
          <Link to="/home">
            <Compass className="h-4 w-4" aria-hidden />
            Draw a sidequest
          </Link>
        </Button>
      </div>
    </div>
  )
}

function BoardStat({
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
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {label}
      </div>
      <div className="mt-1 sidequest-display text-3xl font-black leading-none text-[oklch(0.22_0.06_240)]">
        {value}
      </div>
    </div>
  )
}

function MiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.98_0.018_93)] p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[11px] font-black uppercase tracking-normal text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        {label}
      </div>
      <div className="mt-1 sidequest-display text-xl font-black leading-none text-[oklch(0.22_0.06_240)]">
        {value}
      </div>
    </div>
  )
}
