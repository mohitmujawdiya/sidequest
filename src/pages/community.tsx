import { useMemo, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import {
  AuthOverlay,
  useAuth,
  useMutations,
  useQuery,
  useR2Files,
  useUser,
  type RecordData,
} from 'deepspace'
import {
  Camera,
  Compass,
  Heart,
  MessageCircle,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UsersRound,
} from 'lucide-react'
import {
  Badge,
  Button,
  useToast,
} from '../components/ui'
import { cn } from '../components/ui'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { useAnalytics } from '../lib/analytics'
import {
  categoryLabels,
  difficultyLabels,
  type QuestCategory,
} from '../data/quests'
import {
  categoryStyles,
  findQuest,
  formatQuestDate,
  resolveMemoryImageUrl,
  type CommunityReactionKind,
  type CommunityReactionRecord,
  type CommunityPostRecord,
} from '../lib/quest-progress'

type CommunityFilter = QuestCategory | 'any' | 'favorites'

const communityCategoryOptions: Array<[CommunityFilter, string]> = [
  ['any', 'All'],
  ['favorites', 'Favorites'],
  ...(Object.entries(categoryLabels) as Array<[QuestCategory, string]>),
]

export default function CommunityPage() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const { success, error, warning } = useToast()
  const { getUrl } = useR2Files()
  const track = useAnalytics()
  const [activeCategory, setActiveCategory] = useState<CommunityFilter>('any')
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingReaction, setPendingReaction] = useState<string | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [postPendingDelete, setPostPendingDelete] =
    useState<RecordData<CommunityPostRecord> | null>(null)
  const { records: communityRecords, status } = useQuery<CommunityPostRecord>('community_posts', {
    orderBy: 'sharedAt',
    orderDir: 'desc',
  })
  const { records: reactionRecords } = useQuery<CommunityReactionRecord>('community_reactions', {
    orderBy: 'createdAt',
    orderDir: 'desc',
  })
  const communityMutations = useMutations<CommunityPostRecord>('community_posts')
  const reactionMutations = useMutations<CommunityReactionRecord>('community_reactions')

  const posts = useMemo(
    () => [...communityRecords].sort((a, b) => b.data.sharedAt.localeCompare(a.data.sharedAt)),
    [communityRecords],
  )
  const reactionsByPost = useMemo(
    () => buildReactionSummary(reactionRecords, user?.id),
    [reactionRecords, user?.id],
  )
  const filteredPosts = useMemo(() => {
    if (activeCategory === 'any') return posts
    if (activeCategory === 'favorites') {
      return posts.filter((record) => reactionsByPost.get(record.recordId)?.myFavorite)
    }
    return posts.filter((record) => record.data.category === activeCategory)
  }, [activeCategory, posts, reactionsByPost])
  const photoCount = posts.filter((record) => record.data.proofImageKey || record.data.proofImageUrl).length
  const playerCount = new Set(posts.map((record) => record.data.userId || record.data.playerName || record.recordId)).size
  const activeCategoryLabel = getCommunityFilterLabel(activeCategory)

  function requestSignIn(action: string) {
    warning('Sign in to join in', `${action} needs a DeepSpace account.`)
    track('sign_in_prompt', { metadata: { action } })
    setAuthOpen(true)
  }

  async function handleToggleReaction(record: RecordData<CommunityPostRecord>, kind: CommunityReactionKind) {
    if (!isSignedIn || !user?.id) {
      requestSignIn(kind === 'cheer' ? 'Cheering a memory' : 'Favoriting a memory')
      return
    }

    const summary = reactionsByPost.get(record.recordId)
    const existing = kind === 'cheer' ? summary?.myCheer : summary?.myFavorite
    const pendingKey = `${record.recordId}:${kind}`
    setPendingReaction(pendingKey)

    try {
      if (existing) {
        await reactionMutations.remove(existing.recordId)
      } else {
        await reactionMutations.create({
          userId: user.id,
          postId: record.recordId,
          kind,
          createdAt: new Date().toISOString(),
        })
        track(kind === 'cheer' ? 'cheer_memory' : 'favorite_memory', {
          category: record.data.category,
          difficulty: record.data.difficulty,
          questId: record.data.questId,
          questTitle: record.data.questTitle,
          xp: record.data.xp,
        })
      }
    } catch (err) {
      error('Could not update reaction', getErrorMessage(err))
    } finally {
      setPendingReaction(null)
    }
  }

  function requestDeletePost(record: RecordData<CommunityPostRecord>) {
    if (!isSignedIn || !user?.id) {
      requestSignIn('Deleting a public memory')
      return
    }
    if (!canDeletePost(record, user)) {
      warning('Cannot delete this post', 'Only the creator or an admin can remove it.')
      return
    }
    setPostPendingDelete(record)
  }

  async function handleDeletePost() {
    const record = postPendingDelete
    if (!record) return
    const linkedReactions = reactionRecords.filter(
      (reaction) => reaction.data.postId === record.recordId,
    )
    setDeletingPostId(record.recordId)
    try {
      await Promise.all(linkedReactions.map((reaction) => reactionMutations.remove(reaction.recordId)))
      await communityMutations.remove(record.recordId)
      setPostPendingDelete(null)
      success('Community post deleted')
    } catch (err) {
      error('Could not delete post', getErrorMessage(err))
    } finally {
      setDeletingPostId(null)
    }
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sidequest-skyline" aria-hidden />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className="sidequest-panel grid gap-5 bg-[oklch(0.98_0.025_93)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.87_0.13_89)] px-3 py-1.5 text-sm font-extrabold text-[oklch(0.25_0.06_240)] sidequest-mini-shadow">
              <MessageCircle className="h-4 w-4" aria-hidden />
              Community campfire
            </div>
            <h1
              data-testid="community-heading"
              className="sidequest-display max-w-[11ch] text-5xl font-black leading-[0.95] tracking-normal text-[oklch(0.22_0.06_240)] sm:text-6xl"
            >
              Tiny stories from real sidequests.
            </h1>
          </div>

          <div className="grid gap-3">
            <CommunityStat label="Posts" value={posts.length.toString()} icon={Sparkles} />
            <CommunityStat label="Players" value={playerCount.toString()} icon={UsersRound} />
            <CommunityStat label="Photos" value={photoCount.toString()} icon={Camera} />
          </div>
        </section>

        <section className="sidequest-panel mt-5 bg-[oklch(0.98_0.018_93)] p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="sidequest-display text-2xl font-black text-[oklch(0.22_0.06_240)]">
                Latest memories
              </h2>
              {(status !== 'ready' || activeCategory !== 'any') && (
                <p className="mt-1 text-sm font-bold text-muted-foreground">
                  {status === 'ready' ? `${filteredPosts.length} shown.` : 'Syncing.'}
                </p>
              )}
            </div>
            <Button
              asChild
              className="sidequest-button w-fit bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] hover:bg-[oklch(0.64_0.18_205)]"
            >
              <Link to="/home">
                <Compass className="h-4 w-4" aria-hidden />
                Draw a sidequest
              </Link>
            </Button>
          </div>

          <CommunityFilters value={activeCategory} onChange={setActiveCategory} />

          {filteredPosts.length > 0 ? (
            <div data-testid="community-feed" className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredPosts.map((record) => (
                <CommunityMemoryCard
                  key={record.recordId}
                  canDelete={canDeletePost(record, user)}
                  deleting={deletingPostId === record.recordId}
                  imageUrl={resolveMemoryImageUrl(record.data, getUrl)}
                  pendingReaction={pendingReaction}
                  reactions={reactionsByPost.get(record.recordId) ?? emptyReactionSummary}
                  record={record}
                  onDelete={() => requestDeletePost(record)}
                  onToggleReaction={(kind) => handleToggleReaction(record, kind)}
                />
              ))}
            </div>
          ) : (
            <CommunityEmptyState
              activeCategoryLabel={activeCategoryLabel}
              favoritesOnly={activeCategory === 'favorites'}
              hasFilters={activeCategory !== 'any'}
              isReady={status === 'ready'}
              onResetFilters={() => setActiveCategory('any')}
            />
          )}
        </section>
      </div>

      <DeleteConfirmDialog
        open={Boolean(postPendingDelete)}
        loading={Boolean(postPendingDelete && deletingPostId === postPendingDelete.recordId)}
        title="Delete community post?"
        description="This removes the public post from Community. Your private memory stays in Log."
        confirmText="Delete post"
        onConfirm={handleDeletePost}
        onOpenChange={(open) => {
          if (!open && !deletingPostId) setPostPendingDelete(null)
        }}
      />
      {authOpen && <AuthOverlay onClose={() => setAuthOpen(false)} />}
    </div>
  )
}

function CommunityMemoryCard({
  canDelete,
  deleting,
  imageUrl,
  pendingReaction,
  reactions,
  record,
  onDelete,
  onToggleReaction,
}: {
  canDelete: boolean
  deleting: boolean
  imageUrl: string | null
  pendingReaction: string | null
  reactions: ReactionSummary
  record: RecordData<CommunityPostRecord>
  onDelete: () => void
  onToggleReaction: (kind: CommunityReactionKind) => void
}) {
  const quest = findQuest(record.data.questId)
  const Icon = quest?.icon ?? Compass
  const playerName = record.data.playerName?.trim() || 'Adventurer'
  const cheerPending = pendingReaction === `${record.recordId}:cheer`
  const favoritePending = pendingReaction === `${record.recordId}:favorite`

  return (
    <article className="overflow-hidden rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-card sidequest-mini-shadow">
      <div className="relative aspect-[4/3] bg-[oklch(0.86_0.13_218)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Memory from ${record.data.questTitle}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <div
              className={cn(
                'flex h-24 w-24 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] sidequest-mini-shadow',
                categoryStyles[record.data.category],
              )}
            >
              <Icon className="h-12 w-12" aria-hidden />
            </div>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge className="rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.98_0.018_93)] px-2.5 py-1 text-[oklch(0.22_0.06_240)]">
            {record.data.xp} XP
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={cn('rounded-full border-2 border-[oklch(0.28_0.07_240)] px-2.5 py-1', categoryStyles[record.data.category])}>
            {categoryLabels[record.data.category]}
          </Badge>
          <Badge className="rounded-full border-2 border-[oklch(0.28_0.07_240)] bg-[oklch(0.91_0.12_88)] px-2.5 py-1 text-[oklch(0.25_0.06_240)]">
            {difficultyLabels[record.data.difficulty]}
          </Badge>
        </div>
        <h3 className="mt-3 sidequest-display text-2xl font-black leading-none text-[oklch(0.22_0.06_240)]">
          {record.data.questTitle}
        </h3>
        <p className="mt-2 text-sm font-bold text-muted-foreground">
          By {playerName} · {formatQuestDate(record.data.sharedAt)}
        </p>
        {record.data.caption?.trim() && (
          <p className="mt-3 rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.91_0.12_88)] p-3 text-sm font-extrabold leading-6 text-[oklch(0.25_0.06_240)]">
            {record.data.caption.trim()}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-start gap-2">
          <ReactionButton
            active={Boolean(reactions.myCheer)}
            count={reactions.cheerCount}
            disabled={cheerPending || deleting}
            icon={Heart}
            label="Cheer"
            onClick={() => onToggleReaction('cheer')}
          />
          <ReactionButton
            active={Boolean(reactions.myFavorite)}
            count={reactions.favoriteCount}
            disabled={favoritePending || deleting}
            icon={Star}
            label="Favorite"
            onClick={() => onToggleReaction('favorite')}
          />
          {canDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={onDelete}
              aria-label={`Delete ${record.data.questTitle} community post`}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.95_0.06_30)] px-2.5 py-1.5 text-xs font-black text-[oklch(0.34_0.11_28)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {deleting ? 'Deleting' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function ReactionButton({
  active,
  count,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  count: number
  disabled: boolean
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      key={`${label}-${active ? 'selected' : 'idle'}`}
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      onPointerUp={(event) => {
        if (event.pointerType !== 'mouse') {
          event.currentTarget.blur()
        }
      }}
      className={cn(
        'sidequest-touch-choice inline-flex items-center gap-1.5 rounded-full border-2 border-[oklch(0.31_0.07_240)] px-2.5 py-1.5 text-xs font-black disabled:translate-y-0 disabled:opacity-60',
        active
          ? 'bg-[oklch(0.88_0.14_338)] text-[oklch(0.24_0.08_338)]'
          : 'sidequest-choice-neutral',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  )
}

function CommunityFilters({
  value,
  onChange,
}: {
  value: CommunityFilter
  onChange: (value: CommunityFilter) => void
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-sm font-black uppercase tracking-normal text-[oklch(0.30_0.06_240)]">
        Realm
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Community category">
        {communityCategoryOptions.map(([optionValue, optionLabel]) => {
          const active = value === optionValue
          return (
            <button
              key={`${optionValue}-${active ? 'selected' : 'idle'}`}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(optionValue)}
              onPointerUp={(event) => {
                if (event.pointerType !== 'mouse') {
                  event.currentTarget.blur()
                }
              }}
              className={cn(
                'sidequest-touch-choice rounded-full border-2 border-[oklch(0.31_0.07_240)] px-4 py-2 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && optionValue === 'any' && 'bg-[oklch(0.68_0.18_205)] text-[oklch(0.15_0.06_240)] sidequest-chip-shadow',
                active && optionValue === 'favorites' && 'bg-[oklch(0.88_0.14_338)] text-[oklch(0.24_0.08_338)] sidequest-chip-shadow',
                active && optionValue !== 'any' && optionValue !== 'favorites' && categoryStyles[optionValue],
                !active && 'sidequest-choice-neutral',
              )}
            >
              {optionLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CommunityEmptyState({
  activeCategoryLabel,
  favoritesOnly,
  hasFilters,
  isReady,
  onResetFilters,
}: {
  activeCategoryLabel: string
  favoritesOnly: boolean
  hasFilters: boolean
  isReady: boolean
  onResetFilters: () => void
}) {
  return (
    <div className="mt-5 grid min-h-[360px] place-items-center rounded-lg border-2 border-dashed border-[oklch(0.47_0.07_240)] bg-[oklch(0.92_0.055_205)] p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-lg border-2 border-[oklch(0.31_0.07_240)] bg-[oklch(0.88_0.14_338)] sidequest-mini-shadow">
          <Camera className="h-10 w-10 text-[oklch(0.22_0.06_240)]" aria-hidden />
        </div>
        <h3 className="sidequest-display text-3xl font-black leading-none text-[oklch(0.21_0.06_240)]">
          {!isReady
            ? 'Loading the campfire.'
            : favoritesOnly
              ? 'No favorite memories yet.'
            : hasFilters
              ? `No ${activeCategoryLabel.toLowerCase()} memories yet.`
              : 'No public memories yet.'}
        </h3>
        {hasFilters ? (
          <Button
            type="button"
            onClick={onResetFilters}
            className="sidequest-button mt-5 bg-[oklch(0.89_0.14_88)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)]"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Show all memories
          </Button>
        ) : (
          <Button
            asChild
            className="sidequest-button mt-5 bg-[oklch(0.89_0.14_88)] text-[oklch(0.24_0.06_240)] hover:bg-[oklch(0.86_0.15_88)]"
          >
            <Link to="/home">
              <Trophy className="h-4 w-4" aria-hidden />
              Find a sidequest
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}

function CommunityStat({
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

function getCommunityFilterLabel(value: CommunityFilter) {
  if (value === 'any') return 'all realms'
  if (value === 'favorites') return 'favorites'
  return categoryLabels[value]
}

interface ReactionSummary {
  cheerCount: number
  favoriteCount: number
  myCheer?: RecordData<CommunityReactionRecord>
  myFavorite?: RecordData<CommunityReactionRecord>
}

const emptyReactionSummary: ReactionSummary = {
  cheerCount: 0,
  favoriteCount: 0,
}

function buildReactionSummary(
  reactions: RecordData<CommunityReactionRecord>[],
  userId?: string,
) {
  const summary = new Map<string, ReactionSummary>()

  for (const reaction of reactions) {
    const postSummary = summary.get(reaction.data.postId) ?? {
      cheerCount: 0,
      favoriteCount: 0,
    }

    if (reaction.data.kind === 'cheer') {
      postSummary.cheerCount += 1
      if (isOwnRecord(reaction, userId)) postSummary.myCheer = reaction
    } else {
      postSummary.favoriteCount += 1
      if (isOwnRecord(reaction, userId)) postSummary.myFavorite = reaction
    }

    summary.set(reaction.data.postId, postSummary)
  }

  return summary
}

function canDeletePost(
  record: RecordData<CommunityPostRecord>,
  user: { id?: string; role?: string | null } | null | undefined,
) {
  if (!user?.id) return false
  if (user.role === 'admin') return true
  return record.data.userId === user.id || record.createdBy === user.id
}

function isOwnRecord(record: RecordData<{ userId: string }>, userId?: string) {
  if (!userId) return false
  return record.data.userId === userId || record.createdBy === userId
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return 'Something went wrong. Try again in a moment.'
}
